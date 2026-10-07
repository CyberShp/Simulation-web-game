/**
 * SR-XF-007 / OPEN-02: the existing Yunxiu painted cast, in logical metres.
 * Persistent appearance recipes supply identity; a single simulation tick supplies
 * poses. This module neither imports simulation/render owners nor mutates a view.
 * x/y is the actor's ground anchor, scale is pixels per logical metre.
 */
import characterFrames from './ea-character-frames.mjs';

const TAU = Math.PI * 2;
const DEFAULT_RECIPE = Object.freeze({height:1.75, body:'regular', face:'oval', hair:'topknot', outfit:'disciple', faceMark:0});
const SKINS = ['#d8b995','#c19b76','#e2c5a0','#b69070','#d1ac89'];
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const pt = (x,y)=>({x,y});
const lerp = (a,b,t)=>a+(b-a)*t;
const mix = (a,b,t)=>{
  if (!/^#[\da-f]{6}$/i.test(a||'')) a='#899d91';
  if (!/^#[\da-f]{6}$/i.test(b||'')) b='#899d91';
  return '#'+[1,3,5].map(i=>Math.round(lerp(parseInt(a.slice(i,i+2),16),parseInt(b.slice(i,i+2),16),t)).toString(16).padStart(2,'0')).join('');
};

export const CULTIVATOR_ATLAS = Object.freeze({
  id:'yunxiu-courtyard:characters:v1',
  source:'./yunxiu-courtyard/assets/characters.webp',
  width:characterFrames.width,height:characterFrames.height,
  columns:6,rows:Object.freeze(['standing','walk-a','walk-b','back']),
  // The source has no authored work, seated, sleeping or combat animation.
  // Tools and state labels must not turn these four rows into that claim.
  fullAnimationAvailable:false,
});
// The legacy equal-row metadata cut several back-view heads at y=768 and
// included them under the preceding walk frame. These are source-alpha bounds
// of the same bitmap, with its real boot anchors; no asset or save is replaced.
const PAINTED_FRAME_CORRECTIONS={
  2:[
    {x:56,y:513,w:178,h:221,footX:134.610,footY:216},
    {x:362,y:531,w:104,h:202,footX:79.702,footY:198},
    {x:604,y:519,w:110,h:216,footX:91.490,footY:212},
    {x:852,y:521,w:136,h:216,footX:108.177,footY:211},
    {x:1111,y:531,w:113,h:204,footX:97.056,footY:200},
    {x:1371,y:531,w:122,h:202,footX:84.511,footY:198},
  ],
  3:[
    {x:98,y:750,w:140,h:231,footX:73.992,footY:227},
    {x:379,y:766,w:118,h:210,footX:67.522,footY:203},
    {x:609,y:746,w:129,h:237,footX:61.793,footY:232},
    {x:863,y:752,w:123,h:226,footX:84.308,footY:222},
    {x:1143,y:762,w:109,h:216,footX:65.908,footY:212},
    {x:1365,y:766,w:119,h:209,footX:84.858,footY:205},
  ],
};
let sharedAtlas=null;
const usableAtlas=image=>!!image&&image.complete!==false&&
  Number(image.naturalWidth??image.width)===CULTIVATOR_ATLAS.width&&
  Number(image.naturalHeight??image.height)===CULTIVATOR_ATLAS.height;

/** Asset lifecycle only; never writes the saved appearance or simulation. */
export function registerCultivatorAtlas(image){sharedAtlas=usableAtlas(image)?image:null;return !!sharedAtlas;}
export function hasCultivatorAtlas(){return usableAtlas(sharedAtlas);}

export const CULTIVATOR_REST_ATLAS=Object.freeze({
  id:'yunxiu-courtyard:rest:v1',source:'./assets/estate-v1/characters-rest-v1.png',
  width:1024,height:1536,
  frames:Object.freeze([
    {x:28,y:26,w:313,h:694},{x:341,y:48,w:334,h:670},{x:696,y:26,w:307,h:695},
    {x:26,y:766,w:315,h:724},{x:354,y:790,w:323,h:697},{x:695,y:791,w:312,h:691},
  ].map(Object.freeze)),
});
let sharedRestAtlas=null;
const usableRestAtlas=image=>!!image&&image.complete!==false&&
  Number(image.naturalWidth??image.width)===CULTIVATOR_REST_ATLAS.width&&
  Number(image.naturalHeight??image.height)===CULTIVATOR_REST_ATLAS.height;
export function registerCultivatorRestAtlas(image){sharedRestAtlas=usableRestAtlas(image)?image:null;return !!sharedRestAtlas;}
export function hasCultivatorRestAtlas(){return usableRestAtlas(sharedRestAtlas);}

/** SR-XF-007: static authored waiting and seated study bodies in saved identity order. */
export const CULTIVATOR_ACTIVITY_ATLAS=Object.freeze({
  id:'yunxiu-courtyard:wait-study:v1',source:'./assets/estate-v1/characters-wait-study-v1.png',
  width:1536,height:1024,columns:6,
  frames:Object.freeze({
    waiting:Object.freeze([
      {x:30,y:10,w:205,h:359,footX:127,footY:357},
      {x:330,y:31,w:153,h:333,footX:86,footY:331},
      {x:568,y:16,w:148,h:353,footX:77,footY:351},
      {x:830,y:20,w:136,h:349,footX:73,footY:347},
      {x:1075,y:35,w:139,h:330,footX:87,footY:328},
      {x:1336,y:36,w:137,h:331,footX:73,footY:329},
    ].map(Object.freeze)),
    study:Object.freeze([
      {x:12,y:428,w:243,h:282,footX:150,footY:280},
      {x:305,y:443,w:205,h:266,footX:111,footY:264},
      {x:558,y:431,w:202,h:278,footX:118,footY:276},
      {x:806,y:436,w:206,h:274,footX:109,footY:272},
      {x:1057,y:439,w:210,h:269,footX:125,footY:267},
      {x:1323,y:445,w:190,h:265,footX:104,footY:263},
    ].map(Object.freeze)),
  }),
});
let sharedActivityAtlas=null;
const usableActivityAtlas=image=>!!image&&image.complete!==false&&
  Number(image.naturalWidth??image.width)===CULTIVATOR_ACTIVITY_ATLAS.width&&
  Number(image.naturalHeight??image.height)===CULTIVATOR_ACTIVITY_ATLAS.height;
export function registerCultivatorActivityAtlas(image){sharedActivityAtlas=usableActivityAtlas(image)?image:null;return !!sharedActivityAtlas;}
export function hasCultivatorActivityAtlas(){return usableActivityAtlas(sharedActivityAtlas);}

/** Authored supine body, projected onto the same bed plane as the furniture. */
export function drawRestingCultivator(ctx,view,anchor,{atlas=sharedRestAtlas,selected=false}={}){
  if(!usableRestAtlas(atlas)||anchor?.poseVariant!=='bed-rest')return false;
  const saved=view?.spriteIndex??view?.appearance?.spriteIndex;
  const column=Number.isInteger(saved)&&saved>=0&&saved<6?saved:0;
  const f=CULTIVATOR_REST_ATLAS.frames[column],{origin,across,along,length}=anchor.surface;
  const width=length*f.w/f.h;
  ctx.save();ctx.transform(across.x,across.y,along.x,along.y,origin.x,origin.y);
  ctx.drawImage(atlas,f.x,f.y,f.w,f.h,-width/2,0,width,length);
  if(selected){ctx.strokeStyle='#e1c888';ctx.lineWidth=.035;ctx.strokeRect(-width/2-.04,-.025,width+.08,length+.05);}
  ctx.restore();
  return {asset:CULTIVATOR_REST_ATLAS.id,column,action:'rest',sourcePose:'supine',animated:false,length,width};
}

/** Read-only source selection; an activity can never change a person's column. */
export function cultivatorSpriteFrame(view={},tick=0,options={}){
  const pose=cultivatorPose(view,tick,options),savedIndex=view.spriteIndex??view.appearance?.spriteIndex;
  const column=Number.isInteger(savedIndex)&&savedIndex>=0&&savedIndex<CULTIVATOR_ATLAS.columns?savedIndex:0;
  if(!options.portrait&&!pose.back&&usableActivityAtlas(options.activityAtlas??sharedActivityAtlas)&&
      CULTIVATOR_ACTIVITY_ATLAS.frames[pose.action]){
    return {asset:CULTIVATOR_ACTIVITY_ATLAS.id,column,row:null,
      frame:{...CULTIVATOR_ACTIVITY_ATLAS.frames[pose.action][column]},
      sourcePose:pose.action,action:pose.action,mirror:pose.mirror,height:pose.height,
      renderHeight:pose.action==='study'?1.13:1.75,animated:false,
      dedicatedPoseAvailable:true,fullAnimationAvailable:false,fallback:null};
  }
  const row=options.portrait?0:pose.back?3:pose.walking&&!options.reducedMotion?1+(Math.floor(pose.phase/Math.PI)%2):0;
  const sourcePose=CULTIVATOR_ATLAS.rows[row],dedicatedPoseAvailable=['stand','walk','transport'].includes(pose.action);
  return {asset:CULTIVATOR_ATLAS.id,column,row,frame:{...(PAINTED_FRAME_CORRECTIONS[row]||characterFrames.frames[row])[column]},
    sourcePose,action:pose.action,mirror:pose.mirror,height:pose.height,
    animated:pose.walking&&!pose.back&&!options.reducedMotion,
    dedicatedPoseAvailable,fullAnimationAvailable:false,
    fallback:dedicatedPoseAvailable?null:'同一人物静态图集与实际工具；该活动专用身体姿态尚未绘制'};
}

/** Rest uses its reserved bed surface; the saved arrival/collision foot stays put. */
export function restRenderAnchor(s,person,{prefab,transform,project,camera}={}){
  if(!s||!person||typeof prefab!=='function'||typeof transform!=='function'||typeof project!=='function'||!camera)return null;
  const a=s.activitiesById?.[person.activityId];
  if(a?.action!=='rest'||a.phase!=='executing'||!a.slotId)return null;
  if(a.personId&&a.personId!==person.personId)return null;
  const b=s.buildingsById?.[a.targetId]||s.buildings?.find(b=>b.instanceId===a.targetId||b.id===a.targetId);
  if(!b)return null;
  const d=prefab(b),t=transform(b),baseId=b.instanceId||`building:yunxiu:${b.id}`;
  if(!d?.indoor||!t)return null;
  const slot=d.slots?.find(q=>q.kind==='rest'&&`${baseId}/slot:${q.suffix}`===a.slotId);
  const bed=slot&&d.furniture?.find(q=>q.kind==='bed'&&q.id===slot.suffix);
  if(!slot||!bed?.polygon?.length)return null;
  const at=person.scenic||person.mind?.scenic;
  const expected={x:t.x+slot.position.x,y:t.y+slot.position.y};
  if(!at||!Number.isFinite(at.x)||!Number.isFinite(at.y)||Math.hypot(at.x-expected.x,at.y-expected.y)>.08)return null;
  const worldPosition={x:at.x,y:at.y},q=project(worldPosition,camera);
  if(!Number.isFinite(q?.x)||!Number.isFinite(q?.y))return null;
  const reservation=s.reservationsById?.[a.reservationId];
  const xs=bed.polygon.map(p=>p[0]),ys=bed.polygon.map(p=>p[1]);
  const left=t.x+Math.min(...xs),top=t.y+Math.min(...ys),width=Math.max(...xs)-Math.min(...xs),depth=Math.max(...ys)-Math.min(...ys);
  const length=clamp(Number(person.appearance?.recipe?.height)||1.75,1.6,1.9);
  if(reservation?.kind==='slot'&&reservation.activityId===a.id&&reservation.slotId===a.slotId&&reservation.personId===person.personId&&depth>=length+.12&&width>=.8){
    const centre={x:left+width/2,y:top+depth/2};
    const head={x:centre.x,y:centre.y-length/2};
    const origin=project(head,camera),xAxis=project({x:head.x+1,y:head.y},camera),yAxis=project({x:head.x,y:head.y+1},camera);
    origin.y-=.46*camera.scale;
    const across={x:xAxis.x-origin.x,y:xAxis.y-origin.y-.46*camera.scale},along={x:yAxis.x-origin.x,y:yAxis.y-origin.y-.46*camera.scale};
    const visualPosition=project(centre,camera);visualPosition.y-=.46*camera.scale;
    const corners=[[-.52,0],[.52,0],[.52,length],[-.52,length]].map(([x,y])=>({x:origin.x+across.x*x+along.x*y,y:origin.y+across.y*x+along.y*y}));
    const bounds={left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),top:Math.min(...corners.map(p=>p.y)),bottom:Math.max(...corners.map(p=>p.y))};
    return {x:visualPosition.x,y:visualPosition.y,worldPosition,visualWorldPosition:centre,depthPosition:{x:left+width,y:top+depth},surface:{origin,across,along,length},bounds,poseVariant:'bed-rest',action:'rest',label:'卧床休养',buildingId:b.id,buildingInstanceId:baseId,slotId:a.slotId,bedId:bed.id};
  }
  return {x:q.x,y:q.y,worldPosition,angle:0,scale:camera.scale,poseVariant:'bedside-rest',action:'rest',label:'床边歇息',buildingId:b.id,buildingInstanceId:baseId,slotId:a.slotId,bedId:bed.id};
}

/** Pure body pose in local metres, suitable for deterministic pause/reload checks. */
export function cultivatorPose(view={}, tick=0, {reducedMotion=false,portrait=false,facing=1}={}) {
  const recipe={...DEFAULT_RECIPE,...(view.recipe||view.appearance?.recipe||{})};
  const height=clamp(Number(recipe.height)||1.75,1.6,1.9), k=height/1.75;
  const action=portrait?'stand':view.action||'stand';
  const phase=reducedMotion?0:(((Number(tick)||0)%24)+24)%24/24*TAU;
  const wave=Math.sin(phase), walking=['walk','transport'].includes(action);
  const bedsideRest=!portrait&&action==='rest'&&view.poseVariant==='bedside-rest';
  const seated=bedsideRest||['cultivate','study','heal','groundRest','teach'].includes(action);
  const sleep=!bedsideRest&&['rest','down'].includes(action);
  const working=['work','plant','gather'].includes(action);
  const width=recipe.body==='slim'?.91:recipe.body==='broad'?1.13:1;
  const bob=walking&&!reducedMotion?Math.abs(wave)*.028:0;
  const lean=action==='hit'?-.16:bedsideRest?-.045:working?.12+(reducedMotion?0:Math.sin(phase)*.045):walking?.022:0;
  const waistY=seated?-.48:-.88, shoulderY=seated?-.88:-1.29;
  const hip=pt(0,waistY-bob), shoulder=pt(lean,shoulderY-bob);
  const head=pt(lean*1.3+.015,shoulderY-.245-bob);
  const stride=walking?wave*.18:0;
  const feet=seated?[pt(-.21,-.07),pt(.21,-.065)]:[pt(-.105-stride,Math.min(0,wave)*.075),pt(.095+stride,Math.min(0,-wave)*.075)];
  const nearShoulder=pt(shoulder.x+.155*width,shoulder.y+.015);
  const farShoulder=pt(shoulder.x-.165*width,shoulder.y-.018);
  let nearElbow=pt(nearShoulder.x+.08,shoulder.y+.27),nearHand=pt(nearShoulder.x+.05,shoulder.y+.52);
  let farElbow=pt(farShoulder.x-.065,shoulder.y+.25),farHand=pt(farShoulder.x-.04,shoulder.y+.47);
  if(walking){nearElbow.x+=stride*.5;nearHand.x+=stride;nearHand.y-=stride*.25;farHand.x-=stride;farElbow.x-=stride*.5;}
  if(seated){nearElbow=pt(.25,waistY-.13);nearHand=pt(.15,waistY+.08);farElbow=pt(-.21,waistY-.15);farHand=pt(-.12,waistY+.045);}
  if(bedsideRest||action==='cultivate'||action==='groundRest'){nearElbow=pt(.24,-.47);nearHand=pt(.22,-.235);farElbow=pt(-.23,-.49);farHand=pt(-.215,-.24);}
  if(action==='study'||action==='teach'){nearHand=pt(.18,waistY-.10);farHand=pt(-.16,waistY-.14);}
  if(action==='heal'){nearHand=pt(-.055,waistY-.12);farHand=pt(.055,waistY-.15);}
  if(working){
    const pulse=reducedMotion?.5:(1+wave)*.5;
    nearElbow=pt(shoulder.x+.21,shoulder.y+.20-pulse*.09);
    nearHand=pt(shoulder.x+.36,shoulder.y+.39-pulse*.27);
    farElbow=pt(shoulder.x-.13,shoulder.y+.26);
    farHand=pt(shoulder.x+.13,shoulder.y+.47);
    if(action==='gather'){nearElbow=pt(shoulder.x+.20,shoulder.y+.28);nearHand=pt(shoulder.x+.33,shoulder.y+.57+wave*.035);}
  }
  if(action==='transport'){nearElbow=pt(.29,waistY-.13);nearHand=pt(.24,waistY+.02);farElbow=pt(-.24,waistY-.18);farHand=pt(-.12,waistY-.015);}
  if(action==='cast'){nearElbow=pt(.34,shoulder.y+.11);nearHand=pt(.55,shoulder.y+.01+wave*.018);farHand=pt(-.025,waistY-.16);}
  if(action==='hit'){nearHand=pt(.18,shoulder.y-.13);farHand=pt(-.29,shoulder.y+.025);}
  const direction=typeof facing==='string'?facing.toLowerCase():facing;
  const back=!portrait&&(!!view.back||['north','n','ne','nw','back'].includes(direction)||view.pose?.back===true);
  const mirror=typeof facing==='number'?(facing<0?-1:1):['west','w','nw','sw','left'].includes(direction)?-1:1;
  return {version:'cultivator-art:yunxiu:v2',recipe,height,k,width,action,phase,bob,lean,walking,seated,sleep,bedsideRest,back,mirror,hip,shoulder,head,feet,nearShoulder,farShoulder,nearElbow,farElbow,nearHand,farHand,tool:view.tool||null,mounts:view.mounts||{}};
}

function ellipse(ctx,x,y,rx,ry,fill,stroke=null,angle=0){
  ctx.beginPath();ctx.ellipse(x,y,rx,ry,angle,0,TAU);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}
}
function line(ctx,points,stroke,width=.018){
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();
}
function shape(ctx,draw,fill,stroke=null,width=.014){
  ctx.beginPath();draw(ctx);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.lineWidth=width;ctx.strokeStyle=stroke;ctx.stroke();}
}
function clothGradient(ctx,x,y,w,h,color){
  const g=ctx.createLinearGradient?.(x,y,x+w,y+h);
  if(typeof g?.addColorStop!=='function')return color;
  g.addColorStop(0,mix(color,'#fff0d3',.3));g.addColorStop(.38,color);g.addColorStop(1,mix(color,'#172e2d',.38));return g;
}
function robePanel(ctx,hip,foot,side,cloth,outline,width){
  const h=hip.x,hy=hip.y,fx=foot.x,fy=foot.y-.08,spread=.105*width;
  shape(ctx,p=>{
    p.moveTo(h+side*.02,hy-.01);p.lineTo(h+side*.17*width,hy-.01);
    p.bezierCurveTo(h+side*.18,hy+.18,fx+side*(spread+.03),fy-.23,fx+side*spread,fy-.015);
    p.quadraticCurveTo(fx,fy+.025,fx-side*.085,fy-.02);
    p.bezierCurveTo(fx-side*.068,fy-.25,h+side*.015,hy+.21,h+side*.02,hy-.01);
  },clothGradient(ctx,h,hy,side*.25,.5,cloth),outline);
  line(ctx,[[h+side*.09,hy+.06],[fx+side*.035,fy-.20],[fx+side*.03,fy-.045]],mix(cloth,'#182f30',.35),.012);
  line(ctx,[[h+side*.13,hy+.10],[fx+side*.07,fy-.22],[fx+side*.076,fy-.045]],mix(cloth,'#f0e5cc',.34),.012);
  line(ctx,[[fx-side*.055,fy-.07],[fx+side*.075,fy-.055]],mix(cloth,'#e4cf9a',.34),.016);
}
function sleeve(ctx,root,elbow,wrist,cloth,trim,skin,back=false){
  const wx=wrist.x,wy=wrist.y,ex=elbow.x,ey=elbow.y,rx=root.x,ry=root.y;
  const nx=(wy-ey),ny=-(wx-ex),length=Math.hypot(nx,ny)||1,n={x:nx/length,y:ny/length};
  shape(ctx,p=>{
    p.moveTo(rx-.065,ry+.006);p.quadraticCurveTo(ex-.13,ey-.065,wx+n.x*.072,wy+n.y*.072-.04);
    p.quadraticCurveTo(wx,wy+.035,wx-n.x*.072,wy-n.y*.072-.04);
    p.quadraticCurveTo(ex+.13,ey+.10,rx+.065,ry+.085);
  },clothGradient(ctx,rx-.12,ry,.24,.42,cloth),'#3f4c43');
  line(ctx,[[rx-.025,ry+.04],[ex-.018,ey+.045],[wx-n.x*.037,wy-n.y*.037-.075]],mix(cloth,'#182f29',.34),.013);
  line(ctx,[[wx+n.x*.07,wy+n.y*.07-.045],[wx-n.x*.07,wy-n.y*.07-.045]],trim,.035);
  ellipse(ctx,wx,wy+.015,.037,.057,back?mix(skin,'#5b5143',.13):skin,'#8c7057',-.3);
  line(ctx,[[wx+.015,wy+.015],[wx+.015,wy+.043]],mix(skin,'#6c4f40',.30),.009);
}
function drawHairBack(ctx,f,hair,trim){
  const {x,y}=f.head,kind=f.recipe.hair;
  if(kind==='loose'||kind==='half-tied'){
    shape(ctx,p=>{p.moveTo(x-.11,y-.02);p.bezierCurveTo(x-.18,y+.12,x-.13,y+.39,x-.20,y+.52);p.quadraticCurveTo(x-.02,y+.59,x+.13,y+.42);p.quadraticCurveTo(x+.17,y+.23,x+.11,y-.025);},hair,'#26312e');
    line(ctx,[[x-.07,y+.11],[x-.06,y+.37],[x-.12,y+.48]],mix(hair,'#bac6ad',.17),.013);
  }
  if(kind==='braid'){
    const sway=f.walking?Math.sin(f.phase)*.045:0;
    for(let i=0;i<6;i++)ellipse(ctx,x-.12+sway*i/6+(i%2)*.018,y+.075+i*.055,.04-i*.003,.044,hair);
    line(ctx,[[x-.105+sway,y+.39],[x-.115+sway,y+.48]],trim,.023);
  }
}
function drawFace(ctx,f,palette){
  const {x,y}=f.head,r=f.recipe,skin=palette.skin,hair=palette.hair;
  const round=r.face==='round',angular=r.face==='angular',w=(round?.117:angular?.105:.108),h=round?.138:.149;
  ctx.lineWidth=.012;
  ellipse(ctx,x-.092,y+.014,.028,.047,mix(skin,'#795644',.15));
  if(f.back){
    ellipse(ctx,x,y-.008,w*1.12,h*1.07,hair,'#26312e');
    line(ctx,[[x-.045,y-.095],[x-.012,y+.068]],mix(hair,'#b8bda9',.20),.014);
    line(ctx,[[x+.032,y-.11],[x+.055,y+.058]],mix(hair,'#b8bda9',.13),.014);
  }else{
    const g=clothGradient(ctx,x-w,y-h,w*2,h*2,skin);
    shape(ctx,p=>{
      p.moveTo(x-w*.9,y-h*.65);p.quadraticCurveTo(x+.01,y-h*1.05,x+w*.88,y-h*.6);
      p.quadraticCurveTo(x+w*1.13,y+.006,x+w*.88,y+h*.45);
      if(angular){p.lineTo(x+w*.47,y+h*.85);p.lineTo(x+.015,y+h);p.lineTo(x-w*.62,y+h*.52);}
      else p.quadraticCurveTo(x+.04,y+h*1.20,x-w*.7,y+h*.53);
      p.quadraticCurveTo(x-w*1.03,y+.03,x-w*.9,y-h*.65);
    },g,'#806750',.011);
    // Asymmetric features give a consistent three-quarter view instead of a front paper face.
    line(ctx,[[x-.064,y-.026],[x-.025,y-.035]],'#484438',.013);
    line(ctx,[[x+.041,y-.034],[x+.081,y-.021]],'#484438',.014);
    const closed=['cultivate','rest','heal','down'].includes(f.action);
    line(ctx,[[x-.058,y+.003],[x-.029,y+.005]],'#323b33',.011);
    line(ctx,[[x+.044,y+.001],[x+.074,y+.005]],'#323b33',.011);
    if(!closed){ellipse(ctx,x-.034,y+.008,.007,.012,'#262e27');ellipse(ctx,x+.059,y+.009,.009,.013,'#262e27');}
    line(ctx,[[x+.022,y+.010],[x+.031,y+.052],[x+.014,y+.06]],mix(skin,'#785640',.44),.010);
    line(ctx,[[x-.006,y+.091],[x+.034,y+.092]],'#a37461',.011);
    line(ctx,[[x+.002,y+.106],[x+.029,y+.107]],mix(skin,'#f9e4c2',.45),.010);
    if(r.faceMark===1)line(ctx,[[x-.074,y+.043],[x-.057,y+.079]],'#956b57',.012);
    if(r.faceMark===2)ellipse(ctx,x+.073,y+.050,.006,.007,'#775341');
    if(r.faceMark===3){line(ctx,[[x-.064,y+.099],[x-.019,y+.147],[x+.047,y+.128]],mix(hair,skin,.25),.019);}
    if(r.faceMark===4){line(ctx,[[x-.075,y-.040],[x-.03,y-.042]],mix(hair,'#cabfa5',.28),.016);}
    shape(ctx,p=>{p.moveTo(x-w*1.02,y+.02);p.bezierCurveTo(x-w*1.20,y-h*.88,x-.05,y-h*1.29,x+.049,y-h*1.08);p.quadraticCurveTo(x+w*1.15,y-h*.95,x+w*.96,y-.001);p.quadraticCurveTo(x+.055,y-h*.58,x+.025,y-h*.77);p.quadraticCurveTo(x-.039,y-h*.37,x-w*.82,y-h*.38);},hair,'#25322e',.011);
    line(ctx,[[x-.085,y-.119],[x-.033,y-.147],[x+.035,y-.139]],mix(hair,'#b8bda9',.22),.013);
    line(ctx,[[x-.098,y-.048],[x-.108,y+.100]],hair,.026);
  }
  if(r.hair==='topknot'){
    ellipse(ctx,x-.025,y-h-.035,.066,.051,hair,'#26312e',-.13);
    line(ctx,[[x-.077,y-h-.008],[x+.020,y-h-.019]],palette.trim,.022);
    line(ctx,[[x-.096,y-h-.049],[x+.052,y-h-.065]],'#c7b685',.016);
  }else if(r.hair==='half-tied'){
    ellipse(ctx,x-.076,y-.112,.051,.045,hair);
    line(ctx,[[x-.119,y-.11],[x-.038,y-.12]],palette.trim,.022);
    line(ctx,[[x-.108,y-.1],[x-.147,y+.11],[x-.137,y+.22]],palette.trim,.013);
  }else if(r.hair==='braid'){
    line(ctx,[[x-.105,y-.052],[x+.072,y-.087]],mix(palette.trim,'#ece0b7',.15),.022);
  }else{
    line(ctx,[[x+.094,y-.08],[x+.118,y+.066],[x+.104,y+.22]],hair,.034);
    line(ctx,[[x-.077,y-.08],[x-.126,y+.070],[x-.116,y+.25]],hair,.029);
  }
}

function drawTool(ctx,f,palette){
  const hand=f.nearHand,far=f.farHand,tool=f.tool,ink='#485348',timber='#95734c';
  if(tool==='hoe'||tool==='spade'||tool==='facility-specific'){
    const angle=f.action==='plant'?-.55+Math.sin(f.phase)*.23:-.27;
    ctx.save();ctx.translate(hand.x,hand.y);ctx.rotate(angle);
    line(ctx,[[0,-.35],[0,.53]],'#5e4c37',.045);line(ctx,[[-.009,-.34],[-.009,.51]],'#b19363',.018);
    if(tool==='spade')shape(ctx,p=>{p.moveTo(-.09,.35);p.lineTo(.08,.35);p.lineTo(.1,.53);p.quadraticCurveTo(0,.63,-.11,.52);},'#7d938a',ink);
    else shape(ctx,p=>{p.moveTo(-.03,.46);p.lineTo(.20,.41);p.lineTo(.23,.49);p.lineTo(.01,.53);},'#9caaa0',ink);
    ctx.restore();
  }else if(tool==='hammer'){
    ctx.save();ctx.translate(hand.x,hand.y);ctx.rotate(-.45+Math.sin(f.phase)*.42);
    line(ctx,[[0,.06],[0,-.27]],timber,.039);
    shape(ctx,p=>{p.moveTo(-.115,-.32);p.lineTo(.105,-.32);p.lineTo(.115,-.21);p.lineTo(-.105,-.20);},'#63736d','#3b4944');
    line(ctx,[[-.094,-.30],[.085,-.30]],'#a8b1a0',.014);ctx.restore();
  }else if(tool==='book'){
    const y=f.hip.y-.135;
    shape(ctx,p=>{p.moveTo(-.2,y-.085);p.quadraticCurveTo(-.09,y-.11,.01,y-.045);p.quadraticCurveTo(.13,y-.10,.25,y-.059);p.lineTo(.22,y+.17);p.quadraticCurveTo(.10,y+.13,.005,y+.18);p.quadraticCurveTo(-.1,y+.11,-.21,y+.11);},'#cdbf93','#686a50');
    line(ctx,[[.012,y-.026],[.005,y+.153]],'#827b5b',.018);
    for(let i=0;i<3;i++){line(ctx,[[-.17,y-.023+i*.040],[-.045,y+.017+i*.032]],'#8e8969',.009);line(ctx,[[.053,y+.018+i*.036],[.19,y-.002+i*.04]],'#8e8969',.009);}
  }else if(tool==='basket'||tool==='bundle'||f.action==='transport'){
    const x=f.action==='transport'?.04:-.31,y=f.hip.y+.05;
    shape(ctx,p=>{p.moveTo(x-.17,y-.15);p.lineTo(x+.18,y-.13);p.lineTo(x+.14,y+.16);p.quadraticCurveTo(x,y+.21,x-.14,y+.14);},tool==='bundle'?'#b6a47b':'#ab8956','#715c3e');
    for(let i=0;i<5;i++)line(ctx,[[x-.13+i*.062,y-.105],[x-.105+i*.05,y+.143]],'#7f673f',.010);
    for(let i=0;i<4;i++)line(ctx,[[x-.14+i*.004,y-.075+i*.055],[x+.16-i*.005,y-.055+i*.055]],'#d2b77b',.012);
    ctx.beginPath();ctx.ellipse(x,y-.125,.14,.115,0,Math.PI,TAU);ctx.strokeStyle='#695638';ctx.lineWidth=.025;ctx.stroke();
    if(tool==='basket'){for(let i=0;i<4;i++){line(ctx,[[x-.10+i*.07,y-.15],[x-.14+i*.07,y-.32+(i%2)*.055]],'#526e48',.016);ellipse(ctx,x-.12+i*.069,y-.25+(i%2)*.035,.045,.019,'#78905a',null,-.6);}}
  }else if(tool==='mortar'){
    const x=.20+f.lean,y=f.hip.y+.02;
    shape(ctx,p=>{p.moveTo(x-.13,y-.02);p.quadraticCurveTo(x-.11,y+.13,x,y+.14);p.quadraticCurveTo(x+.12,y+.11,x+.14,y-.02);},'#929b82','#5f6a58');
    ellipse(ctx,x,y-.02,.14,.054,'#bdc1a0','#616c58');ellipse(ctx,x,y-.02,.096,.031,'#687350');
    line(ctx,[[hand.x,hand.y+.015],[x+Math.sin(f.phase)*.037,y-.013]],'#c3b18b',.043);
  }else if(tool==='bandage'){
    line(ctx,[[far.x-.05,far.y+.01],[hand.x+.06,hand.y+.04]],'#e9dfc3',.053);
    line(ctx,[[far.x-.02,far.y-.01],[hand.x+.035,hand.y+.055]],'#b9ad8e',.009);
  }
  if(f.action==='cast'){
    // A small hand-local gesture accent, never a replacement for the body pose.
    line(ctx,[[hand.x+.05,hand.y-.02],[hand.x+.10,hand.y-.10],[hand.x+.145,hand.y-.01]],'#c4b27a',.016);
    ellipse(ctx,hand.x+.10,hand.y-.042,.017,.025,'#e5dbac');
  }
}

// Attachment positions are fractions of each registered crop, not world feet.
// They keep small tools at the painted hands without bending the source body.
const PAINTED_MOUNTS=Object.freeze([
  [.74,.55,.32,.51,.53,.50], [.70,.47,.53,.50,.60,.52],
  [.20,.57,.77,.53,.58,.53], [.75,.45,.43,.51,.55,.54],
  [.63,.48,.43,.51,.58,.54], [.60,.40,.41,.49,.54,.54],
]);
function paintedAttachments(sprite,pose){
  const f=sprite.frame,unit=(sprite.renderHeight||1.75)/f.footY;
  const a=sprite.sourcePose==='study'?[.65,.52,.38,.53,.5,.69]:
    sprite.sourcePose==='waiting'?[.55,.50,.45,.50,.5,.57]:PAINTED_MOUNTS[sprite.column];
  const at=(x,y)=>pt((f.w*x-f.footX)*unit,(f.h*y-f.footY)*unit);
  return {...pose,nearHand:at(a[0],a[1]),farHand:at(a[2],a[3]),hip:at(a[4],a[5]),lean:0};
}
function attachmentSprite(mount){return mount?.sprite||mount?.appearanceId||mount?.definitionId||'';}
function drawAccessoryAttachment(ctx,mount,hip,{herbalist=false}={}){
  const pendant=attachmentSprite(mount).includes('pendant'),x=hip.x-.20,y=hip.y+.20;
  line(ctx,[[hip.x-.16,hip.y+.03],[x,y-.04]],'#a98f60',.013);
  if(pendant){
    shape(ctx,p=>{p.moveTo(x,y-.09);p.lineTo(x+.055,y);p.lineTo(x,y+.09);p.lineTo(x-.055,y);p.closePath();},'#9bc8b3','#476e60');
    ellipse(ctx,x,y,.017,.025,'#e1e6bf');
  }else{
    ellipse(ctx,x,y,.061,.079,herbalist?'#9e956d':'#8daa99','#516457');
    line(ctx,[[x-.04,y-.03],[x+.04,y-.03]],'#c5bc8b',.014);
  }
}
function drawArtifactAttachment(ctx,mount,hand){
  if(attachmentSprite(mount).includes('pulse')){
    shape(ctx,p=>{p.moveTo(hand.x,hand.y-.04);p.lineTo(hand.x+.065,hand.y+.075);p.lineTo(hand.x,hand.y+.18);p.lineTo(hand.x-.065,hand.y+.075);p.closePath();},'#90c3ad','#426b5b');
    ellipse(ctx,hand.x,hand.y+.075,.025,.035,'#e3e6bd');
  }else{
    shape(ctx,p=>{p.moveTo(hand.x-.046,hand.y);p.lineTo(hand.x+.047,hand.y);p.lineTo(hand.x+.042,hand.y+.145);p.lineTo(hand.x-.043,hand.y+.145);p.closePath();},'#b7c5a6','#647a62');
    line(ctx,[[hand.x-.021,hand.y+.035],[hand.x+.022,hand.y+.06],[hand.x-.02,hand.y+.109]],'#8c7350',.011);
  }
}
function paintedEquipment(ctx,f,palette,{portrait=false}={}){
  const h=f.hip,weapon=f.mounts.weapon||f.mounts.mainHand,robe=f.mounts.armor||f.mounts.robe;
  // Saved accent remains a cloth detail; source skin and hair are never recoloured.
  line(ctx,[[h.x-.105,h.y],[h.x+.105,h.y+.013]],palette.cloth,.033);
  line(ctx,[[h.x+.045,h.y+.01],[h.x+.07,h.y+.21]],palette.cloth,.031);
  if(robe){
    const colour=(robe.appearanceId||robe.definitionId||'').includes('pulse')?'#b7d2bf':'#d9c291';
    line(ctx,[[h.x-.09,h.y-.29],[h.x+.035,h.y-.18],[h.x-.055,h.y-.045]],colour,.021);
  }
  if(weapon){
    const hand=f.nearHand,casting=['cast','hit'].includes(f.action)&&!portrait;
    const x=casting?hand.x:h.x-.19,y=casting?hand.y:h.y+.23;
    line(ctx,[[x,y],[x+(casting?.34:-.08),y-.79]],casting?'#c5d1c0':'#3e5752',.045);
    line(ctx,[[x-.07,y-.07],[x+.07,y-.07]],'#c9b781',.023);
    line(ctx,[[x,y-.01],[x,y+.11]],'#81714e',.028);
  }
  if(f.mounts.accessory||f.mounts.belt)drawAccessoryAttachment(ctx,f.mounts.accessory||f.mounts.belt,h);
  if(f.mounts.artifact||f.mounts.charm)drawArtifactAttachment(ctx,f.mounts.artifact||f.mounts.charm,f.farHand);
}
function drawPaintedCultivator(ctx,view,options,atlas,activityAtlas){
  const {x,y,scale,tick,facing,reducedMotion,portrait,selected}=options;
  const pose=cultivatorPose(view,tick,options),sprite=cultivatorSpriteFrame(view,tick,{...options,activityAtlas}),f=sprite.frame;
  const attachment=paintedAttachments(sprite,pose),unit=(sprite.renderHeight||1.75)/f.footY;
  const accent=view.accent||view.appearance?.accent||'#819787';
  const palette={cloth:accent,skin:'#d8b995',hair:'#303b36',trim:'#c4cfb5',ink:'#35483e'};
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineCap='round';ctx.lineJoin='round';
  if(!portrait){
    ellipse(ctx,0,.02,pose.action==='down'?.57:.24,pose.action==='down'?.12:.085,'#283e3236');
    if(selected){ctx.beginPath();ctx.ellipse(0,.025,.34,.145,0,0,TAU);ctx.strokeStyle='#e1c888';ctx.lineWidth=.029;ctx.stroke();}
  }
  ctx.scale(pose.k*pose.mirror,pose.k);
  // A downed person is laid at their existing anchor, not displayed alive and
  // standing. This is a static image transform, not an authored falling cycle.
  if(pose.action==='down'&&!portrait){ctx.translate(-.72,-.10);ctx.rotate(Math.PI/2);}
  ctx.drawImage(sprite.asset===CULTIVATOR_ACTIVITY_ATLAS.id?activityAtlas:atlas,
    f.x,f.y,f.w,f.h,-f.footX*unit,-f.footY*unit,f.w*unit,f.h*unit);
  paintedEquipment(ctx,attachment,palette,{portrait});
  if(!portrait){
    // Walk rows are used only for real movement. Work/study/rest keep this same
    // painted identity and use truthful tools rather than a fake work loop.
    const activeTool=['work','plant','gather','study','teach','heal','transport','cast'].includes(pose.action)&&
      sprite.sourcePose!=='study';
    if(activeTool&&!pose.back){
      const toolPose={...attachment,phase:0}; // no floating tool motion on a static hand
      if(['book','basket','bundle','mortar'].includes(toolPose.tool)||pose.action==='transport'){
        ctx.save();ctx.translate(attachment.hip.x,0);drawTool(ctx,{...toolPose,hip:{x:0,y:attachment.hip.y}},palette);ctx.restore();
      }else drawTool(ctx,toolPose,palette);
    }
    if(['cultivate','heal'].includes(pose.action)){
      ctx.strokeStyle=pose.action==='heal'?'#afc7a477':'#d7c18c77';ctx.lineWidth=.016;
      ctx.beginPath();ctx.ellipse(0,-.035,.32,.10,0,0,TAU);ctx.stroke();
    }
  }
  ctx.restore();
  return {...pose,art:sprite};
}

/** Draw one stable identity, returning its pure pose without touching world state. */
export function drawCultivator(ctx,view={}, {x=0,y=0,scale=32,tick=0,facing=1,reducedMotion=false,portrait=false,selected=false,atlas=sharedAtlas,activityAtlas=sharedActivityAtlas}={}){
  if(usableAtlas(atlas))return drawPaintedCultivator(ctx,view,{x,y,scale,tick,facing,reducedMotion,portrait,selected},atlas,activityAtlas);
  const f=cultivatorPose(view,tick,{reducedMotion,portrait,facing}),r=f.recipe;
  const accent=view.accent||view.appearance?.accent||'#819787',mark=((Number(r.faceMark)||0)%SKINS.length+SKINS.length)%SKINS.length;
  const robeMount=f.mounts.armor||f.mounts.robe,robeId=robeMount?.appearanceId||robeMount?.definitionId||'';
  let cloth=r.outfit==='herbalist'?'#779073':r.outfit==='artisan'?'#927b60':r.outfit==='traveller'?mix(accent,'#729189',.25):mix(accent,'#858f85',.18);
  if(robeId)cloth=robeId.includes('pulse')?'#668b8d':mix(cloth,'#a69b7b',.43);
  const palette={cloth,skin:SKINS[mark],hair:mark===3?'#55544a':'#303b36',trim:r.outfit==='artisan'?'#d3bd8a':'#c4cfb5',ink:'#35483e'};
  const trim=palette.trim,ink=palette.ink;
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.lineCap='round';ctx.lineJoin='round';
  if(!portrait){
    ellipse(ctx,.055,.017,f.sleep?.72:f.seated?.31:.24,f.sleep?.15:.095,'#283e3236');
    ellipse(ctx,0,.01,f.seated?.23:.145,.05,'#263c3021');
    if(selected){ctx.beginPath();ctx.ellipse(0,.025,.34,.145,0,0,TAU);ctx.strokeStyle='#e1c888';ctx.lineWidth=.029;ctx.stroke();}
  }
  ctx.scale(f.k*f.mirror,f.k);
  if(f.sleep&&!portrait){ctx.translate(-.75,-.12);ctx.rotate(Math.PI/2);}
  drawHairBack(ctx,f,palette.hair,trim);
  const weapon=f.mounts.weapon||f.mounts.mainHand;
  if(weapon&&!['cast','hit'].includes(f.action)){
    line(ctx,[[-.20,-.47],[-.28,-1.34]],'#3e5752',.057);
    line(ctx,[[-.203,-.48],[-.26,-1.31]],'#b1b4a0',.017);
    line(ctx,[[-.27,-1.33],[-.28,-1.53]],'#81714e',.034);
    line(ctx,[[-.35,-1.32],[-.20,-1.34]],'#c9b781',.027);
    line(ctx,[[-.28,-1.52],[-.335,-1.45],[-.36,-1.38]],mix(accent,'#b18e68',.4),.016);
  }
  sleeve(ctx,f.farShoulder,f.farElbow,f.farHand,mix(cloth,'#263e35',.17),trim,palette.skin,true);
  if(f.seated){
    // The folded lap physically connects the waist to crossed thighs.
    shape(ctx,p=>{p.moveTo(-.155*f.width,f.hip.y+.015);p.lineTo(.16*f.width,f.hip.y+.015);p.quadraticCurveTo(.28,-.27,.25,-.15);p.quadraticCurveTo(0,-.065,-.26,-.16);p.quadraticCurveTo(-.27,-.30,-.155*f.width,f.hip.y+.015);},clothGradient(ctx,-.25,f.hip.y,.5,.37,cloth),ink);
    ellipse(ctx,-.13,-.16,.26,.115,clothGradient(ctx,-.4,-.25,.75,.2,cloth),ink,-.19);
    ellipse(ctx,.14,-.11,.25,.11,clothGradient(ctx,-.1,-.23,.5,.16,cloth),ink,.15);
    line(ctx,[[-.31,-.17],[-.10,-.10],[.16,-.16]],mix(cloth,'#e7dfbd',.33),.016);
    line(ctx,[[.05,f.hip.y+.11],[.16,-.27],[.19,-.17]],mix(cloth,'#233c31',.30),.013);
    ellipse(ctx,.18,-.066,.075,.030,'#414f44');ellipse(ctx,-.12,-.083,.07,.031,'#414f44');
  }else{
    for(const foot of f.feet){
      line(ctx,[[foot.x,foot.y-.17],[foot.x,foot.y-.035]],'#697465',.073);
      ellipse(ctx,foot.x+.018,foot.y-.025,.070,.031,'#36473f',ink,.07);
      line(ctx,[[foot.x-.034,foot.y-.04],[foot.x+.040,foot.y-.038]],'#acaa8e',.012);
    }
    robePanel(ctx,f.hip,f.feet[0],-1,mix(cloth,'#2c4136',.12),ink,f.width);
    robePanel(ctx,f.hip,f.feet[1],1,cloth,ink,f.width);
  }
  // A shaped shoulder/chest/waist and separately hanging skirt panels replace the old triangle.
  const sh=f.shoulder,hip=f.hip,w=f.width;
  shape(ctx,p=>{
    p.moveTo(sh.x-.19*w,sh.y+.025);p.quadraticCurveTo(sh.x-.08,sh.y-.068,sh.x+.012,sh.y-.065);
    p.quadraticCurveTo(sh.x+.13,sh.y-.058,sh.x+.192*w,sh.y+.03);
    p.lineTo(hip.x+.153*w,hip.y+.075);p.quadraticCurveTo(hip.x,hip.y+.11,hip.x-.163*w,hip.y+.07);
    p.quadraticCurveTo(sh.x-.19,sh.y+.24,sh.x-.19*w,sh.y+.025);
  },clothGradient(ctx,sh.x-.21,sh.y,.43,.46,cloth),ink);
  // Neck remains attached in bent and seated actions.
  shape(ctx,p=>{p.moveTo(f.head.x-.052,f.head.y+.12);p.lineTo(f.head.x+.052,f.head.y+.115);p.lineTo(sh.x+.075,sh.y+.017);p.lineTo(sh.x-.067,sh.y+.014);},palette.skin);
  if(!f.back){
    shape(ctx,p=>{p.moveTo(sh.x-.065,sh.y-.04);p.lineTo(sh.x+.078,sh.y+.05);p.lineTo(hip.x-.11,hip.y+.015);p.lineTo(hip.x-.15,hip.y-.02);p.lineTo(sh.x+.021,sh.y+.043);p.lineTo(sh.x-.09,sh.y-.019);},trim,ink,.009);
    line(ctx,[[sh.x+.067,sh.y-.02],[sh.x+.016,sh.y+.044]],mix(trim,'#faf0d0',.30),.028);
    line(ctx,[[sh.x+.135,sh.y+.115],[hip.x+.11,hip.y-.09]],mix(cloth,'#263f33',.23),.012);
    line(ctx,[[sh.x-.13,sh.y+.11],[hip.x-.10,hip.y-.08]],mix(cloth,'#eee2bd',.22),.012);
  }else{
    line(ctx,[[sh.x,sh.y+.04],[hip.x+.013,hip.y-.045]],mix(cloth,'#263f33',.25),.014);
    line(ctx,[[sh.x-.10,sh.y+.05],[sh.x+.10,sh.y+.05]],mix(trim,'#6e7c68',.45),.018);
  }
  // Workwear silhouette and practical waist layers remain consistent with the saved outfit.
  if(r.outfit==='artisan'){
    shape(ctx,p=>{p.moveTo(sh.x-.10,sh.y+.10);p.lineTo(sh.x+.11,sh.y+.11);p.lineTo(hip.x+.18,hip.y+.44);p.quadraticCurveTo(hip.x,hip.y+.49,hip.x-.19,hip.y+.41);},clothGradient(ctx,-.2,sh.y,.4,.8,'#7c6650'),ink);
    line(ctx,[[sh.x-.075,sh.y-.025],[sh.x-.066,sh.y+.12]],'#bcac7e',.027);
    line(ctx,[[sh.x+.104,sh.y-.015],[sh.x+.083,sh.y+.13]],'#bcac7e',.027);
    line(ctx,[[hip.x-.10,hip.y+.12],[hip.x+.08,hip.y+.12],[hip.x+.073,hip.y+.24],[hip.x-.086,hip.y+.24]],'#b3a17b',.012);
  }
  shape(ctx,p=>{p.moveTo(hip.x-.172*w,hip.y-.032);p.quadraticCurveTo(hip.x,hip.y-.005,hip.x+.164*w,hip.y-.026);p.lineTo(hip.x+.17*w,hip.y+.048);p.quadraticCurveTo(hip.x,hip.y+.067,hip.x-.173*w,hip.y+.040);},mix(cloth,'#263d33',.46),ink);
  line(ctx,[[hip.x-.15*w,hip.y-.015],[hip.x+.15*w,hip.y-.009]],'#c3b68c',.015);
  shape(ctx,p=>{p.moveTo(hip.x+.044,hip.y+.016);p.lineTo(hip.x+.105,hip.y+.028);p.lineTo(hip.x+.135,hip.y+.30);p.lineTo(hip.x+.082,hip.y+.27);},mix(cloth,'#d9d5b1',.24),ink,.009);
  ellipse(ctx,hip.x+.075,hip.y+.018,.025,.032,'#bbab7e');
  if(robeId.includes('pulse')){
    line(ctx,[[sh.x-.115,sh.y+.15],[sh.x-.043,sh.y+.23],[sh.x-.098,sh.y+.29]],'#b7d2bf',.018);
    ellipse(ctx,sh.x-.053,sh.y+.23,.014,.018,'#dfe3bc');
  }
  if(f.mounts.accessory||f.mounts.belt||r.outfit==='herbalist')drawAccessoryAttachment(ctx,f.mounts.accessory||f.mounts.belt,hip,{herbalist:r.outfit==='herbalist'});
  drawFace(ctx,f,palette);
  sleeve(ctx,f.nearShoulder,f.nearElbow,f.nearHand,cloth,trim,palette.skin);
  if(!portrait){
    drawTool(ctx,f,palette);
    if(weapon&&['cast','hit'].includes(f.action)){
      const hand=f.nearHand;line(ctx,[[hand.x-.04,hand.y+.08],[hand.x+.26,hand.y-.57]],'#c5d1c0',.034);
      line(ctx,[[hand.x-.066,hand.y-.013],[hand.x+.079,hand.y+.039]],'#cab783',.024);
    }
    if(f.mounts.artifact||f.mounts.charm)drawArtifactAttachment(ctx,f.mounts.artifact||f.mounts.charm,f.farHand);
  }
  ctx.restore();return f;
}
