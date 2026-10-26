import assert from 'node:assert/strict';
import test from 'node:test';
import {advanceExpeditionWalk,expeditionLandingClear,validateExpeditionWalk} from '../../../src/simulation/ea-disciple-expedition-walk.mjs';
const V='scene:valley',HOME='scene:yunxiu-courtyard';
const person=(id,x,y,sceneId=V)=>({personId:id,lifeStatus:'alive',location:{kind:'local',sceneId,x,y},position:{kind:'scene',sceneId,x,y},mind:{}});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const tests=[];
function run(name,configure){test(name,()=>{const state=configure(),{s,walkers,stepLimit=500}=state;let min=Infinity,maximumStep=0,done=false;for(let step=0;step<stepLimit;step++){for(const w of walkers){const before={...w.p.location};advanceExpeditionWalk(s,w.p,w.j,w.route,{returning:w.returning});const displacement=dist(before,w.p.location);maximumStep=Math.max(displacement,maximumStep);assert(displacement<=.12000001,'step budget');validateExpeditionWalk(w.j,m=>assert.fail(m));for(const other of Object.values(s.personsById)){if(other===w.p||other.lifeStatus==='dead'||other.location.sceneId!==w.p.location.sceneId)continue;const separation=dist(w.p.location,other.location);min=Math.min(min,separation);assert(separation>=.5299999,'physical clearance');}}if(walkers.every(w=>!w.route.length)){done=true;tests.push({name,steps:step+1,min,maximumStep,final:walkers.map(w=>w.p.location)});break;}}assert(done,`${name} remains stuck`);});}
const make=(p,route,returning=false)=>({p,route,j:{phase:returning?'valley-return':'scouting',valleyTrail:[]},returning});
run('stationary companion at its actual exit',()=>{const a=person('a',8.9,27),b=person('b',8.2,27),w=make(a,Array.from({length:17},(_,i)=>({x:7+i*.12,y:27})),true);w.j.valleyTrail=w.route;return{s:{personsById:{a,b}},walkers:[w]}});
run('two opposing independent bodies',()=>{const a=person('a',7,27),b=person('b',10,27),wa=make(a,[{x:10,y:27}]),wb=make(b,[{x:7,y:27}]);wa.j.scoutPath=wa.route;wb.j.scoutPath=wb.route;return{s:{personsById:{a,b}},walkers:[wa,wb]}});
run('stationary master shares local terrain',()=>{const a=person('a',7,27),master=person('person:master',8.2,27),w=make(a,[{x:10,y:27}]);w.j.scoutPath=w.route;return{s:{personsById:{a,master}},walkers:[w]}});
run('other scene body does not block',()=>{const a=person('a',7,27),b=person('b',8.2,27,HOME),w=make(a,[{x:10,y:27}]);w.j.scoutPath=w.route;return{s:{personsById:{a,b}},walkers:[w]}});
run('dead body follows existing live collision rule',()=>{const a=person('a',7,27),b=person('b',8.2,27),w=make(a,[{x:10,y:27}]);b.lifeStatus='dead';w.j.scoutPath=w.route;return{s:{personsById:{a,b}},walkers:[w]}});
test('inherited overlap escapes monotonically',()=>{
 const a=person('a',8.2,27),b=person('b',8.2,27),s={personsById:{a,b}},w=make(a,[{x:10,y:27}]);w.j.scoutPath=w.route;let before=0;for(let n=0;n<10;n++){advanceExpeditionWalk(s,a,w.j,w.route);const d=dist(a.location,b.location);assert(d>before,'old overlap escapes monotonically');before=d;}tests.push({name:'inherited exact overlap escapes monotonically',distance:before});
});
test('arrival preserves physical space',()=>{
 const a=person('a',7,27),b=person('b',8.2,27),s={personsById:{a,b}};assert(!expeditionLandingClear(s,a,{x:8.2,y:27},V));assert(expeditionLandingClear(s,a,{x:7,y:27},V));tests.push({name:'occupied arrival rejects and legal nearby accepts'});
});
