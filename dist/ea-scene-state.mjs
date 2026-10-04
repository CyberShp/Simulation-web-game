import {BUILDINGS,ROUTES,RESOURCES,stage} from './ea-data.mjs';
import {nearest,point} from './yunxiu-courtyard/navigation.mjs';

// The scenic courtyard groups facilities by use. The construction grid remains
// the authoritative placement/adjacency plan; neither view invents facilities.
const SITES={
 hall:[840,217],meditation:[240,192],library:[377,242],watchtower:[811,843],
 lumber:[179,472],workshop:[341,515],quarry:[226,680],
 farm:[1220,348],granary:[1370,401],well:[1490,461],
 house:[1260,746],kitchen:[1080,744],alchemy:[943,666],clinic:[1430,714]
};
export const facilityActive=b=>!!b&&b.enabled!==false&&b.condition>0;
export function facilityRecords(s){
 const records=[];
 for(const [type,base] of Object.entries(SITES)){
  const rows=s.buildings.filter(b=>b.type===type).sort((a,b)=>a.id-b.id),columns=Math.max(1,Math.ceil(Math.sqrt(rows.length)));
  const size=type==='hall'?0:Math.max(48,Math.min(155,180/Math.sqrt(Math.max(1,rows.length)))),gap=size*.76;
  rows.forEach((b,i)=>{
   const x=base[0]+(i%columns-(columns-1)/2)*gap+(b.x-5)*2,
    y=base[1]+Math.floor(i/columns)*gap*.45+(b.y-4)*2;
   const position=type==='hall'?{x:840,y:217}:{x,y},access=nearest(position);
   records.push({id:b.id,type,name:type==='hall'&&stage(s)>=3?'宗门正殿':BUILDINGS[type].name,building:b,position,access:{x:access.x,y:access.y},size,
    active:facilityActive(b),workers:s.disciples.filter(d=>d.job===b.id&&!d.mind?.away),
    status:!facilityActive(b)?'已停用':b.condition<50?'待修缮':type==='alchemy'&&s.crafting?'正在炼丹':'已建成',
    peakId:s.society?.peaks.find(p=>p.buildingIds?.includes(b.id))?.id??null});
  });
 }
 return records;
}
export function courtyardDestination(s,d,records=facilityRecords(s)){
 const usable=records.filter(r=>r.active),job=usable.find(r=>r.id===d.job),activity=d.mind?.activity;
 if(job)return job;
 const preferred={eat:['kitchen','hall'],heal:['clinic','hall'],rest:['house','hall'],
  cultivate:['meditation','hall'],breakthrough:['meditation','hall'],study:['library','hall'],teach:['library','hall'],
  wood:['lumber','hall'],stone:['quarry','hall'],herb:['farm','hall'],food:['granary','hall']}[activity]||['hall'];
 return preferred.map(type=>usable.find(r=>r.type===type)).find(Boolean)||records.find(r=>r.type==='hall');
}
export function scenicHomeActors(s){
 const away=new Set(s.world?.exploration?.companionIds||[]);
 return s.disciples.filter(d=>!d.mind?.away&&!d.mind?.journey&&d.mind?.activity!=='travel'&&!away.has(d.id)&&!d.left&&d.status!=='left');
}
export function routeDiscovered(s,id){return !!ROUTES[id]&&(s.story.step>=(ROUTES[id].scene==='lake'?4:2)||!!s.migration);}
export function nextObjective(s){
 const q=s.story.step,m=s.master,e=s.world.exploration;
 if(s.combat?.status==='active')return {label:'返回战场',text:'移动避开预警，留意气血；需要时可暂停或撤退。',kind:'battle'};
 if(e)return {label:e.status==='traveling'?'查看行程':e.resolved?'返回山院':'前往当前线索',text:e.status==='traveling'?'行程随游戏时间推进。':e.resolved?'此地的行动已有结果，归院后继续主线。':'沿道路走近标记，再作调查或战斗选择。',kind:e.resolved?'return':'journey'};
 if(q===0&&m.wound>0)return {label:m.action==='heal'?'查看疗伤进度':'用灵草调息（6份）',text:m.action==='heal'?`正在疗伤，剩余伤势 ${Math.ceil(m.wound)}。保持时间运行，伤愈后确认主线。`:'母亲留下的灵草能温养经脉。先治好逃亡伤势。',kind:m.action==='heal'?'self':'heal'};
 for(const type of q===2?['farm','lumber']:q===3?['library']:[]){
  const built=s.buildings.filter(b=>b.type===type);if(built.some(facilityActive))continue;
  if(built.length)return {label:'恢复'+BUILDINGS[type].name,text:'设施已建成，但停用或损坏。先查看并恢复运行，再推进主线。',kind:'facility',id:built[0].id};
  const lacks=Object.entries(BUILDINGS[type].cost).filter(([key,value])=>s.resources[key]<value).map(([key,value])=>RESOURCES[key]+' '+Math.ceil(value-s.resources[key]));
  if(lacks.length)return {label:'补足'+BUILDINGS[type].name+'材料',text:'还缺'+lacks.join('、')+'。掌门可采集物资，门人可照料现有设施，也可在府库交易补足。',kind:'production'};
  return {label:'筹建'+BUILDINGS[type].name,text:type==='library'?'整理遗卷需要真实建成并可运行的藏经阁。':'建好供给设施，让愿意留下的人有安身与生活的机会。',kind:'build',id:type};
 }
 if(q===5)return {label:'准备筑基',text:'研习筑基篇，备好丹炉、筑基丹与灵晶；在掌门页面检查缺项。',kind:'self'};
 if([4,6,7,8].includes(q))return {label:'查看已发现的路线',text:'舆图只显示目前已知的去处；修为、精力和准备决定能否亲往。',kind:'explore'};
 return {label:q>=10?'继续经营山院':'查看当前主线',text:q>=10?'旧仇已结，继续经营、授业与分峰。':'完成当前准备后，确认主线以推进故事。',kind:q>=10?'sect':'journal'};
}
export function sceneSnapshot(s){const facilities=facilityRecords(s);return {stage:stage(s),facilities,people:scenicHomeActors(s).map(d=>({id:d.id,destinationId:courtyardDestination(s,d,facilities)?.id})),objective:nextObjective(s)};}
