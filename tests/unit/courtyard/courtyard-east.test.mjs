import test from 'node:test';
import assert from 'node:assert/strict';
import {COURTYARD_EAST_ROAD} from '../../../src/simulation/ea-sect-domain.mjs';
import {toArt,toWorld,isArtWalkable,routeArt,REVIEW_POINTS,ART_WIDTH,DOMAIN_ART_WIDTH} from '../../../apps/courtyard/courtyard-space.mjs';
import {CourtyardRenderer} from '../../../apps/courtyard/courtyard-renderer.mjs';
import {EAST_LAYOUT} from '../../../apps/courtyard/courtyard-east-layout.mjs';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const renderer=()=>new CourtyardRenderer({getContext:()=>({}),getBoundingClientRect:()=>({width:1672,height:941})});

test('metre house corners and entrance match the approved full-size terrace',()=>{
  assert.equal(ART_WIDTH,1672);assert.equal(DOMAIN_ART_WIDTH,6688);
  for(const [x,y,u,v] of [[132,40,5796,340],[138,40,6246,340],[132,46,5796,410],[138,46,6246,410],[135,46.6,6021,420]]){
    const p=toArt(x,y),w=toWorld(p.x,p.y);close(p.x,u);close(p.y,v);close(w.x,x);close(w.y,y);
  }
  for(let y=0;y<=96;y+=.97)for(let x=44;x<=160;x+=1.13){const p=toArt(x,y),w=toWorld(p.x,p.y);close(w.x,x);close(w.y,y);}
});

test('the complete formal east road lies on continuous visible ground',()=>{
  let samples=0;
  for(let i=1;i<COURTYARD_EAST_ROAD.length;i++){
    const a=COURTYARD_EAST_ROAD[i-1],b=COURTYARD_EAST_ROAD[i];
    const count=Math.max(100,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.025));
    let previous=null;
    for(let n=0;n<=count;n++){
      const p={x:a.x+(b.x-a.x)*n/count,y:a.y+(b.y-a.y)*n/count},art=toArt(p.x,p.y);
      assert.ok(isArtWalkable(art.x,art.y),JSON.stringify({segment:i,world:p,art}));
      if(previous)assert.ok(Math.hypot(art.x-previous.x,art.y-previous.y)<9,'continuous metre movement keeps a continuous foot');
      previous=art;samples++;
    }
  }
  assert.ok(samples>4000);
});

test('the first repaired join keeps feet on its road and preserves the courtyard core',()=>{
  const join=toArt(50.72,12.123913043478261);
  close(join.x,1672);close(join.y,383);
  for(const [x,y,u,v] of [[28,12.6,680,407],[12.5,45.5,560,860],[14,44.6,450,820]]){
    const art=toArt(x,y);close(art.x,u);close(art.y,v);
  }
  for(let x=1422;x<=1922;x+=5)for(const y of [300,383,500]){
    const world=toWorld(x,y),art=toArt(world.x,world.y);
    close(art.x,x);close(art.y,y);
  }
});

test('manual waypoints connect the original courtyard to the residence door',()=>{
  const route=routeArt(REVIEW_POINTS.courtyard.art,EAST_LAYOUT.entranceArt);
  assert.ok(route?.length>50);assert.deepEqual(route.at(-1),EAST_LAYOUT.entranceArt);
  let previous=REVIEW_POINTS.courtyard.art;
  for(const p of route){assert.ok(Math.hypot(p.x-previous.x,p.y-previous.y)<=18.00001);assert.ok(isArtWalkable(p.x,p.y));previous=p;}
  assert.equal(isArtWalkable(5600,100),false);
});

test('east camera, building and site picking use formal identities and completed status',()=>{
  const r=renderer(),site={id:EAST_LAYOUT.siteId,status:'available'},house={id:'8',type:'house',x:132,y:40};
  r.view={domain:{enabled:true,sites:[site]},buildings:[]};r.focusLocation(EAST_LAYOUT.entrance);
  assert.ok(r.camera.x>5016);
  let point=r.artToScreen({x:6000,y:380});assert.equal(r.pickDomainSite(point.x,point.y),site);assert.equal(r.pickBuilding(point.x,point.y),null);
  site.status='complete';r.view.buildings=[house];point=r.artToScreen({x:6000,y:230});
  assert.equal(r.pickBuilding(point.x,point.y),house);
  r.showCourtyard();assert.deepEqual(r.camera,{x:836,y:470.5,zoom:1});
  const body={id:'person:east',indoor:false};r.hitRegions=[{person:body,p:{x:6000,y:405},x:5980,y:300,w:40,h:105}];
  point=r.artToScreen({x:6000,y:350});assert.deepEqual(r.pickPeople(point.x,point.y),[]);
  site.status='available';assert.equal(r.pickPeople(point.x,point.y)[0],body);
});

test('waiting material trips keep the empty site until actual construction progress',()=>{
  const r=renderer(),site={id:EAST_LAYOUT.siteId,status:'building',progress:0};
  r.view={domain:{enabled:true,sites:[site]},buildings:[]};
  r.eastStages={available:{name:'empty'},building:{name:'construction'},complete:{name:'complete'}};
  assert.equal(r.eastImage().name,'empty');assert.equal(r.occluders().some(o=>o.id==='east-residence'),false);
  site.progress=.001;assert.equal(r.eastImage().name,'construction');assert.equal(r.occluders().some(o=>o.id==='east-residence'),true);
  site.status='complete';assert.equal(r.eastImage().name,'complete');
});
