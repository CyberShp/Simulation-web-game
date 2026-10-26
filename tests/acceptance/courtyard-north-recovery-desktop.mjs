/** U-172 legacy-position fixture; official construction, recovery and material settlement. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {_electron} from 'playwright';
import {createHash} from 'node:crypto';
import {desktopTarget,repositoryRoot} from './desktop-target.mjs';
import seed from '../../apps/courtyard/sect-seed.mjs';
import {createSectSession,commandSect,snapshotSect} from '../../apps/courtyard/sect-sim.mjs';
import {validateSave,dispatchCommand,tick} from '../../src/simulation/ea-opening-sim.mjs';
import {spatialRevision,visibleBodyPointClear} from '../../src/simulation/ea-sr-spatial.mjs';
import {NORTH_LIBRARY_APPROACH_VERSION,northLibrarySites} from '../../src/simulation/ea-sect-domain.mjs';
const arg=k=>process.argv.find(x=>x.startsWith(`--${k}=`))?.slice(k.length+3),output=arg('output'),condition=arg('condition')||'delivery';
assert(output&&path.isAbsolute(output)&&!output.startsWith(repositoryRoot));assert(['delivery','cancel'].includes(condition));
await fs.mkdir(output,{recursive:false});
let state=validateSave(structuredClone(seed.state));
const command=(name,...args)=>{const r=dispatchCommand(state,{name,args});state=r.state;return r.result;};
command('enableCourtyardTerrain');command('enableNorthLibrary');const HOME='stockpile:yunxiu';Object.assign(state.stockpilesById[HOME].resources,{jade:65,wood:45,stone:20});
const initialResources={...state.stockpilesById[HOME].resources},{workOrderId:id}=command('buildDomainSite',northLibrarySites[0].id);
for(let i=0;i<1000&&state.workOrdersById[id].materialFlow.phase!=='carrying';i++)tick(state,.1);
assert.equal(state.workOrdersById[id].materialFlow.phase,'carrying');
const legacy={x:40.80379280067213,y:12.481917899465497},p=state.master;
Object.assign(p.scenic,legacy,{path:[],goal:null,revision:spatialRevision(state).replace(`:${NORTH_LIBRARY_APPROACH_VERSION}`,'')});Object.assign(p.position,legacy);if(p.location?.kind==='local')Object.assign(p.location,legacy);
assert.equal(visibleBodyPointClear(state,p.scenic),false);const originalCargo={...state.workOrdersById[id].materialFlow.cargo};
if(condition==='cancel')assert.equal(command('cancelConstruction').pending,true);
const session=createSectSession({source:{state,provenance:structuredClone(seed.provenance)}});assert(commandSect(session,{type:'pause',paused:true}).ok);
const initial=snapshotSect(session),world=path.join(output,'world');await fs.mkdir(world);await fs.writeFile(path.join(world,'sect-save.json'),JSON.stringify(initial));await fs.writeFile(path.join(output,'initial.json'),JSON.stringify(initial));
const sourceFiles=['src/simulation/ea-sr-spatial.mjs','src/simulation/ea-sect-domain.mjs','src/simulation/ea-courtyard-visible-ground.mjs','src/simulation/ea-static-polygon-index.mjs','src/simulation/ea-opening-sim.mjs','apps/courtyard/sect-sim.mjs','apps/courtyard/courtyard-main.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async name=>[name,createHash('sha256').update(await fs.readFile(path.join(repositoryRoot,name))).digest('hex')])));
const report={success:false,condition,runtimeRoot:repositoryRoot,runtimeBefore:await hashes(),configured:'Materials and legacy saved off-ground position only; construction pickup before start, subsequent movement and settlement use official logic.',workOrderId:id,startTick:initial.state.worldTick,errors:[],samples:[]};let app,page,last=initial,recovered=null;
async function launch(){const target=desktopTarget(),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;app=await _electron.launch({executablePath:target.executable,args:[...target.args,'--qa-dir='+world,'--qa-scenario=native','--show'],env});page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(e.message));await page.waitForFunction(()=>window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:60000});return page.evaluate(()=>window.courtyardQA.snapshot());}
try{
 assert.deepEqual((await launch()).state,initial.state);report.loadedWorldExact=true;report.viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}));await page.screenshot({path:path.join(output,'before.png')});await page.locator('#pause').click();
 let terminal=false;
 for(let i=0;i<750;i++){
  await new Promise(r=>setTimeout(r,200));const raw=await page.evaluate(()=>window.courtyardQA.snapshot()),s=validateSave(structuredClone(raw.state)),at=s.master.scenic,previous=last.state.personsById['person:master'].scenic,dt=s.worldTick-last.state.worldTick,moved=Math.hypot(at.x-previous.x,at.y-previous.y);
  assert(moved<=dt*.316801+1e-7,'real position changes stay within the world-step walking budget');const legal=visibleBodyPointClear(s,at);if(legal&&recovered===null)recovered=s.worldTick;if(recovered!==null)assert(legal,'recovered body stays on legal visible ground');
  const order=s.workOrdersById[id];report.samples.push({tick:s.worldTick,x:at.x,y:at.y,legal,phase:order?.materialFlow.phase||'closed',moved,dt});last=raw;
  if(condition==='delivery'&&order?.materialFlow.trips[0]?.phase==='delivered'){
   for(const [key,quantity]of Object.entries(originalCargo))assert.equal(s.stockpilesById[order.materialFlow.siteStockpileId].resources[key],quantity);assert.equal(order.progressTicks,0);terminal=true;
  }else if(condition==='cancel'&&!order){assert.equal(s.spatial.completedOrders.at(-1).phase,'cancelled');assert.equal(s.spatial.completedOrders.at(-1).progressTicks,0);for(const k of ['wood','stone'])assert.equal(s.stockpilesById[HOME].resources[k],initialResources[k]);terminal=true;}
  if(terminal)break;
 }
 assert(terminal,'material journey reaches its actual delivery or refund');assert(recovered!==null&&recovered-report.startTick<30);report.recoveryTicksObserved=recovered-report.startTick;
 await page.locator('#pause').click();assert(await page.evaluate(()=>window.courtyardQA.status().manualPause));report.final=await page.evaluate(()=>window.courtyardQA.snapshot());await page.screenshot({path:path.join(output,'after.png')});report.status=await page.evaluate(()=>window.courtyardQA.status());assert.deepEqual(report.status.errors,[]);await app.close();app=null;
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(world,'sect-save.json'),'utf8')).state,report.final.state);report.savedWorldExact=true;
 assert.deepEqual((await launch()).state,report.final.state);report.reopenedWorldExact=true;assert.deepEqual(report.errors,[]);report.success=true;
}catch(e){report.errors.push(e.stack||String(e));process.exitCode=1;}finally{try{if(app)await app.close();report.closed=true;report.runtimeAfter=await hashes();assert.deepEqual(report.runtimeAfter,report.runtimeBefore);report.runtimeUnchanged=true;}catch(e){report.success=false;report.errors.push('finalization: '+(e.stack||e));process.exitCode=1;}await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report));console.log(JSON.stringify({success:report.success,condition,recoveryTicksObserved:report.recoveryTicksObserved,errors:report.errors}));}
