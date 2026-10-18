import test from 'node:test';
import assert from 'node:assert/strict';
import {COURTYARD_WEST_ROAD,plannedSites} from '../../../src/simulation/ea-sect-domain.mjs';
import {toArt,toWorld,isArtWalkable,routeArt,REVIEW_POINTS,DOMAIN_ART_LEFT} from '../../../apps/courtyard/courtyard-space.mjs';
import {CourtyardRenderer} from '../../../apps/courtyard/courtyard-renderer.mjs';
import {WEST_LAYOUT,DOMAIN_PLAN} from '../../../apps/courtyard/courtyard-west-layout.mjs';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const renderer=()=>new CourtyardRenderer({getContext:()=>({}),getBoundingClientRect:()=>({width:1672,height:941})});

test('west projection preserves metre positions and original courtyard anchors',()=>{
 assert.equal(DOMAIN_ART_LEFT,-1672);
 for(let y=24;y<=38;y+=.37)for(let x=-30;x<=16;x+=.31){const a=toArt(x,y),w=toWorld(a.x,a.y);close(w.x,x);close(w.y,y);}
 const entry=toArt(WEST_LAYOUT.entrance.x,WEST_LAYOUT.entrance.y);
 close(entry.x,WEST_LAYOUT.entranceArt.x);close(entry.y,WEST_LAYOUT.entranceArt.y);
 for(const [x,y,u,v] of [[28,12.6,680,407],[12.5,45.5,560,860],[135,46.6,6021,420]]){const a=toArt(x,y);close(a.x,u);close(a.y,v);}
});

test('the formal west road stays on visible ground and closes with the old east extent',()=>{
 for(let i=1;i<COURTYARD_WEST_ROAD.length;i++){
  const a=COURTYARD_WEST_ROAD[i-1],b=COURTYARD_WEST_ROAD[i],n=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.025);
  for(let j=0;j<=n;j++){const art=toArt(a.x+(b.x-a.x)*j/n,a.y+(b.y-a.y)*j/n);assert.ok(isArtWalkable(art.x,art.y),JSON.stringify({segment:i,art}));}
 }
 assert.equal(isArtWalkable(-800,200),false);
 assert.equal(isArtWalkable(-800,850),false);
 assert.equal(isArtWalkable(WEST_LAYOUT.entranceArt.x,WEST_LAYOUT.entranceArt.y,{west:false}),false);
 assert.equal(isArtWalkable(WEST_LAYOUT.entranceArt.x,WEST_LAYOUT.entranceArt.y,{domain:false}),false);
});

test('manual waypoints reach west lumber through visible bridge ground',()=>{
 const from=REVIEW_POINTS.courtyard.art,route=routeArt(from,WEST_LAYOUT.entranceArt);
 assert.ok(route?.length>50);assert.deepEqual(route.at(-1),WEST_LAYOUT.entranceArt);
 let previous=from;
 for(const p of route){assert.ok(Math.hypot(p.x-previous.x,p.y-previous.y)<=18.00001);assert.ok(isArtWalkable(p.x,p.y));previous=p;}
 assert.ok(route.some(p=>Math.abs(p.x)<18&&Math.abs(p.y-562)<25));
 assert.equal(routeArt(from,WEST_LAYOUT.entranceArt,{west:false}),null);
});

test('west stage, camera and picking follow actual site identity',()=>{
 const r=renderer(),site={id:WEST_LAYOUT.siteId,status:'building',progress:0,buildingId:'building:west'};
 r.view={domain:{enabled:true,westEnabled:true,sites:[site]},buildings:[]};
 r.westStages={available:{name:'ground'},building:{name:'construction'},complete:{name:'complete'}};
 assert.equal(r.westImage().name,'ground');r.focusLocation(WEST_LAYOUT.entrance);assert.ok(r.camera.x<0);
 let point=r.artToScreen({x:-1672+450,y:600});assert.equal(r.pickDomainSite(point.x,point.y),site);assert.equal(r.pickBuilding(point.x,point.y),null);
 site.progress=.001;assert.equal(r.westImage().name,'construction');
 site.status='complete';site.buildingId='building:yunxiu:3';const building={id:'3',type:'lumber',x:-18,y:28};r.view.buildings=[building];
 assert.equal(r.westImage().name,'complete');point=r.artToScreen({x:-1672+450,y:420});assert.equal(r.pickBuilding(point.x,point.y),building);
 const person={id:'person:west',indoor:false};r.hitRegions=[{person,p:{x:-1300,y:510},x:-1320,y:399,w:40,h:111}];
 point=r.artToScreen({x:-1300,y:430});assert.deepEqual(r.pickPeople(point.x,point.y),[]);
 r.hitRegions[0].p.y=561.2;r.hitRegions[0].y=450.2;point=r.artToScreen({x:-1300,y:480});assert.equal(r.pickPeople(point.x,point.y)[0],person);
 r.view.domain.westEnabled=false;r.constrain();assert.ok(r.camera.x>=0);
});

test('all 31 numbered planning locations select their exact catalog identity',()=>{
 const r=renderer();r.view={domain:{plannedSites}};r.showOverview();const t=r.planningTransform();
 assert.equal(plannedSites.length,31);
 for(const site of plannedSites){const [x,y]=site.diagramPosition;assert.equal(r.pickDomainSite(t.x+x*t.scale,t.y+(y+DOMAIN_PLAN.mapTop)*t.scale)?.id,site.id,site.planId);}
 assert.equal(r.pickDomainSite(t.x,t.y),null);
});
