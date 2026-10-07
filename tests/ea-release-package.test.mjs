import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

test('Pages package resolves every module and keeps preview shared navigation outside the preview directory',()=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),dir=mkdtempSync(join(tmpdir(),'ea-pages-')),output=join(dir,'release.json');
 try{
  const run=spawnSync('python3',[join(root,'qa/package-pages-release.py'),'--tag','qa-package-test','--output',output],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const entries=JSON.parse(readFileSync(output,'utf8')),byPath=new Map(entries.map(e=>[e.path,e]));
  for(const prefix of ['', 'ea-preview/']){
   assert.match(byPath.get(prefix+'index.html').content,/ea-bootstrap\.mjs\?v=qa-package-test/);
   const scenic=byPath.get(prefix+'ea-scenic.mjs').content;
   assert.ok(scenic.includes(prefix?'../yunxiu-courtyard/navigation.mjs':'./yunxiu-courtyard/navigation.mjs'));
   assert.ok(byPath.get(prefix+'ea-courtyard-renderer.mjs').content.includes(prefix?'../assets/ea-courtyard-empty.jpg':'./assets/ea-courtyard-empty.jpg'));
  }
  for(const entry of entries.filter(e=>e.path.endsWith('.mjs'))){
   for(const match of entry.content.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)){
    if(!match[1].startsWith('.'))continue;
    const url=new URL(match[1],'https://example.test/'+entry.path),path=url.pathname.slice(1);
    assert.equal(url.searchParams.getAll('v').length,1,entry.path+' versioned dependency');
    assert.equal(url.searchParams.get('v'),'qa-package-test');
    assert.ok(byPath.has(path)||existsSync(join(root,'dist',path)),entry.path+' unresolved '+path);
   }
  }
 }finally{rmSync(dir,{recursive:true,force:true});}
});
