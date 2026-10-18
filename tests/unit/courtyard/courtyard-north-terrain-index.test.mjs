import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../../../apps/courtyard/sect-seed.mjs';
import {validateSave,dispatchCommand} from '../../../src/simulation/ea-opening-sim.mjs';
import {NORTH_LIBRARY_WALK_POLYGONS,northLibraryTerrainContains,domainNorthMeditationEnabled} from '../../../src/simulation/ea-sect-domain.mjs';
import {NORTH_MEDITATION_VERSION,northMeditationPointOpen} from '../../../src/simulation/ea-north-meditation-geometry.mjs';
import {meterCanStand,meterSweep,meterFindPath} from '../../../src/simulation/ea-sr-spatial.mjs';
// Frozen pre-index predicate is the oracle for this performance-only change.
const bounds=new WeakMap();
function inside(p,poly){let b=bounds.get(poly);if(!b){const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);b={left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};bounds.set(poly,b);}if(p.x<b.left||p.x>b.right||p.y<b.top||p.y>b.bottom)return false;let open=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p.y)!==(b[1]>p.y)&&p.x<(b[0]-a[0])*(p.y-a[1])/(b[1]-a[1])+a[0])open=!open;}return open;}
function original(p,r=0,v=null){if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y)||!Number.isFinite(r)||r<0)return false;const open=q=>q.y>=1||NORTH_LIBRARY_WALK_POLYGONS.some(poly=>inside(q,poly))||domainNorthMeditationEnabled(v)&&northMeditationPointOpen(q);if(!open(p))return false;if(r)for(let i=0;i<16;i++){const a=i*Math.PI/8;if(!open({x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r}))return false;}return true;}
function equal(p,r=0,v=null){assert.equal(northLibraryTerrainContains(p,r,v),original(p,r,v),JSON.stringify({p,r,v}));}
test('fixed north polygon index retains every vertex, edge and nearby boundary result',()=>{
 for(const poly of NORTH_LIBRARY_WALK_POLYGONS)for(let i=0;i<poly.length;i++){
  const a=poly[i],b=poly[(i+1)%poly.length];for(const p of [{x:a[0],y:a[1]},{x:(a[0]+b[0])/2,y:(a[1]+b[1])/2}]){
   equal(p);for(const e of [-1e-7,1e-7]){equal({x:p.x+e,y:p.y});equal({x:p.x,y:p.y+e});}
  }
 }
});
test('north query memo preserves exact coordinates, radii, versions and eviction results',()=>{
 let n=31821;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
 for(let i=0;i<40000;i++){const p={x:-80+random()*300,y:-55+random()*55};equal(p,i%7===0?.26:0,i%3===0?NORTH_MEDITATION_VERSION:null);}
 for(const poly of NORTH_LIBRARY_WALK_POLYGONS.slice(0,5))for(const [x,y] of poly.slice(0,5)){equal({x,y});equal({x:x+1e-7,y});equal({x,y:y-1e-7});}
 for(const p of [{x:45.15,y:-42.02489626556017},{x:47,y:-3},{x:-39,y:34},{x:NaN,y:0},{x:Infinity,y:0},{x:0,y:-Infinity},null])for(const r of [0,.26,.6,NaN,Infinity,-1])for(const v of [null,'unknown',NORTH_MEDITATION_VERSION])equal(p,r,v);
});
test('fixed ground memo leaves live region versions and building obstacles authoritative',()=>{
 let s=validateSave(structuredClone(seed.state));for(const name of ['enableCourtyardTerrain','enableNorthLibrary','enableNorthMeditation'])s=dispatchCommand(s,{name,args:[]}).state;
 const p={x:53,y:-13},from={x:50,y:-13};assert(meterCanStand(s,p));assert.equal(meterSweep(s,from,p).blocked,false);assert(meterFindPath(s,from,p,{maxSnap:0}));
 // Geometry fixture: adding/removing a real building solid exercises cache invalidation.
 const b={id:99,instanceId:'building:yunxiu:99',type:'well',level:1,condition:100,enabled:true,buildingGridVersion:'building-units-1',transform:{x:52,y:-14,orientation:'south'}};s.buildings.push(b);
 assert.equal(meterCanStand(s,p),false);assert.equal(meterSweep(s,from,p).blocked,true);assert.equal(meterFindPath(s,from,p,{maxSnap:0}),null);
 b.transform.x=56;assert(meterCanStand(s,p));assert.equal(meterSweep(s,from,p).blocked,false);assert(meterFindPath(s,from,p,{maxSnap:0}));
 const upper={x:45.15,y:-42.02489626556017};assert(meterCanStand(s,upper));delete s.spatial.northMeditation;assert.equal(meterCanStand(s,upper),false);s.spatial.northMeditation={version:NORTH_MEDITATION_VERSION,openedAtTick:s.worldTick};assert(meterCanStand(s,upper));
 const before=JSON.stringify(s);for(let i=0;i<5;i++){meterCanStand(s,p);meterSweep(s,from,p);meterFindPath(s,from,p,{maxSnap:0});}assert.equal(JSON.stringify(s),before);
});
