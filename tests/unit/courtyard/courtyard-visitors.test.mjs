import test from 'node:test';
import assert from 'node:assert/strict';
import * as SIM from '../../../src/simulation/ea-opening-sim.mjs';
import {createGodotBridge,projectGodotWorld} from '../../../src/simulation/ea-godot-bridge.mjs';
import {viewSRWorld} from '../../../src/simulation/ea-sr-world.mjs';
import {merchantPresent} from '../../../src/simulation/ea-sr-economy.mjs';
import {advanceRainArtisan,declineArtisanCare} from '../../../src/simulation/ea-rain-artisan.mjs';
import {COURTYARD_VISITOR_ROAD} from '../../../src/simulation/ea-courtyard-visitors.mjs';
import {toArt,isArtWalkable} from '../../../apps/courtyard/courtyard-space.mjs';
import seed from '../../../apps/courtyard/sect-seed.mjs';

const LU='person:lu-zhiwei',LIN='person:lin-changfeng',MERCHANT='person:merchant-qingxi';
const point=p=>({x:p.mind.scenic.x,y:p.mind.scenic.y});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function visibleGround(p){const art=toArt(p.x,p.y);assert.ok(isArtWalkable(art.x,art.y),`visible road at ${JSON.stringify({world:p,art})}`);}
function command(world,name,...args){const r=world.command({name,args});assert.equal(r.ok,true,r.error);return r;}
function until(world,predicate,limit=2000){for(let n=0;n<limit&&!predicate(world.snapshot());n++)world.advance(.1);assert.ok(predicate(world.snapshot()));}
function hallReady(){
 const world=createGodotBridge({state:SIM.initial({sr:true,mountainOpening:true})});
 command(world,'masterAction','heal');command(world,'chooseOpeningInheritance','qinglan');
 until(world,v=>v.roster[0].wound===0);command(world,'advanceStory');command(world,'establishHall');
 until(world,v=>v.openingHallPhase==='complete');return world;
}

test('current new game keeps visitors off the courtyard until their road arrival and uses exact saved steps',()=>{
 const initial=SIM.initial({sr:true,mountainOpening:true});
 assert.deepEqual(projectGodotWorld(initial).people.map(p=>p.id),['person:master']);
 assert.equal(viewSRWorld(initial).scene.actors.some(p=>[LU,LIN,'person:cheng-wenzhou'].includes(p.personId)),false);
 const world=hallReady();until(world,v=>v.people.some(p=>p.id===LU&&p.visit?.phase==='arriving'));
 const first=world.snapshot().people.find(p=>p.id===LU);assert.ok(distance(first,COURTYARD_VISITOR_ROAD[0])<.3);
 const before=world.save(),gift=world.command({name:'advanceStory',args:['gift']});assert.equal(gift.ok,false);assert.match(gift.error,/尚未抵达/);assert.equal(world.save(),before);
 const malformed=JSON.parse(world.save());malformed.personsById[LU].courtyardVisit.lastTick=malformed.worldTick+1;
 const malformedSource=JSON.stringify(malformed);assert.throws(()=>SIM.validateSave(malformed),/访客/);assert.equal(JSON.stringify(malformed),malformedSource);
 const samples=[];
 for(let n=0;n<25;n++){world.advance(.1);const p=world.snapshot().people.find(p=>p.id===LU);visibleGround(p);samples.push(point({mind:{scenic:p}}));}
 assert.ok(distance(samples[0],samples.at(-1))>1);
 command(world,'setSpeed',0);const paused=world.save();world.advance(5);assert.equal(world.save(),paused);
 const loaded=createGodotBridge({state:SIM.validateSave(JSON.parse(paused))});assert.equal(loaded.save(),paused);
 command(world,'setSpeed',1);command(loaded,'setSpeed',1);
 until(world,v=>v.people.find(p=>p.id===LU)?.visit?.phase==='present');
 until(loaded,v=>v.people.find(p=>p.id===LU)?.visit?.phase==='present');assert.equal(loaded.save(),world.save());
 const p=world.snapshot().people.find(p=>p.id===LU);assert.ok(p.visit.arrivedTick>p.visit.startedTick);assert.equal(p.moving,false);
 const distant=world.command({name:'advanceStory',args:['gift']});assert.equal(distant.ok,false);assert.match(distant.error,/先走到/);
 command(world,'moveScenicMaster',p.x+1,p.y);until(world,v=>v.openingStory.visitor.canTalk);
 const herbs=world.snapshot().resources.herb;command(world,'advanceStory','gift');assert.equal(world.snapshot().resources.herb,herbs-10);
 const departing=createGodotBridge({state:SIM.validateSave(JSON.parse(world.save()))});command(departing,'advanceStory','decline');
 assert.equal(departing.snapshot().people.find(p=>p.id===LU)?.visit.phase,'departing');
 let yielded=false;
 for(let n=0;n<500&&departing.snapshot().people.some(p=>p.id===LU);n++){
  departing.advance(.1);for(const p of departing.snapshot().people.filter(p=>[LU,LIN].includes(p.id)))visibleGround(p);
  const saved=departing.save(),state=JSON.parse(saved);
  if(!yielded&&[LU,LIN].some(id=>state.personsById[id].mind.scenic.bodyYield)){
   const restored=createGodotBridge({state:SIM.validateSave(state)});assert.equal(restored.save(),saved);yielded=true;
  }
 }
 assert.ok(yielded,'opposite visitors make an actual passing step that survives reload');
 assert.equal(departing.snapshot().people.some(p=>p.id===LU),false);
 assert.equal(JSON.parse(departing.save()).stockpilesById['stockpile:lu-zhiwei'].resources.herb,10);
 command(world,'advanceStory','invite');assert.equal(JSON.parse(world.save()).personsById[LU].personId,LU);
 until(world,v=>v.people.some(p=>p.id===LIN&&p.visit?.phase==='arriving'));
 const lin=world.snapshot().people.find(p=>p.id===LIN);assert.ok(distance(lin,COURTYARD_VISITOR_ROAD[0])<.3);
 until(world,v=>v.people.find(p=>p.id===LIN)?.visit?.phase==='present');
 assert.equal(JSON.parse(world.save()).homeMemberIds.includes(LIN),false,'arriving does not grant membership');
});

test('an existing arrived save keeps its identities, exact feet and visit availability',()=>{
 const original=structuredClone(seed.state),restored=SIM.validateSave(original);
 for(const id of [LU,LIN,MERCHANT]){
  assert.equal(restored.personsById[id].courtyardVisit,undefined);
  assert.deepEqual(restored.personsById[id].mind.scenic,original.personsById[id].mind.scenic);
  assert.equal(restored.personsById[id].personId,id);
 }
 const merchant=point(restored.personsById[MERCHANT]);SIM.tick(restored,.1);
 assert.deepEqual(point(restored.personsById[MERCHANT]),merchant);
 assert.deepEqual(seed.state,original,'loading and ticking never rewrites the shipped checkpoint');
});

test('merchant arrival, physical departure and return keep the same person and cargo on the visible road',()=>{
 let s=SIM.validateSave(SIM.initial({sr:true,mountainOpening:true}));
 const identity=s.personsById[MERCHANT].id,arrivals=new Set(),phases=new Set();let prior=null,reloaded=false;
 for(let n=0;n<5500;n++){
  SIM.tick(s,.1);const p=s.personsById[MERCHANT],v=p.courtyardVisit;
  assert.equal(p.id,identity);if(v)phases.add(v.phase);
  if(v?.phase==='arriving'&&v.startedTick!==null)arrivals.add(v.startedTick);
  if(p.position?.sceneId==='scene:yunxiu-courtyard'){
   const current=point(p);visibleGround(current);
   assert.deepEqual(s.stockpilesById['stockpile:qingxi'].position,{sceneId:'scene:yunxiu-courtyard',...current});
   if(prior)assert.ok(distance(prior,current)<.6,'consecutive local steps cannot replace the visitor position');
   prior=current;
   if(v?.phase==='arriving')assert.equal(merchantPresent(s),false);
   if(v?.phase==='arriving'&&!reloaded&&v.waypointIndex>=2){const raw=JSON.stringify(s);s=SIM.validateSave(JSON.parse(raw));assert.equal(JSON.stringify(s),raw);reloaded=true;}
  }else prior=null;
  if(arrivals.size>=2&&v.phase==='present')break;
 }
 assert.ok(reloaded);assert.ok(phases.has('arriving')&&phases.has('present')&&phases.has('departing')&&phases.has('departed'));
 assert.ok(arrivals.size>=2,'the same merchant returns after the market journey');
 SIM.validateSave(s);
});

test('a triggered artisan fixture walks the same entrance and leaves from actual feet',()=>{
 const s=SIM.initial({sr:true,mountainOpening:true});
 // Directed event fixture; the normal opening test above uses public commands.
 s.story.step=4;s.story.onboarding.productions=['farm'];
 advanceRainArtisan(s);const p=s.personsById['person:cheng-wenzhou'];
 assert.equal(s.story.artisan.phase,'arriving');assert.deepEqual(point(p),COURTYARD_VISITOR_ROAD[0]);
 for(let n=0;n<500&&s.story.artisan.phase==='arriving';n++){s.worldTick++;advanceRainArtisan(s);visibleGround(point(p));}
 assert.equal(s.story.artisan.phase,'present');assert.equal(p.courtyardVisit.phase,'present');
 declineArtisanCare(s);const before=point(p);s.worldTick++;advanceRainArtisan(s);assert.ok(distance(before,point(p))<.6);
 for(let n=0;n<500&&s.story.artisan.phase==='departing';n++){s.worldTick++;advanceRainArtisan(s);visibleGround(point(p));}
 assert.equal(s.story.artisan.phase,'departed');assert.deepEqual(point(p),COURTYARD_VISITOR_ROAD[0]);
});
