/** Paired Issue #6 verification and timing. Run after both benchmark processes finish. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
const args=process.argv.slice(2),option=(k,f)=>{const i=args.indexOf(k);return i<0?f:args[i+1];};
const dir=resolve(option('--directory','/tmp/ea-history-benchmark')),prefix=option('--scenario','opening');
const before=await import(pathToFileURL(join(resolve(option('--before-runtime','dist')),'ea-opening-sim.mjs')));
const after=await import(pathToFileURL(join(resolve(option('--after-runtime','dist')),'ea-opening-sim.mjs')));
const reportBefore=JSON.parse(readFileSync(join(dir,prefix+'-before-report.json'))),reportAfter=JSON.parse(readFileSync(join(dir,prefix+'-after-report.json')));
const strip=s=>{const o=JSON.parse(JSON.stringify(s));delete o.factsById;delete o.travelsById;delete o.historyRetention;return o;};
function equalGameplay(a,b){
 assert.deepEqual(strip(b),strip(a),'all non-history authoritative fields must match exactly');
 for(const table of ['factsById','travelsById'])for(const [id,row]of Object.entries(b[table]))assert.deepEqual(row,a[table][id],table+'/'+id+' changed or appeared');
}
const stats=v=>{const s=[...v].sort((a,b)=>a-b);return {p50:s[Math.floor((s.length-1)*.5)],p95:s[Math.floor((s.length-1)*.95)],mean:s.reduce((a,b)=>a+b,0)/s.length};};
const results=[];
for(const sample of reportBefore.samples){
 const hour=sample.hour;if(!reportAfter.samples.some(s=>s.hour===hour))continue;
 const a=before.validateSave(JSON.parse(readFileSync(join(dir,`${prefix}-before-${hour}h.json`)))),b=after.validateSave(JSON.parse(readFileSync(join(dir,`${prefix}-after-${hour}h.json`))));
 equalGameplay(a,b);
 for(const fn of ['viewWeather','viewEconomy','viewOrganization','viewSRWorld'])assert.deepEqual(after[fn](b),before[fn](a),'knowledge/gameplay projection '+fn);
 const timings={before:{validate:[],command:[],tick:[]},after:{validate:[],command:[],tick:[]}};
 // Alternate order to limit JIT, GC and CPU drift; discard first three iterations.
 for(let i=0;i<24;i++)for(const which of (i%2?['after','before']:['before','after'])){
  const sim=which==='before'?before:after,s=which==='before'?a:b;
  let t=performance.now();sim.validateSave(s);if(i>=3)timings[which].validate.push(performance.now()-t);
  t=performance.now();assert.equal(sim.dispatchCommand(s,{name:'setSpeed',args:[1]}).status,'committed');if(i>=3)timings[which].command.push(performance.now()-t);
 }
 const continuations={before:before.validateSave(a),after:after.validateSave(b)};
 for(let i=0;i<1200;i++)for(const which of (i%2?['after','before']:['before','after'])){
  const sim=which==='before'?before:after,t=performance.now();sim.tick(continuations[which],.1);timings[which].tick.push(performance.now()-t);
 }
 equalGameplay(continuations.before,continuations.after);
 assert.deepEqual(JSON.parse(JSON.stringify(after.validateSave(continuations.after))),JSON.parse(JSON.stringify(continuations.after)));
 const result={hour,before:{facts:Object.keys(a.factsById).length,travels:Object.keys(a.travelsById).length,bytes:Buffer.byteLength(JSON.stringify(a))},after:{facts:Object.keys(b.factsById).length,travels:Object.keys(b.travelsById).length,bytes:Buffer.byteLength(JSON.stringify(b))},exactGameplay:true,exactProjections:true,continuationTicks:1200};
 for(const which of ['before','after'])for(const metric of ['validate','command','tick'])result[which][metric+'Ms']=stats(timings[which][metric]);
 results.push(result);console.log(JSON.stringify(result));
}
writeFileSync(join(dir,prefix+'-comparison.json'),JSON.stringify({node:process.version,scenario:prefix,method:'21 warmed alternating measurements, 1200 actual 100ms ticks per checkpoint; full gameplay state and 4 public views exactly compared',results},null,2)+'\n');
