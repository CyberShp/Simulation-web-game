/** Zero-world-step public-panel and native-save completion from an actual QA save. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {_electron} from 'playwright';
import {desktopTarget,repositoryRoot} from './desktop-target.mjs';
import {restoreSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
import {runtimeHashes,saveNativePaused} from './courtyard-six-residents-body.mjs';
const arg=k=>process.argv.find(x=>x.startsWith(`--${k}=`))?.slice(k.length+3);
const source=arg('source'),output=arg('output'),priorReport=arg('prior-report');
assert([source,output,priorReport].every(x=>x&&path.isAbsolute(x)));
assert(!output.startsWith(repositoryRoot));
const hash=b=>createHash('sha256').update(b).digest('hex'),bytes=await fs.readFile(source),initial=JSON.parse(bytes),priorBytes=await fs.readFile(priorReport),prior=JSON.parse(priorBytes);
const panelPath=path.join(path.dirname(priorReport),'public-cultivation.json'),panelBytes=await fs.readFile(panelPath),panel=JSON.parse(panelBytes);
assert.equal(prior.stage,'desktop');assert(prior.sourceUnchanged&&prior.runtimeUnchanged&&prior.nativeClosed);
assert.equal(initial.state.worldTick,panel.tick);assert.equal(panel.readOnlyExact,true);
assert.equal(initial.state.personsById['person:lin-changfeng'].xp,panel.member.cultivation.xp);
assert.equal(initial.state.speed,0);assert.equal(initial.courtyardPresentation.manualPause,true);validateSect(restoreSect(initial));
await fs.mkdir(output,{recursive:false});const world=path.join(output,'world');await fs.mkdir(world);const native=path.join(world,'sect-save.json');await fs.writeFile(native,bytes);
await fs.writeFile(path.join(output,'source.json'),bytes);
await fs.copyFile(new URL(import.meta.url),path.join(output,'executed-harness.mjs'));
const runtimeBefore=await runtimeHashes(),errors=[],checks={},target=desktopTarget();let app,page,success=false,nativeClosed=false,terminal;
const read=()=>page.evaluate(()=>window.courtyardQA.snapshot());
const closePanels=async()=>{for(const id of ['#dialog-close','#close-person','#close-management']){const l=page.locator(id);if(await l.isVisible())await l.click();}};
const launch=async()=>{const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;app=await _electron.launch({executablePath:target.executable,env,args:[...target.args,'--qa-dir='+world,'--qa-scenario=native','--show']});page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:60000});};
try{
 await launch();assert.deepEqual((await read()).state,initial.state);checks.initialCanonicalExact=true;
 for(const selector of ['#people','[data-ui-key="person:person:lin-changfeng"]','[data-ui-key="person:inspect:person:lin-changfeng"]'])await page.locator(selector).click();
 const node=page.locator('[data-ui-key="person:cultivation-progress"]');await node.scrollIntoViewIfNeeded();assert(await node.isVisible());const text=await node.innerText();assert.equal(text,panel.text);
 await page.waitForTimeout(800);assert.deepEqual((await read()).state,initial.state);checks.publicTextAndReadOnlyExact=true;
 await page.screenshot({path:path.join(output,'public-cultivation.png')});await closePanels();checks.overlayCloseOrder=true;
 const saved=await saveNativePaused({pause:async()=>assert.equal(await page.evaluate(()=>window.courtyardQA.status().manualPause),true),closeDialogs:closePanels,snapshot:async()=>{const raw=await read();return{manualPause:true,tick:raw.state.worldTick,state:raw.state};},clickSave:()=>page.locator('#save').click(),readNative:()=>fs.readFile(native),validate:x=>validateSect(restoreSect(x))});
 assert.deepEqual(saved.saved.state,initial.state);checks.explicitNativeSaveExact=true;
 await app.close();app=null;await launch();terminal=await read();assert.deepEqual(terminal.state,initial.state);assert.equal(await page.evaluate(()=>window.courtyardQA.status().manualPause),true);checks.closeReopenExact=true;
 await fs.writeFile(path.join(output,'terminal.json'),JSON.stringify(terminal,null,2)+'\n');assert.deepEqual(errors,[]);success=true;
}catch(error){errors.push(error.stack||String(error));process.exitCode=1;}
finally{
 if(app){await app.close();app=null;nativeClosed=true;}
 const final=JSON.parse(await fs.readFile(native)),runtimeAfter=await runtimeHashes();checks.finalNativeExact=JSON.stringify(final.state)===JSON.stringify(initial.state);checks.sourceUnchanged=hash(await fs.readFile(source))===hash(bytes);checks.runtimeUnchanged=JSON.stringify(runtimeBefore)===JSON.stringify(runtimeAfter);checks.priorReportUnchanged=hash(await fs.readFile(priorReport))===hash(priorBytes);checks.priorPanelUnchanged=hash(await fs.readFile(panelPath))===hash(panelBytes);
 success=success&&nativeClosed&&Object.values(checks).every(Boolean)&&errors.length===0;if(!success)process.exitCode=1;
 await fs.writeFile(path.join(output,'report.json'),JSON.stringify({success,scope:'macOS source Electron zero-world-step panel and native save/reopen; earlier growth and daily evidence retain their original reports',source,sourceSha256:hash(bytes),priorReport,priorReportSha256:hash(priorBytes),panelPath,panelSha256:hash(panelBytes),tick:initial.state.worldTick,xp:initial.state.personsById['person:lin-changfeng'].xp,nativeClosed,checks,errors,runtimeBefore,runtimeAfter,responsivenessPassed:false},null,2)+'\n');
 console.log(JSON.stringify({success,output,checks,errors}));
}
