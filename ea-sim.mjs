import {hallInteriorEnabled} from './ea-hall-interior.mjs?v=ea-160-courtyard-20261008-r10';
import {sceneUnits} from './ea-sr-spatial.mjs?v=ea-160-courtyard-20261008-r10';
import {motherBenefit} from './ea-sr-mother-chain.mjs?v=ea-160-courtyard-20261008-r10';
import * as srEconomy from './ea-sr-economy.mjs?v=ea-160-courtyard-20261008-r10';
import {prepareFacilityActivity,releaseBodyActivity} from './ea-facility-activities.mjs?v=ea-160-courtyard-20261008-r10';
import {startScenicWalk,advanceScenic,validateScenic,repairScenicState,syncScenicPosition,buildingAccess,scenicDistance,scenicCanStand,scenicFindPath} from './ea-scenic.mjs?v=ea-160-courtyard-20261008-r10';
import {lifeActivityLock,lifeFacility,personLifeSummary,actorScenePosition,localLifeFacility} from './ea-life.mjs?v=ea-160-courtyard-20261008-r10';
import {validateSceneIntent,cancelSceneInteraction} from './ea-interactions.mjs?v=ea-160-courtyard-20261008-r10';
import {initNarrative,validateNarrative} from './ea-narrative.mjs?v=ea-160-courtyard-20261008-r10';
import {routeDiscovered,scenicHomeActors} from './ea-scene-state.mjs?v=ea-160-courtyard-20261008-r10';
import {initOnboarding,validateOnboarding,recordFirstProduction} from './ea-onboarding.mjs?v=ea-160-courtyard-20261008-r10';
export {setIntroPage,acknowledgeOnboarding} from './ea-onboarding.mjs?v=ea-160-courtyard-20261008-r10';
import * as legacy from './sect-sim.mjs?v=ea-160-courtyard-20261008-r10';
import * as data from './ea-data.mjs?v=ea-160-courtyard-20261008-r10';
import * as society from './ea-society.mjs?v=ea-160-courtyard-20261008-r10';
import * as campaign from './ea-campaign.mjs?v=ea-160-courtyard-20261008-r10';
export * from './ea-data.mjs?v=ea-160-courtyard-20261008-r10';
export * from './ea-society.mjs?v=ea-160-courtyard-20261008-r10';
export * from './ea-campaign.mjs?v=ea-160-courtyard-20261008-r10';
export * from './ea-life.mjs?v=ea-160-courtyard-20261008-r10';
export * from './ea-narrative.mjs?v=ea-160-courtyard-20261008-r10';
export {requestSceneInteraction,cancelSceneInteraction} from './ea-interactions.mjs?v=ea-160-courtyard-20261008-r10';
export {resolveVisitor,resolveVisitor as resolveWorldVisitor} from './ea-campaign.mjs?v=ea-160-courtyard-20261008-r10';
export {resolveVisitor as resolveSocietyVisitor} from './ea-society.mjs?v=ea-160-courtyard-20261008-r10';
const {RESOURCES,BUILDINGS,TECHNIQUES,RECIPES,ROUTES,GOODS,CELLS,NAMES,TRAIT_NAMES,day,xpNeed,realmName,rng,log,canPay,pay,grant,clamp,capacity,stage,finite,integer}=data;
const resourceZero=()=>Object.fromEntries(Object.keys(RESOURCES).map(k=>[k,0]));
const own=(o,k)=>Object.hasOwn(o,k);
const key=(x,y)=>`${x},${y}`;
const at=(s,x,y)=>s.buildings.find(b=>b.x===x&&b.y===y);
const validCell=(x,y)=>CELLS.some(c=>c.x===x&&c.y===y);
const stateMind=person=>person.mind||person;
const learned=(p,id)=>p.main===id||p.support.includes(id);
const knowledge=(person,id)=>stateMind(person).knowledge[id]||0;
const weather=s=>campaign.weatherEffects?.(s)||{production:{}};
const active=b=>!b.disabled&&b.enabled!==false&&b.condition>0;
const trip=s=>s.master.journey||s.master.action==='travel'||s.combat?.status==='active'||s.srWorld?.localSceneId&&s.srWorld.localSceneId!=='scene:yunxiu-courtyard';
const srBodyBusy=(s,p)=>p.lifeStatus==='dead'||s.activitiesById?.[p.activityId]?.kind?.startsWith('sr-');
function newEconomy(s){return{day:day(s),income:resourceZero(),expense:resourceZero(),previous:{income:resourceZero(),expense:resourceZero()},shortages:[],starvation:0,lastSupplyDay:day(s)};}
function freshMind(id){return{traits:[[82,44,78,68,62],[45,88,36,57,80],[65,60,70,85,48],[38,91,30,70,90]][(id-1)%4].slice(),goal:['精研草木','求取长生','守成护道','求索奇法'][(id-1)%4],main:null,support:[],knowledge:{},learning:null,activity:'rest',reason:'初到山院，先熟悉生活与传承。',memories:[],lastPillDay:-1,caution:0};}
function normaliseBase(s,{legacyVersion=0}={}){
 s.version=5;s.resources.food??=40+4*s.disciples.length;
 for(const b of s.buildings){b.condition??=100;b.enabled??=true;}
 s.pills.foundation??=0;s.pills.heal??=0;
 s.economy??=newEconomy(s);
 s.sim.seed??=618033;s.sim.carry??=0;s.sim.decision??=0;
 s.stats.relocated??=0;s.stats.trades??=0;s.stats.consumed??=0;
 s.sect.name??='云岫山院';s.sect.founded??=legacyVersion>0&&s.sect.level>=2;
 s.master.teaching??=null;s.master.breakthroughCooldown??=0;s.master.sceneIntent??=null;
 s.master.memories??=[];
 if(s.master.learning&&!s.master.learning.total){const t=TECHNIQUES[s.master.learning.id];s.master.learning.total=legacyVersion?60:t.duration;s.master.learning.progress=Math.min(s.master.learning.total-Number.EPSILON,s.master.learning.progress);s.master.learning.mode='learn';}
 for(const d of s.disciples){d.mind??=freshMind(d.id);d.energy??=100;if(legacyVersion&&d.mind.learning){d.mind.learning.total=60;d.mind.learning.mode='learn';}}
 if(legacyVersion&&s.crafting)s.crafting.yield=1;
 for(const k of Object.keys(GOODS))s.community.trades[k]??=0;
 if(legacyVersion)s.migration={from:legacyVersion,time:s.time,preserved:['resources','buildings','disciples','master','doctrine','crafting','journeys','incidents','claimed']};
 return s;
}
export function initial(options={}){
 if(typeof options==='number')options={seed:options};
 const s=normaliseBase(legacy.initial());
 if(options.seed!==undefined){if(!integer(options.seed,1,4294967295))throw Error('随机种子应为1至4294967295的整数。');s.sim.seed=options.seed;}
 if(options.name!==undefined){if(typeof options.name!=='string'||!options.name.trim()||options.name.trim().length>20)throw Error('姓名应为1至20字。');s.master.name=options.name.trim();}
 s.resources.food=50;s.resources.herb=22;s.master.hp=100;s.master.maxHp=100;
 society.initSociety(s,{legacy:false});campaign.initCampaign(s,{legacy:false,migrate:false});initNarrative(s,{legacy:false});initOnboarding(s);
 return s;
}
export function addDisciple(s,options={}){
 if(s.disciples.length>=capacity(s))throw Error('居所不足，先营造或升级门人居。');
 const id=Math.max(s.society?.nextPersonId||1,1,...s.disciples.map(d=>d.id+1),...(s.society?.departed||[]).map(d=>d.id+1));
 const d={id,name:options.name||NAMES[(id-1)%NAMES.length],root:options.root||['木灵根','水灵根','土灵根','火灵根','金灵根'][(id-1)%5],realm:options.realm||1,xp:0,talent:options.talent??Math.round((.9+rng(s)*1.05+(rng(s)>.94?.45:0))*100)/100,energy:100,portrait:options.portrait??(id-1)%4,trait:options.trait||'自寻前路',job:null,mind:freshMind(id)};
 if(options.main){d.mind.main=options.main;d.mind.knowledge[options.main]=options.mastery||30;}
 if(options.goal)d.mind.goal=options.goal;if(options.traits)d.mind.traits=options.traits.slice();
 if(options.reason||options.memory)d.mind.memories.unshift({time:s.time,text:options.reason||options.memory});
 s.disciples.push(d);
 if(society.initDisciple)society.initDisciple(s,d);else society.initSociety(s,{legacy:false});
 if(options.reason||options.memory)society.rememberPerson?.(s,d,options.reason||options.memory,{important:true,key:`joining:${id}`});
 if(s.society?.nextPersonId)s.society.nextPersonId=Math.max(s.society.nextPersonId,id+1);
 log(s,`${d.name}愿意留下，共同生活与求道。`);return d;
}
export function recruit(s){
 if(stage(s)<1)throw Error('先完成赠药救人的缘分。');
 if(s.disciples.length>=capacity(s))throw Error('居所不足，先营造或升级门人居。');
 pay(s,{jade:65,herb:8,food:8});return addDisciple(s,{reason:'因山院愿意提供居所和基础传承，自愿前来求道。'});
}
export function assign(){throw Error('门人自行选择工作；可发布差事、改善供给和传承条件。');}
export function breakthrough(){throw Error('门人自行决定突破；掌门只能为其提供知识、材料与机会。');}
export function usePill(){throw Error('门人自行决定服丹；可通过门规设置领取条件。');}
export function buildingLock(s,type){
 const t=BUILDINGS[type];if(!t)return '建筑不存在';if(type==='hall')return '主屋只能升级';
 if(t.unique&&s.buildings.some(b=>b.type===type))return '此设施只需一座';
 if(stage(s)<t.stage)return `需${data.STAGE_NAMES[t.stage]}`;
 if(t.realm&&s.master.realm<t.realm)return `需掌门${realmName(t.realm)}`;
 if(type==='clinic'&&![s.master,...s.disciples].some(p=>knowledge(p,'spring')>=20||knowledge(p,'alchemy')>=20))return '需有人掌握春雨养脉法或药理';
 if(type==='watchtower'&&![s.master,...s.disciples].some(p=>knowledge(p,'array')>=40))return '需有人护脉阵诀熟练度40';
 return '';
}
const placementCache=new WeakMap();
export function placementLock(s,type,x,y,ignoreId=null){
 if(!BUILDINGS[type])return '建筑不存在';if(!validCell(x,y))return '请选山坪内的可营造地块';if((x>=8||y>=7)&&stage(s)<3)return '外围台地需正式立派后营造';
 if(at(s,x,y)&&at(s,x,y).id!==ignoreId)return '地块已有建筑';
 const candidate={id:ignoreId||s.nextId,type,x,y,level:1,progress:0,condition:100,enabled:true},prospective={...s,buildings:[...s.buildings.filter(b=>b.id!==ignoreId),candidate]},position=actorScenePosition(s,s.master);
 if(!scenicCanStand(prospective,position))return '掌门正在营造范围内，或此处会封住通路，请先移开';
 // Recheck living positions before the static layout cache. A moving visitor
 // must not be hidden by a cached green preview or teleported on completion.
 for(const person of scenicHomeActors(s)){
  const p=actorScenePosition(s,person);
  if(scenicCanStand(s,p)&&!scenicCanStand(prospective,p))return `${person.name||'有人'}正在营造范围内，请等其离开后再确认`;
 }
 const revision=s.buildings.map(b=>`${b.id}/${b.type}/${b.x}/${b.y}`).join('|');let cached=placementCache.get(s);if(!cached||cached.revision!==revision){cached={revision,locks:new Map()};placementCache.set(s,cached);}const cacheKey=`${type}:${x}/${y}:${ignoreId}`,known=cached.locks.get(cacheKey);if(known!==undefined)return known;
 const hall=prospective.buildings.find(b=>b.type==='hall'),start=buildingAccess(prospective,hall);
 const blocked=prospective.buildings.some(b=>!scenicCanStand(prospective,buildingAccess(prospective,b))||scenicFindPath(prospective,start,buildingAccess(prospective,b))===null);
 const lock=blocked?'此处会切断实际建筑入口，请保留连通走道':'';cached.locks.set(cacheKey,lock);if(lock)return lock;
 return '';
}
export function buildInfo(s,type,x,y){const t=BUILDINGS[type];if(!t)return{lock:'建筑不存在'};return{...t,cost:{...t.cost},lock:buildingLock(s,type)||(x!==undefined?placementLock(s,type,x,y):''),affordable:canPay(s,t.cost),layout:x!==undefined?layoutBonus(s,{type,x,y,level:1,condition:100,enabled:true}):null};}
export function build(s,type,x,y){const lock=buildingLock(s,type)||placementLock(s,type,x,y);if(lock)throw Error(lock);pay(s,BUILDINGS[type].cost);const b={id:s.nextId++,type,x,y,level:1,progress:0,condition:100,enabled:true};s.buildings.push(b);repairScenicState(s);s.stats.built++;log(s,`${BUILDINGS[type].name}落成，门人会自行权衡是否使用。`);return b;}
export function upgradeCost(b){return{jade:45*b.level,wood:30*b.level,stone:20*b.level};}
export function upgrade(s,id){const b=s.buildings.find(b=>b.id===id);if(!b)throw Error('建筑不存在。');if(b.level>=BUILDINGS[b.type].max)throw Error('建筑已满级。');pay(s,upgradeCost(b));b.level++;b.condition=100;log(s,`${BUILDINGS[b.type].name}升至${b.level}级。`);return b;}
export function toggleBuilding(s,id){const b=s.buildings.find(b=>b.id===id);if(!b||b.type==='hall')throw Error('主屋不可停用。');b.enabled=!b.enabled;if(!b.enabled)for(const d of s.disciples)if(d.job===id){d.job=null;d.mind.activity='rest';d.mind.reason='设施暂停运行，重新安排生活。';d.mind.commitUntil=0;d.mind.path=[];if(d.mind.scenic){d.mind.scenic.path=[];d.mind.scenic.goal=null;}}log(s,`${BUILDINGS[b.type].name}${b.enabled?'恢复运行':'暂停运行，暂停维护开销'}。`);return b.enabled;}
export function repairBuilding(s,id){const b=s.buildings.find(b=>b.id===id);if(!b||b.condition>=100)throw Error('建筑无需修缮。');pay(s,{wood:Math.ceil((100-b.condition)/5),stone:Math.ceil((100-b.condition)/8)});b.condition=100;log(s,`${BUILDINGS[b.type].name}已修缮。`);}
export function relocate(s,id,x,y){const b=s.buildings.find(b=>b.id===id);if(!b||b.type==='hall')throw Error('主屋根基不可搬迁。');if(b.type==='alchemy'&&s.crafting)throw Error('丹炉炼制中，待成丹后搬迁。');const lock=placementLock(s,b.type,x,y,id);if(lock)throw Error(lock);pay(s,{jade:10*b.level,wood:8*b.level});b.x=x;b.y=y;b.progress=0;repairScenicState(s);for(const d of s.disciples)if(d.job===id&&d.mind.scenic){d.mind.scenic.path=[];d.mind.scenic.goal=null;}s.stats.relocated++;log(s,`${BUILDINGS[b.type].name}迁至新的地块。`);return b;}
export function demolish(s,id){const b=s.buildings.find(b=>b.id===id);if(!b||b.type==='hall')throw Error('主屋不可拆除。');if(b.type==='alchemy'&&s.crafting)throw Error('丹炉炼制中。');if(capacity(s)-(BUILDINGS[b.type].capacity||0)*b.level<s.disciples.length)throw Error('拆除后居所不足。');const refund={};for(const[k,v]of Object.entries(BUILDINGS[b.type].cost))refund[k]=Math.floor(v*.65);for(let n=1;n<b.level;n++)for(const[k,v]of Object.entries(upgradeCost({level:n})))refund[k]=(refund[k]||0)+Math.floor(v*.65);grant(s,refund);for(const d of s.disciples)if(d.job===id){d.job=null;d.mind.activity='rest';d.mind.reason='原设施已拆除，重新安排生活。';d.mind.commitUntil=0;d.mind.path=[];if(d.mind.scenic){d.mind.scenic.path=[];d.mind.scenic.goal=null;}}s.buildings=s.buildings.filter(x=>x.id!==id);repairScenicState(s);if(s.master.sceneIntent?.kind==='building'&&s.master.sceneIntent.id===id)cancelSceneInteraction(s);log(s,`拆除${BUILDINGS[b.type].name}，回收六成半材料。`);return refund;}
export function layoutBonus(s,b){
 let factor=1;const reasons=[],origin=buildingAccess(s,b),near=s.buildings.filter(x=>x.id!==b.id&&active(x)&&origin&&scenicDistance(origin,buildingAccess(s,x))<=sceneUnits(s,150)),has=t=>near.some(x=>x.type===t);
 if(['farm','granary'].includes(b.type)&&has('well')){factor+=.25;reasons.push('灵泉滋养 +25%');}
 if(['library','meditation'].includes(b.type)&&has(b.type==='library'?'meditation':'library')){factor+=.15;reasons.push('研读与修行相邻 +15%');}
 if(b.type==='meditation'&&has('well')){factor+=.2;reasons.push('灵泉聚气 +20%');}
 if(['farm','alchemy'].includes(b.type)&&has(b.type==='farm'?'alchemy':'farm')){factor+=.15;reasons.push('药圃丹房互助 +15%');}
 if(['lumber','quarry'].includes(b.type)&&has('workshop')){factor+=.2;reasons.push('百工运输便利 +20%');}
 if(['hall','house'].includes(b.type)){const k=near.find(x=>x.type==='kitchen');if(k){factor+=.12*k.level;reasons.push(`临近膳房，休憩 +${12*k.level}%`);}if(has('clinic')){factor+=.1;reasons.push('医庐调养，休憩 +10%');}if(has('quarry')){factor-=.1;reasons.push('采石声扰，休憩 -10%');}}
 if(b.type==='kitchen'){if(has('house')||has('hall')){factor+=.1;reasons.push('近居集中供膳，节粮效益 +10%');}if(has('quarry')){factor-=.1;reasons.push('采石运输干扰，节粮效益 -10%');}}
 return{factor,reasons};
}
export function buildingYield(s,b,d=null){
 const t=BUILDINGS[b.type];if(!t||!active(b))return{};if(t.input&&!s.srEconomy&&!canPay(s,t.input))return{};
 const p=d?stateMind(d):null,prof=t.tags.some(tag=>p?.support.some(id=>TECHNIQUES[id]?.production===tag)||TECHNIQUES[p?.main]?.production===tag)?1.2:1;
 let factor=b.level*(d?d.talent*(1+.07*(d.realm-1)):1)*layoutBonus(s,b).factor*(.4+.6*b.condition/100)*prof;
 if(s.economy.starvation)factor*=.6;
 const effects=weather(s).production||{};const out={};for(const[k,v]of Object.entries(t.out))out[k]=v*factor*(effects[k]??1);return out;
}
export function foodDemand(s){const kitchen=s.buildings.find(b=>b.type==='kitchen'&&active(b));const saving=kitchen?Math.min(.4,.1*kitchen.level*layoutBonus(s,kitchen).factor):0;return Math.ceil((s.disciples.length+1)*2*(1-saving));}
export function restRecovery(s,person){const p=stateMind(person);if(hallInteriorEnabled(s)){const a=s.activitiesById[person.activityId],home=a?.phase==='executing'&&['rest','heal'].includes(a.action)&&s.buildingsById[a.targetId];return home?((person===s.master?1.3:1.05)+(p.support.includes('spring')?.4:0))*layoutBonus(s,home).factor:.3;}const position=actorScenePosition(s,person),home=s.buildings.filter(b=>['hall','house'].includes(b.type)&&active(b)).sort((a,b)=>scenicDistance(position,buildingAccess(s,a))-scenicDistance(position,buildingAccess(s,b)))[0];return((person===s.master?1.3:1.05)+(p.support.includes('spring')?.4:0))*(home&&scenicDistance(position,buildingAccess(s,home))<=150?layoutBonus(s,home).factor:1);}
export function maintenanceCost(s){const total={};for(const b of s.buildings.filter(active))for(const[k,v]of Object.entries(BUILDINGS[b.type].upkeep))total[k]=(total[k]||0)+v*b.level;return total;}
export function economySummary(s){const e=s.economy,windowIncome=e.previous.income,windowExpense=e.previous.expense;return{day:day(s),income:{...e.income},expense:{...e.expense},net:Object.fromEntries(Object.keys(RESOURCES).map(k=>[k,(e.income[k]||0)-(e.expense[k]||0)])),previous:{income:{...windowIncome},expense:{...windowExpense}},foodDemand:foodDemand(s),foodDays:Math.floor(s.resources.food/Math.max(1,foodDemand(s))),maintenance:maintenanceCost(s),shortages:e.shortages.slice()};}
export function rates(s){
 const out=resourceZero();
 for(const b of s.buildings){
  if(b.type==='hall'&&['opening-v1.2','sr-content-v1.2'].includes(s.contentVersion))continue;
  const workers=s.disciples.filter(d=>d.job===b.id&&d.mind.activity==='work'&&!d.mind.away&&!d.mind.scenic?.path?.length&&(s.schemaVersion===6?s.activitiesById[d.activityId]?.phase==='executing'&&s.activitiesById[d.activityId]?.targetId===b.instanceId:!d.mind.scenic||scenicDistance(d.mind.scenic,buildingAccess(s,b))<=18));
  if(BUILDINGS[b.type].work&&!workers.length)continue;
  const participants=workers.length?workers:[null];
  for(const d of participants){const yieldMap=buildingYield(s,b,d);for(const[k,v]of Object.entries(yieldMap))out[k]+=v;for(const[k,v]of Object.entries(BUILDINGS[b.type].input||{}))if(d&&Object.values(yieldMap).some(n=>n>0))out[k]-=v;}
 }
 for(const[k,v]of Object.entries(maintenanceCost(s)))out[k]-=v/6;out.food-=foodDemand(s)/6;return out;
}

export function compatible(person,id){const p=stateMind(person),t=TECHNIQUES[id];if(!t)return false;const ids=[p.main,...p.support].filter(x=>x&&x!==id);return !ids.some(x=>TECHNIQUES[x]?.conflicts.includes(id)||t.conflicts.includes(x));}
export function supportLimit(person){return person.realm>=10?3:person.realm>=4&&person.talent>=1.4?2:1;}
export function teachers(s,id){const t=TECHNIQUES[id];if(!t)return[];return[s.master,...s.disciples].filter(p=>p.realm>=t.realm&&knowledge(p,id)>=t.teacherMastery&&!(p.mind?.hiddenKnowledge?.[id]&&s.society.secrets.some(e=>e.id===p.mind.hiddenKnowledge[id]&&!e.discovered))).map(p=>({id:p===s.master?0:p.id,name:p.name,knowledge:knowledge(p,id),active:p===s.master?s.master.action==='teach':!!p.mind.mentor||p.mind.activity==='teach'||!!p.role}));}
export function studyLock(s,person,id,isMaster=false){
 const t=TECHNIQUES[id],p=isMaster?person:stateMind(person);if(!t||!s.doctrine.books.includes(id))return '府中尚无此传承';if(person.realm<t.realm)return `需${realmName(t.realm)}`;
 if(isMaster&&s.doctrine.sealed.includes(id))return '典籍已封存，先重新开放';
 if(knowledge(person,id)>=100&&learned(p,id))return '已融会贯通';
 if(!compatible(p,id))return '与现有功体或辅修存在特殊禁忌';
 if(t.kind==='support'&&!p.support.includes(id)&&p.support.length>=supportLimit(person))return '辅修精力已满，可先停止一门辅修';
 if(id!=='qingyuan'&&!s.buildings.some(b=>b.type==='library'&&active(b)))return '需运行中的藏经阁';
 for(const pre of t.prerequisites){if(pre.id&&knowledge(person,pre.id)<pre.mastery)return `需《${TECHNIQUES[pre.id].name}》熟练度${pre.mastery}`;if(pre.anyMain&&!Object.entries(p.knowledge).some(([k,v])=>TECHNIQUES[k]?.kind==='main'&&v>=pre.anyMain))return `需一门主修熟练度${pre.anyMain}`;}
 if(t.realm>=7&&!learned(p,id)&&person.talent<1.6&&!teachers(s,id).some(x=>x.id!==(isMaster?0:person.id)))return '高阶传承需成熟导师授业，或资质1.60自主参悟';
 return '';
}
export function learnTechnique(s,person,id,isMaster=false,{silent=false}={}){const p=isMaster?person:stateMind(person),t=TECHNIQUES[id];if(!t)throw Error('功法不存在。');const was=knowledge(person,id)>0;if(t.kind==='main')p.main=id;else if(!p.support.includes(id))p.support.push(id);p.knowledge[id]=Math.min(100,(p.knowledge[id]||0)+20);p.learning=null;if(!silent)log(s,`${person.name}${was?'加深了':'初步掌握'}《${t.name}》的理解（${Math.floor(p.knowledge[id])}）。`);}
export function obtainBook(s,id){const t=TECHNIQUES[id];if(!t?.cost||t.sourceType==='story'||s.doctrine.books.includes(id))throw Error('此书须按来源取得，或已收藏。');if(stage(s)<1)throw Error('先与山下建立往来。');pay(s,t.cost);s.doctrine.books.push(id);log(s,`从${t.source}取得《${t.name}》。`);}
export function sealBook(s,id){if(id==='qingyuan'||!s.doctrine.books.includes(id))throw Error('基础传承不可封存。');const i=s.doctrine.sealed.indexOf(id);if(i<0)s.doctrine.sealed.push(id);else s.doctrine.sealed.splice(i,1);log(s,`《${TECHNIQUES[id].name}》${i<0?'封存，院中不再公开借阅':'重新开放借阅'}。`);}
export function masterStudy(s,id){const m=s.master;if(trip(s)||m.wound>0)throw Error('归院疗伤后方可研习。');if(m.energy<15)throw Error('精力不足，先休息。');if(m.learning?.id===id){const lock=studyLock(s,m,id,true);if(lock)throw Error(lock);cancelSceneInteraction(s);m.action='study';m.path=[];return;}const lock=studyLock(s,m,id,true);if(lock)throw Error(lock);cancelSceneInteraction(s);const conversion=TECHNIQUES[id].kind==='main'&&m.main!==id;const total=Math.ceil(TECHNIQUES[id].duration*(conversion?1.6:1));m.learning={id,progress:0,total,mode:conversion?'convert':learned(m,id)?'deepen':'learn'};m.action='study';m.path=[];m.teaching=null;log(s,`掌门开始${conversion?'转修':'研习'}《${TECHNIQUES[id].name}》，需投入约${Math.ceil(total/m.talent)}秒。`);}
export function forgetSupport(s,id){const m=s.master;if(trip(s)||m.learning)throw Error('先结束行程或学习。');if(!m.support.includes(id))throw Error('此法不在当前辅修中。');pay(s,{herb:8,insight:3});m.support=m.support.filter(x=>x!==id);m.energy=Math.max(0,m.energy-10);m.action='rest';log(s,`掌门暂停《${TECHNIQUES[id].name}》辅修，已理解的知识仍然保留。`);}
export function returnToBasics(s){const m=s.master;if(trip(s)||m.wound>0)throw Error('先归院疗伤。');if(m.main==='qingyuan')throw Error('当前已是青岚养元诀。');if(m.energy<30)throw Error('需至少30精力。');pay(s,{jade:80,herb:20});m.main='qingyuan';m.energy-=20;m.xp=Math.max(0,m.xp*.8);m.learning=null;m.action='rest';log(s,'掌门散去旧功体，重归青岚基础；保留知识，损失两成当前修为。');}
export function cultivationRate(s,person,b=null){const p=stateMind(person);if(!p.main)return 0;if(person===s.master&&b===null)b=localLifeFacility(s,person,['meditation','hall']);let factor=TECHNIQUES[p.main]?.cultivation||1;for(const id of p.support)factor*=TECHNIQUES[id]?.cultivation||1;if(p.support.includes('wood')&&TECHNIQUES[p.main]?.element==='water')factor*=1.08;const base=person===s.master?2.2*(b?.type==='meditation'&&active(b)?b.level:1):b?.type==='meditation'?2.1*b.level:.9;return base*person.talent*factor*(b&&active(b)?layoutBonus(s,b).factor:1)*(s.economy.starvation?.65:1)*motherBenefit(s,person);}
export function breakthroughCost(person){if(person.realm===9)return{jade:240,herb:50,crystal:10,insight:20};if(person.realm>=10)return{jade:200+(person.realm-10)*120,herb:60,crystal:12+(person.realm-10)*6,insight:20};return{jade:person.realm*24,herb:person.realm*8};}
export function breakthroughLock(s,person,isMaster=false){
 if(person.realm>=12)return '已达本篇筑基后期';if(person.xp<xpNeed(person.realm))return '修为未满';if(person.energy<35)return '需至少35精力';if(person.wound>0)return '先养好伤势';if(isMaster&&trip(s))return '先归院';if(person.breakthroughCooldown>s.time)return '突破后需继续调息';
 if(person.realm>=9&&knowledge(person,'foundation')<35)return '需理解青岚筑基篇，熟练度35';if(person.realm===9&&s.pills.foundation<1)return '需一枚筑基丹';if(!canPay(s,breakthroughCost(person)))return '突破材料不足';return '';
}
export function breakthroughPerson(s,person,isMaster=false,{autonomous=false}={}){if(!isMaster&&!autonomous)throw Error('门人必须自主决定突破。');const lock=breakthroughLock(s,person,isMaster);if(lock)throw Error(lock);pay(s,breakthroughCost(person));if(person.realm===9)s.pills.foundation--;person.xp=0;person.realm++;person.energy-=25;person.breakthroughCooldown=s.time+15;s.stats.breakthroughs++;if(isMaster){person.action='rest';person.learning=null;s.master.memories.unshift({time:s.time,text:`在云岫山突破至${realmName(person.realm)}。`});}log(s,`${person.name}突破至${realmName(person.realm)}，根基已稳。`);}
export function masterBreakthrough(s){return breakthroughPerson(s,s.master,true);}
export function riskBreakthroughInfo(s){
 const m=s.master,need=xpNeed(m.realm),xpRatio=m.xp/need;
 const chance=Math.round(clamp(.55+clamp((xpRatio-.85)/.15,0,1)*.15+clamp((m.energy-35)/65,0,1)*.06+clamp((m.talent-.5)/2.5,0,1)*.09,.55,.85)*1000)/1000;
 const lock=m.realm>=12?'已达本篇筑基后期':xpRatio>=1?'修为已满，可选择稳妥突破':xpRatio<.85?'提前冲关至少需要当前境界85%修为':breakthroughLock(s,{...m,xp:need},true);
 return{chance,lock,cost:{...breakthroughCost(m)},pillCost:m.realm===9?{foundation:1}:{},energyCost:25,currentXp:m.xp,requiredXp:need*.85,xpRatio,fromRealm:m.realm,toRealm:Math.min(12,m.realm+1),failure:{xpLossFraction:.15,wound:12,cooldown:60},successCooldown:15,consumeOnFailure:true};
}
export function masterRiskBreakthrough(s){
 const info=riskBreakthroughInfo(s);if(info.lock)throw Error(info.lock);const m=s.master,before=m.xp;
 pay(s,info.cost);if(info.pillCost.foundation)s.pills.foundation--;m.energy-=info.energyCost;
 const roll=rng(s),success=roll<info.chance;
 m.action='rest';m.learning=null;m.path=[];m.teaching=null;
 if(success){m.realm++;m.xp=0;m.breakthroughCooldown=s.time+info.successCooldown;s.stats.breakthroughs++;}
 else {m.xp=before*(1-info.failure.xpLossFraction);m.wound=clamp(m.wound+info.failure.wound,0,100);m.breakthroughCooldown=s.time+info.failure.cooldown;}
 const result={time:s.time,success,chance:info.chance,roll,fromRealm:info.fromRealm,toRealm:m.realm,lostXp:success?0:before-m.xp,injury:success?0:info.failure.wound,cooldownUntil:m.breakthroughCooldown,cost:{...info.cost},pillCost:{...info.pillCost},energyCost:info.energyCost};
 (m.breakthroughHistory??=[]).push(result);
 const text=success?`掌门提前冲关成功，突破至${realmName(m.realm)}；此次公示成功率${Math.round(info.chance*100)}%。`:`掌门提前冲关未成，仍是${realmName(m.realm)}；损失当前修为15%、受轻伤12，需调息60秒，投入物资已消耗。`;
 m.memories.unshift({time:s.time,text});log(s,text);return result;
}
export function consumePill(s,id,person,{silent=false}={}){const r=RECIPES[id];if(!r||id==='foundation'||(s.srEconomy?srEconomy.availablePills(s,person.personId,id):s.pills[id])<1)throw Error('丹药不可直接服用，或库存不足。');const xp=r.effect.xp*(person.realm>=10?.5:1);if(person.xp>=xpNeed(person.realm)&&(!r.effect.energy||person.energy>=100)&&(!r.effect.wound||!person.wound))throw Error('此时服丹没有收益。');if(s.srEconomy)srEconomy.consumeAccessiblePill(s,person.personId,id);else s.pills[id]--;person.xp=Math.min(xpNeed(person.realm),person.xp+xp);person.energy=Math.min(100,person.energy+r.effect.energy);if(person.wound!==undefined)person.wound=Math.max(0,person.wound-r.effect.wound);s.stats.consumed++;if(!silent)log(s,`${person.name}服用${r.name}，调息养脉。`);}
export function masterPill(s,id){if(s.srEconomy?s.combat?.status==='active':trip(s))throw Error(s.srEconomy?'斗法中须使用有起手与收势的实际服药动作。':'归院后再服用府库丹药。');return consumePill(s,id,s.master);}
export function masterAction(s,action){
 const m=s.master;if(trip(s))throw Error('先结束山外行程或战斗。');if(!['rest','heal','cultivate','wood','stone','herb','food','teach'].includes(action))throw Error('行动无效。');
 if(action==='heal'){if(m.wound<=0)throw Error('伤势已经痊愈。');if(m.action==='heal')return;pay(s,{herb:6});}
 if(['cultivate','teach'].includes(action)&&m.wound>0)throw Error('先养好伤势。');
 if(action==='teach'&&!Object.entries(m.knowledge).some(([id,n])=>n>=TECHNIQUES[id].teacherMastery))throw Error('需有一部典籍达到60熟练度，方可可靠授业。');
 cancelSceneInteraction(s);
 m.action=action;m.path=[];if(m.scenic)m.scenic.path=[];m.work=0;m.learning=null;if(action!=='teach')m.teaching=null;
}
export function masterTeach(s,id){if(!TECHNIQUES[id]||knowledge(s.master,id)<TECHNIQUES[id].teacherMastery)throw Error('对此书理解不足，无法授业。');masterAction(s,'teach');s.master.teaching=id;log(s,`掌门开始讲授《${TECHNIQUES[id].name}》。`);}
export function moveScenicMaster(s,x,y){if(trip(s)||s.world?.exploration)throw Error('掌门尚在山外。');cancelSceneInteraction(s);return startScenicWalk(s.master,{x,y},s);}
export function moveMaster(s,x,y){
 const m=s.master;if(trip(s))throw Error('掌门尚在山外。');if(!validCell(x,y)||at(s,x,y))return false;cancelSceneInteraction(s);const queue=[{...m.position,path:[]}],seen=new Set([key(m.position.x,m.position.y)]);
 while(queue.length){const p=queue.shift();if(p.x===x&&p.y===y){if(m.scenic)m.scenic.path=[];m.path=p.path;m.action=m.path.length?'walk':'rest';m.learning=null;m.teaching=null;return true;}for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const a=p.x+dx,b=p.y+dy,k=key(a,b);if(validCell(a,b)&&!at(s,a,b)&&!seen.has(k)){seen.add(k);queue.push({x:a,y:b,path:[...p.path,{x:a,y:b}]});}}}return false;
}
export function craftLock(s,id){const r=RECIPES[id],f=s.buildings.find(b=>b.type==='alchemy'&&active(b));if(!r)return '丹方不存在';if(!f)return '需运行中的丹霞炉';if(s.crafting)return '丹炉正在炼制';if(s.master.realm<r.realm&&!s.disciples.some(d=>d.realm>=r.realm))return `需有${realmName(r.realm)}修士`;if(r.knowledge&&![s.master,...s.disciples].some(p=>knowledge(p,r.knowledge)>=r.mastery))return `需《${TECHNIQUES[r.knowledge].name}》熟练度${r.mastery}`;if(id==='foundation'&&!s.doctrine.books.includes('foundation'))return '先取得可靠筑基传承与丹方';if(!canPay(s,r.cost))return '炼丹材料不足';return '';}
export function craft(s,id){const lock=craftLock(s,id);if(lock)throw Error(lock);const f=s.buildings.find(b=>b.type==='alchemy');pay(s,RECIPES[id].cost);const total=Math.ceil(RECIPES[id].duration/(1+.25*(f.level-1))/layoutBonus(s,f).factor);s.crafting={recipeId:id,remaining:total,total,yield:RECIPES[id].yield};log(s,`${RECIPES[id].name}入炉，材料已经投入。`);}
const ORDERS=[
 [{id:'timber',name:'修缮山道',text:'山民修复栈道，交付灵木。',cost:{wood:25},reward:{jade:38,insight:3},rep:5},{id:'herbs',name:'悬壶济世',text:'赠药给行脚医师。',cost:{herb:18},reward:{jade:40,food:10},rep:6},{id:'pill',name:'同道求丹',text:'同道求一枚聚气丹。',pill:'qi',reward:{jade:40,insight:6},rep:8}],
 [{id:'stone',name:'重立界碑',text:'交付青石修葺古道界碑。',cost:{stone:20},reward:{jade:38,insight:3},rep:5},{id:'supplies',name:'远行补给',text:'送去商队需要的木草物资。',cost:{wood:15,herb:10},reward:{jade:45,food:15},rep:6},{id:'pill',name:'护送丹药',text:'给邻山散修送药。',pill:'qi',reward:{jade:40,crystal:3},rep:8}],
 [{id:'garden',name:'灵圃整修',text:'整修山下的灵圃。',cost:{wood:15,stone:12},reward:{jade:45,herb:15},rep:6},{id:'herbs',name:'草木问道',text:'与游方丹师交流药性。',cost:{herb:22},reward:{jade:30,insight:6},rep:6},{id:'pill',name:'丹香结缘',text:'赠丹结交远来客。',pill:'qi',reward:{jade:45,insight:6},rep:8}]
];
function renewMarket(s){if(s.community.day!==day(s)){s.community.day=day(s);s.community.fulfilled=[];s.community.trades=Object.fromEntries(Object.keys(GOODS).map(k=>[k,0]));}}
export function commissions(s){return ORDERS[day(s)%ORDERS.length];}
export const MARKET_DAILY_BATCHES=8;
export function trade(s,id,side,expectedDay=day(s),batches=1){
 if(expectedDay!==day(s))throw Error('市集已经换日，请重新查看。');
 const g=GOODS[id];if(!g||!['buy','sell'].includes(side))throw Error('交易不存在。');
 if(!Number.isSafeInteger(batches)||batches<1||batches>999)throw Error('交易数量需为1至999组，每组10份。');
 const used=s.community.day===day(s)?s.community.trades[id]||0:0;
 if(side==='buy'&&used+batches>MARKET_DAILY_BATCHES)throw Error(used>=MARKET_DAILY_BATCHES?'今日已售罄，余货不足，次日补货。':'今日余货不足，请减少数量或次日再来。');
 pay(s,side==='buy'?{jade:g.buy*batches}:{[id]:10*batches});
 renewMarket(s);
 grant(s,side==='buy'?{[id]:10*batches}:{jade:g.sell*batches});
 if(side==='buy')s.community.trades[id]+=batches;
 s.stats.trades+=batches;
 log(s,`${side==='buy'?'购入':'售出'}${g.name}${10*batches}份，${side==='buy'?'花费':'获得'}灵石${g[side]*batches}。`);
}
export function fulfill(s,id,expectedDay=day(s)){if(expectedDay!==day(s))throw Error('委托已轮换，请重新查看。');renewMarket(s);const q=commissions(s).find(o=>o.id===id);if(!q||s.community.fulfilled.includes(id))throw Error('委托已完成或不存在。');if(q.pill&&s.pills[q.pill]<1)throw Error('所需丹药不足。');pay(s,q.cost||{});if(q.pill)s.pills[q.pill]--;grant(s,q.reward);s.sect.reputation+=q.rep;s.community.completed++;s.community.fulfilled.push(id);log(s,`完成「${q.name}」，得声望${q.rep}。`);}
export const QUESTS=[
 {id:'quarry',title:'开山取石',text:'建一座采石场。',check:s=>s.buildings.some(b=>b.type==='quarry'),reward:{jade:60,wood:30}},
 {id:'meditation',title:'引灵入府',text:'建一座聚灵台。',check:s=>s.buildings.some(b=>b.type==='meditation'),reward:{jade:80,herb:25}},
 {id:'breakthrough',title:'仙途初成',text:'完成一次突破。',check:s=>s.stats.breakthroughs>0,reward:{jade:120,wood:60,stone:40}},
 {id:'alchemy',title:'丹火初燃',text:'完成一次炼丹。',check:s=>s.stats.crafted>0,reward:{jade:70,herb:30}},
 {id:'expedition',title:'问道山外',text:'完成一次游历。',check:s=>s.stats.expeditions>0,reward:{jade:80,insight:10}},
 {id:'sect2',title:'山门渐盛',text:'正式建立门派。',check:s=>s.sect.level>=2,reward:{crystal:10,herb:40}},
 {id:'realm3',title:'道心初定',text:'有一名炼气三层门人。',check:s=>s.disciples.some(d=>d.realm>=3),reward:{jade:150,insight:20}},
 {id:'food',title:'安居有粮',text:'营造灵稻田与山院膳房。',check:s=>['granary','kitchen'].every(t=>s.buildings.some(b=>b.type===t)),reward:{jade:60,food:40}},
 {id:'foundation',title:'道基初成',text:'掌门达到筑基。',check:s=>s.master.realm>=10,reward:{jade:180,herb:50,crystal:12}}
];
export function claim(s,id){const q=QUESTS.find(q=>q.id===id);if(!q||s.claimed.includes(id)||!q.check(s))throw Error('条件未完成或已领取。');grant(s,q.reward);s.claimed.push(id);s.sect.reputation+=10;log(s,`完成「${q.title}」，所得已入府库。`);}
export function traitText(d){return d.mind.traits.map((n,i)=>({n,name:TRAIT_NAMES[i]})).sort((a,b)=>b.n-a.n).slice(0,2).map(x=>`${x.name} ${x.n}`).join(' · ');}
export function isAway(s,id){return s.expedition?.discipleId===id||s.disciples.find(d=>d.id===id)?.mind.activity==='travel';}
function supplyStep(s){
 if(s.economy.lastSupplyDay===day(s))return;
 const e=s.economy;e.previous={income:{...e.income},expense:{...e.expense}};e.income=resourceZero();e.expense=resourceZero();e.day=day(s);e.lastSupplyDay=day(s);e.shortages=[];
 const food=foodDemand(s);if(canPay(s,{food})){pay(s,{food});e.starvation=0;}else{if(s.resources.food>0)pay(s,{food:s.resources.food});e.starvation++;e.shortages.push('口粮不足：工作与修炼效率降低，可采食或购粮');log(s,'口粮供给不足。掌门可亲自采食，或以灵石购粮恢复生活。');}
 for(const b of s.buildings){if(b.enabled===false)continue;const cost=Object.fromEntries(Object.entries(BUILDINGS[b.type].upkeep).map(([k,v])=>[k,v*b.level]));if(canPay(s,cost)){pay(s,cost);b.condition=Math.min(100,b.condition+8);if(s.world?.weather?.id==='wind'&&!s.buildings.some(x=>x.type==='watchtower'&&active(x)))b.condition=Math.max(15,b.condition-3);}else{b.condition=Math.max(15,b.condition-15);e.shortages.push(`${BUILDINGS[b.type].name}维护不足，效率下降`);}}
}
function masterStep(s){
 const m=s.master;if(trip(s)||srBodyBusy(s,m))return;
 if(s.schemaVersion===6&&s.activitiesById[m.activityId]?.kind==='construction')return;
 if(s.schemaVersion===6&&s.activitiesById[m.activityId]?.action==='care')return;
 if(s.schemaVersion===6){
  const action=m.learning&&m.action==='walk'?'study':m.action;
  if(['study','teach','cultivate'].includes(action)||hallInteriorEnabled(s)&&['rest','heal'].includes(action)){
   const facility=lifeFacility(s,m,action,m.learning?.id);
   if(!prepareFacilityActivity(s,m,facility,action)){if(hallInteriorEnabled(s)&&action==='rest'&&(!facility||s.activitiesById[m.activityId]?.phase==='waiting'))m.energy=Math.min(100,m.energy+.3);if(m.learning)m.learning.waitingForArrival=true;return;}
   if(m.learning){m.learning.waitingForArrival=false;m.action='study';}
  }else releaseBodyActivity(s,m);
 }
 const clinic=localLifeFacility(s,m,['clinic']);
 if(m.action==='walk'&&m.scenic?.path.length){advanceScenic(m.scenic,46,s);syncScenicPosition(s,m);if(!m.scenic.path.length)m.action='rest';return;}
 if(m.action==='walk'){const next=m.path.shift();if(next&&!at(s,next.x,next.y))m.position=next;else m.path=[];if(!m.path.length)m.action='rest';return;}
 if(m.action==='heal'){m.wound=Math.max(0,m.wound-(clinic?3:2));m.energy=Math.min(100,m.energy+.5);if(!m.wound){m.action='rest';log(s,'伤势已愈，逃亡并未永久损伤天资。');}return;}
 if(m.action==='rest'){m.energy=Math.min(100,m.energy+restRecovery(s,m));if(m.wound>0)m.wound=Math.max(0,m.wound-.035);return;}
 const lock=lifeActivityLock(s,m);if(lock){m.action='rest';m.path=[];log(s,`掌门${lock}`);return;}
 if(m.energy<=1){m.action='rest';log(s,'掌门精力不足，先暂歇调息，未完学习仍保留。');return;}
 if(m.action==='cultivate'){const facility=hallInteriorEnabled(s)?lifeFacility(s,m,'cultivate'):localLifeFacility(s,m,['meditation','hall']);m.energy=Math.max(0,m.energy-(TECHNIQUES[m.main]?.fatigue||.25));m.xp=Math.min(xpNeed(m.realm),m.xp+cultivationRate(s,m,facility));m.knowledge[m.main]=Math.min(100,(m.knowledge[m.main]||0)+.12);for(const id of m.support)m.knowledge[id]=Math.min(100,(m.knowledge[id]||0)+.025);return;}
 if(m.action==='study'&&m.learning){m.energy=Math.max(0,m.energy-.25);const l=m.learning;l.progress+=m.talent;if(l.progress>=l.total){learnTechnique(s,m,l.id,true);m.action='rest';}return;}
 if(m.action==='teach'){m.energy=Math.max(0,m.energy-.16);const id=m.teaching||m.main;if(m.knowledge[id]>=60)m.knowledge[id]=Math.min(100,m.knowledge[id]+.02);return;}
 if(['wood','stone','herb','food'].includes(m.action)){m.energy=Math.max(0,m.energy-.15);m.work++;if(m.work>=10){m.work=0;const effects=weather(s).production||{},quantity=({wood:12,stone:10,herb:10,food:16}[m.action])*(effects[m.action]??1);if(srEconomy.consumeHarvest(s,m.action,quantity))grant(s,{[m.action]:quantity});else{m.action='rest';log(s,'此处可采来源已经不足；补种、采购或另寻来源后继续。');}}}
}
const hooks={studyLock,compatible,learnTechnique,xpNeed,cultivationRate,buildingYield,onProduction:recordFirstProduction,breakthroughLock,breakthroughPerson,consumePill,capacity,stage,teachers,supportLimit,restRecovery,addDisciple,grant,pay,canPay,rng,day,log};
if(campaign.configureCampaign)campaign.configureCampaign({...hooks,canAccompany:society.canAccompany,campaignOutcome:society.campaignOutcome});
function step(s,{advanceCombat=true}={}){
 if(s.schemaVersion!==6)s.time++;renewMarket(s);supplyStep(s);
 const h=s.buildings.find(b=>b.type==='hall');if(h&&active(h)&&!['opening-v1.2','sr-content-v1.2'].includes(s.contentVersion)){h.progress++;if(h.progress>=BUILDINGS.hall.duration){h.progress-=BUILDINGS.hall.duration;grant(s,buildingYield(s,h));}}
 society.tickSociety(s,1,hooks);campaign.tickCampaign(s,1,hooks,{advanceCombat});masterStep(s);
 if(!s.srEconomy&&s.crafting&&s.buildings.some(b=>b.type==='alchemy'&&active(b))){s.crafting.remaining=Math.max(0,s.crafting.remaining-1);if(s.crafting.remaining===0){const id=s.crafting.recipeId,count=s.crafting.yield;s.pills[id]+=count;s.stats.crafted++;s.crafting=null;log(s,`${RECIPES[id].name}炼成${count}份，已收入府库。`);}}
}
export function tick(s,dt){if(!finite(dt,0,86400)||dt===0||s.speed===0)return;s.sim.carry+=dt*s.speed;while(s.sim.carry+1e-10>=1){s.sim.carry-=1;if(s.sim.carry<0)s.sim.carry=0;step(s);}}
/** Called by the schema-6 owner; does not start another timer or consume carry. */
export function advanceWorldSecond(s,options){step(s,options);}
/** Validate on a copy. No RNG, time advance, new rewards, or repair of malformed v5. */
export function validateSave(input,{canonical=false}={}){
 if(canonical&&input?.contentVersion!=='sr-content-v1.2')throw Error('存档校验失败：canonical校验只能用于明确SR内容版本');
 const fail=message=>{throw Error(`存档校验失败：${message}`);};
 let nodes=0;const stack=new Set();
 function jsonValue(value,depth=0){if(++nodes>1000000||depth>32)fail('数据规模或层级异常');if(value===null||typeof value==='boolean'||typeof value==='string'){if(typeof value==='string'&&value.length>20000)fail('文字字段过长');return;}if(typeof value==='number'){if(!Number.isFinite(value))fail('数值不是有限数');return;}if(typeof value!=='object'||stack.has(value)||![Object.prototype,Array.prototype,null].includes(Object.getPrototypeOf(value)))fail('含不支持的数据类型');stack.add(value);for(const[k,v]of Object.entries(value)){if(['__proto__','prototype','constructor'].includes(k))fail('字段名称异常');jsonValue(v,depth+1);}stack.delete(value);}
 jsonValue(input);if(!input||!integer(input.version,1,5))fail('不支持的版本');
 let s;if(input.version<5){const version=input.version;try{s=legacy.validateSave(structuredClone(input));}catch(error){fail(`旧版数据无效：${error.message}`);}normaliseBase(s,{legacyVersion:version});society.initSociety(s,{legacy:true,migrate:true,legacyRoutes:legacy.EXPEDITIONS});campaign.initCampaign(s,{legacy:true,migrate:true});log(s,`旧版v${version}画卷已续入完整EA。原有资产、人物与已发生结果仍然保留。`);}else s=structuredClone(input);
 const str=(x,min=0,max=500)=>typeof x==='string'&&x.length>=min&&x.length<=max;
 const arr=(x,max=100)=>Array.isArray(x)&&x.length<=max;
 const unique=x=>new Set(x).size===x.length;
 const mapResource=x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===Object.keys(RESOURCES).length&&Object.keys(RESOURCES).every(k=>finite(x[k]));
 if(!finite(s.time)||![0,1,2,4].includes(s.speed)||!mapResource(s.resources))fail('时间、速度或资源异常');
 if(!arr(s.buildings,canonical?512:CELLS.length)||!arr(s.disciples,100)||!integer(s.nextId,1)||!arr(s.logs,100)||!s.logs.every(l=>l&&finite(l.time,0,s.time)&&str(l.text)))fail('建筑、人物或日志容器异常');
 const bIds=new Set(),cells=new Set();
 for(const b of s.buildings){if(!b||!integer(b.id,1)||bIds.has(b.id)||!canonical&&cells.has(key(b.x,b.y))||!own(BUILDINGS,b.type)||!integer(b.level,1,3)||!finite(b.progress,0,BUILDINGS[b.type].duration)||b.progress>=BUILDINGS[b.type].duration||!canonical&&!validCell(b.x,b.y)||!finite(b.condition,0,100)||typeof b.enabled!=='boolean')fail('建筑字段或地块重复');bIds.add(b.id);cells.add(key(b.x,b.y));}
 if(s.buildings.filter(b=>b.type==='hall').length!==1||s.nextId<=Math.max(...bIds)||s.disciples.length>capacity(s))fail('主屋、容量或建筑编号异常');
 for(const[type,t]of Object.entries(BUILDINGS))if(t.unique&&s.buildings.filter(b=>b.type===type).length>1)fail(`唯一建筑重复：${t.name}`);
 if(!s.stats||!['built','breakthroughs','crafted','expeditions','relocated','trades','consumed'].every(k=>integer(s.stats[k])))fail('统计字段异常');
 if(!validateOnboarding(s))fail('开局指引记录异常');
 if(!arr(s.claimed,QUESTS.length)||!unique(s.claimed)||!s.claimed.every(id=>QUESTS.some(q=>q.id===id)))fail('里程碑领取记录异常');
 if(!s.sect||!integer(s.sect.level,1,3)||!finite(s.sect.reputation)||!str(s.sect.name,1,30)||typeof s.sect.founded!=='boolean')fail('山门字段异常');
 if(!s.sim||!integer(s.sim.seed,1,4294967295)||!finite(s.sim.carry,0,1)||s.sim.carry>=1||!finite(s.sim.decision,0,100000))fail('模拟时钟或随机种子异常');
 function checkLearning(p,master=false){
  if(p.main!==null&&(!own(TECHNIQUES,p.main)||TECHNIQUES[p.main].kind!=='main')||master&&p.main===null||!arr(p.support,3)||!unique(p.support)||!p.support.every(id=>TECHNIQUES[id]?.kind==='support')||!p.knowledge||Array.isArray(p.knowledge)||!Object.entries(p.knowledge).every(([id,n])=>own(TECHNIQUES,id)&&finite(n,0,100)))fail('功法与知识字段异常');
  if(p.main&&!finite(p.knowledge[p.main],0,100)||!p.support.every(id=>finite(p.knowledge[id],0,100)))fail('正在修习的功法缺少知识记录');
  if(![p.main,...p.support].filter(Boolean).every(id=>compatible(p,id)))fail('当前功体存在相斥功法');
  if(p.learning!==null){const l=p.learning,t=TECHNIQUES[l?.id];if(!t||!finite(l.progress,0,10000)||l.total!==undefined&&!finite(l.total,1,10000)||l.total!==undefined&&l.progress>=l.total||l.mode!==undefined&&!['learn','deepen','convert'].includes(l.mode))fail('学习进度异常');if(master&&(!finite(l.total,1,10000)||!['learn','deepen','convert'].includes(l.mode)))fail('掌门学习计划异常');}
 }
 const ids=new Set();
 function personBase(p,master=false){if(!p||!str(p.name,1,40)||!integer(p.realm,1,canonical?30:12)||!finite(p.xp,0,xpNeed(p.realm))||!finite(p.talent,.5,3)||!finite(p.energy,0,100))fail('人物基本字段异常');if(p.wound!==undefined&&!finite(p.wound,0,100))fail('人物伤势异常');if(p.breakthroughCooldown!==undefined&&!finite(p.breakthroughCooldown))fail('突破恢复时间异常');if(p.hp!==undefined&&!finite(p.hp,0,10000)||p.maxHp!==undefined&&!finite(p.maxHp,1,10000))fail('人物生命异常');checkLearning(master?p:p.mind,master);}
 for(const d of s.disciples){
  if(!integer(d?.id,1,1000000)||ids.has(d.id)||!str(d.root,1,40)||!str(d.trait,0,80)||!integer(d.portrait,0,3)||!d.mind||d.job!==null&&!bIds.has(d.job))fail('门人身份或工作位置异常');ids.add(d.id);personBase(d);
  const p=d.mind;if(!arr(p.traits,5)||p.traits.length!==5||!p.traits.every(n=>finite(n,0,100))||!str(p.goal,0,100)||!str(p.reason,0,1000)||!str(p.activity,1,40)||!integer(p.lastPillDay,-1)||!finite(p.caution,0,100)||!arr(p.memories,10000)||!p.memories.every(m=>m&&finite(m.time,0,s.time)&&str(m.text,0,1000)))fail('门人意愿或经历异常');
  if(p.scenic===undefined){if(canonical)fail('现代人物缺少实际位置');society.initLifeScenic(s,d);}
 }
 const m=s.master;personBase(m,true);m.sceneIntent??=null;if(!validateSceneIntent(m.sceneIntent))fail('场景互动意图异常');if(!canonical&&m.scenic&&m.scenic.geometry!=='plots-v1')repairScenicState(s);if(!validateScenic(m.scenic,s))fail('山院行走位置或路径异常');
 if(s.schemaVersion===6&&s.personsById)for(const p of Object.values(s.personsById))if(p.personId!=='person:master'&&p.compatibilityMode!=='historical-only'&&!s.disciples.some(d=>d.id===p.id))personBase(p);
 if(!finite(m.wound,0,100)||!finite(m.work,0,10)||m.work>=10||!['rest','heal','cultivate','wood','stone','herb','food','teach','study','walk','travel','combat'].includes(m.action)||!canonical&&!validCell(m.position?.x,m.position?.y)||!arr(m.path,canonical?512:CELLS.length)||!m.path.every(p=>p&&(canonical?Number.isFinite(p.x)&&Number.isFinite(p.y):validCell(p.x,p.y)))||!arr(m.memories,10000)||!m.memories.every(x=>finite(x.time,0,s.time)&&str(x.text,0,1000))||m.teaching!==null&&!own(TECHNIQUES,m.teaching))fail('掌门行动、位置或经历异常');
 if(m.breakthroughHistory!==undefined&&(!arr(m.breakthroughHistory,10000)||!m.breakthroughHistory.every(h=>h&&finite(h.time,0,s.time)&&typeof h.success==='boolean'&&finite(h.chance,.55,.85)&&finite(h.roll,0,1)&&h.roll<1&&h.success===(h.roll<h.chance)&&integer(h.fromRealm,1,canonical?29:11)&&h.toRealm===h.fromRealm+(h.success?1:0)&&finite(h.lostXp)&&h.injury===(h.success?0:12)&&h.cooldownUntil===h.time+(h.success?15:60)&&h.energyCost===25&&h.cost&&Object.entries(h.cost).every(([k,v])=>own(RESOURCES,k)&&finite(v))&&h.pillCost&&Object.keys(h.pillCost).every(k=>k==='foundation'&&h.pillCost[k]===1))))fail('提前冲关历史异常');
 if(m.action==='study'&&!m.learning)fail('学习行动缺少计划');if(m.action==='walk'&&!m.path.length&&!m.scenic?.path.length&&!(canonical&&(s.srWorld?.interaction||s.srWorld?.activeTravelId||s.activitiesById?.[m.activityId])))fail('行走行动缺少路线');
 let prev=m.position;for(const p of m.path){if(!canonical&&Math.abs(p.x-prev.x)+Math.abs(p.y-prev.y)!==1)fail('掌门路线不连通');prev=p;}
 if(!s.pills||!Object.keys(RECIPES).every(id=>integer(s.pills[id]))||Object.keys(s.pills).some(id=>!own(RECIPES,id)))fail('丹药库存异常');
 if(s.crafting!==null){const c=s.crafting,r=RECIPES[c?.recipeId];if(!r||!s.buildings.some(b=>b.type==='alchemy')||!finite(c.total,1,Math.max(r.duration,legacy.RECIPES[c.recipeId]?.duration||0))||!finite(c.remaining,0,c.total)||!integer(c.yield,1,r.yield))fail('炼丹队列异常');}
 const a=s.doctrine;
 if(!a||!arr(a.books,12)||!unique(a.books)||!a.books.includes('qingyuan')||!a.books.every(id=>own(TECHNIQUES,id))||!arr(a.sealed,12)||!unique(a.sealed)||!a.sealed.every(id=>a.books.includes(id)&&id!=='qingyuan')||!['balanced',...Object.keys(RESOURCES)].includes(a.workFocus)||!['shared','permission'].includes(a.pillRule)||!arr(a.routes,20)||!unique(a.routes)||!a.routes.every(id=>own(ROUTES,id)||campaign.REGIONS&&own(campaign.REGIONS,id)))fail('传承接触或院规异常');
 const c=s.community;if(!c||c.day!==day(s)||!integer(c.completed)||!arr(c.fulfilled,3)||!unique(c.fulfilled)||!c.fulfilled.every(id=>commissions(s).some(q=>q.id===id))||c.completed<c.fulfilled.length||!c.trades||!Object.keys(GOODS).every(k=>integer(c.trades[k],0,8)))fail('市集日期、委托或额度异常');
 const e=s.economy;if(!e||e.day!==day(s)||e.lastSupplyDay!==day(s)||!mapResource(e.income)||!mapResource(e.expense)||!e.previous||!mapResource(e.previous.income)||!mapResource(e.previous.expense)||!integer(e.starvation)||!arr(e.shortages,canonical?513:CELLS.length+1)||!e.shortages.every(x=>str(x,0,200)))fail('供给与收支记录异常');
 if(s.migration!==undefined&&(!integer(s.migration.from,1,4)||!finite(s.migration.time,0,s.time)||!arr(s.migration.preserved,20)||!s.migration.preserved.every(x=>str(x,0,30))))fail('迁移记录异常');
 try{if(society.validateSociety(s,{canonical})===false)fail('社会状态异常');if(campaign.validateCampaign(s)===false)fail('剧情或世界状态异常');if(!s.story.narrative)initNarrative(s,{legacy:true});if(validateNarrative(s)===false)fail('剧情阅读状态异常');}catch(error){if(error.message.startsWith('存档校验失败：'))throw error;fail(error.message);}
 return s;
}

export function setPolicy(s,key,value){return society.setSocietyPolicy(s,key,value);}
export function expeditionLock(s,id){if(!ROUTES[id])return '路线不存在。';if(!routeDiscovered(s,id))return ROUTES[id].scene==='lake'?'整理遗卷、查明山外旧路后开放':'先赠药结缘，熟悉山外道路';return '';}
export function offerRoute(s,id){if(!ROUTES[id])throw Error('路线不存在。');const i=s.doctrine.routes.indexOf(id);if(i<0){const lock=expeditionLock(s,id);if(lock)throw Error(lock);s.doctrine.routes.push(id);}else s.doctrine.routes.splice(i,1);log(s,`${ROUTES[id].name}${i<0?'列为可接差事':'撤下差事'}，门人自行决定是否前往。`);}
export function upgradeSect(s,name){return society.foundSect(s,name);}
