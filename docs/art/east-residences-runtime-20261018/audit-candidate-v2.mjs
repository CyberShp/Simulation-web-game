/** Read-only geometry audit. Run from any cwd with Node; outputs stay beside this file. */
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {toArt as legacyToArt,toWorld as legacyToWorld} from '../../../apps/courtyard/courtyard-space.mjs';
import {RESIDENCES_JOIN as join,RESIDENCES_IMAGES as images,RESIDENCES_LAYOUT as layout,RESIDENCES_SITES as sites,RESIDENCES_ROADS as roads,RESIDENCES_WALK_POLYGONS as walk,RESIDENCES_PROJECTION_CANDIDATE as config,createResidencesCandidateProjection} from '../../../apps/courtyard/courtyard-residences-layout.mjs';
const out=fileURLToPath(new URL('.',import.meta.url));
const projection=createResidencesCandidateProjection({legacyToArt,legacyToWorld});
const round=n=>Math.round(n*1e5)/1e5;
const xy=p=>[round(p.x),round(p.y)];
const local=(x,y)=>{const p=projection.toArt(x,y);return [p.x-layout.x,p.y];};
const box=p=>[Math.min(...p.map(q=>q[0])),Math.min(...p.map(q=>q[1])),Math.max(...p.map(q=>q[0])),Math.max(...p.map(q=>q[1]))];
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const dseg=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
const boundary=(p,poly)=>Math.min(...poly.map((a,i)=>dseg(p,a,poly[(i+1)%poly.length])));
function inside(p,poly){if(boundary(p,poly)<1e-7)return true;let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
function intersects(a,b,c,d){const c1=cross(a,b,c),c2=cross(a,b,d),c3=cross(c,d,a),c4=cross(c,d,b);return c1*c2<0&&c3*c4<0||Math.min(dseg(a,c,d),dseg(b,c,d),dseg(c,a,b),dseg(d,a,b))<1e-7;}
function polyTouch(a,b){return a.some(p=>inside(p,b))||b.some(p=>inside(p,a))||a.some((p,i)=>b.some((q,j)=>intersects(p,a[(i+1)%a.length],q,b[(j+1)%b.length])));}
function minGapBelow(bounds,polygons){let gap=Infinity;for(let x=bounds[0];x<=bounds[2];x+=.25){for(const poly of polygons){const hits=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];if((a[0]<=x&&b[0]>=x||b[0]<=x&&a[0]>=x)&&a[0]!==b[0])hits.push(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));}if(hits.length)gap=Math.min(gap,Math.min(...hits)-bounds[3]);}}return round(gap);}
const legacyX=[-64,-40,0,12,36,50.72,90,120,132,138,156,159.5,160];
let oldCount=0,oldFailures=[];
for(const x of legacyX)for(const [y] of config.depth){const old=legacyToArt(x,y),candidate=projection.toArt(x,y);oldCount++;if(JSON.stringify(old)!==JSON.stringify(candidate))oldFailures.push([x,y]);if(JSON.stringify(projection.toWorld(old.x,old.y))!==JSON.stringify(legacyToWorld(old.x,old.y)))oldFailures.push(['inverse',x,y]);}
let roundTripMax=0,monotoneFailures=[];
for(let x=160;x<=186;x+=.25){let previous=-Infinity;for(let y=0;y<=96;y+=.2){const p=projection.toArt(x,y),q=projection.toWorld(p.x,p.y);roundTripMax=Math.max(roundTripMax,Math.hypot(q.x-x,q.y-y));if(p.y<=previous)monotoneFailures.push([x,y]);previous=p.y;}}
for(const [y] of config.depth){let previous=-Infinity;for(let x=160;x<=186;x+=.05){const p=projection.toArt(x,y);if(p.x<=previous)monotoneFailures.push(['x',x,y]);previous=p.x;}}
const levelReports=sites.map(site=>{
  const {x,y}=site.candidate.world;
  const levels=[1,2,3].map(level=>{const size=4+2*level,world=rect(x,y,size,size),polygon=world.map(p=>local(...p)),bounds=box(polygon),entryWorld=[x+size/2,y+size+.6],entry=local(...entryWorld),circle=Array.from({length:128},(_,i)=>local(entryWorld[0]+config.personRadiusMetres*Math.cos(i*Math.PI/64),entryWorld[1]+config.personRadiusMetres*Math.sin(i*Math.PI/64)));
    return {level,sizeMetres:size,worldPolygon:world,artPolygon:polygon.map(p=>p.map(round)),artBounds:bounds.map(round),entranceWorld:entryWorld,entranceArt:entry.map(round),entranceCircleArtBounds:box(circle).map(round),entryOnMeasuredWalk:walk.some(p=>inside(entry,p)),entryOnOriginalBranch:roads.find(r=>r.id===`branch:${site.planId}`).polygons.some(p=>inside(entry,p)),entryCircleWithinLevel1Standing:circle.every(p=>inside(p,site.standingPolygon)),minimumStandingMarginPx:round(Math.min(...circle.map(p=>boundary(p,site.standingPolygon)*(inside(p,site.standingPolygon)?1:-1)))),publicRoadIntersections:roads.filter(r=>['upper','lower','west','west-entry'].includes(r.id)&&r.polygons.some(p=>polyTouch(polygon,p))).map(r=>r.id),roadNorthernEdgeGapPx:minGapBelow(bounds,roads.find(r=>r.id===(site.planId==='GC-10'?'lower':'upper')).polygons)};});
  const first=levels[0],visualBounds=box(site.footprint),b=first.artBounds;
  return {planId:site.planId,id:site.id,levels,measuredEntrance:site.entrance,entranceDeltaPx:first.entranceArt.map((v,i)=>round(v-site.entrance[i])),doorNetHeightPx:site.door.netHeightPx,adultHeightPx:111,verticalDoorSparePx:site.door.netHeightPx-111,level1BodyGroundComparison:{measuredBounds:visualBounds,candidateBounds:b,measuredWidth:visualBounds[2]-visualBounds[0],candidateWidth:round(b[2]-b[0]),leftInsetPx:round(b[0]-visualBounds[0]),rightInsetPx:round(visualBounds[2]-b[2]),measuredVerticesOutsideCandidate:site.footprint.filter(p=>!inside(p,first.artPolygon))}};
});
const maxPairs=[];
for(let a=0;a<sites.length;a++)for(let b=a+1;b<sites.length;b++){const p=sites[a].candidate.maxPlot,q=sites[b].candidate.maxPlot,dx=Math.max(p.x-q.x-q.width,q.x-p.x-p.width,0),dy=Math.max(p.y-q.y-q.height,q.y-p.y-p.height,0);maxPairs.push({plans:[sites[a].planId,sites[b].planId],overlap:p.x<q.x+q.width&&p.x+p.width>q.x&&p.y<q.y+q.height&&p.y+p.height>q.y,axisGapMetres:[dx,dy],shortestDistanceMetres:round(Math.hypot(dx,dy))});}
const roadSamples=roads.map(r=>({id:r.id,center:r.center.map(p=>({art:p,world:xy(projection.toWorld(p[0]+layout.x,p[1]))})),centerOutsideMeasuredWalk:r.center.filter(p=>!walk.some(poly=>inside(p,poly)))}));

let boundaryMaxWorldError=0,boundaryMaxPixelError=0,boundaryChecks=0;
const bx=[160,162,165,168,171,174,177,180,184,186].flatMap(x=>[x-1e-8,x,x+1e-8]);
const by=config.depth.map(p=>p[0]).concat([50,60,72]).flatMap(y=>[y-1e-8,y,y+1e-8]);
for(const x of bx)for(const y of by){const a=projection.toArt(x,y),w=projection.toWorld(a.x,a.y),b=projection.toArt(w.x,w.y);boundaryChecks++;boundaryMaxWorldError=Math.max(boundaryMaxWorldError,Math.hypot(w.x-x,w.y-y));boundaryMaxPixelError=Math.max(boundaryMaxPixelError,Math.hypot(a.x-b.x,a.y-b.y));}
let extrapolationMaxError=0;
for(const x of [159.9,160.1,162,180,186,190])for(const y of [-20,0,40,55,72,96,120]){const a=projection.toArt(x,y),w=projection.toWorld(a.x,a.y);extrapolationMaxError=Math.max(extrapolationMaxError,Math.hypot(w.x-x,w.y-y));}
const invalidInputReturnsNull=[[NaN,40],[165,Infinity],[-Infinity,72]].every(p=>projection.toArt(...p)===null&&projection.toWorld(...p)===null);
const joinWorld=join.center.map(p=>projection.toWorld(...p));
const joinFailures=[];let joinSampleCount=0;
for(let i=1;i<joinWorld.length;i++){const a=joinWorld[i-1],b=joinWorld[i],n=Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/.1);for(let j=0;j<=n;j++){const w={x:a.x+(b.x-a.x)*j/n,y:a.y+(b.y-a.y)*j/n};joinSampleCount++;for(let k=0;k<32;k++){const q=projection.toArt(w.x+.26*Math.cos(k*Math.PI/16),w.y+.26*Math.sin(k*Math.PI/16));if(!inside([q.x,q.y],join.walkPolygon)){joinFailures.push({segment:i,world:xy(w),foot:xy(q)});break;}}}}
const hash=path=>createHash('sha256').update(fs.readFileSync(new URL(path,import.meta.url))).digest('hex');
const report={status:'static-candidate-v2-review',basis:'61 + complete-v2, empty-v4, construction-v1, join-v3; no world step or pathfinding invoked',sources:{...Object.fromEntries(Object.entries(images).map(([key,file])=>[key,{path:'assets/courtyard/'+file,sha256:hash('../../../assets/courtyard/'+file)}])),join:{path:'assets/courtyard/'+join.image,sha256:hash('../../../assets/courtyard/'+join.image)},measurements:hash('./asset-measurements-v2.json'),candidateModule:hash('../../../apps/courtyard/courtyard-residences-layout.mjs')},projection:{...config,transitionWorld:[160,162],inverseMethod:'Invert blended depth at fixed artX, then invert the horizontal row at recovered worldY; piecewise-linear analytic inversion.'},checks:{legacyDelegation:{sampleCount:oldCount,failures:oldFailures},invertibility:{sampleGrid:'x160..186 step0.25,y0..96 step0.2',maxRoundTripErrorMetres:roundTripMax,monotoneFailures,boundaryChecks,boundaryMaxWorldError,boundaryMaxPixelError,extrapolationMaxError,invalidInputReturnsNull},maxPlotPairs:maxPairs,publicRoadIntersectionCount:levelReports.reduce((n,s)=>n+s.levels.at(-1).publicRoadIntersections.length,0),join:{sampleCount:joinSampleCount,world:joinWorld.map(xy),footCircleRadiusMetres:.26,failures:joinFailures}},sites:levelReports,roads:roadSamples,join,pending:[{id:'upgrade-artwork',detail:'Future level2/3 houses and their moving door/step geometry must be authored. Cleared approach ground exists; current artwork is level1.'},{id:'runtime-stage-composition',detail:'Scene combinations and final joining blend require renderer inspection. This report describes static images and coordinates.'}],limits:['Imported legacy functions are the current callback baseline; the old-domain test verifies unchanged delegation, not a historical runtime snapshot.','Footprints are calibrated to measured ground-contact bounds. Roof occlusion and indoor wall geometry remain separate.','The terrain polygons are candidates measured on empty-v4; formal navigation evidence belongs to the spatial task.']};
fs.writeFileSync(out+'candidate-audit-v2.json',JSON.stringify(report,null,2)+'\n');
const poly=(p,color,dash='')=>'<polygon points="'+p.map(q=>q.join(',')).join(' ')+'" fill="'+color+'" fill-opacity="0.06" stroke="'+color+'" stroke-width="2" '+(dash?'stroke-dasharray="'+dash+'"':'')+'/>';
const render=source=>'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1672 941"><image href="../../../assets/courtyard/'+source+'" width="1672" height="941"/>'+roads.flatMap(r=>r.polygons.map(p=>poly(p,'#31ffdc'))).join('')+levelReports.map((s,i)=>poly(s.levels[0].artPolygon,'#ffed4a')+poly(s.levels[2].artPolygon,'#fa52ff','8 5')+poly(sites[i].footprint,'#ff5340')+'<circle cx="'+s.measuredEntrance[0]+'" cy="'+s.measuredEntrance[1]+'" r="5" fill="#fff" stroke="#111"/>').join('')+'<rect x="10" y="7" width="650" height="29" fill="#172b31" opacity=".85"/><text x="20" y="27" fill="#fff" font-size="15" font-family="sans-serif">Candidate v2: yellow=6m, magenta=10m, red=measured ground, cyan=road</text></svg>';
fs.writeFileSync(out+'candidate-overlay-complete-v2.svg',render(images.complete));
fs.writeFileSync(out+'candidate-overlay-empty-v2.svg',render(images.empty));
console.log(JSON.stringify({checks:report.checks,sites:levelReports.map(s=>({plan:s.planId,l1:s.levels[0],max:s.levels[2],comparison:s.level1BodyGroundComparison}))},null,2));
