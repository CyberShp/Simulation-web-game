import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import * as SIM from '../../src/simulation/ea-opening-sim.mjs';
import {createSectSession,commandSect,advanceSect,snapshotSect} from '../../apps/courtyard/sect-sim.mjs';
import {buildCombatGroupComponent} from './build-combat-group-component.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const send=(s,q)=>{const result=commandSect(s,q);assert(result.ok,result.error);};
function until(s,p,label){for(let n=0;n<3500&&!p(s.state);n++)advanceSect(s,.1);assert(p(s.state),label);}
function soloSource(){
 let state=SIM.initial({sr:true,mountainOpening:true,seed:271828});
 for(const [name,args]of [['masterAction',['heal']],['chooseOpeningInheritance',['qinglan']]])state=SIM.dispatchCommand(state,{name,args}).state;
 while(state.master.wound>0)SIM.tick(state,.1);
 const s=createSectSession({source:{state,provenance:{kind:'normal-public-command-checkpoint',stateSha256:createHash('sha256').update(JSON.stringify(state)).digest('hex')}}});
 send(s,{type:'world',action:{action:'exit',exitId:'exit:yunxiu-valley'}});until(s,v=>!v.master.scenic.path.length,'gate');
 send(s,{type:'world',action:{action:'exit',exitId:'exit:yunxiu-valley',cargo:{food:4}}});until(s,v=>!v.srWorld.activeTravelId,'journey');
 send(s,{type:'world',action:{action:'move',x:24.5,y:36}});until(s,v=>!v.srWorld.interaction,'approach');send(s,{type:'world',action:{action:'engage',objectId:'object:valley:shanxiao'}});
 return snapshotSect(s);
}

test('the real product DOM renders restored input, active battle and actual wound facts from both complete and combat projections',{timeout:30000},async t=>{
 const group=buildCombatGroupComponent().native,solo=soloSource();
 const server=http.createServer(async(req,res)=>{try{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,name.startsWith('/src/')?'.'+name:'apps/courtyard'+name);
  if(!file.startsWith(root)){res.writeHead(403);res.end();return;}
  let data=await fs.readFile(file);if(name==='/courtyard.html')data=Buffer.from(data.toString().replace('<script type="module" src="courtyard-main.mjs"></script>',''));
  res.setHeader('Content-Type',name.endsWith('.mjs')?'text/javascript':name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'application/octet-stream');res.end(data);
 }catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/courtyard.html`,{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async({group,solo})=>{
   const sim=await import('/sect-sim.mjs'),{createCourtyardCombat}=await import('/courtyard-combat.mjs'),{combatActorId}=await import('/src/simulation/ea-combat-impact.mjs');
   let session=sim.restoreSect(group),view=sim.viewSect(session),ui;
   const check=(condition,message)=>{if(!condition)throw Error(message);};
   const render=()=>{const before=JSON.stringify(session.state);ui.render();check(JSON.stringify(session.state)===before,'DOM render changed the authoritative body');return document.getElementById('combat-state').textContent;};
   const command=request=>{const result=sim.commandSect(session,request);check(result.ok,result.error);view=['combat-input','combat','pause'].includes(request.type)?sim.viewSectCombat(session)||sim.viewSect(session):sim.viewSect(session);render();return result;};
   ui=createCourtyardCombat({getView:()=>view,command,announce(){},beforeDepart(){},canInteract:()=>true,pause:()=>command({type:'pause',paused:true})});
   render();
   // The restored desktop's syncPause calls clearInput before its first ui().
   ui.clearInput();check(view.people===undefined,'startup must really consume the combat projection');const startup=render();
   command({type:'pause',paused:false});command({type:'combat-input',move:{x:0,y:0}});const active=render();
   command({type:'combat',actionId:'guard'});check(view.people===undefined&&render().includes('起手'),'a fresh manual plan must render through the battle projection');
   session=sim.restoreSect(solo);view=sim.viewSectCombat(session);render();let hit=null;
   for(let n=0;n<250&&session.state.combat?.status==='active';n++){
    sim.advanceSect(session,.1);view=sim.viewSectCombat(session);render();
    if(session.state.master.wound>0){hit=view.expedition.scene.effects.find(e=>e.kind==='hit'&&e.targetId===combatActorId(session.state.combat.player)&&e.amount>0);if(hit)break;}
   }
   check(hit,'ordinary enemy ticks must produce a real hit on the master');
   const wound=session.state.master.wound,woundText='伤势 '+wound.toFixed(1)+'%',light=render();check(wound>0&&light.includes(woundText),'light DOM concealed a real wound');
   view=sim.viewSect(session);const full=render();check(full===light,'complete and combat DOM disagree on the same injury');
   delete view.masterWound;check(render()===full,'the older complete people projection must retain its real injury');
   session=sim.restoreSect(sim.snapshotSect(session));view=sim.viewSectCombat(session);const reopened=render();check(reopened.includes(woundText),'restored DOM lost the actual wound');
   delete view.masterWound;delete view.people;let missing=null;try{render();}catch(error){missing=error.message;}
   check(missing?.includes('掌门真实伤势'),'missing facts must raise the explicit presentation-contract error');
   ui.dispose();return {startup,active,light,full,reopened,wound,hitId:hit.eventId||hit.id,missing};
  },{group,solo});
  assert(result.wound>0);assert.equal(result.light,result.full);assert.match(result.missing,/掌门真实伤势/);assert.deepEqual(errors,[]);
  t.diagnostic(JSON.stringify({scope:'real product DOM component, not native acceptance',browserVersion:browser.version(),...result}));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
