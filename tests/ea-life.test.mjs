import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../dist/ea-sim.mjs';
import {buildingAccess,scenicDistance} from '../dist/ea-scenic.mjs';

function world(){const s=sim.initial({seed:12345});s.master.wound=0;for(const k of Object.keys(s.resources))s.resources[k]=1000;const d=sim.addDisciple(s,{main:'qingyuan',mastery:40});const farm=sim.build(s,'farm',4,4),library=sim.build(s,'library',2,4);return{s,d,farm,library};}
function committed(s,d,activity,job=null){d.job=job;d.mind.activity=activity;d.mind.path=[];d.mind.scenic.path=[];d.mind.scenic.goal=null;d.mind.lastDecision=s.society.clock;d.mind.commitUntil=s.society.clock+100;}

test('life projections explain facility and willingness without mutating time, RNG or private knowledge',()=>{
 const{s,d,farm}=world();const before=structuredClone(s);
 for(let n=0;n<10;n++){sim.personLifeSummary(s,d);sim.lifeFacility(s,d);sim.workOpportunity(s,d,farm);}
 assert.deepEqual(s,before);assert.equal(sim.workOpportunity(s,d,farm).available,true);assert.equal(sim.workOpportunity(s,d,farm).willing,false);
 d.energy=10;assert.match(sim.workOpportunity(s,d,farm).reason,/精力/);d.energy=100;d.mind.relationships.master.trust=5;d.mind.traits[3]=40;assert.match(sim.workOpportunity(s,d,farm).reason,/信任/);
});
test('a broken committed cultivation site grants no invisible training and releases its old path',()=>{
 const{s,d}=world();committed(s,d,'cultivate',s.buildings[0].id);s.buildings[0].condition=0;
 const xp=d.xp;sim.tick(s,1);assert.equal(d.xp,xp);assert.equal(d.job,null);assert.equal(d.mind.activity,'rest');assert.match(d.mind.reason,/损坏/);
 assert.deepEqual(sim.validateSave(s),s);
});
test('pausing the library suspends both learning plans and preserves progress for resumption',()=>{
 const{s,d,library}=world();sim.obtainBook(s,'wood');sim.masterStudy(s,'wood');sim.tick(s,3);
 committed(s,d,'study');d.mind.learning={id:'wood',progress:17,total:80,mode:'learn'};
 const progress=s.master.learning.progress;sim.toggleBuilding(s,library.id);sim.tick(s,1);
 assert.equal(s.master.action,'rest');assert.equal(s.master.learning.progress,progress);assert.equal(d.mind.learning.progress,17);assert.equal(d.mind.activity,'rest');assert.match(d.mind.reason,/研习场所/);
 assert.throws(()=>sim.masterStudy(s,'wood'),/藏经阁/);sim.toggleBuilding(s,library.id);sim.masterStudy(s,'wood');assert.equal(s.master.learning.progress,progress);
 const saved=sim.validateSave(s);sim.tick(s,30);sim.tick(saved,30);assert.deepEqual(s,saved);
});
test('input shortage stops work before charging energy or manufacturing a batch and rates do not promise output',()=>{
 const{s,d}=world();sim.build(s,'house',5,5);s.story.step=3;for(let n=0;n<4;n++)sim.addDisciple(s);const workshop=sim.build(s,'workshop',5,3);committed(s,d,'work',workshop.id);s.resources.wood=0;
 const energy=d.energy,stone=s.resources.stone,progress=workshop.progress;sim.tick(s,1);
 assert.equal(d.energy,energy);assert.equal(s.resources.stone,stone);assert.equal(workshop.progress,progress);assert.equal(d.job,null);assert.match(d.mind.reason,/灵木/);
});
test('a travelling, distant or different-topic mentor cannot provide a remote lesson',()=>{
 const{s,d,library}=world();s.master.knowledge.qingyuan=80;s.master.knowledge.wood=80;s.master.action='teach';s.master.teaching='qingyuan';committed(s,d,'study');d.mind.learning={id:'qingyuan',progress:0,total:55,mode:'deepen'};
 const entry=buildingAccess(s,library);s.master.scenic={...d.mind.scenic,...entry,path:[]};d.mind.scenic={...d.mind.scenic,...entry,path:[]};
 assert.equal(sim.teachingPresent(s,s.master,d,'qingyuan'),true);
 assert.equal(sim.teachingPresent(s,s.master,d,'wood'),false);
 s.master.scenic={...s.master.scenic,...buildingAccess(s,s.buildings[0])};assert.equal(sim.teachingPresent(s,s.master,d,'qingyuan'),false);
 s.master.scenic={...s.master.scenic,...entry};s.master.path=[{x:library.x+1,y:library.y+1}];assert.equal(sim.teachingPresent(s,s.master,d,'qingyuan'),false);
 s.master.path=[];d.mind.away={kind:'errand',id:'valley_path'};assert.equal(sim.teachingPresent(s,s.master,d,'qingyuan'),false);
});
test('a moved work site updates its entrance path without teleporting or producing during the walk',()=>{
 const{s,d,farm}=world();committed(s,d,'work',farm.id);Object.assign(d.mind.scenic,buildingAccess(s,farm));sim.relocate(s,farm.id,6,4);
 const position={...d.mind.scenic},herb=s.resources.herb;sim.tick(s,1);
 const moved=scenicDistance(d.mind.scenic,position);assert.ok(moved>0&&moved<=46);assert.equal(s.resources.herb,herb);assert.ok(d.mind.scenic.path.length>0);assert.equal(sim.personLifeSummary(s,d).status,'moving');
});
test('private study summaries omit the manual and cooldown summaries describe actual recovery',()=>{
 const{s,d}=world();d.mind.activity='study';d.mind.learning={id:'wood',progress:12,total:80,mode:'learn'};s.doctrine.sealed.push('wood');const info=sim.personLifeSummary(s,d);assert.equal(info.progress,null);assert.match(info.reason,/独处参悟/);
 d.mind.activity='rest';d.breakthroughCooldown=s.time+12;assert.equal(sim.personLifeSummary(s,d).label,'突破后调息');assert.match(sim.personLifeSummary(s,d).reason,/12秒/);
});

test('an autonomous breakthrough first reaches a quiet facility and then actually rests through cooldown',()=>{
 const{s,d,farm}=world();committed(s,d,'work',farm.id);Object.assign(d.mind.scenic,buildingAccess(s,farm));d.xp=sim.xpNeed(d.realm);d.mind.commitUntil=0;
 const jade=s.resources.jade,herb=s.resources.herb;sim.tick(s,1);
 assert.equal(d.realm,1);assert.equal(s.resources.jade,jade);assert.equal(s.resources.herb,herb);assert.ok(d.mind.scenic.path.length>0);assert.match(d.mind.reason,/安静处/);
 for(let n=0;n<120&&d.realm===1;n++)sim.tick(s,1);
 assert.equal(d.realm,2);assert.equal(d.mind.activity,'rest');assert.equal(d.job,null);assert.ok(d.breakthroughCooldown>s.time);
 const position={...d.mind.scenic},cycles=s.society.stats.workCycles;sim.tick(s,5);
 assert.equal(d.mind.scenic.x,position.x);assert.equal(d.mind.scenic.y,position.y);assert.equal(s.society.stats.workCycles,cycles);assert.equal(sim.personLifeSummary(s,d).label,'突破后调息');assert.deepEqual(sim.validateSave(s),s);
});

test('layout bonuses follow the visible scene distance instead of plot-number adjacency',()=>{
 const{s,farm}=world();sim.build(s,'house',5,5);s.story.step=3;s.master.realm=10;for(let n=0;n<4;n++)sim.addDisciple(s);const well=sim.build(s,'well',4,5);assert.equal(sim.layoutBonus(s,farm).factor,1);
 // 4/5 is one old logical step away but physically across the terrace.
 assert.ok(scenicDistance(buildingAccess(s,farm),buildingAccess(s,well))>150);
 sim.relocate(s,well.id,0,5);assert.ok(scenicDistance(buildingAccess(s,farm),buildingAccess(s,well))<150);
 // 0/5 is five old logical steps away, but physically beside the farm.
 assert.equal(sim.layoutBonus(s,farm).factor,1.25);sim.toggleBuilding(s,well.id);assert.equal(sim.layoutBonus(s,farm).factor,1);
});

test('the master receives clinic recovery only at its reachable entrance, without a second healing charge',()=>{
 const{s}=world();sim.build(s,'house',5,5);s.story.step=3;for(let n=0;n<4;n++)sim.addDisciple(s);s.master.knowledge.spring=20;const clinic=sim.build(s,'clinic',4,5);
 s.master.wound=30;const herb=s.resources.herb;sim.masterAction(s,'heal');assert.equal(s.resources.herb,herb-6);
 sim.tick(s,1);assert.equal(s.master.wound,28);assert.equal(sim.personLifeSummary(s,s.master).facilityName,'别院主屋');
 s.master.scenic={...s.master.scenic,...buildingAccess(s,clinic),path:[]};sim.tick(s,1);assert.equal(s.master.wound,25);assert.equal(sim.personLifeSummary(s,s.master).facilityId,clinic.id);
 sim.toggleBuilding(s,clinic.id);sim.tick(s,1);assert.equal(s.master.wound,23);assert.equal(s.resources.herb,herb-6);assert.notEqual(sim.personLifeSummary(s,s.master).facilityId,clinic.id);
});

test('a working upgraded meditation platform improves actual local master cultivation and remote or stopped platforms do not',()=>{
 const{s}=world(),platform=sim.build(s,'meditation',4,5);sim.upgrade(s,platform.id);sim.masterAction(s,'cultivate');
 const base=sim.cultivationRate(s,s.master),xp=s.master.xp;sim.tick(s,1);assert.ok(Math.abs(s.master.xp-xp-base)<1e-9);
 s.master.scenic={...s.master.scenic,...buildingAccess(s,platform),path:[]};const localXp=s.master.xp;sim.tick(s,1);assert.ok(s.master.xp-localXp>=base*2);assert.equal(sim.personLifeSummary(s,s.master).facilityId,platform.id);
 sim.toggleBuilding(s,platform.id);const stoppedXp=s.master.xp;sim.tick(s,1);assert.ok(Math.abs(s.master.xp-stoppedXp-base)<1e-9);assert.notEqual(sim.personLifeSummary(s,s.master).facilityId,platform.id);
});
