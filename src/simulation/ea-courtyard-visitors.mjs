/** Persisted local arrival legs for visitors using the courtyard's southern road. */
import {advanceScenic,scenicFindPath,scenicDistance,geometryRevision,scenicCanStand} from './ea-scenic.mjs';
import {spatialEnabled,SPATIAL_SCENE} from './ea-sr-spatial.mjs';

export const COURTYARD_VISIT_VERSION='courtyard-south-road-1';
// Metre coordinates calibrated to the existing southern steps and courtyard paving.
export const COURTYARD_VISITOR_ROAD=Object.freeze([
 {x:26.62857142857143,y:50},{x:26.58823529411765,y:48},{x:26.125,y:45.275},
 {x:25.56,y:43.333333333333336},{x:25.866666666666667,y:40},
 {x:26.273858921161825,y:37.93814432989691},{x:26.916201117318437,y:35.77777777777778},
 {x:27.730382293762574,y:32.81481481481482},{x:26.295302013422816,y:29.11111111111111},
 {x:27.906976744186046,y:26.285714285714285},
].map(Object.freeze));
export const courtyardVisitorVisible=p=>p?.position?.kind==='scene'&&p.position.sceneId!==SPATIAL_SCENE.id||!['waiting','departed'].includes(p?.courtyardVisit?.phase);
export const courtyardVisitorReady=p=>p?.position?.kind==='scene'&&p.position.sceneId!==SPATIAL_SCENE.id||!p?.courtyardVisit||p.courtyardVisit.phase==='present';
const point=p=>({x:p.x,y:p.y});
const body=p=>p.mind||p;
function sync(s,p){const sc=body(p).scenic;p.position={kind:'scene',sceneId:SPATIAL_SCENE.id,x:sc.x,y:sc.y};}
function record(s,p,phase,target){
 const entry=point(COURTYARD_VISITOR_ROAD[0]);
 p.courtyardVisit={version:COURTYARD_VISIT_VERSION,phase,source:'south-mountain-road',entry,target:point(target),waypoints:[],waypointIndex:0,startedTick:null,arrivedTick:null,departedTick:null,lastTick:s.worldTick};
 return p.courtyardVisit;
}
export function initOpeningVisitors(s){
 if(!spatialEnabled(s))return;
 for(const [id,target] of [[s.story.opening.visitorId,COURTYARD_VISITOR_ROAD.at(-1)],[s.story.opening.secondVisitorId,{x:29,y:27}],[s.story.artisan.personId,{x:29,y:25}]]){
  const p=s.personsById[id],visit=record(s,p,'waiting',target);
  Object.assign(body(p).scenic,visit.entry,{path:[],goal:null,revision:geometryRevision(s)});sync(s,p);
 }
}
export function beginCourtyardVisit(s,p,{target=COURTYARD_VISITOR_ROAD.at(-1),reason='沿山路前往院前。'}={}){
 if(!spatialEnabled(s))return false;
 const visit=record(s,p,'arriving',target),sc=body(p).scenic;
 Object.assign(sc,visit.entry,{path:[],goal:null,revision:geometryRevision(s)});delete sc.destinationId;delete sc.activitySlotId;delete sc.bodyYield;
 visit.startedTick=s.worldTick;visit.waypoints=COURTYARD_VISITOR_ROAD.slice(1).map(point);
 if(scenicDistance(visit.waypoints.at(-1),target)>.01)visit.waypoints.push(point(target));
 body(p).activity='walk';body(p).reason=reason;sync(s,p);return true;
}
export function departCourtyardVisitor(s,p){
 if(!spatialEnabled(s))return false;
 const prior=p.courtyardVisit,target=prior?.target||point(body(p).scenic),visit=prior||record(s,p,'present',target);
 visit.phase='departing';visit.waypoints=[...COURTYARD_VISITOR_ROAD].reverse().map(point);visit.waypointIndex=0;visit.lastTick=s.worldTick;
 body(p).scenic.path=[];body(p).scenic.goal=null;body(p).activity='walk';body(p).reason='沿山路下山。';return true;
}
export function advanceCourtyardVisitor(s,p,budget=3.6){
 const visit=p?.courtyardVisit;if(!visit||!['arriving','departing'].includes(visit.phase)||visit.lastTick>=s.worldTick||p.lifeStatus==='dead')return false;
 visit.lastTick=s.worldTick;const sc=body(p).scenic,target=visit.waypoints[visit.waypointIndex];
 if(!target||sc.bodyYield)return false;
 if(!sc.path.length||sc.revision!==geometryRevision(s)||!sc.goal||scenicDistance(sc.goal,target)>.01){
  const path=scenicFindPath(s,sc,target,{maxSnap:0});
  if(!path){body(p).reason='山路暂阻，等通路恢复后继续。';return false;}
  sc.path=path;sc.goal=point(target);sc.revision=geometryRevision(s);
 }
 advanceScenic(sc,budget,s);sync(s,p);
 if(scenicDistance(sc,target)>.01)return false;
 visit.waypointIndex++;sc.path=[];sc.goal=null;
 if(visit.waypointIndex<visit.waypoints.length)return false;
 const arrival=visit.phase==='arriving';visit.phase=arrival?'present':'departed';visit[arrival?'arrivedTick':'departedTick']=s.worldTick;
 body(p).activity='rest';body(p).reason=arrival?'已经沿山路来到院前，正在等候。':'已经沿山路离开山院。';return true;
}
export function advanceOpeningVisitors(s){
 const opening=s.story.opening;if(!opening)return;
 for(const [id,ready] of [[opening.visitorId,opening.hallPhase==='complete'&&s.story.step>=1],[opening.secondVisitorId,s.story.step>=2]]){
  const p=s.personsById[id],visit=p?.courtyardVisit;if(!visit||s.homeMemberIds.includes(id))continue;
  if(visit.phase==='waiting'&&ready){beginCourtyardVisit(s,p,{target:visit.target});continue;}
  advanceCourtyardVisitor(s,p);
 }
}
export function validateCourtyardVisitors(s){
 const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y),tick=n=>Number.isSafeInteger(n)&&n>=0&&n<=s.worldTick;
 for(const p of Object.values(s.personsById||{})){
  const v=p.courtyardVisit;if(!v)continue;
  if(v.version!==COURTYARD_VISIT_VERSION||v.source!=='south-mountain-road'||!['waiting','arriving','present','departing','departed'].includes(v.phase)||!finite(v.entry)||!finite(v.target)||!Array.isArray(v.waypoints)||v.waypoints.length>32||!v.waypoints.every(finite)||!Number.isSafeInteger(v.waypointIndex)||v.waypointIndex<0||v.waypointIndex>v.waypoints.length||!tick(v.lastTick)||[v.startedTick,v.arrivedTick,v.departedTick].some(n=>n!==null&&!tick(n))||['arriving','departing'].includes(v.phase)&&v.waypointIndex>=v.waypoints.length)throw Error('访客山路行程记录异常，原存档保留。');
  if(v.phase==='waiting'&&(v.startedTick!==null||v.arrivedTick!==null||v.departedTick!==null||v.waypoints.length)||v.phase==='arriving'&&(v.startedTick===null||v.arrivedTick!==null||v.departedTick!==null)||v.phase==='present'&&v.arrivedTick===null||v.phase==='departed'&&v.departedTick===null||scenicDistance(v.entry,COURTYARD_VISITOR_ROAD[0])>.001)throw Error('访客到离场时序异常，原存档保留。');
  if(['arriving','departing'].includes(v.phase)&&(!scenicCanStand(s,body(p).scenic)||p.position?.sceneId!==SPATIAL_SCENE.id))throw Error('访客山路位置异常，原存档保留。');
 }
 return true;
}
