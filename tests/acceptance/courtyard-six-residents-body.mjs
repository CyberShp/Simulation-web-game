import {eastVisibleGroundPoint} from '../../src/simulation/ea-courtyard-east-visible-geometry.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {repositoryRoot} from './desktop-target.mjs';
import {restoreSect} from '../../apps/courtyard/sect-sim.mjs';
/** Strict existing body/doorway policy copied unchanged from sealed seekers chain. */
import {toArt,isArtWalkable} from '../../apps/courtyard/courtyard-space.mjs';
import {spatialRoom,polygonContains,meterCanStand,meterSweep} from '../../src/simulation/ea-sr-spatial.mjs';
import {northLibraryTerrainContains} from '../../src/simulation/ea-sect-domain.mjs';
import {slotById} from '../../src/simulation/ea-facility-slots.mjs';
function doorwayFootRoom(person,s){
 if(!s)return null;const p=s.personsById[person.id],a=s.activitiesById[p?.activityId],b=s.buildingsById[a?.targetId],room=b&&spatialRoom(b),r=s.reservationsById[a?.reservationId],scenic=p?.scenic||p?.mind?.scenic;
 if(!room||a?.kind!=='facility'||a.phase!=='navigating'||a.personId!==person.id||r?.kind!=='slot'||r.personId!==person.id||r.activityId!==a.id||r.slotId!==a.slotId)return null;
 const slot=slotById(s,a.slotId),holder=s.spatial?.doorQueuesByEntryId?.[`${b.instanceId}/entry:south`]?.holder;
 if(slot?.buildingId!==b.id||!polygonContains(slot.position,room.floor)||holder?.phase!=='in'||holder.personId!==person.id||holder.activityId!==a.id||!scenic?.path?.length)return null;
 const dist=(x,y)=>Math.hypot(x.x-y.x,x.y-y.y),door=room.door;
 if(Math.abs(person.y-door.y)>.26+1e-8||Math.abs(person.x-door.x)+.26>.7+1e-8||dist(person,p.position)>1e-8||dist(person,scenic)>1e-8||dist(scenic.path.at(-1),slot.position)>1e-8||!holder.target||dist(holder.target,slot.position)>1e-8||!scenic.goal||dist(scenic.goal,slot.position)>1e-8)return null;
 if(!meterCanStand(s,person,.26)||meterSweep(s,person,door,.26).blocked)return null;
 let from=person,crossed=false;for(const to of scenic.path){if((from.y-door.y)*(to.y-door.y)<=0&&Math.abs(to.y-from.y)>1e-9){const x=from.x+(to.x-from.x)*(door.y-from.y)/(to.y-from.y);if(Math.abs(x-door.x)+.26<=.7+1e-8)crossed=true;}if(meterSweep(s,from,to,.26).blocked)return null;from=to;}
 return crossed?room:null;
}
function circlePointOnGround(point,domain){if(point.x>=118.74&&point.x<156.26)return eastVisibleGroundPoint(point,{residences:domain.residencesEnabled});if(domain.northLibraryEnabled&&point.y<1)return northLibraryTerrainContains(point,0,domain.northMeditationEnabled?'north-meditation-1':null);const a=toArt(point.x,point.y);return isArtWalkable(a.x,a.y,{valley:domain.valleyEnabled,west:domain.westEnabled,domain:domain.enabled,residences:domain.residencesEnabled,services:domain.servicesEnabled,northLibrary:domain.northLibraryEnabled,northMeditation:domain.northMeditationEnabled});}
function circleOnGround(person,domain,s){const room=doorwayFootRoom(person,s);for(let i=-1;i<16;i++){const point={x:person.x+(i<0?0:.26*Math.cos(i*Math.PI/8)),y:person.y+(i<0?0:.26*Math.sin(i*Math.PI/8))},a=toArt(point.x,point.y);if(!(i<0?isArtWalkable(a.x,a.y,{valley:domain.valleyEnabled,west:domain.westEnabled,domain:domain.enabled,residences:domain.residencesEnabled,services:domain.servicesEnabled,northLibrary:domain.northLibraryEnabled,northMeditation:domain.northMeditationEnabled}):circlePointOnGround(point,domain))&&!(i>=0&&room&&polygonContains(point,room.floor)&&!meterSweep(s,person,point,0).blocked))return false;}return true;}
function feetClear(p,domain,s){const options={domain:domain.enabled,west:domain.westEnabled,valley:domain.valleyEnabled,residences:domain.residencesEnabled,services:domain.servicesEnabled,northLibrary:domain.northLibraryEnabled,northMeditation:domain.northMeditationEnabled},a=toArt(p.x,p.y);if(!isArtWalkable(a.x,a.y,options))return false;return !(p.x>=119&&p.x<156||domain.northLibraryEnabled&&(p.y<1||p.x>=18&&p.x<=47.62&&p.y>=1&&p.y<=34))||circleOnGround(p,domain,s);}

export {feetClear};

/** Restore an isolated read-only copy so geometry sees canonical derived getters. */
export function inspectSixResidentSample(raw,view,memberIds){
 const restored=restoreSect(raw),s=restored.state;
 const invalid=view.people.filter(p=>!p.indoor&&!feetClear(p,view.domain,s)).map(p=>p.id);
 const beds=[];
 for(const id of memberIds){const r=s.residentialHousing.recordsByPersonId[id],p=s.personsById[id],a=s.activitiesById[p.activityId];if(r?.home&&!r.pending&&a?.kind==='facility'&&a.action==='rest'&&a.phase==='executing'&&a.slotId===r.home.slotId){const slot=slotById(s,a.slotId);if(slot&&Math.hypot(p.position.x-slot.position.x,p.position.y-slot.position.y)<.04)beds.push({personId:id,tick:s.worldTick,home:r.home,position:p.position,activity:a});}}
 return {invalid,beds};
}
export async function runtimeHashes(){
 const files=[...fs.readdirSync(path.join(repositoryRoot,'src/simulation')).filter(x=>x.endsWith('.mjs')).map(x=>'src/simulation/'+x),...fs.readdirSync(path.join(repositoryRoot,'apps/courtyard')).filter(x=>/\.(mjs|cjs|html|css)$/.test(x)).map(x=>'apps/courtyard/'+x),...fs.readdirSync(path.join(repositoryRoot,'assets/courtyard')).filter(x=>/^(north-meditation|north-library|west-forest|west-workshops|east-services|east-residences|east-terrace|residence)/.test(x)).map(x=>'assets/courtyard/'+x)];
 return Object.fromEntries(files.sort().map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(repositoryRoot,file))).digest('hex')]));
}

/** Idempotent public pause toggle. Uses a lightweight manualPause status read
 * before and after the click; never toggles #pause twice for repeated pause(true). */
export async function setPausedIdempotent({ wanted, readStatus, click }) {
  if (typeof wanted !== 'boolean') throw new Error('wanted boolean required');
  if (typeof readStatus !== 'function' || typeof click !== 'function') throw new Error('readStatus/click required');
  const before = await readStatus();
  if (before === wanted) return { clicked: false, before, after: before };
  await click();
  const after = await readStatus();
  if (after !== wanted) throw new Error(`pause toggle failed: wanted ${wanted}, got ${after}`);
  return { clicked: true, before, after };
}

/** Paused native-save adapter: close public overlays, freeze final state, click
 * public save, and wait for the actual disk native to match that state. */
export async function saveNativePaused({ pause, closeDialogs, snapshot, clickSave, readNative, validate, timeoutMs = 15000, pollMs = 50 }) {
  await pause(true);
  await closeDialogs();
  const snap = await snapshot();
  if (snap?.manualPause !== true) throw new Error('save-not-paused');
  const requestedAt = Date.now();
  await clickSave();
  const waits = [];
  const deadline = requestedAt + timeoutMs;
  do {
    const bytes = await readNative();
    let data = null, readError = null;
    try { data = JSON.parse(bytes.toString()); } catch (error) { readError = error.message; }
    const tickMatch = data?.state?.worldTick === snap.tick;
    const stateEqual = !!data && JSON.stringify(data.state) === JSON.stringify(snap.state);
    const diskPaused = data?.courtyardPresentation?.manualPause === true;
    const valid = !!data && validate(data) === true;
    if (tickMatch && stateEqual && diskPaused && valid) {
      return { saved: data, bytes, tick: snap.tick, stateEqual: true, diskPaused, valid, paused: true, waits, finalPath: 'native-state-equal', finalSha: null };
    }
    waits.push({ atMs: Date.now() - requestedAt, readError, tickMatch, stateEqual, diskPaused, valid, oldSeed: !stateEqual });
    if (Date.now() >= deadline) break;
    await new Promise(r => setTimeout(r, pollMs));
  } while (true);
  const last = waits.at(-1) || {};
  throw new Error('native-save-timeout: ' + JSON.stringify(last));
}

/** Keep full snapshots in the renderer; transfer bounded projections on normal polls. */
export async function installSixResidentBrowserReader(page,memberIds,startTick){
 const bodySource=[doorwayFootRoom,circlePointOnGround,circleOnGround,feetClear].map(f=>f.toString()).join('\n');
 const urls={sim:'/sect-sim.mjs',space:'/courtyard-space.mjs',spatial:'/src/simulation/ea-sr-spatial.mjs',domain:'/src/simulation/ea-sect-domain.mjs',slots:'/src/simulation/ea-facility-slots.mjs',east:'/src/simulation/ea-courtyard-east-visible-geometry.mjs'};
 const install=async({urls,memberIds,startTick})=>{
  const {restoreSect}=await import(urls.sim),{toArt,isArtWalkable}=await import(urls.space),{spatialRoom,polygonContains,meterCanStand,meterSweep,nearestVisibleBodyGround}=await import(urls.spatial),{northLibraryTerrainContains}=await import(urls.domain),{slotById}=await import(urls.slots),{eastVisibleGroundPoint}=await import(urls.east);
  const inspect = null;
  window.__sixResidentBedEvidence={};const inherited=new Map(),recovered=new Set();let firstRead=true;
  window.__sixResidentRead=full=>{
   const started=performance.now(),q=window.courtyardQA,raw=q.snapshot(),view=q.renderer.view,inspection=inspect(raw,view,memberIds),s=raw.state;
   window.__sixResidentLastRaw=raw;
   if(firstRead){firstRead=false;if(s.worldTick===startTick&&q.status().manualPause){const restored=restoreSect(raw).state;for(const id of inspection.invalid){const person=s.personsById[id],position=person?.position,activity=s.activitiesById[person?.activityId];if(position?.x>=119&&position.x<156&&activity?.personId===id&&activity.kind==='facility'&&['rest','heal'].includes(activity.action)){const target=nearestVisibleBodyGround(restored,position);if(target&&target.distance<=8)inherited.set(id,{id,sourceTick:startTick,from:{x:position.x,y:position.y},target,activityId:activity.id,startedTick:activity.startedTick,slotId:activity.slotId});}}}}
   inspection.inheritedRecovery=[];
   inspection.invalid=inspection.invalid.filter(id=>{const original=inherited.get(id);if(!original||recovered.has(id))return true;const person=s.personsById[id],p=person.position,activity=s.activitiesById[person.activityId],reservation=s.reservationsById[activity?.reservationId],dx=original.target.x-original.from.x,dy=original.target.y-original.from.y,length=Math.hypot(dx,dy),projection=length?((p.x-original.from.x)*dx+(p.y-original.from.y)*dy)/(length*length):0,offLine=length?Math.abs((p.x-original.from.x)*dy-(p.y-original.from.y)*dx)/length:Math.hypot(p.x-original.from.x,p.y-original.from.y);const permitted=activity?.id===original.activityId&&activity.startedTick===original.startedTick&&activity.slotId===original.slotId&&reservation?.personId===id&&reservation.activityId===activity.id&&reservation.slotId===activity.slotId&&offLine<1e-6&&projection>=-1e-7&&projection<=1+1e-7;if(permitted)inspection.inheritedRecovery.push({...original,current:{x:p.x,y:p.y},atTick:s.worldTick});return !permitted;});
   for(const [id,original]of inherited)if(!inspection.invalid.includes(id)&&!inspection.inheritedRecovery.some(p=>p.id===id))recovered.add(id);
   inspection.recoveredInheritedIds=[...recovered];
   for(const observation of inspection.beds)if(!window.__sixResidentBedEvidence[observation.personId])window.__sixResidentBedEvidence[observation.personId]={observation,session:raw};
   if(inspection.invalid.length)window.__sixResidentInvalidEvidence={raw,view,inspection};
   const people=Object.fromEntries(['person:master',...memberIds].map(id=>{const p=s.personsById[id];return[id,{personId:id,position:p.position,energy:p.energy,xp:p.xp,wound:p.wound,activityId:p.activityId,scenic:p.scenic?{path:p.scenic.path}:null,mind:p.mind?{scenic:{path:p.mind.scenic?.path}}:null}];}));
   const small={state:{worldTick:s.worldTick,ticksPerDay:s.ticksPerDay,speed:s.speed,homeMemberIds:s.homeMemberIds,personsById:people,activitiesById:s.activitiesById,residentialHousing:s.residentialHousing,stockpilesById:{'stockpile:yunxiu':s.stockpilesById['stockpile:yunxiu']},economy:{starvation:s.economy.starvation},factsById:Object.fromEntries(Object.entries(s.factsById).filter(([id,f])=>f.atTick>=startTick&&(f.kind==='daily-supply-relation'||f.operation==='manual-harvest'||f.operation==='delivery')))}};
   return{raw:full?raw:small,full:!!full,view:{people:view.people.map(p=>({id:p.id,x:p.x,y:p.y,indoor:p.indoor})),domain:Object.fromEntries(Object.entries(view.domain).filter(([k])=>k==='enabled'||k.endsWith('Enabled')))},inspection,status:q.status(),metrics:{renderedFrames:q.metrics().renderedFrames},browserInspectMs:performance.now()-started};
  };
 };
 const installation=install.toString().replace('const inspect = null;',bodySource+'\nconst inspect = ('+inspectSixResidentSample.toString()+');');
 await page.evaluate('('+installation+')('+JSON.stringify({urls,memberIds,startTick})+')');
}
