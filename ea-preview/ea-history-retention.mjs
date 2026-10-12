/** Issue #6 / SR002,019,030: bounded audit history, never a gameplay authority.
 * Unknown facts, production/accounting results and general journeys stay live.
 * Only the audited classes below may be summarized, after their effects applied.
 */
export const HISTORY_POLICY=Object.freeze({version:'history-retention:v1',intervalTicks:600,
 weather:120,ecologyDamage:120,dailySupplyPerPerson:2,merchantArrival:20,merchantTravel:32});
const classes=['weather','ecology-damage','daily-supply-relation','merchant-arrival','merchant-travel'];
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
function factClass(f){
 if(['weather','ecology-damage','daily-supply-relation'].includes(f?.kind))return f.kind;
 if(f?.kind==='inventory-transaction'&&f.operation==='merchant-arrival')return 'merchant-arrival';
 return null;
}
function auditedFact(s,f,kind){
 if(kind==='weather')return f.id===`fact:weather:yunxiu:${f.atTick}`&&f.regionId==='region:yunxiu'&&['clear','rain','fog','wind'].includes(f.phase);
 if(kind==='ecology-damage')return f.id===`fact:crop-water:${f.atTick}`&&f.sceneId==='scene:yunxiu-courtyard'&&f.cause==='waterlogging'&&f.resource==='herb'&&finite(f.quantity)&&f.quantity>=0;
 if(kind==='merchant-arrival')return f.id.startsWith('fact:merchant-arrival:travel:merchant:in:')&&f.actorId==='person:merchant-qingxi'&&f.targetStockpileId==='stockpile:qingxi';
 const clamp=n=>Math.max(0,Math.min(100,n));
 return !!s.personsById[f.personId]&&integer(f.dayIndex)&&f.dayIndex<=Math.floor(s.worldTick/s.ticksPerDay)&&f.id===`fact:person-daily-supply:${f.personId}:${f.dayIndex}`&&
  f.source==='economy.daily-supply'&&f.sourceDay===f.dayIndex&&integer(f.starvation)&&f.supplied===(f.starvation===0)&&
  finite(f.trustBefore)&&f.trustBefore>=0&&f.trustBefore<=100&&finite(f.trustAfter)&&f.trustAfter>=0&&f.trustAfter<=100&&finite(f.deltaTrust)&&
  Math.abs(f.trustAfter-clamp(f.trustBefore+(f.supplied?(f.trustBefore<45?.8:0):-2)))<=1e-8&&Math.abs(f.deltaTrust-(f.trustAfter-f.trustBefore))<=1e-8;
}
function auditedTravel(s,t){
 return t.id.startsWith('travel:merchant:')&&integer(t.startedTick)&&t.startedTick<=t.completedTick&&integer(t.lastStepTick)&&t.lastStepTick<=s.worldTick&&
  integer(t.durationTicks)&&t.durationTicks>0&&t.progressTicks===t.durationTicks&&Array.isArray(t.participantIds)&&t.participantIds.length===1&&t.participantIds[0]==='person:merchant-qingxi'&&
  !!s.personsById[t.participantIds[0]]&&!!s.scenesById[t.sourceSceneId]&&!!s.scenesById[t.destinationSceneId]&&!!s.stockpilesById[t.cargoStockpileId];
}
function initialize(s){
 s.historyRetention??={version:HISTORY_POLICY.version,lastPrunedTick:s.worldTick-s.worldTick%HISTORY_POLICY.intervalTicks,
  summaries:Object.fromEntries(classes.map(kind=>[kind,{count:0,firstTick:null,lastTick:null}]))};
 return s.historyRetention;
}
function missingHistoryReference(s,value){
 let missing=false;
 const walk=v=>{
  if(typeof v==='string'){if(v.startsWith('fact:')&&!Object.hasOwn(s.factsById,v)||v.startsWith('travel:')&&!Object.hasOwn(s.travelsById,v))missing=true;return;}
  if(v&&typeof v==='object')for(const [key,child]of Object.entries(v)){walk(key);walk(child);}
 };
 walk(value);return missing;
}
/** Shared strings include nested evidence, container keys, receipts and positions.
 * Prefixes embedded in result IDs also protect their named original record.
 */
function visitReferences(value,mark,seen=new Set()){
 if(typeof value==='string'){
  mark(value);
  for(const prefix of ['fact:','travel:']){const at=value.indexOf(prefix);if(at>0)mark(value.slice(at));}
  return;
 }
 if(!value||typeof value!=='object'||seen.has(value))return;
 seen.add(value);
 for(const [key,child]of Object.entries(value)){visitReferences(key,mark,seen);visitReferences(child,mark,seen);}
}
export function historyReferences(s,initialKeep=[]){
 const keep=new Set(),queue=[];
 const mark=id=>{if(!keep.has(id)&&(Object.hasOwn(s.factsById,id)||Object.hasOwn(s.travelsById,id))){keep.add(id);queue.push(id);}};
 for(const [key,value]of Object.entries(s))if(!['factsById','travelsById','historyRetention'].includes(key))visitReferences(value,mark);
 for(const id of initialKeep)mark(id);
 for(let i=0;i<queue.length;i++)visitReferences(s.factsById[queue[i]]??s.travelsById[queue[i]],mark);
 return keep;
}
/** Called only at a deterministic world-step boundary, never by a read/view/save.
 * Old saves receive no changes until they have been validated and actually tick.
 */
export function pruneHistory(s,{force=false}={}){
 if(!s.contracts||!s.travelsById||!s.factsById)return {facts:0,travels:0};
 const meta=initialize(s);
 if(!force&&s.worldTick-meta.lastPrunedTick<HISTORY_POLICY.intervalTicks)return {facts:0,travels:0};
 const keep=[],groups=new Map(),candidates=[];
 const add=(group,limit,f)=>{if(!groups.has(group))groups.set(group,{limit,records:[]});groups.get(group).records.push(f);};
 for(const [id,f]of Object.entries(s.factsById)){
  const kind=factClass(f);
  // A malformed/incomplete record must survive for the strict loader to reject.
  if(!kind||f.id!==id||!integer(f.atTick)||f.atTick>s.worldTick||!auditedFact(s,f,kind)||missingHistoryReference(s,f)){keep.push(id);continue;}
  candidates.push({id,kind,tick:f.atTick,table:s.factsById});
  if(kind==='daily-supply-relation'){
   add(kind+':'+f.personId,HISTORY_POLICY.dailySupplyPerPerson,f);
   if([s.society?.lastDay,s.economy?.lastSupplyDay,Math.floor(s.worldTick/s.ticksPerDay)].includes(f.dayIndex))keep.push(id);
  }else add(kind,kind==='weather'?HISTORY_POLICY.weather:kind==='ecology-damage'?HISTORY_POLICY.ecologyDamage:HISTORY_POLICY.merchantArrival,f);
 }
 // The economy panel exposes the last 20 entries in insertion order.
 keep.push(...Object.values(s.factsById).filter(f=>f.kind==='inventory-transaction').slice(-20).map(f=>f.id));
 for(const [id,t]of Object.entries(s.travelsById)){
  if(t.kind!=='merchant-travel'||t.status!=='completed'||t.id!==id||!integer(t.completedTick)||t.completedTick>s.worldTick||!auditedTravel(s,t)||missingHistoryReference(s,t)){keep.push(id);continue;}
  candidates.push({id,kind:'merchant-travel',tick:t.completedTick,table:s.travelsById});
  add('merchant-travel',HISTORY_POLICY.merchantTravel,{id,atTick:t.completedTick});
 }
 for(const {limit,records}of groups.values()){
  records.sort((a,b)=>b.atTick-a.atTick||(a.id<b.id?-1:a.id>b.id?1:0));keep.push(...records.slice(0,limit).map(f=>f.id));
 }
 const reachable=historyReferences(s,keep),removed={facts:0,travels:0};
 for(const {id,kind,tick,table}of candidates)if(!reachable.has(id)){
  const summary=meta.summaries[kind];summary.count++;summary.firstTick=summary.firstTick===null?tick:Math.min(summary.firstTick,tick);
  summary.lastTick=summary.lastTick===null?tick:Math.max(summary.lastTick,tick);
  delete table[id];removed[table===s.factsById?'facts':'travels']++;
 }
 meta.lastPrunedTick=s.worldTick;return removed;
}
export function validateHistoryRetention(s){
 const h=s?.historyRetention;if(h===undefined)return true; // Supported schema-6 saves predate this policy.
 const fail=()=>{throw Error('历史归档版本、时钟或摘要异常。');};
 if(!h||h.version!==HISTORY_POLICY.version||!integer(h.lastPrunedTick)||h.lastPrunedTick>s.worldTick||!h.summaries||Object.keys(h.summaries).length!==classes.length)fail();
 for(const kind of classes){const r=h.summaries[kind];if(!r||!integer(r.count)||r.count===0&&(r.firstTick!==null||r.lastTick!==null)||r.count>0&&(!integer(r.firstTick)||!integer(r.lastTick)||r.firstTick>r.lastTick||r.lastTick>h.lastPrunedTick))fail();}
 return true;
}
