/** Whole-frame presentation of the formally selected creation-only profile. */
import {sampleSwordStudyBody,STUDY_FRAMES,STUDY_PROFILE} from '../../src/simulation/ea-combat-sword-study-frames.mjs';
export const isSwordStudy=scene=>scene?.rulesProfile===STUDY_PROFILE;
export async function loadSwordStudyImages(loadImage){return Object.fromEntries(await Promise.all(Object.values(STUDY_FRAMES).map(async f=>[f.file,await loadImage(f.file)])));}
export function swordStudyPresentation(actor,scene,{worldToScreen,transform,images}){
 const beast=actor.entityKind==='beast'||actor.personId==='person:valley-shanxiao',tick=beast?(scene.worldTick??scene.tick):(actor.poseTick??scene.visualTick??scene.tick),frame=sampleSwordStudyBody(actor,tick),foot=worldToScreen(actor.x,actor.y),scale=frame.scale*transform.sx,height=frame.bodyHeightMeters*transform.sx,m=actor.motion||{},phase=frame.visualPhase;
 const screen=q=>({x:foot.x+(q[0]-frame.root[0])*scale*(frame.mirror?-1:1),y:foot.y+(q[1]-frame.root[1])*scale});
 const samples=Object.fromEntries(Object.entries(frame.samples||{}).map(([k,v])=>[k,screen(v)])),hand={x:foot.x,y:foot.y-.6*transform.sx};
 return {height,foot,hand,releaseHand:hand,swordGrip:null,swordTip:null,swordTrail:[],swingWeight:0,study:{id:actor.id,personId:actor.personId,key:frame.key,file:frame.file,root:frame.root,scale,scaleMeters:frame.scale,mirror:frame.mirror,width:frame.width,height:frame.height,foot,samples,tick},studyFrame:frame,studyImage:images?.[frame.file],sample:{phase,action:m.action,progress:Math.max(0,tick-(m.phaseStartedTick??tick))/Math.max(1,m.phaseDurationTicks||1),frameKey:frame.key,beast,mirrored:frame.mirror,direction:m.direction||actor.facing||{x:1,y:0},facing:frame.mirror?'left':'right',visualIdentity:beast?'shanxiao':'shen-yan'},flash:actor.hitReaction&&(scene.visualTick??scene.tick)-actor.hitReaction.tick<(actor.hitReaction.kind==='heavy'?1.2:.8)};
}
export function drawSwordStudyActor(ctx,shown){
 const {foot,height,studyFrame:f,studyImage:image}=shown,k=shown.study.scale;
 ctx.save();ctx.fillStyle='#14251d55';ctx.beginPath();ctx.ellipse(foot.x,foot.y+1,height*.22,height*.045,0,0,Math.PI*2);ctx.fill();ctx.translate(foot.x,foot.y);if(f.mirror)ctx.scale(-1,1);if(shown.flash)ctx.filter='brightness(1.7) saturate(.8)';
 if(image)ctx.drawImage(image,-f.root[0]*k,-f.root[1]*k,f.width*k,f.height*k);ctx.restore();
}
export function swordStudyActorAt(scene,at,options){
 const actors=[scene.player,...(scene.allies||[]),...(scene.enemies||[])].filter(a=>a.hp>0).sort((a,b)=>b.y-a.y);
 for(const actor of actors){const p=swordStudyPresentation(actor,scene,options),f=p.studyFrame,x=f.root[0]+(at.x-p.foot.x)/(p.study.scale*(f.mirror?-1:1)),y=Math.floor(f.root[1]+(at.y-p.foot.y)/p.study.scale),row=f.rows.find(r=>r[0]===y);if(row){for(let i=1;i<row.length;i+=2)if(x>=row[i]&&x<row[i+1])return actor;}else if(!f.rows.length&&Math.abs(at.x-p.foot.x)<p.height*.25&&at.y<p.foot.y&&at.y>p.foot.y-p.height)return actor;}
 return null;
}
