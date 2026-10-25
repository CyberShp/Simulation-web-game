/** Combat motion / impact acceptance on an isolated, visible native desktop.
 * --source=/absolute/native-save.json --output=/absolute/fresh-directory
 * --scenario=orientation|impact|defense|finish|defeat|all --resume-combat
 * --stage=preflight performs read-only source validation without Electron.
 * Source must come from public commands. A resumed source retains its own chain.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {desktopTarget,repositoryRoot} from './desktop-target.mjs';
import {restoreSect,validateSect,openingView} from '../../apps/courtyard/sect-sim.mjs';
import {atExit,arrivedIn,walkSettled} from './courtyard-combat-observations.mjs';

const option=k=>process.argv.find(v=>v.startsWith(`--${k}=`))?.slice(k.length+3);
const source=option('source'),output=option('output'),scenario=option('scenario')||'all';
const preflight=option('stage')==='preflight',resume=process.argv.includes('--resume-combat');
assert(source&&path.isAbsolute(source),'absolute --source required');
assert(output&&path.isAbsolute(output),'absolute --output required');
assert(!path.resolve(output).startsWith(path.resolve(repositoryRoot)+path.sep),'output must be outside the repository');
assert(['orientation','impact','defense','finish','defeat','all'].includes(scenario),'unknown scenario');
const json=x=>JSON.stringify(x,null,2)+'\n',hash=b=>createHash('sha256').update(b).digest('hex');
const sourceBytes=await fs.readFile(source),original=JSON.parse(sourceBytes),restored=restoreSect(original);
assert.equal(validateSect(restored),true);assert.deepEqual(restored.state,original.state);
assert.equal(original.state.speed,0,'source must be paused');
assert.equal(openingView(restored).stage,'complete');
await fs.mkdir(output,{recursive:false});
await fs.writeFile(path.join(output,'executed-harness.mjs'),await fs.readFile(new URL(import.meta.url)));
await fs.writeFile(path.join(output,'source.json'),sourceBytes);
if(preflight){
 await fs.writeFile(path.join(output,'report.json'),json({status:'preflight',scope:'read-only source validation; no Electron or world advancement',source,sourceSha256:hash(sourceBytes),tick:original.state.worldTick,scenario,resume}));
 console.log('Preflight passed');process.exit(0);
}
const directory=path.join(output,'world'),native=path.join(directory,'sect-save.json');
await fs.mkdir(directory);await fs.writeFile(native,sourceBytes);
async function filesUnder(relative){const entries=await fs.readdir(path.join(repositoryRoot,relative),{withFileTypes:true});return(await Promise.all(entries.map(e=>e.isDirectory()?filesUnder(relative+'/'+e.name):relative+'/'+e.name))).flat();}
const runtimeFiles=[...await filesUnder('apps/courtyard'),...await filesUnder('src/simulation'),...await filesUnder('assets/courtyard'),'package.json','package-lock.json'];
const hashes=async()=>Object.fromEntries(await Promise.all(runtimeFiles.map(async f=>[f,hash(await fs.readFile(path.join(repositoryRoot,f)))])));
const runtimeBefore=await hashes(),target=desktopTarget(),checks=[],actions=[],errors=[],finalizationErrors=[];
const started=performance.now(),wall=()=>Number(((performance.now()-started)/1000).toFixed(6)),sleep=ms=>new Promise(r=>setTimeout(r,ms));
let electron,page,gameWindowId,phase='launch',lastTick=original.state.worldTick,complete=false;
const record=(name,extra={})=>{checks.push({name,ok:true,wallSeconds:wall(),...extra});console.log('PASS '+name);};
const point=a=>({x:a.x,y:a.y}),enemy=r=>r.scene.enemies[0],player=r=>r.scene.player;
const pending=r=>r.pending,settled=r=>!pending(r)&&!r.scene.projectiles.length;
const events=r=>r.scene.effects||[],hits=r=>events(r).filter(e=>e.kind==='hit');
const ready=(r,id)=>!pending(r)&&r.combat.manualActions.some(a=>a.id===id&&!a.disabled);
function facingPreserved(r,actor){const visual=r.visualSamples.find(v=>v.id===actor.id).sample;assert.equal(visual.facing,actor.facing.x<-.08?'left':'right','incoming force must not turn the body');}
const read=()=>page.evaluate(()=>{
 const q=window.courtyardQA,v=q.view(),snapshot=q.snapshot();
 return {tick:snapshot.state.worldTick,state:snapshot.state,scene:v.expedition.scene,combat:v.expedition.combat,pending:snapshot.state.srCombat?.pending,status:q.status(),input:q.expedition.inputState(),errors:q.metrics().errors};
});
async function click(selector){await page.locator(selector).click();actions.push({selector,tick:await page.evaluate(()=>window.courtyardQA.metrics().tick),wallSeconds:wall()});}
async function pause(value){if((await page.evaluate(()=>window.courtyardQA.status().manualPause))!==value)await click('#pause');assert.equal(await page.evaluate(()=>window.courtyardQA.status().manualPause),value);}
async function capture(name){
 if((await page.evaluate(()=>window.courtyardQA.status().manualPause))===true){
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await sleep(300);
 }
 await page.locator('#expedition-canvas').screenshot({path:path.join(output,name+'.png')});const r=await read();lastTick=r.tick;
 if(r.scene?.type==='combat')r.visualSamples=await page.evaluate(async()=>{
  const {sampleCombatActor}=await import('./courtyard-combat-actors.mjs'),scene=window.courtyardQA.view().expedition.scene;
  return [scene.player,...scene.enemies,...scene.allies].map(actor=>({id:actor.id,personId:actor.personId,sample:sampleCombatActor(actor,scene)}));
 });
 await fs.writeFile(path.join(output,name+'.json'),json(r));return r;
}
async function until(predicate,label,seconds=90){const start=performance.now();while(performance.now()-start<seconds*1000){const r=await read();lastTick=r.tick;assert.deepEqual(r.errors,[]);if(predicate(r))return r;await sleep(35);}throw Error('Timed out '+label+' at tick '+lastTick);}
async function runTo(predicate,label,seconds=30){await pause(false);await until(predicate,label,seconds);await pause(true);return read();}
async function aim(targetPoint){const xy=await page.evaluate(p=>window.courtyardQA.expedition.worldToScreen(p.x,p.y),targetPoint),box=await page.locator('#expedition-canvas').boundingBox();assert(box);await page.mouse.move(box.x+xy.x,box.y+xy.y);}
async function press(key){await page.keyboard.press(key);actions.push({key,tick:(await read()).tick,wallSeconds:wall()});}
// A renderer-side read observer pauses through the same public button so a
// one-world-step release or impact cannot pass between terminal polling calls.
async function arm(expression,label){
 await page.evaluate(({expression,label})=>{
  clearInterval(window.__motionQATimer);const predicate=new Function('r','return ('+expression+');');
  window.__motionQAWatch={label,hit:false,error:null,samples:[],lastTick:-1};
  window.__motionQATimer=setInterval(()=>{
   try{const q=window.courtyardQA,v=q.view(),s=q.snapshot().state;
    const r={tick:s.worldTick,scene:v.expedition.scene,pending:s.srCombat?.pending,combat:v.expedition.combat};
    const w=window.__motionQAWatch;if(r.tick!==w.lastTick){w.samples.push(r);w.lastTick=r.tick;}
    if(predicate(r)){w.hit=true;if(!q.status().manualPause)document.getElementById('pause').click();clearInterval(window.__motionQATimer);}
   }catch(e){window.__motionQAWatch.error=String(e);clearInterval(window.__motionQATimer);}
  },15);
 },{expression,label});
}
async function watched(expression,label,{key=null,seconds=20}={}){
 await arm(expression,label);if(key)await press(key);await pause(false);
 const start=performance.now();let w;
 while(performance.now()-start<seconds*1000){w=await page.evaluate(()=>window.__motionQAWatch);if(w.error)throw Error(w.error);if(w.hit)break;await sleep(35);}
 await fs.writeFile(path.join(output,label+'-trace.json'),json(w));
 assert(w?.hit,'watch timed out '+label);assert.equal((await read()).status.manualPause,true);return capture(label);
}
async function waitReady(id){let r=await read();if(!ready(r,id))r=await runTo(q=>ready(q,id),id+' recovery and cooldown');return r;}
async function safeAttackReady(id){
 await waitReady(id);const r=await read(),windowTicks=id==='spell'?7:5;
 if(enemy(r).telegraph&&enemy(r).telegraph.remaining*10<=windowTicks)
  await runTo(q=>ready(q,id)&&!enemy(q).telegraph&&player(q).motion.phase!=='hit','enemy release and player recovery');
}
async function stable(name){await pause(true);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const before=await read(),pixelsBefore=await page.locator('#expedition-canvas').evaluate(c=>c.toDataURL());await sleep(450);const after=await read(),pixelsAfter=await page.locator('#expedition-canvas').evaluate(c=>c.toDataURL());assert.deepEqual(after.state,before.state);assert.deepEqual(after.scene,before.scene);assert.equal(pixelsAfter,pixelsBefore);record('pause freezes world, motion and canvas '+name,{tick:before.tick,canvasSha256:hash(pixelsBefore)});}
async function persist(name){await pause(true);const before=await read();await click('#save');for(let i=0;i<100;i++){if(JSON.stringify(JSON.parse(await fs.readFile(native)).state)===JSON.stringify(before.state))break;await sleep(100);}assert.deepEqual(JSON.parse(await fs.readFile(native)).state,before.state);await fs.copyFile(native,path.join(output,name+'-native.json'));return before;}
async function launch(){const {_electron}=await import('playwright'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;electron=await _electron.launch({executablePath:target.executable,env,args:[...target.args,'--qa-dir='+directory,'--qa-scenario=native','--show'],timeout:30000});page=await electron.firstWindow();gameWindowId=await(await electron.browserWindow(page)).evaluate(w=>w.id);page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.stack||e.message));await page.waitForFunction(()=>window.courtyardQA&&document.getElementById('loading').hidden,null,{timeout:60000});}
async function close(){if(!electron)return;const app=electron,closed=app.waitForEvent('close',{timeout:30000});await app.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id)?.close(),gameWindowId);await closed;electron=null;page=null;}
async function outbound(){
 phase='outbound';await click('#expedition-open');
 // The departure predicates use the full formal expedition projection.
 const full=()=>page.evaluate(()=>({session:window.courtyardQA.snapshot(),view:window.courtyardQA.view()}));
 async function travelUntil(predicate,label){await pause(false);const start=performance.now();let r;while(performance.now()-start<90000){r=await full();if(predicate(r)){await pause(true);return;}await sleep(100);}throw Error('Timed out '+label);}
 await travelUntil(r=>atExit(r,'exit:yunxiu-valley'),'mountain gate');
 await click('#expedition-open');await travelUntil(r=>arrivedIn(r,'scene:valley'),'valley arrival');
 await click('#expedition-approach');await travelUntil(walkSettled,'walk to visible shanxiao');await click('#expedition-engage');
 const r=await capture('engaged');assert.equal(r.scene.status,'active');assert.equal(r.scene.presentation,'independent-arena');assert.equal(enemy(r).personId,'person:valley-shanxiao');await persist('engaged');record('public gate, travel, approach and encounter',{tick:r.tick});
}
async function orientation(){
 phase='orientation';
 for(const [key,axis,sign] of [['d','x',1],['a','x',-1]]){
  await pause(false);const before=await read();await page.keyboard.down(key);
  const r=await watched("r.tick>"+before.tick+"&&r.scene.player.motion.phase==='move'&&r.scene.player.motion.direction."+axis+"*"+sign+">0",'walk-'+key);await page.keyboard.up(key);
  assert((player(r)[axis]-player(before)[axis])*sign>0);await stable('walk-'+key);record('held key produces actual walk '+key,{from:point(player(before)),to:point(player(r)),motion:player(r).motion});
 }
 for(const id of ['attack','spell'])for(const [direction,dx] of [['right',1],['left',-1]]){
  await safeAttackReady(id);const before=await read(),p=player(before),targetPoint={x:dx>0?11.2:.8,y:p.y};await aim(targetPoint);await press(id==='attack'?'1':'2');
  const queued=await capture(id+'-'+direction+'-windup');assert.equal(queued.pending.action,id);assert(Math.sign(queued.pending.direction.x)===dx);assert.equal(queued.state.combat.player.qi,before.state.combat.player.qi);
  await stable(id+'-'+direction+'-windup');
  const released=await watched("r.scene.player.motion.action==='"+id+"'&&r.scene.player.motion.phase==='release'",id+'-'+direction+'-release');
  assert.equal(Math.sign(player(released).motion.direction.x),dx);assert.equal(released.scene.tick,released.tick);
  await stable(id+'-'+direction+'-release');
  await watched("r.scene.player.motion.action==='"+id+"'&&r.scene.player.motion.phase==='recovery'",id+'-'+direction+'-recovery');
  await runTo(settled,id+' settled');record('mouse '+direction+' '+id+' windup release recovery',{target:targetPoint,actionId:queued.pending.id});
 }
}
async function impact(){
 phase='impact';await safeAttackReady('spell');let r=await read();await aim(point(enemy(r)));const beforeHp=enemy(r).hp;
 const flight=await watched('r.scene.projectiles.length>0','projectile-before-contact',{key:'2'});
 assert.equal(enemy(flight).hp,beforeHp);assert(!hits(flight).some(e=>e.actionId===flight.pending.id));await stable('projectile-before-contact');
 const actionId=flight.pending.id,hit=await watched("r.scene.effects.some(e=>e.kind==='hit'&&e.actionId==='"+actionId+"')",'projectile-contact');
 const event=hits(hit).find(e=>e.actionId===actionId);assert.equal(hits(hit).filter(e=>e.eventId===event.eventId).length,1);assert(enemy(hit).hp<beforeHp);assert.equal(event.tick,hit.tick);assert.equal(event.outcome,'hit');assert.equal(event.staggerTicks,3);assert.equal(enemy(hit).motion.phase,'hit');assert.equal(enemy(hit).motion.actionId,event.eventId);await stable('actual-heavy-contact');
 facingPreserved(hit,enemy(hit));
 record('projectile contact owns damage, unique spark and heavy stagger',{event,enemyHp:enemy(hit).hp,motion:enemy(hit).motion});
 await runTo(q=>settled(q)&&enemy(q).motion.phase!=='hit','contact recovery');
 // Let the enemy approach by its ordinary AI, then strike it in melee.
 await waitReady('attack');r=await runTo(q=>ready(q,'attack')&&(enemy(q).staggerImmuneUntilTick||0)<=q.tick&&Math.hypot(player(q).x-enemy(q).x,player(q).y-enemy(q).y)<=1.8,'enemy melee approach and reaction protection expiry');await safeAttackReady('attack');r=await read();await aim(point(enemy(r)));
 const startHp=enemy(r).hp;const melee=await watched("r.scene.effects.some(e=>e.kind==='hit'&&e.sourceId==='master'&&e.tick===r.tick&&e.projectileId===null)",'melee-contact',{key:'1'});
 const meleeEvent=hits(melee).find(e=>e.sourceId==='master'&&e.tick===melee.tick&&e.projectileId===null);assert(enemy(melee).hp<startHp);assert.equal(meleeEvent.staggerTicks,2);assert.equal(enemy(melee).motion.phase,'hit');await stable('actual-light-contact');record('melee contact gives light stagger',{event:meleeEvent,motion:enemy(melee).motion});
 await runTo(settled,'melee recovery');
}
async function defense(){
 phase='defense';await waitReady('guard');
 let r=await watched('r.scene.enemies[0].telegraph?.remaining>=.5&&r.scene.enemies[0].telegraph?.remaining<=.8&&!r.pending','enemy-guard-window');
 const hp=player(r).hp,oldTick=r.tick;
 r=await watched("r.scene.effects.some(e=>e.kind==='hit'&&e.targetId==='master'&&e.outcome==='guarded'&&e.tick>"+oldTick+")",'guarded-contact',{key:'3'});
 const guarded=hits(r).find(e=>e.targetId==='master'&&e.outcome==='guarded'&&e.tick>oldTick);assert.equal(guarded.staggerTicks,0);assert.notEqual(player(r).motion.phase,'hit');assert(player(r).hp<hp);await stable('guarded-contact');record('guarded contact shows shield response without stagger',{event:guarded,motion:player(r).motion});
 await waitReady('dodge');r=await watched('r.scene.enemies[0].telegraph?.remaining>=.3&&r.scene.enemies[0].telegraph?.remaining<=.4&&!r.pending','enemy-dodge-window');
 const p=player(r),t=enemy(r).telegraph,oldHp=p.hp,oldHitTick=r.tick;
 // A 1.05 m mouse step remains inside this 1.35 m telegraph while the real
 // short-step evasion window covers contact, so the outcome is observable.
 const candidates=[{x:p.x+1.05,y:p.y},{x:p.x-1.05,y:p.y},{x:p.x,y:p.y+1.05},{x:p.x,y:p.y-1.05}].filter(q=>q.x>=.6&&q.x<=11.4&&q.y>=.6&&q.y<=7.4&&Math.hypot(q.x-t.x,q.y-t.y)<t.radius);
 assert(candidates.length,'a legal short-step aim is needed');await aim(candidates[0]);
 const released=await watched("r.scene.player.motion.action==='dodge'&&r.scene.player.motion.phase==='release'",'dodge-release',{key:'Space'});
 assert.notDeepEqual(point(player(released)),point(p));await stable('dodge-release');
 r=await watched("r.scene.effects.some(e=>e.kind==='hit'&&e.targetId==='master'&&e.outcome==='evaded'&&e.tick>"+oldHitTick+")",'evaded-contact');
 const evaded=hits(r).find(e=>e.targetId==='master'&&e.outcome==='evaded'&&e.tick>oldHitTick);assert.equal(evaded.amount,0);assert.equal(evaded.staggerTicks,0);assert.equal(player(r).hp,oldHp);assert.notDeepEqual(point(player(r)),point(p));await stable('evaded-contact');record('short-step contact is evaded without damage or stagger',{event:evaded,from:point(p),to:point(player(r))});
 await runTo(settled,'dodge recovery');
 const afterDodgeTick=r.tick;r=await watched("r.scene.effects.some(e=>e.kind==='hit'&&e.targetId==='master'&&e.outcome==='hit'&&e.tick>"+afterDodgeTick+")",'player-heavy-hit');
 const received=hits(r).find(e=>e.targetId==='master'&&e.outcome==='hit'&&e.tick>afterDodgeTick);assert.equal(received.staggerTicks,3);assert.equal(player(r).motion.phase,'hit');await stable('player-heavy-hit');record('actual enemy strike produces player hit reaction',{event:received,motion:player(r).motion});
 facingPreserved(r,player(r));
}
async function nativeBlur(){
 phase='native-blur';await runTo(settled,'action completion before native blur');await pause(false);await electron.evaluate(({app,BrowserWindow},id)=>{app.focus({steal:true});BrowserWindow.fromId(id).focus();},gameWindowId);await page.keyboard.down('d');await sleep(220);const before=await read();await electron.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id).blur(),gameWindowId);await sleep(350);const after=await read(),focused=await electron.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id).isFocused(),gameWindowId);assert.equal(focused,false);assert.deepEqual(after.input.held,[]);assert.deepEqual(after.combat.controls.move,{x:0,y:0});assert(after.tick>before.tick);const stopped=point(player(after));await sleep(250);const late=await read();assert.deepEqual(point(player(late)),stopped);await page.keyboard.up('d');await electron.evaluate(({app,BrowserWindow},id)=>{app.focus({steal:true});BrowserWindow.fromId(id).focus();},gameWindowId);await pause(true);await capture('native-blur-restored');record('native blur clears held directions while the world advances',{nativeFocused:focused,fromTick:before.tick,toTick:after.tick,stopped});
}
async function finish(){
 phase='finish';let r=await read();for(let n=0;n<15&&r.scene.status==='active';n++){
  await waitReady('spell');r=await read();await aim(point(enemy(r)));await press('2');
  r=await runTo(q=>q.scene.status!=='active'||settled(q),'manual spell completion');
 }
 assert.equal(r.scene.status,'won');assert.equal(enemy(r).hp,0);assert.equal(enemy(r).motion.phase,'down');assert.equal(enemy(r).telegraph,null);assert.equal(r.pending,null);await capture('shanxiao-fall-start');
 const downTick=r.tick;r=await runTo(q=>q.tick>=downTick+3,'shanxiao fall completion');await capture('shanxiao-down');await stable('shanxiao-down');record('real manual attacks end in a stable downed enemy',{downTick,tick:r.tick,hp:enemy(r).hp,motion:enemy(r).motion});
}
async function defeat(){
 phase='defeat';const before=await read();
 let r=await watched("r.scene.status==='lost'",'master-fall-start',{seconds:95});
 assert.equal(player(r).hp,0);assert.equal(player(r).motion.phase,'down');assert.equal(r.pending,null);
 assert(r.state.personsById['person:master'].wound>before.state.personsById['person:master'].wound);
 const downTick=r.tick;r=await runTo(q=>q.tick>=downTick+3,'master fall completion');await capture('master-down');
 await stable('master-down');record('actual enemy strikes end in a stable downed master',{fromTick:before.tick,downTick,tick:r.tick,hp:player(r).hp,motion:player(r).motion});
}
try{
 await launch();const loaded=await read();assert.deepEqual(loaded.state,original.state);record('exact isolated source load',{source,sourceSha256:hash(sourceBytes),tick:loaded.tick});
 if(!resume)await outbound();else{assert.equal(loaded.scene.type,'combat');assert.equal(loaded.scene.status,'active');await capture('resumed-combat');}
 if(scenario==='all'||scenario==='orientation')await orientation();
 if(scenario==='all'||scenario==='impact')await impact();
 if(scenario==='all'||scenario==='defense')await defense();
 if(scenario!=='finish'&&scenario!=='defeat')await nativeBlur();
 if(scenario==='all'||scenario==='finish')await finish();
 if(scenario==='defeat')await defeat();
 await capture('complete-world');assert.deepEqual(errors,[]);complete=true;phase='complete';
}catch(e){errors.push(e.stack||String(e));console.error(e.stack);if(page){await pause(true).catch(()=>{});await capture('failure').catch(()=>{});}}
finally{
 if(page){try{await page.evaluate(()=>clearInterval(window.__motionQATimer));await persist('final');await capture('final-world');}catch(e){finalizationErrors.push(String(e.stack||e));}}
 try{await close();}catch(e){finalizationErrors.push(String(e.stack||e));}
 const runtimeAfter=await hashes(),sourceUnchanged=hash(await fs.readFile(source))===hash(sourceBytes),runtimeUnchanged=JSON.stringify(runtimeBefore)===JSON.stringify(runtimeAfter);
 const report={status:complete&&!errors.length&&!finalizationErrors.length&&sourceUnchanged&&runtimeUnchanged?'passed':'failed',scope:'visible macOS source Electron; public mouse, keyboard and buttons; phase screenshots and native state evidence',scenario,resume,source,sourceSha256:hash(sourceBytes),sourceUnchanged,runtimeBefore,runtimeAfter,runtimeUnchanged,initialTick:original.state.worldTick,finalTick:lastTick,wallSeconds:wall(),phase,checks,actions,errors,finalizationErrors};
 await fs.writeFile(path.join(output,'report.json'),json(report));console.log(json({status:report.status,report:path.join(output,'report.json')}));if(report.status!=='passed')process.exitCode=1;
}
