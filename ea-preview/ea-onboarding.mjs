import {BUILDINGS,RESOURCES,CELLS} from './ea-data.mjs?v=ea-160-courtyard-20261008-r17';
import {buildingAccess,scenicDistance} from './ea-scene-geometry.mjs?v=ea-160-courtyard-20261008-r17';
import {actorScenePosition,lifeBuildingActive,personLifeSummary} from './ea-life.mjs?v=ea-160-courtyard-20261008-r17';

// Guidance records observations only. Progress, choices and resources remain
// owned by the campaign and simulation; older worlds opt out automatically.
export function initOnboarding(s){s.story.onboarding={version:1,introPage:0,productions:[],seen:[]};}
export function setIntroPage(s,page){if(!Number.isInteger(page)||page<0||page>2)throw Error('序章幕次无效');if(s.story.onboarding&&!s.story.intro)s.story.onboarding.introPage=page;return true;}
export function recordFirstProduction(s,d,b,out){
 const o=s.story.onboarding;if(!o||!['farm','lumber'].includes(b.type)||o.productions.some(e=>e.type===b.type))return;
 o.productions.push({id:'harvest:'+b.type,type:b.type,personId:d.id,name:d.name,buildingId:b.id,time:s.time,out:{...out}});
}
export function acknowledgeOnboarding(s,id){
 const o=s.story.onboarding;if(!o)return false;
 if(!o.productions.some(e=>e.id===id))throw Error('这次收获尚未发生');
 if(!o.seen.includes(id))o.seen.push(id);return true;
}
export function validateOnboarding(s){
 const o=s.story.onboarding;if(o===undefined)return true;
 const finite=n=>Number.isFinite(n)&&n>=0;
 return !!o&&o.version===1&&Number.isInteger(o.introPage)&&o.introPage>=0&&o.introPage<=2&&Array.isArray(o.productions)&&o.productions.length<=2&&new Set(o.productions.map(e=>e.type)).size===o.productions.length&&o.productions.every(e=>e&&['farm','lumber'].includes(e.type)&&e.id==='harvest:'+e.type&&Number.isSafeInteger(e.personId)&&e.personId>0&&typeof e.name==='string'&&e.name.length>0&&e.name.length<=40&&Number.isSafeInteger(e.buildingId)&&e.buildingId>0&&e.buildingId<s.nextId&&finite(e.time)&&e.time<=s.time&&e.out&&Object.keys(e.out).length>0&&Object.entries(e.out).every(([k,v])=>Object.hasOwn(RESOURCES,k)&&finite(v)&&v>0))&&Array.isArray(o.seen)&&o.seen.length<=2&&new Set(o.seen).size===o.seen.length&&o.seen.every(id=>o.productions.some(e=>e.id===id));
}
export function availableSystems(s){
 if(!s.story.onboarding||s.story.step>=4)return ['self','build','disciples','manuals','production','sect','explore','journal'];
 const tabs=['self','journal'];if(s.story.step>=2)tabs.push('build','disciples','production','explore');if(s.story.step>=3)tabs.push('manuals','sect');return tabs;
}
export function resourceReserve(s){return s.story.step===0?(s.master.wound>0&&s.master.action!=='heal'?16:10):s.story.step===1?10:0;}
export function recoveryObjective(s,cost){
 const missing=Object.entries(cost).filter(([k,v])=>s.resources[k]<v);if(!missing.length)return null;
 const [id,amount]=missing.find(([k])=>['wood','stone','herb','food'].includes(k))||missing[0];
 return {kind:['wood','stone','herb','food'].includes(id)?'gather':'production',id,label:id==='jade'?'查看府库交易':'采集'+RESOURCES[id],text:'还缺'+missing.map(([k,v])=>RESOURCES[k]+' '+Math.ceil(v-s.resources[k])).join('、')+'。'+(id==='jade'?s.contentVersion==='opening-v1.2'?'采集山货后出售，可恢复灵石；主屋不会凭空产钱。':'主屋持续凝聚灵石，也可出售多余山货。':'先采集补足，再返回当前目标。'),needed:Math.ceil(amount-s.resources[id])};
}
export function recommendedPlot(s,type,placementLock){
 const hall=s.buildings.find(b=>b.type==='hall'),origin=buildingAccess(s,hall);
 // Rank nearby inner plots, then ask the authoritative placement/path checks.
 const candidates=CELLS.filter(p=>p.x<8&&p.y<7&&!s.buildings.some(b=>b.x===p.x&&b.y===p.y)).map(p=>({...p,distance:scenicDistance(origin,buildingAccess(s,{type,...p,level:1}))})).sort((a,b)=>a.distance-b.distance||a.y-b.y||a.x-b.x);
 return candidates.find(p=>!placementLock(s,type,p.x,p.y))||null;
}
function firstFarmWork(s,o){
 if(!o||o.productions.some(e=>e.type==='farm'))return null;
 const farms=s.buildings.filter(b=>b.type==='farm');if(!farms.length)return null;
 // Observe whoever actually chose the farm. The opening must not assign work
 // or imply that Lu is producing while another person is doing it.
 const worker=s.disciples.find(d=>d.mind?.activity==='work'&&!d.mind.away&&!d.mind.journey&&farms.some(b=>b.id===d.job&&lifeBuildingActive(b)));
 const d=worker||s.disciples.find(d=>d.name==='陆知微')||s.disciples[0];if(!d)return null;
 const farm=farms.find(b=>b.id===worker?.job)||farms.find(lifeBuildingActive)||farms[0],life=personLifeSummary(s,d),paused=s.speed===0;
 const farmChosen=life.activity==='work'&&life.facilityId===farm.id&&lifeBuildingActive(farm);
 const atFarm=s.schemaVersion===6?s.activitiesById[d.activityId]?.phase==='executing':scenicDistance(actorScenePosition(s,d),buildingAccess(s,farm))<=18;
 const working=farmChosen&&life.status==='active'&&atFarm;
 const status=working?'working':farmChosen&&life.status==='active'&&!atFarm?'moving':life.status;
 const phase=status==='away'?'正在山外':status==='waiting'?'等待空闲工位':status==='blocked'?'当前活动暂缓':status==='moving'?(life.status==='moving'?'正前往':'准备前往')+(life.facilityName||'当前目的地'):working?'正在照料药圃':'正在'+life.label;
 const progress=working?{value:life.progress?.value??farm.progress??0,total:BUILDINGS.farm.duration,label:'药圃本轮照料',running:!paused}:null;
 const facilityNotice=lifeBuildingActive(farm)?'':farm.enabled===false?'药圃已停用，恢复运行后才有生产机会。':'药圃已损坏，修缮后才有生产机会。';
 const text=d.name+'：'+phase+'。'+life.reason+(working?' 完成这一轮照料后，真实收成会收入府库。':' 门人会自行权衡休息、学习与生产。')+(facilityNotice?' '+facilityNotice:'')+(paused?' 时序已暂停，当前活动不会推进。':'');
 return {personId:d.id,buildingId:farm.id,name:d.name,title:'看见门人自己的选择',status,activity:life.activity,phase,reason:life.reason,paused,progress,text};
}
export function onboardingView(s){
 const o=s.story.onboarding,first=o?.productions.find(e=>!o.seen.includes(e.id)),work=firstFarmWork(s,o);
 return {enabled:!!o&&(s.story.step<4||!!work),systems:availableSystems(s),reserve:resourceReserve(s),feedback:first?{...first,title:first.type==='farm'?'药圃第一次有了收成':'山院第一次有了木料',buildingName:BUILDINGS[first.type].name,observeLabel:'观察'+first.name+'与'+BUILDINGS[first.type].name,text:first.name+'自主照料'+BUILDINGS[first.type].name+'，收获'+Object.entries(first.out).map(([k,v])=>RESOURCES[k]+' '+v.toFixed(1)).join('、')+'。已实际收入府库。'}:null,work};
}
export function resumeSummary(s,next){
 const e=s.world.exploration;
 // SR-XF-029: opening saves carry legacy logs; summarize actual progress rather
 // than presenting an old join message as a current-world result.
 const o=s.story.opening,visitor=o&&s.personsById?.[o.visitorId],name=visitor?.name||'来客';
 const recent=s.srWorld&&o&&s.story.step<4?(s.story.step===0?(s.master.wound>0?(next?.kind==='resumeHealing'?'疗养仍在进行，伤势尚未恢复。':'伤势尚未恢复，先在院中疗养。'):'伤势已经恢复，可以继续眼前的目标。'):s.story.step===1?(o?.gifted?(o.invitation==='joined'&&(s.homeMemberIds||[]).includes(o.visitorId)?name+'已自愿入院。':o.invitation==='declined'?name+'已收到赠药，暂未答应入院。':name+'已收到赠药，去留尚未决定。'):'疗伤已完成，赠药与入院尚未发生。'):s.story.step===2?'你正在恢复山院的生活与供给。':'接着按实际所需安排研习与出行。'):(s.logs.at(0)?.text||'你已在云岫旧院落脚。');
 return {title:s.combat?.status==='active'?'战斗已暂停，准备好再继续':'山居续卷 · 上次停在这里',text:recent,detail:'第 '+(Math.floor(s.time/120)+1)+' 日 · '+s.disciples.length+' 位门人 · '+s.buildings.length+' 处设施'+(e?' · 正在'+(e.status==='traveling'?'前往':'调查')+e.regionId:''),next};
}
