import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fileSystem from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(fileURLToPath(new URL('../../../',import.meta.url)));
async function actualHostFiles(){
 const source=await fs.readFile(path.join(root,'apps/courtyard/courtyard-host.cjs'),'utf8'),start=source.indexOf('const mimeTypes = {'),end=source.indexOf('\nif (!ownsProfile)',start);assert(start>=0&&end>start,'the actual host static-file boundary must be present');
 const context={fs:fileSystem,path,URL,root:path.join(root,'apps/courtyard'),assetRoot:path.join(root,'assets/courtyard'),simulationRoot:path.join(root,'src/simulation'),origin:''};
 return {serve:vm.runInNewContext(source.slice(start,end)+'\nserveFile;',context),setOrigin:value=>{context.origin=value;}};
}
test('the formal host serves UTF-8 credits for GET and HEAD while retaining file and origin restrictions',async()=>{
 const host=await actualHostFiles(),server=http.createServer(host.serve);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;host.setOrigin(origin);
 try{
  const pathname='/assets/combat-pixel-v1/CREDITS.txt',expected=await fs.readFile(path.join(root,'assets/courtyard/combat-pixel-v1/CREDITS.txt')),response=await fetch(origin+pathname);
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'text/plain; charset=utf-8');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(Buffer.from(await response.arrayBuffer()),expected);
  const head=await fetch(origin+pathname,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('content-type'),'text/plain; charset=utf-8');
  for(const [file,options,status]of [[pathname,{method:'POST'},405],['/courtyard-host.cjs',{},403],['/src/simulation/CREDITS.txt',{},403],['/assets/%2e%2e%2f%2e%2e%2fpackage-lock.txt',{},403]])assert.equal((await fetch(origin+file,options)).status,status,file);
  const wrongHost=await new Promise((resolve,reject)=>{const request=http.get(origin+pathname,{headers:{Host:'untrusted.invalid'}},response=>{response.resume();response.once('end',()=>resolve(response.statusCode));});request.once('error',reject);});assert.equal(wrongHost,403);
  assert.equal((await fetch(origin+'/src/simulation/ea-combat-geometry.mjs')).status,200,'existing simulation modules remain accessible');
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('the product credits dialog preserves reading reasons and manual pause, renders plain text and exposes load failure',{timeout:15000},async t=>{
 let failCredits=true,requests=0,useFixtureCredits=true;const actualFiles=await actualHostFiles();
 const credits='Component fixture author · CC-BY-SA 3.0\nhttps://example.invalid/source\n<img src=x onerror="globalThis.executedCredits=true">';
 let servedCredits=credits;
 const server=http.createServer(async(req,res)=>{try{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(name==='/assets/combat-pixel-v1/CREDITS.txt'){requests++;if(!useFixtureCredits){actualFiles.serve(req,res);return;}res.writeHead(failCredits?503:200,{'Content-Type':'text/plain; charset=utf-8'});res.end(failCredits?'temporarily unavailable':servedCredits);return;}
  const file=path.resolve(root,name.startsWith('/src/')?'.'+name:'apps/courtyard'+name);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  let data=await fs.readFile(file);if(name==='/courtyard.html')data=Buffer.from(data.toString().replace('<script type="module" src="courtyard-main.mjs"></script>',''));
  res.setHeader('Content-Type',name.endsWith('.mjs')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.html')?'text/html':'application/octet-stream');res.end(data);
 }catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));actualFiles.setOrigin(`http://127.0.0.1:${server.address().port}`);let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});const page=await browser.newPage(),errors=[];page.setDefaultTimeout(3000);page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/courtyard.html`,{waitUntil:'domcontentloaded'});
  const initialize=async()=>{
   const {createCourtyardCombat}=await import('/courtyard-combat.mjs'),player={id:'master',x:4,y:4,hp:100,maxHp:100,qi:50,facing:{x:1,y:0}};
   const view={tick:100,masterWound:0,paused:false,opening:{stage:'complete'},expedition:{away:true,scene:{type:'combat',sessionId:'credits-component',interactive:true,status:'active',tick:100,player,allies:[],enemies:[]},combat:{controls:{autoAttack:false},manualActions:[]},world:{party:{companionIds:[],maxCompanions:2,candidates:[]},exits:[{id:'exit:yunxiu-valley',near:true,available:true}],scene:{id:'scene:valley',name:'山谷',player,objects:[]}}}};
   const state={manual:false,reading:false,commands:[],notifications:[]};
   const ui=createCourtyardCombat({getView:()=>view,command:q=>{state.commands.push(q);return {ok:true};},announce(){},beforeDepart(){},canInteract:()=>true,pause(){state.manual=true;view.paused=true;},onDepartureReadingChange:reading=>{state.reading=reading;state.notifications.push(reading);view.paused=state.manual||reading;}});
   const listener=event=>ui.key(event);globalThis.fixture={ui,state,view,listener};addEventListener('keydown',listener);ui.render();
   // This component fixture replaces main's ready/load step and owns no world.
   document.getElementById('loading').hidden=true;
  };await page.evaluate(initialize);
  await page.click('#combat-art-credits-open');await page.waitForFunction(()=>document.getElementById('combat-art-credits-content').textContent.includes('503'));
  assert.equal(await page.evaluate(()=>fixture.view.paused),true);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>fixture.view.paused),false);
  failCredits=false;
  for(const manual of [false,true]){
   await page.evaluate(manual=>{fixture.state.manual=manual;fixture.view.paused=manual;},manual);await page.click('#combat-art-credits-open');await page.waitForFunction(()=>document.getElementById('combat-art-credits-content').textContent.startsWith('Component fixture author'));
   assert.equal(await page.locator('#combat-art-credits-content').textContent(),credits);assert.equal(await page.locator('#combat-art-credits-content img').count(),0);assert.equal(await page.evaluate(()=>globalThis.executedCredits),undefined);
   const blocked=await page.evaluate(()=>{const before=fixture.state.commands.length;fixture.ui.key({code:'KeyW',target:document.body,preventDefault(){}});fixture.ui.key({code:'Digit1',target:document.body,preventDefault(){}});document.getElementById('expedition-open').click();dispatchEvent(new Event('blur'));return {commands:fixture.state.commands.length-before,departureOpen:document.getElementById('expedition-departure').open,reading:fixture.state.reading,held:fixture.ui.inputState().held};});
   assert.deepEqual(blocked,{commands:1,departureOpen:false,reading:true,held:[]});
   await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>fixture.state.reading),false);assert.equal(await page.evaluate(()=>fixture.view.paused),manual);
  }
  assert.equal(requests,2,'a successful text fetch is reused; an earlier failure remains retryable');
  const mutual=await page.evaluate(()=>{
   fixture.state.manual=false;fixture.view.paused=false;fixture.view.expedition.away=false;fixture.ui.render();document.getElementById('expedition-open').click();const departure=document.getElementById('expedition-departure');
   document.getElementById('combat-art-credits-open').click();const blocked=!document.getElementById('combat-art-credits-dialog').open,reading=fixture.state.reading;
   departure.close();return {blocked,reading};
  });
  assert.deepEqual(mutual,{blocked:true,reading:true});await page.waitForFunction(()=>!fixture.state.reading);assert.equal(await page.evaluate(()=>fixture.view.paused),false);
  await page.evaluate(()=>{removeEventListener('keydown',fixture.listener);fixture.ui.dispose();});assert.equal(await page.locator('#combat-art-credits-dialog').count(),0);
  const actualCredits=await fs.readFile(new URL('../../../assets/courtyard/combat-pixel-v1/CREDITS.txt',import.meta.url),'utf8');assert.match(actualCredits,/CC-BY-SA/);assert.match(actualCredits,/OGA-BY/);assert.match(actualCredits,/Authors:/);useFixtureCredits=false;
  await page.evaluate(initialize);await page.click('#combat-art-credits-open');await page.waitForFunction(()=>document.getElementById('combat-art-credits-content').textContent.startsWith('Pixel sample artwork attribution'));assert.equal(await page.locator('#combat-art-credits-content').textContent(),actualCredits);
  await page.click('#combat-art-credits-dialog button');await page.evaluate(()=>{removeEventListener('keydown',fixture.listener);fixture.ui.dispose();});assert.deepEqual(errors,[]);t.diagnostic(JSON.stringify({scope:'product DOM component; no native or world execution',browserVersion:browser.version(),creditsRequests:requests,actualCreditsCharacters:actualCredits.length}));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
});
