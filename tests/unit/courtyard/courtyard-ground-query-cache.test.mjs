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
