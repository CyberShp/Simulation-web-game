import test from 'node:test';
import assert from 'node:assert/strict';
import {northLibraryYieldSegmentProven,northLibraryYieldPointClear} from '../../../src/simulation/ea-sect-domain.mjs';

const offsets=[[.025,0],[-.025,0],[0,.025],[0,-.025]];
test('a proven segment keeps every original centre and planning-offset north query true',()=>{
 const fixtures=[
  [{x:15.981438515081207,y:25.714285714285715},{x:19.440860215053767,y:25.714285714285715}],
  [{x:19.440860215053767,y:25.714285714285715},{x:18.5,y:24.5}],
 ];
 for(const [a,b] of fixtures)for(const planning of [false,true]){
  assert.equal(northLibraryYieldSegmentProven(a,b,planning),true);
  const length=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(length/.025));
  for(let i=0;i<=n;i++){const p={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n};assert.equal(northLibraryYieldPointClear(p),true);if(planning&&length>1&&i>0&&i<n)for(const [dx,dy]of offsets)assert.equal(northLibraryYieldPointClear({x:p.x+dx,y:p.y+dy}),true);}
 }
});

test('planning requires its additional margin and cannot reuse a narrower ordinary proof',()=>{
 const a={x:20,y:23},b={x:19.5,y:22.5};
 assert.equal(northLibraryYieldSegmentProven(a,b,false),true);
 assert.equal(northLibraryYieldSegmentProven(a,b,true),false);
});

test('union joins and ambiguous boundary boxes retain the original sampled fallback',()=>{
 for(const [a,b]of [
  [{x:19.440860215053767,y:25.714285714285715},{x:28,y:12}],
  [{x:15.657331136738057,y:25.6},{x:15.981438515081207,y:25.714285714285715}],
 ])for(const planning of [false,true])assert.equal(northLibraryYieldSegmentProven(a,b,planning),false);
});

test('unsupported, nonfinite and extreme endpoints never grant a segment proof',()=>{
 const invalid=[null,undefined,{x:NaN,y:12},{x:Infinity,y:12},{x:'25',y:12},{x:25n,y:12},{x:Symbol('x'),y:12},{x:1024,y:12},{x:1024+1e-9,y:12},{x:-1024,y:12},{x:-1024-1e-9,y:12},{x:1e100,y:12}];
 for(const p of invalid)for(const planning of [false,true]){assert.equal(northLibraryYieldSegmentProven(p,{x:25,y:20},planning),false);assert.equal(northLibraryYieldSegmentProven({x:25,y:20},p,planning),false);}
});
