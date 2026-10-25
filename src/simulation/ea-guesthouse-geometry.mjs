/** U-167 / T-GC15-20261023: surveyed candidate, activated only after art read-back. */
export const GUESTHOUSE_LAYOUT_VERSION='east-road-guesthouse-1';
export const GUESTHOUSE_SITE_ID='site:domain:gc-15';
export const GUESTHOUSE_CANDIDATE=Object.freeze({
 siteId:GUESTHOUSE_SITE_ID,type:'guesthouse',x:66,y:14,width:6,height:6,
 door:Object.freeze({x:69,y:20}),access:Object.freeze({x:69,y:20.6}),
 roadJoin:Object.freeze({x:69,y:33.08}),
 beds:Object.freeze([Object.freeze({x:67.2,y:17}),Object.freeze({x:70.8,y:17})]),
});
export function guesthouseGroundEnabled(s){return s?.spatial?.guesthouse?.version===GUESTHOUSE_LAYOUT_VERSION;}
// Source pixels measured on east-guesthouse-empty-v3; tile starts at global x=1672.
export const GUESTHOUSE_ART_GROUND=Object.freeze([
 [[620,300],[900,330],[1030,400],[1000,430],[820,435],[740,435],[600,390],[530,350]],
 [[760,425],[816,425],[816,484],[748,484]],
]);
const inside=(x,y,poly)=>{let result=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;};
export function guesthouseArtGroundPoint(a){return GUESTHOUSE_ART_GROUND.some(poly=>inside(a.x-1672,a.y,poly));}
export const GUESTHOUSE_EXTERIOR_ART=Object.freeze([
 {id:'guesthouse-west-wall',polygon:[[631,337],[745,361],[745,378],[630,353]]},
 {id:'guesthouse-east-wall',polygon:[[838,376],[928,388],[1005,338],[1005,353],[930,400],[838,391]]},
]);
