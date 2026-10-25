import test from 'node:test';
import assert from 'node:assert/strict';
import {compileStaticPolygon} from '../../../src/simulation/ea-static-polygon-index.mjs';
import {NORTH_LIBRARY_WALK_POLYGONS,NORTH_LIBRARY_ROADS,northLibraryTerrainContains} from '../../../src/simulation/ea-sect-domain.mjs';
import {NORTH_MEDITATION_VERSION,NORTH_MEDITATION_WALK_POLYGONS,domainNorthMeditationEnabled} from '../../../src/simulation/ea-north-meditation-geometry.mjs';
// The previous two-metre edge index is the independent terrain reference.
const library=NORTH_LIBRARY_WALK_POLYGONS.map(p=>compileStaticPolygon(p,{cellSize:2})),meditation=NORTH_MEDITATION_WALK_POLYGONS.map(p=>compileStaticPolygon(p,{cellSize:2}));
function reference(point,radius=0,version=null){
 if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y)||!Number.isFinite(radius)||radius<0)return false;
 const open=p=>p.y>=1||library.some(q=>q.contains(p))||domainNorthMeditationEnabled(version)&&meditation.some(q=>q.contains(p));
 if(!open(point))return false;
 if(radius)for(let i=0;i<16;i++){const a=i*Math.PI/8;if(!open({x:point.x+Math.cos(a)*radius,y:point.y+Math.sin(a)*radius}))return false;}
 return true;
}
test('north terrain retains all sixteen body samples and the live meditation-version branch',()=>{
 const points=NORTH_LIBRARY_ROADS.flatMap(r=>r.centre.flatMap(p=>[{...p},{x:p.x+.26,y:p.y},{x:p.x,y:p.y-.26}]));
 for(let x=24;x<=72;x+=1.5)for(let y=-48;y<=2;y+=1.5)points.push({x,y});
 for(const point of points)for(const version of [null,NORTH_MEDITATION_VERSION,'unknown'])for(const radius of [0,.26])assert.equal(northLibraryTerrainContains(point,radius,version),reference(point,radius,version),JSON.stringify({point,radius,version}));
});
test('north terrain keeps finite, negative-radius and exact threshold boundary handling',()=>{
 const points=[null,{}, {x:NaN,y:-3},{x:47,y:Infinity},{x:-0,y:1},{x:47,y:1},{x:47,y:1-Number.EPSILON},{x:47,y:1+Number.EPSILON}];
 for(const point of points)for(const radius of [0,-0,.26,-.26,NaN,Infinity])for(const version of [null,NORTH_MEDITATION_VERSION])assert.equal(northLibraryTerrainContains(point,radius,version),reference(point,radius,version));
});
