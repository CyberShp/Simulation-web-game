import test from 'node:test';
import assert from 'node:assert/strict';
import {NORTH_LIBRARY_WALK_POLYGONS,NORTH_LIBRARY_ROADS,northLibraryTerrainContains} from '../../../src/simulation/ea-sect-domain.mjs';
import {NORTH_MEDITATION_VERSION,NORTH_MEDITATION_WALK_POLYGONS,domainNorthMeditationEnabled} from '../../../src/simulation/ea-north-meditation-geometry.mjs';
// The independent reference retains the full original parity and all body samples.
function inside(p,polygon){let result=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>p.y)!==(b[1]>p.y)&&p.x<(b[0]-a[0])*(p.y-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;}
function original(point,radius=0,version=null){
 if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y)||!Number.isFinite(radius)||radius<0)return false;
 const clear=p=>p.y>=1||NORTH_LIBRARY_WALK_POLYGONS.some(poly=>inside(p,poly))||domainNorthMeditationEnabled(version)&&NORTH_MEDITATION_WALK_POLYGONS.some(poly=>inside(p,poly));
 if(!clear(point))return false;
 if(radius)for(let i=0;i<16;i++){const a=i*Math.PI/8;if(!clear({x:point.x+Math.cos(a)*radius,y:point.y+Math.sin(a)*radius}))return false;}
 return true;
}
const check=(p,r=.26,v=null)=>assert.equal(northLibraryTerrainContains(p,r,v),original(p,r,v),JSON.stringify({p,r,v}));
test('north body proof preserves authored edges, union joins and exact epsilon sides',()=>{
 for(const poly of NORTH_LIBRARY_WALK_POLYGONS)for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];for(const t of [0,.5])for(const eps of [0,-1e-12,1e-12,-1e-8,1e-8])check({x:a[0]+(b[0]-a[0])*t+eps,y:a[1]+(b[1]-a[1])*t});}
});
test('a partially covered cell cannot turn a nearby blocked body into a legal one',()=>{
 const cells=new Map();let pair;
 outer:for(const road of NORTH_LIBRARY_ROADS)for(const p of road.centre)for(const dx of [-.3,-.15,0,.15,.3])for(const dy of [-.3,-.15,0,.15,.3]){const q={x:p.x+dx,y:p.y+dy},key=Math.floor(q.x/.25)+'/'+Math.floor(q.y/.25),clear=original(q,.26),old=cells.get(key);if(old&&old.clear!==clear){pair=[old.point,q];break outer;}cells.set(key,{point:q,clear});}
 assert(pair,'fixture must cross a body edge inside the same proof cell');
 for(let i=0;i<100;i++)for(const p of pair)check(p);
});
test('static proof misses retain the live meditation switch across repeated queries',()=>{
 let point;
 outer:for(const poly of NORTH_MEDITATION_WALK_POLYGONS){const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);for(const a of [.25,.5,.75])for(const b of [.25,.5,.75]){const p={x:Math.min(...xs)+(Math.max(...xs)-Math.min(...xs))*a,y:Math.min(...ys)+(Math.max(...ys)-Math.min(...ys))*b};if(original(p,.26,NORTH_MEDITATION_VERSION)&&!original(p,.26,null)){point=p;break outer;}}}
 assert(point,'fixture needs a real meditation-only body position');
 for(let i=0;i<20;i++)for(const version of [null,NORTH_MEDITATION_VERSION,'unknown'])check(point,.26,version);
});
test('radius families, cache pressure and half-plane boundaries keep the original predicate',()=>{
 const points=NORTH_LIBRARY_ROADS.flatMap(r=>r.centre);
 for(const radius of [0,-0,.13,.26,.27,.52,1,8])for(const p of points)check(p,radius);
 for(let i=0;i<9000;i++)check({x:-100-i,y:-100},.26);
 for(const p of points)check(p);
 for(const p of [null,{}, {x:NaN,y:1},{x:1,y:Infinity},{x:-0,y:1},{x:47,y:1.26},{x:47,y:1.26-Number.EPSILON},{x:47,y:1.26+Number.EPSILON}])for(const r of [0,-0,.26,-.26,NaN,Infinity])check(p,r);
});
