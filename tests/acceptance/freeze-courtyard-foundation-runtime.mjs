/** Freeze only the code needed by the normal foundation-route Node harness.
 * Inspect: node --experimental-vm-modules tests/acceptance/freeze-courtyard-foundation-runtime.mjs --inspect
 * Create:  node --experimental-vm-modules tests/acceptance/freeze-courtyard-foundation-runtime.mjs --output=/absolute/new-runtime --baseline-report=/absolute/prior/report.json
 * Verify:  node --experimental-vm-modules tests/acceptance/freeze-courtyard-foundation-runtime.mjs --verify=/absolute/frozen-runtime
 * Parsing never evaluates game modules. No save file or dependency package is copied.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {builtinModules} from 'node:module';
import {execFileSync} from 'node:child_process';
import * as vm from 'node:vm';

const HARNESS='tests/acceptance/courtyard-foundation-route-public.mjs';
const SELF='tests/acceptance/freeze-courtyard-foundation-runtime.mjs';
const MANIFEST='frozen-code.json';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const option=key=>{const text=process.argv.find(arg=>arg.startsWith(`--${key}=`));if(text)return text.slice(key.length+3);const index=process.argv.indexOf(`--${key}`);return index<0?undefined:process.argv[index+1];};
const output=option('output'),verify=option('verify'),baselinePath=option('baseline-report'),inspect=process.argv.includes('--inspect');
const repository=await fs.realpath(fileURLToPath(new URL('../..',import.meta.url)));
const builtin=new Set(builtinModules.map(name=>name.replace(/^node:/,'')));
assert(typeof vm.SourceTextModule==='function','Run Node with --experimental-vm-modules; the built-in parser is required');
assert([!!output,!!verify,inspect].filter(Boolean).length===1,'choose exactly one of --inspect, --output or --verify');

const allowed=file=>file.startsWith('src/simulation/')&&file.endsWith('.mjs')||file.startsWith('apps/courtyard/')&&file.endsWith('.mjs')||file===HARNESS||file===SELF;
function relativeInside(root,absolute){const file=path.relative(root,absolute).split(path.sep).join('/');assert(file&&file!=='..'&&!file.startsWith('../')&&!path.isAbsolute(file),'file must remain inside the code root');return file;}
async function readCode(root,file){assert(allowed(file),`dependency is outside the permitted code roots: ${file}`);const absolute=path.join(root,file),real=await fs.realpath(absolute);assert.equal(real,absolute,`symlink source modules are unsupported: ${file}`);assert((await fs.stat(absolute)).isFile(),`module is not a file: ${file}`);return fs.readFile(absolute);}
function dependencies(file,bytes){
 const source=bytes.toString('utf8');
 // This closure has no dynamic imports. Refuse future additions until their concrete files are declared.
 assert(!/\bimport\s*\(/.test(source),`dynamic imports require an explicit dependency audit: ${file}`);
 const module=new vm.SourceTextModule(source,{identifier:pathToFileURL(path.join(repository,file)).href});
 return [...module.dependencySpecifiers];
}
function localDependency(root,file,specifier){
 if(builtin.has(specifier.replace(/^node:/,'')))return null;
 assert(specifier.startsWith('./')||specifier.startsWith('../'),`external module requires an existing explicit runtime dependency: ${file} -> ${specifier}`);
 assert(!specifier.includes('?')&&!specifier.includes('#'),'module query/hash imports need an explicit audit');
 return relativeInside(root,path.resolve(root,path.dirname(file),specifier));
}
async function simulationModules(root,directory='src/simulation'){
 const result=[];
 for(const entry of await fs.readdir(path.join(root,directory),{withFileTypes:true})){
  const file=`${directory}/${entry.name}`;
  assert(!entry.isSymbolicLink(),`simulation symlink requires an explicit audit: ${file}`);
  if(entry.isDirectory())result.push(...await simulationModules(root,file));
  else if(entry.isFile()&&entry.name.endsWith('.mjs'))result.push(file);
 }
 return result.sort();
}
async function collect(root){
 const simulation=await simulationModules(root),queue=[HARNESS,SELF,...simulation],contents=new Map(),imports=[];
 while(queue.length){const file=queue.shift();if(contents.has(file))continue;const bytes=await readCode(root,file);contents.set(file,bytes);for(const specifier of dependencies(file,bytes)){const dependency=localDependency(root,file,specifier);imports.push({from:file,specifier,to:dependency,builtin:dependency===null});if(dependency&&!contents.has(dependency))queue.push(dependency);}}
 const files=[...contents.keys()].sort();
 return {simulation,files,contents,imports};
}
async function bindBaseline(graph){
 if(!baselinePath)return null;
 assert(path.isAbsolute(baselinePath),'--baseline-report must be absolute');
 const bytes=await fs.readFile(baselinePath),report=JSON.parse(bytes);
 assert.equal(report.runtimeUnchanged,true,'preceding run must preserve its runtime');
 assert.equal(report.sourceUnchanged,true,'preceding run must preserve its source');
 const previous=report.runtimeSha256After;assert(previous&&Object.keys(previous).length,'preceding report has a complete runtime hash table');
 for(const[file,digest]of Object.entries(previous)){
  const bytes=graph.contents.get(file);assert(bytes,`baseline module is not present in the freeze: ${file}`);
  assert.equal(hash(bytes),digest,`current source differs from the preceding runtime: ${file}`);
 }
 return {path:baselinePath,sha256:hash(bytes),status:report.status,sourceTick:report.sourceTick,finalTick:report.finalTick,
  runtimeMatched:true,runtimeFileCount:Object.keys(previous).length};
}
async function verifyFrozen(root){
 root=await fs.realpath(root);
 assert(!(await fs.stat(path.join(root,'freeze-failure.json')).catch(()=>null)),'freeze has a failure marker');
 const manifest=JSON.parse(await fs.readFile(path.join(root,MANIFEST),'utf8'));
 assert.equal(manifest.schema,'courtyard-foundation-code/v1');assert(manifest.files?.[HARNESS]&&manifest.files?.[SELF],'frozen harness and verifier are present');
 const graph=await collect(root);
 assert.deepEqual(graph.files,Object.keys(manifest.files).sort(),'current frozen dependency closure equals its manifest');
 for(const file of graph.files)assert.equal(hash(graph.contents.get(file)),manifest.files[file].sha256,`frozen file changed: ${file}`);
 assert.deepEqual(graph.imports,manifest.imports,'frozen static imports remain exact');
 const runtimeHash=hash(JSON.stringify(Object.fromEntries(graph.files.map(file=>[file,hash(graph.contents.get(file))]))));
 assert.equal(runtimeHash,manifest.codeSetSha256,'whole code-set hash remains exact');
 return {status:'verified',root,files:graph.files.length,simulationModules:graph.simulation.length,
  appModules:graph.files.filter(file=>file.startsWith('apps/courtyard/')),harness:HARNESS,codeSetSha256:runtimeHash,
  sourceHead:manifest.source.head,baseline:manifest.source.baseline,manifestSha256:hash(await fs.readFile(path.join(root,MANIFEST)))};
}

try{
 if(verify){assert(path.isAbsolute(verify),'--verify must be absolute');console.log(JSON.stringify(await verifyFrozen(verify)));}
 else{
  const graph=await collect(repository),baseline=await bindBaseline(graph);
  const files=Object.fromEntries(graph.files.map(file=>[file,{sha256:hash(graph.contents.get(file)),bytes:graph.contents.get(file).length}]));
  const head=execFileSync('git',['rev-parse','HEAD'],{cwd:repository,encoding:'utf8'}).trim();
  const codeSetSha256=hash(JSON.stringify(Object.fromEntries(graph.files.map(file=>[file,files[file].sha256]))));
  const summary={files:graph.files.length,bytes:Object.values(files).reduce((n,file)=>n+file.bytes,0),simulationModules:graph.simulation.length,
   appModules:graph.files.filter(file=>file.startsWith('apps/courtyard/')),harness:HARNESS,sourceHead:head,codeSetSha256,baseline};
  if(inspect)console.log(JSON.stringify({status:'inspected',...summary}));
  else{
   assert(path.isAbsolute(output),'--output must be absolute');
   const lexical=path.resolve(output);assert(lexical!==repository&&!lexical.startsWith(repository+path.sep),'freeze output belongs outside the source repository');
   await fs.mkdir(path.dirname(lexical),{recursive:true});
   const destination=path.join(await fs.realpath(path.dirname(lexical)),path.basename(lexical));
   assert(destination!==repository&&!destination.startsWith(repository+path.sep),'freeze output belongs outside the source repository');
   await fs.mkdir(destination);
   try{
    for(const file of graph.files){await fs.mkdir(path.dirname(path.join(destination,file)),{recursive:true});await fs.writeFile(path.join(destination,file),graph.contents.get(file),{flag:'wx'});}
    for(const file of graph.files)assert.equal(hash(await readCode(repository,file)),files[file].sha256,`source changed while freezing: ${file}`);
    const manifest={schema:'courtyard-foundation-code/v1',createdAt:new Date().toISOString(),nodeVersion:process.version,
     source:{repository,head,baseline},entry:HARNESS,codeSetSha256,files,imports:graph.imports,
     scope:'Frozen Node simulation, required courtyard modules and the acceptance harness',
     verification:'Built-in ESM parser dependency closure and SHA-256 readback; no module evaluation or world advancement'};
    await fs.writeFile(path.join(destination,MANIFEST),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({...await verifyFrozen(destination),sourceUnchangedDuringFreeze:true}));
   }catch(error){await fs.writeFile(path.join(destination,'freeze-failure.json'),JSON.stringify({status:'failed',error:error.stack},null,2)+'\n',{flag:'wx'});throw error;}
  }
 }
}catch(error){console.error(JSON.stringify({status:'failed',error:error.message}));process.exitCode=1;}
