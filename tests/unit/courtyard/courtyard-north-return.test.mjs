import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand} from '../../../src/simulation/ea-opening-sim.mjs';
import {meterFindPath,meterSweep,spatialRevision} from '../../../src/simulation/ea-sr-spatial.mjs';
import {COURTYARD_EAST_ROAD,NORTH_LIBRARY_ROADS,NORTH_LIBRARY_APPROACH_VERSION,northLibraryLocalBypassClear} from '../../../src/simulation/ea-sect-domain.mjs';
import {prepareFacilityActivity,releaseBodyActivity} from '../../../src/simulation/ea-facility-activities.mjs';
import {toArt,isArtWalkable} from '../../../apps/courtyard/courtyard-space.mjs';
const flags={domain:true,west:true,northLibrary:true};
function enabled(){let s=validateSave(structuredClone(seed.state));for(const name of ['enableCourtyardTerrain','enableSectDomain','enableNorthLibrary'])s=dispatchCommand(s,{name,args:[]}).state;return s;}
function foot(p){const a=toArt(p.x,p.y);if(!isArtWalkable(a.x,a.y,flags))return false;if(!(p.y<1||p.x>=18&&p.x<=47.62&&p.y>=1&&p.y<=34))return true;for(let i=0;i<16;i++){const q=toArt(p.x+.26*Math.cos(i*Math.PI/8),p.y+.26*Math.sin(i*Math.PI/8));if(!isArtWalkable(q.x,q.y,flags))return false;}return true;}
function visibleRoute(s,from,to){const path=meterFindPath(s,from,to,{maxSnap:0});assert.ok(path);let a=from;for(const b of path){assert.equal(meterSweep(s,a,b).blocked,false);const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.05));for(let i=0;i<=n;i++){const p={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n};assert.ok(foot(p),JSON.stringify(p));}a=b;}return path;}
const near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-7;

test('positive-y rear stairs join the eastern road directly in both directions',()=>{
 const s=enabled(),to={x:135,y:46.6};
 for(const from of [{x:35.85785590544936,y:2.6349666141520927},{x:40.16,y:5.72972972972973},{x:45.89333333333333,y:11.184068278805121}]){
  for(const [a,b]of [[from,to],[to,from]]){const path=visibleRoute(s,a,b);assert(path.some(p=>near(p,COURTYARD_EAST_ROAD[6])));assert(!path.some(p=>near(p,COURTYARD_EAST_ROAD[0])));}
 }
});
test('reselecting a route on the negative-y road keeps its current attachment and forwards all later turns',()=>{
 const s=enabled(),from={x:37.19035400086296,y:-2.9609113263193065},to={x:135,y:46.6};const path=visibleRoute(s,from,to);
 assert(path[0].x<=from.x+1e-7);assert(!path.some(p=>near(p,NORTH_LIBRARY_ROADS[1].centre.at(-1))));
});
test('a facility route refresh on the rear stairs retains the same bed reservation and uses real movement',()=>{
 const s=enabled(),p=s.personsById['person:lu-zhiwei'];releaseBodyActivity(s,p);
 // Rule fixture: an existing GC09 house and a traveller already on the measured stairs.
 const house={id:81,instanceId:'building:yunxiu:81',type:'house',level:1,condition:100,enabled:true,domainSiteId:'site:domain:east-house-1',buildingGridVersion:'building-units-1',interiorLayoutVersion:'adult-furniture-1',transform:{x:132,y:40,orientation:'south'}};
 s.buildings.push(house);s.spatial.geometryRevision++;
 const at={x:35.85785590544936,y:2.6349666141520927};Object.assign(p.mind.scenic,at,{path:[],goal:null,revision:spatialRevision(s)});Object.assign(p.position,at);
 prepareFacilityActivity(s,p,house,'rest',0);const body=structuredClone(s.activitiesById[p.activityId]);assert(body.slotId);const before=structuredClone(p.position),steps=p.mind.scenic.steps;
 // Formal construction changes the same geometry revision; this fixture isolates
 // that invalidation seam from the observed autonomous rest-reselection trigger.
 s.spatial.geometryRevision++;prepareFacilityActivity(s,p,house,'rest',46);
 const current=s.activitiesById[p.activityId];assert.equal(current.id,body.id);assert.equal(current.slotId,body.slotId);assert.equal(current.reservationId,body.reservationId);assert(foot(p.position));
 const moved=Math.hypot(p.position.x-before.x,p.position.y-before.y);assert(moved>0&&moved<=3.162501);assert(moved<=p.mind.scenic.steps-steps+1e-8);assert(!p.mind.scenic.path.some(q=>near(q,COURTYARD_EAST_ROAD[0])));
});
test('reading an old positive-y shortcut preserves its original path until the next real movement',()=>{
 const s=enabled(),at={x:35.84942344694542,y:12.122462866780792};Object.assign(s.master.scenic,at,{path:[...COURTYARD_EAST_ROAD],goal:{...COURTYARD_EAST_ROAD.at(-1)},revision:spatialRevision(s).replace(NORTH_LIBRARY_APPROACH_VERSION,'north-approach-2')});Object.assign(s.master.position,at);
 const raw=JSON.stringify(s);assert.equal(JSON.stringify(validateSave(JSON.parse(raw))),raw);assert.equal(foot(at),false);
});

test('northern local passing accepts the measured stairs and rejects the observed shoulder shortcut',()=>{
 const start={x:41.22666666666667,y:7.243243243243244},bend={x:43.093333333333334,y:8.972972972972972},end={x:44.693333333333335,y:9.892460881934564};
 assert.equal(northLibraryLocalBypassClear(start,[bend,end]),true);
 assert.equal(northLibraryLocalBypassClear(start,[{x:42.5,y:9.5},end]),false);
});
