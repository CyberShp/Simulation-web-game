import test from 'node:test';
import assert from 'node:assert/strict';
import {createSectSession,commandSect,advanceSect,viewSect,snapshotSect,restoreSect} from '../../../apps/courtyard/sect-sim.mjs';
import {toArt,toWorld,isArtWalkable,routeArt,VALLEY_ART_LEFT} from '../../../apps/courtyard/courtyard-space.mjs';
import {westValleySites} from '../../../src/simulation/ea-sect-domain.mjs';
import {CourtyardRenderer} from '../../../apps/courtyard/courtyard-renderer.mjs';
import {VALLEY_LAYOUT,VALLEY_SITES} from '../../../apps/courtyard/courtyard-valley-layout.mjs';

const call=(s,input)=>{const result=commandSect(s,input);assert.equal(result.ok,true,result.error);return result;};
function opened(){const s=createSectSession();call(s,{type:'enable-domain'});call(s,{type:'enable-valley'});call(s,{type:'enable-courtyard-terrain'});return s;}
function until(s,predicate,limit=2500){for(let n=0;n<limit&&!predicate(s);n++){if(n%200===0)call(s,{type:'manual'});advanceSect(s,.1);}assert.ok(predicate(s),s.reason);}
const renderer=()=>new CourtyardRenderer({getContext:()=>({}),getBoundingClientRect:()=>({width:1672,height:941})});

test('valley coordinates, visible road and old boundary use the same sites',()=>{
 assert.equal(VALLEY_ART_LEFT,VALLEY_LAYOUT.x);
 assert.deepEqual(VALLEY_SITES.map(s=>s.id),westValleySites.map(s=>s.id));
 for(const site of westValleySites){
  const art=toArt(site.entrance.x,site.entrance.y),world=toWorld(art.x,art.y);
  assert.ok(Math.hypot(world.x-site.entrance.x,world.y-site.entrance.y)<1e-7);
  assert.equal(isArtWalkable(art.x,art.y,{valley:false}),false);
  const route=routeArt({x:720,y:530},art,{valley:true});assert.ok(route?.length);assert.deepEqual(route.at(-1),art);
  assert.ok(route.every(p=>isArtWalkable(p.x,p.y,{valley:true})));
 }
});

test('new valley projection is read-only and activation preserves the old world',()=>{
 const s=createSectSession();call(s,{type:'enable-domain'});const before=snapshotSect(s);
 assert.equal(viewSect(s).domain.valleyEnabled,false);
 assert.ok(viewSect(s).domain.sites.filter(site=>site.valleySite).every(site=>site.status==='locked'));
 call(s,{type:'enable-valley'});
 assert.deepEqual(s.state.personsById,before.state.personsById);assert.deepEqual(s.state.stockpilesById,before.state.stockpilesById);
 const saved=snapshotSect(s),v=viewSect(s);viewSect(s);
 assert.equal(v.domain.valleyEnabled,true);assert.equal(v.bounds.x,-84);assert.deepEqual(snapshotSect(s),saved);
 assert.deepEqual(snapshotSect(restoreSect(saved)),saved);
});

test('each facility has independent phase, crop appearance and exact picking identity',()=>{
 const r=renderer();r.view={domain:{enabled:true,westEnabled:true,valleyEnabled:true,sites:VALLEY_SITES.map((p,i)=>({id:p.id,status:'building',progress:0,buildingId:`building:yunxiu:${i+10}`}))},buildings:[]};
 for(const [index,art]of VALLEY_SITES.entries()){
  const site=r.valleySite(art.id);assert.equal(r.valleyStage(site.id),'empty');site.progress=.01;assert.equal(r.valleyStage(site.id),'construction');
  const point={x:art.footprint.reduce((n,p)=>n+p[0],0)/art.footprint.length+VALLEY_LAYOUT.x,y:art.footprint.reduce((n,p)=>n+p[1],0)/art.footprint.length};
  r.focusLocation(westValleySites[index].entrance);let screen=r.artToScreen(point);assert.equal(r.pickDomainSite(screen.x,screen.y)?.id,site.id);
  site.status='complete';const building={id:String(index+10),type:westValleySites[index].type,cropVisual:'empty'};r.view.buildings.push(building);
  assert.equal(r.valleyStage(site.id),building.type==='granary'?'fallow':'complete');
  if(building.type==='granary'){building.cropVisual='growing';assert.equal(r.valleyStage(site.id),'growing');building.cropVisual='ripe';assert.equal(r.valleyStage(site.id),'complete');}
  if(!art.buildingPolygon)assert.equal(r.pickBuilding(screen.x,screen.y),building);
 }
 r.view.domain.valleyEnabled=false;r.constrain();assert.ok(r.camera.x>=-1672);
});

test('quarry completion exposes its existing one-time reward through the desktop command',()=>{
 const s=opened(),before=snapshotSect(s);
 assert.equal(commandSect(s,{type:'claim-building-reward',rewardId:'quarry'}).ok,false);assert.deepEqual(snapshotSect(s).state,before.state);
 call(s,{type:'build-site',siteId:'site:domain:gc-17'});until(s,x=>x.state.buildings.some(b=>b.type==='quarry'));
 let site=viewSect(s).domain.sites.find(p=>p.planId==='GC-17');assert.equal(site.reward.available,true);
 const resources={...s.state.stockpilesById['stockpile:yunxiu'].resources};call(s,{type:'claim-building-reward',rewardId:'quarry'});
 assert.equal(s.state.stockpilesById['stockpile:yunxiu'].resources.jade,resources.jade+60);assert.equal(s.state.stockpilesById['stockpile:yunxiu'].resources.wood,resources.wood+30);
 assert.equal(viewSect(s).domain.sites.find(p=>p.planId==='GC-17').reward.claimed,true);
 const saved=snapshotSect(s);assert.equal(commandSect(s,{type:'claim-building-reward',rewardId:'quarry'}).ok,false);assert.deepEqual(snapshotSect(s).state,saved.state);
});

test('rice projection requests real food seed, preserves next sowing and follows the crop record',()=>{
 const s=opened();call(s,{type:'build-site',siteId:'site:domain:gc-18'});until(s,x=>x.state.buildings.some(b=>b.type==='granary'));
 let farm=viewSect(s).operations.farms.find(f=>f.resource==='food');assert.ok(farm);assert.equal(farm.seedNeeded,2);assert.equal(farm.productOnSite,0);
 call(s,{type:'transport',sourceStockpileId:'stockpile:yunxiu',targetStockpileId:farm.stockpileId,cargo:{food:2}});
 until(s,x=>x.state.stockpilesById[farm.stockpileId].resources.food===2);
 call(s,{type:'invite-work',personId:'person:lu-zhiwei',buildingId:farm.buildingId});
 until(s,x=>x.state.workOrdersById[`work:production:${farm.buildingId}`]?.crop?.sownAtTick!=null);
 farm=viewSect(s).operations.farms.find(f=>f.resource==='food');assert.ok(farm.crop);assert.equal(farm.crop.seedUsed,2);assert.equal(farm.harvestTransport.quantity,0);
 const saved=snapshotSect(s);assert.deepEqual(snapshotSect(restoreSect(saved)),saved);assert.equal(viewSect(s).buildings.find(b=>b.type==='granary').cropVisual,'growing');
});
