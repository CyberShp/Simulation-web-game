import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import vm from'node:vm';
const source=fs.readFileSync(new URL('../../../src/simulation/ea-sr-spatial.mjs',import.meta.url),'utf8');
const start=source.indexOf('const measuredSegmentCache='),end=source.indexOf('\nfunction eastVisibleSegmentClear',start),routeStart=source.indexOf('export function visibleBodyRouteClear('),routeEnd=source.indexOf('\n/** Owned activity recovery',routeStart);
assert(start>=0&&end>start&&routeStart>=0&&routeEnd>routeStart);
const snippet=source.slice(start,end),routeSource=source.slice(routeStart,routeEnd).replace('export function','function');
const {remember,locals,buckets,route}=vm.runInNewContext(snippet+'\n'+routeSource+'\n;({remember:rememberedMeasuredSegment,locals:measuredSegmentCache,buckets:equivalentMeasuredSegmentCaches,route:visibleBodyRouteClear})',{roomFrames:s=>s.rooms,visibleBodyAt:(_rooms,indoor)=>!!indoor});
let group=1000;const flags=['guesthouse','mainVisible','northLibrary','eastVisible','residences'];
function rooms(){const r=[{bounds:{x:++group,y:0,width:4,height:4},door:{x:group+2,y:4}}];for(const key of flags)r[key]=false;return r;}
const clone=r=>{const c=structuredClone(r);for(const k of flags)c[k]=r[k];return c;},a={x:1,y:2},b={x:3,y:4};
test('clone same geometry preserves true and false proofs',()=>{for(const answer of [true,false]){let n=0;const r=rooms();assert.equal(remember(r,'body:true',a,b,()=>{n++;return answer;}),answer);assert.equal(remember(clone(r),'body:true',a,b,()=>{n++;return answer;}),answer);assert.equal(n,1);}});
test('each of six room scalars separates geometry',()=>{for(const [field,key]of [['bounds','x'],['bounds','y'],['bounds','width'],['bounds','height'],['door','x'],['door','y']]){const r=rooms(),q=clone(r);q[0][field][key]+=.125;remember(r,'east',a,b,()=>true);assert.equal(remember(q,'east',a,b,()=>false),false);}});
test('all five flags and ordered room list isolate',()=>{for(const key of flags){const r=rooms(),q=clone(r);q[key]=true;remember(r,'east',a,b,()=>true);assert.equal(remember(q,'east',a,b,()=>false),false);}const r=rooms();r.push({bounds:{x:-3,y:5,width:8,height:9},door:{x:0,y:14}});const q=clone(r);q.reverse();remember(r,'east',a,b,()=>true);assert.equal(remember(q,'east',a,b,()=>false),false);});
test('kind and directed endpoints isolate',()=>{const r=rooms();for(const kind of ['body:true','body:false','body:planning-margin','east']){let n=0;assert.equal(remember(r,kind,a,b,()=>{n++;return false;}),false);assert.equal(n,1);}assert.equal(remember(r,'body:true',b,a,()=>true),true);});
test('other kinds stay local even across equivalent rooms',()=>{for(const kind of ['body:false','body:0','body:undefined']){const r=rooms(),q=clone(r);assert.equal(remember(r,kind,a,b,()=>false),false);assert.equal(remember(q,kind,a,b,()=>true),true);}});
test('untrusted caller stays private despite a whitelisted kind',()=>{const r=rooms(),q=clone(r);assert.equal(remember(r,'body:planning-margin',a,b,()=>true,false),true);assert.equal(remember(q,'body:planning-margin',a,b,()=>false),false);assert.equal(remember(clone(r),'body:planning-margin',a,b,()=>true,false),true);});
test('valid-invalid local collisions retain old semantics and do not publish invalid',()=>{const r=rooms(),q=clone(r);assert.equal(remember(r,'east',{x:'1',y:2},b,()=>false),false);assert.equal(remember(r,'east',a,b,()=>true),false);assert.equal(remember(q,'east',a,b,()=>true),true);const t=rooms();assert.equal(remember(t,'east',a,b,()=>true),true);assert.equal(remember(t,'east',{x:'1',y:2},b,()=>false),true);});
test('invalid coordinate values remain private per rooms',()=>{for(const x of ['1',NaN,Infinity,-Infinity,null,undefined,true]){const r=rooms(),q=clone(r);assert.equal(remember(r,'east',{x,y:2},b,()=>false),false);assert.equal(remember(q,'east',{x,y:2},b,()=>true),true);}});
test('invalid room geometry or flags remain private',()=>{for(const value of ['1',NaN,Infinity,null,undefined]){const r=rooms();r[0].bounds.x=value;const q=clone(r);remember(r,'east',a,b,()=>false);assert.equal(remember(q,'east',a,b,()=>true),true);}for(const value of [0,1,'false',null,undefined]){const r=rooms();r.mainVisible=value;const q=clone(r);remember(r,'east',a,b,()=>false);assert.equal(remember(q,'east',a,b,()=>true),true);}});
test('throw does not cache or publish',()=>{const r=rooms(),q=clone(r);assert.throws(()=>remember(r,'east',a,b,()=>{throw Error('sentinel');}),/sentinel/);assert.equal(remember(q,'east',a,b,()=>false),false);});
test('nonboolean results stay local',()=>{const r=rooms(),q=clone(r);assert.equal(remember(r,'east',a,b,()=>7),7);assert.equal(remember(q,'east',a,b,()=>false),false);});
test('signed zero geometry remains distinct',()=>{const r=rooms(),q=clone(r);r[0].bounds.y=-0;q[0].bounds.y=0;remember(r,'east',a,b,()=>true);assert.equal(remember(q,'east',a,b,()=>false),false);});
test('eight geometry bucket bound and original 8192 local clear',()=>{for(let i=0;i<10;i++)remember(rooms(),'east',a,b,()=>true);assert.equal(buckets.size,8);const r=rooms();for(let i=0;i<8192;i++)remember(r,'east',{x:i,y:1},b,()=>true);assert.equal(locals.get(r).size,8192);assert.equal(remember(r,'east',{x:9000,y:1},b,()=>false),false);assert.equal(locals.get(r).size,1);assert.ok([...buckets.values()].every(x=>x.size<=8192));});

test('public nonboolean indoor neither publishes nor consumes a planning proof across rooms',()=>{
 const r=rooms();remember(clone(r),'body:planning-margin',a,b,()=>false);
 assert.equal(route({rooms:r},a,[b],{indoor:'planning-margin'}),true);
 const q=rooms();assert.equal(route({rooms:q},a,[b],{indoor:'planning-margin'}),true);
 assert.equal(remember(clone(q),'body:planning-margin',a,b,()=>false),false);
});
