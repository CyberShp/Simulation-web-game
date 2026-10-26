import test from 'node:test';
import assert from 'node:assert/strict';
import {HOME_STAIRS_WALK,WALK_POLYGONS,courtyardMainArtWalkable} from '../../../src/simulation/ea-courtyard-visible-ground.mjs';
import {compileStaticPolygon} from '../../../src/simulation/ea-static-polygon-index.mjs';

// Original point predicate: boundary survivors must keep this exact arithmetic.
const inPolygon=(x,y,points)=>{let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
const segmentDistance=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);};
const rocks=[[315,850],[395,829],[490,850],[515,941],[300,941]];
const corridors=[
 {width:24,points:[[485,524],[420,539],[342,565],[260,573],[195,601],[149,650],[106,698],[84,733],[120,772],[175,792]]},
 {width:20,points:[[191,603],[157,583],[114,564],[78,562]]},
 {width:25,points:[[1056,552],[1147,542],[1233,515],[1318,484],[1401,448],[1457,410],[1536,380]]},
 {width:20,points:[[705,610],[714,638],[713,656],[702,675],[682,700],[668,740],[650,755],[620,795],[674,792],[744,762]]},
 {width:22,points:[[632,757],[590,758],[545,783],[499,806],[450,820]]},
 {width:18,points:[[175,792],[250,821],[330,852],[390,857],[465,883],[534,870],[590,847],[620,819],[674,792]]},
 {width:18,points:[[550,865],[608,860],[633,847],[650,818],[628,805]]},
 {width:20,points:[[668,740],[695,722],[712,690]]},
];
const segments=corridors.flatMap(c=>c.points.slice(1).map((b,i)=>({a:c.points[i],b,width:c.width,left:Math.min(c.points[i][0],b[0])-c.width-1e-7,right:Math.max(c.points[i][0],b[0])+c.width+1e-7,top:Math.min(c.points[i][1],b[1])-c.width-1e-7,bottom:Math.max(c.points[i][1],b[1])+c.width+1e-7})));
function original(x,y){
 if(x>1672||y<407&&!inPolygon(x,y,HOME_STAIRS_WALK))return false;
 if(inPolygon(x,y,rocks))return false;
 return WALK_POLYGONS.some(p=>inPolygon(x,y,p))||segments.some(c=>x>=c.left&&x<=c.right&&y>=c.top&&y<=c.bottom&&segmentDistance(x,y,c.a,c.b)<=c.width);
}
function observation(fn,x,y){try{return {result:fn(x,y)};}catch(error){return {error:error.name,message:error.message};}}

test('main ground broad phase preserves polygon vertices and edge samples on both sides',()=>{
 const eps=[-1e-6,-1e-7,-1e-9,0,1e-9,1e-7,1e-6];
 for(const p of [...WALK_POLYGONS,rocks])for(let i=0;i<p.length;i++)for(const q of [p[i],[(p[i][0]+p[(i+1)%p.length][0])/2,(p[i][1]+p[(i+1)%p.length][1])/2]])for(const dx of eps)for(const dy of eps){const x=q[0]+dx,y=q[1]+dy;assert.equal(courtyardMainArtWalkable(x,y),original(x,y),`${x}/${y}`);}
});

test('main ground broad phase preserves open ground, corridors and outer limits',()=>{
 for(let x=50;x<=1700;x+=11)for(let y=280;y<=970;y+=11)assert.equal(courtyardMainArtWalkable(x,y),original(x,y),`${x}/${y}`);
 for(const c of corridors)for(let i=1;i<c.points.length;i++)for(const d of [-1e-7,0,1e-7]){const x=(c.points[i-1][0]+c.points[i][0])/2,y=(c.points[i-1][1]+c.points[i][1])/2;for(const [dx,dy]of [[c.width+d,0],[-c.width-d,0],[0,c.width+d],[0,-c.width-d]])assert.equal(courtyardMainArtWalkable(x+dx,y+dy),original(x+dx,y+dy));}
});

test('main ground preserves primitive coercion and original exceptional inputs',()=>{
 const values=[NaN,Infinity,-Infinity,-0,0,undefined,null,'','abc','650','350','1e3','0x280',650,350,true,false,650n,350n,Symbol('point')];
 for(const x of values)for(const y of values)assert.deepEqual(observation(courtyardMainArtWalkable,x,y),observation(original,x,y),`${String(x)}/${String(y)}`);
});

test('positive interior cells preserve original rays at cell edges, foreground rocks and the stair threshold',()=>{
 const compiled=WALK_POLYGONS.map(p=>compileStaticPolygon(Object.freeze(p.map(v=>Object.freeze([...v]))),{cellSize:16}));
 let cells=0;
 for(let row=0;row<59;row++)for(let col=0;col<105;col++){
  const b={left:col*16-1e-7,right:(col+1)*16+1e-7,top:row*16-1e-7,bottom:(row+1)*16+1e-7};
  if(b.left<0||b.right>1672||b.top<407||b.bottom>941||!(b.right<300-1e-7||b.left>515+1e-7||b.bottom<829-1e-7||b.top>941+1e-7)||!compiled.some(p=>p.coversBox(b)))continue;
  cells++;
  for(const x of [col*16,(col+.5)*16,(col+1)*16])for(const y of [row*16,(row+.5)*16,(row+1)*16])for(const e of [-1e-7,0,1e-7])assert.equal(courtyardMainArtWalkable(x+e,y+e),original(x+e,y+e),`${x+e}/${y+e}`);
 }
 assert.equal(cells,585);
 for(const x of [299.9999999,300,315,395,490,515,515.0000001,592,599,650,710,742,755,774])for(const y of [406.9999999,407,407.0000001,416,828.9999999,829,829.0000001,850,941])assert.equal(courtyardMainArtWalkable(x,y),original(x,y),`${x}/${y}`);
});
