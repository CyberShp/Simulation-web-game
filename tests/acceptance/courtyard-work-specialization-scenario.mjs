/** Configured scene -> authoritative ticks -> production -> actual component DOM. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createWorkSpecializationScenario,WORK_SPECIALIZATION_SCENARIO} from '../fixtures/work-specialization.mjs';
import {advanceSect,commandSect,viewSect} from '../../apps/courtyard/sect-sim.mjs';
import {slotById} from '../../src/simulation/ea-facility-slots.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url)),args=Object.fromEntries(process.argv.slice(2).map(x=>{const i=x.indexOf('=');return[x.slice(0,i),x.slice(i+1)];})),output=path.resolve(args['--output']||'/tmp/immortal-work-specialization-scenario');
assert(!output.startsWith(root),'QA output must be outside the source checkout');assert(!existsSync(path.join(output,'report.json')),'Use a fresh output directory to preserve earlier evidence');await fs.mkdir(output,{recursive:true});
const report={scope:'Directly configured conditions; official autonomous world ticks and actual DOM components. Not a complete native playthrough.',success:false,configuredConditions:null,checks:[],errors:[]},sha=s=>createHash('sha256').update(s).digest('hex');
const runtimeFiles=['src/simulation/ea-society.mjs','apps/courtyard/courtyard-development-panel.mjs','tests/fixtures/work-specialization.mjs','tests/acceptance/courtyard-work-specialization-scenario.mjs'];
const runtimeHashes=async()=>Object.fromEntries(await Promise.all(runtimeFiles.map(async file=>[file,sha(await fs.readFile(path.join(root,file)))])));
let browser,server;
try{
 report.runtimeBefore=await runtimeHashes();
 const fixture=createWorkSpecializationScenario(),{session,people,metadata}=fixture,s=session.state;
 report.configuredConditions=metadata;report.initialStateSha256=sha(JSON.stringify(s));
 const swapped=createWorkSpecializationScenario({swapSpecialties:true}),neutral=x=>{const y=JSON.parse(JSON.stringify(x));for(const id of WORK_SPECIALIZATION_SCENARIO.people)delete y.personsById[id].mind.skills;return y;};
 assert.deepEqual(neutral(s),neutral(swapped.state),'counterfactual changes only initial skills');
 for(let n=0;n<20;n++)advanceSect(swapped.session,.1);
 for(const member of swapped.people)assert.equal(swapped.session.state.personsById[member.personId].job,swapped.session.state.buildingsById[member.buildingId].id);
 report.counterfactual={worldSteps:20,onlySkillsDiffer:true,choices:swapped.people.map(p=>({personId:p.personId,skillKey:p.skillKey,actualJob:swapped.session.state.personsById[p.personId].job,reason:swapped.session.state.personsById[p.personId].mind.reason}))};
 const observations=people.map(p=>({...p,choice:null,station:null,production:null,nextDecision:null}));
 for(const o of observations){assert.equal(s.personsById[o.personId].job,null);assert.equal(s.workOrdersById[`work:production:${o.buildingId}`],undefined);}
 let steps=0;
 for(;steps<WORK_SPECIALIZATION_SCENARIO.maxWorldSteps;steps++){
  if(steps%100===0){const result=commandSect(session,{type:'manual'});assert(result.ok,result.error);}
  const beforeTick=session.state.worldTick;advanceSect(session,.1);assert.equal(session.state.worldTick,beforeTick+1);
  const state=session.state;
  for(const o of observations){
   const p=state.personsById[o.personId],a=state.activitiesById[p.activityId];
   if(!o.choice&&p.mind.activity==='work'){assert.equal(p.job,state.buildingsById[o.buildingId].id);assert.match(p.mind.reason,new RegExp('已有'+(o.skillKey==='plant'?'灵植':'百工')+'经验'));o.choice={tick:state.worldTick,job:p.job,reason:p.mind.reason};}
   if(!o.station&&a?.kind==='facility'&&a.action==='work'&&a.phase==='executing'){
    const slot=slotById(state,a.slotId),r=state.reservationsById[a.reservationId];assert.equal(a.targetId,o.buildingId);assert.equal(r.personId,o.personId);assert.equal(r.slotId,slot.id);assert(Math.hypot(p.position.x-slot.position.x,p.position.y-slot.position.y)<.041);o.station={tick:state.worldTick,activityId:a.id,slotId:slot.id,position:{...p.position}};
   }
   if(!o.production){const fact=Object.values(state.factsById).find(f=>f.operation==='production'&&f.workOrderId===`work:production:${o.buildingId}`&&f.participantIds?.includes(o.personId));if(fact){assert(o.station);assert.equal(fact.batch,1);assert.equal(fact.participantSkills[o.personId],80);assert.equal(p.mind.skills[o.skillKey],80.6);o.production={fact:structuredClone(fact),skillAfter:p.mind.skills[o.skillKey],clock:state.society.clock};}}
   if(o.production&&!o.nextDecision&&p.mind.lastDecision>o.production.clock){assert.equal(p.job,state.buildingsById[o.buildingId].id);assert(p.mind.skills[o.skillKey]>o.initialSkill);o.nextDecision={at:p.mind.lastDecision,job:p.job,skill:p.mind.skills[o.skillKey],reason:p.mind.reason};}
  }
  if(observations.every(o=>o.choice&&o.station&&o.production&&o.nextDecision)){steps++;break;}
 }
 assert(observations.every(o=>o.production&&o.nextDecision),'bounded scene completes both real batches and a decision after growth');
 const beforeRead=JSON.stringify(session.state),data=viewSect(session).discipleDevelopment;
 assert.equal(JSON.stringify(session.state),beforeRead,'public projection is read-only');
 const near=data.members.find(p=>p.personId===people[0].personId),remote=data.members.find(p=>p.personId===people[1].personId);
 assert(near.contact.available);assert.match(near.reason,/已有灵植经验/);assert.equal(remote.contact.available,false);assert.deepEqual(remote.skills,[]);assert(!remote.reason.includes('百工'));assert.equal(remote.activity,null);
 report.world={startTick:metadata.startTick,finalTick:session.state.worldTick,steps,observations,starvation:session.state.economy.starvation};assert.equal(report.world.starvation,0);
 report.checks.push('configured-only-skills counterfactual','formal autonomous choices','exclusive physical stations','one real production batch per worker','80 to80.6 matching skill growth','next decision uses grown skill','near disclosure / remote withholding','read-only projection');
 const app=path.join(root,'apps/courtyard'),html='<!doctype html><html lang="zh"><meta charset="utf-8"><link rel="stylesheet" href="/courtyard.css"><style>body{display:block;overflow:auto;height:auto;background:#182b31;padding:28px;color:#eee}main{max-width:1380px;margin:auto}article{display:grid;grid-template-columns:1fr 1fr;gap:24px}.scenario-card{padding:20px;background:#243a3c;border:1px solid #a99365}h1{font-size:26px}h2{font-size:22px}.management-section{margin:12px 0}</style><main><h1>门人专长择业 · 实际组件场景</h1><p>直接配置初始条件，正式世界步产生选择与生产；此图为组件验收。</p><article><div id="near" class="scenario-card"><h2>近身：陆知微</h2></div><div id="remote" class="scenario-card"><h2>远处：林长风</h2></div></article></main></html>';
 server=http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;if(pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}const base=pathname.startsWith('/assets/')?path.join(root,'assets'):app,relative=pathname.startsWith('/assets/')?pathname.slice(8):pathname.slice(1),file=path.resolve(base,relative);assert(file.startsWith(base+path.sep));res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.ttf')?'font/ttf':'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(existsSync(chrome)?chrome:undefined)});const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/`);
 const dom=await page.evaluate(async({near,remote})=>{const{renderPersonDevelopment}=await import('/courtyard-development-panel.mjs');for(const[id,member]of[['near',near],['remote',remote]])renderPersonDevelopment(document.getElementById(id),{member,recommend(){throw Error('read-only scene');}});return{near:document.getElementById('near').innerText,remote:document.getElementById('remote').innerText,remoteRecommendations:document.querySelectorAll('#remote [data-ui-key^="person:recommend:"]').length};},{near,remote});
 assert.match(dom.near,/本人打算：.*已有灵植经验/);assert.match(dom.near,/灵植/);assert.match(dom.near,/80.6/);assert.match(dom.remote,/待当面了解/);assert(!dom.remote.includes('已有百工经验'));assert(!dom.remote.includes('80.6'));assert.equal(dom.remoteRecommendations,0);assert.deepEqual(errors,[]);assert.equal(JSON.stringify(session.state),beforeRead);
 const screenshot=path.join(output,'component.png');await page.screenshot({path:screenshot,fullPage:true});report.componentDOM={...dom,screenshot,browser:browser.version(),viewport:{width:1440,height:1100,dpr:1},readOnlyExact:true,errors};report.checks.push('actual browser DOM and component screenshot');report.runtimeAfter=await runtimeHashes();report.runtimeUnchanged=JSON.stringify(report.runtimeBefore)===JSON.stringify(report.runtimeAfter);assert(report.runtimeUnchanged,'scenario runtime changed during execution');report.success=true;
}catch(error){report.errors.push(error.stack||String(error));process.exitCode=1;}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({success:report.success,steps:report.world?.steps,report:path.join(output,'report.json'),errors:report.errors}));
