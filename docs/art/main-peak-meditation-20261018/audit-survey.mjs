import fs from 'node:fs';
import {createCanvas,loadImage} from '/Volumes/Media/immortal/node_modules/@napi-rs/canvas/index.js';
import {toArt,toWorld} from '../../../apps/courtyard/courtyard-space.mjs';
const dir=new URL('./',import.meta.url),s=JSON.parse(fs.readFileSync(new URL('ground-and-join-survey.json',dir)));
function inside(p,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a[1]>p[1])!==(b[1]>p[1]))&&(p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]))hit=!hit;}return hit;}
const worldPolys=s.walkPolygons.map(v=>v.world.map(p=>[p.x,p.y]));
const solids=s.solids.map(v=>v.worldGround.map(p=>[p.x,p.y]));
const body=(p)=>Array.from({length:32},(_,i)=>[p.x+.26*Math.cos(i*Math.PI/16),p.y+.26*Math.sin(i*Math.PI/16)]);
function test(p){return body(p).filter(q=>!worldPolys.some(poly=>inside(q,poly))||solids.some(poly=>inside(q,poly)));}
function segmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p.x-a[0])*dx+(p.y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a[0]-t*dx,p.y-a[1]-t*dy);}
const feet=s.feet.map(f=>({...f,nearestSolidBodyClearanceMetres:Math.min(...solids.flatMap(poly=>poly.map((a,i)=>segmentDistance(f.world,a,poly[(i+1)%poly.length]))))-.26,failures:test(f.world)}));
let count=0;const failures=[];
for(const road of s.roads)for(let i=1;i<road.world.length;i++){const a=road.world[i-1],b=road.world[i],n=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/.025));for(let k=0;k<=n;k++){const p={x:a.x+(b.x-a.x)*k/n,y:a.y+(b.y-a.y)*k/n},bad=test(p);count++;if(bad.length)failures.push({road:road.id,p,art:toArt(p.x,p.y),bad:bad.length});}}
const output={kind:'Survey polygon body-circle check; formal simulation collision and Electron acceptance separate',bodyRadius:.26,directions:32,stepMax:.025,feet,routeSamples:count,routeFailureCount:failures.length,routeFailures:failures.slice(0,40)};
fs.writeFileSync(new URL('body-clearance-audit.json',dir),JSON.stringify(output,null,2)+'\n');
for(const [file,origin,points,poly]of [['join-v2.png',s.join,s.roads[0].native,s.walkPolygons[3].native],['complete-v4.png',s.tile,s.feet.map(f=>f.native),s.ground.native]]){const c=createCanvas(1672,941),ctx=c.getContext('2d');ctx.drawImage(await loadImage(new URL(file,dir).pathname),0,0,1672,941);ctx.strokeStyle='#31ffff';ctx.lineWidth=2;ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.stroke();points.forEach(([x,y],i)=>{ctx.strokeStyle='#ff3a9d';ctx.beginPath();ctx.arc(x,y,5,0,7);ctx.stroke();ctx.font='bold 16px sans-serif';ctx.fillStyle='#fff';ctx.fillText(String(i),x+7,y-8);});for(const f of failures){const p=f.art,x=p.x-origin.x,y=p.y-origin.y;if(x>=0&&y>=0&&x<1672&&y<941){ctx.fillStyle='#ff000080';ctx.fillRect(x-2,y-2,4,4);}}fs.writeFileSync(new URL(file.replace('.png','-survey.png'),dir),c.toBuffer('image/png'));}
console.log(JSON.stringify({feet:feet.map(f=>[f.suffix,f.failures.length]),routeSamples:count,routeFailureCount:failures.length,failures:failures.slice(0,4)}));
