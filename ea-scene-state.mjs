import {artisanPresent} from './ea-rain-artisan.mjs?v=ea-160-courtyard-20261008-r6';
import {facilitySlotView} from './ea-facility-slots.mjs?v=ea-160-courtyard-20261008-r6';
import {productionOrder} from './ea-facility-activities.mjs?v=ea-160-courtyard-20261008-r6';
import {BUILDINGS,ROUTES,RESOURCES,stage} from './ea-data.mjs?v=ea-160-courtyard-20261008-r6';
import {scenicPoint,buildingAccess,buildingSize,buildingFootprint} from './ea-scene-geometry.mjs?v=ea-160-courtyard-20261008-r6';
import {lifeFacility} from './ea-life.mjs?v=ea-160-courtyard-20261008-r6';
import {recoveryObjective} from './ea-onboarding.mjs?v=ea-160-courtyard-20261008-r6';

export const facilityActive=b=>!!b&&b.enabled!==false&&b.condition>0;
export function facilityRecords(s){
 return [...s.buildings].sort((a,b)=>a.id-b.id).map(b=>{
   const type=b.type,position=scenicPoint(b.x,b.y),access=buildingAccess(s,b),size=buildingSize(b);
   return {id:b.id,type,name:type==='hall'&&stage(s)>=3?'宗门正殿':BUILDINGS[type].name,building:b,position,access,size,footprint:buildingFootprint(b),
    active:facilityActive(b),workers:s.disciples.filter(d=>d.job===b.id&&!d.mind?.away),
    status:!facilityActive(b)?'已停用':b.condition<50?'待修缮':type==='alchemy'&&s.crafting?'正在炼丹':'已建成',
    slots:s.schemaVersion===6?facilitySlotView(s,b):[],workOrder:s.schemaVersion===6?productionOrder(s,b):null,peakId:s.society?.peaks.find(p=>p.buildingIds?.includes(b.id))?.id??null};
 });
}
export function courtyardDestination(s,d,records=facilityRecords(s)){
 const actual=lifeFacility(s,d);if(actual)return records.find(r=>r.id===actual.id);
 const usable=records.filter(r=>r.active),job=usable.find(r=>r.id===d.job),activity=d.mind?.activity;
 if(job)return job;
 const preferred={eat:['kitchen','hall'],heal:['clinic','hall'],rest:['house','hall'],
  cultivate:['meditation','hall'],breakthrough:['meditation','hall'],study:['library','hall'],teach:['library','hall'],
  wood:['lumber','hall'],stone:['quarry','hall'],herb:['farm','hall'],food:['granary','hall']}[activity]||['hall'];
 return preferred.map(type=>usable.find(r=>r.type===type)).find(Boolean)||records.find(r=>r.type==='hall');
}
export function scenicHomeActors(s){
 const away=new Set(s.world?.exploration?.companionIds||[]);
 const people=s.disciples.filter(d=>!d.mind?.away&&!d.mind?.journey&&d.mind?.activity!=='travel'&&!away.has(d.id)&&!d.left&&d.status!=='left');
 if(s.story.opening?.invitation==='unasked'&&s.story.step<=1&&s.personsById){const visitor=s.personsById[s.story.opening.visitorId];if(visitor&&!people.includes(visitor))people.push(visitor);}
 if(s.story.opening&&s.story.step===2){const visitor=s.personsById[s.story.opening.secondVisitorId];if(visitor&&!people.includes(visitor))people.push(visitor);}
 if(artisanPresent(s)){const artisan=s.personsById[s.story.artisan.personId];if(!people.includes(artisan))people.push(artisan);}
 return people;
}
export function routeDiscovered(s,id){return !!ROUTES[id]&&(s.story.step>=(ROUTES[id].scene==='lake'?4:2)||!!s.migration);}
export function nextObjective(s){
 const q=s.story.step,m=s.master,e=s.world.exploration;
 const construction=m.activityId&&s.activitiesById?.[m.activityId];
 if(construction?.kind==='construction'){const order=s.workOrdersById?.[construction.workOrderId],phase=construction.reason|| (construction.phase==='moving'?'正前往工地':construction.phase==='blocked'?'通路受阻，可取消营造':'正在施工');return{kind:'construction',id:construction.id,title:BUILDINGS[construction.type].name+' · '+phase,text:phase+' 完成后设施才可使用。进度 '+(order?.progressTicks??construction.progressTicks)+'/'+(order?.durationTicks??construction.totalTicks)+'。暂停和关闭网页不推进。',label:s.speed===0?'继续营造':'查看营造进度'};}
 if(s.combat?.status==='active')return {label:'返回战场',text:'移动避开预警，留意气血；需要时可暂停或撤退。',kind:'battle'};
 if(e)return {label:e.status==='traveling'?'查看行程':e.resolved?'返回山院':'前往当前线索',text:e.status==='traveling'?'行程随游戏时间推进。':e.resolved?'此地的行动已有结果，归院后继续主线。':'沿道路走近标记，再作调查或战斗选择。',kind:e.resolved?'return':'journey'};
 if(q===0&&m.wound>0){if(m.action==='heal'&&s.speed===0)return {label:'继续疗伤',text:'时序已暂停，伤势暂不恢复。继续后沿用已服的药，无需再消耗灵草。',kind:'resumeHealing'};if(m.action!=='heal'){const recovery=recoveryObjective(s,{herb:6});if(recovery)return recovery;}return {label:m.action==='heal'?'查看疗伤进度':'用灵草调息（6份）',text:m.action==='heal'?`正在疗伤，剩余约 ${Math.ceil(m.wound/2)} 秒。保持时间运行，伤愈后去主屋听听院外的动静。`:'母亲留下的灵草能温养经脉。先治好逃亡伤势。',kind:m.action==='heal'?'self':'heal'};}
 if(q===0||q===1){if(q===1&&!s.story.opening?.gifted){const recovery=recoveryObjective(s,{herb:10});if(recovery)return recovery;}const hall=s.buildings.find(b=>b.type==='hall');return {label:q===0?'到主屋听听来意':s.story.opening?.gifted?'与陆知微商议去留':'走近陆知微，赠药结缘',text:q===0?'伤势已愈，院外有人循着母亲的旧药方前来求助。':'陆知微在主屋前等候。走近交谈，亲手赠药，再商议去留。',kind:'home',id:hall.id};}
 for(const type of q===2?['farm','lumber']:q===3?['library']:[]){
  const built=s.buildings.filter(b=>b.type===type);if(built.some(facilityActive))continue;
  if(built.length)return {label:'恢复'+BUILDINGS[type].name,text:'设施已建成，但停用或损坏。先查看并恢复运行，再推进主线。',kind:'facility',id:built[0].id};
  const lacks=Object.entries(BUILDINGS[type].cost).filter(([key,value])=>s.resources[key]<value).map(([key,value])=>RESOURCES[key]+' '+Math.ceil(value-s.resources[key]));
  if(lacks.length)return {...recoveryObjective(s,BUILDINGS[type].cost),text:'还缺'+lacks.join('、')+'。先采集补足'+BUILDINGS[type].name+'材料，再继续营造。'};
  return {label:'筹建'+BUILDINGS[type].name,text:type==='library'?'整理遗卷需要真实建成并可运行的藏经阁。':'建好供给设施，让愿意留下的人有安身与生活的机会。',kind:'build',id:type};
 }
 if(q===2||q===3){const b=s.buildings.find(b=>b.type===(q===3?'library':'hall'));return {label:q===2?'走近林长风，商议留下':'到藏经阁整理遗卷',text:q===2?'药田与伐木场已备好，来客想听听山院能提供怎样的生活。':'沿院路来到藏经阁，展开母亲留下的旧信。',kind:'home',id:b.id};}
 if(q===5)return {label:'准备筑基',text:'研习筑基篇，备好丹炉、筑基丹与灵晶；在掌门页面检查缺项。',kind:'self'};
 if([4,6,7,8].includes(q))return {label:'查看已发现的路线',text:'舆图只显示目前已知的去处；修为、精力和准备决定能否亲往。',kind:'explore'};
 return {label:q>=10?'继续经营山院':'查看当前主线',text:q>=10?'旧仇已结，继续经营、授业与分峰。':'完成当前准备后，确认主线以推进故事。',kind:q>=10?'sect':'journal'};
}
export function sceneSnapshot(s){const facilities=facilityRecords(s);return {stage:stage(s),facilities,people:scenicHomeActors(s).map(d=>({id:d.id,destinationId:courtyardDestination(s,d,facilities)?.id})),objective:nextObjective(s)};}
