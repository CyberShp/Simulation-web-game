import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Authoring coordinates are metres, Y up, the main facade faces +Z.
export async function buildReferenceWorld(loader) {
  const group=new THREE.Group();group.name='YunxiuReferenceCourtyard';
  const random=(()=>{let s=130131;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};})();
  const texLoader=new THREE.TextureLoader();
  const texture=async(name,repeat=1,color=false)=>{const t=await texLoader.loadAsync('./assets/surfaces/'+name+'.jpg');t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=8;return t;};
  const [hall,pavilion,pine,pineBent,cliff,peak,peakB,peakC,rock,shrub,stoneNormal,stoneRough,stoneColor,soilColor,soilNormal]=await Promise.all([
    loader.loadAsync('./assets/reference/main-hall.glb'),loader.loadAsync('./assets/reference/pavilion.glb'),
    loader.loadAsync('./assets/reference/pine-hero.glb'),loader.loadAsync('./assets/reference/pine-windswept.glb'),
    loader.loadAsync('./assets/reference/cliff-tall.glb'),loader.loadAsync('./assets/reference/peak-distant.glb'),loader.loadAsync('./assets/reference/peak-distant-b.glb'),loader.loadAsync('./assets/reference/peak-distant-c.glb'),loader.loadAsync('./assets/nature/boulder.glb'),loader.loadAsync('./assets/reference/shrub.glb'),
    texture('paving-normal',.7),texture('paving-roughness',.7),texture('paving-color',.18,true),texture('forest-color',4,true),texture('forest-normal',4)
  ]);
  for(const source of [rock,cliff])source.scene.traverse(n=>{if(n.isMesh){n.material=n.material.clone();n.material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
float luminance=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(luminance)*vec3(1.02,1.03,1.0),.75);`);};n.material.customProgramCacheKey=()=> 'limestone-toning';}});
  const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.9,...extra});
  const mat={
    stone:material(0xe1e4e1,{map:stoneColor,normalMap:stoneNormal,normalScale:new THREE.Vector2(.10,.10),roughnessMap:stoneRough}),
    pale:material(0xe5e6dc,{map:stoneColor,normalMap:stoneNormal,normalScale:new THREE.Vector2(.14,.14)}),
    dark:material(0x555f59), joints:material(0x656b61), trim:material(0xa4aa9c),
    wood:material(0x322b21), roof:material(0x2a3435), gold:material(0x8c805d,{metalness:.4,roughness:.68}),
    flags:material(0x777c6a,{side:THREE.DoubleSide}), flagEdge:material(0xc0b894,{side:THREE.DoubleSide}),
    grass:material(0x475d30,{side:THREE.DoubleSide}), grassLight:material(0x78834a,{side:THREE.DoubleSide}),
    soil:material(0xffffff,{map:soilColor,normalMap:soilNormal,normalScale:new THREE.Vector2(.48,.48),vertexColors:true}),
    moss:material(0x626e43), darkMoss:material(0x455b34), flower:material(0xdbd3c0,{side:THREE.DoubleSide}),
    lamp:material(0xdfc17b,{emissive:0xf4b765,emissiveIntensity:.2}),
  };
  mat.soil.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
float soilL=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
diffuseColor.rgb=vec3(.25,.30,.12)*(soilL*2.8+.42);`);};
  for(const source of [pine,pineBent,shrub])source.scene.traverse(n=>{if(n.isMesh&&n.material.alphaTest>0){n.material=n.material.clone();n.material.color.setRGB(.42,.63,.30);n.material.roughness=1;n.material.envMapIntensity=.1;n.material.alphaToCoverage=true;}});
  const batches=new Map(),object=new THREE.Object3D();
  const cube=new RoundedBoxGeometry(1,1,1,1,.055),plainCube=new THREE.BoxGeometry(1,1,1),cylinder=new THREE.CylinderGeometry(1,1,1,8),sphere=new THREE.IcosahedronGeometry(1,1);
  function put(key,geo,mt,p,scale=[1,1,1],rotation=[0,0,0],tint=0xffffff){
    if(!batches.has(key))batches.set(key,{geo,mt,items:[]});
    object.position.set(...p);object.rotation.set(...rotation);object.scale.set(...scale);object.updateMatrix();
    batches.get(key).items.push([object.matrix.clone(),new THREE.Color(tint)]);
  }
  const box=(m,p,s,ry=0,tint=0xffffff)=>put('box-'+m,cube,mat[m],p,s,[0,ry,0],tint);
  const rod=(m,a,b,r=.08)=>{
    const pa=new THREE.Vector3(...a),pb=new THREE.Vector3(...b),d=pb.clone().sub(pa);object.position.copy(pa).add(pb).multiplyScalar(.5);object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());object.scale.set(r,d.length(),r);object.updateMatrix();
    const key='rod-'+m;if(!batches.has(key))batches.set(key,{geo:cylinder,mt:mat[m],items:[]});batches.get(key).items.push([object.matrix.clone(),new THREE.Color(0xffffff)]);
  };
  const poly=(points,mt,name)=>{const geo=new THREE.BufferGeometry(),verts=[],uv=[],color=[];const center=new THREE.Vector3();points.forEach(p=>center.add(new THREE.Vector3(...p)));center.divideScalar(points.length);
    for(let i=0;i<points.length;i++){for(const p of [[center.x,center.y,center.z],points[(i+1)%points.length],points[i]]){verts.push(...p);uv.push(p[0]/7,p[2]/7);const c=new THREE.Color().setHSL(.21,.22,.49+random()*.14);color.push(c.r,c.g,c.b);}}
    geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setAttribute('color',new THREE.Float32BufferAttribute(color,3));geo.computeVertexNormals();const m=new THREE.Mesh(geo,mt);m.name=name;m.receiveShadow=true;group.add(m);return m;};
  function asset(source,name,p,scale=[1,1,1],ry=0){const model=source.scene.clone(true);model.name=name;model.position.set(...p);model.scale.set(...scale);model.rotation.y=ry;model.traverse(n=>{if(n.isMesh){n.castShadow=n.receiveShadow=true;}});group.add(model);return model;}
  const mainHall=asset(hall,'MainHall',[0,4,-28],[1.18,1,1]);
  asset(pavilion,'WestPavilion',[-36,4,-16],[1,1,1],.1);
  asset(pavilion,'EastPavilion',[37,4,-17],[1,1,1],-.16);

  // Layered island: continuous stone mass below gardens and the measured square.
  const islandTop=[[-49,2,-37],[-12,2,-49],[31,2,-42],[46,2,-28],[34,2,4],[31,2,25],[18,1,40],[12,-2,55],[-12,-2,58],[-27,1,34],[-42,2,14],[-54,2,-12]];
  const groundY=(x,z)=>z<24?1.92:z<30?1.92-(z-24)*.40:z<43?-.48-(z-30)*.125:-2.1;
  const inside=(x,z)=>{let yes=false;for(let i=0,j=islandTop.length-1;i<islandTop.length;j=i++){const a=islandTop[i],b=islandTop[j];if((a[2]>z)!==(b[2]>z)&&x<(b[0]-a[0])*(z-a[2])/(b[2]-a[2])+a[0])yes=!yes;}return yes;};
  const gv=[],guv=[],gc=[];
  const vertex=(x,z)=>{const y=groundY(x,z);gv.push(x,y,z);guv.push(x/10,z/10);const v=.7+.12*Math.sin(x*.55)*Math.cos(z*.38)+random()*.1,c=new THREE.Color().setRGB(v,v,v*.86);gc.push(c.r,c.g,c.b);};
  for(let z=-49;z<59;z+=1.4)for(let x=-55;x<48;x+=1.4){if(!inside(x+.7,z+.7))continue;[[x,z],[x,z+1.4],[x+1.4,z],[x+1.4,z],[x,z+1.4],[x+1.4,z+1.4]].forEach(p=>vertex(...p));}
  const groundGeometry=new THREE.BufferGeometry();groundGeometry.setAttribute('position',new THREE.Float32BufferAttribute(gv,3));groundGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(guv,2));groundGeometry.setAttribute('color',new THREE.Float32BufferAttribute(gc,3));groundGeometry.computeVertexNormals();const groundMesh=new THREE.Mesh(groundGeometry,mat.soil);groundMesh.receiveShadow=true;group.add(groundMesh);
  islandTop.forEach(p=>p[1]=groundY(p[0],p[2]));
  const sideGeo=new THREE.BufferGeometry(),sideVerts=[];
  for(let i=0;i<islandTop.length;i++){const a=islandTop[i],b=islandTop[(i+1)%islandTop.length],bottom=-22-random()*8;sideVerts.push(...a,...b,b[0]*.83,bottom,b[2]*.83,...a,b[0]*.83,bottom,b[2]*.83,a[0]*.85,bottom,a[2]*.85);}
  sideGeo.setAttribute('position',new THREE.Float32BufferAttribute(sideVerts,3));sideGeo.computeVertexNormals();const cliffCore=new THREE.Mesh(sideGeo,material(0x777f76));group.add(cliffCore);cliffCore.castShadow=cliffCore.receiveShadow=true;

  // Individual pale limestone slabs with narrow joints and measured borders.
  box('joints',[0,1.76,6],[42.7,.45,36.5]);
  for(let row=0;row<24;row++)for(let col=0;col<18;col++){
    const x=-20.0+col*2.35+(row%2?.09:0),z=-11.15+row*1.52;
    const tint=new THREE.Color().setHSL(.12+random()*.015,.015+random()*.02,.91+random()*.07);
    put('limestone-slabs',cube,mat.stone,[x,1.96+random()*.018,z],[2.315,.15,1.485],[0,0,0],tint);
  }
  for(const x of [-21.3,21.3])for(let z=-12;z<24.5;z+=1.5)box('pale',[x,2,z],[.4,.22,1.48]);
  for(const z of [-12.3,24.3])for(let x=-21.4;x<21.5;x+=1.45)box('pale',[x,2,z],[1.43,.24,.5]);
  for(const x of [-19.7,19.7])box('trim',[x,2.049,6],[.06,.015,33]);
  for(const z of [-10.5,22.5])box('trim',[0,2.05,z],[39.4,.015,.06]);
  // The inlaid circular seal is geometric stonework, sharing the courtyard depth.
  const discCenter=new THREE.Vector3(-.5,2.09,6),sealMat=material(0x727668,{roughness:.97});
  const ring=(radius,width)=>{const mesh=new THREE.Mesh(new THREE.RingGeometry(radius-width,radius,160),sealMat);mesh.rotation.x=-Math.PI/2;mesh.position.copy(discCenter);group.add(mesh);};
  [6.3,6.08,5.6,4.28].forEach((r,i)=>ring(r,i===1?.065:.11));
  for(let i=0;i<64;i++){const a=i*Math.PI/32;const r=5.32;box('trim',[discCenter.x+Math.sin(a)*r,2.098,discCenter.z+Math.cos(a)*r],[.055,.011,.33],a);}
  for(let i=0;i<8;i++){
    const angle=i*Math.PI/4;const curve=[];for(let j=0;j<=34;j++){const u=j/34,rad=2.2+1.6*u,theta=angle+Math.sin(u*Math.PI*2)*.28;curve.push(new THREE.Vector3(discCenter.x+Math.sin(theta)*rad,2.103,discCenter.z+Math.cos(theta)*rad));}
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curve),34,.022,4,false),sealMat);group.add(mesh);
  }
  ring(1.05,.06);ring(.52,.04);

  function stair(x,z,width,bottom,top,length,forward=1){
    const count=Math.ceil((top-bottom)/.19),step=length/count;
    for(let i=0;i<count;i++){const h=(top-bottom)*(i+1)/count;box('stone',[x,bottom+h/2,z+forward*(length-(i+.5)*step)],[width,h,step+.018]);box('pale',[x,bottom+h+.011,z+forward*(length-(i+1)*step)],[width+.025,.036,.10]);}
  }
  stair(0,-20,18,2,5.8,8);
  // Front threshold descending to the approach; stone cheeks follow the flight.
  stair(0,24.4,15,-.2,2,5.5,1);
  for(const x of [-8.2,8.2])box('stone',[x,.7,26.1],[1.0,2.45,5.5]);
  function pathSlabs(x,z,width,length,y,heading=0){
    const nx=Math.max(2,Math.round(width/1.5)),nz=Math.max(2,Math.round(length/1.5));
    for(let r=0;r<nz;r++)for(let c=0;c<nx;c++){const lx=(c+.5)*width/nx-width/2,lz=(r+.5)*length/nz-length/2;
      box('stone',[x+lx*Math.cos(heading)+lz*Math.sin(heading),y,z-lx*Math.sin(heading)+lz*Math.cos(heading)],[width/nx-.015,.18,length/nz+.04],heading,new THREE.Color().setScalar(.80+random()*.19));}
  }
  for(let z=30;z<67;z+=1.0){const x=.012*Math.max(0,z-30)**2,y=groundY(x,z)+.15,heading=-Math.atan(.024*Math.max(0,z-30));pathSlabs(x,z,11,1.18,y,heading);}
  pathSlabs(-29,0,18,5,2.01,.25);pathSlabs(29,2,18,5,2.01,-.2);
  stair(-36,-11,7,2,5.8,7);stair(37,-12,7,2,5.8,7);

  function railing(a,b,height=1.15){
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),n=Math.ceil(start.distanceTo(end)/1.9);
    for(let i=0;i<=n;i++){const p=start.clone().lerp(end,i/n);box('stone',[p.x,p.y+.55,p.z],[.28,1.1,.28]);box('pale',[p.x,p.y+1.13,p.z],[.40,.16,.40]);put('finial',sphere,mat.pale,[p.x,p.y+1.28,p.z],[.19,.16,.19]);}
    for(let i=0;i<n;i++){
      const p=start.clone().lerp(end,(i+.5)/n),d=start.distanceTo(end)/n,ry=Math.atan2(end.x-start.x,end.z-start.z);
      box('pale',[p.x,p.y+.96,p.z],[.15,.14,d],ry);box('stone',[p.x,p.y+.38,p.z],[.13,.13,d],ry);
      for(let j=0;j<3;j++){const q=start.clone().lerp(end,(i+(j+1)/4)/n);box('stone',[q.x,q.y+.65,q.z],[.08,.49,.08]);}
    }
  }
  for(const side of [-1,1]){
    railing([side*21.9,2,-9],[side*21.9,2,8]);railing([side*21.9,2,13],[side*21.9,2,23]);
    railing([side*8.7,2,24.7],[side*20.8,2,24.7]);
    railing([side*9.6,2,-12.1],[side*18,4,-19]);
  }
  // Side terraces and low rear garden walls.
  for(const [x,z]of[[-36,-16],[37,-17]]){
    box('stone',[x,3.0,z],[15,2,15]);
    railing([x-7.6,4,z+7.4],[x-4.5,4,z+7.4]);railing([x+4.5,4,z+7.4],[x+7.6,4,z+7.4]);
    railing([x-7.6,4,z-7.3],[x-7.6,4,z+7.3]);railing([x+7.6,4,z-7.3],[x+7.6,4,z+7.3]);
  }
  for(const side of [-1,1])for(let i=0;i<7;i++){
    box('pale',[side*(17+i*1.6),3.15,-28],[1.56,2.3,.75]);box('roof',[side*(17+i*1.6),4.37,-28],[1.6,.24,.95]);
  }

  function lantern(x,y,z,scale=1){
    box('stone',[x,y+.19*scale,z],[.85*scale,.38*scale,.85*scale]);
    box('pale',[x,y+1.15*scale,z],[.40*scale,1.6*scale,.40*scale]);
    box('stone',[x,y+2.05*scale,z],[.84*scale,.20*scale,.84*scale]);
    box('lamp',[x,y+2.44*scale,z],[.60*scale,.57*scale,.60*scale]);
    for(const dx of [-.35,.35])for(const dz of[-.35,.35])box('wood',[x+dx*scale,y+2.42*scale,z+dz*scale],[.07*scale,.70*scale,.07*scale]);
    const roofGeo=new THREE.ConeGeometry(.76*scale,.38*scale,4);put('lantern-roof-'+scale,roofGeo,mat.roof,[x,y+2.98*scale,z],[1,1,1],[0,Math.PI/4,0]);
    put('lamp-finial',sphere,mat.gold,[x,y+3.27*scale,z],[.10*scale,.16*scale,.1*scale]);
  }
  function banner(x,y,z,side=1){
    rod('wood',[x,y,z],[x,y+5.3,z],.085);rod('gold',[x-.82,y+4.95,z],[x+.82,y+4.95,z],.05);
    const geo=new THREE.PlaneGeometry(1.38,3.3,8,18),p=geo.attributes.position;for(let i=0;i<p.count;i++){const v=p.getY(i);p.setZ(i,Math.sin(v*1.7+x)*.1+(1.65-v)*.025);}geo.computeVertexNormals();
    const cloth=new THREE.Mesh(geo,mat.flagEdge);cloth.position.set(x,y+3.18,z+.10);group.add(cloth);cloth.castShadow=true;
    const inset=geo.clone();inset.scale(.82,.96,1);const inner=new THREE.Mesh(inset,mat.flags);inner.position.set(x,y+3.18,z+.12);group.add(inner);
    const emblem=new THREE.Mesh(new THREE.TorusGeometry(.30,.014,4,48),mat.flagEdge);emblem.position.set(x,y+4.02,z+.23);group.add(emblem);
    box('stone',[x,y+.14,z],[.65,.28,.65]);
  }
  for(const side of [-1,1])for(const [z,s]of[[-10,.8],[7,.88],[23,1]]){lantern(side*19.5,2,z,s);banner(side*18,2,z+1.5,side);}
  for(const side of [-1,1])lantern(side*7.5,-.1,33,1.1);

  // Stone arch bridge over the river, assembled as voussoirs and matching railings.
  const bx=33.5,bz=16.5,length=22,width=5.5;
  const deckY=u=>1.65+2.2*Math.sin(u*Math.PI);
  const archShape=new THREE.Shape();
  for(let i=0;i<=44;i++){const u=i/44,x=-length/2+length*u,y=deckY(u)-.2;i?archShape.lineTo(x,y):archShape.moveTo(x,y);}
  for(let i=44;i>=0;i--){const u=i/44;archShape.lineTo(-length/2+length*u,-5+7.2*Math.sqrt(Math.max(0,1-(2*u-1)**2)));}archShape.closePath();
  const archMesh=new THREE.Mesh(new THREE.ExtrudeGeometry(archShape,{depth:width,bevelEnabled:false,steps:1,curveSegments:32}),mat.stone);archMesh.position.set(bx,0,bz-width/2);archMesh.castShadow=archMesh.receiveShadow=true;group.add(archMesh);
  for(let i=0;i<34;i++){
    const u=(i+.5)/34,x=bx-length/2+length*u,y=deckY(u),slope=Math.atan(2.2*Math.PI/length*Math.cos(u*Math.PI));
    put('bridge-stone',cube,mat.stone,[x,y-.15,bz],[length/34+.04,.48,width],[0,0,slope]);
    for(const dz of[-width/2,width/2]){
      const lower=new THREE.Vector3(x,y-.58,bz+dz);box('pale',[x,lower.y,lower.z],[length/34+.025,.55,.38]);
    }
  }
  for(const dz of[-2.65,2.65]){
    for(let i=0;i<11;i++){const u0=i/11,u1=(i+1)/11;railing([bx-length/2+length*u0,deckY(u0),bz+dz],[bx-length/2+length*u1,deckY(u1),bz+dz]);}
  }
  for(const x of[bx-length/2,bx+length/2])for(const z of[bz-2.1,bz+2.1])lantern(x,1.65,z,.75);
  for(const x of[bx-length/2-.5,bx+length/2+.5])box('stone',[x,-1,bz],[2.3,5.5,6]);
  pathSlabs(48,16.5,9,6,1.8,Math.PI/2);

  // Real scanned rock surfaces dress each island edge; no bare backdrop planes.
  const rocks=[];
  function rockAt(p,s,ry=0){const r=asset(rock,'GardenBoulder',p,s,ry);rocks.push(r);return r;}
  for(let i=0;i<45;i++){
    const side=i%2===0?-1:1,z=-30+Math.floor(i/2)*3.4,x=side*(28+random()*12);
    if(side===1&&z>7&&z<22)continue;
    rockAt([x,groundY(x,z)-.4,z],[2.1+random()*2,2+random()*2,2.2+random()*2],random()*6.28);
  }
  for(let i=0;i<28;i++){const z=25+random()*28,side=i%2?-1:1,x=side*(12+random()*10);rockAt([x,groundY(x,z)-.65,z],[.6+random()*.65,.6+random()*.9,.6+random()*.65],random()*6.28);}
  const cliffConfig=[[-42,-25,-24,.70],[-48,-22,-9,.85],[-43,-23,11,.9],[-30,-23,26,.8],[-21,-22,36,.9],[22,-22,31,.82],[30,-23,24,.88],[31,-24,2,.72],[37,-23,-7,.85],[48,-26,-23,1.05]];
  for(const[x,y,z,s]of cliffConfig)asset(cliff,'NearCliff',[x,groundY(x,z)-28*s+.6,z],[s,s,s],random()*6.28);
  for(let i=0;i<23;i++){
    const x=-160+i*15+random()*9,z=-100-random()*150,s=.85+random()*1.35;
    const mountain=asset([peak,peakB,peakC][i%3],'DistantPeak',[x,-10-random()*20,z],[s,s,s],random()*6.28);
    mountain.traverse(n=>{if(n.isMesh){n.castShadow=false;}});
  }
  // A receding terrace on the far bank frames the bridge.
  poly([[46,1,-30],[74,1,-40],[82,1,2],[63,1,22],[48,1,23]],mat.soil,'FarRiverBank');
  for(let i=0;i<8;i++)asset(cliff,'FarBankCliff',[51+random()*6,-24,-31+i*8],[.75,.95,.75],random()*6.28);

  const pinePlaces=[[-30,2,22,1.12,-.5],[-42,4,1,1,-1.1],[-27,2,-8,.75,.2],[-49,3,-24,1.2,1.8],[31,1,30,.85,1.5],[45,4,-8,.95,-1.2],[24,3,-30,.8,1],[-19,3,-37,.85,.6],[54,2,24,1.1,-1.9],[58,2,-27,.95,.4]];
  pinePlaces.forEach(([x,y,z,s,r],i)=>asset(i%2?pineBent:pine,'SculptedPine',[x,x>46?y:groundY(x,z),z],[s,s,s],r));
  // Understory ties rock bases into grass, preserving the paved walkable area.
  for(let i=0;i<210;i++){
    const side=i%2?-1:1,z=-32+random()*85,x=side*((z>25?12:23)+random()*(z>25?12:18));if(side===1&&z>9&&z<20)continue;
    asset(shrub,'LowShrub',[x,groundY(x,z),z],[1+random()*1.5,1+random()*.65,1+random()*1.2],random()*6.28);
  }
  const leaf=new THREE.BufferGeometry();leaf.setAttribute('position',new THREE.Float32BufferAttribute([-.06,0,0,.06,0,0,.025,.40,.06,0,.55,.08],3));leaf.setIndex([0,1,2,0,2,3]);leaf.computeVertexNormals();
  for(let i=0;i<4300;i++){
    const x=(random()-.5)*99,z=-43+random()*84;
    if(Math.abs(x)<22.3&&z>-13&&z<25)continue;
    if(Math.abs(x)<9&&z>22)continue;
    if(x>27&&x<49&&z>7&&z<22)continue;
    if(Math.abs(x)>46||z>33)continue;
    const y=groundY(x,z)+random()*.04;put(i%4?'grass':'grasslight',leaf,i%4?mat.grass:mat.grassLight,[x,y,z],[.7+random(),.35+random()*.6,.8],[0,random()*6.28,0]);
  }
  // Fine pale blossoms concentrated at the foreground garden edge.
  const blossom=new THREE.PlaneGeometry(.12,.12);
  for(let i=0;i<280;i++){const side=i%2?-1:1,x=side*(25+random()*9),z=20+random()*15;put('blossom',blossom,mat.flower,[x,groundY(x,z)+.2+random()*.7,z],[1,1,1],[random()*1.5,random()*6.28,0]);}

  // A shaded river channel with moving surface normals and pale foam at rocks.
  const waterGeo=new THREE.PlaneGeometry(24,180,32,120);waterGeo.rotateX(-Math.PI/2);
  const waterNormal=stoneNormal.clone();waterNormal.repeat.set(8,24);const waterMat=new THREE.MeshPhysicalMaterial({color:0x437e80,roughness:.24,metalness:.08,transparent:true,opacity:.92,normalMap:waterNormal,normalScale:new THREE.Vector2(.42,.42),clearcoat:.55,clearcoatRoughness:.25});
  const water=new THREE.Mesh(waterGeo,waterMat);water.position.set(40,-7,10);group.add(water);water.receiveShadow=true;
  const foamMat=new THREE.MeshBasicMaterial({color:0xc6dad6,transparent:true,opacity:.58,depthWrite:false,side:THREE.DoubleSide});
  for(let i=0;i<110;i++){const z=-65+random()*160,x=31+random()*19;const geo=new THREE.PlaneGeometry(.04+random()*.06,.6+random()*2.4);const mesh=new THREE.Mesh(geo,foamMat);mesh.rotation.x=-Math.PI/2;mesh.rotation.z=random()*.3;mesh.position.set(x,-6.94,z);group.add(mesh);}
  // The same tree and rock meshes share one draw submission per material.
  group.updateMatrixWorld(true);
  const staticBatches=new Map(),batchedRoots=group.children.filter(n=>['LowShrub','GardenBoulder','NearCliff','FarBankCliff','DistantPeak','SculptedPine'].includes(n.name));
  for(const root of batchedRoots)root.traverse(n=>{if(!n.isMesh)return;const key=n.geometry.uuid+'/'+n.material.uuid+'/'+n.castShadow;let batch=staticBatches.get(key);if(!batch){batch={geometry:n.geometry,material:n.material,cast:n.castShadow,matrices:[]};staticBatches.set(key,batch);}batch.matrices.push(n.matrixWorld.clone());});
  for(const root of batchedRoots)group.remove(root);
  for(const {geometry,material,cast,matrices}of staticBatches.values()){const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.castShadow=cast;mesh.receiveShadow=true;group.add(mesh);}
  // Finalize repeated geometry into GPU batches.
  for(const [name,{geo,mt,items}]of batches){const mesh=new THREE.InstancedMesh(geo,mt,items.length);mesh.name=name;items.forEach(([matrix,color],i)=>{mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,color);});mesh.castShadow=mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;group.add(mesh);}
  return {group,mainHall,update(t){water.material.normalMap.offset.set(t*.006,t*.014);},landmarks:{mainRidge:[0,23,-28],stairFoot:[0,2,-12],seal:[-.5,2.06,6],courtFront:[0,2,24],westPavilion:[-36,16,-16],eastPavilion:[37,16,-17],bridge:[33.5,3.85,16.5]}};
}
