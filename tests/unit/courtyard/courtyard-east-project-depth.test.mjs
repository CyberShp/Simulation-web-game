import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=process.env.IMMORTAL_EAST_SOURCE_ROOT||fileURLToPath(new URL('../../../',import.meta.url)),file=path.join(root,'src/simulation/ea-courtyard-east-visible-geometry.mjs'),source=fs.readFileSync(file,'utf8');
const domain=await import(pathToFileURL(path.join(root,'src/simulation/ea-sect-domain.mjs')));
const {compileStaticPolygon}=await import(pathToFileURL(path.join(root,'src/simulation/ea-static-polygon-index.mjs')));
// Exact pre-change forward-depth function, from fixed-runtime 80e05c75…bd7db.
const original="function projectDepth(x,baseY){if(x<=ART_WIDTH)return baseY;const values=columnAt(x);return interpolatePairs(depthKeys.map((v,n)=>[v,values[n]]),baseY);}";
const begin=source.indexOf('function projectDepth('),end=source.indexOf('\nfunction inverseDepth(',begin);assert(begin>0&&end>begin);
function geometry(code){return vm.runInNewContext(code.replace(/^import .*;$/gm,'').replace(/\bexport /g,'')+';({projectDepth,inverseDepth,columnAt,legacyToArt,legacyToWorld,previousEastArtToWorld,eastVisibleGroundPoint,eastVisibleBodyPoint,depthColumnXs,depthKeys})',{compileStaticPolygon,COURTYARD_EAST_ROAD:domain.COURTYARD_EAST_ROAD,EAST_RESIDENCES_WALK_POLYGONS:domain.EAST_RESIDENCES_WALK_POLYGONS});}
const before=geometry(source.slice(0,begin)+original+source.slice(end)),after=geometry(source);
const same=(a,b,label)=>assert(Object.is(a,b),`${label}: ${a} != ${b}`),point=(a,b,label)=>{if(a===null||b===null)assert.equal(a,b,label);else{same(a.x,b.x,label+'.x');same(a.y,b.y,label+'.y');}};
function adjacent(value,up){if(value===0)return up?Number.MIN_VALUE:-Number.MIN_VALUE;const bytes=new DataView(new ArrayBuffer(8));bytes.setFloat64(0,value);bytes.setBigUint64(0,bytes.getBigUint64(0)+(value>0===up?1n:-1n));return bytes.getFloat64(0);}

test('forward depth keeps exact floating-point results across dense samples, every interval boundary and extrapolation',()=>{
 for(let x=1560;x<=7200;x+=17.75)for(let y=-250;y<=2300;y+=23.75)same(after.projectDepth(x,y),before.projectDepth(x,y),'dense raw depth');
 const xs=[...before.depthColumnXs,1672,-10000,10000].flatMap(x=>[adjacent(x,false),x,adjacent(x,true)]),ys=[...before.depthKeys,-10000,10000].flatMap(y=>[adjacent(y,false),y,adjacent(y,true)]);
 for(const x of xs)for(const y of ys)same(after.projectDepth(x,y),before.projectDepth(x,y),'boundary raw depth');
 for(const x of [NaN,Infinity,-Infinity,-0,0,1672,1672+Number.EPSILON*1672,6688])for(const y of [NaN,Infinity,-Infinity,-0,0,820,877.6,20000]){same(after.projectDepth(x,y),before.projectDepth(x,y),'special raw depth');same(after.inverseDepth(x,y),before.inverseDepth(x,y),'special inverse');}
});
test('public forward, inverse and previous-art transforms retain exact coordinates including the road join',()=>{
 for(let x=0;x<=170;x+=.75)for(let y=-10;y<=110;y+=1.25){const a=after.legacyToArt(x,y),b=before.legacyToArt(x,y);point(a,b,'world forward');point(after.legacyToWorld(a.x,a.y),before.legacyToWorld(b.x,b.y),'round trip');point(after.previousEastArtToWorld(a.x,a.y),before.previousEastArtToWorld(b.x,b.y),'previous art');}
 for(const x of [1422,1536,1597,1672,1747,1822,1922,3344,5016,5350,5516,5703,5796,6312,6688,7200])for(const dx of [-1e-8,0,1e-8])for(const y of [-300,0,380,407,545,810,877.6,941,1600]){point(after.legacyToWorld(x+dx,y),before.legacyToWorld(x+dx,y),'art inverse boundary');const a=after.columnAt(x+dx),b=before.columnAt(x+dx);for(let i=0;i<a.length;i++)same(a[i],b[i],'unchanged inverse column');}
 for(const [x,y]of [[NaN,1],[1,Infinity],[-Infinity,1]]){assert.equal(after.legacyToArt(x,y),null);assert.equal(after.legacyToWorld(x,y),null);}
});
test('east visible ground and full-body predicates retain every dense decision with and without residence passage',()=>{
 for(let x=118;x<=157;x+=.5)for(let y=28;y<=60;y+=.5)for(const residences of [false,true]){const p={x,y},options={residences};same(after.eastVisibleGroundPoint(p,options),before.eastVisibleGroundPoint(p,options),'ground');for(const radius of [0,.26])same(after.eastVisibleBodyPoint(p,radius,options),before.eastVisibleBodyPoint(p,radius,options),'body');}
 for(const p of [{x:119.97377896003827,y:44},{x:123.20336663517968,y:44.6330226648832},{x:126,y:45.5},{x:127.8,y:46.7},{x:131,y:48},{x:135,y:46.6}])for(const radius of [.26,.5])for(const residences of [false,true])same(after.eastVisibleBodyPoint(p,radius,{residences}),before.eastVisibleBodyPoint(p,radius,{residences}),'recorded stance');
});
