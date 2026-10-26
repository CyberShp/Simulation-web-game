/** Read-only frame positions. Known movement is interpolated, preview is bounded. */
import {dodgeEndpoint,combatGeometryId,combatClearLine} from '../../src/simulation/ea-combat-geometry.mjs';
import {combatSceneBounds} from './courtyard-combat-camera.mjs';
import {combatVisualIdentity,combatVisualMotion} from './courtyard-combat-frame-metadata.mjs';
import {sampleSwordStudyBody,STUDY_PROFILE} from '../../src/simulation/ea-combat-sword-study-frames.mjs';
import {STUDY_SHOT_SPACE,advanceStudyShot,sweepStudyBody} from '../../src/simulation/ea-combat-study-body.mjs';
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const point=p=>({x:p.x,y:p.y});
const actors=b=>[b.player,...(b.allies||[]),...(b.enemies||[])].filter(Boolean);
export const combatActorFaction=(actor,scene)=>actor.faction||(actor===scene.player||scene.allies?.some(a=>a.id===actor.id)?'sect':'hostile');
export function combatDepthOrder(scene){return actors(scene).sort((a,b)=>a.y-b.y||a.x-b.x||String(a.id).localeCompare(String(b.id)));}
/** Select a visible body using the same foot and scale as the renderer. */
export function combatActorAtScreen(scene,at,{worldToScreen,heightOf=()=>112,enemiesOnly=false}={}){
 const ordered=combatDepthOrder(scene).filter(a=>a.hp>0&&(!enemiesOnly||combatActorFaction(a,scene)==='hostile'));
 for(let i=ordered.length-1;i>=0;i--){const actor=ordered[i],foot=worldToScreen(actor.x,actor.y),h=heightOf(actor),dx=(at.x-foot.x)/(h*.28),dy=(at.y-foot.y+h*.48)/(h*.56);if(dx*dx+dy*dy<=1)return actor;}
 return null;
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const PREVIEW_METERS=.045;
// A small continuous first response; subsequent paths end at authority only.
// The display never creates a world step or a combat decision.
const STUDY_PREVIEW_METERS=.045;
const tailMotionMs=tail=>tail.duration*(tail.kind==='run'?1:2/3);
export function createCombatPresentation({clock=()=>performance.now()}={}){
 let key=null,tick=null,observedAt=0,previous=null,current=null,frozen=null,wasPaused=false,playerPoint=null,playerPath=null,stopPose=null,lastIntent={x:0,y:0},poseHolds=new Map(),seenHits=new Set(),hitFeedback=new Map(),loopOrigins=new Map();
 const rememberHit=id=>{seenHits.add(id);if(seenHits.size>64)seenHits.delete(seenHits.values().next().value);};
 function reset(){key=null;tick=null;previous=null;current=null;frozen=null;playerPoint=null;playerPath=null;stopPose=null;lastIntent={x:0,y:0};poseHolds.clear();seenHits.clear();hitFeedback.clear();loopOrigins.clear();wasPaused=false;}
 function sample(scene,{paused=false,now=clock(),intent=null}={}){
  if(!scene||scene.type!=='combat'){reset();return scene;}
  const lastAuthorityTick=tick,reinitialize=key!==scene.sessionId||tick===null||scene.tick<tick,silent=reinitialize||paused||wasPaused;
  if(reinitialize)reset();
  const fresh=reinitialize||scene.tick-tick>4;
  // A forward gap discards stale interpolation, while retaining event identity.
  if(fresh){key=scene.sessionId;tick=scene.tick;observedAt=now;current=previous=scene;playerPoint=point(scene.player);playerPath=null;stopPose=null;lastIntent={x:0,y:0};poseHolds.clear();}
  const hits=(scene.effects||[]).filter(e=>e.kind==='hit'&&Number.isSafeInteger(e.tick)&&e.tick<=scene.tick);
  if(silent)for(const hit of hits)rememberHit(hit.eventId??hit.id);
  const plannedChanged=paused&&frozen&&scene.player.motion?.actionId!==frozen.player.motion?.actionId;
  if(paused&&wasPaused&&frozen&&!plannedChanged){
   frozen={...scene,worldTick:scene.tick,visualTick:frozen.visualTick,player:frozen.player,allies:frozen.allies,enemies:frozen.enemies,projectiles:frozen.projectiles,effects:frozen.effects};
   return frozen;
  }
  if(wasPaused&&!paused){
   // Retain only the displayed remainder of this authoritative step. A new
   // world step below establishes its own anchor rather than carrying an offset.
   observedAt=now-clamp((frozen?.visualTick??scene.tick)-scene.tick)*100;
   previous=current=scene;playerPoint=point(frozen?.player||scene.player);playerPath={from:point(playerPoint),to:point(scene.player),at:now,duration:Math.max(35,Math.min(100,distance(playerPoint,scene.player)/3.8*1000))};
   const priorMove=frozen?.player?.motion?.direction||frozen?.player?.facing||{x:0,y:0},motion=scene.player.motion||{};
   if(!stopPose&&scene.rulesProfile===STUDY_PROFILE&&frozen?.player?.motion?.phase==='move'&&!Math.hypot(intent?.x||0,intent?.y||0)&&!motion.movementLocked&&scene.player.hp>0&&['idle','move'].includes(motion.phase)&&Math.hypot(priorMove.x,priorMove.y)>0&&distance(playerPoint,scene.player)>1e-6){
    const side=Math.abs(priorMove.x)>=Math.abs(priorMove.y);
    stopPose={kind:side?'stop':'run',at:now,duration:side?Math.max(60,playerPath.duration):playerPath.duration,elapsedMs:0,direction:side?{x:Math.sign(priorMove.x),y:0}:{x:0,y:Math.sign(priorMove.y)},target:point(scene.player)};
   }
   if(stopPose){stopPose.at=now-stopPose.elapsedMs;playerPath.duration=Math.max(1,tailMotionMs(stopPose)-stopPose.elapsedMs);}
   for(const hold of poseHolds.values())hold.at=now-(hold.age||0);
   for(const feedback of hitFeedback.values())feedback.at=now-feedback.ageMs;
   lastIntent={x:0,y:0};
  }
  const advanced=scene.tick!==tick;
  if(advanced){previous=current;current=scene;tick=scene.tick;observedAt=now;}else current=scene;
  const fraction=paused?0:clamp((now-observedAt)/100),visualTick=plannedChanged?scene.tick:paused&&frozen?frozen.visualTick:scene.tick+fraction;
  const bodies=actors(scene),previousById=new Map(actors(previous).map(a=>[a.id,a])),frozenById=new Map(frozen?actors(frozen).map(a=>[a.id,a]):[]),byIdentity=new Map(bodies.flatMap(a=>[[a.id,a],...(a.personId?[[a.personId,a]]:[])]));
  const contacts=hits.filter(e=>e.tick===scene.tick&&e.outcome!=='evaded'&&e.outcome!=='miss'),firstContacts=[];
  for(const hit of hits){
   const id=hit.eventId??hit.id;if(seenHits.has(id))continue;rememberHit(id);
   // Only newly crossed, damaging contacts receive up to 500ms of catch-up.
   // This age belongs to presentation; the event tick and combat state stay intact.
   if(!silent&&hit.tick>lastAuthorityTick&&scene.tick-hit.tick<=5&&hit.amount>0&&(hit.outcome??'hit')==='hit'){
    hitFeedback.set(id,{at:now,ageMs:0});firstContacts.push(hit);
   }else if(!silent&&hit.tick===scene.tick&&hit.outcome==='guarded')firstContacts.push(hit);
  }
  for(const [id,feedback]of hitFeedback){feedback.ageMs=paused?feedback.ageMs:Math.max(0,now-feedback.at);if(feedback.ageMs>=90)hitFeedback.delete(id);}
  const contactIds=new Set([...contacts,...firstContacts].flatMap(e=>[e.sourceId,e.targetId]));
  for(const hit of firstContacts){
   const id=hit.eventId??hit.id;
   for(const identity of [hit.sourceId,hit.targetId]){const body=byIdentity.get(identity);if(body)poseHolds.set(body.id,{id,at:now,tick:visualTick});}
  }
  const renderActors=bodies.map(actor=>{
   const old=previousById.get(actor.id),m=actor.motion||{},master=actor===scene.player,contacted=contactIds.has(actor.id)||contactIds.has(actor.personId);let at=point(actor);
   const dodge=m.dodgePath;
   if(dodge&&visualTick>=dodge.startedTick&&visualTick<dodge.startedTick+dodge.durationTicks&&!contacted){at=lerp(dodge.from,dodge.to,clamp((visualTick-dodge.startedTick)/dodge.durationTicks));if(master){playerPoint=point(at);playerPath=null;stopPose=null;}}
   else if(master){
    let move=intent||m.moveIntent||{x:0,y:0};const allowed=!paused&&!m.movementLocked&&m.phase!=='hit'&&m.phase!=='down'&&actor.hp>0;
    const study=scene.rulesProfile===STUDY_PROFILE,preview=study?STUDY_PREVIEW_METERS:PREVIEW_METERS;
    if(!allowed)move={x:0,y:0};const length=Math.hypot(move.x,move.y),normalized=length?p=>({x:p.x+move.x/Math.max(1,length)*preview,y:p.y+move.y/Math.max(1,length)*preview}):point;
    const changed=move.x!==lastIntent.x||move.y!==lastIntent.y;
    const bounds=combatSceneBounds(scene),clip=(from,to)=>dodgeEndpoint(from,{x:clamp(to.x,bounds.left,bounds.right),y:clamp(to.y,bounds.top,bounds.bottom)},scene.geometryId||combatGeometryId(scene));
    // Finish the old path at this exact wall-clock instant before retargeting.
    // Rebuilding first loses one rAF interval at every authoritative step.
    if(study&&playerPath&&!paused)playerPoint=lerp(playerPath.from,playerPath.to,clamp((now-playerPath.at)/playerPath.duration));
    if(!playerPoint||distance(playerPoint,actor)>.6||contacted||m.phase==='down'){playerPoint=point(actor);playerPath=null;stopPose=null;}
    if(study&&!paused&&(length||!allowed||!['idle','move'].includes(m.phase)))stopPose=null;
    // A newly locked cast may finish only the already confirmed display tail.
    // Damage/down contacts take the authoritative position immediately instead.
    if(study&&!paused&&(m.phase==='hit'||m.phase==='down'||actor.hp<=0)){playerPoint=point(actor);playerPath=null;}
    if(advanced||changed){
     const starting=changed&&length>0;let target=starting?normalized(playerPoint):length?(study?point(actor):normalized(actor)):point(actor);
     if(study&&length&&!starting){
      const dot=p=>p.x*move.x+p.y*move.y;
      if(dot({x:target.x-playerPoint.x,y:target.y-playerPoint.y})<0){
       // Reversal can put the delayed display beyond the new authority point.
       // Do not draw a step against the held direction. Only a newly confirmed
       // step in that direction permits another bounded first-response bridge.
       const confirmed=advanced&&old?dot({x:actor.x-old.x,y:actor.y-old.y}):0;
       target=confirmed>1e-6?normalized(playerPoint):point(playerPoint);
      }
     }
     if(study){const ahead=distance(target,actor),limit=starting?Math.max(.33,distance(playerPoint,actor)+preview):.33;if(ahead>limit)target=lerp(actor,target,limit/ahead);}
     target=study?clip(playerPoint,target):starting?clip(playerPoint,target):length?clip(actor,target):point(actor);
     let duration=starting?(study?100:25):length?100:Math.max(35,Math.min(100,distance(playerPoint,actor)/3.8*1000));
     if(study&&changed&&!length&&allowed&&['idle','move'].includes(m.phase)&&Math.hypot(lastIntent.x,lastIntent.y)>0&&distance(playerPoint,target)>1e-6){
      const side=Math.abs(lastIntent.x)>=Math.abs(lastIntent.y);
      if(side)duration=Math.max(60,duration);
      stopPose={kind:side?'stop':'run',at:now,duration,elapsedMs:0,direction:side?{x:Math.sign(lastIntent.x),y:0}:{x:0,y:Math.sign(lastIntent.y)},target:point(target)};
      duration=tailMotionMs(stopPose);
     }
     // Preserve the original stop deadline and pose clock across idle ticks.
     // A genuinely changed authoritative endpoint must still be incorporated.
     const stopping=study&&stopPose&&advanced&&!changed,sameStopTarget=stopping&&distance(stopPose.target,target)<1e-6;
     if(stopping&&!sameStopTarget){duration=Math.max(1,stopPose.at+tailMotionMs(stopPose)-now);stopPose.target=point(target);}
     if(!sameStopTarget)playerPath={from:point(playerPoint),to:target,at:now,duration};
     lastIntent={x:move.x,y:move.y};
    }
    if(playerPath)playerPoint=lerp(playerPath.from,playerPath.to,clamp((now-playerPath.at)/playerPath.duration));at=point(playerPoint);
   }else if(old&&!contacted&&actor.hp>0&&m.phase!=='hit'&&distance(old,actor)<.6){at=lerp(old,actor,fraction);}
   if(paused&&frozen){const prior=frozenById.get(actor.id);if(prior)at=point(prior);}
   if(contacted){at=point(actor);if(master){playerPoint=point(actor);playerPath=null;stopPose=null;}}
   let poseTick=plannedChanged?scene.tick:visualTick;
   const hold=poseHolds.get(actor.id);if(hold){const age=paused?hold.age||0:now-hold.at;hold.age=age;if(age<35)poseTick=hold.tick;else if(age<70)poseTick=hold.tick+(visualTick-hold.tick)*(age-35)/35;else poseHolds.delete(actor.id);}
   let displayMotion=m,displayFacing=actor.facing;
   if(master&&intent&&!paused&&!m.movementLocked&&m.phase!=='hit'&&m.phase!=='down'){
    const length=Math.hypot(intent.x,intent.y),moving=length>0,direction=moving?{x:intent.x/Math.max(1,length),y:intent.y/Math.max(1,length)}:m.direction;
    displayMotion={...m,moving,...(scene.rulesProfile===STUDY_PROFILE?{moveIntent:moving?{...direction}:{x:0,y:0}}:{})};
    if(['idle','move'].includes(m.phase)){displayMotion={...displayMotion,phase:moving?'move':'idle',action:moving?'move':'idle',direction};if(moving)displayFacing=direction;}
   }
   const runTail=master&&stopPose?.kind==='run'&&distance(at,stopPose.target)>1e-6&&['idle','move'].includes(m.phase)&&!m.movementLocked&&actor.hp>0;
   if(runTail){displayMotion={...m,phase:'move',action:'move',moving:true,moveIntent:{...stopPose.direction},direction:{...stopPose.direction}};displayFacing=stopPose.direction;}
   const shown={...actor,...at,motion:displayMotion,facing:displayFacing,poseTick},phase=combatVisualMotion(shown,scene).phase;
   if(master&&stopPose){stopPose.elapsedMs=paused?stopPose.elapsedMs:Math.max(0,now-stopPose.at);const tail={elapsedMs:stopPose.elapsedMs,durationMs:stopPose.duration,direction:stopPose.direction,settled:distance(at,stopPose.target)<1e-6};if(stopPose.kind==='run'){if(runTail)shown.runTailPresentation=tail;else if(tail.settled)stopPose=null;}else if(stopPose.elapsedMs<stopPose.duration)shown.stopPresentation=tail;else stopPose=null;}
   // A continuous visual phase shares the existing displayed pose tick origin.
   if(['idle','move','guard'].includes(phase)){
    const identity=combatVisualIdentity(shown);let origin=loopOrigins.get(actor.id);
    if(!origin||origin.phase!==phase||origin.identity!==identity){origin={phase,identity,tick:poseTick};loopOrigins.set(actor.id,origin);}
    shown.animationElapsedTicks=Math.max(0,poseTick-origin.tick);
   }else loopOrigins.delete(actor.id);
   return shown;
  });
  const renderedById=new Map(renderActors.map(a=>[a.id,a]));
  for(const id of loopOrigins.keys())if(!renderedById.has(id))loopOrigins.delete(id);
  const shots=(scene.projectiles||[]).map(shot=>{
   const geometry=scene.geometryId||combatGeometryId(scene),direction=shot.direction||{x:0,y:0},step=Math.min(shot.remainingDistance??0,(shot.speed||0)*fraction*.1),end={x:shot.x+direction.x*step,y:shot.y+direction.y*step};
   const source=byIdentity.get(shot.sourceId),faction=shot.ownerFaction||(source?combatActorFaction(source,scene):'sect');
   if(shot.space===STUDY_SHOT_SPACE){
    const next=advanceStudyShot(shot,direction,step),authorityTick=scene.worldTick??scene.tick;
    const hit=bodies.filter(e=>e.hp>0&&e!==source&&combatActorFaction(e,scene)!==faction).map(actor=>{
     const frame=sampleSwordStudyBody(actor,authorityTick),contact=sweepStudyBody(shot,next,direction,actor,frame,shot.coreLength,shot.coreWidth);
     return contact&&combatClearLine(shot,contact.contact,geometry)?{actor,...contact}:null;
    }).filter(Boolean).sort((a,b)=>a.fraction-b.fraction)[0];
    if(hit){const rendered=renderedById.get(hit.actor.id);if(rendered)Object.assign(rendered,point(hit.actor));return {...shot,...advanceStudyShot(shot,direction,step*hit.fraction)};}
    if(!combatClearLine(shot,next,geometry)){
     let lo=0,hi=1;for(let n=0;n<20;n++){const mid=(lo+hi)/2;if(combatClearLine(shot,advanceStudyShot(shot,direction,step*mid),geometry))lo=mid;else hi=mid;}
     return {...shot,...advanceStudyShot(shot,direction,step*lo)};
    }
    return {...shot,...next};
   }
   const hit=bodies.filter(e=>e.hp>0&&e!==source&&combatActorFaction(e,scene)!==faction).map(e=>{const projection=(e.x-shot.x)*direction.x+(e.y-shot.y)*direction.y,side=Math.max(0,(e.x-shot.x)**2+(e.y-shot.y)**2-projection**2),chord=Math.sqrt(Math.max(0,(shot.radius||.45)**2-side));return {actor:e,along:Math.max(0,projection-chord),exit:projection+chord,side};}).filter(h=>h.side<=(shot.radius||.45)**2&&h.along<=step&&h.exit>=0&&combatClearLine(shot,h.actor,geometry)).sort((a,b)=>a.along-b.along)[0];
   if(hit){const rendered=renderedById.get(hit.actor.id);if(rendered)Object.assign(rendered,point(hit.actor));return {...shot,x:shot.x+direction.x*hit.along,y:shot.y+direction.y*hit.along};}
   const bounds=combatSceneBounds(scene);return {...shot,...dodgeEndpoint(shot,{x:clamp(end.x,bounds.left,bounds.right),y:clamp(end.y,bounds.top,bounds.bottom)},geometry)};
  });
  for(const hit of contacts){if(!hit.projectileId||fraction>.35||shots.some(s=>s.id===hit.projectileId))continue;const old=previous.projectiles?.find(s=>s.id===hit.projectileId);if(old&&hit.contact)shots.push({...old,...point(hit.contact),terminal:true});}
  const effects=(scene.effects||[]).map(effect=>{const feedback=hitFeedback.get(effect.eventId??effect.id);return feedback?{...effect,feedbackAgeMs:feedback.ageMs}:effect;});
  let render={...scene,worldTick:scene.tick,visualTick,player:renderActors[0],allies:renderActors.slice(1,1+scene.allies.length),enemies:renderActors.slice(1+scene.allies.length),projectiles:shots,effects};
  if(paused&&frozen)render={...render,projectiles:frozen.projectiles};
  frozen=render;wasPaused=paused;return render;
 }
 return {sample,reset};
}
