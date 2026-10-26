/** Visible-body geometry in metres. This is a pure query: no DOM, image read,
 * clock, actor mutation or damage. The renderer and simulation share its plane. */
import {STUDY_GROUND_Y_SCALE} from './ea-combat-sword-study-frames.mjs';

export const STUDY_SHOT_SPACE='visible-body-v1';
export const STUDY_SHOT_LENGTH=.7;
export const STUDY_SHOT_WIDTH=.1;
export const studyVisiblePoint=p=>({x:p.x,y:p.y*STUDY_GROUND_Y_SCALE});
export const studyWorldPoint=p=>({x:p.x,y:p.y/STUDY_GROUND_Y_SCALE});
export const studyMuzzle=p=>({x:p.x,y:p.y-.6/STUDY_GROUND_Y_SCALE});
export function studyAimDirection(from,to,fallback={x:1,y:0}){
 const a=studyVisiblePoint(from),b=studyVisiblePoint(to),length=Math.hypot(b.x-a.x,b.y-a.y);
 return length>1e-8?{x:(b.x-a.x)/length,y:(b.y-a.y)/length}:{...fallback};
}
export function advanceStudyShot(from,direction,distance){return {x:from.x+direction.x*distance,y:from.y+direction.y*distance/STUDY_GROUND_Y_SCALE};}
export const studyVisibleDistance=(a,b)=>Math.hypot(a.x-b.x,(a.y-b.y)*STUDY_GROUND_Y_SCALE);

function closestRect(a,b,left,top,right,bottom){
 let lo=0,hi=1;const dx=b.x-a.x,dy=b.y-a.y;
 for(const [origin,delta,min,max] of [[a.x,dx,left,right],[a.y,dy,top,bottom]]){
  if(Math.abs(delta)<1e-12){if(origin<min||origin>max){lo=2;break;}}
  else {let p=(min-origin)/delta,q=(max-origin)/delta;if(p>q)[p,q]=[q,p];lo=Math.max(lo,p);hi=Math.min(hi,q);}
 }
 if(lo<=hi&&lo<=1&&hi>=0)return {distance2:0,x:a.x+lo*dx,y:a.y+lo*dy};
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v)),candidates=[];
 for(const p of [a,b]){const x=clamp(p.x,left,right),y=clamp(p.y,top,bottom);candidates.push({distance2:(p.x-x)**2+(p.y-y)**2,x,y});}
 const length2=dx*dx+dy*dy;
 for(const [x,y] of [[left,top],[right,top],[left,bottom],[right,bottom]]){
  const t=length2?clamp(((x-a.x)*dx+(y-a.y)*dy)/length2,0,1):0;
  candidates.push({distance2:(x-a.x-t*dx)**2+(y-a.y-t*dy)**2,x,y});
 }
 return candidates.reduce((best,v)=>v.distance2<best.distance2?v:best);
}

/** Swept visible capsule against the selected native alpha>=64 row intervals.
 * Returns the first contact fraction and an actual opaque-row contact point. */
export function sweepStudyBody(before,after,direction,actor,frame,coreLength=STUDY_SHOT_LENGTH,coreWidth=STUDY_SHOT_WIDTH){
 if(!frame?.rows?.length)return null;
 const scale=frame.scale,sign=frame.mirror?-1:1;
 const foot=studyVisiblePoint(actor),from=studyVisiblePoint(before),to=studyVisiblePoint(after);
 const local=p=>({x:frame.root[0]+(p.x-foot.x)/(scale*sign),y:frame.root[1]+(p.y-foot.y)/scale});
 const half=coreLength/2-coreWidth/2,radius=coreWidth/2/scale,radius2=radius*radius;
 const a=local({x:from.x-direction.x*half,y:from.y-direction.y*half});
 const query=fraction=>{
  const b=local({x:from.x+(to.x-from.x)*fraction+direction.x*half,y:from.y+(to.y-from.y)*fraction+direction.y*half});
  const minY=Math.min(a.y,b.y)-radius,maxY=Math.max(a.y,b.y)+radius,minX=Math.min(a.x,b.x)-radius,maxX=Math.max(a.x,b.x)+radius;
  let best=null;
  for(const row of frame.rows){
   const y=row[0];if(y+1<minY)continue;if(y>maxY)break;
   for(let i=1;i<row.length;i+=2){
    const left=row[i],right=row[i+1];if(right<minX||left>maxX)continue;
    const contact=closestRect(a,b,left,y,right,y+1);
    if(contact.distance2<=radius2+1e-9&&(!best||contact.distance2<best.distance2))best=contact;
   }
  }
  return best;
 };
 if(!query(1))return null;
 let lo=0,hi=1;
 if(query(0))hi=0;else for(let n=0;n<20;n++){const mid=(lo+hi)/2;if(query(mid))hi=mid;else lo=mid;}
 const contact=query(hi);
 return {fraction:hi,contact:studyWorldPoint({x:foot.x+(contact.x-frame.root[0])*scale*sign,y:foot.y+(contact.y-frame.root[1])*scale}),frameKey:frame.key};
}
