/** Authored fixed-view cutout joints. Sampling is independent of simulation. */
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const p=(x,y)=>({x,y});
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const rotate=(v,a)=>p(v.x*Math.cos(a)-v.y*Math.sin(a),v.x*Math.sin(a)+v.y*Math.cos(a));
function arm(shoulder,hand,handAngle,bend,palm=3.6){
 // Hand dimensions stay fixed. Only the two sleeve/bracer bones solve reach.
 const upper=24,lower=21,forward=p(Math.cos(handAngle),Math.sin(handAngle));
 let wrist=p(hand.x-forward.x*palm,hand.y-forward.y*palm),dx=wrist.x-shoulder.x,dy=wrist.y-shoulder.y,d=Math.hypot(dx,dy)||1;
 const reach=clamp(d,12.2,43.5);wrist=p(shoulder.x+dx*reach/d,shoulder.y+dy*reach/d);
 const elbow=joint(shoulder,wrist,upper,lower,bend);
 const foreAngle=Math.atan2(wrist.y-elbow.y,wrist.x-elbow.x),relative=wrap(foreAngle-handAngle),limited=Math.asin(clamp(Math.sin(relative),-Math.sin(Math.PI*70/180),Math.sin(Math.PI*70/180)));
 // Keep the authored elbow branch; a wrist limit moves the rigid forearm as a unit.
 // This continuous clamp cannot switch to the opposite elbow solution.
 wrist=p(elbow.x+Math.cos(handAngle+limited)*lower,elbow.y+Math.sin(handAngle+limited)*lower);
 return {wrist,elbow,hand:p(wrist.x+forward.x*palm,wrist.y+forward.y*palm),handAngle,wristBend:Math.abs(limited)};
}
function curve(keys,t){
 t=clamp(t);let a=keys[0],b=keys.at(-1);
 for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){a=keys[i-1];b=keys[i];break;}
 const u=smooth((t-a[0])/Math.max(.00001,b[0]-a[0]));return a.slice(1).map((v,i)=>mix(v,b[i+1],u));
}
function joint(a,b,upper,lower,bend=1){
 const dx=b.x-a.x,dy=b.y-a.y,d=clamp(Math.hypot(dx,dy),.01,upper+lower-.01),angle=Math.atan2(dy,dx);
 const offset=Math.acos(clamp((upper*upper+d*d-lower*lower)/(2*upper*d),-1,1))*bend;
 return p(a.x+Math.cos(angle+offset)*upper,a.y+Math.sin(angle+offset)*upper);
}
export function combatRigPose({action='idle',phase='idle',progress=0,facing='right',gait=0,moving=false,reaction='light',direction={x:1,y:0},contact=null}={}){
 const f=facing==='left'?-1:1,t=clamp(progress);let hipX=0,hipY=0,lean=0,grip=p(-20,-56),angle=2.04,free=p(20,-58),weight=0;
 let nearFoot=p(13,0),farFoot=p(-13,-2),walk=phase==='move'||moving;
 if(walk){
  const cycle=gait*Math.PI*2,advance=Math.sin(cycle)*12;
  nearFoot=p(10+advance,-Math.max(0,Math.cos(cycle))*7);farFoot=p(-10-advance,-2-Math.max(0,-Math.cos(cycle))*7);
  hipY=-Math.abs(Math.sin(cycle))*1.8;lean=f*3;grip=p(-20+advance*.13,-55+hipY);free=p(20-advance*.45,-58+Math.sin(cycle)*3);
 }
 if(action==='attack'&&['windup','release','recovery'].includes(phase)){
  let values;
  if(phase==='windup'){
   const keys=f>0?[[0,-20,-56,2.04,0,0],[.2,-30,-69,2.55,-3,-4],[.4,-30,-91,3.48,-6,-10],[.68,-10,-103,4.03,-7,-12],[.84,15,-95,5.1,0,0],[1,31,-65,Math.PI*2-.12,8,17]]:[[0,-20,-56,2.04,0,0],[.2,-30,-72,2.8,0,0],[.4,-16,-101,4.2,6,10],[.68,10,-101,5.39,7,12],[.84,-26,-96,4.44,0,0],[1,-50,-65,Math.PI+.12,-8,-17]];
   values=curve(keys,t);
  }
  else if(phase==='release')values=curve([[0,f>0?31:-50,-65,-.12,f*8,17*f],[.42,f>0?35:-52,-59,.38,f*10,19*f],[1,f>0?29:-46,-53,.78,f*8,15*f]],t);
  else values=curve([[0,f>0?29:-46,-53,.78,f*8,15*f],[.27,f>0?22:-39,-51,1.05,f*6,12*f],[.68,-7,-48,1.7,-f,-2*f],[1,-20,-56,2.04,0,0]],t);
  grip=p(values[0],values[1]);angle=values[2];
  if(f<0){angle=phase==='windup'?values[2]:phase==='release'?Math.PI-values[2]:curve([[0,Math.PI-.78],[.27,Math.PI-1.05],[.68,Math.PI-1.7],[1,2.04]],t)[0];}
  hipX=values[3];lean=values[4];hipY=phase==='windup'?Math.sin(t*Math.PI)*3+3*smooth((t-.68)/.32):phase==='release'?3:3*(1-t);
  const armLoad=phase==='windup'?smooth(t/.45):phase==='release'?1:1-smooth(t);
  free=p(mix(20,-f*25,armLoad),mix(-58,-65,armLoad)+Math.sin(t*Math.PI)*4*armLoad);
  const planted=phase==='windup'?smooth(t):phase==='release'?1:1-smooth(t);
  if(!walk){nearFoot=p(13+5*planted,f>0?0:-4*planted);farFoot=p(-13-5*planted,f<0?0:-4*planted);}weight=phase==='windup'?clamp((t-.65)/.35):phase==='release'?1-smooth(t):0;
 }
 if(action==='spell'&&['windup','release','recovery'].includes(phase)){
  const k=phase==='windup'?smooth(t):phase==='release'?1:1-smooth(t);
  const hand=phase==='windup'?curve([[0,f*20,-58],[.2,10,-65],[.6,12,-72],[.83,17,-75],[1,35,-79]],t):phase==='release'?curve([[0,35,-79],[.4,39,-81],[1,39,-81]],t):curve([[0,39,-81],[.55,17,-75],[1,f*20,-58]],t);
  free=p(f*hand[0],hand[1]);hipX=f*k*2;lean=f*k*3;grip=p(-20,-56+k*2);
 }
 if(action==='guard'||phase==='guard')free=p(f*9,-77),hipY=2;
 if(phase==='evade'){hipY=9*Math.sin((.2+.75*t)*Math.PI);lean=direction.x*10;free=p(f*15,-55);grip=p(-17,-47);nearFoot=p(23,-2);farFoot=p(-23,-4);}
 if(phase==='hit'){
  const recoil=Math.sin((.12+t*.88)*Math.PI)*(reaction==='heavy'?1:.55),push=clamp(direction.x,-1,1);
  hipX=push*5*recoil;hipY=4*recoil;lean=push*13*recoil;free=p(f*18,-60+recoil*5);grip=p(-20+push*8*recoil,-53+recoil*3);angle=2.04+push*.15*recoil;
  nearFoot=p(14+push*6*recoil,0);farFoot=p(-14,-1);
 }
 const hip=p(hipX,-43+hipY),shoulder=p(hipX+Math.sin(lean*Math.PI/180)*35,-79+hipY),swordShoulder=p(shoulder.x-9,shoulder.y+2),freeShoulder=p(shoulder.x+10,shoulder.y+1);
 if(action==='attack'&&['windup','release','recovery'].includes(phase)){
  const aim=Math.atan2(direction.y,direction.x),base=f<0?Math.PI:0,blend=phase==='windup'?smooth(t/.72):phase==='release'?1:1-smooth(t);
  const turn=clamp(wrap(aim-base),-Math.PI*.49,Math.PI*.49)*blend,r=rotate(p(grip.x-swordShoulder.x,grip.y-swordShoulder.y),turn);
  grip=p(swordShoulder.x+r.x,swordShoulder.y+r.y);angle+=turn;
  if(contact&&phase==='release'){
   const dx=contact.x-grip.x,dy=contact.y-grip.y,d=Math.hypot(dx,dy),follow=1-smooth(t);
   if(d<12){grip=p(mix(grip.x,contact.x,follow),mix(grip.y,contact.y,follow));}
   else{
    if(d>48){const shift=Math.min(14,d-48)*follow;grip=p(grip.x+dx/d*shift,grip.y+dy/d*shift);}
    const toward=Math.atan2(contact.y-grip.y,contact.x-grip.x);angle+=clamp(wrap(toward-angle),-.55,.55)*follow;
   }
  }
 }
 const gripVector=f<0?p(-7,57):p(7,53),sourceBlade=f<0?Math.atan2(148,-103):Math.atan2(119,-65),gripOffset=sourceBlade-Math.atan2(gripVector.y,gripVector.x);
 const swordArm=arm(swordShoulder,grip,angle-gripOffset,f,Math.hypot(gripVector.x,gripVector.y)*.09);grip=swordArm.hand;
 const restAngle=Math.atan2(-58-freeShoulder.y,20-freeShoulder.x),sealLoad=phase==='windup'?smooth(t/.25):phase==='recovery'?1-smooth((t-.7)/.3):1;
 const freeAngle=action==='spell'&&f<0?mix(restAngle,Math.PI,sealLoad):Math.atan2(free.y-freeShoulder.y,free.x-freeShoulder.x),freeArm=arm(freeShoulder,free,freeAngle,-1);free=freeArm.hand;
 const tip=p(grip.x+Math.cos(angle)*48,grip.y+Math.sin(angle)*48),seal=action==='spell'&&phase==='windup'&&t<.65,finger=seal?p(-.26,-5.98):rotate(p(-8.7,-2.25),freeArm.handAngle-Math.PI),castFinger=p(freeArm.wrist.x+finger.x,freeArm.wrist.y+finger.y);
 return {hip,lean,nearFoot,farFoot,nearKnee:joint(p(hip.x+6,hip.y),nearFoot,25,25,-1),farKnee:joint(p(hip.x-6,hip.y),farFoot,25,25,1),swordShoulder,freeShoulder,swordElbow:swordArm.elbow,freeElbow:freeArm.elbow,swordWrist:swordArm.wrist,freeWrist:freeArm.wrist,swordHandAngle:swordArm.handAngle,freeHandAngle:freeArm.handAngle,wristBend:swordArm.wristBend,grip,tip,hand:free,castFinger,weight,facing,phase,action,progress:t};
}

function cut(image,crop,makeCanvas,polygon=null){const [x,y,w,h]=crop,c=makeCanvas(w,h),ctx=c.getContext('2d');if(polygon){ctx.beginPath();polygon.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();}ctx.drawImage(image,x,y,w,h,0,0,w,h);return c;}
function erase(ctx,points){ctx.save();ctx.globalCompositeOperation='destination-out';ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();ctx.restore();}
function bonePart(image,a,b,makeCanvas,before=0,after=0){
 const d=Math.hypot(b.x-a.x,b.y-a.y),dx=(b.x-a.x)/d,dy=(b.y-a.y)/d,n=p(-dy*image.width,dx*image.width),start=p(a.x-dx*before,a.y-dy*before),end=p(b.x+dx*after,b.y+dy*after);
 return cut(image,[0,0,image.width,image.height],makeCanvas,[[start.x+n.x,start.y+n.y],[end.x+n.x,end.y+n.y],[end.x-n.x,end.y-n.y],[start.x-n.x,start.y-n.y]]);
}
function rigidPart(ctx,image,anchor,at,scale,angle=0){ctx.save();ctx.translate(at.x,at.y);ctx.rotate(angle);ctx.drawImage(image,-anchor.x*scale,-anchor.y*scale,image.width*scale,image.height*scale);ctx.restore();}
function segment(ctx,image,a,b,u,v,lower,split,width=1){
 const x=b.x-a.x,y=b.y-a.y,dx=v.x-u.x,dy=v.y-u.y,den=x*x+y*y,aa=(dx*x+width*dy*y)/den,bb=(dy*x-width*dx*y)/den,cc=(dx*y-width*dy*x)/den,dd=(dy*y+width*dx*x)/den;
 ctx.save();ctx.transform(aa,bb,cc,dd,u.x-aa*a.x-cc*a.y,u.y-bb*a.x-dd*a.y);
 ctx.beginPath();ctx.rect(-10,lower?split-14:-10,image.width+20,lower?image.height-split+24:split+24);ctx.clip();ctx.drawImage(image,0,0);ctx.restore();
}
export function createCombatRig({images,makeCanvas}){
 const body={},skirts={},swords={},limbs={},arms={},memo=new Map();
 const pointHand=images.leftSpell?cut(images.leftSpell,[516,272,130,72],makeCanvas):null;
 const sealHand=cut(images.leftActions,[260,618,48,63],makeCanvas);
 for(const facing of ['right','left']){
  const right=facing==='right',crop=right?[70,660,218,335]:[0,0,490,512],im=right?images.person:images.leftActions;
  body[facing]=cut(im,crop,makeCanvas);const c=body[facing].getContext('2d');
  if(right){erase(c,[[0,150],[60,90],[112,94],[104,165],[83,202],[0,335]]);erase(c,[[165,94],[218,98],[218,195],[177,183],[151,133]]);erase(c,[[0,297],[218,297],[218,335],[0,335]]);}
  else {erase(c,[[0,210],[150,137],[224,150],[208,254],[160,330],[0,512]]);erase(c,[[300,154],[386,180],[390,317],[330,302],[283,204]]);erase(c,[[0,423],[490,423],[490,512],[0,512]]);}
  const belt=right?174:237;skirts[facing]=cut(body[facing],[0,0,crop[2],crop[3]],makeCanvas,[[0,belt-6],[crop[2],belt-6],[crop[2],crop[3]],[0,crop[3]]]);erase(c,[[0,belt+6],[crop[2],belt+6],[crop[2],crop[3]],[0,crop[3]]]);
  swords[facing]=cut(im,crop,makeCanvas,right?[[42,190],[55,176],[82,179],[86,196],[70,208],[26,290],[19,305],[0,310],[0,275],[35,205]]:[[114,297],[151,276],[178,293],[161,326],[60,453],[35,456],[95,354]]);
  // The identity atlas includes a gripping palm; replace that area once, retaining the guard.
  erase(swords[facing].getContext('2d'),right?[[58,168],[83,168],[88,181],[79,191],[58,191]]:[[138,275],[178,275],[178,302],[148,302],[138,294]]);
  const row=right?0:1,cw=images.rigLimbs.width/4,ch=images.rigLimbs.height/2;
  limbs[facing]=Array.from({length:4},(_,col)=>cut(images.rigLimbs,[Math.floor(col*cw),Math.floor(row*ch),Math.floor(cw),Math.floor(ch)],makeCanvas));
 }
 const source={right:{arm:[p(245,105),p(208,250),p(188,382)],free:[p(176,110),p(265,246),p(339,354)],leg:[p(257,52),p(270,222),p(307,381)],far:[p(220,54),p(230,222),p(247,382)]},left:{arm:[p(235,105),p(305,250),p(323,377)],free:[p(235,105),p(190,237),p(132,350)],leg:[p(273,54),p(237,222),p(215,375)],far:[p(260,54),p(230,222),p(208,382)]}};
 const wrists={right:{arm:p(181,329),free:p(320,310)},left:{arm:p(330,320),free:p(145,302)}};
 for(const f of ['right','left']){
  arms[f]={};for(const [name,index] of [['arm',0],['free',1]]){
   const [a,b,hand]=source[f][name],wrist=wrists[f][name],im=limbs[f][index];
   arms[f][name]={upper:bonePart(im,a,b,makeCanvas,12,14),lower:bonePart(im,b,wrist,makeCanvas,14,3),palm:bonePart(im,wrist,hand,makeCanvas,3,80),wrist,hand,handAngle:Math.atan2(hand.y-wrist.y,hand.x-wrist.x)};
  }
 }
 function drawLegs(ctx,pose,height=111){const f=pose.facing,h=height/111,parts=limbs[f],j=source[f];ctx.save();ctx.scale(h,h);
  const leg=(index,a,knee,foot,s)=>{segment(ctx,parts[index],s[0],s[1],a,knee,false,s[1].y);segment(ctx,parts[index],s[1],s[2],knee,foot,true,s[1].y);};
  leg(3,p(pose.hip.x-6,pose.hip.y),pose.farKnee,pose.farFoot,j.far);leg(2,p(pose.hip.x+6,pose.hip.y),pose.nearKnee,pose.nearFoot,j.leg);
  ctx.restore();}
 function drawRaw(ctx,pose,height=111){
  const f=pose.facing,right=f==='right',h=height/111,parts=limbs[f],j=source[f];drawLegs(ctx,pose,height);ctx.save();ctx.scale(h,h);
  const spellLeft=f==='left'&&pose.action==='spell',free=arms[f].free,sword=arms[f].arm;
  const drawArm=(part,name,shoulder,elbow,wrist)=>{segment(ctx,part.upper,j[name][0],j[name][1],shoulder,elbow,false,1000,.75);segment(ctx,part.lower,j[name][1],part.wrist,elbow,wrist,false,1000,.55);};
  const drawFree=()=>{drawArm(free,'free',pose.freeShoulder,pose.freeElbow,pose.freeWrist);
   if(spellLeft){const seal=pose.phase==='windup'&&pose.progress<.65,hand=seal?sealHand:pointHand;if(hand)rigidPart(ctx,hand,seal?p(22,50):p(123,43),pose.freeWrist,seal?.13:.075,seal?0:pose.freeHandAngle-Math.PI);}
   else rigidPart(ctx,free.palm,free.wrist,pose.freeWrist,.082,pose.freeHandAngle-free.handAngle);
  };
  if(!spellLeft)drawFree();
  const scale=111/(right?323:449),foot=right?p(134,329):p(265,480);
  for(const [layer,rotation] of [[skirts[f],pose.lean*.23],[body[f],pose.lean]]){ctx.save();ctx.translate(pose.hip.x,pose.hip.y);ctx.rotate(rotation*Math.PI/180);ctx.drawImage(layer,-foot.x*scale,-foot.y*scale+43,layer.width*scale,layer.height*scale);ctx.restore();}
  if(spellLeft)drawFree();
  drawArm(sword,'arm',pose.swordShoulder,pose.swordElbow,pose.swordWrist);
  const a=right?p(68,181):p(148,298),b=right?p(3,300):p(45,446);segment(ctx,swords[f],a,b,pose.grip,pose.tip,false,1000);
  // Palm covers the hilt and rotates with it; its scale never follows bone reach.
  rigidPart(ctx,sword.palm,sword.hand,pose.grip,.09,pose.swordHandAngle-sword.handAngle);ctx.restore();
 }
 const pixelLimit=40*1024*1024;
 let hits=0,misses=0,pixelBytes=0;
 function quantize(sample){const steps=sample.phase==='recovery'?9:sample.phase==='windup'?12:sample.phase==='release'?6:10,moving=sample.phase==='move'||!!sample.moving,reacting=sample.phase==='hit'||sample.phase==='evade',aimed=sample.action==='attack',angle=Math.round(Math.atan2(sample.direction?.y||0,sample.direction?.x||(sample.facing==='left'?-1:1))/(Math.PI/16))*(Math.PI/16);return {action:sample.action,phase:sample.phase,progress:['idle','move','guard'].includes(sample.phase)?0:Math.round(clamp(sample.progress)*steps)/steps,facing:sample.facing,gait:moving?Math.floor(((sample.gait||0)%1)*12)/12:0,moving:!!sample.moving,reaction:sample.reaction||'light',direction:{x:aimed?Math.cos(angle):reacting?Math.round((sample.direction?.x||0)*4)/4:0,y:aimed?Math.sin(angle):reacting?Math.round((sample.direction?.y||0)*4)/4:0},contact:sample.contact?{x:Math.round(sample.contact.x),y:Math.round(sample.contact.y)}:null};}
 function image(raw){
  const sample=quantize(raw),key=JSON.stringify(sample);if(memo.has(key)){hits++;return memo.get(key);}misses++;
  const pose=combatRigPose(sample);let left=pose.hip.x-70,right=pose.hip.x+70,top=pose.hip.y-84,bottom=pose.hip.y+55;
  const include=(q,r)=>{left=Math.min(left,q.x-r);right=Math.max(right,q.x+r);top=Math.min(top,q.y-r);bottom=Math.max(bottom,q.y+r);};
  for(const key of ['swordShoulder','freeShoulder','swordElbow','freeElbow','swordWrist','freeWrist','hand'])include(pose[key],20);
  include(pose.nearFoot,12);include(pose.farFoot,12);include(pose.grip,10);include(pose.tip,8);
  left=Math.floor(left*2);right=Math.ceil(right*2);top=Math.floor(top*2);bottom=Math.ceil(bottom*2);
  // Bounds come from the authored body and rigid joints. No per-frame GPU readback.
  const canvas=makeCanvas(right-left+1,bottom-top+1),ctx=canvas.getContext('2d');ctx.translate(-left,-top);ctx.imageSmoothingEnabled=false;drawRaw(ctx,pose,222);
  const value={canvas,origin:p(-left,-top),nominalHeight:222,pose,sample,pixelBytes:canvas.width*canvas.height*4};memo.set(key,value);pixelBytes+=value.pixelBytes;
  while(memo.size>96||pixelBytes>pixelLimit){const first=memo.keys().next().value;pixelBytes-=memo.get(first).pixelBytes;memo.delete(first);}
  return value;
 }
 async function prewarm(){const cases=[];for(const facing of ['right','left']){cases.push({action:'idle',phase:'idle',facing,progress:0});for(let i=0;i<12;i++)cases.push({action:'move',phase:'move',facing,gait:i/12,progress:0});for(const phase of ['windup','release','recovery']){const steps=phase==='windup'?12:phase==='recovery'?9:6;for(let i=0;i<=steps;i++)cases.push({action:'attack',phase,facing,progress:i/steps});}}for(let i=0;i<cases.length;i++){image(cases[i]);if(i%4===3)await new Promise(resolve=>setTimeout(resolve,0));}}
 return {drawRaw,drawLegs,image,pose:combatRigPose,quantize,prewarm,cacheStats:()=>({entries:memo.size,limit:96,pixelBytes,pixelLimit,hits,misses})};
}
