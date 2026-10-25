/** Configured contact, actual person component and formal read-only projection. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createPharmacistDevelopmentScenario} from '../fixtures/pharmacist-development.mjs';
import {restoreSect,viewSect} from '../../apps/courtyard/sect-sim.mjs';
import {discipleDevelopmentView} from '../../src/simulation/ea-disciple-development.mjs';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const output=path.resolve(process.argv.find(x=>x.startsWith('--output='))?.slice(9)||'/tmp/immortal-pharmacist-panel');
assert(!output.startsWith(root));assert(!existsSync(path.join(output,'report.json')));await fs.mkdir(output,{recursive:true});
const report={success:false,scope:'Configured contact and qualification; actual browser person component. Completed growth uses scenario snapshot when supplied.',checks:[],errors:[]};
const files=['src/simulation/ea-medicine-supply.mjs','apps/courtyard/courtyard-expeditions-panel.mjs','src/simulation/ea-sr-spatial.mjs','src/simulation/ea-sr-economy.mjs','src/simulation/ea-disciple-development.mjs','apps/courtyard/courtyard-development-panel.mjs','tests/fixtures/pharmacist-development.mjs'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await fs.readFile(path.join(root,f))).digest('hex')])));
let server,browser;
try{
 report.before=await hashes();const fixture=createPharmacistDevelopmentScenario(),s=fixture.session.state,p=s.personsById[fixture.pharmacistId];
 const near=state=>{const person=state.personsById[fixture.pharmacistId],at=person.position;Object.assign(state.master.scenic,{x:at.x+.8,y:at.y,path:[],goal:null});state.master.position={kind:'scene',sceneId:at.sceneId,x:at.x+.8,y:at.y};state.master.location={kind:'local',sceneId:at.sceneId,x:at.x+.8,y:at.y};};
 const read=state=>{const before=JSON.stringify(state),member=discipleDevelopmentView(state).members.find(m=>m.personId===fixture.pharmacistId);assert.equal(JSON.stringify(state),before);return member;};
 near(s);const initial=read(s);assert(initial.contact.available);assert(!initial.pharmacist.recipes.find(r=>r.recipeId==='foundation').qualified);
 server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost').pathname;if(u==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/apps/courtyard/courtyard.css"><style>body{overflow:auto;background:#142c31;color:#eee;padding:24px}main{width:680px;max-width:100%}</style><main></main>');return;}const file=path.resolve(root,'.'+u);assert(file.startsWith(root+path.sep));res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';browser=await chromium.launch({headless:true,executablePath:existsSync(chrome)?chrome:undefined});const page=await browser.newPage({viewport:{width:900,height:1100}});page.on('pageerror',e=>report.errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);
 const mount=async member=>{await page.evaluate(async member=>{const {renderPersonDevelopment}=await import('/apps/courtyard/courtyard-development-panel.mjs');const holder=document.querySelector('main');holder.replaceChildren();renderPersonDevelopment(holder,{member,recommend:()=>{throw Error('read-only check must not recommend')}})},member);return page.locator('main').innerText();};
 report.initialText=await mount(initial);assert.match(report.initialText,/炼药与进阶/);assert.match(report.initialText,/35/);await page.screenshot({path:path.join(output,'qualification.png'),fullPage:true});report.checks.push('near contact displays unchanged foundation knowledge requirement');
 const snapshot=process.argv.find(x=>x.startsWith('--snapshot='))?.slice(11);
 if(snapshot){const saved=JSON.parse(await fs.readFile(snapshot,'utf8')),state=restoreSect(saved).state;near(state);const member=read(state);assert(member.pharmacist.lastCompletion);report.completedText=await mount(member);assert.match(report.completedText,/最近炼制：医理/);assert(member.pharmacist.recipes.find(r=>r.recipeId==='foundation').qualified);await page.screenshot({path:path.join(output,'growth.png'),fullPage:true});report.checks.push('actual completed scenario projects recorded growth and advanced qualification');}
 p.mind.hiddenKnowledge??={};p.mind.hiddenKnowledge.alchemy='secret:pharmacist-panel';const hidden=read(s);assert.equal(hidden.pharmacist,null);assert(!(await mount(hidden)).includes('炼药与进阶'));report.checks.push('private alchemy knowledge does not leak through qualification');
 delete p.mind.hiddenKnowledge.alchemy;s.master.scenic.x+=20;s.master.position.x+=20;s.master.location.x+=20;const far=read(s);assert.equal(far.contact.available,false);assert.equal(far.pharmacist,undefined);assert(!(await mount(far)).includes('炼药与进阶'));report.checks.push('distant member hides current pharmacist progress');report.checks.push('all formal projections are state-pure');
 const interruption=process.argv.find(x=>x.startsWith('--interruption='))?.slice(15);
 if(interruption){const session=restoreSect(JSON.parse(await fs.readFile(interruption,'utf8'))),before=JSON.stringify(session.state),view=viewSect(session);assert.equal(JSON.stringify(session.state),before);assert(view.medicineSupply.lastInterruption);assert(view.medicineSupply.home>=view.medicineSupply.target);await page.evaluate(async view=>{const {renderDiscipleExpeditions}=await import('/apps/courtyard/courtyard-expeditions-panel.mjs');const parent=document.querySelector('main');parent.replaceChildren();renderDiscipleExpeditions(parent,{view});},view);report.successionText=await page.locator('main').innerText();assert.match(report.successionText,/上次中止：/);assert.match(report.successionText,/已到场交付|已达到目标/);await page.screenshot({path:path.join(output,'succession.png'),fullPage:true});report.checks.push('completed replacement stock and previous interruption remain distinct in real supply component');}
 report.after=await hashes();assert.deepEqual(report.after,report.before);assert.deepEqual(report.errors,[]);report.success=true;
}catch(error){report.errors.push(error.stack||String(error));process.exitCode=1;}
finally{await browser?.close();if(server)await new Promise(r=>server.close(r));await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,errors:report.errors,output}));}
