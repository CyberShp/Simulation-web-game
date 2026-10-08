/**
 * SR-XF-004/007: read-only, metre-aligned cutaway interiors.
 * Furniture and seats come exclusively from the spatial prefab. This module
 * neither creates occupants nor changes work, inventory, reservations or time.
 * Draw floor before actors, furniture in the depth pass, then the low front wall.
 */
import {spatialPrefab,spatialTransform} from './ea-sr-spatial.mjs?v=ea-160-courtyard-20261008-r18';

const TAU=Math.PI*2;
const box=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const palette={stone:'#a6a99a',stoneLight:'#d4d0b9',stoneSide:'#777e6e',wood:'#a48150',woodLight:'#d3b782',woodDark:'#614b36',ink:'#494e3e',paper:'#eee1ba',wall:'#d9d0ac',jade:'#759681'};

function points(ctx,ps,close=true){ctx.beginPath();ps.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if(close)ctx.closePath();}
function polygon(ctx,ps,fill,stroke,width=.6){points(ctx,ps);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
function line(ctx,ps,color,width=1){points(ctx,ps,false);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();}
function extent(poly){const x=poly.map(p=>p[0]),y=poly.map(p=>p[1]);return {x:Math.min(...x),y:Math.min(...y),w:Math.max(...x)-Math.min(...x),h:Math.max(...y)-Math.min(...y)};}
function paintGradient(ctx,a,b,stops,fallback){if(!ctx.createLinearGradient)return fallback;const g=ctx.createLinearGradient(a.x,a.y,b.x,b.y);if(!g?.addColorStop)return fallback;for(const [n,color]of stops)g.addColorStop(n,color);return g;}

/** A visible flame requires both a live order and its actual executing body. */
export function estateFurnaceActive(s,b){
 if(b.enabled===false||b.condition<=0||b.spatialLock)return false;
 const bid=b.instanceId||`building:yunxiu:${b.id}`;
 const activities=Object.values(s.activitiesById||{});
 const working=a=>a&&['executing','working'].includes(a.phase);
 for(const o of Object.values(s.workOrdersById||{})){
  if(o.targetId!==bid||o.phase!=='active')continue;
  if(o.kind==='sr-crafting'&&working(s.activitiesById?.[o.activityId]))return true;
  if(o.kind==='production'&&activities.some(a=>a.targetId===bid&&a.action==='work'&&working(a)))return true;
 }
 for(const o of Object.values(s.srCultivation?.orders||{})){
  if(o.workstationId!==bid||!['pill-craft','foundation-source'].includes(o.kind)||o.phase!=='executing')continue;
  const p=s.personsById?.[o.personId],a=s.activitiesById?.[p?.activityId];
  if(a?.kind==='sr-cultivation'&&a.orderId===o.id&&working(a)&&p.wound<=0&&p.energy>0)return true;
 }
 // Before SR economy migration, the unique alchemy building owns this queue.
 return !s.srEconomy&&b.type==='alchemy'&&!!s.crafting&&s.crafting.remaining>0;
}

function tools(ctx,c,project,t){
 const k=Math.max(.01,Number(c.scale)||32);
 const p=(x,y,z=0)=>{const q=project({x:t.x+x,y:t.y+y},c);return {x:q.x,y:q.y-z*k};};
 const plane=(poly,z,fill,stroke,width=.6)=>polygon(ctx,poly.map(([x,y])=>p(x,y,z)),fill,stroke,width);
 const stroke=(poly,z,color,width=.025)=>line(ctx,poly.map(([x,y])=>p(x,y,z)),color,Math.max(.45,width*k));
 const wall=(a,b,z1,z2,fill,edge)=>polygon(ctx,[p(...a,z1),p(...b,z1),p(...b,z2),p(...a,z2)],fill,edge,Math.max(.5,.02*k));
 const prism=(poly,z0,z1,{top=palette.woodLight,left=palette.wood,right=palette.woodDark,edge='#5d5544'}={})=>{
  // Ground projection determines face order, including the 45-degree camera.
  const sides=poly.map((a,i)=>({a,b:poly[(i+1)%poly.length],depth:(p(...a).y+p(...poly[(i+1)%poly.length]).y)/2})).sort((a,b)=>a.depth-b.depth);
  sides.forEach((v,i)=>wall(v.a,v.b,z0,z1,i%2?right:left,edge));plane(poly,z1,top,edge,Math.max(.45,.018*k));
 };
 const ellipse=(x,y,rx,ry,z,fill,edge)=>{
  // A projected world-plane ellipse, not a screen-space circle with a guessed tilt.
  const poly=Array.from({length:28},(_,i)=>[x+Math.cos(i/28*TAU)*rx,y+Math.sin(i/28*TAU)*ry]);
  plane(poly,z,fill,edge,Math.max(.45,.018*k));
 };
 return {k,p,plane,stroke,wall,prism,ellipse};
}

function floor(ctx,b,d,s,g){
 const {plane,stroke,prism,ellipse,k}=g,w=d.width,h=d.height;
 const stone=['alchemy','kitchen','workshop','clinic'].includes(b.type);
 prism(d.floor||box(0,0,w,h),-.12,0,{top:stone?'#b1b29a':'#ad8f61',left:'#8d8d75',right:'#626e5d',edge:'#767963'});
 ctx.save();points(ctx,(d.floor||box(0,0,w,h)).map(([x,y])=>g.p(x,y)));ctx.clip();
 if(stone){
  for(let row=0,y=.13;y<h-.1;row++,y+=.65){
   for(let col=-1,x=-.9+(row%2)*.53;x<w;col++,x+=1.05){
    const n=((row*7+col*3)%5+5)%5;
    plane(box(x+.025,y,1,.6),.002,['#babba5','#c6c5ac','#b1b39d','#c1c0a7','#afb09a'][n],'#8d927b66',Math.max(.4,.02*k));
    stroke([[x+.07,y+.05],[x+.94,y+.05]],.003,'#e7dfbd70',.016);
   }
  }
 }else{
  for(let row=0,y=.12;y<h-.1;row++,y+=.34){
   plane(box(.1,y,w-.2,.315),.002,['#b49767','#ba9b6b','#b1915f','#c1a473'][row%4],null);
   stroke([[.1,y+.325],[w-.1,y+.325]],.003,'#7a633e75',.018);
   const start=.6+(row%3)*.73;
   for(let x=start;x<w-.15;x+=2.3){stroke([[x,y+.025],[x,y+.29]],.003,'#7b634660',.015);}
   if(k>16)for(let x=.25;x<w-.2;x+=1.45)stroke([[x,y+.12],[Math.min(w-.15,x+.58),y+.14]],.004,'#e0c08a60',.012);
  }
 }
 ctx.restore();
 // Shallow floor edging and existing seats do not add navigation obstacles.
 for(const edge of [box(.08,.08,w-.16,.13),box(.08,h-.21,w-.16,.13),box(.08,.1,.13,h-.2),box(w-.21,.1,.13,h-.2)])plane(edge,.008,stone?'#d5cfaf':'#72593d','#70644b',.4);
 for(const slot of d.slots||[]){
  if(!['cultivate','teach'].includes(slot.kind))continue;
  const {x,y}=slot.position;
  ellipse(x,y,.31,.28,.012,slot.kind==='teach'?'#af8960':'#b5a875','#78694c');
  for(const r of [.24,.18,.1])ellipse(x,y,r,r*.9,.014,null,'#d7c29188');
 }
 const door=d.door||{x:w/2,y:h};
 plane(box(door.x-.66,door.y-.3,1.32,.34),.012,'#b9ab84','#746d54',Math.max(.5,.018*k));
 stroke([[door.x-.6,door.y-.21],[door.x+.6,door.y-.21]],.018,'#e8d6a6',.027);
}

function backWalls(ctx,b,d,g){
 const {wall,prism,stroke}=g,w=d.width,h=d.height;
 // Both far walls use the actual collision strips. Their inside faces carry
 // shallow lattice and plaster detail; no extra cabinets block a real route.
 const back=(d.walls||[]).slice(0,2),wallHeight=1.7;
 for(const polygon of back)prism(polygon,0,wallHeight,{top:'#ae966d',left:'#c6bd99',right:'#dbceaa',edge:'#78664d'});
 const timber=[.18,w*.33,w*.67,w-.18];
 for(const x of timber)prism(box(x-.055,.02,.11,.18),0,1.83,{top:'#b49561',left:'#8e7049',right:'#725638',edge:'#6b543a'});
 wall([.18,.187],[w-.18,.187],.13,.26,'#998158','#725e42');
 wall([.18,.187],[w-.18,.187],1.49,1.62,'#967449','#715337');
 // Thin mounted windows stay on the north wall, behind all registered beds.
 for(let i=0;i<2;i++){
  const x=w*(i?.73:.27),half=Math.min(.51,w*.09);
  wall([x-half,.192],[x+half,.192],.73,1.37,'#52796e','#6c5c3e');
  for(let j=1;j<5;j++){const xx=x-half+j*(half*2/5);wall([xx-.012,.203],[xx+.012,.203],.75,1.35,'#d1b887',null);}
  for(const z of [.84,1.01,1.2])wall([x-half,.21],[x+half,.21],z,z+.028,'#c9ad78',null);
  wall([x-half-.05,.215],[x+half+.05,.215],.69,.76,'#ab8b55','#745a38');
 }
 // A modest wall hanging is surface art, not invented floor furniture.
 if(['hall','library','clinic'].includes(b.type)){
  const x=w/2;
  wall([x-.25,.195],[x+.25,.195],.49,1.3,'#e5d6ad','#ab8f63');
  wall([x-.28,.207],[x+.28,.207],1.28,1.32,'#756144',null);
  wall([x-.28,.207],[x+.28,.207],.48,.52,'#756144',null);
  stroke([[x-.1,.219],[x+.04,.219]],.96,'#718871',.055);
  stroke([[x-.04,.219],[x+.12,.219]],.83,'#83917a',.05);
 }
 // West wall is cut back toward the viewer; its final section stays low.
 const wx=.19,span=Math.max(.7,h-.5);
 for(let y=.65;y<span;y+=1.22)wall([wx,y],[wx,y+.48],.7,1.18,'#809782','#8e855f');
}

function bed(ctx,b,f,g,index){
 const r=extent(f.polygon),{x,y,w,h}=r,{prism,plane,stroke}=g;
 // Exact registered bed footprint: frames and bedding remain within it.
 prism(f.polygon,.14,.37,{top:'#ba955e',left:'#8a653d',right:'#63482e',edge:'#634a33'});
 for(const xx of [x+.045,x+w-.095])for(const yy of [y+.045,y+h-.105])prism(box(xx,yy,.055,.065),0,.2,{top:'#8b683d',left:'#6a4c2e',right:'#4f3c2b',edge:null});
 prism(box(x+.018,y+.018,w-.036,.07),.25,.66,{top:'#c1a475',left:'#917146',right:'#705232',edge:'#735737'});
 plane(box(x+.045,y+.1,w-.09,h-.15),.382,'#ded2ad','#9a8257',.45);
 const cloth=b.type==='clinic'?'#b5c3ae':['#67877c','#849477','#9d8970','#738b94'][index%4];
 prism(box(x+.047,y+h*.38,w-.094,h*.55),.385,.43,{top:cloth,left:'#7a8b75',right:'#536f64',edge:'#607565'});
 stroke([[x+.06,y+h*.46],[x+w-.06,y+h*.46]],.437,'#d7c99e',.027);
 stroke([[x+w*.53,y+h*.44],[x+w*.48,y+h*.87]],.441,'#d1c69865',.018);
 prism(box(x+.1,y+.14,w-.2,.16),.39,.45,{top:'#f0e4bd',left:'#d5c69c',right:'#b4a785',edge:'#b5a27f'});
}

function desk(ctx,b,f,g,index){
 const r=extent(f.polygon),{x,y,w,h}=r,{prism,plane,stroke}=g;
 for(const xx of [x+.055,x+w-.105])for(const yy of [y+.04,y+h-.09])prism(box(xx,yy,.06,.05),0,.67,{top:'#a88550',left:'#785636',right:'#58422e',edge:null});
 prism(f.polygon,.64,.74,{top:'#c2a06b',left:'#9f7a45',right:'#775434',edge:'#6b5034'});
 stroke([[x+.02,y+.04],[x+w-.02,y+.04]],.748,'#e2c38a',.02);
 if(f.kind==='desk'||b.type==='library'){
  // Two paper leaves resting on the true desk, with spine and ink strokes.
  const bw=w*.62,bx=x+w*.16,by=y+h*.22;
  plane(box(bx,by,bw,h*.57),.755,'#ede0b9','#a58f62',.4);
  stroke([[bx+bw/2,by],[bx+bw/2,by+h*.57]],.76,'#bba479',.013);
  for(let j=0;j<3;j++){const yy=by+.025+j*h*.13;stroke([[bx+.025,yy],[bx+bw*.4,yy]],.762,'#757b607a',.012);stroke([[bx+bw*.57,yy],[bx+bw*.91,yy]],.762,'#757b607a',.012);}
 }else{
  // Tools rest on a collision-backed bench; their size never implies a new slot.
  plane(box(x+w*.17,y+h*.18,w*.45,h*.48),.753,b.type==='workshop'?'#788a81':'#a7b898','#697361',.4);
  stroke([[x+w*.65,y+h*.18],[x+w*.7,y+h*.82]],.78,'#634a33',.045);
  plane(box(x+w*.55,y+h*.22,w*.25,h*.2),.8,'#8b978b','#59685c',.45);
 }
}

function furnace(ctx,b,f,s,g){
 const {x,y,w,h}=extent(f.polygon),cx=x+w/2,cy=y+h/2,{ellipse,prism,plane,wall,k,p}=g;
 if(f.kind==='stove'){
  prism(f.polygon,0,.72,{top:'#b5b49e',left:'#929983',right:'#737e6e',edge:'#69725f'});
  ellipse(cx,cy,w*.28,h*.32,.738,'#464f40','#c5bb96');
  ellipse(cx,cy,w*.25,h*.28,.77,'#7a8373','#4d5d4e');
  return;
 }
 const active=estateFurnaceActive(s,b),rx=w*.38,ry=h*.36;
 // Tripod legs and bronze belly are contained by the registered furnace.
 for(const angle of [.35,2.4,4.5]){
  const lx=cx+Math.cos(angle)*rx*.72,ly=cy+Math.sin(angle)*ry*.8;
  prism(box(lx-.055,ly-.055,.11,.11),0,.44,{top:'#a08d58',left:'#6d7756',right:'#535e45',edge:'#4e5841'});
 }
 const belly=Array.from({length:28},(_,i)=>[cx+Math.cos(i/28*TAU)*rx,cy+Math.sin(i/28*TAU)*ry]);
 const q=p(cx,cy),fill=paintGradient(ctx,{x:q.x-rx*k,y:q.y-k},{x:q.x+rx*k,y:q.y},[[0,'#a49966'],[.4,'#6f8267'],[1,'#3f594a']],'#778265');
 prism(belly,.34,1.06,{top:'#a69b67',left:fill,right:fill,edge:'#4c624a'});
 ellipse(cx,cy,rx*.94,ry*.92,1.07,'#827f54','#ccbb83');
 ellipse(cx,cy,rx*.68,ry*.67,1.11,'#414f3d','#b5a474');
 ellipse(cx,cy,rx*.74,ry*.7,1.14,'#a29661','#60734f');
 const cap=Array.from({length:28},(_,i)=>[cx+Math.cos(i/28*TAU)*rx*.28,cy+Math.sin(i/28*TAU)*ry*.27]);
 prism(cap,1.14,1.32,{top:'#c1ae74',left:'#9c9762',right:'#6a7c57',edge:'#687d53'});
 for(const side of [-1,1]){
  const at=p(cx+side*rx*.95,cy,.91);ctx.beginPath();ctx.ellipse(at.x,at.y,Math.max(1,.09*k),Math.max(1,.14*k),-.25*side,0,TAU);ctx.strokeStyle='#b9aa73';ctx.lineWidth=Math.max(.7,.045*k);ctx.stroke();
 }
 // Door and ember are on the near side. An idle furnace has a dark, cold mouth.
 wall([cx-.2,cy+ry*.87],[cx+.2,cy+ry*.87],.41,.66,active?'#d78d43':'#344636','#5a6245');
 if(active){
  const at=p(cx,cy+ry*.9,.53),tick=Number(s.worldTick)||0,breath=.8+Math.sin(tick*.17)*.12;
  ctx.save();ctx.fillStyle='#f6d68c';ctx.beginPath();ctx.ellipse(at.x,at.y,Math.max(.5,.09*k),Math.max(.5,.12*k*breath),0,0,TAU);ctx.fill();ctx.restore();
 }
}

function resolved(b,{prefab=spatialPrefab,transform=spatialTransform}={}){
 return {d:typeof prefab==='function'?prefab(b):prefab,t:typeof transform==='function'?transform(b):transform};
}
function frontParts(d){
 const h=d.height,door=d.door||{x:d.width/2,y:h};
 return [
  ...(d.walls||[]).slice(2).map((polygon,i)=>({id:`front:wall:${i+2}`,polygon,type:'wall',height:.23})),
  ...[door.x-.77,door.x+.7].map((x,i)=>({id:`front:jamb:${i}`,polygon:box(x,h-.18,.07,.18),type:'jamb',height:.47})),
  {id:'front:threshold',polygon:box(door.x-.68,h-.16,1.36,.16),type:'threshold',height:.027}
 ];
}
function frontPart(part,g){
 if(part.type==='threshold')g.plane(part.polygon,part.height,'#c3b48c','#8a7b57',.55);
 else g.prism(part.polygon,0,part.height,part.type==='jamb'?{top:'#c0a16b',left:'#947143',right:'#705331',edge:'#77603e'}:{top:'#c2b28b',left:'#998866',right:'#867757',edge:'#857353'});
}
function frontWalls(ctx,b,d,g){for(const part of frontParts(d))frontPart(part,g);}
function furnitureItem(ctx,b,f,s,g,index){
 if(f.kind==='bed')bed(ctx,b,f,g,index);
 else if(['desk','bench'].includes(f.kind))desk(ctx,b,f,g,index);
 else if(['furnace','stove'].includes(f.kind))furnace(ctx,b,f,s,g);
 else g.prism(f.polygon,0,.55);
}

/** Stable local IDs and ground-depth anchors for mixing furniture with actors.
 * With the fixed 45-degree camera, x+y is the camera depth. Use the polygon's
 * near corner rather than a made-up roof position. Actors beyond its front edge
 * then paint after the furniture, and actors behind it paint before it.
 */
export function estateInteriorLayers(b,options={}){
 const {d,t}=resolved(b,options);if(!d?.indoor||!t)return [];
 const layer=(id,kind,polygon)=>{
  const near=polygon.reduce((a,p)=>p[0]+p[1]>a[0]+a[1]?p:a,polygon[0]);
  const r=extent(polygon);
  return {id,kind,position:{x:t.x+near[0],y:t.y+near[1]},center:{x:t.x+r.x+r.w/2,y:t.y+r.y+r.h/2}};
 };
 return [...(d.furniture||[]).map(f=>layer(`furniture:${f.id}`,'furniture',f.polygon)),...frontParts(d).map(f=>layer(f.id,'front',f.polygon))];
}

/** The rest slot is an interaction standing/arrival point, NOT the sleeping
 * body's visual centre. A renderer may anchor the lying pose on this bed surface
 * without changing the actor's identity, collision foot, activity or saved path.
 * World axis is head -> foot; project head and foot to derive the screen angle.
 */
export function estateBedPose(b,slotId,options={}){
 const {d,t}=resolved(b,options);if(!d?.indoor||!t||typeof slotId!=='string')return null;
 const suffix=slotId.includes('/slot:')?slotId.split('/slot:').at(-1):slotId;
 const slot=(d.slots||[]).find(v=>v.kind==='rest'&&v.suffix===suffix);
 const f=slot&&(d.furniture||[]).find(v=>v.kind==='bed'&&v.id===slot.suffix);
 if(!f)return null;const r=extent(f.polygon),x=t.x+r.x+r.w/2,y=t.y+r.y;
 return {buildingId:b.instanceId||`building:yunxiu:${b.id}`,furnitureId:f.id,position:{x,y:y+r.h/2},axis:{x:0,y:1},head:{x,y:y+.1*r.h},foot:{x,y:y+.9*r.h},elevation:.44,length:r.h,width:r.w,depthPosition:{x:t.x+r.x+r.w,y:t.y+r.y+r.h}};
}

/**
 * project receives world coordinates. prefab/transform accept either already
 * resolved objects or the authoritative resolver functions used by the caller.
 * No Date/performance/random clock is used: any active ember uses worldTick.
 */
export function drawEstateInterior(ctx,b,s,c,{project,prefab=spatialPrefab,transform=spatialTransform,phase='floor',itemId=null}={}){
 const {d,t}=resolved(b,{prefab,transform});
 if(!d?.indoor||!t||typeof project!=='function')return false;
 const g=tools(ctx,c,project,t);ctx.save();ctx.lineJoin='round';
 if(phase==='floor'){floor(ctx,b,d,s,g);backWalls(ctx,b,d,g);}
 else if(phase==='furniture-back')backWalls(ctx,b,d,g);
 else if(phase==='furniture'){
  const furniture=[...(d.furniture||[])].sort((a,b)=>{const x=extent(a.polygon),y=extent(b.polygon);return g.p(x.x+x.w/2,x.y+x.h).y-g.p(y.x+y.w/2,y.y+y.h).y;});
  furniture.forEach(f=>furnitureItem(ctx,b,f,s,g,d.furniture.indexOf(f)));
 }else if(phase==='front')frontWalls(ctx,b,d,g);
 else if(phase==='item'){
  const f=(d.furniture||[]).find(f=>`furniture:${f.id}`===itemId);
  if(f)furnitureItem(ctx,b,f,s,g,d.furniture.indexOf(f));
  else {const part=frontParts(d).find(f=>f.id===itemId);if(part)frontPart(part,g);else{ctx.restore();return false;}}
 }
 ctx.restore();return true;
}
