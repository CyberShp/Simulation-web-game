/** Canonical identity tables. Legacy modules use non-serialized live adapters. */
import {appearance} from './ea-scenic.mjs?v=ea-160-courtyard-20261009-r37';
import {RESOURCES} from './ea-data.mjs?v=ea-160-courtyard-20261009-r37';
import {hydratePillTotals} from './ea-sr-economy.mjs?v=ea-160-courtyard-20261009-r37';
import {ContractError,initContracts,validateContracts,SR_CONTENT_VERSION,SR_RULESET_VERSION} from './ea-sr-contracts.mjs?v=ea-160-courtyard-20261009-r37';

export const SCHEMA_VERSION=6;
export const CONTENT_VERSION='opening-v1.2';
export const TICKS_PER_SECOND=10;
const versionPairs=new Set([
 'opening-runtime-1/legacy-ea-1.4.2','opening-runtime-1/opening-v1.2',
 'opening-runtime-2/legacy-ea-1.4.2','opening-runtime-2/opening-v1.2',
 'opening-runtime-3/opening-v1.2',`${SR_RULESET_VERSION}/${SR_CONTENT_VERSION}`,
]);
const srCoreVersions={srWorld:1,srGeography:1,srTransport:1,srWorldContent:1,srCrises:1,
 srEconomy:'economy:yunxiu:v1',srOrganization:'organization:yunxiu:v1',srEquipment:1,
 srCultivation:1,srCombat:1,srCovenants:1,srMother:1};
const srLaterVersions={srDescent:1,srAftermath:'aftermath:yunxiu:v1',srLateEconomy:'late-economy:qingxi:v1'};
const unsupported=(path,value)=>{throw new ContractError('unsupported-version',path,`未登记版本 ${String(value)}`);};
function versionField(record,field,expected,path,{required=false,optionalField=false}={}){
 if(record===undefined){if(required)unsupported(path,'缺失');return;}
 if(!record||typeof record!=='object'||Array.isArray(record))unsupported(path,record);
 if(!Object.hasOwn(record,field)){if(optionalField)return;unsupported(path,'缺失');}
 if(record[field]!==expected)unsupported(path,record[field]);
}
function validateVersionCombination(s){
 const rules=['opening-runtime-1','opening-runtime-2','opening-runtime-3',SR_RULESET_VERSION];
 const content=['opening-v1.2','legacy-ea-1.4.2',SR_CONTENT_VERSION];
 if(!rules.includes(s.rulesetVersion))unsupported('rulesetVersion',s.rulesetVersion);
 if(!content.includes(s.contentVersion))unsupported('contentVersion',s.contentVersion);
 if(!versionPairs.has(`${s.rulesetVersion}/${s.contentVersion}`))unsupported('rulesetVersion+contentVersion',`${s.rulesetVersion}/${s.contentVersion}`);
 const sr=s.contentVersion===SR_CONTENT_VERSION;
 if(!sr){
  if(s.spatial!==undefined)unsupported('spatial.version',s.spatial?.version);
  for(const field of [...Object.keys(srCoreVersions),...Object.keys(srLaterVersions)])if(s[field]!==undefined)unsupported(`${field}.version`,s[field]?.version);
 }
 if(s.contracts!==undefined||sr)versionField(s.contracts,'version',1,'contracts.version',{required:sr});
 if(s.migrationLedger!==undefined||sr)versionField(s.migrationLedger,'version',1,'migrationLedger.version',{required:sr});
 if(s.spatial!==undefined||sr){
  versionField(s.spatial,'version','spatial-metres-1','spatial.version',{required:sr});
  versionField(s.spatial,'extentVersion','courtyard-96-1','spatial.extentVersion',{optionalField:true});
  versionField(s.spatial,'buildingGridVersion','building-units-1','spatial.buildingGridVersion',{optionalField:true});
  versionField(s.spatial,'interiorLayoutVersion','adult-furniture-1','spatial.interiorLayoutVersion',{optionalField:true});
 }
 for(const [id,b]of Object.entries(s.buildingsById||{})){
  if(b?.buildingGridVersion!==undefined)versionField(b,'buildingGridVersion','building-units-1',`buildingsById.${id}.buildingGridVersion`);
  if(b?.interiorLayoutVersion!==undefined)versionField(b,'interiorLayoutVersion','adult-furniture-1',`buildingsById.${id}.interiorLayoutVersion`);
  if(b?.prefabId!==undefined){const expected=`prefab:${b.type}:${b.buildingGridVersion?'units':'metres'}:v1`;
   if(b.prefabId!==expected)unsupported(`buildingsById.${id}.prefabId`,b.prefabId);}
 }
 if(sr){
  for(const [field,version]of Object.entries(srCoreVersions))versionField(s[field],'version',version,`${field}.version`,{required:true});
  for(const [field,version]of Object.entries(srLaterVersions))if(s[field]!==undefined)versionField(s[field],'version',version,`${field}.version`,{required:true});
  if(s.srLateEconomy&&!s.story?.completed)unsupported('srLateEconomy.version',s.srLateEconomy.version);
 }
}
const accents=['#d6b673','#83b49c','#91a9ce','#c79078','#b29cc5','#a5ba70'];
const personKey=p=>p.personId||(p.id===undefined?'person:master':`person:yunxiu:${p.id}`);
const buildingKey=b=>b.instanceId||`building:yunxiu:${b.id}`;

function registerPerson(s,p){
 p.personId=personKey(p);if(s.contentVersion===SR_CONTENT_VERSION)p.lifeStatus??='alive';
 p.appearance??={spriteIndex:appearance(p.id===undefined?'master':p.id),accent:accents[(p.id||0)%accents.length]};
 s.personsById[p.personId]=p;
 return p.personId;
}
function registerBuilding(s,b){b.instanceId=buildingKey(b);s.buildingsById[b.instanceId]=b;return b.instanceId;}
function arrayView(s,ids,table,register){
 const list=ids.map(id=>table[id]);
 Object.defineProperty(list,'push',{value:(...records)=>{for(const record of records)ids.push(register(s,record));return ids.length;}});
 return list;
}

/** Adapters share the actual records; no second person/building/time authority. */
export function hydrateState(s){
 for(const a of Object.values(s.activitiesById))if(a?.kind==='construction'&&a.workOrderId&&s.workOrdersById[a.workOrderId]){
  delete a.progressTicks;delete a.totalTicks;
  Object.defineProperties(a,{progressTicks:{configurable:true,get:()=>s.workOrdersById[a.workOrderId].progressTicks},totalTicks:{configurable:true,get:()=>s.workOrdersById[a.workOrderId].durationTicks}});
 }
 Object.defineProperties(s,{
  master:{configurable:true,get:()=>s.personsById['person:master']},
  disciples:{configurable:true,get:()=>arrayView(s,s.homeMemberIds,s.personsById,registerPerson),set:people=>{s.homeMemberIds=people.map(p=>registerPerson(s,p));}},
  buildings:{configurable:true,get:()=>arrayView(s,Object.keys(s.buildingsById),s.buildingsById,registerBuilding),set:buildings=>{s.buildingsById={};for(const b of buildings)registerBuilding(s,b);}},
  time:{configurable:true,get:()=>s.schemaMigration.clockOriginTime+Math.floor((s.worldTick-s.schemaMigration.clockOriginTick)/TICKS_PER_SECOND)},
  resources:{configurable:true,get:()=>s.stockpilesById['stockpile:yunxiu'].resources},
 });
 Object.defineProperty(s.sim,'seed',{configurable:true,get:()=>s.rngState,set:value=>{s.rngState=value;}});
 hydratePillTotals(s);return s;
}
export function cloneState(s){return s.schemaVersion===6?hydrateState(structuredClone(s)):structuredClone(s);}

export function migrateState(legacy,{sourceVersion=5,newGame=false}={}){
 if(!newGame&&(!Number.isInteger(sourceVersion)||sourceVersion<1||sourceVersion>5))throw Error('存档校验失败：未知旧结构版本，原档保留');
 const source=structuredClone(legacy);
 const {version,master,disciples,buildings,time,resources,...rest}=source;
 const carry=rest.sim.carry,subticks=Math.floor((carry+1e-10)*TICKS_PER_SECOND);
 const s={...rest,schemaVersion:SCHEMA_VERSION,revision:0,rulesetVersion:'opening-runtime-1',
  contentVersion:newGame?CONTENT_VERSION:'legacy-ea-1.4.2',worldTick:Math.round(time*TICKS_PER_SECOND)+subticks,ticksPerDay:1200,
  rngState:rest.sim.seed,personsById:{},homeMemberIds:[],buildingsById:{},activitiesById:{},workOrdersById:{},reservationsById:{},factsById:{},
  stockpilesById:{'stockpile:yunxiu':{id:'stockpile:yunxiu',ownerId:'person:master',resources}},
  transactions:{nextCommandId:1,receipts:[]},schemaMigration:{from:newGame?0:sourceVersion,atTick:Math.round(time*TICKS_PER_SECOND),clockOriginTime:time,clockOriginTick:Math.round(time*TICKS_PER_SECOND),completedEndingPreserved:!!legacy.story.completed}};
 delete s.sim.seed;s.sim.carry=Math.max(0,carry-subticks/TICKS_PER_SECOND);
 master.personId='person:master';registerPerson(s,master);
 s.homeMemberIds=disciples.map(p=>registerPerson(s,p));
 for(const p of s.society?.departed||[]){p.compatibilityMode??='historical-only';registerPerson(s,p);}
 for(const b of buildings)registerBuilding(s,b);
 initContracts(s);
 return hydrateState(s);
}

/** A temporary v5 validation projection, never saved or simulated separately. */
export function legacyProjection(s){
 const {personsById,homeMemberIds,buildingsById,...rest}=s;
 return {...rest,personsById,resources:s.resources,version:5,time:s.time,master:s.master,disciples:s.disciples,buildings:s.buildings,sim:{...s.sim,seed:s.rngState}};
}

export function validateV6Shape(s){
 const fail=message=>{throw Error('存档校验失败：'+message);};
 if(s.version!==undefined)fail('结构版本冲突或尚不支持');
 if(s.schemaVersion!==SCHEMA_VERSION)unsupported('schemaVersion',s.schemaVersion);
 if(Object.keys(s).some(k=>['master','disciples','buildings','resources','time'].includes(k)))fail('含重复的旧版权威字段');
 for(const key of ['revision','worldTick'])if(!Number.isSafeInteger(s[key])||s[key]<0)fail('时钟或修订号异常');
 if(s.ticksPerDay!==1200)fail('世界日长度异常');
 validateVersionCombination(s);
 if(!s.sim||!Number.isFinite(s.sim.carry)||s.sim.carry<0||s.sim.carry>=.1)fail('时钟余量异常');
 for(const field of ['personsById','buildingsById','activitiesById','workOrdersById','reservationsById','stockpilesById','factsById'])if(!s[field]||typeof s[field]!=='object'||Array.isArray(s[field]))fail('主表容器异常');
 for(const a of Object.values(s.activitiesById))if(a?.kind==='construction'&&a.workOrderId&&Object.keys(a).some(k=>['progressTicks','totalTicks'].includes(k)))fail('营造含重复进度字段');
 if(!s.stockpilesById['stockpile:yunxiu'])fail('山院库存缺失');
 for(const [id,stockpile]of Object.entries(s.stockpilesById))if(stockpile?.id!==id||![s.personsById,s.organizationsById,s.factionsById].some(table=>table&&Object.hasOwn(table,stockpile.ownerId))||!stockpile.resources||Object.keys(stockpile.resources).length!==Object.keys(RESOURCES).length||!Object.keys(RESOURCES).every(k=>Number.isFinite(stockpile.resources[k])&&stockpile.resources[k]>=0))fail('库存归属或数量异常');
 if(!Array.isArray(s.homeMemberIds)||new Set(s.homeMemberIds).size!==s.homeMemberIds.length||s.homeMemberIds.includes('person:master')||!s.homeMemberIds.every(id=>s.personsById[id]))fail('人物引用异常');
 if(!s.personsById['person:master'])fail('掌门身份缺失');
 const ids=new Set();
 for(const [id,p]of Object.entries(s.personsById)){
  if(!/^person:[a-z0-9:-]{1,70}$/.test(id)||p?.personId!==id||typeof p.name!=='string'||!p.name.length||p.name.length>40||id!=='person:master'&&(!Number.isSafeInteger(p.id)||p.id<1||ids.has(p.id)))fail('持久人物身份异常');
  if(p.id!==undefined)ids.add(p.id);
  if(!p.appearance||!Number.isInteger(p.appearance.spriteIndex)||p.appearance.spriteIndex<0||p.appearance.spriteIndex>5||!/^#[a-f0-9]{6}$/i.test(p.appearance.accent))fail('持久外观异常');
 }
 for(const [id,b]of Object.entries(s.buildingsById))if(!/^building:yunxiu:[1-9][0-9]*$/.test(id)||b?.instanceId!==id||id!==`building:yunxiu:${b.id}`)fail('建筑引用异常');
 if(!s.society||s.society.nextPersonId<=Math.max(0,...ids))fail('人物编号已被占用');
 if(!s.schemaMigration||!Number.isSafeInteger(s.schemaMigration.from)||s.schemaMigration.from<0||s.schemaMigration.from>5||!Number.isSafeInteger(s.schemaMigration.atTick)||s.schemaMigration.atTick<0||s.schemaMigration.atTick>s.worldTick||typeof s.schemaMigration.completedEndingPreserved!=='boolean')fail('结构迁移记录异常');
 if(!Number.isFinite(s.schemaMigration.clockOriginTime)||s.schemaMigration.clockOriginTime<0||s.schemaMigration.clockOriginTick!==s.schemaMigration.atTick||s.schemaMigration.clockOriginTick!==Math.round(s.schemaMigration.clockOriginTime*10))fail('历史时钟映射异常');
 const t=s.transactions;
 if(!t||!Number.isSafeInteger(t.nextCommandId)||t.nextCommandId<1||!Array.isArray(t.receipts)||t.receipts.length>128||new Set(t.receipts.map(r=>r.id)).size!==t.receipts.length)fail('命令记录异常');
 for(const r of t.receipts)if(typeof r.id!=='string'||!/^command:[a-z0-9:-]{1,100}$/i.test(r.id)||/^command:[1-9][0-9]*$/.test(r.id)&&Number(r.id.slice(8))>=t.nextCommandId||!Number.isSafeInteger(r.revision)||r.revision<1||r.revision>s.revision||typeof r.signature!=='string'||r.signature.length>20000)fail('命令回执异常');
 validateContracts(s);
 return true;
}
