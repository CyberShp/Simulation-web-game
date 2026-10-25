/** Crop-local pixel anchors for the existing complete artwork. No pose solver. */
export const CAST_FRAME_ANCHORS=[
 {hand:[319.0701,152.841],grip:[147.8098,274.2086],tip:[38.5,417.5]},
 {hand:[301.3218,158.7007],grip:[146.4928,275.2959],tip:[37.5,418.5]},
 {hand:[292.2263,160.5513],grip:[145.4897,276.3832],tip:[36.5,419.5]},
 {hand:[364.619,141.0808],grip:[146.933,275.5677],tip:[37.5,418.5]},
 {hand:[433.4354,139.4351],grip:[149.525,274.4804],tip:[40.5,417.5]},
 {hand:[452.8896,142.2822],grip:[151.7188,274.2086],tip:[42.5,417.5]},
 {hand:[454.4812,143.5674],grip:[152.3659,274.4804],tip:[43.5,417.5]},
 {hand:[442.9674,136.7271],grip:[150.6928,274.7522],tip:[41.5,417.5]},
 {hand:[407.5118,136.4226],grip:[149.4179,274.7522],tip:[40.5,417.5]},
 {hand:[356.7612,142.6642],grip:[148.499,274.4804],tip:[39.5,417.5]},
 {hand:[323.8057,150.8395],grip:[147.7677,274.2086],tip:[38.5,417.5]},
 {hand:[319.0701,152.841],grip:[147.8098,274.2086],tip:[38.5,417.5]},
];

const anchors={
 'person:70,660,218,335':{grip:[68,181],tip:[9,292]},
 'person:433,660,300,335':{grip:[35,51],tip:[140,17]},
 'person:770,660,390,335':{grip:[269,118],tip:[387,122]},
 'leftActions:0,0,490,512':{grip:[155,291],tip:[44,447]},
 'leftActions:512,0,422,512':{grip:[138,89],tip:[396,57]},
 'leftActions:934,0,602,512':{grip:[188,182],tip:[6,174]},
 'leftActions:0,512,480,480':{grip:[156,313],tip:[43,415]},
 'leftSpell:0,0,1536,1024':{grip:[532,563],tip:[234,868]},
 'leftContinuity:0,512,768,512':{hand:[473,205],grip:[306,290],tip:[172,451]},
 'leftContinuity:768,512,768,512':{hand:[389,210],grip:[208,290],tip:[67,453]},
};

export function combatFrameMetadata(pose){
 if(pose.atlas)return {key:pose.key,hand:pose.hand,...pose.anchors};
 const key=pose.image+':'+pose.crop.join(','),cast=/^castBody(\d+)$/.exec(pose.image);
 return {key,hand:pose.hand,...(cast?CAST_FRAME_ANCHORS[Number(cast[1])]:anchors[key])};
}

export const COMBAT_FRAME_ART_LIMITS=Object.freeze({
 walk:'Existing left/right frames do not contain a complete opposite-leg gait.',
 leftReaction:'Left dodge and hit reuse existing walk/idle artwork.',
 directionalAttack:'Attack artwork has left/right views only; diagonal reach is not redrawn.',
 rightCast:'S01 body/weapon frames are the existing offline mesh study raster, not newly painted frames.',
 swordHistory:'Discrete key poses do not provide a continuous authored blade path.',
});

export const COMBAT_FRAME_ATLAS_SCHEMA='combat-frame-atlas/v1';
export const COMBAT_ACTOR_REGISTRY_SCHEMA='combat-actor-registry/v1';
export const COMBAT_ACTOR_REGISTRY_PATH='combat-pixel-v1/registry.json';
const finitePair=value=>Array.isArray(value)&&value.length===2&&value.every(Number.isFinite);
const positive=value=>Number.isFinite(value)&&value>0;
const canonicalPhase=phase=>({execute:'release',walk:'move',dodge:'evade',light:'hit',heavy:'hit'})[phase]||phase;

/** The manifest describes complete, equally scaled frames; it never owns time. */
export function normalizeCombatFrameManifest(manifest,{imageKey=manifest?.id||'atlas',path='manifest'}={}){
 const fail=message=>{throw Error(`${path}: ${message}`);};
 if(manifest?.schema!==COMBAT_FRAME_ATLAS_SCHEMA)fail('unsupported combat frame schema');
 for(const field of ['visualIdentity','action','direction'])if(typeof manifest[field]!=='string'||!manifest[field])fail(`${field} is required`);
 if(typeof manifest.atlas!=='string'||!manifest.atlas)fail('atlas is required');
 if(!finitePair(manifest.frameSize)||!manifest.frameSize.every(n=>Number.isSafeInteger(n)&&n>0))fail('frameSize must contain positive integers');
 if(!positive(manifest.sourceHeight)||!finitePair(manifest.foot))fail('sourceHeight and foot are required');
 if(!Array.isArray(manifest.frames)||!manifest.frames.length)fail('frames are required');
 const [width,height]=manifest.frameSize,indices=new Set();
 const frames=manifest.frames.map((entry,i)=>{
  const index=entry.index??i,crop=[entry.x,entry.y,entry.w??width,entry.h??height],foot=entry.foot??manifest.foot,sourceHeight=entry.sourceHeight??manifest.sourceHeight;
  if(!Number.isSafeInteger(index)||index<0||indices.has(index))fail(`frame ${i} has an invalid index`);indices.add(index);
  if(crop.some(n=>!Number.isSafeInteger(n)||n<0)||crop[2]!==width||crop[3]!==height)fail(`frame ${i} must retain frameSize`);
  if(!finitePair(foot)||foot.some((n,k)=>n!==manifest.foot[k])||sourceHeight!==manifest.sourceHeight)fail(`frame ${i} must retain the common foot and sourceHeight`);
  const durationMs=entry.durationMs??(positive(manifest.durationMs)?manifest.durationMs/manifest.frames.length:100);
  if(!positive(durationMs))fail(`frame ${i} durationMs must be positive`);
  const anchors={};for(const name of ['hand','grip','tip'])if(entry.anchors?.[name]!==undefined){if(!finitePair(entry.anchors[name]))fail(`frame ${i} ${name} anchor is invalid`);anchors[name]=[...entry.anchors[name]];}
  const phase=canonicalPhase(entry.phase??manifest.phase??null);
  return {image:imageKey,crop,foot:[...foot],sourceHeight,hand:anchors.hand??null,anchors,index,durationMs,phase,key:`${path}#${index}`,atlas:true};
 });
 return {id:manifest.id||path,visualIdentity:manifest.visualIdentity,action:manifest.action,direction:manifest.direction,frames,durationMs:frames.reduce((n,f)=>n+f.durationMs,0),path};
}

/** Asset identity belongs to the person; faction and position do not select art. */
export function combatVisualIdentity(actor){
 if(typeof actor.visualIdentity==='string'&&actor.visualIdentity)return actor.visualIdentity;
 if(typeof actor.appearance?.visualIdentity==='string'&&actor.appearance.visualIdentity)return actor.appearance.visualIdentity;
 if(actor.personId==='person:master'||!actor.personId&&actor.id==='master')return 'shen-yan';
 if(actor.personId==='person:valley-shanxiao'||actor.entityKind==='beast')return 'shanxiao';
 return actor.personId||actor.id||'unknown';
}

export function combatFrameDirection(direction={x:1,y:0}){
 const x=direction.x||0,y=direction.y||0;
 if(Math.hypot(x,y)<1e-8)return 'right';
 const index=(Math.round(Math.atan2(y,x)/(Math.PI/4))+8)%8;
 return ['right','down-right','down','down-left','left','up-left','up','up-right'][index];
}

/** Display priority shared by the transient loop origin and the frame sampler. */
export function combatVisualMotion(actor,scene){
 const m=actor.motion||{},runtimePhase=m.phase||(actor.hp<=0?'down':actor.telegraph?'windup':'idle'),beast=actor.entityKind==='beast'||actor.personId==='person:valley-shanxiao';
 const formalDodge=m.action==='dodge'&&['windup','release','recovery','evade'].includes(runtimePhase),accepted=m.moveIntent||{x:0,y:0};
 const releasedMove=!beast&&!formalDodge&&['release','recovery'].includes(runtimePhase)&&['attack','spell','guard'].includes(m.action)&&!m.movementLocked&&Math.hypot(accepted.x,accepted.y)>0&&Number.isFinite(m.executeAtTick)&&(scene.worldTick??scene.tick)>m.executeAtTick;
 const phase=releasedMove?'move':formalDodge?'evade':runtimePhase;
 return {runtimePhase,phase,beast,releasedMove,action:releasedMove?'move':m.action||phase};
}

function clipActions(sample){
 if(sample.phase==='down')return ['down'];
 if(sample.phase==='hit')return [sample.reaction==='heavy'?'hit-heavy':'hit-light','hit'];
 if(sample.phase==='evade')return ['dodge','evade'];
 if(sample.phase==='move')return ['walk','move'];
 return [sample.action==='strike'?'attack':sample.action,sample.phase];
}
function directionalClip(clips,direction,facing){
 const horizontal=name=>name.includes('left')?'left':name.includes('right')?'right':null,side=horizontal(direction)||facing;
 clips=clips.filter(c=>!horizontal(c.direction)||horizontal(c.direction)===side);
 const exact=clips.find(c=>c.direction===direction);if(exact)return {clip:exact,directionalFallback:false};
 // Choose the closest authored angle within this half-plane. A strict
 // distance improvement preserves registry order when two angles are tied.
 const angles=['right','down-right','down','down-left','left','up-left','up','up-right'],at=angles.indexOf(direction),distance=c=>{const i=angles.indexOf(c.direction);return i<0?Infinity:Math.min((i-at+8)%8,(at-i+8)%8);};
 const closest=clips.filter(c=>angles.includes(c.direction)).reduce((best,c)=>!best||distance(c)<distance(best)?c:best,null),fallback=closest||clips.find(c=>c.direction==='default');
 return fallback?{clip:fallback,directionalFallback:true}:null;
}

/** Phase mapping follows the authoritative stage, including a full release tick. */
export function sampleCombatFrameAtlas(identity,sample,library){
 const actor=library?.get?.(identity)||library?.[identity];if(!actor)return null;
 const clips=actor.clips||[],direction=combatFrameDirection(sample.lookDirection||sample.direction),actions=[...new Set(clipActions(sample))];
 const reaction=['hit','down'].includes(sample.phase);
 let selected=null,actionFallback=false;
 for(const action of actions){selected=directionalClip(clips.filter(c=>c.action===action),direction,sample.facing);if(selected)break;}
 // Keep the master's complete walk and guard poses until those atlas actions exist.
 const preserveMasterLegacy=identity==='shen-yan'&&(canonicalPhase(sample.phase)==='move'||sample.action==='guard');
 if(!selected&&!reaction&&!preserveMasterLegacy){selected=directionalClip(clips.filter(c=>c.action==='idle'),direction,sample.facing);actionFallback=true;}
 if(!selected)return null;
 const {clip}=selected,formal=canonicalPhase(sample.runtimePhase),phase=canonicalPhase(sample.phase);
 let frames=clip.frames.filter(f=>f.phase===formal);
 if(!frames.length)frames=clip.frames.filter(f=>f.phase===phase);
 const phaseFallback=!frames.length&&clip.frames.some(f=>f.phase);
 if(!frames.length){
  frames=clip.frames.filter(f=>!f.phase);
  if(reaction&&!frames.length)return null;
  // If a clip is incomplete, hold one authored frame instead of playing another
  // phase across a real release, hit, or recovery boundary.
  if(!frames.length)frames=[clip.frames[phase==='down'?clip.frames.length-1:0]];
 }
 const total=frames.reduce((n,f)=>n+f.durationMs,0),loop=['idle','move','guard'].includes(phase)&&!actionFallback;
 const loopTick=sample.animationElapsedTicks??sample.tick;
 const position=loop?((loopTick*100)%total+total)%total:Math.min(total-Number.EPSILON,Math.max(0,sample.progress)*total);
 let elapsed=0,pose=frames.at(-1);
 for(const frame of frames){elapsed+=frame.durationMs;if(position<elapsed){pose=frame;break;}}
 return {pose,clipId:clip.id,clipAction:clip.action,clipDirection:clip.direction,frameKey:pose.key,visualIdentity:identity,atlasDirection:direction,directionalFallback:selected.directionalFallback,actionFallback,phaseFallback};
}
