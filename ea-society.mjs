import {npcScheduleDecision} from './ea-sr-persons.mjs?v=ea-160-courtyard-20261008-r15';
import {hallInteriorEnabled} from './ea-hall-interior.mjs?v=ea-160-courtyard-20261008-r15';
import {prepareFacilityActivity,releaseBodyActivity,contributeProduction} from './ea-facility-activities.mjs?v=ea-160-courtyard-20261008-r15';
import {sceneUnits} from './ea-sr-spatial.mjs?v=ea-160-courtyard-20261008-r15';
import {consumeHarvest,availablePills,ownAvailablePills,preparePillUse,consumeAccessiblePill} from './ea-sr-economy.mjs?v=ea-160-courtyard-20261008-r15';
import {BUILDINGS, TECHNIQUES, RECIPES, ROUTES, CELLS, RESOURCES, TRAIT_NAMES,
  rng, day, log, pay, canPay, grant, capacity, xpNeed, clamp} from './ea-data.mjs?v=ea-160-courtyard-20261008-r15';

import {routeDiscovered} from './ea-scene-state.mjs?v=ea-160-courtyard-20261008-r15';
import {lifeFacility,lifeActivityLock,lifePath,lifeScenePath,actorScenePosition,personLifeSummary,workOpportunity,teachingPresent} from './ea-life.mjs?v=ea-160-courtyard-20261008-r15';
import {advanceScenic,repairScenicActor,validateScenic,SCENE_GEOMETRY,buildingAccess,scenicDistance,geometryRevision,syncScenicPosition} from './ea-scenic.mjs?v=ea-160-courtyard-20261008-r15';

/** Society owns every NPC action. The main loop owns time, meals, upkeep and the master's actions. */
export const SOCIETY_ROLES = {
  steward:{name:'庶务执事',description:'协调供给，使愿意响应的门人更重视紧缺物资。'},
  teacher:{name:'传功执事',description:'有时间且愿意时授课，实际占用自己的工作和修行时间。'},
  warden:{name:'护院执事',description:'巡查现有证据，提高查知违规的机会。'}
};
export const PEAK_DIRECTIONS = {
  herb:{name:'青木药峰',description:'青木、养脉与药理传承；成员的灵植产出和相应授业得到增益。',techniques:['wood','spring','alchemy'],outputs:['herb','food'],building:'farm',cost:{jade:240,wood:100,stone:65,herb:35}},
  array:{name:'厚土阵峰',description:'厚土与护脉传承；成员的采石、灵晶产出和相应授业得到增益。',techniques:['array','earth'],outputs:['stone','crystal'],building:'quarry',cost:{jade:260,wood:70,stone:110,insight:25}}
};
export const SOCIETY_RULE_OPTIONS = {
  pillRule:[{id:'shared',label:'按需共用'},{id:'permission',label:'登记获准'}],
  outingRule:[{id:'notice',label:'出行留讯'},{id:'open',label:'自由来往'},{id:'restricted',label:'暂缓外出'}],
  workFocus:[{id:'balanced',label:'均衡差事'},...['food','wood','stone','herb','crystal','insight','jade'].map(id=>({id,label:`侧重${RESOURCES[id]}`}))],
  enforcement:[{id:'restorative',label:'重解释与补偿'},{id:'strict',label:'重记录与约束'}]
};
const FOUNDING_COST = {jade:350,wood:100,stone:100,insight:30};
const ACTIVITIES = new Set(['rest','heal','forage','work','study','cultivate','teach','travel','social','breakthrough']);
const profiles = [[82,44,78,68,62],[45,88,36,57,80],[65,60,70,85,48],[38,91,30,70,90]];
const goals = ['精研草木','求取长生','守成护道','求索奇法'];
const clock = s => s.society?.clock ?? s.time;
const npc = (s,id) => typeof id==='object'?id:s.disciples.find(d=>d.id===id);
const mindOf = p => p?.mind || p;
const buildingActive = b => b && !b.disabled && b.enabled!==false && (b.condition===undefined||b.condition>0);
const hasBuilding = (s,type) => s.buildings.some(b=>b.type===type && buildingActive(b));
const living = (s,id) => s.disciples.some(d=>d.id===id);
const sign = n => n>0?1:n<0?-1:0;
const known = (d,id) => (mindOf(d).knowledge?.[id]||0);
const publicKnowledge = (s,d,id) => d.mind&&hiddenBook(s,d,id)?0:known(d,id);
const bestMastery = (s,d) => Math.max(0,...Object.keys(mindOf(d).knowledge||{}).map(id=>publicKnowledge(s,d,id)));
const relation = (d,key='master') => {
  const p=d.mind;
  return p.relationships[key] ||= {trust:55,respect:55,affection:45,conflict:0,lastEvent:-1000};
};
const readRelation = (d,key='master') => d.mind.relationships[key] || {trust:55,respect:55,affection:45,conflict:0,lastEvent:-1000};
function changeRelation(s,d,key,changes,event) {
  const r=relation(d,key);
  for(const [k,v] of Object.entries(changes)) if(['trust','respect','affection','conflict'].includes(k))r[k]=clamp(r[k]+v,0,100);
  r.lastEvent=clock(s);
  if(event)remember(s,d,event,{important:true,key:`relationship:${key}:${event}`});
}
export function rememberPerson(s,dOrId,text,{important=false,public:visible=true,key=null}={}) {
  const d=npc(s,dOrId); if(!d)return;
  return remember(s,d,text,{important,public:visible,key});
}
function remember(s,d,text,{important=false,public:visible=true,key=null}={}) {
  const p=d.mind;
  if(key&&p.memories.some(m=>m.key===key))return;
  p.memories.unshift({time:clock(s),text:String(text).slice(0,500),important,public:visible,key});
  let recent=0;
  p.memories=p.memories.filter(m=>m.important||++recent<=10);
}
function defaultPosition(s) {
  const hall=s.buildings.find(b=>b.type==='hall');
  return CELLS.find(c=>Math.abs(c.x-(hall?.x||3))+Math.abs(c.y-(hall?.y||2))===1&&!s.buildings.some(b=>b.x===c.x&&b.y===c.y))||{x:3,y:3};
}
export function initDisciple(s,d,{legacy=false}={}) {
  d.energy ??= 100; d.wound ??= 0; d.job ??= null; d.position ??= {...defaultPosition(s)};
  d.trait ??= '自择其道';
  const p=d.mind ||= {};
  p.traits ||= [...profiles[(d.id-1)%profiles.length]];
  p.goal ||= goals[(d.id-1)%goals.length];
  p.main ??= null; p.support ||= []; p.knowledge ||= {}; p.learning ??= null;
  p.activity ||= 'rest'; p.reason ||= '初到山院，先了解生活与传承。';
  p.memories=(p.memories||[]).map(m=>({important:/赠药|救治|亲人|加入|拜入|离开|掌握|突破|处置|劝诫|不予追究/.test(m.text),public:true,key:null,...m}));
  p.lastPillDay ??= -1; p.caution ??= 0;
  p.satiety ??= 85; p.mood ??= 60; p.commitUntil ??= 0; p.lastDecision ??= -100;
  p.lastSocial ??= -120; p.lastTalk ??= -120; p.lastBreakthrough ??= -120;
  p.relationships ||= {}; relation(d);
  p.skills ||= {plant:0,industry:0,learning:0,array:0,medicine:0};
  for(const k of ['plant','industry','learning','array','medicine'])p.skills[k] ??= 0;
  p.mentorId ??= null; p.peakId ??= null; p.office ??= null; p.path ||= [];
  p.away ??= null; p.journey ??= null; p.workProgress ??= 0;
  p.publicMain ??= p.main; p.hiddenKnowledge ||= {}; p.restrictedUntil ??= 0;
  p.purse ??= 8; p.restitutionBalance ??= 0; p.pillPermitDay ??= -1;
  p.neglectDays ??= 0; p.joinedAt ??= clock(s); p.questKinds ||= [];
  p.revengeAttitude ||= p.traits[0]>=70?'cautious':p.traits[1]>=75?'support':'oppose';
  p.lastPeakChange ??= -120; p.refusalUntil ??= 0;
  p.reorientUntil ??= 0;
  p.lastConversion ??= -600;
  p.supportIntent ??= null;
  initLifeScenic(s,d);
  if(s.society)s.society.nextPersonId=Math.max(s.society.nextPersonId||1,d.id+1);
  if(legacy&&!p.memories.some(m=>m.key==='legacy'))remember(s,d,'旧日修行与既有传承得以保留，如今自行权衡生活与求道。',{important:true,key:'legacy'});
  return d;
}
export function initLifeScenic(s,d){
 const p=d.mind;if(p.scenic!==undefined)return;
 const facility=lifeFacility(s,d),start=facility?buildingAccess(s,facility):buildingAccess(s,s.buildings.find(b=>b.type==='hall'));
 p.scenic={...start,path:[],steps:0,facing:1,back:false,geometry:SCENE_GEOMETRY,revision:geometryRevision(s),goal:null};
 if(p.path?.length){const destination=lifeFacility(s,d);p.scenic.path=destination?lifeScenePath(s,d,destination)||[]:[];p.scenic.goal=p.scenic.path.at(-1)||null;p.path=[];}
}
export function initSociety(s,{legacy=false,legacyRoutes=null}={}) {
  s.doctrine ||= {books:['qingyuan'],sealed:[],workFocus:'balanced',pillRule:'shared',routes:[]};
  s.doctrine.outingRule ??= 'notice'; s.doctrine.enforcement ??= 'restorative';
  s.incidents ||= []; s.logs ||= []; s.pills ||= {}; s.stats ||= {}; s.sect ||= {level:1,reputation:0};
  const first=!s.society;
  s.society ||= {revision:1,clock:s.time,lastDay:day(s),formal:!!s.sect.founded||s.sect.level>=2,
    foundedAt:null,name:s.sect.name||'云岫山院',fairness:65,officers:{steward:null,teacher:null,warden:null},
    peaks:[],secrets:[],quests:[],visitors:[],visitorHistory:[],invitations:[],departed:[],
    nextIncidentId:1,nextPeakId:1,nextQuestId:1,nextVisitorId:1,nextPersonId:1,nextVisitorAt:s.time+180,
    stats:{workCycles:0,lessons:0,relationships:0,questsCompleted:0,visitorsResolved:0,discovered:0},
    lastShortageNotice:-120};
  for(const d of s.disciples)initDisciple(s,d,{legacy});
  if(first&&legacy) {
    if(s.expedition) {
      const e=s.expedition,d=npc(s,e.discipleId),r=legacyRoutes?.[e.routeId]||ROUTES[e.routeId];
      if(d&&r){d.mind.journey={routeId:e.routeId,total:e.total,remaining:e.remaining,encounterResolved:e.encounterResolved,risk:0,legacy:true,multiplier:e.multiplier,snapshotReward:{...r.reward},snapshotReputation:r.reputation,snapshotXp:30};d.mind.away={kind:'errand',id:e.routeId};d.mind.activity='travel';d.mind.reason='继续迁移前已经开始的游历，原有准备与收获约定仍然有效。';d.job=null;s.expedition=null;}
    }
    for(const old of s.incidents) {
      const d=npc(s,old.discipleId); if(!d)continue;
      const e={id:s.society.nextIncidentId++,discipleId:d.id,kind:old.kind,subject:old.kind==='pill'?'qi':s.doctrine.sealed.find(id=>known(d,id))||s.doctrine.sealed[0]||'qingyuan',time:old.time,
        discovered:!!old.discovered,discoveredAt:old.discovered?s.time:null,handled:!!old.handled,outcome:old.handled?'旧档中已处置':null,evidenceProgress:old.discovered?100:20,motive:'旧日留下的院规记录',restitution:12};
      s.society.secrets.push(e);
      if(!e.discovered&&e.kind==='book')d.mind.hiddenKnowledge[e.subject]=e.id;
    }
    const concealedNames=s.society.secrets.filter(e=>!e.discovered&&e.kind==='book').map(e=>TECHNIQUES[e.subject]?.name).filter(Boolean);
    s.logs=s.logs.filter(l=>!concealedNames.some(n=>l.text.includes(n)));
    for(const d of s.disciples) {
      const hidden=Object.keys(d.mind.hiddenKnowledge);
      if(hidden.includes(d.mind.publicMain))d.mind.publicMain=null;
      d.mind.memories=d.mind.memories.filter(m=>!hidden.some(id=>m.text.includes(TECHNIQUES[id]?.name||'\0')));
      if(d.mind.learning&&s.doctrine.sealed.includes(d.mind.learning.id))d.mind.reason='独处参悟，暂不愿详谈。';
    }
  }
  syncPublicIncidents(s);
  return s;
}
export const migrateSociety = (s) => initSociety(s,{legacy:true});
export const initPerson = initDisciple;

function syncPublicIncidents(s) {
  s.incidents=s.society.secrets.filter(e=>e.discovered).map(e=>({id:e.id,discipleId:e.discipleId,kind:e.kind,time:e.time,discovered:true,handled:e.handled,outcome:e.outcome}));
  s.incidentId=s.society.nextIncidentId;
}
function hiddenBook(s,d,id) {
  return !!d.mind.hiddenKnowledge[id]&&s.society.secrets.some(e=>e.id===d.mind.hiddenKnowledge[id]&&!e.discovered);
}
function addSecret(s,d,kind,subject,motive) {
  const existing=s.society.secrets.find(e=>e.discipleId===d.id&&e.kind===kind&&!e.handled);
  if(existing)return existing;
  const e={id:s.society.nextIncidentId++,discipleId:d.id,kind,subject,time:clock(s),discovered:false,discoveredAt:null,handled:false,outcome:null,evidenceProgress:0,motive,restitution:kind==='pill'?16:kind==='book'?12:10};
  s.society.secrets.push(e);
  if(kind==='book')d.mind.hiddenKnowledge[subject]=e.id;
  s.incidentId=s.society.nextIncidentId;
  return e;
}
function discover(s,e) {
  const d=npc(s,e.discipleId); if(!d||e.discovered)return;
  e.discovered=true; e.discoveredAt=clock(s); e.evidenceProgress=100;
  const labels={pill:'取丹簿与库存不符，查实其未经登记取丹',book:'封卷封签与借阅痕迹相合，查实其私阅封存典籍',outing:'出行留讯与山口见证相互印证，查实其违反外出约定'};
  log(s,`${d.name}：${labels[e.kind]}。已记录证据，可听取解释并处置。`);
  remember(s,d,'一次私下行为被查知，掌门的处置将影响我对山院的信任。',{important:true,key:`discovery:${e.id}`});
  if(e.kind==='book') {
    delete d.mind.hiddenKnowledge[e.subject];
    if(d.mind.main===e.subject)d.mind.publicMain=e.subject;
  }
  s.society.stats.discovered++; syncPublicIncidents(s);
}
function investigate(s) {
  const warden=npc(s,s.society.officers.warden);
  const patrol=warden&&!warden.mind.away&&warden.energy>25?1:0;
  for(const e of s.society.secrets) {
    if(e.discovered||e.handled||!living(s,e.discipleId))continue;
    const d=npc(s,e.discipleId);
    let evidence=0;
    if(e.kind==='pill'&&day(s)>Math.floor(e.time/120))evidence=1.2;
    if(e.kind==='book'&&hasBuilding(s,'library')&&s.disciples.some(x=>x.id!==d.id&&['study','work','teach'].includes(x.mind.activity)))evidence=.8;
    if(e.kind==='outing'&&!d.mind.away)evidence=1.1;
    if(evidence)e.evidenceProgress+=evidence+(patrol?1.1:0)+(hasBuilding(s,'watchtower')?.7:0)+(s.doctrine.enforcement==='strict'?.4:0);
    if(e.evidenceProgress>=100)discover(s,e);
  }
}

function neighbors(p) {return [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:p.x+dx,y:p.y+dy}));}
function pathTo(s,d,b) {
  if(!buildingActive(b)||b.accessible===false||b.unreachable)return null;
  const blocked=new Set(s.buildings.map(x=>`${x.x},${x.y}`));
  const cells=new Set(CELLS.map(c=>`${c.x},${c.y}`));
  const targets=new Set(neighbors(b).filter(c=>cells.has(`${c.x},${c.y}`)&&!blocked.has(`${c.x},${c.y}`)).map(c=>`${c.x},${c.y}`));
  const start=d.position||defaultPosition(s), queue=[{...start,path:[]}], seen=new Set([`${start.x},${start.y}`]);
  for(let i=0;i<queue.length;i++) {
    const p=queue[i]; if(targets.has(`${p.x},${p.y}`))return p.path;
    for(const n of neighbors(p)) {const k=`${n.x},${n.y}`;if(cells.has(k)&&!blocked.has(k)&&!seen.has(k)){seen.add(k);queue.push({...n,path:[...p.path,n]});}}
  }
  return null;
}
const occupied = (s,d,b) => s.schemaVersion!==6&&b.type!=='hall'&&s.disciples.some(x=>x.id!==d.id&&x.job===b.id&&!x.mind.away);
function studyLock(s,d,id,hooks={}) {
  if(hooks.studyLock)return hooks.studyLock(s,d,id,false);
  const t=TECHNIQUES[id],p=d.mind;
  if(!t||!s.doctrine.books.includes(id))return '府中无此典籍';
  if(d.realm<t.realm)return `需炼气${t.realm}层`;
  if(p.main===id||p.support.includes(id))return '已经修习';
  if(id!=='qingyuan'&&!hasBuilding(s,'library'))return '需要藏经阁';
  if(t.kind==='support'&&!p.support.includes(id)&&p.support.length>=(d.realm>=10?3:d.realm>=4&&d.talent>=1.4?2:1))return '辅修精力已满';
  if([p.main,...p.support].some(x=>TECHNIQUES[x]?.conflicts?.includes(id)||t.conflicts?.includes(x)))return '功体相冲';
  for(const q of t.prerequisites||[])if(q.id&&known(d,q.id)<q.mastery||q.anyMain&&known(d,p.main)<q.anyMain)return '基础尚未成熟';
  return '';
}
const fatigue = d => TECHNIQUES[d.mind.main]?.fatigue??.28;
function peakFor(s,d) {return s.society.peaks.find(p=>p.id===d.mind.peakId&&p.active&&living(s,p.hostId));}
function lessonBonus(s,d,id) {
  let value=1;
  const mentor=d.mind.mentorId==='master'?s.master:npc(s,d.mind.mentorId);
  if(mentor&&known(mentor,id)>=45&&teachingPresent(s,mentor,d,id))value+=.35;
  if(known(s.master,id)>=45&&teachingPresent(s,s.master,d,id))value+=.2;
  const teacher=npc(s,s.society.officers.teacher);
  if(teacher&&teacher.id!==d.id&&known(teacher,id)>=50&&teachingPresent(s,teacher,d,id))value+=.25;
  if(s.society.guestLesson?.until>clock(s)&&s.society.guestLesson.topic===id)value+=.35;
  const peak=peakFor(s,d);
  if(peak&&PEAK_DIRECTIONS[peak.direction].techniques.includes(id))value+=.15+.08*peak.budget;
  return value;
}
function production(s,d,b,hooks,participants=null) {
  const t=BUILDINGS[b.type];
  if(!participants&&t.input&&!canPay(s,t.input))return false;
  let out=hooks.buildingYield?hooks.buildingYield(s,b,d):Object.fromEntries(Object.entries(t.out).map(([k,v])=>[k,v*b.level*(.8+.2*d.talent)]));
  if(!Object.values(out).some(v=>v>0))return false;
  if(!participants&&t.input)pay(s,t.input);
  const peak=peakFor(s,d), tags=t.tags||[], skill=tags.includes('plant')?'plant':tags.includes('learning')?'learning':tags.includes('water')?'array':'industry';
  out=Object.fromEntries(Object.entries(out).map(([k,v])=>[k,v*(1+d.mind.skills[skill]/250)*(peak&&PEAK_DIRECTIONS[peak.direction].outputs.includes(k)?1+.12*peak.budget:1)]));
  if(participants){const credited=participants.reduce((total,p)=>total+p.share,0);out={};for(const {person,share}of participants){const yields=hooks.buildingYield?hooks.buildingYield(s,b,person):Object.fromEntries(Object.entries(t.out).map(([k,v])=>[k,v*b.level*(.8+.2*person.talent)])),pk=peakFor(s,person);for(const[k,v]of Object.entries(yields))out[k]=(out[k]||0)+v*share/credited*(1+person.mind.skills[skill]/250)*(pk&&PEAK_DIRECTIONS[pk.direction].outputs.includes(k)?1+.12*pk.budget:1);}}
  grant(s,out); s.society.stats.workCycles++;hooks.onProduction?.(s,d,b,out);
  for(const {person,share}of participants||[{person:d,share:1}]) {
    const p=person.mind;p.skills[skill]=clamp(p.skills[skill]+.6*share,0,100);
    if(s.srEconomy){const wage=Math.min(.8*share,s.resources.jade);s.resources.jade-=wage;p.purse=clamp(p.purse+wage,0,10000);}else p.purse=clamp(p.purse+.8*share,0,10000);
    p.restitutionBalance=Math.max(0,p.restitutionBalance-Object.values(out).reduce((a,b)=>a+b,0)*.2*share);
    if(skill==='plant'&&known(person,'wood'))p.knowledge.wood=clamp(known(person,'wood')+.18*share,0,100);
    if(skill==='array'&&known(person,'array'))p.knowledge.array=clamp(known(person,'array')+.18*share,0,100);
  }
  return true;
}
function consumePill(s,d,id,secret,hooks) {
  const r=RECIPES[id]; if(!r||id==='foundation')return false;
  if(s.srEconomy&&availablePills(s,d.personId,id)<1){const a=s.activitiesById[d.activityId];if(a&&a.kind!=='facility')return false;try{preparePillUse(s,id,d.personId);}catch{}return false;}
  if(!s.srEconomy&&!(s.pills[id]>0))return false;
  if(hooks.consumePill)hooks.consumePill(s,id,d,{silent:true});
  else {if(s.srEconomy)consumeAccessiblePill(s,d.personId,id);else s.pills[id]--;d.xp=Math.min(xpNeed(d.realm),d.xp+(r.effect.xp||0));d.energy=clamp(d.energy+(r.effect.energy||0),0,100);d.wound=clamp(d.wound-(r.effect.wound||0),0,100);}
  d.mind.lastPillDay=day(s);
  if(secret)addSecret(s,d,'pill',id,'修为停滞而急于进境，趁取用记录未核对私取丹药。');
  else remember(s,d,`依据取用约定，自行服用${r.name}。`,{key:`pill:${day(s)}`});
  return true;
}
function considerPill(s,d,hooks) {
  const p=d.mind;
  if(p.lastPillDay===day(s)||p.away)return;
  const hasPill=id=>s.pills[id]>0||(s.srEconomy&&availablePills(s,d.personId,id)>0);
  const id=d.wound>20&&hasPill('heal')?'heal':d.energy<28&&hasPill('spirit')?'spirit':d.xp<xpNeed(d.realm)-65&&hasPill('qi')?'qi':null;
  if(!id)return;
  const ownPill=s.srEconomy&&ownAvailablePills(s,d.personId,id)>0;
  const authorized=ownPill||((s.doctrine.pillRule==='shared'||p.pillPermitDay===day(s))&&p.restrictedUntil<=clock(s));
  const temptation=p.traits[1]-p.traits[2]-p.caution*13+(d.wound>35?20:0);
  const opportunity=hasBuilding(s,'alchemy')||s.pills[id]>0;
  if(authorized)consumePill(s,d,id,false,hooks);
  else if(opportunity&&temptation>35&&!s.society.secrets.some(e=>e.discipleId===d.id&&!e.handled)&&rng(s)<.28)consumePill(s,d,id,true,hooks);
}
function candidateStudy(s,d,hooks) {
  const p=d.mind, choices=[];
  if(p.learning) {
    const id=p.learning.id, sealed=s.doctrine.sealed.includes(id)||p.restrictedUntil>clock(s), defiant=p.traits[4]-p.traits[2]-p.caution*12>28;
    if(lifeFacility(s,d,'study',id)&&((!sealed&&p.restrictedUntil<=clock(s))||defiant))choices.push({activity:'study',job:null,learning:p.learning,score:93,reason:hiddenBook(s,d,id)||sealed?'独处参悟，暂不愿详谈。':`继续研习《${TECHNIQUES[id].name}》，专心完成既定功课。`});
    return choices;
  }
  for(const id of s.doctrine.books) {
    if(studyLock(s,d,id,hooks))continue;
    const t=TECHNIQUES[id],sealed=s.doctrine.sealed.includes(id)||p.restrictedUntil>clock(s);
    if(t.kind==='support'&&!p.support.includes(id)&&known(d,id)>=100)continue;
    if(sealed&&p.traits[4]-p.traits[2]-p.caution*12<=28)continue;
    if(t.kind==='main'&&p.main&&id!==p.main) {
      if(id==='qingyuan'||known(d,p.main)<45||clock(s)-p.lastConversion<300)continue;
      if(id==='foundation'&&known(d,id)>=35)continue;
      if(id!=='foundation'&&mainPriority(d,id)<mainPriority(d,p.main)+12)continue;
      if(known(d,id)>=100)continue;
    }
    const affinity=d.root.startsWith({wood:'木',water:'水',fire:'火',earth:'土',metal:'金'}[t.element]||'无')?15:0;
    const goalBonus=p.goal.includes('草木')&&['wood','spring','alchemy'].includes(id)?15:p.goal.includes('护道')&&['earth','array'].includes(id)?15:0;
    const conversion=t.kind==='main'&&p.main&&p.main!==id;
    const research=s.society.quests.some(q=>q.discipleId===d.id&&q.status==='active'&&q.kind==='mastery'&&q.target===id)?20:0;
    choices.push({activity:'study',job:null,learning:{id,progress:0,total:Math.ceil(t.duration*(conversion?1.6:1)),mode:conversion?'convert':known(d,id)?'deepen':'learn'},score:(p.main?36:91)+p.traits[4]*.35+affinity+goalBonus+research-(sealed?15:0)+(id==='foundation'&&d.realm>=9?25:0)+(p.supportIntent===id?45:0),reason:sealed?'独处参悟，暂不愿详谈。':`${conversion?'考虑以更长时间转修':'愿意花时间研习'}《${t.name}》。`});
  }
  if(p.main&&known(d,p.main)<100)choices.push({activity:'study',job:null,learning:{id:p.main,progress:0,practice:true},score:22+p.traits[4]*.22+(known(d,p.main)<45?12:0),reason:hiddenBook(s,d,p.main)?'独处参悟，暂不愿详谈。':'反复研考已学功法，积累能够授业的理解。'});
  for(const id of p.support)if(known(d,id)<75&&!hiddenBook(s,d,id))choices.push({activity:'study',job:null,learning:{id,progress:0,practice:true},score:20+p.traits[4]*.22+(p.goal.includes('草木')&&['wood','alchemy'].includes(id)?15:0),reason:`研考已学的《${TECHNIQUES[id].name}》，积累授业能力。`});
  const research=s.society.quests.find(q=>q.discipleId===d.id&&q.status==='active'&&q.kind==='mastery');
  if(research&&research.target)choices.push({activity:'study',job:null,learning:{id:research.target,progress:0,practice:true,research:true},score:86+p.traits[4]*.12,reason:hiddenBook(s,d,research.target)?'独处参悟，暂不愿详谈。':'愿意兑现自己提出的研考计划，整理心得与疑问。'});
  return choices;
}
function mainPriority(d,id) {
  const p=d.mind,t=TECHNIQUES[id];if(!t)return 0;
  const root={wood:'木',water:'水',fire:'火',earth:'土',metal:'金'}[t.element];
  const affinity=root&&d.root.startsWith(root)?25:0;
  return ({qingyuan:25,ember:45,frost:45,earth:55,river:65,foundation:80}[id]||0)+affinity+(id==='earth'&&p.goal.includes('护道')?20:0)+(id==='foundation'&&d.realm>=9&&known(d,id)<35?50:0);
}
function supportPriority(d,id) {
  const herb=d.mind.goal.includes('草木'),array=d.mind.goal.includes('护道')||d.root.startsWith('土');
  if(herb&&id==='spring'&&known(d,'spring')<20&&d.realm>=3)return 115;
  return (herb?{alchemy:100,wood:65,spring:55,array:25,flame:45,sword:15}:array?{array:100,spring:40,wood:30,alchemy:25,flame:15,sword:55}:{sword:d.mind.traits[1]>75?90:50,array:65,alchemy:60,wood:30,spring:40,flame:45})[id]||0;
}
function considerSupportChange(s,d,hooks) {
  const p=d.mind,limit=hooks.supportLimit?hooks.supportLimit(d):(d.realm>=10?3:d.realm>=4&&d.talent>=1.4?2:1);
  if(p.support.length<limit||p.learning||d.energy<55||!canPay(s,{herb:4,insight:1}))return false;
  const targets=s.doctrine.books.filter(id=>TECHNIQUES[id]?.kind==='support'&&!p.support.includes(id)&&!s.doctrine.sealed.includes(id)&&d.realm>=TECHNIQUES[id].realm).sort((a,b)=>supportPriority(d,b)-supportPriority(d,a));
  const old=[...p.support].sort((a,b)=>supportPriority(d,a)-supportPriority(d,b))[0];
  const target=targets.find(id=>supportPriority(d,id)>=supportPriority(d,old)+25&&(!hooks.studyLock||/辅修精力/.test(hooks.studyLock(s,d,id,false))));
  if(!target||known(d,old)<30)return false;
  // Check all other gates after temporarily omitting the candidate; no authority or forced learning is implied.
  const previous=p.support;p.support=previous.filter(id=>id!==old);const lock=studyLock(s,d,target,hooks);p.support=previous;
  if(lock)return false;
  pay(s,{herb:4,insight:1});p.support=p.support.filter(id=>id!==old);d.energy-=12;
  p.supportIntent=target;
  p.reorientUntil=clock(s)+20;p.commitUntil=p.reorientUntil;p.activity='rest';d.job=null;
  p.reason='为更符合志向的传承重新调息，暂缓工作与学习。';
  if(!hiddenBook(s,d,old)){remember(s,d,`我自行暂停《${TECHNIQUES[old].name}》辅修，为所选方向腾出精力；已理解的知识仍保留。`,{important:true,key:`supportChange:${old}:${target}`});log(s,`${d.name}自主调整辅修，花费时间调息，保留已有知识。`);}
  return true;
}
function decide(s,d,hooks) {
  const p=d.mind;if(p.away)return;
  considerPill(s,d,hooks);
  if(d.breakthroughCooldown>s.time){p.activity='rest';d.job=null;p.path=[];p.scenic.path=[];p.reason='突破后守住心神，先在原地调息，暂缓差事与授业。';p.commitUntil=d.breakthroughCooldown;return;}
  if(!s.srCultivation&&d.xp>=xpNeed(d.realm)&&d.realm<12&&d.energy>=45&&d.wound<=5&&clock(s)-p.lastBreakthrough>=120&&hooks.breakthroughLock&&!hooks.breakthroughLock(s,d,false)) {
    const quiet=lifeFacility(s,d,'cultivate');
    if(quiet&&scenicDistance(p.scenic,buildingAccess(s,quiet))<=sceneUnits(s,28)&&!p.scenic.path.length&&(s.schemaVersion!==6||s.activitiesById[d.activityId]?.action==='cultivate'&&s.activitiesById[d.activityId]?.phase==='executing'&&s.activitiesById[d.activityId]?.targetId===quiet.instanceId)){
      p.lastBreakthrough=clock(s);hooks.breakthroughPerson(s,d,false,{autonomous:true});p.activity='rest';d.job=null;p.path=[];p.scenic.path=[];p.reason='自己衡量准备后完成突破，先在安静处调息。';p.commitUntil=d.breakthroughCooldown;
      remember(s,d,'自己衡量准备后尝试突破。境界高低不会代替对同门的判断。',{important:true,key:`breakthrough:${d.realm}:${p.lastBreakthrough}`});return;
    }
    if(quiet){p.activity='cultivate';d.job=quiet.id;p.reason='修为与材料已备妥，先自行前往安静处，准备突破。';p.path=[];p.scenic.path=lifeScenePath(s,d,quiet)||[];p.scenic.goal=buildingAccess(s,quiet);p.scenic.revision=geometryRevision(s);p.commitUntil=clock(s)+6;p.lastDecision=clock(s);return;}
  }
  const urgent=d.energy<22||d.wound>45||p.satiety<22;
  if(!urgent&&p.reorientUntil>clock(s))return;
  if(!urgent&&clock(s)>=p.commitUntil&&considerSupportChange(s,d,hooks))return;
  if(!urgent&&clock(s)<p.commitUntil&&p.activity!=='rest'&&p.activity!=='social') {
    const b=s.buildings.find(b=>b.id===d.job);
    if(!lifeActivityLock(s,d)&&(d.job===null||b))return;
  }
  let chosen;
  if(p.satiety<22)chosen={activity:'forage',job:null,score:200,reason:'口粮紧缺，先到院旁采寻野食，保障自己和同伴的生活。'};
  else if(d.wound>20)chosen={activity:s.resources.herb>0?'heal':'rest',job:null,score:200,reason:s.resources.herb>0?'伤势需要照料，自行取用草药调养。':'伤势未愈且缺少草药，先静养等待恢复。'};
  else if(d.energy<22)chosen={activity:'rest',job:null,score:200,reason:'精力不足，先休息恢复，暂不接差事。'};
  if(!chosen) {
    const [kindness,ambition,,discipline,curiosity]=p.traits;
    const trust=relation(d).trust;
    const choices=[{activity:'rest',job:null,score:Math.max(0,78-d.energy)+(p.mood<30?12:0),reason:'留出休憩时间，恢复身心。'},...candidateStudy(s,d,hooks)];
    let unreachable=0;
    for(const b of s.buildings) {
      const t=BUILDINGS[b.type];if(!t||occupied(s,d,b)||!buildingActive(b))continue;
      const cultivation=['hall','meditation'].includes(b.type);
      if(!t.work&&!cultivation)continue;
      if(cultivation) {
        if(!p.main||d.xp>=xpNeed(d.realm))continue;
        choices.push({activity:'cultivate',job:b.id,score:22+ambition*.45+(d.job===b.id?9:0),reason:'希望精进境界，选择静心修炼。'});
      } else {
        if(!workOpportunity(s,d,b,{checkPath:false}).available)continue;
        const output=Object.keys(t.out)[0];if(!output)continue;
        const target={food:Math.max(35,s.disciples.length*7),jade:100,wood:90,stone:75,herb:Math.max(45,s.disciples.length*8),crystal:15,insight:30}[output]||50;
        const scarcity=clamp((target-(s.resources[output]||0))/target,0,1)*40;
        const focus=output===s.doctrine.workFocus?20:0;
        const steward=living(s,s.society.officers.steward)?5:0;
        choices.push({activity:'work',job:b.id,score:11+discipline*.3+kindness*.1+scarcity+focus+steward+(d.job===b.id?10:0)+(p.restitutionBalance>0&&trust>25?12:0)+(p.goal.includes('草木')&&(t.tags||[]).includes('plant')?10:0),reason:`${focus?'响应公开差事，':scarcity>20?'看到供给紧缺，':'权衡生活与修行后，'}愿意到${t.name}做事。`});
      }
    }
    const pupils=s.disciples.filter(x=>x.id!==d.id&&x.mind.mentorId===d.id&&x.mind.activity==='study');
    const publicClass=p.office==='teacher'&&s.disciples.some(x=>x.mind.activity==='study'&&known(d,x.mind.learning?.id)>=45);
    if((pupils.length||publicClass)&&lifeFacility(s,d,'teach'))choices.push({activity:'teach',job:null,score:36+kindness*.3+discipline*.2,reason:'愿意分出修行时间，为同门讲解自己熟悉的传承。'});
    if(clock(s)-p.lastSocial>=120&&p.mood<55&&s.disciples.length>1)choices.push({activity:'social',job:null,score:58,reason:'想与熟悉的同门谈谈近况，缓解心事。'});
    if(p.main&&d.energy>=75&&clock(s)>p.commitUntil&&clock(s)-p.lastSocial>40)for(const id of s.doctrine.routes||[]) {
      const r=ROUTES[id];if(!r||!routeDiscovered(s,id)||d.realm<r.minRealm||!canPay(s,r.cost))continue;
      const defiant=ambition+curiosity-p.traits[2]-p.caution*12>105;
      if(s.doctrine.outingRule==='restricted'&&!defiant)continue;
      choices.push({activity:'travel',job:null,route:id,score:13+ambition*.24+curiosity*.22,reason:'有意接下山外差事，拓宽见闻。'});
    }
    for(const c of choices)c.score+=(p.activity===c.activity?5:0)+rng(s)*5;
    choices.sort((a,b)=>b.score-a.score);chosen=choices.find(c=>{if(c.job===null)return true;const b=s.buildings.find(b=>b.id===c.job);c.path=lifeScenePath(s,d,b);if(c.path===null){unreachable++;return false;}return true;})||choices.find(c=>c.activity==='rest');
    if(chosen.activity==='rest'&&unreachable&&!choices.some(c=>c.activity==='work'))chosen.reason='现有差事的道路或条件不合适，暂歇并等待改善。';
  }
  const changed=p.activity!==chosen.activity||d.job!==chosen.job||p.learning?.id!==chosen.learning?.id;
  d.job=chosen.job??null;p.activity=chosen.activity;p.reason=chosen.reason;p.lastDecision=clock(s);
  p.commitUntil=clock(s)+(chosen.activity==='rest'?8:18+Math.floor(p.traits[3]/10));
  if(chosen.learning)p.learning=chosen.learning;
  const destination=lifeFacility(s,d,chosen.activity,chosen.learning?.id);
  p.path=[];p.scenic.path=chosen.path||(destination?lifeScenePath(s,d,destination)||[]:[]);p.scenic.goal=destination?buildingAccess(s,destination):null;p.scenic.revision=geometryRevision(s);
  if(chosen.activity==='travel')startNpcJourney(s,d,chosen.route);
  if(changed)remember(s,d,p.reason);
}
function startNpcJourney(s,d,id) {
  const r=ROUTES[id],p=d.mind;pay(s,r.cost);d.energy-=r.energy;
  p.journey={routeId:id,total:r.duration,remaining:r.duration,encounterResolved:false,risk:0};p.away={kind:'errand',id};
  if(s.doctrine.outingRule==='restricted') {
    addSecret(s,d,'outing',id,'渴望山外机缘，不赞同临时禁足，趁山路开放外出。');
    p.reason='暂不在院中，同门尚不清楚去向。';
  } else {p.reason=`自行接下「${r.name}」差事，已留下归期。`;log(s,`${d.name}自愿接下「${r.name}」，自行准备并出行。`);}
}
function tickJourney(s,d) {
  const p=d.mind,j=p.journey;if(!j)return;
  j.remaining=Math.max(0,j.remaining-1);
  if(!j.encounterResolved&&j.remaining<=j.total/2) {
    j.encounterResolved=true;
    const bold=p.traits[1]+p.traits[4]-p.traits[2]>110;
    if(j.legacy) {if(bold&&d.energy>=10){d.energy-=10;j.multiplier=1.5;}else j.multiplier=1;}
    else {j.risk=bold?.25:.04;if(rng(s)<j.risk)d.wound=clamp(d.wound+(bold?12:4),0,100);}
  }
  if(j.remaining)return;
  const r=ROUTES[j.routeId];grant(s,j.legacy?Object.fromEntries(Object.entries(j.snapshotReward).map(([k,v])=>[k,Math.floor(v*j.multiplier)])):r.reward);s.sect.reputation=(s.sect.reputation||0)+(j.legacy?j.snapshotReputation:r.reputation);
  if(j.legacy)d.xp=Math.min(xpNeed(d.realm),d.xp+j.snapshotXp);
  s.stats.expeditions=(s.stats.expeditions||0)+1;
  const secret=s.society.secrets.find(e=>e.discipleId===d.id&&e.kind==='outing'&&!e.discovered&&!e.handled);
  p.away=null;p.journey=null;p.activity='rest';p.commitUntil=0;p.lastSocial=clock(s);
  p.reason='刚从山外归来，正在休整。';
  if(!secret){remember(s,d,`自己完成「${r.name}」，见闻与伤势成为日后的判断依据。`,{important:true,key:`journey:${j.routeId}`});log(s,`${d.name}自山外归来，交回差事所得。`);}
}
function finishLearning(s,d,id,hooks) {
  const p=d.mind,t=TECHNIQUES[id],secret=hiddenBook(s,d,id),previousMain=p.main;
  if(hooks.learnTechnique)hooks.learnTechnique(s,d,id,false,{silent:true});
  else {if(t.kind==='main')p.main=id;else if(!p.support.includes(id))p.support.push(id);p.knowledge[id]=Math.max(20,p.knowledge[id]||0);p.learning=null;}
  if(t.kind==='main'&&previousMain&&previousMain!==id)p.lastConversion=clock(s);
  if(p.supportIntent===id)p.supportIntent=null;
  if(!secret) {
    if(t.kind==='main')p.publicMain=id;
    remember(s,d,`经过持续研习，初步掌握《${t.name}》。`,{important:true,key:`learn:${id}`});
    log(s,`${d.name}初步掌握《${t.name}》，还需继续熟悉才能授业。`);
  }
  p.activity='rest';d.job=null;p.commitUntil=0;
}
function execute(s,d,hooks) {
  const p=d.mind;
  if(p.away){if(p.away.kind==='errand')tickJourney(s,d);return;}
  const lock=lifeActivityLock(s,d);
  if(lock){p.commitUntil=0;p.activity='rest';d.job=null;p.path=[];p.reason=lock;return;}
  if(p.scenic.revision!==geometryRevision(s))repairScenicActor(p.scenic,s);
  if(d.breakthroughCooldown>s.time&&!hallInteriorEnabled(s)){d.energy=clamp(d.energy+(hooks.restRecovery?hooks.restRecovery(s,d):1.05),0,100);return;}
  const destination=lifeFacility(s,d);
  if(s.schemaVersion===6&&(['work','study','teach','cultivate'].includes(p.activity)||hallInteriorEnabled(s)&&['rest','heal'].includes(p.activity))) {
    if(!prepareFacilityActivity(s,d,destination,p.activity)){if(hallInteriorEnabled(s)&&p.activity==='rest'&&(!destination||s.activitiesById[d.activityId]?.phase==='waiting')){d.energy=clamp(d.energy+.3,0,100);p.reason='床位暂满，在原处暂歇，恢复较慢。';}return;}
  }else if(s.schemaVersion===6)releaseBodyActivity(s,d);
  if(s.schemaVersion!==6&&destination){const goal=buildingAccess(s,destination);if(!p.scenic.goal||scenicDistance(goal,p.scenic.goal)>.01){p.scenic.path=lifeScenePath(s,d,destination)||[];p.scenic.goal=goal;}}
  if(p.scenic.path.length) {
    advanceScenic(p.scenic,46,s);syncScenicPosition(s,d);d.energy=clamp(d.energy-.04,0,100);return;
  }
  if(p.activity==='rest') {
    const recovery=hooks.restRecovery?hooks.restRecovery(s,d):1.05+(hasBuilding(s,'kitchen')?.2:0)+(p.support.includes('spring')?.4:0);
    d.energy=clamp(d.energy+recovery,0,100);
    d.wound=Math.max(0,d.wound-.075);p.mood=clamp(p.mood+.04,0,100);
  } else if(p.activity==='heal') {
    p.workProgress++;
    d.energy=clamp(d.energy+.55,0,100);d.wound=Math.max(0,d.wound-.1);
    if(p.workProgress>=8){p.workProgress=0;if(s.resources.herb>=1){pay(s,{herb:1});d.wound=Math.max(0,d.wound-(hasBuilding(s,'clinic')?7:4));}else p.commitUntil=0;}
    if(d.wound<=5){p.activity='rest';p.commitUntil=0;}
  } else if(p.activity==='forage') {
    p.workProgress++;d.energy=clamp(d.energy-.12,0,100);
    if(p.workProgress>=12){p.workProgress=0;if(consumeHarvest(s,'food',3)){grant(s,{food:3});p.satiety=clamp(p.satiety+24,0,100);}else p.reason='附近采食来源不足，等待种植或商队供给。';p.commitUntil=0;}
  } else if(p.activity==='work') {
    const b=s.buildings.find(b=>b.id===d.job),t=BUILDINGS[b?.type];
    if(!b||!t?.work||!buildingActive(b)){p.commitUntil=0;p.activity='rest';d.job=null;return;}
    if(s.schemaVersion===6){
      if(contributeProduction(s,d,b,(participants,target=s)=>production(target,participants[0].person,target.buildingsById?.[b.instanceId]||b,hooks,participants)))d.energy=clamp(d.energy-.32,0,100);
      else {p.reason='原料不足，已保留共同批次进度。';p.commitUntil=0;}
    }else {
      d.energy=clamp(d.energy-.32,0,100);b.progress=(b.progress||0)+1;
      if(b.progress>=t.duration){b.progress-=t.duration;if(!production(s,d,b,hooks)){p.reason='原料、维护或运输条件不足，暂缓生产。';p.commitUntil=0;}}
    }
  } else if(p.activity==='cultivate') {
    const b=s.buildings.find(b=>b.id===d.job);
    const rate=hooks.cultivationRate?hooks.cultivationRate(s,d,b):(.8+(b?.type==='meditation'?1:0))*d.talent*(TECHNIQUES[p.main]?.cultivation||1);
    d.xp=Math.min(xpNeed(d.realm),d.xp+rate);d.energy=clamp(d.energy-fatigue(d),0,100);
    if(p.main)p.knowledge[p.main]=clamp(known(d,p.main)+.11,0,100);
    if(d.xp>=xpNeed(d.realm))p.commitUntil=0;
  } else if(p.activity==='study'&&p.learning) {
    const l=p.learning,t=TECHNIQUES[l.id];if(!t){p.learning=null;p.commitUntil=0;return;}
    const sealed=s.doctrine.sealed.includes(l.id)||p.restrictedUntil>clock(s);
    if(sealed&&!hiddenBook(s,d,l.id))addSecret(s,d,'book',l.id,'对封存法门有强烈求知欲，借独处机会私下研读。');
    const gain=d.talent*lessonBonus(s,d,l.id)*(1+p.skills.learning/300);
    d.energy=clamp(d.energy-.29,0,100);
    if(l.practice) {
      p.knowledge[l.id]=clamp(known(d,l.id)+gain*.32,0,100);l.progress+=gain;
      if(l.progress>=40||known(d,l.id)>=100&&!l.research){p.learning=null;p.commitUntil=0;}
    } else {l.progress+=gain;if(l.progress>=(l.total||t.duration))finishLearning(s,d,l.id,hooks);}
  } else if(p.activity==='teach') {
    d.energy=clamp(d.energy-.32,0,100);
    const students=s.disciples.filter(x=>x.id!==d.id&&x.mind.learning&&known(d,x.mind.learning.id)>=45&&teachingPresent(s,d,x,x.mind.learning.id));
    s.society.stats.lessons+=students.length;
    for(const student of students)if(clock(s)-relation(student,`d:${d.id}`).lastEvent>=120) {
      changeRelation(s,student,`d:${d.id}`,{respect:3,trust:2},null);
      changeRelation(s,d,`d:${student.id}`,{affection:2},null);
    }
  } else if(p.activity==='social') {
    const other=s.disciples.filter(x=>x.id!==d.id&&!x.mind.away).sort((a,b)=>relation(d,`d:${b.id}`).trust-relation(d,`d:${a.id}`).trust||a.id-b.id)[0];
    if(other&&clock(s)-p.lastSocial>=120) {
      const shared=Math.abs(p.traits[2]-other.mind.traits[2])<45;
      changeRelation(s,d,`d:${other.id}`,shared?{affection:4,trust:2}:{conflict:3},null);
      changeRelation(s,other,`d:${d.id}`,shared?{affection:3}:{conflict:2},null);
      remember(s,d,shared?`与${other.name}谈及近况，感到有人理解。`:`与${other.name}对求道方式看法不同，暂时各自冷静。`);
      p.mood=clamp(p.mood+(shared?12:-3),0,100);p.lastSocial=clock(s);s.society.stats.relationships++;
    }
  }
  if(d.energy<18||p.satiety<18||d.wound>35)p.commitUntil=0;
}

function expert(s,d) {return d.realm>=4&&bestMastery(s,d)>=60;}
export function foundingStatus(s) {
  const reasons=[];
  if(s.society.formal)reasons.push('已经正式立派');
  if(s.master.realm<10)reasons.push('掌门需完成筑基');
  if(known(s.master,s.master.main)<60)reasons.push('掌门需将主修理解至60');
  if(!hasBuilding(s,'library'))reasons.push('需建成藏经阁');
  const count=s.disciples.length, experts=s.disciples.filter(d=>expert(s,d)).length;
  if(count<12&&!(count>=6&&experts>=2))reasons.push('需12位门人，或6位门人且其中2位炼气四层、传承理解60');
  if(s.resources.food<count*2)reasons.push('至少备足门人一日口粮');
  if(!canPay(s,FOUNDING_COST))reasons.push('立派物资尚未备齐');
  return {ready:!reasons.length,reasons,cost:{...FOUNDING_COST}};
}
export function foundSect(s,name='云岫仙府') {
  const status=foundingStatus(s);if(!status.ready)throw Error(status.reasons.join('；'));
  name=String(name).trim();if(!name||name.length>20)throw Error('门派名需为1至20字。');
  pay(s,FOUNDING_COST);s.society.formal=true;s.society.foundedAt=clock(s);s.society.name=name;
  s.sect.name=name;s.sect.founded=true;s.sect.level=Math.max(2,s.sect.level);
  for(const d of s.disciples){changeRelation(s,d,'master',{respect:5,trust:2},null);remember(s,d,`我见证了「${name}」正式立派，愿意继续观察共同的道路。`,{important:true,key:'founding'});}
  log(s,`${name}正式立派。职位、门规与传承承诺开始接受所有门人的检验。`);return {accepted:true};
}
export function officeWillingness(s,dOrId,role) {
  const d=npc(s,dOrId),r=SOCIETY_ROLES[role];if(!d||!r)return {willing:false,capable:false,reason:'人选或职位不存在'};
  if(!s.society.formal)return {willing:false,capable:false,reason:'正式立派后方可邀请执事'};
  const p=d.mind;
  const capable=role==='steward'?(p.traits[3]>=60||Math.max(...Object.values(p.skills))>=20)&&d.realm>=2:role==='teacher'?bestMastery(s,d)>=50:d.realm>=4&&p.traits[2]>=40;
  if(!capable)return {willing:false,capable:false,reason:role==='steward'?'需炼气二层且自律60或生产技艺20':role==='teacher'?'需至少一部功法理解50':'需炼气四层且守信40'};
  if(p.away||d.wound>20)return {willing:false,capable:true,reason:'正在外出或养伤，暂不考虑任职'};
  if(p.office&&p.office!==role)return {willing:false,capable:true,reason:'已有职责，不愿同时承担另一职位'};
  const score=relation(d).trust*.42+relation(d).respect*.22+p.traits[3]*.24+(role==='teacher'?p.traits[0]*.12:p.traits[0]*.06)-(p.mood<30?15:0);
  return {willing:score>=48,capable:true,reason:score>=48?'认同目前的相处方式，愿意承担职责':'对当前制度或相处方式仍有顾虑，暂不愿任职'};
}
export function inviteOffice(s,discipleId,role) {
  const d=npc(s,discipleId),decision=officeWillingness(s,d,role);if(!d||!SOCIETY_ROLES[role])throw Error(decision.reason);
  if(s.society.officers[role]===d.id)return {accepted:true,reason:'已担任该职'};
  s.society.invitations.unshift({time:clock(s),discipleId,role,accepted:decision.willing,reason:decision.reason});s.society.invitations=s.society.invitations.slice(0,30);
  if(!decision.willing){log(s,`${d.name}婉拒${SOCIETY_ROLES[role].name}邀请：${decision.reason}。`);return {accepted:false,...decision};}
  const old=npc(s,s.society.officers[role]);if(old)old.mind.office=null;
  s.society.officers[role]=d.id;d.mind.office=role;
  remember(s,d,`我接受了${SOCIETY_ROLES[role].name}邀请，愿凭自身所长照看同门。`,{important:true,key:`office:${role}`});
  log(s,`${d.name}自愿接受${SOCIETY_ROLES[role].name}一职。`);return {accepted:true};
}
function dismissOffice(s,role) {
  if(!SOCIETY_ROLES[role])throw Error('职位不存在。');const d=npc(s,s.society.officers[role]);
  if(!d)throw Error('此职位尚无执事。');s.society.officers[role]=null;d.mind.office=null;
  remember(s,d,'掌门撤下我的执事职责，我将按自己的打算继续修行。',{important:true,key:`dismiss:${clock(s)}`});log(s,`${d.name}卸任${SOCIETY_ROLES[role].name}。`);
}
export function peakHostWillingness(s,dOrId,direction) {
  const d=npc(s,dOrId),spec=PEAK_DIRECTIONS[direction];if(!d||!spec)return {willing:false,capable:false,reason:'人选或峰传承不存在'};
  const mastery=Math.max(0,...spec.techniques.map(id=>publicKnowledge(s,d,id)));
  if(mastery<60||d.realm<4)return {willing:false,capable:false,reason:'需炼气四层、该方向传承理解60'};
  if(s.society.peaks.some(p=>p.hostId===d.id))return {willing:false,capable:true,reason:'已有一峰需要主持，不愿兼任'};
  if(d.mind.away||d.wound>20)return {willing:false,capable:true,reason:'正在山外或养伤'};
  const willing=relation(d).trust+relation(d).respect+d.mind.traits[3]>=150;
  return {willing,capable:true,reason:willing?'愿意以所学主持传承，门人可自主选择跟随':'仍需建立共同传承的信任，暂不愿主持'};
}
export function peakStatus(s,direction) {
  const spec=PEAK_DIRECTIONS[direction],reasons=[];
  if(!spec)return {ready:false,reasons:['传承方向不存在'],cost:{},hosts:[]};
  if(!s.society.formal)reasons.push('先正式立派');
  if(s.society.peaks.some(p=>p.direction===direction))reasons.push('此方向已经设峰');
  const experts=s.disciples.filter(d=>expert(s,d));
  if(s.disciples.length<24&&!(s.disciples.length>=10&&experts.length>=2))reasons.push('需24位门人，或10位门人且其中2位传承成熟');
  const traditions=new Set();for(const d of [s.master,...s.disciples])for(const id of Object.keys(mindOf(d).knowledge||{}))if(publicKnowledge(s,d,id)>=60)traditions.add(id);
  if(traditions.size<2)reasons.push('至少两部传承理解达到60');
  if(!hasBuilding(s,spec.building))reasons.push(`需可运行的${BUILDINGS[spec.building].name}`);
  if(!canPay(s,spec.cost))reasons.push('设峰物资尚未备齐');
  const hosts=s.disciples.map(d=>({id:d.id,name:d.name,...peakHostWillingness(s,d,direction)}));
  if(!hosts.some(h=>h.willing))reasons.push('暂无有能力且愿意主持的人选');
  return {ready:!reasons.length,reasons,cost:{...spec.cost},hosts};
}
export function foundPeak(s,direction,hostId,name) {
  const status=peakStatus(s,direction);if(!status.ready)throw Error(status.reasons.join('；'));
  const host=npc(s,hostId),will=peakHostWillingness(s,host,direction);if(!will.willing)throw Error(will.reason);
  const spec=PEAK_DIRECTIONS[direction];name=String(name||spec.name).trim();if(!name||name.length>20)throw Error('峰名需为1至20字。');
  pay(s,spec.cost);const peak={id:s.society.nextPeakId++,name,direction,hostId,budget:1,active:false,reason:'等待供给',members:[],foundedAt:clock(s),fundedDay:-1,fundedBudget:0};
  s.society.peaks.push(peak);host.mind.peakId=peak.id;refreshPeak(s,peak);choosePeaks(s);
  if(s.society.peaks.length>=2)s.sect.level=Math.max(3,s.sect.level);
  remember(s,host,`我自愿主持「${name}」，以自己的理解传授后学。`,{important:true,key:`peak:${peak.id}`});
  log(s,`${name}设立。门人依据志向、适性与关系自主决定归属。`);return peak;
}
function peakDailyCost(p) {return p.direction==='herb'?{jade:p.budget*3,herb:p.budget}:{jade:p.budget*3,stone:p.budget*2};}
function refreshPeak(s,p) {
  const host=npc(s,p.hostId),spec=PEAK_DIRECTIONS[p.direction];
  if(!host){p.active=false;p.reason='主持者已离院，可重新邀请继任者';return;}
  if(!p.budget){p.active=false;p.reason='预算暂停，能力与归属仍保留';return;}
  if(!hasBuilding(s,spec.building)){p.active=false;p.reason=`缺少可运行的${BUILDINGS[spec.building].name}`;return;}
  if(host.mind.away||host.wound>40){p.active=false;p.reason='主持者暂时无法照看传承';return;}
  if(p.fundedDay!==day(s)||p.budget>(p.fundedBudget||0)) {
    const paid=p.fundedDay===day(s)?(p.fundedBudget||0):0;
    const cost=peakDailyCost({...p,budget:Math.max(0,p.budget-paid)});if(!canPay(s,cost)){p.active=false;p.reason='本日预算不足，补足后可恢复';return;}
    pay(s,cost);p.fundedDay=day(s);p.fundedBudget=p.budget;
  }
  p.active=true;p.reason='预算、主持与设施齐备，正在授业并协助生产';
}
function choosePeaks(s) {
  for(const d of s.disciples) {
    if(clock(s)-d.mind.lastPeakChange<120)continue;
    const own=s.society.peaks.find(p=>p.hostId===d.id);if(own){d.mind.peakId=own.id;continue;}
    let best=null,score=40;
    for(const p of s.society.peaks) {
      if(!living(s,p.hostId))continue;
      const spec=PEAK_DIRECTIONS[p.direction];
      const n=Math.max(0,...spec.techniques.map(id=>known(d,id)))*.6+relation(d,`d:${p.hostId}`).trust*.3+(p.direction==='herb'&&(d.root.startsWith('木')||d.mind.goal.includes('草木'))?30:p.direction==='array'&&(d.root.startsWith('土')||d.mind.goal.includes('护道'))?30:0)+(d.mind.peakId===p.id?12:0);
      if(n>score){best=p;score=n;}
    }
    if(best&&d.mind.peakId!==best.id){d.mind.peakId=best.id;d.mind.lastPeakChange=clock(s);remember(s,d,`看过传承与主持者的相处方式后，我选择加入${best.name}。`,{important:true,key:`joinPeak:${best.id}`});}
  }
  for(const p of s.society.peaks)p.members=s.disciples.filter(d=>d.mind.peakId===p.id).map(d=>d.id);
}

export function mentorWillingness(s,discipleId,mentorId) {
  const d=npc(s,discipleId),mentor=mentorId==='master'?s.master:npc(s,mentorId);
  if(!d||!mentor||d===mentor)return {willing:false,reason:'需选择另一位能够授业的人'};
  const available=Object.keys(mindOf(mentor).knowledge||{}).some(id=>publicKnowledge(s,mentor,id)>=45&&publicKnowledge(s,d,id)<publicKnowledge(s,mentor,id)-10&&!s.doctrine.sealed.includes(id));
  if(!available)return {willing:false,reason:'双方暂时没有适合授受的传承差距'};
  if(mentor.mind?.away||d.mind.away)return {willing:false,reason:'有人尚在山外，待归院再议'};
  const r=readRelation(d,mentorId==='master'?'master':`d:${mentorId}`);
  const willing=r.trust>=30&&r.respect>=35&&(!mentor.mind||readRelation(mentor,`d:${d.id}`).trust>=25);
  return {willing,reason:willing?'双方愿意以现有传承结为师徒':'双方仍有隔阂，暂不愿建立师徒关系'};
}
export function inviteMentor(s,discipleId,mentorId) {
  const d=npc(s,discipleId),decision=mentorWillingness(s,discipleId,mentorId);if(!d)throw Error('未找到门人。');
  if(d.mind.mentorId===mentorId)return {accepted:true,reason:'双方已有师徒之谊，接下来需要实际授业'};
  if(!decision.willing){log(s,`${d.name}暂未接受拜师提议：${decision.reason}。`);return {accepted:false,...decision};}
  const mentor=mentorId==='master'?s.master:npc(s,mentorId);d.mind.mentorId=mentorId;
  const first=!d.mind.memories.some(m=>m.key===`mentor:${mentorId}`);
  remember(s,d,`我愿以${mentor.name}为师。天赋与境界可以超越，授业恩义仍值得珍惜。`,{important:true,key:`mentor:${mentorId}`});
  if(first)changeRelation(s,d,mentorId==='master'?'master':`d:${mentorId}`,{trust:5,respect:5},null);
  log(s,`${d.name}与${mentor.name}自愿确立师徒之谊。`);return {accepted:true};
}
export function canAccompany(s,dOrId,mission={}) {
  const d=npc(s,dOrId);if(!d)return {willing:false,reason:'此人不在山院'};
  initDisciple(s,d);
  if(d.mind.away)return {willing:false,reason:'已有自己的行程'};
  if(d.energy<45||d.wound>15||d.mind.satiety<30)return {willing:false,reason:'精力、伤势或生活供给不足'};
  if(mission.revenge&&d.mind.revengeAttitude==='oppose')return {willing:false,reason:'不赞同以自己的性命参与复仇，愿留山照料同门'};
  const risk=clamp(Number(mission.risk)||0,0,1);
  const willing=relation(d).trust*.4+relation(d).respect*.2+d.mind.traits[1]*.2+d.mind.traits[0]*.2-risk*35>=36;
  return {willing,reason:willing?'认可此行目的与准备，愿意同行':'认为此行风险超过准备，暂不愿同行'};
}
export function campaignOutcome(s,dOrId,{kind='游历',success=true,injury=0,revenge=false}={}) {
  const d=npc(s,dOrId);if(!d)return;initDisciple(s,d);
  d.wound=clamp(d.wound+Math.max(0,injury),0,100);d.mind.away=null;
  changeRelation(s,d,'master',success?{trust:4,respect:4}:{trust:-5,conflict:3},null);
  if(injury>20){changeRelation(s,d,'master',{trust:-4},null);d.mind.mood=clamp(d.mind.mood-8,0,100);}
  remember(s,d,`${kind}${success?'有了结果':'未能如愿'}${injury>0?'，我也带伤归来':''}；这段共同经历改变了我对掌门的判断。`,{important:true,key:`campaign:${kind}:${clock(s)}`});
  if(revenge&&success&&relation(d).trust>=65&&d.mind.revengeAttitude==='cautious')d.mind.revengeAttitude='support';
}

const QUESTS = {
  family:{title:'山下家书',text:'家人病后仍需调养，希望山院提供草药和几日口粮。',cost:{herb:12,food:8},choices:[{id:'aid',label:'提供物资',description:'支付草药12、口粮8；来回照料后带回药圃经验。'},{id:'decline',label:'说明难处',description:'暂不支援，对方会自行设法，信任可能下降。'}]},
  mastery:{title:'一卷心愿',text:'想把已经修习的传承弄明白，希望有一段获准研究的时间与资料。',cost:{jade:30,insight:12},choices:[{id:'support',label:'支持研考',description:'支付灵石30、道韵12；仍须本人真正研习并提高理解。'},{id:'decline',label:'暂不支持',description:'不会抹去其志向，对方继续依自己意愿求道。'}]},
  belonging:{title:'去留之间',text:'同门相处留下隔阂，希望掌门主持一次公开沟通，再决定是否留下。',cost:{},choices:[{id:'mediate',label:'听取双方',description:'掌门花费10精力；结果取决于公平感和现有关系。'},{id:'decline',label:'让其自行决定',description:'对方将依据当前信任与生活情况考虑去留。'}]}
};
function createPersonalQuest(s,d) {
  const p=d.mind;if(day(s)<1||clock(s)-p.joinedAt<120)return;
  const grievance=Object.entries(p.relationships).filter(([id])=>id!=='master').sort((a,b)=>b[1].conflict-a[1].conflict)[0];
  const kind=relation(d).trust<38||(grievance?.[1].conflict||0)>=20?'belonging':p.traits[0]>=70?'family':'mastery';
  if(p.questKinds.includes(kind)||s.society.quests.some(q=>q.discipleId===d.id&&['offered','active'].includes(q.status)))return;
  p.questKinds.push(kind);
  const q={id:s.society.nextQuestId++,discipleId:d.id,kind,status:'offered',progress:0,createdAt:clock(s),deadline:clock(s)+600,outcome:null,target:null,startedAt:null,otherId:kind==='belonging'&&grievance?Number(grievance[0].slice(2)):null};
  s.society.quests.push(q);log(s,`${d.name}提出一桩心事：「${QUESTS[kind].title}」。可在门人事务中听取。`);
}
export function resolvePersonalQuest(s,questId,choice) {
  const q=s.society.quests.find(q=>q.id===questId),d=npc(s,q?.discipleId);if(!q||q.status!=='offered'||!d)throw Error('此心事当前不可回应。');
  const spec=QUESTS[q.kind];if(!spec.choices.some(c=>c.id===choice))throw Error('回应方式无效。');
  if(choice==='decline') {
    q.status='declined';q.outcome='山院未介入，门人依自己的处境继续生活';changeRelation(s,d,'master',{trust:-5},null);
    remember(s,d,`「${spec.title}」未获支持，我会自己寻找出路。`,{important:true,key:`quest:${q.id}`});
    return {accepted:true};
  }
  if(choice==='mediate') {if(s.master.energy<10)throw Error('掌门需10精力听取双方。');s.master.energy-=10;}
  pay(s,spec.cost);q.status='active';q.startedAt=clock(s);
  q.target=q.kind==='mastery'?(d.mind.main||'qingyuan'):null;
  if(q.kind==='mastery'){q.startMastery=known(d,q.target);q.targetMastery=Math.min(100,Math.max(45,q.startMastery+15));q.researchTicks=0;}
  changeRelation(s,d,'master',{trust:3},null);log(s,`掌门回应${d.name}的「${spec.title}」，后续仍由其实际行动推进。`);return {accepted:true};
}
function tickQuests(s) {
  for(const q of s.society.quests) {
    const d=npc(s,q.discipleId);if(!d||!['offered','active'].includes(q.status))continue;
    if(q.status==='offered'&&clock(s)>q.deadline){q.status='expired';q.outcome='未获回应，门人自行处理';changeRelation(s,d,'master',{trust:-4},null);continue;}
    if(q.status!=='active')continue;
    if(q.kind==='family')q.progress=clamp((clock(s)-q.startedAt)/60,0,1);
    if(q.kind==='belonging')q.progress=clamp((clock(s)-q.startedAt)/45,0,1);
    if(q.kind==='mastery') {
      if(d.mind.activity==='study'&&d.mind.learning?.id===q.target||d.mind.activity==='teach')q.researchTicks++;
      const understanding=q.targetMastery>q.startMastery?clamp((known(d,q.target)-q.startMastery)/(q.targetMastery-q.startMastery),0,1):1;
      q.progress=Math.min(understanding,clamp(q.researchTicks/45,0,1));
      // Opportunity motivates research, but never installs knowledge or overrides urgent needs.
      if(clock(s)-q.startedAt>900&&q.progress<1){q.status='failed';q.outcome='期限内未形成新的理解，资料仍可继续使用';remember(s,d,'研考未能如愿，我仍保留自己的问题与所学。',{important:true,key:`quest:${q.id}`});continue;}
    }
    if(q.progress<1)continue;
    q.status='completed';s.society.stats.questsCompleted++;
    if(q.kind==='family'){d.mind.skills.plant=clamp(d.mind.skills.plant+10,0,100);changeRelation(s,d,'master',{trust:12,respect:5},null);q.outcome='家人逐渐康复；照料经验使灵植技艺提高10';}
    if(q.kind==='mastery'){d.mind.skills.learning=clamp(d.mind.skills.learning+10,0,100);grant(s,{insight:8});changeRelation(s,d,'master',{trust:8,respect:4},null);q.outcome='凭实际研习形成札记，灵感回馈山院；研习技艺提高10';}
    if(q.kind==='belonging') {
      const reconciled=s.society.fairness>=45&&relation(d).trust>=25;
      changeRelation(s,d,'master',reconciled?{trust:10,conflict:-12}:{trust:-8,conflict:5},null);
      const other=npc(s,q.otherId);
      if(other){changeRelation(s,d,`d:${other.id}`,reconciled?{trust:5,conflict:-15}:{conflict:4},null);changeRelation(s,other,`d:${d.id}`,reconciled?{trust:5,conflict:-15}:{conflict:4},null);remember(s,other,`与${d.name}的分歧经过沟通，${reconciled?'愿意重新尝试相处':'仍有未能解开的心结'}。`,{important:true,key:`mediation:${q.id}`});}
      q.outcome=reconciled?'双方听取解释，隔阂有所缓解，愿意继续相处':'沟通未能弥合旧怨，仍需通过后续公平行动重建信任';
    }
    remember(s,d,`「${QUESTS[q.kind].title}」：${q.outcome}。`,{important:true,key:`quest:${q.id}`});log(s,`${d.name}的「${QUESTS[q.kind].title}」有了结果：${q.outcome}。`);
  }
}

const VISITOR_SPECS = {
  healer:{name:'行脚医师',title:'换药与问诊',text:'愿以草药换取路粮，或留下医理帮助伤者恢复。',choices:[{id:'trade',label:'粮换草药',description:'口粮12换灵草18。',cost:{food:12}},{id:'consult',label:'请其问诊',description:'灵石25；全院现有伤势降低12，记录医疗善缘。',cost:{jade:25}},{id:'decline',label:'送别',description:'不发生交换，留下来往记录。'}]},
  scholar:{name:'游方讲师',title:'一席论道',text:'听闻山院愿意交流，愿讲授已公开收藏的一部传承。',choices:[{id:'host',label:'备席交流',description:'口粮10、灵石20；愿意听课者须实际投入时间研习。',cost:{food:10,jade:20}},{id:'exchange',label:'交换手札',description:'灵石70、灵草15；取得青木调息法，已有时换得道韵12。',cost:{jade:70,herb:15}},{id:'decline',label:'婉谢',description:'来客离去，等待下次机缘。'}]},
  artisan:{name:'山中阵匠',title:'旧阵与新约',text:'愿帮助修复设施，并交流护脉经验；重视守约的门派。',choices:[{id:'repair',label:'请其修缮',description:'灵木18、青石15；恢复维护，生产技艺得到一次实务交流。',cost:{wood:18,stone:15}},{id:'teach',label:'换取护脉札记',description:'灵石90、道韵12；取得护脉阵诀或道韵15。',cost:{jade:90,insight:12}},{id:'decline',label:'留待以后',description:'不会产生额外后果。'}]}
};
function maybeVisitor(s) {
  if(clock(s)<s.society.nextVisitorAt||s.society.visitors.some(v=>v.status==='present')||!s.disciples.length)return;
  const kinds=['healer',...(hasBuilding(s,'library')?['scholar']:[]),...(s.sect.reputation>=15?['artisan']:[])];
  const recent=s.society.visitorHistory.slice(-2).map(v=>v.kind), available=kinds.filter(k=>!recent.includes(k));
  const pool=available.length?available:kinds,kind=pool[Math.floor(rng(s)*pool.length)];
  const v={id:s.society.nextVisitorId++,kind,status:'present',arrivedAt:clock(s),expiresAt:clock(s)+180,outcome:null};
  s.society.visitors.push(v);s.society.nextVisitorAt=clock(s)+240+Math.floor(rng(s)*100);
  log(s,`${VISITOR_SPECS[kind].name}来访：「${VISITOR_SPECS[kind].title}」。`);
}
export function resolveVisitor(s,visitorId,choice) {
  const v=s.society.visitors.find(v=>v.id===visitorId);if(!v||v.status!=='present'||clock(s)>v.expiresAt)throw Error('访客已离开，或此事已经处理。');
  const spec=VISITOR_SPECS[v.kind],option=spec.choices.find(c=>c.id===choice);if(!option)throw Error('接待方式无效。');
  pay(s,option.cost||{});v.status='resolved';v.outcome=choice;s.society.stats.visitorsResolved++;
  if(v.kind==='healer'&&choice==='trade')grant(s,{herb:18});
  if(v.kind==='healer'&&choice==='consult'){s.master.wound=Math.max(0,s.master.wound-12);for(const d of s.disciples){d.wound=Math.max(0,d.wound-12);remember(s,d,'山院请行脚医师问诊，伤后获得照看。',{important:true,key:`visitor:${v.id}`});}}
  if(v.kind==='scholar'&&choice==='host') {
    const topic=s.doctrine.books.find(id=>!s.doctrine.sealed.includes(id)&&id!=='foundation')||'qingyuan';
    s.society.guestLesson={topic,until:clock(s)+90};
  }
  if(v.kind==='scholar'&&choice==='exchange') {if(s.doctrine.books.includes('wood'))grant(s,{insight:12});else s.doctrine.books.push('wood');}
  if(v.kind==='artisan'&&choice==='teach') {if(s.doctrine.books.includes('array'))grant(s,{insight:15});else s.doctrine.books.push('array');}
  if(v.kind==='artisan'&&choice==='repair') {
    for(const b of s.buildings){b.disabled=false;b.condition=100;}
    for(const d of s.disciples)if(d.mind.activity==='work')d.mind.skills.industry=clamp(d.mind.skills.industry+4,0,100);
  }
  if(choice!=='decline')s.sect.reputation=(s.sect.reputation||0)+3;
  s.society.visitorHistory.push({id:v.id,kind:v.kind,time:clock(s),outcome:choice});
  s.society.visitorHistory=s.society.visitorHistory.slice(-24);
  log(s,`${spec.name}的来访已经处理：${option.label}。`);return {accepted:true};
}
function depart(s,d,reason) {
  remember(s,d,reason,{important:true,key:`departure:${clock(s)}`});
  for(const role of Object.keys(SOCIETY_ROLES))if(s.society.officers[role]===d.id)s.society.officers[role]=null;
  const hidden=Object.keys(d.mind.hiddenKnowledge).filter(id=>hiddenBook(s,d,id));
  s.society.departed.push({id:d.id,name:d.name,time:clock(s),reason,memories:structuredClone(d.mind.memories.filter(m=>m.public!==false&&!hidden.some(id=>m.text.includes(TECHNIQUES[id].name))))});
  for(const p of s.society.peaks)if(p.hostId===d.id){p.active=false;p.reason='主持者离院，可重新邀请继任者';}
  for(const x of s.disciples)if(x.mind.mentorId===d.id){x.mind.mentorId=null;remember(s,x,`${d.name}已经离院，已有授业与记忆仍保留。`,{important:true,key:`mentorLeft:${d.id}`});}
  s.disciples=s.disciples.filter(x=>x.id!==d.id);log(s,`${d.name}离开山院：${reason}`);
}
function daily(s) {
  for(const d of [...s.disciples]) {
    if(d.lifeStatus==='dead')continue;
    const p=d.mind,r=relation(d);
    const dayIndex=day(s),factId=s.schemaVersion===6&&s.contentVersion==='sr-content-v1.2'&&s.economy?.lastSupplyDay===dayIndex&&d.personId&&s.factsById?`fact:person-daily-supply:${d.personId}:${dayIndex}`:null;
    if(factId&&s.factsById[factId])continue;
    const supplied=s.economy?.lastSupplyDay===day(s)?s.economy.starvation===0:s.resources.food>=Math.max(1,s.disciples.length);
    const trustBefore=r.trust;
    p.satiety=clamp(p.satiety+(supplied?22:-32),0,100);
    if(!supplied){p.mood=clamp(p.mood-7,0,100);r.trust=clamp(r.trust-2,0,100);}
    else {p.mood=clamp(p.mood+3,0,100);if(r.trust<45)r.trust=clamp(r.trust+.8,0,100);}
    if(factId)s.factsById[factId]={id:factId,kind:'daily-supply-relation',personId:d.personId,dayIndex,atTick:s.worldTick,source:'economy.daily-supply',sourceDay:s.economy.lastSupplyDay,starvation:s.economy.starvation,supplied,trustBefore,trustAfter:r.trust,deltaTrust:r.trust-trustBefore};
    if(p.satiety<15&&r.trust<15)p.neglectDays++;else p.neglectDays=Math.max(0,p.neglectDays-1);
    if(p.neglectDays>=4&&s.disciples.length>1&&!p.away&&!s.activitiesById?.[d.activityId]?.kind?.startsWith('sr-')){depart(s,d,'长期缺乏供给且信任耗尽，决定另寻安身之地。');continue;}
    createPersonalQuest(s,d);
  }
  for(const p of s.society.peaks)refreshPeak(s,p);choosePeaks(s);
  if(s.disciples.length&&!s.disciples.some(d=>d.mind.activity==='work')&&clock(s)-s.society.lastShortageNotice>=240&&s.resources.food<s.disciples.length*2) {
    s.society.lastShortageNotice=clock(s);log(s,'门人暂时没有响应生产差事。掌门可亲自采集、采寻口粮或交易；改善供给、道路和关系后，门人会重新权衡。');
  }
}
export function tickSociety(s,dt=1,hooks={}) {
  if(!s.society)initSociety(s);
  if(!Number.isFinite(dt)||dt<=0)return;
  for(const d of s.disciples)if(!d.mind?.relationships)initDisciple(s,d);
  s.society.clock=Math.max(s.society.clock+dt,s.time);
  if(day(s)!==s.society.lastDay){s.society.lastDay=day(s);daily(s);}
  for(const d of [...s.disciples]) {
    if(d.lifeStatus==='dead'||s.activitiesById?.[d.activityId]?.kind?.startsWith('sr-'))continue;
    if(!d.mind.away&&(clock(s)-d.mind.lastDecision>=6||d.mind.commitUntil<=clock(s))&&!npcScheduleDecision(s,d))decide(s,d,hooks);
    execute(s,d,hooks);
  }
  if(s.society.guestLesson?.until<=clock(s))delete s.society.guestLesson;
  investigate(s);tickQuests(s);maybeVisitor(s);
  for(const v of s.society.visitors)if(v.status==='present'&&clock(s)>v.expiresAt){v.status='departed';v.outcome='未接待';s.society.visitorHistory.push({id:v.id,kind:v.kind,time:clock(s),outcome:'未接待'});log(s,`${VISITOR_SPECS[v.kind].name}辞别下山。`);}
  // Closed visitor entries are finite templates with distinct persisted outcomes, not fresh repeated rewards.
  s.society.visitors=s.society.visitors.filter(v=>v.status==='present'||clock(s)-v.arrivedAt<1200);
  s.society.visitorHistory=s.society.visitorHistory.slice(-24);
}

const INCIDENT_CHOICES=[{id:'warn',label:'劝诫',description:'记录边界，提高谨慎；少量影响信任。'},{id:'compensate',label:'要求补偿',description:'先从个人积蓄偿还，剩余记为可自愿履行的偿还义务。'},{id:'restrict',label:'暂限取用',description:'两日内限制取丹和新阅典籍；仍可能有人违背。'},{id:'dismiss',label:'撤下职责',description:'撤去当前执事职责，留下长期记忆。'},{id:'forgive',label:'听取解释后宽免',description:'缓和当事人情绪，重复偏袒会损害同门公平感。'},{id:'expel',label:'请其离院',description:'此人离开山院，既有授业和长期经历仍保留。'}];
export function settleIncident(s,incidentId,choice) {
  const e=s.society.secrets.find(e=>e.id===incidentId),d=npc(s,e?.discipleId);
  if(!e?.discovered||e.handled||!d)throw Error('只可处置已查实且尚未处理的事务。');
  if(!INCIDENT_CHOICES.some(c=>c.id===choice))throw Error('处置方式无效。');
  if(choice==='dismiss'&&!d.mind.office)throw Error('此人没有执事职责可撤。');
  const same=s.society.secrets.filter(x=>x.id!==e.id&&x.kind===e.kind&&x.handled);
  const biased=choice==='forgive'&&(same.some(x=>x.outcome!=='forgive')||same.some(x=>x.discipleId===d.id));
  e.handled=true;e.outcome=choice;e.handledAt=clock(s);
  if(choice==='warn'){d.mind.caution=clamp(d.mind.caution+1,0,5);changeRelation(s,d,'master',{trust:-2},null);}
  if(choice==='compensate'){const paid=Math.min(d.mind.purse,e.restitution);d.mind.purse-=paid;grant(s,{jade:paid});d.mind.restitutionBalance+=e.restitution-paid;d.mind.caution=clamp(d.mind.caution+1,0,5);}
  if(choice==='restrict'){d.mind.restrictedUntil=clock(s)+240;d.mind.caution=clamp(d.mind.caution+2,0,5);changeRelation(s,d,'master',{trust:-5},null);}
  if(choice==='dismiss')dismissOffice(s,d.mind.office);
  if(choice==='forgive'){changeRelation(s,d,'master',{trust:4},null);d.mind.caution=clamp(d.mind.caution+.25,0,5);}
  const fairness=biased?-8:choice==='expel'?-5:2;s.society.fairness=clamp(s.society.fairness+fairness,0,100);
  for(const other of s.disciples)if(other.id!==d.id)changeRelation(s,other,'master',{trust:biased?-4:choice==='expel'?-2:1},null);
  remember(s,d,`掌门对已查实的违规选择「${INCIDENT_CHOICES.find(c=>c.id===choice).label}」。我会记得此事与门规是否一致。`,{important:true,key:`judgment:${e.id}`});
  log(s,`对${d.name}已查实的${{pill:'未登记取丹',book:'私阅封卷',outing:'违约外出'}[e.kind]}，处置为「${INCIDENT_CHOICES.find(c=>c.id===choice).label}」。${biased?'同门认为此次处置有偏袒之嫌。':''}`);
  if(choice==='expel')depart(s,d,'因已查实的违约被请离山院。');
  syncPublicIncidents(s);return {accepted:true};
}
export function setSocietyPolicy(s,key,value) {
  if(!SOCIETY_RULE_OPTIONS[key]?.some(o=>o.id===value))throw Error('规则选项无效。');
  if(s.doctrine[key]===value)return;s.doctrine[key]=value;
  log(s,`掌门公布「${SOCIETY_RULE_OPTIONS[key].find(o=>o.id===value).label}」，门人会按人格、需要与经历重新权衡。`);
  for(const d of s.disciples)d.mind.commitUntil=Math.min(d.mind.commitUntil,clock(s)+6);
}
function talk(s,id,topic) {
  const d=npc(s,id);if(!d||!['needs','goal','reconcile'].includes(topic))throw Error('沟通对象或话题无效。');
  if(clock(s)-d.mind.lastTalk<120)throw Error('刚谈过近况，先以实际行动回应；一日后再谈。');
  if(d.mind.away)throw Error('此人还在山外。');d.mind.lastTalk=clock(s);
  const unresolved=relation(d).conflict;
  if(topic==='reconcile'&&s.society.fairness>=45&&unresolved>0){changeRelation(s,d,'master',{trust:Math.min(4,unresolved*.5),conflict:-5},null);d.mind.refusalUntil=0;}
  const text=topic==='needs'?(d.mind.satiety<35?'眼下先需口粮与安稳生活。':d.wound>10?'希望有时间养伤。':d.energy<35?'想休息一阵，再考虑差事。':'生活尚可，希望能保留修行与自己安排的时间。'):topic==='goal'?`我想${d.mind.goal}，愿意选择与这条路相合的机会。`:s.society.fairness<45?'目前的处置让我觉得不公，一次谈话不足以消除顾虑。':unresolved>0?'愿意把分歧说开，再看日后的行动。':'此前的分歧已谈过，信任还需要新的共同经历。';
  remember(s,d,`与掌门谈过：${text}`);log(s,`${d.name}说：「${text}」`);return {accepted:true,reason:text};
}
export function societyCommand(s,c,hooks={}) {
  if(!s.society)initSociety(s);if(!c||typeof c.type!=='string')throw Error('院务指令无效。');
  switch(c.type) {
    case 'foundSect':return foundSect(s,c.name);
    case 'inviteOffice':return inviteOffice(s,c.discipleId,c.role);
    case 'dismissOffice':return dismissOffice(s,c.role);
    case 'foundPeak':return foundPeak(s,c.direction,c.hostId,c.name);
    case 'setPeakBudget':{const p=s.society.peaks.find(p=>p.id===c.peakId);if(!p||!Number.isInteger(c.budget)||c.budget<0||c.budget>3)throw Error('峰预算需为0至3档。');p.budget=c.budget;refreshPeak(s,p);return {accepted:true};}
    case 'invitePeakHost':{const p=s.society.peaks.find(p=>p.id===c.peakId),d=npc(s,c.discipleId);if(!p||!d)throw Error('峰或人选不存在。');const w=peakHostWillingness(s,d,p.direction);if(!w.willing)return {accepted:false,reason:w.reason};p.hostId=d.id;d.mind.peakId=p.id;refreshPeak(s,p);return {accepted:true};}
    case 'policy':return setSocietyPolicy(s,c.key,c.value);
    case 'settleIncident':return settleIncident(s,c.incidentId,c.choice);
    case 'inviteMentor':return inviteMentor(s,c.discipleId,c.mentorId);
    case 'quest':return resolvePersonalQuest(s,c.questId,c.choice);
    case 'visitor':return resolveVisitor(s,c.visitorId,c.choice);
    case 'talk':return talk(s,c.discipleId,c.topic);
    case 'authorizePill':{const d=npc(s,c.discipleId);if(!d)throw Error('未找到门人。');d.mind.pillPermitDay=day(s);log(s,`允许${d.name}今日按需领取一份丹药，由其自行决定是否服用。`);return {accepted:true};}
    default:throw Error('只可提供机会、沟通或邀请，不能强制门人行动。');
  }
}
function optionState(s,c) {return {...c,cost:c.cost?{...c.cost}:undefined,disabledReason:c.cost&&!canPay(s,c.cost)?'物资不足':''};}
export function getSocietyView(s) {
  if(!s.society)initSociety(s);
  const sc=s.society;
  const disciples=s.disciples.map(d=>{
    const p=d.mind,hidden=Object.keys(p.hiddenKnowledge).filter(id=>hiddenBook(s,d,id));
    const learning=p.learning&&!hidden.includes(p.learning.id)&&!s.doctrine.sealed.includes(p.learning.id)?{...p.learning,name:TECHNIQUES[p.learning.id]?.name}:null;
    const privateStudy=p.activity==='study'&&p.learning&&!learning;
    const reason=privateStudy?'独处参悟，暂不愿详谈。':p.reason;
    return {id:d.id,name:d.name,root:d.root,talent:d.talent,portrait:d.portrait,realm:d.realm,xp:d.xp,energy:d.energy,wound:d.wound,job:d.job,position:{...d.position},
      satiety:p.satiety,mood:p.mood,activity:p.activity,reason,life:personLifeSummary(s,d),goal:p.goal,traits:[...p.traits],traitText:traitText(d),trust:relation(d).trust,revengeAttitude:p.revengeAttitude,
      main:hidden.includes(p.main)?p.publicMain:p.main,support:p.support.filter(id=>!hidden.includes(id)),knowledge:Object.fromEntries(Object.entries(p.knowledge).filter(([id])=>!hidden.includes(id))),learning,
      memories:p.memories.filter(m=>m.public!==false&&!hidden.some(id=>m.text.includes(TECHNIQUES[id].name))).map(m=>({...m})),
      relationships:Object.entries(p.relationships).map(([id,r])=>({id,name:id==='master'?s.master.name:npc(s,Number(id.slice(2)))?.name||'旧日同门',...r})),
      mentorId:p.mentorId,peakId:p.peakId,office:p.office,skills:{...p.skills},away:!!p.away,
      mentorOptions:[{id:'master',name:s.master.name,...mentorWillingness(s,d.id,'master')},...s.disciples.filter(x=>x.id!==d.id).map(x=>({id:x.id,name:x.name,...mentorWillingness(s,d.id,x.id)}))]};
  });
  return {formal:sc.formal,name:sc.name,fairness:sc.fairness,founding:foundingStatus(s),rules:Object.fromEntries(Object.keys(SOCIETY_RULE_OPTIONS).map(k=>[k,s.doctrine[k]])),
    ruleOptions:structuredClone(SOCIETY_RULE_OPTIONS),roleOptions:Object.entries(SOCIETY_ROLES).map(([id,r])=>({id,label:r.name,description:r.description})),
    officers:Object.entries(SOCIETY_ROLES).map(([role,r])=>({role,label:r.name,description:r.description,name:npc(s,sc.officers[role])?.name||'待邀',discipleId:sc.officers[role]})),
    candidates:s.disciples.map(d=>({id:d.id,name:d.name,roles:Object.keys(SOCIETY_ROLES).map(role=>({role,...officeWillingness(s,d,role)}))})),
    peaks:sc.peaks.map(p=>({...p,members:s.disciples.filter(d=>d.mind.peakId===p.id).map(d=>d.id),hostName:npc(s,p.hostId)?.name||'待邀请继任者',dailyCost:peakDailyCost(p),bonuses:{production:p.active?`${12*p.budget}%`:'0%',learning:p.active?`${15+8*p.budget}%`:'0%'}})),
    peakOptions:Object.entries(PEAK_DIRECTIONS).map(([id,p])=>({id,name:p.name,description:p.description,...peakStatus(s,id)})),disciples,
    incidents:sc.secrets.filter(e=>e.discovered).map(e=>({id:e.id,discipleId:e.discipleId,name:npc(s,e.discipleId)?.name||sc.departed.find(d=>d.id===e.discipleId)?.name||'旧日门人',kind:e.kind,
      title:{pill:'未经登记取丹',book:'私阅封存典籍',outing:'违反外出约定'}[e.kind],evidence:e.kind==='book'?`封签与借阅痕迹：《${TECHNIQUES[e.subject]?.name||'旧卷'}》`:e.kind==='pill'?`取用记录与${RECIPES[e.subject]?.name||'丹药'}库存相互印证`:'山口见证与出行留讯相互印证',motive:e.motive,discoveredAt:e.discoveredAt,handled:e.handled,outcome:e.outcome,
      choices:e.handled||!living(s,e.discipleId)?[]:INCIDENT_CHOICES.map(c=>({...c,disabledReason:c.id==='dismiss'&&!npc(s,e.discipleId)?.mind.office?'此人没有执事职责':''}))})),
    quests:sc.quests.map(q=>({id:q.id,discipleId:q.discipleId,kind:q.kind,status:q.status,progress:q.progress,createdAt:q.createdAt,deadline:q.deadline,outcome:q.outcome,name:npc(s,q.discipleId)?.name||'旧日门人',title:QUESTS[q.kind].title,text:QUESTS[q.kind].text,cost:{...QUESTS[q.kind].cost},choices:q.status==='offered'?QUESTS[q.kind].choices.map(c=>optionState(s,{...c,cost:c.id==='decline'?{}:QUESTS[q.kind].cost})):[]})),
    visitors:sc.visitors.filter(v=>v.status==='present').map(v=>({...v,...VISITOR_SPECS[v.kind],choices:VISITOR_SPECS[v.kind].choices.map(c=>optionState(s,c))})),
    departed:sc.departed.map(d=>({...d,memories:d.memories.map(m=>({...m}))})),stats:{...sc.stats},guestLesson:sc.guestLesson?{...sc.guestLesson}:null};
}
export function traitText(d) {return d.mind.traits.map((n,i)=>({n,name:TRAIT_NAMES[i]})).sort((a,b)=>b.n-a.n).slice(0,2).map(x=>`${x.name} ${x.n}`).join(' · ');}

export function validateSociety(s,{canonical=false}={}) {
  if(canonical&&s.contentVersion!=='sr-content-v1.2')throw Error('门人社会存档异常：canonical版本不一致');
  const bad=message=>{throw Error(`门人社会存档异常：${message}`);};
  const num=(n,min=0,max=1e12)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
  const int=(n,min=0,max=1e12)=>Number.isSafeInteger(n)&&num(n,min,max);
  const str=(v,max=500)=>typeof v==='string'&&v.length<=max;
  const sc=s.society;if(!sc||sc.revision!==1||!num(sc.clock)||sc.clock!==s.time||!int(sc.lastDay)||sc.lastDay!==day(s)||typeof sc.formal!=='boolean'||!str(sc.name,20)||!num(sc.fairness,0,100)||sc.foundedAt!==null&&!num(sc.foundedAt))bad('组织基础字段');
  for(const key of ['nextIncidentId','nextPeakId','nextQuestId','nextVisitorId','nextPersonId'])if(!int(sc[key],1))bad('流水号');
  if(!num(sc.nextVisitorAt)||!num(sc.lastShortageNotice,-120)||!sc.officers||!sc.stats||!['workCycles','lessons','relationships','questsCompleted','visitorsResolved','discovered'].every(k=>int(sc.stats[k])))bad('组织进度');
  for(const key of ['peaks','secrets','quests','visitors','visitorHistory','invitations','departed'])if(!Array.isArray(sc[key])||sc[key].length>10000)bad(key);
  for(const d of sc.departed)if(!d||!int(d.id,1)||!str(d.name,40)||!num(d.time)||!str(d.reason)||!Array.isArray(d.memories)||d.memories.some(m=>!m||!num(m.time)||!str(m.text)||typeof m.important!=='boolean'||typeof m.public!=='boolean'))bad('离院经历');
  const ids=new Set(s.disciples.map(d=>d.id)),historic=new Set([...ids,...sc.departed.map(d=>d.id)]);
  if(ids.size!==s.disciples.length)bad('门人编号重复');
  if(sc.nextPersonId<=Math.max(0,...historic))bad('下一个门人编号');
  for(const[k,list]of Object.entries(SOCIETY_RULE_OPTIONS))if(!list.some(x=>x.id===s.doctrine[k]))bad('规则');
  const unique=(arr,key)=>{const all=arr.map(x=>x[key]);return new Set(all).size===all.length;};
  if(!unique(sc.secrets,'id')||!unique(sc.peaks,'id')||!unique(sc.quests,'id')||!unique(sc.visitors,'id'))bad('事件编号重复');
  if(canonical)for(const [id,f]of Object.entries(s.factsById||{}))if(id.startsWith('fact:person-daily-supply:')||f?.kind==='daily-supply-relation'){
    if(f.kind!=='daily-supply-relation'||!str(f.personId,100)||id!==`fact:person-daily-supply:${f.personId}:${f.dayIndex}`||f.id!==id||!s.personsById?.[f.personId]||!int(f.dayIndex,0,day(s))||!int(f.atTick,0,s.worldTick)||f.source!=='economy.daily-supply'||f.sourceDay!==f.dayIndex||!int(f.starvation)||f.supplied!==(f.starvation===0)||!num(f.trustBefore,0,100)||!num(f.trustAfter,0,100)||!num(f.deltaTrust,-100,100))bad('每日供给关系来源');
    const delta=f.supplied?(f.trustBefore<45?.8:0):-2;
    if(Math.abs(f.trustAfter-clamp(f.trustBefore+delta,0,100))>1e-8||Math.abs(f.deltaTrust-(f.trustAfter-f.trustBefore))>1e-8)bad('每日供给关系变化');
  }
  for(const e of sc.secrets)if(!int(e.id,1,sc.nextIncidentId-1)||!historic.has(e.discipleId)||!['pill','book','outing'].includes(e.kind)||!num(e.time)||!num(e.evidenceProgress,0,100)||typeof e.discovered!=='boolean'||typeof e.handled!=='boolean'||e.handled&&!e.discovered||!str(e.motive)||!num(e.restitution)||e.outcome!==null&&!str(e.outcome)||(e.discovered?!num(e.discoveredAt):e.discoveredAt!==null))bad('秘密或证据');
  for(const e of sc.secrets)if(e.kind==='book'&&!TECHNIQUES[e.subject]||e.kind==='pill'&&!RECIPES[e.subject]||e.kind==='outing'&&!ROUTES[e.subject])bad('秘密对象');
  for(const role of Object.keys(SOCIETY_ROLES))if(sc.officers[role]!==null&&!ids.has(sc.officers[role]))bad('执事不存在');
  const peakIds=new Set(sc.peaks.map(p=>p.id));
  for(const p of sc.peaks)if(!int(p.id,1,sc.nextPeakId-1)||!PEAK_DIRECTIONS[p.direction]||!historic.has(p.hostId)||!str(p.name,20)||!int(p.budget,0,3)||!int(p.fundedBudget,0,3)||typeof p.active!=='boolean'||!str(p.reason)||!Array.isArray(p.members)||p.members.some(id=>!historic.has(id))||!int(p.fundedDay,-1)||!num(p.foundedAt))bad('分峰');
  const jobIds=new Set();
  for(const d of s.disciples) {
    const p=d.mind;if(!p||!Array.isArray(p.traits)||p.traits.length!==5||p.traits.some(n=>!num(n,0,100))||!ACTIVITIES.has(p.activity)||!str(p.reason)||!str(p.goal,40)||!num(d.wound,0,100)||!num(p.satiety,0,100)||!num(p.mood,0,100))bad('人物状态');
    if(!p.scenic||!canonical&&p.scenic.geometry!==SCENE_GEOMETRY||!validateScenic(p.scenic,s))bad('门人实际行走位置或路径');
    if(!num(p.commitUntil)||!num(p.lastDecision,-100)||!num(p.lastSocial,-120)||!num(p.lastTalk,-120)||!num(p.lastBreakthrough,-120)||!num(p.caution,0,5)||!num(p.purse,0,10000)||!num(p.restitutionBalance)||!num(p.restrictedUntil)||!int(p.lastPillDay,-1)||!int(p.pillPermitDay,-1)||!int(p.neglectDays)||!num(p.joinedAt)||!num(p.refusalUntil)||!num(p.lastPeakChange,-120)||!num(p.reorientUntil)||!num(p.lastConversion,-600))bad('人物计时');
    if(!p.skills||!['plant','industry','learning','array','medicine'].every(k=>num(p.skills[k],0,100))||!p.relationships||!p.relationships.master||Object.values(p.relationships).some(r=>!r||!['trust','respect','affection','conflict'].every(k=>num(r[k],0,100))||!num(r.lastEvent,-1000)))bad('关系与技艺');
    if(!Array.isArray(p.memories)||p.memories.length>10000||p.memories.some(m=>!num(m.time)||!str(m.text)||typeof m.important!=='boolean'||typeof m.public!=='boolean'||m.key!==null&&!str(m.key)))bad('记忆');
    if(p.mentorId!==null&&p.mentorId!=='master'&&!ids.has(p.mentorId)||p.mentorId===d.id||p.peakId!==null&&!peakIds.has(p.peakId)||p.office!==null&&sc.officers[p.office]!==d.id)bad('师徒或职责');
    if(!Array.isArray(p.path)||p.path.length>(canonical?512:CELLS.length)||p.path.some(q=>canonical?!Number.isFinite(q.x)||!Number.isFinite(q.y):!CELLS.some(c=>c.x===q.x&&c.y===q.y))||!canonical&&!CELLS.some(c=>c.x===d.position?.x&&c.y===d.position?.y))bad('门人位置');
    if(!p.hiddenKnowledge||Object.entries(p.hiddenKnowledge).some(([id,secret])=>!TECHNIQUES[id]||!sc.secrets.some(e=>e.id===secret&&e.discipleId===d.id&&e.kind==='book'&&e.subject===id)))bad('私下研习');
    if(p.supportIntent!==null&&TECHNIQUES[p.supportIntent]?.kind!=='support')bad('辅修志向');
    if(!num(p.workProgress,0,12)||p.publicMain!==null&&TECHNIQUES[p.publicMain]?.kind!=='main')bad('人物工作或公开修行');
    if(!['support','cautious','oppose'].includes(p.revengeAttitude)||!Array.isArray(p.questKinds)||p.questKinds.some(k=>!QUESTS[k]))bad('人物志向');
    if(p.away!==null&&(!(canonical?['errand','campaign','sr']:['errand','campaign']).includes(p.away.kind)||!str(p.away.id,100)))bad('外出状态');
    if(canonical&&p.away?.kind==='sr'&&(!s.travelsById?.[p.away.id]||!s.travelsById[p.away.id].participantIds?.includes(d.personId)))bad('SR同行引用');
    if(p.away?.kind==='errand'&&!p.journey)bad('自主外出缺少行程');
    if(p.away?.kind==='campaign'&&(!s.world?.exploration?.companionIds?.includes(d.id)||s.world.exploration.regionId!==p.away.id))bad('同行记录缺少实际行程');
    if(p.journey!==null){const j=p.journey;if(!ROUTES[j.routeId]||!num(j.remaining,0,j.total)||!num(j.total,1,1000)||!j.legacy&&j.total!==ROUTES[j.routeId].duration||typeof j.encounterResolved!=='boolean'||!num(j.risk,0,1)||p.away?.kind!=='errand')bad('自主行程');if(j.legacy&&(!j.snapshotReward||Object.entries(j.snapshotReward).some(([k,v])=>!RESOURCES[k]||!num(v))||!num(j.snapshotReputation)||!num(j.snapshotXp)||![1,1.5].includes(j.multiplier)))bad('旧日游历快照');}
    if(d.job!==null) {const b=s.buildings.find(b=>b.id===d.job);if(!b)bad('工作位置');if(s.schemaVersion!==6&&!['hall','meditation'].includes(b.type)){if(jobIds.has(d.job))bad('重复生产岗位');jobIds.add(d.job);}}
    if(p.activity==='work'&&d.job===null)bad('无设施的生产');
  }
  for(const q of sc.quests){if(!int(q.id,1,sc.nextQuestId-1)||!historic.has(q.discipleId)||!QUESTS[q.kind]||!['offered','active','completed','declined','expired','failed'].includes(q.status)||!num(q.progress,0,1)||!num(q.createdAt)||!num(q.deadline)||q.outcome!==null&&!str(q.outcome))bad('个人心事');if(q.kind==='mastery'&&['active','completed','failed'].includes(q.status)&&(!TECHNIQUES[q.target]||!num(q.startMastery,0,100)||!num(q.targetMastery,q.startMastery,100)||!int(q.researchTicks)))bad('研考进度');}
  for(const v of sc.visitors)if(!int(v.id,1,sc.nextVisitorId-1)||!VISITOR_SPECS[v.kind]||!['present','resolved','departed'].includes(v.status)||!num(v.arrivedAt)||!num(v.expiresAt))bad('访客');
  if(sc.guestLesson&&(!TECHNIQUES[sc.guestLesson.topic]||!num(sc.guestLesson.until)))bad('客座授业');
  return true;
}
