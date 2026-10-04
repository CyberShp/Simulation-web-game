import test from 'node:test';
import assert from 'node:assert/strict';
import * as society from '../dist/ea-society.mjs';
import * as sim from '../dist/ea-sim.mjs';
import {BUILDINGS,TECHNIQUES,RESOURCES,xpNeed,day} from '../dist/ea-data.mjs';
import {buildingAccess,geometryRevision} from '../dist/ea-scenic.mjs';

// These are isolated state-machine fixtures, not claims that a player walkthrough was completed.
// Full ordinary-player progression is exercised independently by ea-integration.test.mjs.
const hooks=Object.fromEntries(['studyLock','compatible','learnTechnique','cultivationRate','buildingYield','breakthroughLock','breakthroughPerson','consumePill','supportLimit'].map(k=>[k,sim[k]]));
function state(seed=123456) {
  const s=sim.initial({seed});s.master.wound=0;s.master.energy=100;
  for(const k of Object.keys(RESOURCES))s.resources[k]=2000;
  s.story.step=3;
  return s;
}
function building(s,type,x,y,level=1) {
  const b={id:s.nextId++,type,x,y,level,progress:0,enabled:true,condition:100};s.buildings.push(b);return b;
}
function add(s,options={}) {
  if(s.disciples.length>=sim.capacity(s)) {
    const occupied=new Set(s.buildings.map(b=>`${b.x},${b.y}`));
    const c=sim.CELLS.find(c=>!occupied.has(`${c.x},${c.y}`)&&!(c.x===3&&c.y===3));building(s,'house',c.x,c.y,3);
  }
  return sim.addDisciple(s,{name:`门人${s.society.nextPersonId||1}`,talent:1.5,...options});
}
function step(s,n=1,custom=hooks) {for(let i=0;i<n;i++){s.time++;society.tickSociety(s,1,custom);}return s;}
function known(d,main='qingyuan',mastery=60,support=[]) {
  d.mind.main=main;d.mind.publicMain=main;d.mind.knowledge[main]=mastery;d.mind.support=[...support];
  for(const id of support)d.mind.knowledge[id]=60;
  return d;
}
function publicPerson(s,id) {return society.getSocietyView(s).disciples.find(d=>d.id===id);}
function productive(s,d,b) {
  known(d);d.position={x:b.x,y:b.y+1};d.mind.activity='work';d.mind.reason='已有承诺的差事';d.job=b.id;
  d.mind.commitUntil=s.time+1000;d.mind.lastDecision=s.time;d.mind.path=[];
  Object.assign(d.mind.scenic,buildingAccess(s,b),{path:[],goal:buildingAccess(s,b),revision:geometryRevision(s)});
}
function secretPill(s,d) {
  s.doctrine.pillRule='permission';s.pills.qi=6;d.mind.traits=[20,100,0,60,85];d.xp=0;
  for(let i=0;i<90&&!s.society.secrets.some(e=>e.discipleId===d.id&&e.kind==='pill');i++)step(s);
  return s.society.secrets.find(e=>e.discipleId===d.id&&e.kind==='pill');
}

test('society initialization is idempotent and view is a pure read',()=>{
  const s=state(),d=add(s);society.rememberPerson(s,d,'一桩重要旧事',{important:true,key:'old'});
  const before=structuredClone(s);society.initSociety(s);assert.deepEqual(s,before);
  society.getSocietyView(s);assert.deepEqual(s,before);assert.equal(society.validateSociety(s),true);
});

test('NPC keeps a chosen task through its commitment rather than rerolling every second',()=>{
  const s=state();building(s,'library',2,4);const d=add(s,{traits:[60,50,70,85,75]});
  step(s);const chosen={activity:d.mind.activity,job:d.job,id:d.mind.learning?.id};
  step(s,12);assert.deepEqual({activity:d.mind.activity,job:d.job,id:d.mind.learning?.id},chosen);
  assert.ok(d.energy<100);assert.equal(society.validateSociety(s),true);
});

test('urgent fatigue and injury interrupt a commitment and recover without permanent damage',()=>{
  const s=state(),b=building(s,'lumber',1,3),d=add(s);productive(s,d,b);d.energy=5;d.mind.commitUntil=0;
  step(s);assert.equal(d.mind.activity,'rest');assert.equal(d.job,null);
  d.wound=48;d.mind.commitUntil=0;step(s,80);assert.ok(d.wound<20);assert.equal(d.talent,1.5);
  assert.ok(d.energy>5);
});

test('NPC production executes exactly one cycle, spends its own time and workshop inputs',()=>{
  const s=state(),b=building(s,'workshop',1,3),d=add(s);productive(s,d,b);
  const before={wood:s.resources.wood,stone:s.resources.stone,jade:s.resources.jade,energy:d.energy,xp:d.xp};
  step(s,20);assert.equal(s.society.stats.workCycles,1);assert.equal(s.resources.wood,before.wood-3);assert.equal(s.resources.stone,before.stone-2);
  assert.ok(s.resources.jade>before.jade);assert.ok(d.energy<before.energy);assert.equal(d.xp,before.xp);
  assert.equal(b.progress,0);
});

test('a disabled or destroyed facility is unavailable to autonomous jobs and founding',()=>{
  const s=state(),b=building(s,'lumber',1,3),d=add(s);productive(s,d,b);b.enabled=false;step(s);
  assert.equal(d.job,null);assert.equal(s.society.stats.workCycles,0);
  const library=building(s,'library',2,4);library.enabled=false;
  assert.ok(society.foundingStatus(s).reasons.includes('需建成藏经阁'));
  const blocked=building(s,'quarry',6,3);for(const [x,y]of [[5,3],[7,3],[6,2],[6,4]])building(s,'house',x,y);
  // Plot addresses no longer imply physical adjacency on the registered painting.
  // Actual impassable routes are exercised by ea-scene-geometry.test.mjs.
  blocked.condition=0;
  s.doctrine.workFocus='stone';d.mind.commitUntil=0;step(s,50);assert.notEqual(d.job,blocked.id);
});

test('all work refusal can coexist with survival and recover through changed relationships',()=>{
  const s=state(),b=building(s,'granary',1,3),d=add(s,{traits:[20,80,40,25,40]});known(d);
  s.resources.food=0;d.mind.satiety=10;d.mind.relationships.master.trust=8;
  step(s,20);assert.ok(s.resources.food>=3);assert.ok(d.mind.satiety>10);assert.notEqual(d.job,b.id);
  d.mind.relationships.master.conflict=10;const oldTrust=d.mind.relationships.master.trust;
  society.societyCommand(s,{type:'talk',discipleId:d.id,topic:'reconcile'});assert.ok(d.mind.relationships.master.trust>oldTrust);
  assert.throws(()=>society.societyCommand(s,{type:'forceWork',discipleId:d.id,buildingId:b.id}),/不能强制/);
});

test('study and production never execute simultaneously, and learning takes time',()=>{
  const s=state(),b=building(s,'farm',4,4),d=add(s,{traits:[90,20,80,60,95]});
  step(s);assert.equal(d.mind.activity,'study');const first=d.mind.learning.progress;
  assert.equal(d.job,null);assert.equal(s.society.stats.workCycles,0);assert.equal(d.mind.main,null);
  step(s,15);assert.ok(d.mind.learning.progress>first);assert.equal(b.progress,0);
  step(s,40);assert.equal(d.mind.main,'qingyuan');
});

test('a sealed book stays absent from public reason, knowledge, memories and quest targets until discovery',()=>{
  const s=state(),d=add(s,{traits:[30,90,0,60,100],root:'火灵根',realm:2});known(d,'qingyuan',80);
  building(s,'library',2,4);s.doctrine.books.push('ember');s.doctrine.sealed.push('ember');
  for(let i=0;i<160&&!s.society.secrets.length;i++)step(s);
  const e=s.society.secrets.find(e=>e.kind==='book');assert.ok(e);assert.equal(e.discovered,false);
  const secretName=TECHNIQUES.ember.name;
  for(let i=0;i<150&&!e.discovered;i++) {
    step(s);const pub=publicPerson(s,d.id);
    assert.ok(!JSON.stringify(pub).includes(secretName));assert.ok(!Object.hasOwn(pub.knowledge,'ember'));
    assert.notEqual(pub.main,'ember');assert.ok(!s.logs.some(l=>l.text.includes(`${d.name}初步掌握《${secretName}`)));
    assert.ok(!d.mind.reason.includes(secretName));assert.equal(s.incidents.length,0);
  }
  assert.equal(e.discovered,false,'without another archive observer a solitary secret is not magically exposed');
  const observer=add(s,{traits:[80,30,90,80,70]});known(observer);observer.mind.activity='study';observer.mind.learning={id:'qingyuan',progress:0,practice:true};
  for(let i=0;i<500&&!e.discovered;i++)step(s);
  assert.equal(e.discovered,true);assert.ok(society.getSocietyView(s).incidents.some(x=>x.evidence.includes(secretName)));
});

test('undiscovered knowledge cannot count toward public offices, founding expertise or peak traditions',()=>{
  const s=state();const library=building(s,'library',2,4);building(s,'farm',4,4);
  s.master.realm=10;s.master.knowledge.qingyuan=80;
  const hidden=known(add(s,{realm:4}),'qingyuan',20,['wood']);
  const observer=known(add(s,{realm:4}),'qingyuan',60);
  for(let i=0;i<8;i++)known(add(s,{realm:1}),'qingyuan',20);
  s.doctrine.books.push('wood');s.doctrine.sealed.push('wood');
  const e={id:s.society.nextIncidentId++,discipleId:hidden.id,kind:'book',subject:'wood',time:s.time,discovered:false,discoveredAt:null,handled:false,outcome:null,evidenceProgress:0,motive:'私下研读',restitution:12};
  s.society.secrets.push(e);hidden.mind.hiddenKnowledge.wood=e.id;
  assert.ok(society.foundingStatus(s).reasons.some(r=>r.includes('其中2位')));
  s.society.formal=true;
  assert.equal(society.officeWillingness(s,hidden.id,'teacher').capable,false);
  assert.equal(society.peakHostWillingness(s,hidden.id,'herb').capable,false);
  const status=society.peakStatus(s,'herb');
  assert.ok(status.reasons.some(r=>r.includes('其中2位')));
  assert.ok(status.reasons.includes('至少两部传承理解达到60'));
  assert.equal(society.getSocietyView(s).peakOptions.find(p=>p.id==='herb').hosts.find(d=>d.id===hidden.id).capable,false);
  productive(s,observer,library);e.evidenceProgress=99.9;step(s);
  assert.equal(e.discovered,true);
  assert.equal(society.officeWillingness(s,hidden.id,'teacher').capable,true);
  assert.equal(society.peakHostWillingness(s,hidden.id,'herb').capable,true);
  assert.ok(!society.peakStatus(s,'herb').reasons.includes('至少两部传承理解达到60'));
  s.society.formal=false;assert.equal(society.foundingStatus(s).ready,true);
});

test('a pupil hidden mastery does not leak through the public mentor knowledge-gap hint',()=>{
  const s=state(),pupil=known(add(s),'qingyuan',20,['wood']),mentor=known(add(s,{realm:4}),'qingyuan',20,['wood']);
  pupil.mind.knowledge.wood=75;mentor.mind.knowledge.wood=80;
  const e={id:s.society.nextIncidentId++,discipleId:pupil.id,kind:'book',subject:'wood',time:s.time,discovered:false,discoveredAt:null,handled:false,outcome:null,evidenceProgress:0,motive:'旧日私阅',restitution:12};
  s.society.secrets.push(e);pupil.mind.hiddenKnowledge.wood=e.id;
  assert.equal(society.mentorWillingness(s,pupil.id,mentor.id).willing,true);
  e.discovered=true;e.discoveredAt=s.time;
  assert.equal(society.mentorWillingness(s,pupil.id,mentor.id).willing,false);
});

test('private pill use follows motive and opportunity, then evidence, one decision and lasting effects',()=>{
  const s=state(),d=add(s);const e=secretPill(s,d);assert.ok(e);assert.equal(e.discovered,false);
  assert.equal(society.getSocietyView(s).incidents.length,0);assert.throws(()=>society.settleIncident(s,e.id,'warn'),/已查实/);
  const careful=add(s,{traits:[80,60,100,80,20]});const count=s.pills.qi;step(s,100);
  assert.equal(s.society.secrets.some(x=>x.discipleId===careful.id),false);
  assert.ok(s.pills.qi<=count);
  for(let i=0;i<300&&!e.discovered;i++)step(s);
  assert.equal(e.discovered,true);const caution=d.mind.caution;society.settleIncident(s,e.id,'restrict');
  assert.ok(d.mind.caution>caution);assert.ok(d.mind.restrictedUntil>s.time);assert.ok(d.mind.memories.some(m=>m.important&&m.key===`judgment:${e.id}`));
  assert.throws(()=>society.settleIncident(s,e.id,'restrict'),/尚未处理/);
});

test('disciplinary compensation uses an actual purse and records remaining responsibility',()=>{
  const s=state(),d=add(s),e=secretPill(s,d);assert.ok(e);step(s,400);assert.equal(e.discovered,true);
  d.mind.purse=5;const jade=s.resources.jade;society.settleIncident(s,e.id,'compensate');
  assert.equal(s.resources.jade,jade+5);assert.equal(d.mind.purse,0);assert.equal(d.mind.restitutionBalance,11);
});

test('unequal repeated forgiveness changes observers rather than rewriting personality',()=>{
  const s=state(),a=add(s),b=add(s);const first=secretPill(s,a);step(s,400);society.settleIncident(s,first.id,'warn');
  b.mind.lastPillDay=-1;b.xp=0;const second=secretPill(s,b);assert.ok(second);step(s,400);
  const traits=[...b.mind.traits],fairness=s.society.fairness,trust=a.mind.relationships.master.trust;
  society.settleIncident(s,second.id,'forgive');assert.ok(s.society.fairness<fairness);assert.ok(a.mind.relationships.master.trust<trust);assert.deepEqual(b.mind.traits,traits);
});

test('important memories survive hundreds of routine decisions and serialization',()=>{
  const s=state(),d=add(s);
  for(let i=0;i<130;i++)society.rememberPerson(s,d,`不可遗忘的经历${i}`,{important:true,key:`major:${i}`});
  for(let i=0;i<500;i++)society.rememberPerson(s,d,`日常决定${i}`);
  assert.equal(d.mind.memories.filter(m=>m.important).length,130);assert.equal(d.mind.memories.filter(m=>!m.important).length,10);
  assert.equal(society.validateSociety(JSON.parse(JSON.stringify(s))),true);
});

test('autonomous main routes stop cycling between mastered techniques',()=>{
  const s=state(),d=add(s,{realm:9,root:'土灵根',traits:[65,90,75,75,90],goal:'守成护道'});building(s,'library',2,4);
  s.doctrine.books.push('earth','foundation');known(d,'foundation',100);d.mind.knowledge.earth=100;
  step(s,1600);assert.equal(d.mind.main,'foundation');assert.notEqual(d.mind.learning?.id,'earth');
  assert.ok(d.xp>0||d.realm>9);
});

test('grass-and-medicine aspiration can release a full support slot and learn its missing prerequisite',()=>{
  const s=state(),d=add(s,{realm:3,root:'木灵根',traits:[90,35,90,70,95],goal:'精研草木'});building(s,'library',2,4);
  known(d,'qingyuan',80,['wood']);s.doctrine.books.push('wood','spring','alchemy');
  step(s,1800);assert.ok((d.mind.knowledge.spring||0)>=20);assert.ok((d.mind.knowledge.alchemy||0)>=20);
  assert.ok(d.mind.support.includes('alchemy'));assert.ok(d.mind.support.length<=sim.supportLimit(d));assert.ok(d.mind.knowledge.wood>=60);
});

test('talent or realm above the master does not compel rebellion or block willing mentorship',()=>{
  const s=state(),d=add(s,{realm:8,talent:2.8,traits:[90,90,85,90,70]});known(d,'qingyuan',20);s.master.knowledge.qingyuan=80;
  const before={talent:d.talent,trust:d.mind.relationships.master.trust};
  assert.equal(society.inviteMentor(s,d.id,'master').accepted,true);step(s,180);
  assert.equal(d.talent,before.talent);assert.ok(d.mind.relationships.master.trust>=before.trust);assert.equal(d.mind.mentorId,'master');
});

test('office invitations test competence and willingness and cannot force an unwilling NPC',()=>{
  const s=state(),d=add(s,{realm:4,traits:[80,60,70,90,50]});known(d);s.society.formal=true;
  assert.equal(society.inviteOffice(s,d.id,'steward').accepted,true);assert.equal(s.society.officers.steward,d.id);
  society.societyCommand(s,{type:'dismissOffice',role:'steward'});d.mind.relationships.master.trust=0;d.mind.relationships.master.respect=0;
  const declined=society.inviteOffice(s,d.id,'steward');assert.equal(declined.accepted,false);assert.equal(s.society.officers.steward,null);
});

test('a formal sect can follow the small expert path and charges founding resources once',()=>{
  const s=state();building(s,'library',2,4);s.master.realm=10;s.master.knowledge.qingyuan=80;
  for(let i=0;i<6;i++)known(add(s,{realm:i<2?4:2}));
  assert.equal(society.foundingStatus(s).ready,true);const before=s.resources.jade;
  society.foundSect(s,'听松门');assert.equal(s.resources.jade,before-350);assert.equal(s.sect.founded,true);
  assert.ok(s.disciples.every(d=>d.mind.memories.some(m=>m.key==='founding')));assert.throws(()=>society.foundSect(s,'再立一次'),/已经正式立派/);
});

function peakFixture() {
  const s=state();building(s,'library',2,4);const farm=building(s,'farm',4,4),quarry=building(s,'quarry',6,3);
  s.society.formal=true;s.sect.founded=true;s.sect.level=2;s.master.realm=10;s.master.knowledge.qingyuan=80;
  const herb=known(add(s,{realm:6,goal:'精研草木',traits:[90,50,80,90,80]}),'qingyuan',70,['wood']);
  const array=known(add(s,{realm:6,root:'土灵根',goal:'守成护道',traits:[80,50,85,90,70]}),'earth',70,['array']);
  for(let i=0;i<8;i++)known(add(s,{realm:4}));
  return {s,herb,array,farm,quarry};
}

test('two different peaks have paid budgets, autonomous membership and real resource multipliers',()=>{
  const {s,herb,array,farm,quarry}=peakFixture();
  const p=society.foundPeak(s,'herb',herb.id),q=society.foundPeak(s,'array',array.id);
  assert.equal(s.sect.level,3);assert.equal(p.active,true);assert.equal(q.active,true);
  assert.ok(p.members.includes(herb.id));assert.ok(q.members.includes(array.id));
  const plain=structuredClone(s);for(const peak of plain.society.peaks){peak.active=false;peak.budget=0;}
  for(const world of [s,plain]) {
    for(const d of world.disciples){d.mind.away={kind:'campaign',id:'fixture'};d.job=null;}
    const a=world.disciples.find(d=>d.id===herb.id),b=world.disciples.find(d=>d.id===array.id);a.mind.away=null;b.mind.away=null;
    productive(world,a,world.buildings.find(b=>b.id===farm.id));productive(world,b,world.buildings.find(b=>b.id===quarry.id));
  }
  const before={herb:s.resources.herb,stone:s.resources.stone};step(s,20);step(plain,20);
  assert.ok(s.resources.herb-before.herb>plain.resources.herb-before.herb);
  assert.ok(s.resources.stone-before.stone>plain.resources.stone-before.stone);
});

test('peak instruction speeds actual learning and lost funding can be restored',()=>{
  const {s,herb}=peakFixture();const peak=society.foundPeak(s,'herb',herb.id);s.doctrine.books.push('spring');
  const student=s.disciples[3];student.mind.peakId=peak.id;student.mind.activity='study';student.mind.learning={id:'spring',progress:0};student.mind.commitUntil=1000;student.mind.lastDecision=0;
  const library=s.buildings.find(b=>b.type==='library');Object.assign(student.mind.scenic,buildingAccess(s,library),{path:[],goal:buildingAccess(s,library),revision:geometryRevision(s)});
  const plain=structuredClone(s);plain.society.peaks[0].active=false;plain.society.peaks[0].budget=0;
  step(s,5);step(plain,5);assert.ok(student.mind.learning.progress>plain.disciples[3].mind.learning.progress);
  s.resources.jade=0;s.resources.herb=0;s.time=119;s.society.clock=119;step(s);assert.equal(peak.active,false);
  s.resources.jade=100;s.resources.herb=100;society.societyCommand(s,{type:'setPeakBudget',peakId:peak.id,budget:1});assert.equal(peak.active,true);
});

test('teacher and pupil both spend time, and lessons improve learning instead of writing knowledge immediately',()=>{
  const s=state(),mentor=known(add(s,{realm:4}),'qingyuan',80),student=known(add(s),'qingyuan',20);
  assert.equal(society.inviteMentor(s,student.id,mentor.id).accepted,true);
  mentor.mind.activity='teach';mentor.mind.commitUntil=1000;mentor.mind.lastDecision=0;
  student.mind.activity='study';student.mind.learning={id:'qingyuan',progress:0,practice:true};student.mind.commitUntil=1000;student.mind.lastDecision=0;
  const plain=structuredClone(s);plain.disciples[0].mind.activity='rest';
  step(s,10);step(plain,10);assert.ok(student.mind.knowledge.qingyuan>plain.disciples[1].mind.knowledge.qingyuan);
  assert.ok(mentor.energy<100);assert.equal(student.mind.knowledge.qingyuan<100,true);assert.ok(s.society.stats.lessons>0);
});

test('repeated reconciliation without a new conflict cannot farm trust',()=>{
  const s=state(),d=add(s),before=d.mind.relationships.master.trust;
  for(let i=0;i<5;i++){society.societyCommand(s,{type:'talk',discipleId:d.id,topic:'reconcile'});s.time+=120;s.society.clock=s.time;}
  assert.equal(d.mind.relationships.master.trust,before);
  d.mind.relationships.master.conflict=4;society.societyCommand(s,{type:'talk',discipleId:d.id,topic:'reconcile'});
  assert.equal(d.mind.relationships.master.conflict,0);assert.equal(d.mind.relationships.master.trust,before+2);
});

test('finite family and study quest templates consume resources, wait for action and resolve only once',()=>{
  const s=state(),family=add(s,{traits:[90,40,80,70,70]}),research=known(add(s,{traits:[40,70,70,60,90]}));building(s,'library',2,4);
  step(s,120);const fq=s.society.quests.find(q=>q.discipleId===family.id),rq=s.society.quests.find(q=>q.discipleId===research.id);
  assert.equal(fq.kind,'family');assert.equal(rq.kind,'mastery');const herb=s.resources.herb;
  society.resolvePersonalQuest(s,fq.id,'aid');assert.equal(s.resources.herb,herb-12);assert.equal(fq.status,'active');
  society.resolvePersonalQuest(s,rq.id,'support');assert.equal(rq.status,'active');
  step(s,61);assert.equal(fq.status,'completed');assert.ok(family.mind.skills.plant>=10);assert.throws(()=>society.resolvePersonalQuest(s,fq.id,'aid'),/不可回应/);
  for(let i=0;i<900&&rq.status==='active';i++)step(s);
  assert.equal(rq.status,'completed');assert.ok(research.mind.knowledge[rq.target]>=rq.targetMastery);
  assert.ok(research.mind.memories.some(m=>m.key===`quest:${rq.id}`));
});

test('belonging quest outcomes depend on actual fairness and relationship, not a guaranteed button reward',()=>{
  const s=state(),d=add(s);d.mind.relationships.master.trust=30;step(s,120);
  const q=s.society.quests.find(q=>q.discipleId===d.id);assert.equal(q.kind,'belonging');
  s.society.fairness=20;society.resolvePersonalQuest(s,q.id,'mediate');const trust=d.mind.relationships.master.trust;
  step(s,46);assert.equal(q.status,'completed');assert.match(q.outcome,/未能/);assert.ok(d.mind.relationships.master.trust<trust);
});

test('three finite visitor templates give distinct actual effects with one payment and a cooldown',()=>{
  const s=state(),d=add(s);building(s,'library',2,4);s.sect.reputation=30;
  const seen=new Set();
  for(let turn=0;turn<10&&seen.size<3;turn++) {
    for(let i=0;i<400&&!s.society.visitors.some(v=>v.status==='present');i++)step(s);
    const v=s.society.visitors.find(v=>v.status==='present');assert.ok(v);seen.add(v.kind);
    const choice=v.kind==='healer'?'consult':v.kind==='scholar'?'exchange':'teach';
    d.wound=20;const jade=s.resources.jade;society.resolveVisitor(s,v.id,choice);assert.ok(s.resources.jade<jade);
    if(v.kind==='healer')assert.equal(d.wound,8);
    if(v.kind==='scholar')assert.ok(s.doctrine.books.includes('wood'));
    if(v.kind==='artisan')assert.ok(s.doctrine.books.includes('array'));
    assert.throws(()=>society.resolveVisitor(s,v.id,choice),/已经处理/);const next=s.society.nextVisitorAt;
    step(s,10);assert.equal(s.society.visitors.some(v=>v.status==='present'),false);assert.ok(next>s.time);
  }
  assert.deepEqual(seen,new Set(['healer','scholar','artisan']));assert.ok(s.society.stats.visitorsResolved>=3);
});

test('revenge invitations can be declined; agreed shared outcomes create durable consequences',()=>{
  const s=state(),d=add(s);d.mind.revengeAttitude='oppose';assert.equal(society.canAccompany(s,d,{revenge:true,risk:.2}).willing,false);
  d.mind.revengeAttitude='cautious';assert.equal(society.canAccompany(s,d,{revenge:true,risk:.1}).willing,true);
  const trust=d.mind.relationships.master.trust;society.campaignOutcome(s,d,{kind:'救出故人',success:true,injury:8,revenge:true});
  assert.equal(d.wound,8);assert.ok(d.mind.relationships.master.trust>trust);assert.ok(d.mind.memories.some(m=>m.important&&m.text.includes('救出故人')));
});

test('save/load preserves decisions, secrets, visitors and PRNG without rerolling',()=>{
  const s=state(),d=add(s);building(s,'library',2,4);s.doctrine.books.push('wood');secretPill(s,d);step(s,200);
  const restored=JSON.parse(JSON.stringify(s));assert.equal(society.validateSociety(restored),true);
  step(s,900);step(restored,900);assert.deepEqual(restored,s);
});

test('legacy NPC journey migration preserves paid cost, old reward and once-only completion',()=>{
  const s=state(),d=add(s);delete s.society;s.incidents=[];
  s.expedition={routeId:'valley_path',discipleId:d.id,total:40,remaining:3,status:'traveling',encounterResolved:true,multiplier:1.5};
  society.initSociety(s,{legacy:true,legacyRoutes:{valley_path:{reward:{herb:24,wood:12},reputation:12}}});
  const herb=s.resources.herb,wood=s.resources.wood,jade=s.resources.jade;
  assert.equal(s.expedition,null);assert.equal(d.mind.journey.remaining,3);step(s,3);
  assert.equal(s.resources.herb,herb+36);assert.equal(s.resources.wood,wood+18);assert.equal(s.resources.jade,jade);assert.equal(d.mind.journey,null);
  const count=s.stats.expeditions;step(s,20);assert.equal(s.stats.expeditions,count);assert.equal(society.validateSociety(s),true);
});

test('malformed society state is rejected rather than normalized into a plausible save',()=>{
  const s=state();add(s);
  for(const mutate of [x=>x.society.nextVisitorId=0,x=>x.disciples[0].mind.satiety=-1,x=>x.disciples[0].mind.activity='forced',x=>x.disciples[0].mind.relationships.master.trust=101,x=>x.disciples[0].mind.hiddenKnowledge={ember:999},x=>x.society.officers.teacher=999,x=>x.disciples[0].mind.mentorId=x.disciples[0].id]) {
    const bad=structuredClone(s);mutate(bad);assert.throws(()=>society.validateSociety(bad),/存档异常/);
  }
});
