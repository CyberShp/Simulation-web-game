/** Actual management component: explicit water selection and active-batch guard. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createMedicineMaterialsScenario} from '../fixtures/medicine-materials.mjs';
import {commandSect,advanceSect,viewSect,validateSect} from '../../apps/courtyard/sect-sim.mjs';
import {inspectCourtyard} from '../../apps/courtyard/courtyard-inspection.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const output=path.resolve(process.argv.find(x=>x.startsWith('--output='))?.slice(9)||'/tmp/immortal-well-panel');
assert(!output.startsWith(root));assert(!existsSync(path.join(output,'report.json')));await fs.mkdir(output,{recursive:true});
const files=['src/simulation/ea-sr-economy.mjs','src/simulation/ea-opening-sim.mjs','apps/courtyard/sect-sim.mjs','apps/courtyard/courtyard-panels.mjs','tests/fixtures/medicine-materials.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await fs.readFile(path.join(root,p))).digest('hex')])));
const report={success:false,scope:'Configured ordinary completed well; real browser management panel and formal commands. No native or save-cycle claim.',requests:[],checks:[],errors:[]};
let server,browser;
try{
 report.before=await hashes();const f=createMedicineMaterialsScenario({wellMode:'crystal'});
 const payload=()=>{const before=JSON.stringify(f.session.state),view=viewSect(f.session),inspection=inspectCourtyard(f.session,view);assert.equal(JSON.stringify(f.session.state),before);return{view,inspection};};
 const html=`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/apps/courtyard/courtyard.css"><style>body{overflow:auto;background:#182f33;color:#eee;padding:20px}#management{position:relative;inset:auto;width:900px;max-width:100%;max-height:none}#management-body{max-height:none}</style><aside id="management"><h2></h2><p class="management-note"></p><button id="close-management">关闭</button><div id="management-body"></div></aside><script type="module">import{createCourtyardPanels}from'/apps/courtyard/courtyard-panels.mjs';window.ready=true;window.mount=(data,id)=>{window.data=data;window.panels=createCourtyardPanels({getView:()=>window.data.view,inspect:()=>window.data.inspection,command:async request=>{const r=await window.gameCommand(request);window.data=r.data;return r.result},openPerson:()=>{},focusPerson:()=>{},walkTo:()=>{},announce:()=>{}});window.panels.openBuilding(id)};</script>`;
 server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost').pathname;if(u==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);return;}const file=path.resolve(root,'.'+u);assert(file.startsWith(root));res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';browser=await chromium.launch({headless:true,executablePath:existsSync(chrome)?chrome:undefined});const page=await browser.newPage({viewport:{width:1100,height:1000}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.exposeFunction('gameCommand',async request=>{const result=commandSect(f.session,request);report.requests.push({request,result,tick:f.session.state.worldTick});assert(result.ok,result.error);return{result,data:payload()};});
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.ready&&window.mount);await page.evaluate(({data,id})=>window.mount(data,id),{data:payload(),id:f.wellId});
 const water=page.locator('[data-ui-key="workplace:well:water"]'),crystal=page.locator('[data-ui-key="workplace:well:crystal"]');assert(await water.isEnabled());assert(await crystal.isDisabled());
 await water.click();await page.waitForFunction(()=>window.data.view.operations.workplaces.some(w=>w.wellMode==='water'));assert(await water.isDisabled());assert(await crystal.isEnabled());
 report.selectedText=await page.locator('#management-body').innerText();assert.match(report.selectedText,/当前工序：取洁水/);assert(!report.selectedText.includes('交来访商人取货付款'));await page.screenshot({path:path.join(output,'selected.png'),fullPage:true});
 const invite=commandSect(f.session,{type:'invite-work',personId:f.travellerId,buildingId:f.wellId});assert(invite.ok&&invite.result.accepted,invite.error);
 let batch;for(let n=0;n<1000;n++){if(n%100===0)assert(commandSect(f.session,{type:'manual'}).ok);advanceSect(f.session,.1);batch=f.session.state.workOrdersById[`work:production:${f.wellId}`];if(batch?.progressTicks>0&&batch.phase!=='completed')break;}
 assert(batch&&batch.phase!=='completed'&&batch.progressTicks>0);await page.evaluate(data=>{window.data=data;window.panels.render(true)},payload());assert(await water.isDisabled());assert(await crystal.isDisabled());
 const before=JSON.stringify(f.session.state),blocked=commandSect(f.session,{type:'well-production',buildingId:f.wellId,mode:'crystal'});assert.equal(blocked.ok,false);assert.equal(JSON.stringify(f.session.state),before);report.blocked=blocked;report.activeText=await page.locator('#management-body').innerText();await page.screenshot({path:path.join(output,'active.png'),fullPage:true});validateSect(f.session);
 report.checks=['default crystal and actual enabled water button','browser water click commits formal well-production command','selected water output and onsite storage text','actual ongoing water batch disables both switches','direct mid-batch request rejects atomically','view and inspection remain read-only'];report.after=await hashes();assert.deepEqual(report.after,report.before);assert.deepEqual(report.errors,[]);report.success=true;
}catch(error){report.errors.push(error.stack||String(error));process.exitCode=1;}
finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,errors:report.errors,output}));}
