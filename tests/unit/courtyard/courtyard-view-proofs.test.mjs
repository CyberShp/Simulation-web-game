import test from 'node:test';
import assert from 'node:assert/strict';
import {copyViewMetadata,viewWorkRouteAvailable,inheritViewWorkRouteProof} from '../../../apps/courtyard/courtyard-view-proofs.mjs';
import {lifeScenePath,workOpportunity} from '../../../src/simulation/ea-life.mjs';
import {BUILDING_GRID} from '../../../src/simulation/ea-building-grid.mjs';
import {scenicCanStand} from '../../../src/simulation/ea-scene-geometry.mjs';
import {createSectSession,viewSect} from '../../../apps/courtyard/sect-sim.mjs';
import {SECT_DOMAIN} from '../../../src/simulation/ea-sect-domain.mjs';

test('metadata copies preserve complete values, aliases, cycles, sparse arrays and detached mutable results',()=>{
 const shared={text:'原始历史',zero:-0,missing:undefined},array=new Array(4);array[2]=shared;
 const value={first:shared,second:shared,array};value.self=value;Object.defineProperty(value,'__proto__',{value:{label:'ordinary own key'},enumerable:true});
 const first=copyViewMetadata(value),second=copyViewMetadata(value);assert.deepEqual(first,structuredClone(value));assert.equal(first.first,first.second);assert.equal(first.array[2],first.first);assert.equal(first.self,first);assert(!Object.hasOwn(first.array,0));assert(Object.is(first.first.zero,-0));
 first.first.text='edited view';first.__proto__.label='edited key';assert.equal(value.first.text,'原始历史');assert.equal(second.first.text,'原始历史');assert.equal(value.__proto__.label,'ordinary own key');
 for(const rich of [{date:new Date('2026-10-25')},{map:new Map([['key',{n:1}]])},{set:new Set([1,2])},{bytes:new Uint8Array([1,2])}])assert.deepEqual(copyViewMetadata(rich),structuredClone(rich));
 assert.throws(()=>copyViewMetadata({callback(){}}),{name:'DataCloneError'});
 const domain=copyViewMetadata(SECT_DOMAIN);assert.deepEqual(domain,structuredClone(SECT_DOMAIN));domain.initialOpenAreas[0].polygon[0][0]=999;assert.notEqual(SECT_DOMAIN.initialOpenAreas[0].polygon[0][0],999);
});

const HOME='scene:yunxiu-courtyard';
function geometry({plugged=true}={}){
 const building=(id,type,x,y)=>({id,instanceId:`building:${id}`,type,level:1,enabled:true,condition:100,buildingGridVersion:BUILDING_GRID.version,interiorLayoutVersion:'adult-furniture-1',transform:{x,y}});
 const house=building(1,'house',10,10),plug=building(2,'well',12,15),target=building(3,'farm',24,20),list=[house,...(plugged?[plug]:[]),target];
 const s={schemaVersion:6,spatial:{version:'spatial-metres-1',extentVersion:'courtyard-96-1',sceneId:HOME,geometryRevision:1},buildings:list,buildingsById:Object.fromEntries(list.map(b=>[b.instanceId,b]))};
 const person={personId:'person:fixture',mind:{scenic:{x:6,y:12}},location:{kind:'local',sceneId:HOME,x:6,y:12}};
 const move=(x,y)=>{person.mind.scenic.x=x;person.mind.scenic.y=y;person.location.x=x;person.location.y=y;};
 return {s,person,target,house,plug,move};
}
const compare=(s,p,b)=>{const exact=lifeScenePath(s,p,b)!==null;assert.equal(viewWorkRouteAvailable(s,p,b),exact);return exact;};

test('moving a view origin inherits only a formally reachable prefix and rejects an isolated position across the wall',()=>{
 const {s,person,target,move}=geometry();assert(compare(s,person,target));
 move(6.125,12.375);assert(compare(s,person,target));
 move(13,14);assert(scenicCanStand(s,person.mind.scenic),'the isolated indoor stance itself is legal');assert.equal(compare(s,person,target),false,'the blocked door prevents a prefix back outside');
 move(6.125,12.375);assert(compare(s,person,target),'negative evidence must not survive a changed origin');
 move(12.5,16);assert.equal(scenicCanStand(s,person.mind.scenic),false);assert.equal(compare(s,person,target),false,'an origin inside a real solid cannot inherit reachability');
});

test('changed navigation geometry invalidates a formerly positive indoor-to-outdoor proof',()=>{
 const {s,person,target,plug,move}=geometry({plugged:false});move(13,14);assert(compare(s,person,target));
 s.buildings.push(plug);s.buildingsById[plug.instanceId]=plug;s.spatial.geometryRevision++;assert.equal(compare(s,person,target),false);
 plug.transform.x=40;s.spatial.geometryRevision++;assert(compare(s,person,target));
 person.location.sceneId='scene:prison';assert.equal(viewWorkRouteAvailable(s,person,target),lifeScenePath(s,person,target)!==null,'a foreign scene uses the original exact path instead of a home proof');
});

test('atomic world copies retain geometry proofs but recheck a moved origin across the blocked wall',()=>{
 const {s,person,target,move}=geometry();assert(compare(s,person,target));const next=structuredClone(s);inheritViewWorkRouteProof(s,next);
 move(13,14);assert.equal(compare(next,person,next.buildingsById[target.instanceId]),false);
 const changed=structuredClone(s);changed.buildings[1].transform.x=40;changed.spatial.geometryRevision++;inheritViewWorkRouteProof(s,changed);assert(compare(changed,person,changed.buildingsById[target.instanceId]));
});

test('the work predicate keeps the original eligibility order and complete views remain detached',()=>{
 const session=createSectSession(),s=session.state,p=s.personsById[s.homeMemberIds[0]];
 for(const b of s.buildings)for(const kind of ['normal','away','occupied','injured','exhausted']){
  const person=structuredClone(p);if(kind==='away')person.mind.away={kind:'fixture'};if(kind==='occupied'){person.activityId='fixture:busy';s.activitiesById['fixture:busy']={kind:'sr-fixture'};}if(kind==='injured')person.wound=90;if(kind==='exhausted')person.energy=0;
  assert.deepEqual(workOpportunity(s,person,b,{checkPath:viewWorkRouteAvailable}),workOpportunity(s,person,b));delete s.activitiesById['fixture:busy'];
 }
 const farm=s.buildings.find(b=>b.type==='farm'),injured=structuredClone(p);injured.wound=90;let calls=0;
 assert.equal(workOpportunity(s,injured,farm,{checkPath:()=>{calls++;return false;}}).reason,'建筑入口不通，先留出连通道路。');assert.equal(calls,1,'the path still precedes the later injury refusal');
 injured.mind.away={kind:'fixture'};calls=0;assert.equal(workOpportunity(s,injured,farm,{checkPath:()=>{calls++;return false;}}).reason,'正在山外，归院后再权衡差事。');assert.equal(calls,0,'the existing earlier refusal still precedes the path');
 const before=JSON.stringify(s),first=viewSect(session),second=viewSect(session);assert.equal(JSON.stringify(s),before);assert.deepEqual(first,second);
 first.provenance.kind='view mutation';first.domain.initialOpenAreas[0].polygon[0][0]=999;assert.notEqual(session.provenance.kind,'view mutation');assert.notEqual(second.domain.initialOpenAreas[0].polygon[0][0],999);assert.equal(JSON.stringify(s),before);
});
