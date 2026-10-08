import {BUILDINGS,TECHNIQUES,RECIPES,canPay} from './ea-data.mjs?v=ea-160-courtyard-20261008-r34';
import {facilityRecords,courtyardDestination,scenicHomeActors} from './ea-scene-state.mjs?v=ea-160-courtyard-20261008-r34';
import {startScenicWalk,scenicPosition} from './ea-scenic.mjs?v=ea-160-courtyard-20261008-r34';
import {homeInteractions} from './ea-narrative.mjs?v=ea-160-courtyard-20261008-r34';
import {scenicSweep} from './ea-scene-geometry.mjs?v=ea-160-courtyard-20261008-r34';
import {sceneUnits} from './ea-sr-spatial.mjs?v=ea-160-courtyard-20261008-r34';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const arrived=(s,a,b)=>distance(a,b)<=sceneUnits(s,28)&&!scenicSweep(s,a,b).blocked;
const home=s=>!s.world?.exploration&&!s.master.journey&&s.combat?.status!=='active';
export function sceneInteractionTarget(s,kind,id){
 if(!home(s))return null;
 const records=facilityRecords(s);
 if(kind==='building'){const record=records.find(r=>r.id===id);return record?{name:record.name,position:record.access,record}:null;}
 if(kind==='person'){const person=scenicHomeActors(s).find(d=>d.id===id);if(!person)return null;const facility=courtyardDestination(s,person,records);return facility?{name:person.name,position:facility.access,person,record:facility}:null;}
 return null;
}
export function sceneInteractionOptions(s,kind,id,checks={}){
 const target=sceneInteractionTarget(s,kind,id);if(!target)return [];
 if(kind==='person')return [{id:'talk',label:'走近交谈',personId:id,lock:''}];
 const {record:r}=target,type=r.type,rows=[];
 const add=(id,label,command,args=[],lock='')=>rows.push({id,label,command,args,lock});
 const status=!r.active?'设施停用或损坏，先恢复运行':'';
 add('inspect','走到入口查看',null);
 if(homeInteractions(s).some(o=>o.buildingId===id))add('story','走近询问当前旧事',null);
 if(['hall','house'].includes(type))add('rest','在此休憩','masterAction',['rest'],status);
 if(['hall','clinic'].includes(type))add('heal','在此调息疗伤','masterAction',['heal'],status||(s.master.wound<=0?'伤势已愈':!canPay(s,{herb:6})?'需灵草 6':''));
 if(['hall','meditation'].includes(type))add('cultivate','在此静心修炼','masterAction',['cultivate'],status||(s.master.wound>0?'先养好伤势':''));
 if(type==='library'){
  add('manuals','到藏经阁阅卷',null,[],status);
  for(const tid of s.doctrine.books){const t=TECHNIQUES[tid];if(!t)continue;const lock=checks.learningLock?.(s,s.master,tid,true)||'';add('study:'+tid,'研习'+t.name,'masterStudy',[tid],status||lock);}
  for(const [tid,k] of Object.entries(s.master.knowledge||{}))if(TECHNIQUES[tid]&&k>=TECHNIQUES[tid].teacherMastery)add('teach:'+tid,'讲授'+TECHNIQUES[tid].name,'masterTeach',[tid],status||(s.master.wound>0?'先养好伤势':''));
 }
 if(type==='alchemy'){
  add('alchemy','到丹房查看炉火',null,[],status);
  for(const [rid,r] of Object.entries(RECIPES))add('craft:'+rid,'开炉炼'+r.name,'craft',[rid],status||(checks.craftLock?.(s,rid)||s.crafting&&'丹炉正在炼制'||!canPay(s,r.cost)&&'炼丹材料不足'||''));
 }
 if(['farm','lumber','quarry','granary','workshop','well','kitchen'].includes(type))add('production','到此查看生产供给',null,[],status);
 return rows;
}
export function requestSceneInteraction(s,kind,id,action,position=null){
 const target=sceneInteractionTarget(s,kind,id),option=sceneInteractionOptions(s,kind,id).find(o=>o.id===action);
 if(!target||!option)throw Error('此对象已不在山院，或不提供这项互动。');
 if(option.lock)throw Error(option.lock);
 const goal=position&&Number.isFinite(position.x)&&Number.isFinite(position.y)?position:target.position;
 const prior=structuredClone(s.master),intent={kind,id,action,target:{x:goal.x,y:goal.y}};
 if(!arrived(s,scenicPosition(s.master),goal)&&!startScenicWalk(s.master,goal,s)){Object.assign(s.master,prior);throw Error('此处暂时无法抵达，请检查道路。');}
 s.master.sceneIntent=intent;
 return {ready:arrived(s,scenicPosition(s.master),goal),name:target.name,label:option.label};
}
export function cancelSceneInteraction(s){s.master.sceneIntent=null;return true;}
export function sceneInteractionReady(s,position=null){
 const intent=s.master.sceneIntent;if(!intent)return null;
 const target=sceneInteractionTarget(s,intent.kind,intent.id),option=sceneInteractionOptions(s,intent.kind,intent.id).find(o=>o.id===intent.action);
 if(!target||!option||option.lock)return {intent,cancelled:true,reason:option?.lock||'对象的状态已经变化，请重新选择互动。'};
 const goal=intent.kind==='building'?target.position:position||target.position;
 return arrived(s,scenicPosition(s.master),goal)?{intent,option,target}:null;
}
export function validateSceneIntent(intent){
 if(intent===undefined||intent===null)return true;
 return ['building','person'].includes(intent.kind)&&Number.isSafeInteger(intent.id)&&intent.id>0&&typeof intent.action==='string'&&intent.action.length<=80&&intent.target&&Number.isFinite(intent.target.x)&&Number.isFinite(intent.target.y)&&intent.target.x>=0&&intent.target.x<=1680&&intent.target.y>=0&&intent.target.y<=960;
}
