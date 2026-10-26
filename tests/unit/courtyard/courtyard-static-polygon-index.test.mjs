import test from 'node:test';
import assert from 'node:assert/strict';
import {compileStaticPolygon,compileStaticPolygonUnion,immutablePolygon} from '../../../src/simulation/ea-static-polygon-index.mjs';
import {NORTH_YIELD_EAST_GROUND} from '../../../src/simulation/ea-north-yield-ground.mjs';
import {NORTH_LIBRARY_WALK_POLYGONS} from '../../../src/simulation/ea-sect-domain.mjs';
import {NORTH_MEDITATION_WALK_POLYGONS,northMeditationPointOpen} from '../../../src/simulation/ea-north-meditation-geometry.mjs';
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const original=(point,polygon)=>{let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>point.y)!==(b[1]>point.y)&&point.x<(b[0]-a[0])*(point.y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
function* boundaries(polygon){
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++)for(const t of [0,.5]){
  const a=polygon[i],b=polygon[j],p={x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t};yield p;
  for(const epsilon of [1e-12,1e-9,1e-7])for(const [x,y]of [[epsilon,0],[-epsilon,0],[0,epsilon],[0,-epsilon]])yield {x:p.x+x,y:p.y+y};
 }
}
test('indexed edges retain the original parity and arithmetic at all small-polygon boundaries',()=>{
 const polygons=freeze([[[0,0],[4,0],[4,4],[0,4]],[[-4,-4],[-1,-4],[-1,-1],[-3,-1],[-3,-2],[-4,-2]],[[0,0],[4,4],[0,4],[4,0]],[[0,2],[1,2],[2,2]]]);
 for(const polygon of polygons){const query=compileStaticPolygon(polygon);assert.equal(query.indexed,true);for(const p of [...boundaries(polygon),{x:-0,y:0},{x:NaN,y:1},{x:Infinity,y:1}])assert.equal(query.contains(p),original(p,polygon),JSON.stringify(p));}
 const union=compileStaticPolygonUnion(polygons);for(const polygon of polygons)for(const p of boundaries(polygon))assert.equal(union.contains(p),polygons.some(poly=>original(p,poly)));
});
test('only frozen coordinates compile; immutable identity is reused and distinct geometry stays distinct',()=>{
 const mutable=[[0,0],[1,0],[0,1]];assert.equal(immutablePolygon(mutable),false);assert.throws(()=>compileStaticPolygon(mutable),TypeError);Object.freeze(mutable);assert.throws(()=>compileStaticPolygon(mutable),TypeError);
 const a=freeze([[0,0],[1,0],[0,1]]),b=freeze([[10,10],[11,10],[10,11]]);assert.equal(compileStaticPolygon(a),compileStaticPolygon(a));assert.notEqual(compileStaticPolygon(a),compileStaticPolygon(b));assert.equal(compileStaticPolygon(a).contains({x:10.1,y:10.1}),false);assert.equal(compileStaticPolygon(b).contains({x:10.1,y:10.1}),true);
 assert.throws(()=>compileStaticPolygonUnion([a,b]),TypeError);assert.throws(()=>compileStaticPolygon(a,{cellSize:0}),TypeError);
});
test('a very large frozen shape preserves the original predicate through the bounded linear fallback',()=>{
 const polygon=freeze([[-1e9,-1e9],[1e9,-1e9],[1e9,1e9],[-1e9,1e9]]),query=compileStaticPolygon(polygon),union=compileStaticPolygonUnion(Object.freeze([polygon]));assert.equal(query.indexed,false);assert.equal(union.indexed,false);
 for(const p of [{x:0,y:0},{x:1e9,y:1e9},{x:1e9+.01,y:0}]){assert.equal(query.contains(p),original(p,polygon));assert.equal(union.contains(p),original(p,polygon));}
});
test('every authored north polygon retains vertex, midpoint and subnanometre edge-side results',()=>{
 for(const polygon of [...NORTH_LIBRARY_WALK_POLYGONS,...NORTH_MEDITATION_WALK_POLYGONS,...NORTH_YIELD_EAST_GROUND]){const query=compileStaticPolygon(polygon,{cellSize:.25});for(const p of boundaries(polygon))assert.equal(query.contains(p),original(p,polygon),JSON.stringify(p));}
 for(const polygon of NORTH_MEDITATION_WALK_POLYGONS)for(const p of boundaries(polygon))assert.equal(northMeditationPointOpen(p),NORTH_MEDITATION_WALK_POLYGONS.some(poly=>original(p,poly)));
});

test('the authored east ground export is deeply immutable with unchanged point data',()=>{assert(Object.isFrozen(NORTH_YIELD_EAST_GROUND));for(const polygon of NORTH_YIELD_EAST_GROUND){assert(Object.isFrozen(polygon));for(const point of polygon){assert(Object.isFrozen(point));assert.throws(()=>{point[0]+=1;},TypeError);}}});

test('interior box proofs stay conservative at edges, concavities and self intersections',()=>{
 const square=compileStaticPolygon(freeze([[0,0],[4,0],[4,4],[0,4]]));
 assert(square.coversBox({left:1,right:3,top:1,bottom:3}));
 for(const box of [{left:0,right:3,top:1,bottom:3},{left:1,right:5,top:1,bottom:3},{left:3,right:1,top:1,bottom:3},{left:NaN,right:3,top:1,bottom:3}])assert.equal(square.coversBox(box),false);
 const shapes=freeze([[[0,0],[5,0],[5,5],[3,5],[3,2],[2,2],[2,5],[0,5]],[[0,0],[5,5],[0,5],[5,0]]]);
 let proven=0,ambiguous=0;
 for(const polygon of shapes){const q=compileStaticPolygon(polygon);
  for(let x=-.5;x<5.5;x+=.25)for(let y=-.5;y<5.5;y+=.25){const box={left:x-.26,right:x+.51,top:y-.26,bottom:y+.51};
   if(!q.coversBox(box)){ambiguous++;continue;}proven++;
   for(let i=0;i<=8;i++)for(let j=0;j<=8;j++)assert(original({x:box.left+(box.right-box.left)*i/8,y:box.top+(box.bottom-box.top)*j/8},polygon));
  }
 }
 assert(proven>0&&ambiguous>0);
 const notch=compileStaticPolygon(shapes[0]);assert.equal(notch.coversBox({left:1,right:4,top:1,bottom:4}),false);
});
