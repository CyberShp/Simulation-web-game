/** SR-XF-002/030: shared contracts. No clock, render or domain simulation lives here. */
export const SR_CONTENT_VERSION='sr-content-v1.2';
export const SR_RULESET_VERSION='sr-runtime-v1.2';
export const CONTRACT_VERSION=1;
export const CONTRACT_TABLES={
 scenesById:'scene',itemsById:'item',editionsById:'edition',organizationsById:'organization',factionsById:'faction',locationsById:'location',routesById:'route',travelsById:'travel',eventsById:'event',ecologiesBySceneId:'scene',weatherByRegionId:'region',schemesById:'scheme',claimsById:'claim',opportunitiesById:'opportunity',investigationsById:'investigation',divinationsById:'divination',crisesById:'crisis',combatSessionsById:'combat',hazardsById:'hazard',deathRecordsByPersonId:'person'
};
export const EFFECT_ORDER=Object.freeze(['protection','stabilization','contact-damage','ongoing-loss','recovery','death','observation']);
export const CONTRACT_ERRORS=Object.freeze({version:'unsupported-version',reference:'invalid-reference',stale:'stale-revision',identity:'invalid-identity',permission:'not-authorized',duplicate:'command-id-conflict',shape:'invalid-contract',placement:'pending-placement',save:'save-failed'});
const record=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const prefixes={personsById:'person',buildingsById:'building',activitiesById:'activity',workOrdersById:'work',reservationsById:'reservation',stockpilesById:'stockpile',factsById:'fact',...CONTRACT_TABLES};
const historicalPhases=new Set(['completed','cancelled','failed','interrupted','settled','won','lost','retreated','closed','resolved','delivered','returned']);
const ephemeralTables=new Set(['reservationsById','activitiesById','workOrdersById','combatSessionsById','travelsById']);
const references={speakerId:'personsById',carrierId:'personsById',custodianId:'personsById',sourceFactId:'factsById',anchorFactId:'factsById',personId:'personsById',actorId:'personsById',recipientId:'personsById',sourcePersonId:'personsById',targetPersonId:'personsById',sceneId:'scenesById',localSceneId:'scenesById',editionId:'editionsById',routeId:'routesById',organizationId:'organizationsById',factionId:'factionsById',locationId:'locationsById',travelId:'travelsById',eventId:'eventsById',rootChainId:'opportunitiesById',schemeId:'schemesById',crisisId:'crisesById',combatSessionId:'combatSessionsById',activityId:'activitiesById',workOrderId:'workOrdersById',reservationId:'reservationsById',itemId:'itemsById'};
export class ContractError extends Error{constructor(code,path,message){super(`${code} · ${path}：${message}`);this.name='ContractError';this.code=code;this.path=path;}}
const fail=(code,path,message)=>{throw new ContractError(code,path,message);};
function checkReference(s,table,id,path){if(id!==null&&id!==undefined&&(!s[table]||!Object.hasOwn(s[table],id)))fail(CONTRACT_ERRORS.reference,path,`缺失 ${table}/${id}`);}
function safeJSON(value,path='$',depth=0,seen=new Set()){
 if(depth>40)fail(CONTRACT_ERRORS.shape,path,'层级过深');
 if(value===null||typeof value==='boolean'||typeof value==='string')return;
 if(typeof value==='number'){if(!Number.isFinite(value))fail(CONTRACT_ERRORS.shape,path,'非有限数字');return;}
 if(typeof value!=='object'||seen.has(value)||![Object.prototype,Array.prototype,null].includes(Object.getPrototypeOf(value)))fail(CONTRACT_ERRORS.shape,path,'不可序列化字段');
 seen.add(value);for(const[k,v]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(k))fail(CONTRACT_ERRORS.shape,`${path}.${k}`,'禁止的键');safeJSON(v,`${path}.${k}`,depth+1,seen);}seen.delete(value);
}
/** Initialization never grants items, knowledge mastery, elapsed time or outcomes. */
export function initContracts(s,{activate=false}={}){
 if(s.schemaVersion!==6)fail(CONTRACT_ERRORS.version,'schemaVersion','仅支持结构6');
 for(const table of Object.keys(CONTRACT_TABLES))s[table]??={};
 s.transactions.outcomes??={};
 // Historical rain-artisan facts already name this stable place; no new scene unlock.
 s.locationsById['location:stonebridge']??={id:'location:stonebridge',name:'石桥驿'};
 s.contracts??={version:CONTRACT_VERSION,initializedAtTick:s.worldTick,moduleTicks:{},units:{tickMilliseconds:100,worldDistance:'metre',legacyScenicDistance:'pixel',legacyBuildingCondition:'percent',itemCondition:'ratio'}};
 s.migrationLedger??={version:1,atTick:s.worldTick,appliedKeys:[],pendingPlacements:{},legacyKnowledge:{},identityMap:{},storyFacts:{},resumeNotes:[]};
 // A default scene identity does not change spatial transforms or generate facilities.
 s.scenesById['scene:yunxiu-courtyard']??={id:'scene:yunxiu-courtyard',name:'云岫别院',regionId:'region:yunxiu',coordinateUnit:'metre'};
 for(const [id,p]of Object.entries(s.personsById)){
  if(activate||s.contentVersion===SR_CONTENT_VERSION)p.lifeStatus??='alive';
  const knowledge=id==='person:master'?p.knowledge:p.mind?.knowledge;
  s.migrationLedger.identityMap[id]??=id;
  for(const [art,n]of Object.entries(knowledge||{})){
   const key=`${id}/${art}`;s.migrationLedger.legacyKnowledge[key]??={personId:id,artId:art,legacyMastery:n,understanding:n,mastery:0,source:'legacy-compatible-knowledge'};
  }
 }
 if(s.story?.completed)s.migrationLedger.storyFacts.ending??={completed:true,ending:s.story.ending,atTick:s.worldTick,source:'legacy-completed',additionalTargetsAllowed:false};
 if(s.story&&!s.migrationLedger.storyFacts.progress)s.migrationLedger.storyFacts.progress={clues:(s.story.clues||[]).slice(),preparations:{...s.story.preparations},claimed:(s.story.claimed||[]).slice(),revengeDone:!!s.story.revengeDone,source:'legacy-recorded-results'};
 const migrationKey='sr-contracts-v1';if(!s.migrationLedger.appliedKeys.includes(migrationKey))s.migrationLedger.appliedKeys.push(migrationKey);
 if(activate){s.contentVersion=SR_CONTENT_VERSION;s.rulesetVersion=SR_RULESET_VERSION;}
 return s;
}
/** Strict shared references; domain rules additionally use validateX. */
export function validateContracts(s){
 if(s.schemaVersion!==6)fail(CONTRACT_ERRORS.version,'schemaVersion','未知结构');
 if(!s.contracts)return true; // Supported opening schema 6 can be loaded before upgrade.
 safeJSON(s);
 const c=s.contracts,m=s.migrationLedger;
 if(c.version!==CONTRACT_VERSION||!integer(c.initializedAtTick)||c.initializedAtTick>s.worldTick||!record(s.transactions.outcomes)||!record(c.moduleTicks)||c.units?.tickMilliseconds!==100||c.units?.worldDistance!=='metre')fail(CONTRACT_ERRORS.shape,'contracts','契约版本、时钟或单位无效');
 if(!m||m.version!==1||!integer(m.atTick)||m.atTick>s.worldTick||!Array.isArray(m.appliedKeys)||new Set(m.appliedKeys).size!==m.appliedKeys.length||!record(m.pendingPlacements)||!record(m.legacyKnowledge)||!record(m.identityMap)||!record(m.storyFacts)||!Array.isArray(m.resumeNotes))fail(CONTRACT_ERRORS.shape,'migrationLedger','迁移账本无效');
 for(const [module,tick]of Object.entries(c.moduleTicks))if(!integer(tick)||tick>s.worldTick)fail(CONTRACT_ERRORS.shape,`contracts.moduleTicks.${module}`,'模块游标不能越过世界时钟');
 for(const [table,prefix]of Object.entries(prefixes)){
  if(!record(s[table]))fail(CONTRACT_ERRORS.shape,table,'缺少主表');
  for(const [id,e]of Object.entries(s[table])){
   if(!record(e)||!(id.startsWith(prefix+':')||table==='opportunitiesById'&&id.startsWith('root:')))fail(CONTRACT_ERRORS.identity,`${table}.${id}`,'ID前缀或记录异常');
   const identity=table==='personsById'?e.personId:table==='buildingsById'?e.instanceId:table==='deathRecordsByPersonId'?e.personId:e.id??e.instanceId;
   // weather/ecology uses key identity; other records must carry an explicit ID.
   if(identity!==undefined&&identity!==id||identity===undefined&&!['weatherByRegionId','ecologiesBySceneId'].includes(table))fail(CONTRACT_ERRORS.identity,`${table}.${id}`,'主键与实体ID不一致');
   for(const[field,target]of Object.entries(references))if(Object.hasOwn(e,field)&&!(table==='personsById'&&field==='personId')&&!(table==='ecologiesBySceneId'&&field==='sceneId')){
    const historical=(historicalPhases.has(e.phase)||historicalPhases.has(e.status)||['factsById','eventsById','deathRecordsByPersonId'].includes(table))&&ephemeralTables.has(target);
    if(!historical||s[target]?.[e[field]])checkReference(s,target,e[field],`${table}.${id}.${field}`);
   }
   for(const field of ['participantIds','knownByIds','recipients'])if(Object.hasOwn(e,field)){
    if(!Array.isArray(e[field])||new Set(e[field]).size!==e[field].length)fail(CONTRACT_ERRORS.shape,`${table}.${id}.${field}`,'人物引用列表异常');
    for(const personId of e[field])checkReference(s,'personsById',personId,`${table}.${id}.${field}`);
   }
   for(const[field,value]of Object.entries(e))if(field.endsWith('Tick')&&value!==null&&(!integer(value)||field==='atTick'&&value>s.worldTick))fail(CONTRACT_ERRORS.shape,`${table}.${id}.${field}`,'tick字段须为非负整数');
  }
 }
 for(const[id,p]of Object.entries(s.personsById)){
  if(!(p.lifeStatus===undefined&&s.contentVersion!==SR_CONTENT_VERSION)&&!['alive','dead'].includes(p.lifeStatus))fail(CONTRACT_ERRORS.shape,`personsById.${id}.lifeStatus`,'生命周期无效');
  if(p.lifeStatus==='dead'&&!s.deathRecordsByPersonId[id])fail(CONTRACT_ERRORS.reference,`personsById.${id}.lifeStatus`,'身死缺唯一记录');
  if(p.lifeStatus==='alive'&&s.deathRecordsByPersonId[id])fail(CONTRACT_ERRORS.shape,`deathRecordsByPersonId.${id}`,'活人已有身死记录');
  if(p.position?.kind){if(!['scene','worldTravel','contained'].includes(p.position.kind))fail(CONTRACT_ERRORS.shape,`personsById.${id}.position.kind`,'位置枚举无效');if(p.position.kind==='scene'){checkReference(s,'scenesById',p.position.sceneId,`personsById.${id}.position.sceneId`);if(!finite(p.position.x)||!finite(p.position.y))fail(CONTRACT_ERRORS.shape,`personsById.${id}.position`,'坐标须为有限逻辑米');}if(p.position.kind==='worldTravel'){checkReference(s,'travelsById',p.position.travelId,`personsById.${id}.position.travelId`);const body=s.activitiesById[p.activityId];if(body&&!['travel','sr-travel'].includes(body.kind)&&!historicalPhases.has(body.phase))fail(CONTRACT_ERRORS.shape,`personsById.${id}.activityId`,'在途身体不能同时在本地执行另一活动');}}
 }
 for(const[id,item]of Object.entries(s.itemsById)){
  if(typeof item.definitionId!=='string'||!item.definitionId||!finite(item.condition)||item.condition<0||item.condition>1)fail(CONTRACT_ERRORS.shape,`itemsById.${id}`,'定义ID或状况须为0–1');
  if(typeof item.ownerId!=='string'||![s.personsById,s.organizationsById].some(t=>Object.hasOwn(t,item.ownerId)))fail(CONTRACT_ERRORS.reference,`itemsById.${id}.ownerId`,'归属不存在');
  const l=item.location;if(!record(l)||!['person','stockpile','scene','building','travel','destroyed'].includes(l.kind))fail(CONTRACT_ERRORS.shape,`itemsById.${id}.location`,'物品须有唯一实体位置');
  const table={person:'personsById',stockpile:'stockpilesById',scene:'scenesById',building:'buildingsById',travel:'travelsById'}[l.kind];if(table&&(typeof l.id!=='string'||!Object.hasOwn(s[table],l.id)))fail(CONTRACT_ERRORS.reference,`itemsById.${id}.location.id`,'物品位置引用缺失');if(table)checkReference(s,table,l.id,`itemsById.${id}.location.id`);
 }
 for(const[id,outcome]of Object.entries(s.transactions.outcomes))if(outcome.id!==id||typeof outcome.signature!=='string'||!integer(outcome.revision)||outcome.revision>s.revision||outcome.status!=='committed')fail(CONTRACT_ERRORS.shape,`transactions.outcomes.${id}`,'命令结果账本无效');
 return true;
}
/** Idempotent per-module cursor. Caller advances worldTick exactly once. */
export function beginContractTick(s,module){
 if(!s.contracts)fail(CONTRACT_ERRORS.shape,'contracts','模块尚未初始化');
 const last=s.contracts.moduleTicks[module];if(last===s.worldTick)return false;
 if(last!==undefined&&last>s.worldTick)fail(CONTRACT_ERRORS.stale,`contracts.moduleTicks.${module}`,'不能倒退世界步');
 s.contracts.moduleTicks[module]=s.worldTick;return true;
}
/** Content activation is two-phase: validate isolated definitions before caller uses them. */
export function validateContentDefinitions(input){
 safeJSON(input);if(input?.version!==1||input.contentVersion!==SR_CONTENT_VERSION)fail(CONTRACT_ERRORS.version,'definitions.contentVersion','未知内容版本');
 const tables=['persons','items','scenes','routes','claims','crises','activities','authorCards'];
 for(const table of tables)if(!record(input[table]))fail(CONTRACT_ERRORS.shape,`definitions.${table}`,'缺少定义表');
 const all=new Set();for(const table of tables)for(const[id,d]of Object.entries(input[table])){if(!record(d)||d.id!==id||all.has(id))fail(CONTRACT_ERRORS.identity,`definitions.${table}.${id}`,'定义ID无效或重复');all.add(id);}
 for(const table of tables)for(const[id,d]of Object.entries(input[table])){
  if(!Array.isArray(d.references))fail(CONTRACT_ERRORS.shape,`definitions.${table}.${id}.references`,'引用列表必填');
  for(const ref of d.references)if(!all.has(ref))fail(CONTRACT_ERRORS.reference,`definitions.${table}.${id}.references`,'缺失定义 '+ref);
  if(table==='activities'&&(!Number.isSafeInteger(d.durationTicks)||d.durationTicks<1||!EFFECT_ORDER.includes(d.effectLayer)))fail(CONTRACT_ERRORS.shape,`definitions.activities.${id}`,'动作时长/效果层无效');
  if(table==='authorCards'&&(!record(d.truth)||!Array.isArray(d.clues)||!Array.isArray(d.outcomes)||!['user-confirmed','recommended','tunable'].includes(d.sourceStatus)))fail(CONTRACT_ERRORS.shape,`definitions.authorCards.${id}`,'作者真相、线索、结果与来源必填');
 }
 return structuredClone(input);
}
/** Atomic transaction adapter. Result state must replace caller state after commit. */
export function executeContractCommand(s,command,{handlers={},clone=x=>structuredClone(x),validate=validateContracts}={}){
 const reject=(code,path,message)=>({state:s,status:'rejected',commandId:command?.id??null,revision:s.revision,reasonCodes:[code],message:`${path}：${message}`,transactionId:null,changedIds:[],saveStatus:'unchanged',result:null,replayed:false});
 if(!record(command)||typeof command.id!=='string'||!/^command:[a-z0-9:-]{1,100}$/i.test(command.id)||!Array.isArray(command.args))return reject(CONTRACT_ERRORS.shape,'command','ID或参数无效');
 const signature=JSON.stringify([command.name,command.actorId??'person:master',command.args]);
 const prior=s.transactions?.outcomes?.[command.id]??s.transactions?.receipts.find(x=>x.id===command.id);
 if(prior){if(prior.signature!==signature&&prior.signature!==JSON.stringify([command.name,command.args]))return reject(CONTRACT_ERRORS.duplicate,'command.id','编号不能复用于其他命令');return{state:s,status:'already-applied',commandId:command.id,revision:s.revision,reasonCodes:[],transactionId:`transaction:${command.id}`,changedIds:[],result:structuredClone(prior.result),saveStatus:'unchanged',replayed:true};}
 if(/^command:[1-9][0-9]*$/.test(command.id)&&command.id!==`command:${s.transactions.nextCommandId}`)return reject(CONTRACT_ERRORS.stale,'command.id','旧命令编号已失效，不能重新执行');
 if(command.expectedRevision!==s.revision)return reject(CONTRACT_ERRORS.stale,'command.expectedRevision','世界状态已更新，请重新选择');
 if((command.actorId??'person:master')!=='person:master')return reject(CONTRACT_ERRORS.permission,'command.actorId','只能直接控制掌门');
 if(typeof handlers[command.name]!=='function')return reject(CONTRACT_ERRORS.shape,'command.name','未知命令');
 const next=clone(s);initContracts(next);
 try{
  const value=handlers[command.name](next,...command.args),result=value===undefined?true:structuredClone(value);
  next.revision++;next.transactions.nextCommandId++;
  const receipt={id:command.id,signature,result,revision:next.revision,status:'committed'};next.transactions.outcomes[command.id]=receipt;
  next.transactions.receipts.push(receipt);next.transactions.receipts=next.transactions.receipts.slice(-128);
  const validated=validate(next),committedState=validated&&typeof validated==='object'?validated:next;
  return{state:committedState,status:'committed',commandId:command.id,revision:next.revision,reasonCodes:[],transactionId:`transaction:${command.id}`,changedIds:[],result,saveStatus:'not-yet-saved',replayed:false};
 }catch(error){return reject(error.code??CONTRACT_ERRORS.shape,error.path??'command',error.message);}
}
/** Player knowledge only. Never exposes author truth or real remote coordinates. */
export function knowledgeView(s,{observerId='person:master'}={}){
 const observer=s.personsById[observerId];if(!observer)fail(CONTRACT_ERRORS.reference,'observerId','观察者不存在');
 const known=new Set(observer.knownClaimIds??[]);
 return Object.values(s.claimsById??{}).filter(c=>c.public===true||known.has(c.id)||(c.knownByIds??[]).includes(observerId)||(c.recipients??[]).includes(observerId)).map(c=>structuredClone({id:c.id,text:c.text,sourcePersonId:c.sourcePersonId??c.speakerId??null,observedAtTick:c.observedAtTick??c.observedTick??null,receivedAtTick:c.receivedAtTick??c.issuedTick??null,locationHint:c.locationHint??null,certainty:c.certainty??c.verification??'unverified'}));
}
/** Isolation + original text retention; storage changes only after backup succeeds. */
export function prepareMigration(raw,{validateLegacy,migrate,validate=validateContracts}={}){
 const source=typeof raw==='string'?JSON.parse(raw):structuredClone(raw);const originalRaw=typeof raw==='string'?raw:JSON.stringify(raw);
 if(source.schemaVersion!==undefined&&source.schemaVersion!==6||source.schemaVersion===undefined&&(!Number.isSafeInteger(source.version)||source.version<1||source.version>5))fail(CONTRACT_ERRORS.version,'schemaVersion/version','未知存档版本，原档保留');
 const state=source.schemaVersion===6?structuredClone(source):migrate(validateLegacy(structuredClone(source)),{sourceVersion:source.version});
 initContracts(state);validate(state);return{state,originalRaw,fromVersion:source.schemaVersion??source.version,atTick:state.worldTick,offlineTicksApplied:0};
}
export function commitMigration(prepared,{backup,write}={}){
 try{backup(prepared.originalRaw);write(JSON.stringify(prepared.state));return{ok:true,state:prepared.state,saveStatus:'saved'};}
 catch(error){return{ok:false,state:prepared.state,originalRaw:prepared.originalRaw,saveStatus:'save-failed',reasonCodes:[CONTRACT_ERRORS.save],message:'迁移未保存；原档保留，可导出内存进度：'+error.message};}
}
