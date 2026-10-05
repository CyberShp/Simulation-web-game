import {BUILDINGS,RESOURCES,CELLS} from './ea-data.mjs?v=ea-141-preview-20261005-r2';
import {buildingAccess,scenicDistance} from './ea-scene-geometry.mjs?v=ea-141-preview-20261005-r2';

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
 return {kind:['wood','stone','herb','food'].includes(id)?'gather':'production',id,label:id==='jade'?'查看府库交易':'采集'+RESOURCES[id],text:'还缺'+missing.map(([k,v])=>RESOURCES[k]+' '+Math.ceil(v-s.resources[k])).join('、')+'。'+(id==='jade'?'主屋持续凝聚灵石，也可出售多余山货。':'先采集补足，再返回当前目标。'),needed:Math.ceil(amount-s.resources[id])};
}
export function recommendedPlot(s,type,placementLock){
 const hall=s.buildings.find(b=>b.type==='hall'),origin=buildingAccess(s,hall);
 // Rank nearby inner plots, then ask the authoritative placement/path checks.
 const candidates=CELLS.filter(p=>p.x<8&&p.y<7&&!s.buildings.some(b=>b.x===p.x&&b.y===p.y)).map(p=>({...p,distance:scenicDistance(origin,buildingAccess(s,{type,...p,level:1}))})).sort((a,b)=>a.distance-b.distance||a.y-b.y||a.x-b.x);
 return candidates.find(p=>!placementLock(s,type,p.x,p.y))||null;
}
export function onboardingView(s){
 const o=s.story.onboarding,first=o?.productions.find(e=>!o.seen.includes(e.id)),farm=s.buildings.find(b=>b.type==='farm'&&b.enabled!==false&&b.condition>0),d=s.disciples.find(d=>d.name==='陆知微')||s.disciples[0];
 return {enabled:!!o&&s.story.step<4,systems:availableSystems(s),reserve:resourceReserve(s),feedback:first?{...first,title:first.type==='farm'?'药圃第一次有了收成':'山院第一次有了木料',text:first.name+'自主照料'+BUILDINGS[first.type].name+'，收获'+Object.entries(first.out).map(([k,v])=>RESOURCES[k]+' '+v.toFixed(1)).join('、')+'。已实际收入府库。'}:null,
 work:farm&&d&&!o?.productions.some(e=>e.type==='farm')?{personId:d.id,buildingId:farm.id,name:d.name,title:'看见门人自己的选择',text:d.name+'：'+(d.mind?.reason||'正在熟悉山院。')+(d.job===farm.id&&d.mind.activity==='work'?(d.mind.scenic?.path?.length?' 正沿院路前往药圃。':' 正在照料药圃，完成一个生产周期后收获。'):' 她会权衡休息、学习和生产；你可以提供设施与差事机会。')}:null};
}
export function resumeSummary(s,next){
 const e=s.world.exploration;
 const recent=s.logs.at(0)?.text||'你已在云岫旧院落脚。';
 return {title:s.combat?.status==='active'?'战斗已暂停，准备好再继续':'山居续卷 · 上次停在这里',text:recent,detail:'第 '+(Math.floor(s.time/120)+1)+' 日 · '+s.disciples.length+' 位门人 · '+s.buildings.length+' 处设施'+(e?' · 正在'+(e.status==='traveling'?'前往':'调查')+e.regionId:''),next};
}
