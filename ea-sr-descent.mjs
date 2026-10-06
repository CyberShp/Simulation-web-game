/** SR-XF-039-AC-03. Immortal NPC descent, never player ascension or ordinary otherworld travel.
 * U-22/U-23/U-63/U-94; names, costs and windows below are author R/T defaults.
 * One persistent upper body, a separate finite avatar body, real lower positions and world ticks.
 */
import {RESOURCES} from './ea-data.mjs?v=ea-160-dev-release-20261006-r1';
import {makeWorldPerson,avatarObservationPlanSR,recordFactSR,publishFactSR,WORLD_SCENES} from './ea-sr-world.mjs?v=ea-160-dev-release-20261006-r1';
import {recordPermanentDeathSR} from './ea-sr-crises.mjs?v=ea-160-dev-release-20261006-r1';
import {requirePerson,isLivingPerson,reserveBody,ownedActivity,releaseSRBody,spendResources,resourceSource} from './ea-sr-equipment.mjs?v=ea-160-dev-release-20261006-r1';

const MASTER='person:master',ENVOY='person:immortal:yunhe-envoy';
const ORIGIN='scene:immortal-origin',SITE='scene:immortal-descent-outpost';
const LINK='route:immortal-descent-link',ANCHOR='object:descent:anchor',RIFT='object:descent:rift';
const LANDING=Object.freeze({x:28.3,y:24}),UPPER_POSITION=Object.freeze({x:9.3,y:27});
const terminal=new Set(['returned','cancelled','destroyed','dead']);
const zero=()=>Object.fromEntries(Object.keys(RESOURCES).map(k=>[k,0]));
const zeroPills=()=>({qi:0,spirit:0,heal:0,foundation:0});
const copy=v=>structuredClone(v),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function deepFreeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(deepFreeze);Object.freeze(v);}return v;}
export const DESCENT_MODES=deepFreeze({
 avatar:{name:'上界实体化身',minRealm:13,arrayUnderstanding:40,cost:{jade:80,crystal:12,herb:8},upperCost:{crystal:6,herb:10},returnCost:{crystal:4},channelTicks:160,transitTicks:80,transitWaitTicks:120,stayTicks:600,returnTicks:80,effectiveRealm:13,hp:80,upperEnergy:20,missionCrystal:3,wardPower:3},
 original:{name:'上界本尊真身',minRealm:22,arrayUnderstanding:65,cost:{jade:200,crystal:25,herb:20},upperCost:{crystal:10,herb:12},returnCost:{jade:50,crystal:10},channelTicks:240,transitTicks:120,transitWaitTicks:120,stayTicks:500,returnTicks:120,effectiveRealm:16,hp:120,upperEnergy:35,missionCrystal:5,wardPower:6}
});
export const DESCENT_FEEDBACK=deepFreeze({delayTicks:30,wound:15,energy:10,xpLossFraction:.1,cooldownTicks:600});
export const DESCENT_REPAIR=deepFreeze({cost:{stone:12,crystal:6,jade:20},durationTicks:120,reopenedWindowTicks:240,maximumReopens:1});

function newPerson(s,id,name,sceneId,realm){
 const p=makeWorldPerson(s,id,name,sceneId,realm);
 p.activityId=null;p.job=null;p.role=null;p.journey=null;p.mind.away=null;p.mind.learning=null;p.mind.activity='rest';
 p.beliefs={};p.knownFacts=[];p.mind.relationships={master:{trust:50,familiarity:0,tension:0},peers:{}};
 p.appearance={spriteIndex:id===ENVOY?4:5,accent:id===ENVOY?'#cad3ed':'#88cbbb',recipe:{id:`appearance:${id}:v1`,body:'slim',face:'angular',hair:'half-tied',outfit:'traveller',height:1.8,faceMark:2}};
 p.lifeHistory={originTick:s.worldTick,knownAgeYears:null,observedTicks:0,extensionYears:0,extensionUsed:false,exhaustionNotified:false};
 return p;
}
export function initDescentSR(s){
 if(!s.srWorld||!WORLD_SCENES[ORIGIN]||!WORLD_SCENES[SITE])throw Error('仙界与下界接引台必须先注册独立实际场景。');
 if(s.srDescent)return s;
 s.srDescent={version:1,lastTick:s.worldTick,nextId:1,records:{},cooldownUntilTick:s.worldTick,repairOrder:null,
  originAnchor:{sceneId:ORIGIN,x:12,y:27,condition:1},lowerAnchor:{sceneId:SITE,x:32,y:24,condition:1},
  rift:{status:'dormant',initialPressure:36,pressure:36,activatedTick:null,deadlineTick:null,lastDamageTick:s.worldTick}};
 s.routesById[LINK]??={id:LINK,a:ORIGIN,b:SITE,condition:'open',transport:'immortal-descent',playerTraversable:false,sourceStatus:'U-63/R-T-author-default'};
 const p=newPerson(s,ENVOY,'云和使者',ORIGIN,30);
 p.position={kind:'scene',sceneId:ORIGIN,...UPPER_POSITION};p.visibility='upper-contact';p.publicRole='仙界云和堂接引使';
 p.ascensionState={alreadyAscended:true,originWorldId:'world:immortal',source:'author-fixed-NPC; player ascension remains disabled',immortalStage:'仙界修士',lowerRealmCompatibilityOnly:true};
 p.mind.knowledge={qingyuan:100,array:80};p.mind.main='qingyuan';p.mind.support=['array'];
 p.artsById={qingyuan:{artId:'qingyuan',understanding:100,mastery:80},array:{artId:'array',understanding:80,mastery:75}};
 p.wound=0;p.energy=100;p.hp=120;p.maxHp=120;
 p.descentConsent={purpose:'只维护已核实的接引台界隙；不为地方私仇出手',avatarAllowed:true,originalAllowed:true};
 if(p.lifeHistory)p.lifeHistory.knownAgeYears=null;
 const id='stockpile:immortal:yunhe-reserve';
 s.stockpilesById[id]={id,ownerId:ENVOY,custodianId:ENVOY,access:'private',position:{sceneId:ORIGIN,...UPPER_POSITION},capacity:240,resources:{...zero(),crystal:40,herb:50},pills:zeroPills(),source:'固定上界使者的有限接引储备；不随读取/重载补货'};
 recordFactSR(s,'fact:author:immortal-descent',{kind:'author-world-card',public:false,personId:ENVOY,sceneId:ORIGIN,text:'真正仙界来客与普通独立异界分离；只接受有限接引台维护；不追加沈氏旧案责任人',sourceStatus:'U-22/U-23/U-63/R-T',originWorldId:'world:immortal'});
 return s;
}
function rectNear(p,o,radius=2.6){return Math.hypot(Math.max(0,Math.abs(p.x-o.x)-o.width/2),Math.max(0,Math.abs(p.y-o.y)-o.height/2))<=radius;}
function atAnchor(s,p=s.master){const o=WORLD_SCENES[SITE]?.objects.find(o=>o.id===ANCHOR);return p?.position?.kind==='scene'&&p.position.sceneId===SITE&&o&&rectNear(p.position,o);}
function nearActor(s,r,radius=6){const p=s.personsById[r.actorPersonId],a=s.master.position,b=p?.position;return a?.kind==='scene'&&b?.kind==='scene'&&a.sceneId===b.sceneId&&distance(a,b)<=radius;}
function bodyOwned(s,p,r){return ownedActivity(s,p)?.orderId===r.id;}
function releaseOwned(s,p,r){if(bodyOwned(s,p,r))releaseSRBody(s,p);}
function activeRecords(s){return Object.values(s.srDescent.records).filter(r=>!terminal.has(r.phase));}
function requestLock(s,mode){
 const d=DESCENT_MODES[mode],p=s.master;
 if(!d)return '降临方式无效。';
 if(!s.story.completed)return '仙界接引只在余烬立山收束后开放，前期不依赖上界救兵。';
 if(p.realm<d.minRealm)return '此方式需下界接引者境界达到'+d.minRealm+'。';
 if((p.artsById?.array?.understanding??p.knowledge?.array??0)<d.arrayUnderstanding)return '接引阵术理解需'+d.arrayUnderstanding+'。';
 if(!atAnchor(s))return '须亲自到独立下界前哨的接引台旁。';
 if(p.wound>0||p.energy<35)return '接引者须养好伤势且精力35。';
 if(s.combat?.status==='active'||s.srWorld.activeTravelId||s.srWorld.interaction||p.activityId&&s.activitiesById[p.activityId])return '先完成现有身体活动、旅行或战斗。';
 if(activeRecords(s).length||s.srDescent.repairOrder)return '已有真实降临或返程，不能复制同一上界本体。';
 if(s.srDescent.cooldownUntilTick>s.worldTick)return '上界联系人仍在履约后的恢复期。';
 if(s.srDescent.lowerAnchor.condition<=0||s.srDescent.originAnchor.condition<=0||s.routesById[LINK]?.condition!=='open')return '实际接引锚点损坏，不能开启新降临。';
 if(s.srDescent.rift.status==='stabilized')return '本地界隙已经稳定，上界联系人没有重复出手的实际目标。';
 return null;
}
function senderConsent(s,mode){
 const p=s.personsById[ENVOY],d=DESCENT_MODES[mode],stock=s.stockpilesById['stockpile:immortal:yunhe-reserve'];
 return isLivingPerson(p)&&p.position?.kind==='scene'&&p.position.sceneId===ORIGIN&&!p.activityId&&p.wound===0&&p.hp>=p.maxHp*.45&&p.energy>=d.upperEnergy&&p.descentConsent?.[mode+'Allowed']===true&&Object.entries(d.upperCost).every(([k,n])=>stock.resources[k]>=n);
}
function combinedCost(a,b){const c={...a};for(const[k,n]of Object.entries(b))c[k]=(c[k]||0)+n;return c;}
function observe(s,r){
 const p=s.personsById[r.actorPersonId];
 const bodyVisible=nearActor(s,r,9),gateVisible=atAnchor(s)&&['channeling','descending','returning','returned','cancelled'].includes(r.phase);
 if(r.lastObservation&&!bodyVisible&&!gateVisible)return copy(r.lastObservation);
 r.lastObservation={id:r.id,mode:r.mode,phase:r.phase,reason:r.reason,progressTicks:r.progressTicks,durationTicks:r.durationTicks,deadlineTick:r.deadlineTick??null,observedTick:s.worldTick,
  actorName:p?.name||'等待上界自愿答复',position:bodyVisible?copy(p.position):null,hp:bodyVisible?p.hp:null,effectiveRealm:DESCENT_MODES[r.mode].effectiveRealm,aidPhase:bodyVisible?r.aid?.phase??null:null,feedbackApplied:!!r.feedbackApplied};
 return copy(r.lastObservation);
}
export function requestDescent(s,mode='avatar',informed=false){
 if(informed!==true)throw Error('须先知情：接引/上界供给/返程分开计费，力量受限；化身损毁伤及本体，本尊死亡为永久身死。');
 initDescentSR(s);const lock=requestLock(s,mode);if(lock)throw Error(lock);
 if(!senderConsent(s,mode))return {accepted:false,reason:'上界联系人没有接受此时的有限维护委托；不能强拖、刷新或越权索取。'};
 const d=DESCENT_MODES[mode],caller=requirePerson(s),sender=requirePerson(s,ENVOY);
 const sourceStockpileId=spendResources(s,combinedCost(d.cost,d.returnCost));
 const upper=s.stockpilesById['stockpile:immortal:yunhe-reserve'];for(const[k,n]of Object.entries(d.upperCost))upper.resources[k]-=n;
 const id=`descent:${s.srDescent.nextId++}`,r={id,mode,providerPersonId:ENVOY,callerPersonId:MASTER,actorPersonId:null,phase:'channeling',startedTick:s.worldTick,progressTicks:0,durationTicks:d.channelTicks,
  cost:copy(d.cost),upperCost:copy(d.upperCost),sourceStockpileId,upperSourceStockpileId:upper.id,launchCommitted:false,returnAllocation:{cost:copy(d.returnCost),phase:'reserved'},feedbackApplied:false,
  effectiveRealm:d.effectiveRealm,returnReopens:0,reason:'双方知情自愿预留供给；掌门实际维持接引，上界使者占用自身身体准备。'};
 s.srDescent.records[id]=r;reserveBody(s,caller,'descent',id);reserveBody(s,sender,'descent',id);
 sender.mind.reason='我自愿维护独立接引台界隙，不接受地方复仇或远方救援号令。';
 if(s.srDescent.rift.status==='dormant'){s.srDescent.rift.status='unstable';s.srDescent.rift.activatedTick=s.worldTick;s.srDescent.rift.deadlineTick=s.worldTick+900;}
 observe(s,r);return {accepted:true,pending:true,descentId:id,reason:r.reason};
}
function refundAtAnchor(s,r,cost,reason){
 if(!Object.values(cost).some(n=>n>0))return null;
 const id=`stockpile:descent-recovery:${r.id}`;
 const st=s.stockpilesById[id]??={id,ownerId:MASTER,custodianId:MASTER,access:'private',position:{sceneId:SITE,...LANDING},capacity:400,resources:zero(),pills:zeroPills(),source:reason};
 for(const[k,n]of Object.entries(cost))st.resources[k]+=n;r.recoveryStockpileId=id;return id;
}
function refundReturn(s,r){if(r.returnAllocation.phase!=='reserved')return;r.returnAllocation.refundStockpileId=refundAtAnchor(s,r,r.returnAllocation.cost,'未用于跨界返程的实物仍在下界接引台，需亲自收取');r.returnAllocation.phase='refunded';}
function cancel(s,r){
 if(r.phase!=='channeling')throw Error('接引已发生，不能以取消抹去跨界成本；实际返回需返程。');
 const used=r.progressTicks/DESCENT_MODES[r.mode].channelTicks,refund={};
 for(const[k,n]of Object.entries(r.cost))refund[k]=n*(1-used);
 refundAtAnchor(s,r,refund,'接引未工作部分留在实际接引台，已发生准备成本不退');
 for(const[k,n]of Object.entries(r.upperCost))s.stockpilesById[r.upperSourceStockpileId].resources[k]+=n*(1-used);
 r.launchConsumedFraction=used;refundReturn(s,r);r.phase='cancelled';r.reason='双方中止接引；已做准备按实际比例消耗，未用材料留在各自原界。';r.completedTick=s.worldTick;
 releaseOwned(s,s.master,r);releaseOwned(s,s.personsById[ENVOY],r);observe(s,r);return {accepted:true,refundedFraction:1-used,reason:r.reason};
}
function actorBody(s,r,kind){const p=s.personsById[r.actorPersonId];releaseOwned(s,p,r);const a=reserveBody(s,p,kind,r.id);if(kind==='travel')a.kind='sr-travel';return a;}
function startTransit(s,r,returning=false){
 const d=DESCENT_MODES[r.mode],id=`travel:descent:${r.id}:${returning?'return':'outbound'}`,p=s.personsById[r.actorPersonId];
 s.travelsById[id]={id,from:returning?SITE:ORIGIN,destination:returning?ORIGIN:SITE,routeId:LINK,routeIds:[LINK],durationTicks:returning?d.returnTicks:d.transitTicks,progressTicks:0,startedTick:s.worldTick,status:'traveling',participantIds:[p.personId],descentId:r.id};
 r.travelId=id;r.progressTicks=0;r.durationTicks=s.travelsById[id].durationTicks;r.phase=returning?'returning':'descending';
 r.travelDeadlineTick=returning?r.deadlineTick:s.worldTick+d.transitTicks+d.transitWaitTicks;
 actorBody(s,r,'travel');p.position={kind:'worldTravel',travelId:id};r.reason=returning?'实物返程预算已消耗，身体通过有限界门实际返回。':'来客身体正在跨界，未到下界不能行动或救人。';
}
function launch(s,r){
 const d=DESCENT_MODES[r.mode],origin=s.personsById[ENVOY];
 if(!isLivingPerson(origin)||!bodyOwned(s,origin,r)){r.reason='上界使者自身活动中断，接引停止，须取消取回未用材料。';return;}
 origin.energy=Math.max(0,origin.energy-d.upperEnergy);r.launchCommitted=true;r.launchConsumedFraction=1;
 if(r.mode==='avatar'){
  const p=newPerson(s,`person:immortal:avatar:${r.id}`,'云和使者·实体化身',ORIGIN,d.effectiveRealm);
  p.originPersonId=ENVOY;p.descentId=r.id;p.bodyKind='immortal-descent-avatar';p.hp=d.hp;p.maxHp=d.hp;p.energy=80;p.wound=0;
  p.mind.knowledge={qingyuan:80,array:70};p.mind.main='qingyuan';p.mind.support=['array'];p.artsById={qingyuan:{artId:'qingyuan',understanding:80,mastery:60},array:{artId:'array',understanding:70,mastery:60}};
  r.actorPersonId=p.personId;
 }else{r.actorPersonId=ENVOY;origin.maxHp=d.hp;}
 s.personsById[r.actorPersonId].descentId=r.id;
 releaseOwned(s,s.master,r);startTransit(s,r);observe(s,r);
}
function walkPath(p,path){let remaining=.2;while(path.length&&remaining>0){const n=path[0],d=distance(p.position,n);if(d<=remaining){p.position.x=n.x;p.position.y=n.y;path.shift();remaining-=d;}else{p.position.x+=(n.x-p.position.x)*remaining/d;p.position.y+=(n.y-p.position.y)*remaining/d;remaining=0;}}}
function planAnchorReturn(s,r,automatic=false){
 const p=s.personsById[r.actorPersonId],d=DESCENT_MODES[r.mode];
 if(!p||p.position?.kind!=='scene'||p.position.sceneId!==SITE)throw Error('来客须在自己的实际下界场景，不能跨地图无时返程。');
 const plan=avatarObservationPlanSR(s,SITE,p.position,ANCHOR);
 r.aid&&(r.aid.phase='interrupted');r.path=plan.path;r.phase='to-anchor';r.progressTicks=0;r.durationTicks=Math.max(1,Math.ceil(r.path.length*.5/.2));
 r.reason=automatic?'来客按预先自愿约定赶往接引台，有限窗口将关闭。':'来客接受实际返回请求，先走回接引台再耗用返程材料。';
 actorBody(s,r,'descent');p.mind.reason=r.reason;
 return {accepted:true,pending:true,reason:r.reason,returnTicks:d.returnTicks};
}
export function returnDescent(s,id,informed=false){
 const r=s.srDescent?.records[id];if(!r||!['present','aiding','stranded'].includes(r.phase))throw Error('没有在下界可请求返程的活着来客。');
 if(informed!==true)throw Error('须知情消耗固定返程预算并实际回接引台，不能瞬移返乡。');
 if(!nearActor(s,r))throw Error('掌门须实际走近来客传达返程请求；不提供异地控制或救援。');
 if(r.phase==='stranded')throw Error('当前界门窗口已关闭，先实际付费重开一次返程窗口。');
 return planAnchorReturn(s,r);
}
function kill(s,r,cause){
 if(terminal.has(r.phase))return;const p=s.personsById[r.actorPersonId];
 const fact=recordPermanentDeathSR(s,p.personId,{cause,sceneId:p.position.sceneId});r.deathFactId=fact.id;
 const t=s.travelsById[r.travelId];if(t?.status==='traveling')t.status='interrupted';
 r.phase=r.mode==='avatar'?'destroyed':'dead';r.reason=r.mode==='avatar'?'实体化身已在下界损毁，本体仍在仙界，固定神魂损耗将回传。':'本尊在下界永久身死；其身份、原有知识与死亡记录保留，不重新派生同一人。';
 r.completedTick=s.worldTick;refundReturn(s,r);
 if(r.mode==='avatar')r.feedbackAtTick=s.worldTick+DESCENT_FEEDBACK.delayTicks;
 else{s.srDescent.cooldownUntilTick=s.worldTick+DESCENT_FEEDBACK.cooldownTicks;releaseOwned(s,p,r);}
 if(nearActor(s,r,9)){publishFactSR(s,fact.id);observe(s,r);}
}
function localHazards(s,r){
 const p=s.personsById[r.actorPersonId];if(!isLivingPerson(p)||p.position?.kind!=='scene'||p.position.sceneId!==SITE)return;
 r.hazardClaims??={};
 for(const t of Object.values(s.srCrises?.traps||{})){
  if(t.status!=='armed'||t.sceneId!==SITE||distance(p.position,t)>2.6||r.hazardClaims[t.id])continue;
  r.hazardClaims[t.id]=s.worldTick;t.status='triggered';t.personId=p.personId;p.hp=Math.max(0,p.hp-60);
  if(p.hp===0){kill(s,r,'下界现场实体机关造成致命损伤');return;}
 }
 const o=WORLD_SCENES[SITE].objects.find(o=>o.id===RIFT);
 if(s.srDescent.rift.status==='unstable'&&o&&distance(p.position,o)<8&&s.worldTick%10===0){p.hp=Math.max(0,p.hp-4);p.energy=Math.max(0,p.energy-.3);if(p.hp===0)kill(s,r,'下界持续界隙汐压造成不可逆死亡');}
}
function aid(s,r,informed){
 if(informed!==true)throw Error('须知情：来客自行判断是否冒险；稳定界隙耗实际3/5晶、120步，期间承受现场汐压。');
 if(r.phase!=='present'||!nearActor(s,r))throw Error('先实际走近在场且有空的来客，再提供当地维护机会。');
 const p=s.personsById[r.actorPersonId],d=DESCENT_MODES[r.mode];
 if(s.srDescent.rift.status!=='unstable')return {accepted:false,reason:'界隙已无维护目标，来客不重复空耗或刷奖励。'};
 const plan=avatarObservationPlanSR(s,SITE,p.position,RIFT),budgetTicks=Math.ceil(plan.path.length*.5/.2)+120+d.returnTicks+100;
 if(p.hp<p.maxHp*.45||p.energy<20||r.deadlineTick-s.worldTick<budgetTicks)return {accepted:false,reason:'来客判断伤势、精力或实际返程窗口不足，不愿接受此时的维护机会。'};
 const sourceStockpileId=spendResources(s,{crystal:d.missionCrystal});r.aid={phase:'walking',path:plan.path,progressTicks:0,durationTicks:120,sourceStockpileId,cost:{crystal:d.missionCrystal},effectiveRealm:d.effectiveRealm};
 r.phase='aiding';r.reason='来客自愿沿真实路径赴界隙，限定力量只在现场逐步稳定汐压。';return {accepted:true,pending:true,reason:r.reason};
}
function repair(s,r,informed){
 if(informed!==true)throw Error('重开界门耗固定材料与120步，只给一次240步实际返程窗口。');
 if(!r||r.mode!=='original'||r.phase!=='stranded'||!isLivingPerson(s.personsById[r.actorPersonId]))throw Error('只能为仍活着且滞留下界的本尊重开界门；不复活已死来客。');
 if(r.returnReopens>=DESCENT_REPAIR.maximumReopens)throw Error('这一真身的紧急界门已重开过，不能无限延续。');
 if(!atAnchor(s)||s.master.activityId&&s.activitiesById[s.master.activityId]||s.srDescent.repairOrder)throw Error('须本人到实际接引台，且有空布置返程媒介。');
 const replacementReturn=r.returnAllocation.phase==='consumed',cost=replacementReturn?combinedCost(DESCENT_REPAIR.cost,DESCENT_MODES[r.mode].returnCost):DESCENT_REPAIR.cost;
 const sourceStockpileId=spendResources(s,cost),id=`descent-repair:${r.id}`;
 s.srDescent.repairOrder={id,descentId:r.id,sourceStockpileId,cost:copy(cost),replacementReturn,progressTicks:0,durationTicks:DESCENT_REPAIR.durationTicks};reserveBody(s,s.master,'descent',id);
 return {accepted:true,pending:true,reason:'掌门实地修复有限界门；尚未完成不能返回或倒转死亡。'};
}
function recover(s,r){
 const st=s.stockpilesById[r?.recoveryStockpileId],p=s.master.position;
 if(!st||p?.kind!=='scene'||p.sceneId!==SITE||distance(p,st.position)>2.6)throw Error('须亲自走到接引台遗留箱旁收回未用物资。');
 const target=resourceSource(s),sum=Object.values(st.resources).reduce((a,b)=>a+b,0),capacity=s.stockpilesById[target.id]?.capacity??400;
 if(!sum)return {recovered:false,reason:'此箱已空，不重复退款。'};
 if(Object.values(target.resources).reduce((a,b)=>a+b,0)+sum>capacity)throw Error('实际随行物资箱容量不足，先腾出空间。');
 for(const[k,n]of Object.entries(st.resources)){target.resources[k]+=n;st.resources[k]=0;}
 recordFactSR(s,`fact:descent-recovery:${r.id}`,{kind:'inventory-transaction',actorId:MASTER,sourceStockpileId:st.id,targetStockpileId:target.id,quantity:sum,text:'本人在接引台收回同一箱实际未用材料，不生成第二笔退款'});
 return {recovered:true,quantity:sum};
}
export function descentCommand(s,payload={}){
 const r=s.srDescent?.records[payload.descentId];
 switch(payload.action){case'request':return requestDescent(s,payload.mode,payload.informed);case'return':return returnDescent(s,payload.descentId,payload.informed);case'cancel':if(!r)throw Error('降临记录不存在。');return cancel(s,r);case'aid':if(!r)throw Error('降临记录不存在。');return aid(s,r,payload.informed);case'repair':return repair(s,r,payload.informed);case'recover':return recover(s,r);case'observe':if(!r||!nearActor(s,r,9)&&!atAnchor(s))throw Error('须实际到场观察，不能读取远方来客坐标或生死。');return observe(s,r);default:throw Error('未知仙界接引行动。');}
}
function expire(s,r){
 if(r.mode==='avatar'){const p=s.personsById[r.actorPersonId];p.hp=0;kill(s,r,'接引有限时限届满且化身未实际返回，魂系断裂');}
 else{r.phase='stranded';r.reason='真身错过有限界门，仍实际滞留下界并承受风险；须一次实地付费重开，不会免费传回。';}
}
function step(s){
 const ds=s.srDescent,rift=ds.rift;
 if(rift.status==='unstable'&&s.worldTick>=rift.deadlineTick){ds.lowerAnchor.condition=0;s.routesById[LINK].condition='blocked';}
 const repairOrder=ds.repairOrder;
 if(repairOrder){const r=ds.records[repairOrder.descentId];if(r?.phase==='dead'){releaseOwned(s,s.master,repairOrder);ds.repairOrder=null;}
  else if(atAnchor(s)&&bodyOwned(s,s.master,repairOrder)&&s.master.wound===0&&s.master.energy>=1){repairOrder.progressTicks++;s.master.energy-=.02;if(repairOrder.progressTicks===repairOrder.durationTicks){ds.lowerAnchor.condition=1;s.routesById[LINK].condition='open';r.returnReopens++;r.deadlineTick=s.worldTick+DESCENT_REPAIR.reopenedWindowTicks;r.windowReopenedTick=s.worldTick;rift.status='contained';if(repairOrder.replacementReturn)r.returnAllocation={cost:copy(DESCENT_MODES[r.mode].returnCost),phase:'reserved'};delete r.returnInterrupted;releaseOwned(s,s.master,repairOrder);ds.repairOrder=null;planAnchorReturn(s,r,true);}}}
 for(const r of Object.values(ds.records)){
  const d=DESCENT_MODES[r.mode],origin=s.personsById[ENVOY];
  if(r.phase==='destroyed'&&!r.feedbackApplied&&r.feedbackAtTick<=s.worldTick){const xpLoss=origin.xp*DESCENT_FEEDBACK.xpLossFraction;origin.xp-=xpLoss;origin.wound=Math.min(100,origin.wound+DESCENT_FEEDBACK.wound);origin.energy=Math.max(0,origin.energy-DESCENT_FEEDBACK.energy);r.feedbackApplied=true;r.feedback={xpLoss,wound:DESCENT_FEEDBACK.wound,energy:DESCENT_FEEDBACK.energy,appliedTick:s.worldTick};releaseOwned(s,origin,r);ds.cooldownUntilTick=s.worldTick+DESCENT_FEEDBACK.cooldownTicks;}
  if(terminal.has(r.phase))continue;
  if(r.phase==='channeling'){
   if(!atAnchor(s)||!bodyOwned(s,s.master,r)||s.master.wound>0||s.master.energy<1||!bodyOwned(s,origin,r)){r.reason='接引者或上界使者真实离场/身体中断，准备等待，可取消未做部分。';continue;}
   r.progressTicks++;s.master.energy=Math.max(0,s.master.energy-.02);if(r.progressTicks>=d.channelTicks)launch(s,r);
  }else if(r.phase==='descending'||r.phase==='returning'){
   const t=s.travelsById[r.travelId];if(!r.returnInterrupted&&!r.outboundInterrupted&&(ds.lowerAnchor.condition<=0||ds.originAnchor.condition<=0||s.routesById[LINK].condition!=='open')){r.reason='真实界门受损，在途身体暂停，不瞬移完成。';if(s.worldTick>=r.travelDeadlineTick){const returning=r.phase==='returning';r[returning?'returnInterrupted':'outboundInterrupted']=true;r.interruptedTravel=copy(t);t.destination=returning?SITE:ORIGIN;t.durationTicks=Math.max(1,t.progressTicks);t.progressTicks=0;r.progressTicks=0;r.durationTicks=t.durationTicks;r.reason=returning?'返程界门失效，按已经走过的跨界路程实际退回下界，费用保留。':'入境界门超过固定等待窗口，来客按已行跨界路程实际退回仙界，接引成本保留。';}continue;}
   t.progressTicks++;r.progressTicks=t.progressTicks;
   if(t.progressTicks===t.durationTicks){const p=s.personsById[r.actorPersonId];if(r.phase==='descending'&&r.outboundInterrupted){p.position={kind:'scene',sceneId:ORIGIN,...UPPER_POSITION};t.status='interrupted';t.completedTick=s.worldTick;r.phase='cancelled';r.transitAborted=true;r.completedTick=s.worldTick;r.reason='入境失败的身体已按实际行程退回仙界；接引与上界准备消耗保留，未用返程材料仍在下界箱中。';refundReturn(s,r);releaseOwned(s,p,r);releaseOwned(s,origin,r);delete origin.descentId;ds.cooldownUntilTick=s.worldTick+DESCENT_FEEDBACK.cooldownTicks;}else if(r.phase==='returning'&&r.returnInterrupted){p.position={kind:'scene',sceneId:SITE,...LANDING};t.status='interrupted';t.completedTick=s.worldTick;actorBody(s,r,'descent');expire(s,r);}else if(r.phase==='returning'){p.position={kind:'scene',sceneId:ORIGIN,...UPPER_POSITION};t.status='arrived';t.completedTick=s.worldTick;r.phase='returned';r.completedTick=s.worldTick;r.reason='来客身体已实际返回仙界；接引、施术和返程消耗都保留。';releaseOwned(s,p,r);releaseOwned(s,origin,r);delete origin.descentId;ds.cooldownUntilTick=s.worldTick+DESCENT_FEEDBACK.cooldownTicks;}else{p.position={kind:'scene',sceneId:SITE,...LANDING};t.status='arrived';t.completedTick=s.worldTick;r.phase='present';r.arrivedTick=s.worldTick;r.deadlineTick=s.worldTick+d.stayTicks;r.progressTicks=0;r.durationTicks=d.stayTicks;r.reason='实体来客已在接引台旁，受固定力量和停留窗口限制，仅自愿接受现场界隙维护。';actorBody(s,r,'descent');}}
  }else{
   localHazards(s,r);if(terminal.has(r.phase))continue;
   if(!isLivingPerson(s.personsById[r.actorPersonId])){kill(s,r,'已有共同死亡事实使降临终止');continue;}
   if(r.phase!=='stranded'&&s.worldTick>=r.deadlineTick){expire(s,r);continue;}
   if(r.phase==='aiding'){
    const p=s.personsById[r.actorPersonId],a=r.aid;
    if(a.phase==='walking'){walkPath(p,a.path);if(!a.path.length)a.phase='stabilizing';}
    else if(a.phase==='stabilizing'){a.progressTicks++;p.energy=Math.max(0,p.energy-.03);if(a.progressTicks%10===0){rift.pressure=Math.max(0,rift.pressure-d.wardPower);if(rift.pressure===0)rift.status='contained';}if(a.progressTicks===a.durationTicks&&rift.pressure===0){a.phase='completed';rift.status='stabilized';rift.completedTick=s.worldTick;ds.lowerAnchor.condition=1;s.routesById[LINK].condition='open';recordFactSR(s,`fact:descent-aid:${r.id}`,{kind:'descent-aid',personId:p.personId,sceneId:SITE,effectiveRealm:d.effectiveRealm,cost:copy(a.cost),text:'来客以受限力量在真实界隙完成120步维护；不产生远方救援或复仇战果'});r.phase='present';r.reason='现场界隙维护已完成，来客按原约定准备返回。';planAnchorReturn(s,r,true);}}
   }else if(r.phase==='to-anchor'){
    const p=s.personsById[r.actorPersonId];walkPath(p,r.path);r.progressTicks=Math.min(r.durationTicks,r.progressTicks+1);
    if(!r.path.length){if(ds.lowerAnchor.condition>0&&s.routesById[LINK].condition==='open'){r.returnAllocation.phase='consumed';r.returnAllocation.consumedTick=s.worldTick;r.returnPayments??=[];r.returnPayments.push({cost:copy(r.returnAllocation.cost),consumedTick:s.worldTick});startTransit(s,r,true);}else r.reason='本人已到接引台，但真实界门损坏，窗口继续流逝。';}
   }else if(r.phase==='present'&&s.worldTick>=r.deadlineTick-d.returnTicks-180)planAnchorReturn(s,r,true);
  }
  if(nearActor(s,r,9)||atAnchor(s)&&['channeling','descending','returning','returned'].includes(r.phase))observe(s,r);
 }
}
export function tickDescentSR(s){const ds=s.srDescent;if(!ds||s.speed===0||ds.lastTick>=s.worldTick)return;const target=s.worldTick;try{while(ds.lastTick<target){s.worldTick=++ds.lastTick;step(s);}}finally{s.worldTick=target;}}
export function descentEffectiveRealmSR(s,p){const r=s.srDescent?.records[p?.descentId];return r&&!['returned','cancelled'].includes(r.phase)&&p.position?.sceneId!==ORIGIN?DESCENT_MODES[r.mode].effectiveRealm:p?.realm;}
export function viewDescentSR(s){
 const ds=s.srDescent;if(!ds)return {enabled:false,modes:[],active:[],history:[]};
 const records=Object.values(ds.records).map(r=>{const live=nearActor(s,r,9)||atAnchor(s)&&['channeling','descending','returning','returned'].includes(r.phase),v=copy(live?{...r.lastObservation,phase:r.phase,reason:r.reason,progressTicks:r.progressTicks,durationTicks:r.durationTicks,deadlineTick:r.deadlineTick??null,observedTick:s.worldTick}:r.lastObservation);return {...v,canReturn:live&&nearActor(s,r)&&['present','aiding'].includes(r.phase),canAid:live&&nearActor(s,r)&&r.phase==='present'&&ds.rift.status==='unstable',canRepair:atAnchor(s)&&r.phase==='stranded'&&r.mode==='original'&&r.returnReopens<1,canRecover:!!r.recoveryStockpileId&&atAnchor(s)&&Object.values(s.stockpilesById[r.recoveryStockpileId].resources).some(n=>n>0)};});
 return {enabled:true,siteSceneId:SITE,anchor:{sceneId:SITE,x:32,y:24,objectId:ANCHOR},modes:Object.entries(DESCENT_MODES).map(([id,d])=>{const reason=requestLock(s,id);return {id,...copy(d),available:!reason,reason:reason||'本人接引并提交具体维护委托；上界使者仍需自愿接受。'};}),active:records.filter(r=>!terminal.has(r.phase)),history:records.filter(r=>terminal.has(r.phase)),repair:copy(ds.repairOrder),feedback:DESCENT_FEEDBACK,boundary:'仙界NPC有限下凡；掌门飞升未开放。不提供跨场景零成本救援；异地只保留最后一次实地观察。'};
}
export function validateDescentSR(s){
 const ds=s.srDescent;if(!ds)return true;const fail=m=>{throw Error('仙界降临存档异常：'+m);};
 if(ds.version!==1||!Number.isSafeInteger(ds.lastTick)||ds.lastTick<0||ds.lastTick>s.worldTick||!s.personsById[ENVOY]?.ascensionState?.alreadyAscended||!s.scenesById[ORIGIN]||!s.scenesById[SITE])fail('独立上界身份或世界时钟');
 if(activeRecords(s).length>1)fail('同一本体重复降临');
 for(const[id,r]of Object.entries(ds.records)){
  const d=DESCENT_MODES[r.mode],p=s.personsById[r.actorPersonId];
  if(r.id!==id||!d||!['channeling','descending','present','aiding','to-anchor','returning','stranded','returned','cancelled','destroyed','dead'].includes(r.phase)||r.providerPersonId!==ENVOY||r.callerPersonId!==MASTER||r.effectiveRealm!==d.effectiveRealm||!Number.isSafeInteger(r.progressTicks)||r.progressTicks<0||r.progressTicks>r.durationTicks||r.returnReopens<0||r.returnReopens>1)fail('方式、身体或阶段预算');
  for(const[key,expected]of [['cost',d.cost],['upperCost',d.upperCost]])if(JSON.stringify(r[key])!==JSON.stringify(expected))fail('固定成本被改写');
  if(JSON.stringify(r.returnAllocation.cost)!==JSON.stringify(d.returnCost)||!['reserved','consumed','refunded'].includes(r.returnAllocation.phase))fail('独立返程预留');
  if(r.launchCommitted&&(!p||p.descentId!==r.id&&r.phase!=='returned'&&!r.transitAborted||r.mode==='avatar'&&(p.personId===ENVOY||p.originPersonId!==ENVOY)))fail('本尊/化身身份');
  if(r.transitAborted&&(r.phase!=='cancelled'||p.position.sceneId!==ORIGIN||r.returnAllocation.phase!=='refunded'||!r.outboundInterrupted))fail('入境失败未实际退回原界');
  if(r.mode==='avatar'&&(!terminal.has(r.phase)||r.phase==='destroyed'&&!r.feedbackApplied)&&s.personsById[ENVOY].position.sceneId!==ORIGIN)fail('化身行程移动了上界本体');
  if(['destroyed','dead'].includes(r.phase)&&(p?.lifeStatus!=='dead'||!s.deathRecordsByPersonId[p.personId]||!s.factsById[r.deathFactId]))fail('死亡未引用共同事实');
  if(r.phase==='returned'&&(p.position.sceneId!==ORIGIN||r.returnAllocation.phase!=='consumed'))fail('未实际返程或未付返程成本');
  if(r.travelId){const t=s.travelsById[r.travelId];if(!t||t.descentId!==r.id||t.routeId!==LINK||t.participantIds.length!==1||t.participantIds[0]!==r.actorPersonId||!Number.isSafeInteger(t.progressTicks)||t.progressTicks<0||t.progressTicks>t.durationTicks)fail('真实跨界身体/旅程');}
  if(r.feedbackApplied&&(r.mode!=='avatar'||r.phase!=='destroyed'||!r.feedback||r.feedback.wound!==DESCENT_FEEDBACK.wound||r.feedback.energy!==DESCENT_FEEDBACK.energy))fail('固定魂损回传');
 }
 return true;
}
export const descentHandlers={requestDescent,returnDescent,descentCommand};
