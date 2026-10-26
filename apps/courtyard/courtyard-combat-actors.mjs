/** First-encounter bodies. Poses only sample the formal world clock. */
import {FRAME_TABLE} from './courtyard-layers.mjs';
import {CAST_FRAME_ANCHORS,combatFrameMetadata,COMBAT_ACTOR_REGISTRY_PATH,COMBAT_ACTOR_REGISTRY_SCHEMA,normalizeCombatFrameManifest,combatVisualIdentity,combatVisualMotion,sampleCombatFrameAtlas} from './courtyard-combat-frame-metadata.mjs';
import {createCombatBeastRig} from './courtyard-combat-beast-rig.mjs';
import {combatActorHeight} from './courtyard-combat-dimensions.mjs';
import {isSwordStudy,swordStudyPresentation,drawSwordStudyActor} from './courtyard-combat-sword-study.mjs';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const frame=(image,crop,foot,sourceHeight,hand=null)=>({image,crop,foot,sourceHeight,hand});
const original=(crop,foot,hand)=>frame('person',crop,foot,323,hand);
const right={
 idle:original([70,660,218,335],[134,329],[194,161]),
 windup:original([433,660,300,335],[160,329],[260,180]),
 release:original([770,660,390,335],[163,329],[277,129]),
 guard:original([1160,660,370,335],[200,329],[295,88]),
 evade:frame('reactions',[512,0,512,512],[253,479],442,[448,299]),
 light:frame('reactions',[1024,0,512,512],[296,473],442,[300,150]),
 heavy:frame('reactions',[0,512,490,470],[279,432],442,[431,398]),
 down:frame('reactions',[510,734,552,200],[281,179],442,[355,141]),
};
const left={
 idle:frame('leftActions',[0,0,490,512],[265,480],449,[344,292]),
 windup:frame('leftActions',[512,0,422,512],[215,482],449,[390,247]),
 release:frame('leftActions',[934,0,602,512],[400,480],449,[202,174]),
 castWindup:frame('leftActions',[0,512,480,480],[259,448],449,[281,131]),
 castRelease:frame('leftSpell',[0,0,1536,1024],[840,960],932,[523,285]),
 guard:frame('leftContinuity',[768,0,768,512],[374,507],480,[246,166]),
 walk:[frame('leftContinuity',[0,512,768,512],[447,487],480),frame('leftContinuity',[768,512,768,512],[365,488],480)],
 evade:frame('leftContinuity',[0,512,768,512],[447,487],480),
 light:frame('leftActions',[0,0,490,512],[265,480],449,[344,292]),
 heavy:frame('leftContinuity',[0,512,768,512],[447,487],480),
 down:right.down,
};
const beast={
 idle:frame('foeActions',[0,0,724,724],[374,663],600),
 windup:frame('foeActions',[724,0,724,724],[390,663],600),
 release:frame('foeActions',[1448,0,724,724],[379,663],600),
 walk:[frame('beastMotion',[0,0,537,512],[280,479],420),frame('beastMotion',[537,0,487,512],[243,505],420)],
 light:frame('beastMotion',[1024,0,512,512],[266,499],420),
 heavy:frame('beastMotion',[0,512,512,512],[278,442],420),
 recover:frame('beastMotion',[512,512,512,512],[275,441],420),
 down:frame('beastMotion',[1024,675,512,330],[271,284],420),
};
const cast=index=>frame('castBody'+index,[0,0,640,512],[255,456],384,CAST_FRAME_ANCHORS[index].hand);

function needsLegacyBeastWarmup(library){
 // A registered attack does not cover idle, movement or reactions. Probe the
 // same selection path as a visible beast; atlas idle fallbacks count as cover.
 for(let angle=0;angle<8;angle++){
  const direction={x:Math.cos(angle*Math.PI/4),y:Math.sin(angle*Math.PI/4)};
  for(const phase of ['idle','move','windup','release','recovery','hit'])for(const reaction of phase==='hit'?['light','heavy']:['light']){
   const actor={id:'warmup-beast',personId:'person:valley-shanxiao',visualIdentity:'shanxiao',entityKind:'beast',x:0,y:0,hp:100,facing:direction,hitReaction:{kind:reaction},motion:{action:phase==='idle'||phase==='move'?phase:phase==='hit'?'hit':'strike',phase,direction,phaseDurationTicks:1,phaseProgressTicks:0}};
   if(!sampleCombatActor(actor,{tick:0},0,library).pose.atlas)return true;
  }
 }
 return false;
}

/** No local action timers: the same snapshot and visual tick yield the same pose. */
export function sampleCombatActor(actor,scene,tick=scene.tick,library=null){
 tick=actor.poseTick??tick;
 const m=actor.motion||{},{runtimePhase,phase,beast:b,releasedMove,action}=combatVisualMotion(actor,scene);
 // Keep the real release frame visible on its authoritative step. Position and
 // input still update normally; accepted movement owns the following body frame.
 const accepted=m.moveIntent||{x:0,y:0};
 const duration=Math.max(1,m.phaseDurationTicks||1),elapsed=Math.max(0,tick-(m.phaseStartedTick??tick));
 let progress=clamp((m.phaseProgressTicks===undefined?elapsed:m.phaseProgressTicks+tick-Math.floor(tick))/duration,0,1);
 if(runtimePhase==='windup'&&Number.isFinite(m.executeAtTick)&&Number.isFinite(m.startedTick))progress=clamp((tick-m.startedTick)/Math.max(1,m.executeAtTick-m.startedTick),0,1);
 if(runtimePhase==='recovery'&&Number.isFinite(m.executeAtTick)&&Number.isFinite(m.recoveryUntilTick))progress=clamp((tick-m.executeAtTick-1)/Math.max(1,m.recoveryUntilTick-m.executeAtTick-1),0,1);
 const direction=releasedMove?accepted:m.direction||actor.facing||{x:1,y:0},look=phase==='hit'||phase==='down'?actor.facing||direction:direction;
 const facing=look.x<-.08?'left':'right',poses=b?beast:facing==='left'?left:right;
 let pose=poses.idle,index=null;
 if(phase==='down')pose=progress<.17?poses.heavy:poses.down;
 else if(phase==='hit')pose=actor.hitReaction?.kind==='heavy'?poses.heavy:poses.light;
 else if(phase==='evade')pose=poses.evade||poses.light;
 else if(phase==='move'){
  if(b||facing==='left')pose=poses.walk[Math.floor(tick/2)%poses.walk.length];
  else {const frames=direction.y<-.55?FRAME_TABLE.master.walkAway:FRAME_TABLE.master.walk;const f=frames[Math.floor(tick/2)%frames.length];pose=frame('person',f.crop,f.foot,f.sourceHeight);}
 }else if(m.action==='spell'&&['windup','release','recovery'].includes(phase)){
  if(facing==='right'){
   index=phase==='windup'?Math.min(4,Math.floor(progress*5)):phase==='release'?5:Math.min(11,6+Math.floor(progress*6));pose=cast(index);
  }else pose=phase==='windup'?poses.castWindup:phase==='release'||progress<.48?poses.castRelease:progress<.85?poses.castWindup:poses.idle;
 }else if(m.action==='guard'||phase==='guard'){
  // Hand remains on the same physical sword; a hand seal precedes the palm stance.
  if(phase==='windup'&&facing==='right'){index=Math.min(2,Math.floor(progress*3));pose=cast(index);}
  else if(phase==='windup'&&facing==='left')pose=poses.castWindup;
  else pose=poses.guard||poses.idle;
 }else if(['attack','strike'].includes(m.action)){
  if(phase==='windup')pose=progress<.15?poses.idle:poses.windup;
  else if(phase==='release')pose=poses.release;
  else if(phase==='recovery')pose=b?(progress<.3?poses.release:progress<.8?poses.recover:poses.idle):(progress<.4?poses.release:progress<.76?poses.windup:poses.idle);
 }
 const identity=combatVisualIdentity(actor),sample={pose,phase,runtimePhase,runtimeAction:m.action||runtimePhase,visualOverride:releasedMove?'released-move':null,action,frameKey:combatFrameMetadata(pose).key,progress,tick,animationElapsedTicks:actor.animationElapsedTicks,direction,lookDirection:look,facing,beast:b,mirrored:b&&facing==='right',castIndex:index,
  foot:{x:actor.x,y:actor.y},reaction:actor.hitReaction?.kind||null,visualIdentity:identity};
 const atlas=sampleCombatFrameAtlas(identity,sample,library);
 if(atlas)return {...sample,...atlas,castIndex:null,mirrored:false,assetFallback:atlas.actionFallback||atlas.directionalFallback||atlas.phaseFallback};
 if(!b&&actor.personId!=='person:master'&&identity!=='shen-yan'){
  const table=actor.personId==='person:lu-zhiwei'||actor.appearance===1||actor.appearance?.base==='female'?FRAME_TABLE.female:FRAME_TABLE.other;
  const source=phase==='move'?table.walk[Math.floor(tick/2)%table.walk.length]:table.idle;
  pose=frame('disciples',source.crop,source.foot,source.sourceHeight);
  return {...sample,pose,castIndex:null,mirrored:false,frameKey:combatFrameMetadata(pose).key,assetFallback:true,fallbackReason:'identity-atlas-unavailable'};
 }
 return {...sample,assetFallback:true,fallbackReason:'identity-atlas-unavailable'};
}

/** Reuses the original RGBA threshold from the S01/S04 study renderer. */
function transparentTexture(image,makeCanvas){
 const canvas=makeCanvas(image.width,image.height);canvas.width=image.width;canvas.height=image.height;
 const context=canvas.getContext('2d');context.drawImage(image,0,0);
 const pixels=context.getImageData(0,0,image.width,image.height);
 for(let i=3;i<pixels.data.length;i+=4)pixels.data[i]=pixels.data[i]>=166?255:0;
 context.putImageData(pixels,0,0);return canvas;
}

export async function loadCombatActorAssets({loadImage,loadJson=null,registry=null,registryPath=COMBAT_ACTOR_REGISTRY_PATH,includeRigStudy=false,makeCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;}}){
 const names={person:'cultivator-v1.png',disciples:'disciples-v1.png',foeActions:'valley-shanxiao-actions-v1.png',reactions:'combat-actors-v1/master-reactions.png',leftActions:'combat-actors-v1/master-left-actions.png',leftContinuity:'combat-actors-v1/master-left-continuity.png',leftSpell:'combat-actors-v1/master-left-spell.png',beastMotion:'combat-actors-v1/shanxiao-motion.png'};
 if(includeRigStudy)names.rigLimbs='combat-actors-v2/limbs.png';
 for(let i=0;i<12;i++){const n=String(i).padStart(3,'0');names['castBody'+i]='combat-actors-v1/cast/body-'+n+'.png';names['castWeapon'+i]='combat-actors-v1/cast/weapon-'+n+'.png';}
 const entries=await Promise.all(Object.entries(names).map(async([key,name])=>[key,transparentTexture(await loadImage(name),makeCanvas)]));
 const images=Object.fromEntries(entries),actorLibrary=new Map(),issues=[],manifestLoads=new Map(),imageLoads=new Map();
 const assetPath=(base,name)=>{
  const root='https://combat-assets.invalid/',url=new URL(name,new URL(base,root));
  if(url.origin!=='https://combat-assets.invalid'||url.search||url.hash)throw Error('Combat asset path must be local: '+name);
  return decodeURIComponent(url.pathname.slice(1));
 };
 try{
  registry??=loadJson?await loadJson(registryPath,{optional:true}):null;
  if(registry){
   if(registry.schema!==COMBAT_ACTOR_REGISTRY_SCHEMA||!registry.actors||Array.isArray(registry.actors))throw Error('Unsupported combat actor registry');
   const jobs=Object.entries(registry.actors).map(async([identity,definition])=>{
    if(!Array.isArray(definition.clips))throw Error('Combat actor clips missing: '+identity);
    const results=await Promise.allSettled(definition.clips.map(async(reference,index)=>{
     const path=typeof reference==='string'?reference:reference.manifest,inline=typeof reference==='object'?reference.data:null;
     if(!inline&&(!path||!loadJson))throw Error('Combat manifest unavailable: '+identity);
     const manifestPath=path?assetPath(registryPath,path):`${registryPath}:${identity}:${index}`;
     if(!inline&&!manifestLoads.has(manifestPath))manifestLoads.set(manifestPath,loadJson(manifestPath));
     const manifest=inline||await manifestLoads.get(manifestPath),imagePath=assetPath(manifestPath,manifest.atlas),imageKey='frame-atlas:'+imagePath,clip=normalizeCombatFrameManifest(manifest,{imageKey,path:manifestPath});
     if(!imageLoads.has(imagePath))imageLoads.set(imagePath,loadImage(imagePath));const image=await imageLoads.get(imagePath);
     if(clip.frames.some(f=>f.crop[0]+f.crop[2]>image.width||f.crop[1]+f.crop[3]>image.height))throw Error(manifestPath+': frame exceeds atlas bounds');
     images[imageKey]=image;return clip;
    }));
    const clips=[];for(let i=0;i<results.length;i++){const result=results[i];if(result.status==='fulfilled')clips.push(result.value);else issues.push({identity,clip:definition.clips[i]?.manifest||definition.clips[i],error:result.reason?.message||String(result.reason)});}
    if(clips.length)actorLibrary.set(identity,{clips});
   });
   const results=await Promise.allSettled(jobs);for(let i=0;i<results.length;i++)if(results[i].status==='rejected')issues.push({identity:Object.keys(registry.actors)[i],error:results[i].reason?.message||String(results[i].reason)});
  }
 }catch(error){issues.push({path:registryPath,error:error.message});}
 return {images,makeCanvas,actorLibrary,issues};
}

function deformedPoint(x,y,sample,height){
 const {phase,progress:p,tick,beast:b}=sample,direction={x:sample.direction.x*(sample.mirrored?-1:1),y:sample.direction.y},h=height,upper=smooth((-y/h-.18)/.58),top=smooth((-y/h-.48)/.4);
 let dx=0,dy=0;
 // The sole stays at y=0. Shoulder/hip and head move by different amounts.
 if(phase==='idle'||phase==='guard')dy=-Math.sin(tick*.25)*h*.004*upper;
 if(phase==='move'){
  const gait=tick*Math.PI/4,lower=smooth((y/h+.5)/.32)*(1-smooth((y/h+.045)/.08));
  dx+=Math.sin(gait)*(x<0?-1:1)*h*.04*lower;
  dy-=Math.max(0,Math.sin(gait+(x<0?0:Math.PI)))*h*.045*lower;
  dx+=direction.x*h*.013*upper;dy-=Math.abs(Math.sin(gait))*h*.007*upper;
 }
 if(phase==='windup'){
  const load=smooth(p);dx-=direction.x*h*(b?.055:.025)*load*upper;
  dy+=h*(b?.016:.008)*load*(upper-top*.4);
 }
 if(phase==='release'||phase==='recovery'){
  const force=phase==='release'?1:1-smooth(p);dx+=direction.x*h*(b?.06:.045)*force*upper;
  dy+=h*(b?.03:.006)*force*upper;
 }
 if(phase==='evade'){
  const flex=Math.sin((.15+p*.8)*Math.PI),lower=smooth((y/h+.55)/.35)*(1-smooth((y/h+.04)/.09));
  dx+=direction.x*h*.055*flex*upper+Math.sign(x)*h*.028*flex*lower;
  dy+=h*.045*flex*upper;
 }
 if(phase==='hit'){
  const recoil=Math.sin((.2+p*.8)*Math.PI)*(sample.reaction==='heavy'?1:.65);
  dx+=direction.x*h*.045*recoil*upper;dy+=h*.017*recoil*(upper-top*.4);
  if(sample.facing==='left'&&sample.reaction==='heavy'){
   const lower=smooth((y/h+.55)/.35)*(1-smooth((y/h+.04)/.09));
   dy+=h*.075*recoil*upper;dx+=Math.sign(x)*h*.028*recoil*lower;
  }
 }
 if(phase!=='down'){
  // Turning is shoulder-led; separate left/right artwork keeps the sword hand.
  dx+=direction.y*h*.012*top;dx+=Math.sin(tick*.2-(-y/h)*2)*h*.003*top;
 }
 return {x:x+dx,y:y+dy};
}

function textureTriangle(ctx,image,source,target){
 const [a,b,c]=source,[u,v,w]=target,det=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);if(Math.abs(det)<1e-8)return;
 const aa=((v.x-u.x)*(c.y-a.y)-(w.x-u.x)*(b.y-a.y))/det,cc=((w.x-u.x)*(b.x-a.x)-(v.x-u.x)*(c.x-a.x))/det;
 const bb=((v.y-u.y)*(c.y-a.y)-(w.y-u.y)*(b.y-a.y))/det,dd=((w.y-u.y)*(b.x-a.x)-(v.y-u.y)*(c.x-a.x))/det;
 ctx.save();ctx.beginPath();ctx.moveTo(u.x,u.y);ctx.lineTo(v.x,v.y);ctx.lineTo(w.x,w.y);ctx.closePath();ctx.clip();ctx.transform(aa,bb,cc,dd,u.x-aa*a.x-cc*a.y,u.y-bb*a.x-dd*a.y);ctx.drawImage(image,0,0);ctx.restore();
}

export function createCombatActorRenderer({ctx,worldToScreen,getTransform,assets}){
 const textures=new Map();
 let beastRig=null;
 const legacyBeast=()=>beastRig??=createCombatBeastRig(assets);
 const heightOf=()=>combatActorHeight(getTransform());
 function texture(pose){
  const key=pose.image+':'+pose.crop.join(',');if(textures.has(key))return textures.get(key);
  const [x,y,w,h]=pose.crop,c=assets.makeCanvas(w,h);c.width=w;c.height=h;const cctx=c.getContext('2d');cctx.drawImage(assets.images[pose.image],x,y,w,h,0,0,w,h);
  textures.set(key,c);return c;
 }
 function presentation(actor,b,tick=b.tick){
  if(isSwordStudy(b))return swordStudyPresentation(actor,b,{worldToScreen,transform:getTransform(),images:assets.studyImages});
  const sample=sampleCombatActor(actor,b,tick,assets.actorLibrary),pose=sample.pose,height=heightOf(),scale=height/pose.sourceHeight,p=worldToScreen(actor.x,actor.y);
  const releaseDirection=actor.motion?.direction||actor.facing||sample.direction,releaseSample=sampleCombatFrameAtlas(sample.visualIdentity,{...sample,action:'spell',runtimeAction:'spell',phase:'release',runtimePhase:'release',progress:0,direction:releaseDirection,lookDirection:releaseDirection,facing:releaseDirection.x<-.08?'left':'right'},assets.actorLibrary),atlasRelease=releaseSample?.clipAction==='spell'&&!releaseSample.phaseFallback?releaseSample.pose:null;
  if(pose.atlas){
   const screen=(q,source=pose)=>q?{x:p.x+(q[0]-source.foot[0])*height/source.sourceHeight,y:p.y+(q[1]-source.foot[1])*height/source.sourceHeight}:null;
   return {height,foot:p,hand:screen(pose.anchors.hand),releaseHand:atlasRelease?screen(atlasRelease.hand,atlasRelease):null,swordGrip:screen(pose.anchors.grip),swordTip:screen(pose.anchors.tip),swordTrail:[],swingWeight:0,sample,wholeFrame:{layers:[{image:assets.images[pose.image],crop:pose.crop}],origin:pose.foot,sourceHeight:pose.sourceHeight,key:pose.key}};
  }
  if(sample.beast&&sample.phase!=='down'){
   const frame=legacyBeast().image(sample),k=height/frame.nominalHeight,screen=q=>({x:p.x+q.x*k,y:p.y+q.y*k});
   return {height,foot:p,hand:screen(frame.pose.hand),releaseHand:screen(frame.pose.hand),swordTrail:[],swingWeight:0,sample,beastFrame:frame};
  }
  if(!sample.beast){
   const metadata=combatFrameMetadata(pose),screen=(q,source=pose)=>q?{x:p.x+(q[0]-source.foot[0])*height/source.sourceHeight,y:p.y+(q[1]-source.foot[1])*height/source.sourceHeight}:null;
   const release=atlasRelease||(sample.visualIdentity==='shen-yan'||actor.personId==='person:master'?(releaseDirection.x<-.08?left.castRelease:cast(5)):pose),layers=sample.castIndex===null?[texture(pose)]:[texture({...pose,image:'castWeapon'+sample.castIndex}),texture(pose)];
   return {height,foot:p,hand:screen(metadata.hand),releaseHand:screen(release.hand,release),swordGrip:screen(metadata.grip),swordTip:screen(metadata.tip),swordTrail:[],swingWeight:0,sample,wholeFrame:{layers,origin:pose.foot,sourceHeight:pose.sourceHeight,key:metadata.key}};
  }
  const hand=pose.hand||[pose.foot[0]+(sample.beast||sample.facing==='left'?-1:1)*pose.sourceHeight*.25,pose.foot[1]-pose.sourceHeight*.55];
  const local=deformedPoint((hand[0]-pose.foot[0])*scale,(hand[1]-pose.foot[1])*scale,sample,height);
  const release=sample.facing==='left'?left.castRelease:cast(5),releaseScale=height/release.sourceHeight;
  return {height,foot:p,hand:{x:p.x+local.x*(sample.mirrored?-1:1),y:p.y+local.y},releaseHand:{x:p.x+(release.hand[0]-release.foot[0])*releaseScale,y:p.y+(release.hand[1]-release.foot[1])*releaseScale},sample};
 }
 function draw(actor,b,tick=b.tick){
  const shown=presentation(actor,b,tick),{height,foot,sample}=shown;
  if(shown.study){drawSwordStudyActor(ctx,shown);return shown;}
  if(shown.beastFrame){const f=shown.beastFrame,k=height/f.nominalHeight;ctx.save();ctx.fillStyle='#15291d60';ctx.beginPath();ctx.ellipse(foot.x,foot.y+1,height*.37,height*.055,0,0,Math.PI*2);ctx.fill();ctx.drawImage(f.canvas,foot.x-f.origin.x*k,foot.y-f.origin.y*k,f.canvas.width*k,f.canvas.height*k);ctx.restore();return shown;}
  if(shown.wholeFrame){
   const f=shown.wholeFrame,k=height/f.sourceHeight;ctx.save();ctx.fillStyle='#15291d60';ctx.beginPath();ctx.ellipse(foot.x,foot.y+1,height*(sample.phase==='down'?.42:.22),height*.055,0,0,Math.PI*2);ctx.fill();
   for(const layer of f.layers){
    if(layer.crop){const [x,y,w,h]=layer.crop;ctx.drawImage(layer.image,x,y,w,h,foot.x-f.origin[0]*k,foot.y-f.origin[1]*k,w*k,h*k);}
    else ctx.drawImage(layer,foot.x-f.origin[0]*k,foot.y-f.origin[1]*k,layer.width*k,layer.height*k);
   }
   ctx.restore();return shown;
  }
  const pose=sample.pose,scale=height/pose.sourceHeight,image=texture(pose),w=image.width,h=image.height;
  ctx.save();ctx.translate(foot.x,foot.y);ctx.fillStyle='#15291d60';ctx.beginPath();ctx.ellipse(0,1,height*(sample.phase==='down'?.42:sample.beast?.37:.22),height*.055,0,0,Math.PI*2);ctx.fill();
  // The unarmed ape uses a directional flip; the cultivator uses separate art.
  if(sample.mirrored)ctx.scale(-1,1);
  // The remaining legacy fallback is the beast's down frame only.
  for(const layer of [image]){
   // A fixed grid deforms knees, hip, shoulders and head independently.
   const cols=5,rows=8,vertices=[];
   for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){
    const sx=x*w/cols,sy=y*h/rows,local=deformedPoint((sx-pose.foot[0])*scale,(sy-pose.foot[1])*scale,sample,height);
    vertices.push({source:{x:sx,y:sy},target:local});
   }
   for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const a=vertices[y*(cols+1)+x],b=vertices[y*(cols+1)+x+1],c=vertices[(y+1)*(cols+1)+x],d=vertices[(y+1)*(cols+1)+x+1];
    textureTriangle(ctx,layer,[a.source,b.source,c.source],[a.target,b.target,c.target]);textureTriangle(ctx,layer,[b.source,d.source,c.source],[b.target,d.target,c.target]);
   }
  }
  ctx.restore();
  return presentation(actor,b,tick);
 }
 return {draw,presentation,sample:(actor,b,tick)=>sampleCombatActor(actor,b,tick,assets.actorLibrary),async prewarm(){if(needsLegacyBeastWarmup(assets.actorLibrary))await legacyBeast().prewarm();},cacheStats:()=>{const pixelBytes=[...textures.values()].reduce((n,c)=>n+c.width*c.height*4,0),atlases=Object.keys(assets.images).filter(k=>k.startsWith('frame-atlas:')),atlasPixelBytes=atlases.reduce((n,k)=>n+assets.images[k].width*assets.images[k].height*4,0),human={entries:textures.size,pixelBytes,mode:'whole-frame'},beast=beastRig?.cacheStats()||{entries:0,pixelBytes:0};return {...human,atlases:atlases.length,atlasPixelBytes,registeredIdentities:assets.actorLibrary?.size||0,issues:assets.issues||[],beast,totalPixelBytes:pixelBytes+atlasPixelBytes+beast.pixelBytes};}};
}
