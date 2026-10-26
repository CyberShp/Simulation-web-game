/** Read-only combat effects. Every pose and particle is sampled from world ticks. */
import {combatActorHeight} from './courtyard-combat-dimensions.mjs';
import {usesCombatCamera} from './courtyard-combat-camera.mjs';
import {isSwordStudy} from './courtyard-combat-sword-study.mjs';
import {createSwordStudyEffects} from './courtyard-combat-sword-study-effects.mjs';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const TAU=Math.PI*2;
const palette={ink:'#244b44',wind:'#82c7b7',light:'#d5efcf',white:'#f5f3d6',gold:'#edc58d',earth:'#a47d54',dark:'#3e3029'};
const actors=b=>[b.player,...(b.allies||[]),...(b.enemies||[])].filter(Boolean);
const actorFor=(b,id)=>actors(b).find(a=>a.id===id||a.personId===id);
const hash=value=>{let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const noise=(seed,i)=>{let n=(seed+Math.imul(i+1,374761393))|0;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};
const ageOf=(f,tick)=>Math.max(0,Number.isFinite(f.tick)&&Number.isFinite(tick)?(tick-f.tick)/10:(f.total||.75)-(f.remaining??f.total??.75));
const lifeOf=(f,tick)=>Number.isFinite(f.tick)&&tick<f.tick?0:clamp(1-ageOf(f,tick)/(f.total||.75),0,1);

/** Blade samples come from the same authored motion that draws the weapon. */
export function combatSwordRibbon(presentation){
 const weight=clamp(presentation?.swingWeight||0,0,1),trail=presentation?.swordTrail||[];
 if(!weight)return [];
 const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y),sections=[];
 for(let i=1;i<trail.length;i++){
  const a=trail[i-1],z=trail[i];if(!valid(a.grip)||!valid(a.tip)||!valid(z.grip)||!valid(z.tip))continue;
  if(Math.hypot(z.tip.x-a.tip.x,z.tip.y-a.tip.y)<.2)continue;
  const inner=p=>({x:p.grip.x+(p.tip.x-p.grip.x)*.72,y:p.grip.y+(p.tip.y-p.grip.y)*.72});
  const freshness=clamp(z.alpha??i/(trail.length-1),0,1);
  sections.push({points:[inner(a),a.tip,z.tip,inner(z)],edge:[a.tip,z.tip],alpha:weight*freshness*freshness});
 }
 return sections;
}

/**
 * All coordinates are CSS pixels, matching the actor renderer's canvas transform.
 * getActorPresentation(actor,battle,tick) may supply {height,hand,releaseHand}.
 * Hand points use screen coordinates; releaseHand samples the fixed release pose.
 * Draw order: ground -> each actor and its overlay -> projectiles -> foreground.
 * Repeated draws, snapshot replay and pauses have no mutable effect state.
 */
export function createCombatEffectsRenderer({ctx,worldToScreen,getTransform,getActorPresentation}){
 const study=createSwordStudyEffects({ctx,worldToScreen,getTransform,getActorPresentation});
 const metrics=(actor,b,tick)=>{
  const custom=getActorPresentation?.(actor,b,tick)||{},height=custom.height||combatActorHeight(getTransform()),foot=custom.foot||worldToScreen(actor.x,actor.y);
  const direction=screenDirection(actor.motion?.direction||actor.facing||{x:1,y:0});
  return {...custom,height,foot,hand:custom.hand||{x:foot.x+direction.x*height*.26,y:foot.y-height*.56+direction.y*height*.12},releaseHand:custom.releaseHand||{x:foot.x+direction.x*height*.48,y:foot.y-height*.8+direction.y*height*.12}};
 };
 function screenDirection(d){const t=getTransform(),x=(d?.x??1)*t.sx,y=(d?.y??0)*t.sy,length=Math.hypot(x,y);return length>1e-8?{x:x/length,y:y/length}:{x:1,y:0};}
 function eventDirection(f){return screenDirection(f.direction||{x:(f.to?.x??0)-(f.from?.x??0),y:(f.to?.y??0)-(f.from?.y??0)});}
 function eventPoint(f,b,tick){
  const at=f.contact||f.to||f.from,p=worldToScreen(at.x,at.y),actor=actorFor(b,f.targetId)||b.player;
  const height=metrics(actor,b,tick).height;
  return {x:p.x,y:p.y-(f.contactHeight??.9)*height/1.8};
 }
 function dot(x,y,size,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x-size/2),Math.round(y-size/2),size,size);}
 // Axis-aligned pixels keep curves crisp at the same density as the figures.
 function line(a,b,color,width=1){
  let x=Math.round(a.x),y=Math.round(a.y);const endX=Math.round(b.x),endY=Math.round(b.y),dx=Math.abs(endX-x),dy=-Math.abs(endY-y),sx=x<endX?1:-1,sy=y<endY?1:-1;let error=dx+dy;
  ctx.fillStyle=color;
  for(;;){ctx.fillRect(x-Math.floor(width/2),y-Math.floor(width/2),width,width);if(x===endX&&y===endY)break;const e=error*2;if(e>=dy){error+=dy;x+=sx;}if(e<=dx){error+=dx;y+=sy;}}
 }
 function path(points,color,width=1){for(let i=1;i<points.length;i++)line(points[i-1],points[i],color,width);}
 function arc(p,rx,ry,start,end,color,width=1){
  const count=Math.max(6,Math.ceil(Math.abs(end-start)*Math.max(rx,ry)/5)),points=[];
  for(let i=0;i<=count;i++){const t=start+(end-start)*i/count;points.push({x:p.x+Math.cos(t)*rx,y:p.y+Math.sin(t)*ry});}path(points,color,width);
 }
 function outline(points,color,width=1,ink=palette.ink){path(points,ink,width+2);path(points,color,width);}
 function local(p,d,x,y){return {x:p.x+d.x*x-d.y*y,y:p.y+d.y*x+d.x*y};}
 function label(value,x,y,{color=palette.white,size=20,alpha=1}={}){
  ctx.save();ctx.globalAlpha*=alpha;ctx.font=`600 ${size}px Georgia, "Noto Serif CJK SC", serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=3;ctx.strokeStyle='#20372e';ctx.strokeText(value,Math.round(x),Math.round(y));ctx.fillStyle=color;ctx.fillText(value,Math.round(x),Math.round(y));ctx.restore();
 }
 function dust(p,seed,age,{strength=1,direction=null}={}){
  if(age>.65)return;const t=age/.65;
  ctx.save();ctx.globalAlpha*=Math.pow(1-t,1.4)*.8;
  for(let i=0;i<12;i++){
   const angle=noise(seed,i)*TAU,speed=(10+noise(seed,i+20)*28)*strength;
   const x=p.x+Math.cos(angle)*speed*Math.sqrt(t)+(direction?.x||0)*t*12,y=p.y+Math.sin(angle)*speed*.32*Math.sqrt(t)-Math.sin(t*Math.PI)*(3+noise(seed,i+40)*6);
   const size=i%3===0?3:2;dot(x,y+1,size+1,palette.earth);dot(x,y,size,i%2?'#d6b58a':'#eee0bc');
  }ctx.restore();
 }
 function shield(actor,b,tick,front){
  if(!(actor.guard>0))return;
  const {height:h,foot}=metrics(actor,b,tick),activation=(b.effects||[]).findLast(f=>f.kind==='guard'&&(f.sourceId===actor.id||f.targetId===actor.id));
  const rise=activation?clamp((ageOf(activation,tick)+.1)/.35,0,1):1,fade=clamp(actor.guard/.3,0,1),p={x:foot.x,y:foot.y-h*.49},rx=h*.4,ry=h*.57;
  ctx.save();ctx.globalAlpha*=fade;
  if(!front){
   ctx.save();ctx.beginPath();ctx.rect(p.x-rx-4,foot.y-h*rise*1.08,rx*2+8,h*1.2);ctx.clip();
   ctx.globalAlpha*=.075;ctx.fillStyle=palette.wind;ctx.beginPath();ctx.ellipse(p.x,p.y,rx,ry,0,0,TAU);ctx.fill();
   ctx.globalAlpha=fade*.55;arc(p,rx,ry,Math.PI,TAU,palette.ink,3);arc(p,rx,ry,Math.PI,TAU,palette.wind,1);ctx.restore();
  }else{
   // Side rims describe the shell; clear front space preserves face and hand detail.
   ctx.save();ctx.beginPath();ctx.rect(p.x-rx-4,foot.y-h*rise*1.08,rx*2+8,h*1.2);ctx.clip();
   for(const [a,z] of [[-.35,.96],[2.18,3.49]]){arc(p,rx,ry,a,z,palette.ink,3);arc(p,rx,ry,a,z,palette.light,1);}
   arc(p,rx,ry,4.14,4.92,palette.light,1);
   ctx.globalAlpha*=.5;arc(p,rx-3,ry-2,2.18,2.95,palette.wind,1);arc(p,rx-3,ry-2,-.18,.5,palette.wind,1);
   ctx.restore();
   const band={x:p.x,y:foot.y-h*rise*1.04};if(rise<1){arc(band,rx*Math.sqrt(Math.max(.05,1-(1-rise*2)**2)),h*.06,0,TAU,palette.light,1);}
   ctx.globalAlpha*=.35;arc({x:foot.x,y:foot.y+1},h*.34,h*.085,0,Math.PI,palette.wind,1);
  }ctx.restore();
 }
 function warning(enemy,b,tick){
  const w=enemy.telegraph;if(!w)return;
  const p=worldToScreen(w.x,w.y),t=getTransform(),rx=w.radius*t.sx,ry=w.radius*t.sy,newField=usesCombatCamera(b),preview=newField?Math.max(0,tick-(b.worldTick??b.tick))*.1:0,progress=clamp(1-Math.max(0,w.remaining-preview)/w.total,0,1);
  ctx.save();ctx.fillStyle=progress>.7?'#a54e3433':'#9b5c3821';ctx.beginPath();ctx.ellipse(p.x,p.y,rx,ry,0,0,TAU);ctx.fill();
  if(newField){
   const fill=Math.sqrt(progress);ctx.fillStyle=progress>.8?'#cf6d485c':'#b9633d3a';ctx.beginPath();ctx.ellipse(p.x,p.y,rx*fill,ry*fill,0,0,TAU);ctx.fill();
   arc(p,Math.max(2,rx*(1-progress)),Math.max(2,ry*(1-progress)),0,TAU,'#ffe1a2',2);
  }
  arc(p,rx,ry,0,TAU,'#62432d',3);arc(p,rx,ry,0,TAU,'#dfaa74',1);
  const length=progress*Math.PI;
  for(const start of [-Math.PI/2,Math.PI/2])arc(p,rx-3,Math.max(2,ry-2),start,start+length,'#ffe1a2',2);
  for(let i=0;i<8;i++){const a=i*TAU/8;line({x:p.x+Math.cos(a)*(rx+3),y:p.y+Math.sin(a)*(ry+2)},{x:p.x+Math.cos(a)*(rx+6),y:p.y+Math.sin(a)*(ry+4)},'#dbb17b',1);}
  label(w.kind||'抬臂落击',p.x,p.y+ry+14,{size:12,color:'#ffe2b2'});ctx.restore();
 }
 function charge(actor,b,tick){
  const m=actor.motion;if(m?.phase!=='windup'||!['spell','guard'].includes(m.action))return;
  const {height:h,hand,sample}=metrics(actor,b,tick),progress=sample?.progress??clamp((tick-m.phaseStartedTick)/Math.max(1,m.phaseDurationTicks||4),0,1),seed=hash(m.actionId||actor.id);
  ctx.save();ctx.globalAlpha*=.3+progress*.7;
  for(let i=0;i<3;i++){
   const radius=(1-progress)*h*.16+5,angle=(noise(seed,i)*TAU)+(m.phaseProgressTicks||0)*.28;
   arc(hand,radius,radius*.6,angle,angle+.95,palette.ink,3);arc(hand,radius,radius*.6,angle,angle+.95,palette.wind,1);
  }
  dot(hand.x,hand.y,3,palette.ink);dot(hand.x,hand.y,1+Math.round(progress),palette.light);ctx.restore();
 }
 function sword(actor,b,tick){
  const sections=combatSwordRibbon(metrics(actor,b,tick));
  ctx.save();
  for(const section of sections){
   ctx.globalAlpha=section.alpha*.12;ctx.fillStyle=palette.gold;ctx.beginPath();ctx.moveTo(section.points[0].x,section.points[0].y);
   for(const point of section.points.slice(1))ctx.lineTo(point.x,point.y);ctx.closePath();ctx.fill();
   ctx.globalAlpha=section.alpha*.32;path(section.edge,palette.gold,section.alpha>.55?2:1);
   ctx.globalAlpha=section.alpha*.66;path(section.edge,palette.white,1);
  }ctx.restore();
 }
 function swordFlight(shot,b,tick){
  if(tick<shot.launchedTick)return;
  const owner=actorFor(b,shot.sourceId)||b.player,direction=shot.direction;
  // Read the shot's authored sword-release anchors even after its owner moves
  // or starts another action. This does not replace the visible body motion.
  const releaseOwner={...owner,motion:{...owner.motion,action:'attack',phase:'release',direction,moveIntent:{x:0,y:0},movementLocked:true,executeAtTick:shot.launchedTick,phaseStartedTick:shot.launchedTick,phaseDurationTicks:1,phaseProgressTicks:0}};
  const m=metrics(releaseOwner,b,tick),anchor=m.swordTip||m.swordGrip||m.hand,h=m.height,at=worldToScreen(shot.x,shot.y),d=screenDirection(direction),elapsed=Math.max(0,tick-shot.launchedTick),release=1-clamp(elapsed/2,0,1),size=h/111;
  const p={x:at.x+(anchor.x-m.foot.x)*release,y:at.y-h*.5+(anchor.y-m.foot.y+h*.5)*release},travel=Math.hypot((shot.x-shot.from.x)*getTransform().sx,(shot.y-shot.from.y)*getTransform().sy),length=Math.min(70,42+travel)*size;
  ctx.save();ctx.globalAlpha=.2;path([local(p,d,-length,0),local(p,d,10*size,0)],palette.wind,Math.max(3,Math.round(10*size)));
  ctx.globalAlpha=.9;outline([local(p,d,-length,0),local(p,d,-8*size,-4*size),local(p,d,12*size,0),local(p,d,-8*size,4*size),local(p,d,-length,0)],palette.light,1);
  path([local(p,d,-length+8*size,0),local(p,d,10*size,0)],palette.white,Math.max(1,Math.round(2*size)));ctx.restore();
 }
 function flight(shot,b,tick){
  if(shot.kind==='sword-qi')return swordFlight(shot,b,tick);
  if(tick<shot.launchedTick)return;
  const owner=actorFor(b,shot.sourceId)||b.player,direction=shot.direction||{x:shot.x-shot.from.x,y:shot.y-shot.from.y};
  // The launch pose belongs to this shot, even after its owner turns or dodges.
  const releaseOwner={...owner,motion:{...owner.motion,direction}},m=metrics(releaseOwner,b,tick),h=m.height,at=worldToScreen(shot.x,shot.y),d=screenDirection(direction),seed=hash(shot.id),elapsed=Math.max(0,tick-shot.launchedTick),size=h/111;
  // A short release transition joins the hand to the projectile's body-height
  // plane. Its offset is zero after two world steps; contacts use formal points.
  const release=1-clamp(elapsed/2,0,1),p={x:at.x+(m.releaseHand.x-m.foot.x)*release,y:at.y-h*.5+(m.releaseHand.y-m.foot.y+h*.5)*release};
  const travel=Math.hypot((shot.x-shot.from.x)*getTransform().sx,(shot.y-shot.from.y)*getTransform().sy),tail=Math.min(46*size,travel+8);
  ctx.save();
  for(let strand=0;strand<3;strand++){
   const side=strand-1,points=[];
   for(let i=0;i<=12;i++){const f=i/12,x=-tail*(1-f),y=(side*7+Math.sin(f*Math.PI*1.6+elapsed*.7+noise(seed,strand))*3)*(1-f)*size;points.push(local(p,d,x,y));}
   ctx.globalAlpha=.4+strand*.2;outline(points,strand===1?palette.light:palette.wind,1);
  }
  ctx.globalAlpha=1;
  const crescent=[];for(let i=0;i<=16;i++){const a=-1.15+i/16*2.3;crescent.push(local(p,d,-9*size+Math.cos(a)*9*size,Math.sin(a)*11*size));}
  outline(crescent,palette.wind,3);path(crescent,palette.light,1);
  outline([local(p,d,-13*size,0),local(p,d,1,0)],palette.white,2);
  for(let i=0;i<3;i++){const x=-tail*(.35+noise(seed,i+8)*.6),y=(noise(seed,i+16)-.5)*13*size,q=local(p,d,x,y);dot(q.x,q.y,1,palette.light);}
  ctx.restore();
 }
 function impact(f,b,tick){
  const age=ageOf(f,tick),life=lifeOf(f,tick);if(life<=0)return;
  const coreAge=Number.isFinite(f.feedbackAgeMs)?Math.max(0,f.feedbackAgeMs)/1000:age;
  let p=eventPoint(f,b,tick);const d=eventDirection(f),seed=hash(f.eventId??f.id),outcome=f.outcome||'hit';
  ctx.save();
  if(outcome==='evaded'){
   if(age<.35){ctx.globalAlpha=(1-age/.35)*.7;for(let i=0;i<3;i++){const q=local(p,d,age*32-10,(i-1)*6);outline([local(q,d,-12,0),q],palette.wind,1);}}
  }else if(outcome==='guarded'){
   if(age<.5){const t=age/.5;ctx.globalAlpha=1-t;
    const target=actorFor(b,f.targetId);if(target){const m=metrics(target,b,tick),rx=m.height*.4,ry=m.height*.57,r=1/Math.sqrt(d.x*d.x/(rx*rx)+d.y*d.y/(ry*ry));p={x:m.foot.x-d.x*r,y:m.foot.y-m.height*.49-d.y*r};}
    // A local crescent on the struck shell, oriented across the incoming force.
    for(let layer=0;layer<2;layer++){const points=[];for(let i=0;i<=12;i++){const a=-1.2+i/12*2.4;points.push(local(p,d,-Math.cos(a)*(4+t*10+layer*5),Math.sin(a)*(8+t*19+layer*3)));}outline(points,layer?palette.wind:palette.light,1);}
    for(let i=0;i<6;i++){const side=i%2?1:-1,q=local(p,d,-4-t*(8+noise(seed,i)*15),side*(4+t*(8+noise(seed,i+9)*18)));dot(q.x,q.y,2,palette.light);}
   }
  }else if(f.amount>0&&outcome==='hit'&&(age<.4||coreAge<.09)){
   const t=clamp(age/.4,0,1),heavy=f.reaction==='heavy'||f.reaction==='down',reach=heavy?30:22;
   ctx.globalAlpha=1-t;
   if(coreAge<.09){
    // One compressed contact shape precedes the fragments leaving along force.
    const size=heavy?1.25:1,compression=1-coreAge/.09;
    const cross=[local(p,d,-5*size,-13*size),local(p,d,5*size,13*size)],counter=[local(p,d,-10*size,4*size),local(p,d,10*size,-4*size)];
    ctx.globalAlpha=.6+.4*compression;outline(cross,palette.white,2,palette.dark);outline(counter,palette.gold,2,palette.dark);
    dot(p.x,p.y,7*size,palette.gold);dot(p.x,p.y,3,palette.white);
   }
   if(age<.4)for(let i=0;i<6;i++){
    const angle=(noise(seed,i)-.5)*4.3,dist=(8+noise(seed,i+12)*reach)*Math.sqrt(t),q=local(p,d,Math.cos(angle)*dist,Math.sin(angle)*dist*.72),z=local(p,d,Math.cos(angle)*(dist+3*(1-t)),Math.sin(angle)*(dist+3*(1-t))*.72);
    line(q,z,palette.dark,3);line(q,z,i%3?palette.gold:palette.white,1);
   }
  }
  ctx.restore();
 }
 function hitLabel(f,b,tick,index){
  const age=ageOf(f,tick),life=lifeOf(f,tick);if(life<=0)return;
  const target=actorFor(b,f.targetId)||b.player,h=metrics(target,b,tick).height,at=f.to||f.contact,p=worldToScreen(at.x,at.y),d=eventDirection(f);
  const rise=18*Math.min(1,age/.45),x=p.x+d.x*15+(index%3-1)*17,y=p.y-h-29-rise-Math.floor(index/3)*22;
  const alpha=clamp(life*3,0,1),outcome=f.outcome||'hit';
  if(outcome==='evaded'){label('闪避',x,y,{size:14,color:palette.light,alpha});return;}
  label('−'+Math.round(f.amount||0),x,y,{size:f.reaction==='heavy'||f.reaction==='down'?23:20,color:target===b.player?'#ffd0ab':palette.white,alpha});
  if(outcome==='guarded')label('护持',x,y-21,{size:12,color:palette.light,alpha});
 }
 function miss(f,b,tick){
  const age=ageOf(f,tick);if(age>.35)return;
  const source=actorFor(b,f.sourceId);if(source?.entityKind==='beast'&&!f.projectileId)return;
  const p=eventPoint({...f,contactHeight:.9},b,tick),d=eventDirection(f);ctx.save();ctx.globalAlpha=(1-age/.35)*.5;
  for(let i=0;i<2;i++){const q=local(p,d,-age*8,(i-.5)*9);path([local(q,d,-11,2),local(q,d,-3,0),local(q,d,6,-3)],palette.wind,1);}ctx.restore();
 }
 function dodge(f,b,tick){
  const age=ageOf(f,tick);if(age>.4)return;
  const h=metrics(actorFor(b,f.sourceId)||b.player,b,tick).height,a=worldToScreen(f.from.x,f.from.y),z=worldToScreen(f.to.x,f.to.y),d=eventDirection(f),t=age/.4;
  ctx.save();ctx.globalAlpha=(1-t)*.55;
  for(let i=0;i<3;i++){const start={x:a.x+(z.x-a.x)*(.12+i*.13+t*.25),y:a.y+(z.y-a.y)*(.12+i*.13+t*.25)-h*(.2+i*.13)},end=local(start,d,Math.min(26,Math.hypot(z.x-a.x,z.y-a.y)*.3)*(1-t),0);outline([start,end],palette.light,1);}
  ctx.restore();
 }
 function drawGround(b,tick=b.tick){
  for(const enemy of b.enemies||[])warning(enemy,b,tick);
  for(const actor of actors(b))shield(actor,b,tick,false);
  for(const f of b.effects||[]){
   const age=ageOf(f,tick);if(lifeOf(f,tick)<=0)continue;
   const seed=hash(f.eventId??f.id),at=f.contact||f.to,p=worldToScreen(at.x,at.y);
   if(f.kind==='impact'){
    if(age<.45){
     const t=age/.45;ctx.save();ctx.globalAlpha=(1-t)*.85;
     // Broken, flattened ground edges anchor the blow against the bright gravel.
     // The brief centre compression gives way to outward stones and dust.
     for(let i=0;i<7;i++){
      const a=i*TAU/7+noise(seed,i)*.2,r=20+t*48;
      arc(p,r,r*.34,a,a+.43,'#584832',3);arc({x:p.x,y:p.y-1},r,r*.34,a,a+.3,'#d5b889',1);
      const stone={x:p.x+Math.cos(a)*(12+t*48),y:p.y+Math.sin(a)*(4+t*15)-Math.sin(t*Math.PI)*(6+noise(seed,i+8)*7)};
      dot(stone.x,stone.y+1,i%2?4:3,'#685239');dot(stone.x,stone.y,i%2?3:2,'#c2a17a');
     }
     if(age<.2){ctx.globalAlpha*=1-age/.2;for(let i=0;i<5;i++){const a=i*TAU/5;line({x:p.x+Math.cos(a)*4,y:p.y+Math.sin(a)*2},{x:p.x+Math.cos(a)*14,y:p.y+Math.sin(a)*5},'#e9d5ab',2);}}
     ctx.restore();
    }
    dust(p,seed,age,{strength:1.2});
   }else if(f.kind==='dodge'){
    dust(worldToScreen(f.from.x,f.from.y),seed,age,{strength:.7,direction:eventDirection(f)});dust(p,seed+8,Math.max(0,age-.1),{strength:.45});
   }else if(f.kind==='down')dust(p,seed,age,{strength:.6});
  }
 }
 function drawActorOverlay(actor,b,tick=b.tick){shield(actor,b,tick,true);charge(actor,b,tick);}
 function drawProjectiles(b,tick=b.tick){for(const shot of b.projectiles||[])flight(shot,b,tick);}
 function drawForeground(b,tick=b.tick){
  const effects=(b.effects||[]).filter(f=>lifeOf(f,tick)>0),hits=[];
  for(const actor of actors(b))sword(actor,b,tick);
  for(const f of effects){
   if(f.kind==='hit'){impact(f,b,tick);hits.push(f);}else if(f.kind==='miss')miss(f,b,tick);else if(f.kind==='dodge')dodge(f,b,tick);
  }
  const slots=new Map();for(const f of hits){const slot=slots.get(f.targetId)||0;hitLabel(f,b,tick,slot);slots.set(f.targetId,slot+1);}
 }
 return Object.fromEntries(Object.entries({drawGround,drawActorOverlay,drawProjectiles,drawForeground}).map(([name,legacy])=>[name,(...args)=>{
  if(!isSwordStudy(name==='drawActorOverlay'?args[1]:args[0]))return legacy(...args);
  if(name==='drawProjectiles'){const [b,tick]=args;study.drawProjectiles({...b,projectiles:(b.projectiles||[]).filter(s=>s.space==='visible-body-v1')},tick);return legacy({...b,projectiles:(b.projectiles||[]).filter(s=>s.space!=='visible-body-v1')},tick);}
  return study[name](...args);
 }]));
}
