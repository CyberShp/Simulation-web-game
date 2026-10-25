import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {COURTYARD_EAST_ROAD,EAST_RESIDENCES_WALK_POLYGONS} from '../../../src/simulation/ea-sect-domain.mjs';
import {compileStaticPolygon} from '../../../src/simulation/ea-static-polygon-index.mjs';

const source=fs.readFileSync(new URL('../../../src/simulation/ea-courtyard-east-visible-geometry.mjs',import.meta.url),'utf8');
const originalPairs='function interpolatePairs(pairs,value){const i=interval(pairs.map(p=>p[0]),value),a=pairs[i],b=pairs[i+1];return lerp(a[1],b[1],(value-a[0])/(b[0]-a[0]));}';
const originalInverse='function inverseDepth(x,y){if(x<=ART_WIDTH)return y;return interpolatePairs(columnAt(x).map((v,n)=>[v,depthKeys[n]]),y);}';
// Retain the exact allocation-heavy operations as the independent oracle.
function replaceFunction(code,start,next,replacement){const a=code.indexOf(start),b=code.indexOf(next,a);assert(a>=0&&b>a);return code.slice(0,a)+replacement+code.slice(b);}
let old=replaceFunction(source,'function interpolatePairs(','\nfunction horizontalProjection(',originalPairs);
old=replaceFunction(old,'function inverseDepth(','\nconst joinDepth=',originalInverse);
old=old.replace('interpolatePairs(inverseHorizontalAnchors,x)','interpolatePairs(horizontalAnchors.map(([world,art])=>[art,world]),x)').replace('residencePassageGround.contains(p)','inPolygon(p.x,p.y,EAST_RESIDENCES_WALK_POLYGONS.at(-1))').replace('const direction=visibleBodyDirections[k];clear=eastVisibleGroundPoint({x:p.x+radius*direction.x,y:p.y+radius*direction.y},options);','const angle=k*Math.PI/8;clear=eastVisibleGroundPoint({x:p.x+radius*Math.cos(angle),y:p.y+radius*Math.sin(angle)},options);');
function geometry(code){return vm.runInNewContext(code.replace(/^import .*;$/gm,'').replace(/\bexport /g,'')+';({interpolatePairs,inverseDepth,columnAt,legacyToArt,legacyToWorld,previousEastArtToWorld,eastVisibleGroundPoint,eastVisibleBodyPoint,depthColumnXs,depthKeys})',{COURTYARD_EAST_ROAD,EAST_RESIDENCES_WALK_POLYGONS,compileStaticPolygon});}
const before=geometry(old),after=geometry(source),same=(a,b,label)=>assert(Object.is(a,b),label+': '+a+' != '+b);
const point=(a,b,label)=>{if(a===null||b===null)assert.equal(a,b,label);else{same(a.x,b.x,label+'.x');same(a.y,b.y,label+'.y');}};
function adjacent(value,up){if(value===0)return up?Number.MIN_VALUE:-Number.MIN_VALUE;const b=new DataView(new ArrayBuffer(8));b.setFloat64(0,value);b.setBigUint64(0,b.getBigUint64(0)+(value>0===up?1n:-1n));return b.getFloat64(0);}
let randomState=13579;const random=()=>((randomState=Math.imul(randomState,1664525)+1013904223>>>0)/2**32);

test('pair interpolation keeps exact endpoint, extrapolation and special-input arithmetic',()=>{
 const pairs=[[-10,-500],[0,0],[20,1],[100,400]];
 for(const value of [-Infinity,NaN,-0,0,Infinity,-10000,10000,...pairs.flatMap(([x])=>[adjacent(x,false),x,adjacent(x,true)]),...Array.from({length:1000},()=>random()*300-100)])same(after.interpolatePairs(pairs,value),before.interpolatePairs(pairs,value),'pairs');
});

test('lazy inverse depth and public coordinate maps are bit-exact at all column/depth boundaries and random points',()=>{
 for(const x of [...before.depthColumnXs,1672,-10000,10000].flatMap(x=>[adjacent(x,false),x,adjacent(x,true)]))for(const y of [...before.columnAt(x),-10000,10000].flatMap(y=>[adjacent(y,false),y,adjacent(y,true)]))same(after.inverseDepth(x,y),before.inverseDepth(x,y),'inverse boundary');
 for(const x of [NaN,Infinity,-Infinity,-0,0,1672,6688])for(const y of [NaN,Infinity,-Infinity,-0,0,820,877.6,20000])same(after.inverseDepth(x,y),before.inverseDepth(x,y),'special inverse');
 for(let i=0;i<12000;i++){
  const x=random()*600-240,y=random()*700-300,a=after.legacyToArt(x,y),b=before.legacyToArt(x,y);point(a,b,'world forward');point(after.legacyToWorld(a.x,a.y),before.legacyToWorld(b.x,b.y),'round trip');point(after.previousEastArtToWorld(a.x,a.y),before.previousEastArtToWorld(b.x,b.y),'previous art');
  const ax=random()*16000-5000,ay=random()*7000-3500;point(after.legacyToWorld(ax,ay),before.legacyToWorld(ax,ay),'art inverse');
 }
});

test('indexed passage and constant body directions keep the linear oracle across every edge, flags and radii',()=>{
 const polygon=EAST_RESIDENCES_WALK_POLYGONS.at(-1);assert(Object.isFrozen(polygon)&&polygon.every(Object.isFrozen));let rejected=0;
 const points=[{x:119.97377896003827,y:44},{x:123.20336663517968,y:44.6330226648832},{x:126,y:45.5},{x:127.8,y:46.7},{x:131,y:48},{x:135,y:46.6}];
 for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];for(const t of [0,.5])for(const [dx,dy]of [[0,0],[1e-9,0],[-1e-9,0],[0,1e-9],[0,-1e-9]])points.push({x:a[0]+(b[0]-a[0])*t+dx,y:a[1]+(b[1]-a[1])*t+dy});}
 for(const p of points)for(const residences of [false,true,false]){same(after.eastVisibleGroundPoint(p,{residences}),before.eastVisibleGroundPoint(p,{residences}),'ground');for(const radius of [0,.26,.5,1]){const a=after.eastVisibleBodyPoint(p,radius,{residences}),b=before.eastVisibleBodyPoint(p,radius,{residences});same(a,b,'body');if(!a)rejected++;}}
 assert(rejected>0,'the oracle includes real rejected body positions');
});
