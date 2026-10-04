import {BUILDINGS, TECHNIQUES, RESOURCES, CELLS, canPay, xpNeed} from './ea-data.mjs?v=ea-130-preview-20261005-r1';
import {buildingAccess,scenicFindPath,scenicDistance,geometryRevision} from './ea-scene-geometry.mjs?v=ea-130-preview-20261005-r1';

// Read-only projections. These never schedule an NPC, spend resources or reveal a private manual.
export const lifeBuildingActive = b => !!b && !b.disabled && b.enabled!==false && (b.condition??100)>0;
const mind = person => person.mind || person;
const away = (s,p) => !!p.mind?.away || !!p.mind?.journey || p.mind?.activity==='travel' || (p===s.master&&(!!p.journey||p.action==='travel'||s.combat?.status==='active'));
const action = p => p.mind?.activity || p.action || 'rest';
const cellKey = p => `${p.x},${p.y}`;
export const actorScenePosition=(s,person)=>person===s.master?person.scenic||buildingAccess(s,s.buildings.find(b=>b.type==='hall')):mind(person).scenic||buildingAccess(s,s.buildings.find(b=>b.type==='hall'));
const pathCache=new WeakMap();
export function lifeScenePath(s,person,building){
 if(!building)return null;const from=actorScenePosition(s,person),revision=geometryRevision(s),key=`${revision}:${from.x}:${from.y}`;let cache=pathCache.get(person);
 if(!cache||cache.key!==key){cache={key,paths:new Map()};pathCache.set(person,cache);}
 if(!cache.paths.has(building.id))cache.paths.set(building.id,scenicFindPath(s,from,buildingAccess(s,building)));
 const path=cache.paths.get(building.id);return path===null?null:path.map(p=>({...p}));
}
const alreadyNavigating=(s,person,b)=>{const a=mind(person).scenic||person.scenic;return a?.revision===geometryRevision(s)&&a.goal&&scenicDistance(a.goal,buildingAccess(s,b))<.01&&(a.path?.length||scenicDistance(a,buildingAccess(s,b))<=18);};
export function lifePath(s,person,building) {
  if(!building)return null;
  const start=person.position||s.master.position,blocked=new Set(s.buildings.map(cellKey)),cells=new Set(CELLS.map(cellKey));
  const targets=new Set([[1,0],[-1,0],[0,1],[0,-1]].map(([x,y])=>`${building.x+x},${building.y+y}`));
  const queue=[{...start,path:[]}],seen=new Set([cellKey(start)]);
  for(let i=0;i<queue.length;i++){
    const p=queue[i];if(targets.has(cellKey(p)))return p.path;
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){
      const next={x:p.x+dx,y:p.y+dy},key=cellKey(next);
      if(cells.has(key)&&!blocked.has(key)&&!seen.has(key)){seen.add(key);queue.push({...next,path:[...p.path,next]});}
    }
  }
  return null;
}
export function lifeFacility(s,person,activity=action(person),learningId=mind(person).learning?.id) {
  if(away(s,person))return null;
  const assigned=s.buildings.find(b=>b.id===person.job);
  if(['work','cultivate'].includes(activity)&&lifeBuildingActive(assigned)&&(activity==='work'?!!BUILDINGS[assigned.type].work:['hall','meditation'].includes(assigned.type))&&(alreadyNavigating(s,person,assigned)||lifeScenePath(s,person,assigned)!==null))return assigned;
  const p=mind(person),practice=!!p.learning?.practice;
  const types=activity==='study'?(learningId&&learningId!=='qingyuan'&&!practice?['library']:['library','hall']):activity==='teach'?['library','hall']:activity==='cultivate'?['meditation','hall']:activity==='heal'?['clinic','house','hall']:['house','hall'];
  const current=p.scenic||person.scenic;
  if(current?.revision===geometryRevision(s)&&current.goal){const held=s.buildings.find(b=>types.includes(b.type)&&lifeBuildingActive(b)&&scenicDistance(current.goal,buildingAccess(s,b))<.01);if(held)return held;}
  const candidates=s.buildings.filter(b=>types.includes(b.type)&&lifeBuildingActive(b)).sort((a,b)=>(['rest','social','forage'].includes(activity)?0:types.indexOf(a.type)-types.indexOf(b.type))||scenicDistance(actorScenePosition(s,person),buildingAccess(s,a))-scenicDistance(actorScenePosition(s,person),buildingAccess(s,b))||a.id-b.id);
  for(const b of candidates)if(lifeScenePath(s,person,b)!==null)return b;
  return null;
}
export function lifeActivityLock(s,person) {
  const p=mind(person),a=action(person);
  if(away(s,person))return '';
  if(a==='work'||a==='cultivate'&&person.job!==null&&person.job!==undefined){
    const b=s.buildings.find(b=>b.id===person.job),t=BUILDINGS[b?.type];
    if(!b)return '原设施已拆除，重新选择去处。';
    if(!lifeBuildingActive(b))return `${t.name}${b.enabled===false?'已停用':'已损坏'}，暂缓原活动。`;
    if(!alreadyNavigating(s,person,b)&&lifeScenePath(s,person,b)===null)return '原设施入口不通，等待改善道路。';
    if(a==='work'&&t.input&&!canPay(s,t.input))return `生产原料不足：${Object.entries(t.input).filter(([k,v])=>(s.resources[k]||0)<v).map(([k,v])=>`${RESOURCES[k]}缺${Math.ceil(v-(s.resources[k]||0))}`).join('、')}。`;
  }
  if(a==='study'&&p.learning&&!lifeFacility(s,person,a,p.learning.id))return '研习场所停用、损坏或入口不通，保留学习进度，先休整。';
  if(a==='teach'&&!lifeFacility(s,person,a))return '授业场所暂不可用，先休整。';
  return '';
}
export function workOpportunity(s,person,buildingOrId,{checkPath=true}={}) {
  const b=typeof buildingOrId==='object'?buildingOrId:s.buildings.find(x=>x.id===buildingOrId),p=mind(person);
  const no=reason=>({available:false,willing:false,reason});
  if(!b||!BUILDINGS[b.type]?.work)return no('此设施没有生产差事。');
  if(away(s,person))return no('正在山外，归院后再权衡差事。');
  if(!lifeBuildingActive(b))return no(b.enabled===false?'设施停用，先恢复运行。':'设施损坏，先修缮。');
  if(checkPath&&lifeScenePath(s,person,b)===null)return no('建筑入口不通，先留出连通道路。');
  if(s.disciples.some(d=>d.id!==person.id&&d.job===b.id&&!d.mind?.away))return no('已有同门接下此处差事。');
  const input=BUILDINGS[b.type].input;if(input&&!canPay(s,input))return no('生产原料不足，补足原料后再考虑。');
  if(p.satiety<22)return no('口粮不足，优先采食。');
  if(person.wound>20)return no('伤势未愈，优先调养。');
  if(person.energy<22)return no('精力不足，先休息。');
  if((p.refusalUntil||0)>(s.society?.clock??s.time))return no('先前分歧仍未缓和，暂不接差事。');
  if((p.relationships?.master?.trust??55)<15&&(p.traits?.[3]??60)<60)return no('对掌门缺乏信任，暂不愿响应差事。');
  return {available:true,willing:action(person)==='work'&&person.job===b.id,reason:action(person)==='work'&&person.job===b.id?'已自主接下此处差事。':'条件具备；仍由本人权衡修行、生活与志向，自主选择。'};
}
export function personLifeSummary(s,person,{opportunities=false}={}) {
  const p=mind(person),a=action(person),facility=lifeFacility(s,person),lock=lifeActivityLock(s,person),isAway=away(s,person);
  const cooldown=Math.max(0,(person.breakthroughCooldown||0)-s.time),privateStudy=a==='study'&&p.learning&&(s.doctrine.sealed.includes(p.learning.id)||p.hiddenKnowledge?.[p.learning.id]&&s.society?.secrets.some(e=>e.id===p.hiddenKnowledge[p.learning.id]&&!e.discovered));
  const label={rest:'休憩',heal:'调养',forage:'采食',work:'生产',study:'研习',cultivate:'修炼',teach:'授业',social:'交谈',travel:'山外行程',walk:'行走'}[a]||a;
  const progress=a==='study'&&p.learning&&!privateStudy?{value:p.learning.progress,total:p.learning.total||40,label:TECHNIQUES[p.learning.id]?.name||'研习'}:a==='work'&&facility?{value:facility.progress,total:BUILDINGS[facility.type].duration,label:BUILDINGS[facility.type].name}:a==='cultivate'?{value:person.xp,total:xpNeed(person.realm),label:'当前修为'}:cooldown?{value:15-Math.min(15,cooldown),total:15,label:'突破后调息'}:null;
  return {activity:a,label:cooldown&&a==='rest'?'突破后调息':label,status:isAway?'away':lock?'blocked':p.scenic?.path?.length||person.scenic?.path?.length||p.path?.length||person.path?.length?'moving':'active',facilityId:facility?.id??null,facilityName:facility?BUILDINGS[facility.type].name:null,reason:privateStudy?'独处参悟，暂不愿详谈。':lock||(cooldown&&a==='rest'?`刚刚突破，尚需调息${Math.ceil(cooldown)}秒。`:p.reason||'按当前安排继续活动。'),progress,opportunities:opportunities?s.buildings.filter(b=>BUILDINGS[b.type].work).map(b=>({facilityId:b.id,name:BUILDINGS[b.type].name,...workOpportunity(s,person,b)})):[]};
}
export function teachingPresent(s,teacher,student,id) {
  if(!teacher||away(s,teacher)||away(s,student)||action(teacher)!=='teach'||action(student)!=='study')return false;
  if(teacher===s.master&&teacher.teaching&&teacher.teaching!==id)return false;
  if((mind(teacher).scenic?.path?.length||teacher.scenic?.path?.length||teacher.mind?.path?.length||teacher.path?.length)||(mind(student).scenic?.path?.length||student.mind?.path?.length||student.path?.length))return false;
  const a=lifeFacility(s,teacher,'teach'),b=lifeFacility(s,student,'study',id);
  return !!a&&a.id===b?.id&&scenicDistance(actorScenePosition(s,teacher),buildingAccess(s,a))<=18&&scenicDistance(actorScenePosition(s,student),buildingAccess(s,b))<=18;
}
