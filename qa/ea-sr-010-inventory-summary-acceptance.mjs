/** SR-XF-010-I01 / ECON-02/03: one read-only inventory projection of located holdings. */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../dist/ea-opening-sim.mjs';
import {renderSRPanel} from '../dist/ea-sr-ui.mjs';
import {harness} from './ea-sr-integration-acceptance.mjs';

function snapshot(h,label,group,key,expected){
 const before=JSON.stringify(h.s),groups=S.viewEconomy(h.s).inventorySummary;
 const entry=groups.find(g=>g.id===group)?.amounts[key];
 assert(entry,`${label}: ${group}/${key} exists`);
 assert.deepEqual(entry,{available:expected[0],reserved:expected[1],inTransit:expected[2],shortage:expected[3]||0,total:expected[0]+expected[1]+expected[2]},label);
 const card=renderSRPanel(h.s,S,'production').match(new RegExp(`<article class="sr-card" data-key="inventory-summary-${group}">([\\s\\S]*?)<\\/article>`))?.[1];
 assert(card,`${label}: ${group} inventory card is visible`);
 assert(card.includes(`data-ledger-resource="${key}"`),`${label}: ${key} is listed`);
 const row=card.match(new RegExp(`data-ledger-resource="${key}"[^>]*><strong>[^<]+<\/strong> · 总量 ([^ ]+) · 可用 ([^ ]+) · 预留 ([^ ]+) · 在途 ([^ ]+) · 已知缺口 ([^<]+)<\/p>`));
 assert(row,`${label}: five quantities are visible`);
 for(const [index,field] of ['total','available','reserved','inTransit','shortage'].entries())assert(Math.abs(Number(row[index+1])-entry[field])<=Math.max(1,Math.abs(entry[field]))*1e-11,`${label}: visible ${field} follows the read-only projection`);
 assert.equal(JSON.stringify(h.s),before,`${label}: views do not write state`);
 const normalized=JSON.stringify(S.validateSave(JSON.parse(before)));
 assert.equal(JSON.stringify(S.validateSave(JSON.parse(normalized))),normalized,`${label}: validated saved JSON stays byte-for-byte stable`);
}

test('normal construction moves one public batch through reserve, carrying, site, installation and return',()=>{
 const h=harness();h.act('masterAction','heal');h.until(s=>s.master.wound===0,'public healing',500);
 snapshot(h,'before build','public','wood',[65,0,0]);
 const b=h.act('build','farm',26,16);
 snapshot(h,'construction reserved','public','wood',[40,25,0]);
 snapshot(h,'jade budget reserved','public','jade',[80,30,0]);
 h.until(s=>s.workOrdersById[b.workOrderId].materialFlow.phase==='carrying','actual construction pickup',200);
 snapshot(h,'construction carrying','public','wood',[40,0,25]);
 h.until(s=>s.workOrdersById[b.workOrderId].materialFlow.phase==='ready','materials delivered at site',300);
 snapshot(h,'construction site reserved','public','stone',[35,10,0]);
 h.until(s=>s.workOrdersById[b.workOrderId].progressTicks>=40,'actual installation',300);
 snapshot(h,'wood after installation','public','wood',[40,20,0]);
 snapshot(h,'jade after installation','public','jade',[80,24,0]);
 h.act('cancelConstruction');h.until(s=>!s.workOrdersById[b.workOrderId],'physical return and cancellation',500);
 snapshot(h,'returned uninstalled wood','public','wood',[60,0,0]);
 snapshot(h,'returned unspent jade','public','jade',[104,0,0]);
});

test('normal gift and personal harvest keep private goods out of the public ledger until delivery',()=>{
 const h=harness();h.act('acknowledgeIntro');h.act('masterAction','heal');h.until(s=>s.master.wound===0,'public healing',500);
 h.act('advanceStory');h.walk(28,13);h.act('advanceStory','gift');
 assert.equal(h.s.stockpilesById['stockpile:lu-zhiwei'].resources.herb,10);
 snapshot(h,'recipient private gift excluded','public','herb',[6,0,0]);
 const harvest=h.act('startMasterHarvest','wood');h.until(s=>!s.activitiesById[harvest.id],'public wood harvest',500);
 snapshot(h,'earned personal wood','personal','wood',[12,0,0]);
 const t=h.act('startTransport','stockpile:carried:master','stockpile:yunxiu','person:master',{wood:12});
 snapshot(h,'personal wood reserved once','personal','wood',[0,12,0]);
 h.until(s=>s.workOrdersById[t.id].phase==='carrying','actual pickup',20);
 snapshot(h,'personal wood in transit once','personal','wood',[0,0,12]);
 h.until(s=>s.workOrdersById[t.id].phase==='delivered','actual delivery',500);
 snapshot(h,'delivered wood becomes public','public','wood',[77,0,0]);
 assert.equal(S.viewEconomy(h.s).inventorySummary.find(g=>g.id==='personal').amounts.wood.total,0);
});

test('normal two-sided market order reserves distinct public cargo and merchant payment once',()=>{
 const h=harness();snapshot(h,'original public wood','public','wood',[65,0,0]);
 snapshot(h,'original merchant payment','merchant','jade',[600,0,0]);
 h.act('marketOrder','artisan_tools','accept-v2');
 snapshot(h,'seller wood held','public','wood',[45,20,0]);
 snapshot(h,'seller freight held','public','food',[48,2,0]);
 snapshot(h,'buyer payment held','merchant','jade',[570,30,0]);
 h.act('marketOrder','artisan_tools','pickup-v2');
 snapshot(h,'seller cargo carried','public','wood',[45,0,20]);
 snapshot(h,'freight carried','public','food',[48,0,2]);
 snapshot(h,'buyer payment stays held','merchant','jade',[570,30,0]);
 h.act('marketOrder','artisan_tools','cancel-v2');
 snapshot(h,'cancelled cargo remains with master','personal','wood',[20,0,0]);
 snapshot(h,'cancelled payment returns to merchant','merchant','jade',[600,0,0]);
});

test('a completed farm shows only its known next-batch onsite seed shortage',()=>{
 const h=harness();h.act('masterAction','heal');h.until(s=>s.master.wound===0,'public healing',500);
 const b=h.act('build','farm',26,16);h.until(s=>!s.workOrdersById[b.workOrderId],'normal farm completion',1000);
 snapshot(h,'farm onsite seed gap','public','herb',[16,0,0,2]);
});
