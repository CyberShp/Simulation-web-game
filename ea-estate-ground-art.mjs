/**
 * SR-XF-003/004/009: layered estate ground, read-only presentation.
 * Every mark is projected from metres. Tall scenery is confined to existing
 * blocked terrain or outside the playable boundary. U-98 keeps the construction
 * grid visible and postpones paving; this module never finds paths or advances time.
 */
import {SPATIAL_TERRAIN,SPATIAL_SCENE} from './ea-sr-spatial.mjs?v=ea-160-yunxiu-2d-20261007-r1';
import {BUILDING_GRID} from './ea-building-grid.mjs?v=ea-160-yunxiu-2d-20261007-r1';

const TAU=Math.PI*2;
const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
const hash=(x,y=0,salt=0)=>{
  let n=Math.imul(Math.round(x*1009)^Math.imul(Math.round(y*1013),374761393),668265263)^salt;
  n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;
};
const point=p=>Array.isArray(p)?{x:p[0],y:p[1]}:p;
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const groundCache=new WeakMap();
const geometrySignatures=new WeakMap();

function signature(list){
  if(!Array.isArray(list))return '';
  let result=geometrySignatures.get(list);
  if(result===undefined){result=JSON.stringify(list);geometrySignatures.set(list,result);}
  return result;
}
function trace(ctx,polygon,c,project,close=true){
  polygon.forEach((v,i)=>{const p=project(point(v),c);if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});
  if(close)ctx.closePath();
}
function poly(ctx,polygon,c,project,fill,stroke=null,width=.7){
  ctx.beginPath();trace(ctx,polygon,c,project);
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}
function contains(p,polygon){
  let hit=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=point(polygon[i]),b=point(polygon[j]);
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;
  }
  return hit;
}
function occupied(p,footprints,padding=0){
  return footprints.some(polygon=>contains(p,polygon)||padding>0&&[
    {x:p.x-padding,y:p.y-padding},{x:p.x+padding,y:p.y-padding},
    {x:p.x-padding,y:p.y+padding},{x:p.x+padding,y:p.y+padding},
  ].some(q=>contains(q,polygon)));
}
function visible(p,c,margin=40){return p.x>=-margin&&p.x<=c.w+margin&&p.y>=-margin&&p.y<=c.h+margin;}
function ellipse(ctx,p,rx,ry,fill,c,project){
  const q=project(p,c);if(!visible(q,c,Math.max(rx,ry)*c.scale+12))return;
  ctx.beginPath();ctx.ellipse(q.x,q.y,Math.max(.2,rx*c.scale),Math.max(.2,ry*c.scale*c.depth),0,0,TAU);ctx.fillStyle=fill;ctx.fill();
}
function gradient(ctx,from,to,stops,fallback){
  if(typeof ctx.createLinearGradient!=='function')return fallback;
  const g=ctx.createLinearGradient(from.x,from.y,to.x,to.y);
  for(const [at,color] of stops)g.addColorStop(at,color);return g;
}
function clipGround(ctx,c,project,footprints){
  // Reverse the holes as well as using evenodd, so old canvas implementations
  // with a nonzero fallback retain the intended interior exclusion.
  ctx.beginPath();trace(ctx,rect(0,0,SPATIAL_SCENE.width,SPATIAL_SCENE.height),c,project);
  for(const fp of footprints)trace(ctx,[...fp].reverse(),c,project);
  ctx.clip('evenodd');
}

function drawGrass(ctx,c,project){
  // Soft color masses are drawn first. Hard-edged repeating ovals make grass
  // look like wallpaper, so broad terrain variation always has a faded edge.
  for(let i=0;i<120;i++){
    const x=hash(i,7)*SPATIAL_SCENE.width,y=hash(i,31)*SPATIAL_SCENE.height,q=project({x,y},c),r=(1.5+hash(i,1)*3.3)*c.scale;
    if(!visible(q,c,r))continue;
    ctx.save();ctx.translate(q.x,q.y);ctx.scale(1,c.depth);
    if(typeof ctx.createRadialGradient==='function'){
      const g=ctx.createRadialGradient(0,0,0,0,0,r);g.addColorStop(0,i%3?'#d8d3a527':'#36573b20');g.addColorStop(1,i%3?'#d8d3a500':'#36573b00');ctx.fillStyle=g;
    }else ctx.fillStyle=i%3?'#d8d3a509':'#36573b07';
    ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();ctx.restore();
  }
  // Very low, nonblocking turf. Nothing here resembles a selectable shrub or
  // pretends to be a finite harvest source.
  for(let y=.35;y<SPATIAL_SCENE.height;y+=.86)for(let x=.35;x<SPATIAL_SCENE.width;x+=.86){
    const n=hash(x,y,411),p={x:x+(n-.5)*.68,y:y+(hash(x,y,4)-.5)*.66},q=project(p,c);
    if(!visible(q,c,24))continue;
    // Tiny broken fibres, pebbles and leaf litter provide a surface rather
    // than another layer of raised plants or false collision objects.
    for(let fleck=0;fleck<4;fleck++){
      const f=hash(x+fleck,y,814),at=project({x:p.x+(f-.5)*.7,y:p.y+(hash(fleck+x,y,61)-.5)*.65},c);
      ctx.strokeStyle=f>.52?'#e0dbb538':'#667b5440';ctx.lineWidth=Math.max(.4,.013*c.scale);
      ctx.beginPath();ctx.moveTo(at.x,at.y);ctx.lineTo(at.x+(.025+f*.05)*c.scale,at.y-.008*c.scale);ctx.stroke();
    }
    if(n>.64){
      ctx.strokeStyle=n>.89?'#e7dfb551':'#57764b45';ctx.lineWidth=Math.max(.5,.016*c.scale);
      for(let i=0;i<3;i++){
        const shift=(i-1)*.055*c.scale;
        ctx.beginPath();ctx.moveTo(q.x+shift,q.y);ctx.quadraticCurveTo(q.x+shift+(i-1)*.024*c.scale,q.y-.06*c.scale,q.x+shift+(i-1)*.058*c.scale,q.y-(.085+n*.06)*c.scale);ctx.stroke();
      }
    }
    if(n<.045){
      ctx.fillStyle='#eee5bc8c';ctx.beginPath();ctx.ellipse(q.x,q.y,.028*c.scale,.021*c.scale,0,0,TAU);ctx.fill();
    }
  }
}

function rock(ctx,p,size,c,project,seed=0){
  const q=project(p,c);if(!visible(q,c,size*c.scale+20))return;
  const k=size*c.scale;
  ctx.save();ctx.translate(q.x,q.y);
  ctx.fillStyle='#334c3e27';ctx.beginPath();ctx.ellipse(k*.1,k*.12,k*.65,k*.23,0,0,TAU);ctx.fill();
  const points=[[-.6,.06],[-.47,-.3],[-.12,-.49],[.35,-.41],[.61,-.06],[.38,.19],[-.22,.22]];
  ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x*k,y*k):ctx.moveTo(x*k,y*k));ctx.closePath();
  ctx.fillStyle=seed%3?'#8d9380':'#a9ac97';ctx.fill();ctx.strokeStyle='#626f5a88';ctx.lineWidth=Math.max(.45,.018*c.scale);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-.47*k,-.3*k);ctx.lineTo(-.12*k,-.49*k);ctx.lineTo(.35*k,-.41*k);ctx.lineTo(.08*k,-.14*k);ctx.closePath();ctx.fillStyle='#e4dbc071';ctx.fill();
  ctx.beginPath();ctx.moveTo(.08*k,-.14*k);ctx.lineTo(.61*k,-.06*k);ctx.lineTo(.38*k,.19*k);ctx.lineTo(-.08*k,.1*k);ctx.closePath();ctx.fillStyle='#53695338';ctx.fill();
  ctx.restore();
}

function bamboo(ctx,p,height,c,project,seed){
  const q=project(p,c);if(!visible(q,c,height*c.scale+20))return;
  const k=c.scale;
  ctx.save();ctx.translate(q.x,q.y);
  ctx.strokeStyle='#465b3fb5';ctx.lineCap='round';ctx.lineWidth=.046*k;
  for(let stem=0;stem<4;stem++){
    const x=(stem-1.5)*.13*k,lean=(hash(seed,stem)-.5)*.36*k,h=height*(.65+hash(stem,seed)*.35)*k;
    ctx.beginPath();ctx.moveTo(x,0);ctx.quadraticCurveTo(x+lean*.4,-h*.45,x+lean,-h);ctx.stroke();
    for(let j=1;j<5;j++){
      const y=-h*j/5,sx=x+lean*j/5;
      ctx.strokeStyle='#b7bc8280';ctx.lineWidth=.02*k;ctx.beginPath();ctx.moveTo(sx-.035*k,y);ctx.lineTo(sx+.035*k,y);ctx.stroke();
      const dir=j%2?1:-1;
      for(let leaf=0;leaf<3;leaf++){
        ctx.fillStyle=leaf%2?'#789457bd':'#496f4acd';ctx.beginPath();ctx.moveTo(sx,y);
        ctx.quadraticCurveTo(sx+dir*(.24+leaf*.09)*k,y-(.09+leaf*.06)*k,sx+dir*(.52+leaf*.08)*k,y+(.14-leaf*.16)*k);
        ctx.quadraticCurveTo(sx+dir*.18*k,y+.055*k,sx,y);ctx.fill();
      }
    }
    ctx.strokeStyle='#465b3fb5';ctx.lineWidth=.046*k;
  }
  ctx.restore();
}
function pine(ctx,p,height,c,project,seed){
  const q=project(p,c),k=c.scale;if(!visible(q,c,height*k+25))return;
  ctx.save();ctx.translate(q.x,q.y);
  ctx.fillStyle='#2447361c';ctx.beginPath();ctx.ellipse(height*k*.14,2,height*k*.53,height*k*.12,0,0,TAU);ctx.fill();
  ctx.strokeStyle='#705f41';ctx.lineWidth=.14*k;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(-.25*k,-height*k*.45,.15*k,-height*k*.86);ctx.stroke();
  for(let tier=0;tier<4;tier++){
    const f=1-tier*.2,y=-height*k*(.42+tier*.17),span=height*k*.35*f,x=(hash(seed,tier)-.5)*span*.5;
    ctx.strokeStyle='#706b47';ctx.lineWidth=.05*k;ctx.beginPath();ctx.moveTo(0,y+.1*k);ctx.lineTo(x-span*.75,y);ctx.moveTo(0,y+.1*k);ctx.lineTo(x+span*.8,y-.09*k);ctx.stroke();
    for(let i=0;i<5;i++){
      const a=(i-2)*span*.33,b=y-Math.sin(i*.8)*span*.18;
      ctx.beginPath();ctx.ellipse(x+a,b,span*(.28+hash(i,seed+tier)*.13),span*.23,0,0,TAU);
      ctx.fillStyle=['#385c43','#426b4b','#54774f','#718756','#66834f'][i];ctx.fill();
      ctx.beginPath();ctx.ellipse(x+a-span*.06,b-span*.09,span*.19,span*.065,-.12,0,TAU);ctx.fillStyle='#aec17d27';ctx.fill();
    }
  }
  ctx.restore();
}

function drawWater(ctx,c,project,terrain){
  ctx.save();ctx.beginPath();trace(ctx,terrain.polygon,c,project);ctx.clip();
  const a=project({x:58,y:8},c),b=project({x:64,y:30},c);
  poly(ctx,terrain.polygon,c,project,gradient(ctx,a,b,[[0,'#a3b6a0'],[.2,'#84a99c'],[.66,'#648f84'],[1,'#507d75']],'#80a398'));
  // Ripples follow the projected surface, not horizontal screen-space stripes.
  for(let y=8.2;y<30;y+=.48)for(let x=58.15;x<64;x+=.85){
    const n=hash(x,y,771);if(n<.42)continue;
    const p=project({x:x+n*.2,y:y+n*.3},c),end=project({x:x+.2+n*.43,y:y+n*.3},c);
    ctx.strokeStyle=n>.88?'#e6e5ca78':'#bfcec13b';ctx.lineWidth=Math.max(.5,.02*c.scale);
    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.quadraticCurveTo((p.x+end.x)/2,(p.y+end.y)/2-.028*c.scale,end.x,end.y);ctx.stroke();
  }
  ctx.restore();
  // All shore stones and reeds stay inside the existing water polygon.
  for(let i=0;i<30;i++){
    const p={x:58.12+hash(i,7)*.35,y:8.3+i*.7};
    rock(ctx,p,.22+hash(i,11)*.29,c,project,i);
    if(i%4===1){const q=project({x:p.x+.15,y:p.y+.16},c);ctx.strokeStyle='#6c86539c';ctx.lineWidth=.027*c.scale;for(let j=0;j<4;j++){ctx.beginPath();ctx.moveTo(q.x+j*.045*c.scale,q.y);ctx.lineTo(q.x+(j-1)*.11*c.scale,q.y-(.23+hash(j,i)*.35)*c.scale);ctx.stroke();}}
  }
}

/** U-98: common land cells, not predetermined building/function slots. */
function drawGroundCells(ctx,c,project){
 const step=BUILDING_GRID.metres,extent=SPATIAL_SCENE.width,height=SPATIAL_SCENE.height;
 const fade=Math.min(1,Math.max(.35,c.scale/32));
 // Cache this tile layer with the terrain. Cull outside the viewport rather
 // than painting all 1,024 construction cells on every camera/geometry rebuild.
 for(let row=0;row<height/step;row++)for(let col=0;col<extent/step;col++){
  const x=col*step,y=row*step,q=project({x:x+step/2,y:y+step/2},c);
  if(!visible(q,c,c.scale*step+3))continue;
  poly(ctx,rect(x,y,step,step),c,project,(row+col)%2?'#e1dea209':'#83904f06');
 }
 ctx.strokeStyle=`rgba(77,96,63,${.35*fade})`;ctx.lineWidth=.9;ctx.beginPath();
 for(let n=0;n<=extent+1e-6;n+=step){
  const a=project({x:n,y:0},c),b=project({x:n,y:extent},c),d=project({x:0,y:n},c),e=project({x:extent,y:n},c);
  ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.moveTo(d.x,d.y);ctx.lineTo(e.x,e.y);
 }ctx.stroke();
}

function drawBoundary(ctx,c,project,nature){
  if(nature?.width){drawPaintedBoundary(ctx,c,project,nature);return;}
  const shrubs=[];
  for(let i=0;i<Math.ceil(Math.max(SPATIAL_SCENE.width,SPATIAL_SCENE.height)/2.6);i++){
    // Tree feet are outside the entire buildable world. The thin north slope
    // gets only low stone and moss rather than a false extra collision belt.
    shrubs.push({x:-1.25-hash(i,3)*1.7,y:1+i*2.6,h:2.1+hash(i,4)*1.6,seed:i});
    shrubs.push({x:1+i*2.6,y:-1.3-hash(i,13)*1.8,h:2.2+hash(i,14)*1.8,seed:i+40});
  }
  shrubs.sort((a,b)=>project(a,c).y-project(b,c).y);
  for(const t of shrubs){if(t.seed%3)bamboo(ctx,t,t.h,c,project,t.seed);else pine(ctx,t,t.h,c,project,t.seed);}
  for(let i=0;i<Math.ceil(SPATIAL_SCENE.width/.84);i++)rock(ctx,{x:.35+i*.84,y:.28+hash(i,11)*.45},.22+hash(i,31)*.32,c,project,i);
}

/** Reuse the approved mountain painting as a distant, noninteractive vista.
 * The traversable plane below still comes exclusively from metre geometry. */
function drawPaintedVista(ctx,c,project,image){
  if(!image?.width)return;
  const size=Math.max(c.w/image.width,c.h/image.height)*1.08;
  const width=image.width*size,height=image.height*size;
  ctx.save();ctx.globalAlpha=.7;
  ctx.drawImage(image,(c.w-width)/2,(c.h-height)/2,width,height);
  ctx.restore();
}

/** Derived from the approved meadow; the tile is ground only, with no baked
 * buildings/roads/resources. Alternate mirroring joins edges without seams. */
function drawPaintedMeadow(ctx,c,project,image){
  if(!image?.width)return false;
  const origin=project({x:0,y:0},c),xAxis=project({x:1,y:0},c),yAxis=project({x:0,y:1},c);
  const step=16;
  for(let row=0,y=0;y<SPATIAL_SCENE.height;y+=step,row++)for(let col=0,x=0;x<SPATIAL_SCENE.width;x+=step,col++){
    const q=project({x:x+step/2,y:y+step/2},c);
    if(!visible(q,c,step*c.scale*1.5))continue;
    ctx.save();ctx.transform(xAxis.x-origin.x,xAxis.y-origin.y,yAxis.x-origin.x,yAxis.y-origin.y,origin.x,origin.y);
    ctx.translate(x+(col%2?step:0),y+(row%2?step:0));ctx.scale(col%2?-1:1,row%2?-1:1);
    ctx.drawImage(image,0,0,step+.015,step+.015);ctx.restore();
  }
  poly(ctx,rect(0,0,SPATIAL_SCENE.width,SPATIAL_SCENE.height),c,project,'#506d5823');
  return true;
}

function natureSprite(ctx,image,rect,x,y,width,{lip=false,reverseLip=false}={}){
  const [sx,sy,sw,sh]=rect,height=width*sh/sw;
  ctx.save();ctx.translate(x-width/2,y-(lip?height*.4:height*.94));
  // The two sloping stone crops exclude the neighbouring tree roots in the
  // original atlas. This clip is part of sprite registration, never geometry.
  if(lip){ctx.beginPath();const high=-.04*height,low=.67*height;
    ctx.moveTo(0,reverseLip?high:low);ctx.lineTo(width,reverseLip?low:high);
    ctx.lineTo(width,height);ctx.lineTo(0,height);ctx.closePath();ctx.clip();}
  ctx.drawImage(image,sx,sy,sw,sh,0,0,width,height);ctx.restore();
}

function drawPaintedBoundary(ctx,c,project,image){
  const width=SPATIAL_SCENE.width,height=SPATIAL_SCENE.height,segment=8;
  // Stone lips sit outside the existing boundary, never on traversable land.
  for(let n=0;n<Math.max(width,height);n+=segment){
    for(const east of [false,true]){
      const p=east?{x:width+.6,y:n+segment/2}:{x:n+segment/2,y:height+.6},q=project(p,c);
      if(!visible(q,c,segment*c.scale))continue;
      natureSprite(ctx,image,east?[32,604,737,400]:[786,608,728,400],q.x,q.y,segment*.83*c.scale,{lip:true,reverseLip:!east});
    }
  }
  const trees=[];
  for(let n=0;n<Math.max(width,height);n+=4){
    trees.push({x:-.25-hash(n,3)*.6,y:n+1.6,seed:n});
    trees.push({x:n+1.5,y:.3-hash(n,9)*.6,seed:n+201});
  }
  trees.sort((a,b)=>project(a,c).y-project(b,c).y);
  for(const p of trees){const q=project(p,c),size=(p.seed%3?5.4:6.9)+hash(p.seed,8)*1.7;
    if(!visible(q,c,size*c.scale))continue;
    natureSprite(ctx,image,p.seed%3?[830,20,685,590]:[32,20,752,584],q.x,q.y,size*c.scale);
  }
}

function paintStaticGround(ctx,c,project,footprints,terrainArt){
  const a=project({x:0,y:0},c),b=project({x:SPATIAL_SCENE.width,y:SPATIAL_SCENE.height},c);
  poly(ctx,rect(0,0,SPATIAL_SCENE.width,SPATIAL_SCENE.height),c,project,gradient(ctx,a,b,[[0,'#a6af87'],[.48,'#a6b08c'],[1,'#8d9e7b']],'#a6af88'));
  ctx.save();clipGround(ctx,c,project,footprints);
  if(!drawPaintedMeadow(ctx,c,project,terrainArt?.meadow))drawGrass(ctx,c,project);
  drawGroundCells(ctx,c,project);
  for(const t of SPATIAL_TERRAIN){
    if(t.kind==='water')drawWater(ctx,c,project,t);
    else if(t.kind==='slope')poly(ctx,t.polygon,c,project,'#617b5355','#65795740',1);
  }
  ctx.restore();
  drawBoundary(ctx,c,project,terrainArt?.nature);
}

function drawResources(ctx,s,c,project,footprints){
  for(const [kind,patch] of Object.entries(s.srEconomy?.patches||{})){
    if(!['wood','stone','herb','food'].includes(kind)||!patch.position||patch.position.sceneId&&patch.position.sceneId!=='scene:yunxiu-courtyard')continue;
    const p=patch.position,ratio=clamp(patch.remaining/(patch.max||1));
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||ratio<=0||occupied(p,footprints,1.1))continue;
    const q=project(p,c);if(!visible(q,c,80))continue;
    ellipse(ctx,p,.9,.58,kind==='stone'?'#87978020':'#6a815d1c',c,project);
    const n=Math.ceil(8*ratio);
    for(let i=0;i<n;i++){
      const at={x:p.x+(hash(i,8)-.5)*1.3,y:p.y+(hash(i,9)-.5)*1.1};
      if(occupied(at,footprints,.3))continue;
      if(kind==='stone')rock(ctx,at,.13+hash(i,2)*.18,c,project,i);
      else if(kind==='wood'){
        // Fallen twigs are walkable and match finite wood availability. Never
        // draw a large standing tree on a navigable resource anchor.
        const a=project(at,c),b=project({x:at.x+.25+hash(i,31)*.3,y:at.y+.16},c);
        ctx.lineCap='round';ctx.strokeStyle='#655c40';ctx.lineWidth=.058*c.scale;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
        ctx.strokeStyle='#b1a16a';ctx.lineWidth=.017*c.scale;ctx.beginPath();ctx.moveTo(a.x,a.y-.023*c.scale);ctx.lineTo(b.x,b.y-.023*c.scale);ctx.stroke();
      }else plant(ctx,at,c,project,{maturity:.48,grain:kind==='food',seed:i});
    }
  }
}

/** Paints the ground before all building floors and depth-sorted actors. */
export function drawEstateGround(ctx,s,c,{project,footprints=[],terrainArt=null,planning=false}={}){
  if(typeof project!=='function')throw new TypeError('drawEstateGround requires the shared world projection');
  const ratio=Math.max(1,Math.min(1.5,Number(globalThis.devicePixelRatio)||1)),margin=192;
  const key=[c.w,c.h,c.scale,c.depth,c.rotation||0,ratio,SPATIAL_SCENE.width,SPATIAL_SCENE.height,terrainArt?.terrain?.width||0,terrainArt?.nature?.width||0,terrainArt?.meadow?.width||0,signature(footprints)].join(';');
  let cached=groundCache.get(ctx);
  if(!cached||cached.key!==key||Math.abs(c.ox-cached.ox)>margin||Math.abs(c.oy-cached.oy)>margin){
    // Overscan keeps ordinary pan frames to one bitmap copy. Rebuild only
    // after leaving the buffer, changing zoom/DPR or changing actual geometry.
    const width=Math.ceil((c.w+margin*2)*ratio),height=Math.ceil((c.h+margin*2)*ratio);
    let surface=typeof globalThis.OffscreenCanvas==='function'?new globalThis.OffscreenCanvas(width,height):null;
    if(!surface&&typeof globalThis.document?.createElement==='function'){
      surface=globalThis.document.createElement('canvas');surface.width=width;surface.height=height;
    }
    if(surface){
      const painter=surface.getContext('2d');painter.scale(ratio,ratio);
      paintStaticGround(painter,{...c,w:c.w+margin*2,h:c.h+margin*2,ox:c.ox+margin,oy:c.oy+margin},project,footprints,terrainArt);
      cached={key,surface,ox:c.ox,oy:c.oy};groundCache.set(ctx,cached);
    }else cached=null;
  }
  ctx.save();
  // The distant vista is viewport anchored, so keep it outside the moving
  // overscan cache. Crossing a cache boundary must not snap the mountain sky.
  ctx.fillStyle=gradient(ctx,{x:0,y:0},{x:c.w,y:c.h},[[0,'#aab9a4'],[.5,'#c1c9b0'],[1,'#879e8a']],'#b0bda3');ctx.fillRect(0,0,c.w,c.h);
  drawPaintedVista(ctx,c,project,terrainArt?.terrain);
  if(cached)ctx.drawImage(cached.surface,c.ox-cached.ox-margin,c.oy-cached.oy-margin,c.w+margin*2,c.h+margin*2);
  else paintStaticGround(ctx,c,project,footprints,terrainArt);
  drawResources(ctx,s,c,project,footprints);
  // Wetness comes from the ecology authority; this is a subtle surface tint,
  // never a second weather process. Planning leaves all placement cues visible.
  const wet=clamp(s.ecologiesBySceneId?.['scene:yunxiu-courtyard']?.surfaceZones?.['zone:yard-path']?.wetness||0);
  if(wet>.35&&!planning){ctx.fillStyle=`rgba(48,74,67,${(wet-.35)*.09})`;ctx.fillRect(0,0,c.w,c.h);}
  ctx.restore();
}

function plant(ctx,p,c,project,{maturity,grain,seed}){
  const q=project(p,c),k=c.scale,height=(.095+maturity*.26)*k;if(!visible(q,c,30))return;
  ctx.strokeStyle=grain?(maturity>.73?'#938546':'#6b8050'):'#567450';ctx.lineWidth=Math.max(.55,.023*k);ctx.lineCap='round';
  for(let stem=0;stem<3;stem++){
    const side=stem-1,lean=(side*.045+(hash(seed,stem)-.5)*.04)*k,h=height*(.8+hash(stem,seed)*.3),x=q.x+side*.025*k;
    ctx.beginPath();ctx.moveTo(x,q.y);ctx.quadraticCurveTo(x+lean*.3,q.y-h*.65,x+lean,q.y-h);ctx.stroke();
    if(grain&&maturity>.6){
      ctx.strokeStyle=maturity>.78?'#d7bd67':'#a2aa68';ctx.lineWidth=Math.max(.7,.03*k);
      ctx.beginPath();ctx.moveTo(x+lean,q.y-h);ctx.quadraticCurveTo(x+lean+.085*k,q.y-h-.04*k,x+lean+.1*k,q.y-h+.07*k);ctx.stroke();
      for(let grainIndex=0;grainIndex<4;grainIndex++){ctx.fillStyle=maturity>.78?'#ead189':'#b8be7d';ctx.beginPath();ctx.ellipse(x+lean+(.023+grainIndex*.019)*k,q.y-h+(.01+grainIndex*.018)*k,.018*k,.028*k,-.4,0,TAU);ctx.fill();}
      ctx.strokeStyle=maturity>.73?'#938546':'#6b8050';ctx.lineWidth=Math.max(.55,.023*k);
    }else{
      for(const direction of [-1,1]){
        ctx.fillStyle=direction<0?'#476a48':'#87a366';ctx.beginPath();ctx.moveTo(x,q.y-h*.3);
        ctx.quadraticCurveTo(x+direction*.12*k,q.y-h*.9,x+direction*.17*k,q.y-h*.58);
        ctx.quadraticCurveTo(x+direction*.09*k,q.y-h*.24,x,q.y-h*.3);ctx.fill();
      }
      if(!grain&&maturity>.72&&seed%5===0){ctx.fillStyle='#b4b0cf';ctx.beginPath();ctx.arc(x+lean,q.y-h,.024*k,0,TAU);ctx.fill();}
    }
  }
}

/** True farm/granary footprint: earth, furrows, access lanes and batch crops. */
export function drawEstateField(ctx,b,s,c,{project,prefab,transform}={}){
  if(!['farm','granary'].includes(b.type)||!prefab||!transform||typeof project!=='function')return false;
  const t=typeof transform==='function'?transform(b):transform,d=typeof prefab==='function'?prefab(b):prefab,fp=rect(t.x,t.y,d.width,d.height),order=s.workOrdersById?.[`work:production:${b.instanceId}`];
  // Without an active production order, show tilled ground and young starts.
  // Never infer an earned harvest from wall-clock time or presentation RNG.
  const progress=order?.durationTicks>0?clamp(order.progressTicks/order.durationTicks):0;
  const maturity=order?.phase==='completed'?1:progress;
  const grain=b.type==='granary',k=c.scale;
  ctx.save();
  poly(ctx,fp,c,project,grain?'#8d8760':'#827655','#c1b086',Math.max(.7,.04*k));
  ctx.beginPath();trace(ctx,fp,c,project);ctx.clip();
  // Shallow drainage grooves stay within the agricultural footprint. Their
  // damp appearance comes only from the existing surface wetness authority.
  const wet=clamp(s.ecologiesBySceneId?.['scene:yunxiu-courtyard']?.surfaceZones?.['zone:yard-path']?.wetness||0);
  for(const x of [t.x+.08,t.x+d.width-.16])poly(ctx,rect(x,t.y+.1,.08,d.height-.2),c,project,wet>.5?'#687f69':'#615d42');
  for(let y=.16;y<d.height;y+=.18){
    poly(ctx,rect(t.x+.12,t.y+y,d.width-.24,.045),c,project,y%.36<.2?'#b4a37555':'#665d433b');
  }
  // Small transverse stone verge and a real open walking cross. No crop is
  // placed within the authority's individual work slots.
  const mid=d.height/2;
  poly(ctx,rect(t.x+.12,t.y+mid-.23,d.width-.24,.46),c,project,'#b5a784');
  poly(ctx,rect(t.x+d.width/2-.23,t.y+.12,.46,d.height-.24),c,project,'#b5a784');
  for(let row=0;row<2;row++)for(let col=0;col<2;col++){
    const x=t.x+.22+col*d.width/2,y=t.y+.22+row*d.height/2,w=d.width/2-.44,h=d.height/2-.44;
    poly(ctx,rect(x,y,w,h),c,project,grain?'#918160':'#796547');
    for(let lane=.2;lane<h;lane+=.39)poly(ctx,rect(x+.06,y+lane,w-.12,.055),c,project,'#b4a1765c');
  }
  const slots=d.slots?.filter(slot=>slot.kind==='work')||[];
  for(let y=.4,row=0;y<d.height-.23;y+=.38,row++)for(let x=.38,col=0;x<d.width-.23;x+=.39,col++){
    if(Math.abs(y-mid)<.32||Math.abs(x-d.width/2)<.33||slots.some(slot=>Math.hypot(slot.position.x-x,slot.position.y-y)<.44))continue;
    const seed=row*71+col*13;
    plant(ctx,{x:t.x+x+(hash(seed,2)-.5)*.05,y:t.y+y+(hash(seed,3)-.5)*.05},c,project,{maturity,grain,seed});
  }
  ctx.restore();return true;
}
