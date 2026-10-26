import test from 'node:test';
import assert from 'node:assert/strict';
import {courtyardSouthGroundPoint as clear} from '../../../src/simulation/ea-courtyard-visible-ground.mjs';
test('north ground queries retain their enabled condition across repeated coordinates',()=>{
 const p={x:34.018181818181816,y:.8};
 for(let i=0;i<4;i++){assert.equal(clear(p,{northLibrary:false}),false);assert.equal(clear(p,{northLibrary:true}),true);}
});
test('nearby points on opposite sides of a ground boundary remain distinct after cache eviction',()=>{
 const a={x:47.426675463145095,y:12.922794800859787},b={x:47.4266754831451,y:12.922794820859789};
 for(let i=0;i<3;i++){assert.equal(clear(a,{northLibrary:true}),true);assert.equal(clear(b,{northLibrary:true}),false);}
 for(let i=0;i<65537;i++)assert.equal(clear({x:i,y:-1}),true);
 assert.equal(clear(a,{northLibrary:true}),true);assert.equal(clear(b,{northLibrary:true}),false);
});

test('many rows in one numeric column keep enabled branches distinct under cache pressure',()=>{
 const x=34.018181818181816,p={x,y:.8};
 assert.equal(clear(p,{northLibrary:false}),false);assert.equal(clear(p,{northLibrary:true}),true);
 for(let i=0;i<70000;i++)assert.equal(clear({x,y:-1-i},{northLibrary:i%2===0}),true);
 assert.equal(clear(p,{northLibrary:false}),false);assert.equal(clear(p,{northLibrary:true}),true);
 assert.equal(clear({x,y:-0},{northLibrary:false}),clear({x,y:0},{northLibrary:false}));
});

test('non-numeric coordinate queries cannot seed numeric cache entries',()=>{
 const paved={x:29.03326810176125,y:20.571428571428573},outside={x:0,y:20};
 for(const p of [paved,outside]){
  const expected=clear(p);assert.equal(expected,true);
  for(const invalid of [{x:String(p.x),y:p.y},{x:p.x,y:String(p.y)},{x:new Number(p.x),y:p.y}]){
   assert.equal(clear(invalid),false);assert.equal(clear(p),expected);
  }
 }
 for(const x of [null,false,undefined]){assert.equal(clear({x,y:20}),false);assert.equal(clear(outside),true);}
});
