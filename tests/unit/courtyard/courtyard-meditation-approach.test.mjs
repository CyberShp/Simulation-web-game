import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand} from '../../../src/simulation/ea-opening-sim.mjs';
import {NORTH_MEDITATION_ROADS,NORTH_MEDITATION_FEET} from '../../../src/simulation/ea-north-meditation-geometry.mjs';
import {meterFindPath,meterSweep,spatialRevision} from '../../../src/simulation/ea-sr-spatial.mjs';
import {toArt,isArtWalkable} from '../../../apps/courtyard/courtyard-space.mjs';
const options={terrain:true,domain:true,west:true,valley:true,residences:true,services:true,northLibrary:true,northMeditation:true};
function enabled(){let s=validateSave(structuredClone(seed.state));for(const name of ['enableCourtyardTerrain','enableNorthLibrary','enableNorthMeditation'])s=dispatchCommand(s,{name,args:[]}).state;return s;}
function circle(p){for(let i=-1;i<16;i++){const q=toArt(p.x+(i<0?0:.26*Math.cos(i*Math.PI/8)),p.y+(i<0?0:.26*Math.sin(i*Math.PI/8)));if(!isArtWalkable(q.x,q.y,options))return false;}return true;}
function assertRoute(s,from,to){const route=meterFindPath(s,from,to,{maxSnap:0});assert(route);let at=from;for(const end of route){assert.equal(meterSweep(s,at,end).blocked,false);const n=Math.max(1,Math.ceil(Math.hypot(end.x-at.x,end.y-at.y)/.025));for(let i=0;i<=n;i++)assert(circle({x:at.x+(end.x-at.x)*i/n,y:at.y+(end.y-at.y)*i/n}),`full circle ${JSON.stringify({at,end,i,n})}`);at=end;}return route;}
test('the measured horizontal road and platform branch carry the full accepted foot circle in both directions',()=>{
 const s=enabled(),start=NORTH_MEDITATION_ROADS[0].centre.at(-1),entry=NORTH_MEDITATION_ROADS.find(r=>r.id==='meditation-entry-1').centre;
 // Reproduces the observed route point before the repair without changing terrain.
 assert.equal(circle({x:44.34572246605175,y:-34.38759451489767}),false);
 for(const foot of NORTH_MEDITATION_FEET){const route=assertRoute(s,start,foot.position);for(const point of entry)assert(route.some(p=>Math.hypot(p.x-point.x,p.y-point.y)<1e-7));assertRoute(s,foot.position,start);}
});
test('routing revision is scoped to the explicit meditation domain and reading preserves old route facts',()=>{
 let s=validateSave(structuredClone(seed.state));s=dispatchCommand(s,{name:'enableCourtyardTerrain',args:[]}).state;s=dispatchCommand(s,{name:'enableNorthLibrary',args:[]}).state;
 assert(!spatialRevision(s).includes('meditation-approach-2'));
 s=dispatchCommand(s,{name:'enableNorthMeditation',args:[]}).state;assert(spatialRevision(s).includes('meditation-approach-2'));
 const raw=JSON.stringify(s);assert.equal(JSON.stringify(validateSave(JSON.parse(raw))),raw);
});
