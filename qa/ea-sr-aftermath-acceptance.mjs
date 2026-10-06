/** SR-XF-020/022: normal delayed death, real notification, custody and debt.
 * No screenshots, process artifacts, resource/realm/time injection on the normal path. */
import assert from 'node:assert/strict';
import * as S from '../dist/ea-opening-sim.mjs';
import {harness} from './ea-sr-integration-acceptance.mjs';
import {initAftermath,reconcileAftermathKnowledge,validateAftermath} from '../dist/ea-sr-aftermath.mjs';
import {recordFactSR,publishFactSR} from '../dist/ea-sr-world.mjs';

const SU='person:su-yelan',KIN='person:su-mingzhi',GU='person:gu-wanyi',results=[];
function check(name,fn){const detail=fn();results.push({name,...detail});console.log('PASS '+name);}
const h=harness();
function save(){
 const before=JSON.parse(JSON.stringify(h.s)),after=S.validateSave(structuredClone(before));
 const firstDiff=(x,y,path='state')=>{if(JSON.stringify(x)===JSON.stringify(y))return null;if(x&&y&&typeof x==='object'&&typeof y==='object'){for(const k of new Set([...Object.keys(x),...Object.keys(y)])){const d=firstDiff(x[k],y[k],path+'.'+k);if(d)return d;}}return {path,before:x,after:y};};
 const diff=firstDiff(before,after);assert.equal(diff,null,'reload changed '+JSON.stringify(diff));h.save();
}
h.act('masterAction','heal');h.until(s=>s.master.wound===0,'normal initial healing');
h.act('advanceStory');h.until(s=>s.weatherByRegionId['region:yunxiu'].phase==='rain','natural rain',3000);
assert.equal(h.s.personsById[KIN],undefined,'kin and debt are not retroactively put in an inactive world');
h.act('srStoryCommand',{action:'activateRainChain'});
h.until(s=>s.crisesById['crisis:rain:su-yelan']?.outcome==='dead','intentional late arrival',1500);save();
const undiscovered=JSON.stringify(h.s);
check('SR022-AC03 undiscovered death keeps lineage source and finite debt without informing absent family',()=>{
 assert.equal(S.viewAftermath(h.s).deaths.length,0);
 assert.equal(h.s.personsById[SU].lifeStatus,'dead');
 assert.equal(h.s.srAftermath.lineages[KIN][0].status,'unavailable');
 assert.equal(h.s.srAftermath.lineages[KIN][0].teacherId,SU);
 assert.equal(h.s.srAftermath.debts['debt:su-yelan:gu-herbs'].status,'estate-pending');
 assert.equal(h.s.srAftermath.debts['debt:su-yelan:gu-herbs'].debtorId,SU);
 assert.equal(Object.values(h.s.srAftermath.reactions).some(r=>r.observerId===KIN),false);
 assert.equal(JSON.stringify(h.s),undiscovered,'read-only projection cannot discover death');
});
h.travel('scene:valley');h.worldWalk(47,35);h.act('srCrisisCommand',{action:'search',crisisId:'crisis:rain:su-yelan'});save();
check('SR022 physical discovery does not disclose death to family or copy private property',()=>{
 assert.equal(S.viewAftermath(h.s).deaths[0].personId,SU);assert.equal(S.viewAftermath(h.s).deaths[0].obligationsKnown,true,'old letters and contracts are learned only at the original relic');
 assert.equal(h.s.itemsById[`item:relic:${SU}`].ownerId,SU);
 assert.equal(h.s.itemsById[`item:relic:${SU}`].location.kind,'scene');
 assert.equal(Object.values(h.s.srAftermath.reactions).some(r=>r.observerId===KIN),false);
 assert.throws(()=>h.act('aftermathAction',{choice:'collect',personId:SU}),/托付/);
});
h.travel('scene:market');h.worldWalk(28,27);
const notify=h.act('aftermathAction',{choice:'notify',personId:SU,counterpartyId:KIN});
h.act('setSpeed',0);const paused=JSON.stringify(h.s);S.tick(h.s,100);assert.equal(JSON.stringify(h.s),paused);h.act('setSpeed',1);
h.until(s=>s.srAftermath.orders[notify.orderId].phase==='completed','real fifty-step notification');save();
check('SR020/022 known kin mourns with a finite consent delay; recipient learns only after real delivery',()=>{
 assert.equal(h.s.srAftermath.orders[notify.orderId].durationTicks,50);
 const r=Object.values(h.s.srAftermath.reactions).find(r=>r.observerId===KIN);assert.equal(r.kind,'mourning');
 assert.ok(r.untilTick>r.learnedTick);assert.match(h.s.personsById[KIN].mind.goal,/守护/);
 assert.equal(h.s.personsById[KIN].mind.relationships.master.trust,55,'no accusation of the messenger from an unknown death cause');
 assert.equal(h.s.personsById[GU].knownFacts.includes(h.s.deathRecordsByPersonId[SU].factId),false);
 assert.throws(()=>h.act('aftermathAction',{choice:'permission',personId:SU,counterpartyId:KIN,informed:true}),/40世界步/);
});
h.until(s=>s.worldTick>=s.personsById[KIN].schedule.aftermath.settleAfterTick,'real grief preparation');
let o=h.act('aftermathAction',{choice:'permission',personId:SU,counterpartyId:KIN,informed:true});h.until(s=>s.srAftermath.orders[o.orderId].phase==='completed','actual custody consent');save();
h.travel('scene:valley');h.worldWalk(47,35);o=h.act('aftermathAction',{choice:'collect',personId:SU});h.until(s=>s.srAftermath.orders[o.orderId].phase==='completed','onsite original relic collection');save();
check('SR022 private estate custody is a real same-instance transfer with no inheritance windfall',()=>{
 const item=h.s.itemsById[`item:relic:${SU}`];assert.equal(item.ownerId,SU);assert.equal(item.location.id,'person:master');
 assert.equal(Object.values(h.s.itemsById).filter(i=>i.id===item.id).length,1);assert.equal(h.s.stockpilesById['stockpile:su-yelan'].ownerId,SU);
 assert.throws(()=>h.act('aftermathAction',{choice:'collect',personId:SU}),/重复/);
});
h.travel('scene:market');h.worldWalk(28,27);o=h.act('aftermathAction',{choice:'handover',personId:SU,counterpartyId:KIN,informed:true});h.until(s=>s.srAftermath.orders[o.orderId].phase==='completed','actual kin handover');save();
check('SR020 estate handover changes personal response and public conduct once, preserves the original owner',()=>{
 const item=h.s.itemsById[`item:relic:${SU}`];assert.equal(item.ownerId,SU);assert.equal(item.location.id,KIN);assert.equal(h.s.personsById[SU].lifeStatus,'dead');
 assert.equal(h.s.personsById[KIN].mind.relationships.master.trust,63);
 const before=JSON.stringify({portrait:h.s.srWorld.portrait,person:h.s.srWorld.personRelations,kin:h.s.personsById[KIN].mind.relationships});
 for(let n=0;n<5;n++)reconcileAftermathKnowledge(h.s);
 assert.equal(JSON.stringify({portrait:h.s.srWorld.portrait,person:h.s.srWorld.personRelations,kin:h.s.personsById[KIN].mind.relationships}),before);
 assert.throws(()=>h.act('aftermathAction',{choice:'handover',personId:SU,counterpartyId:KIN,informed:true}),/原遗物/);
});
h.worldWalk(h.s.personsById[GU].position.x,h.s.personsById[GU].position.y);o=h.act('aftermathAction',{choice:'notify',personId:SU,counterpartyId:GU});h.until(s=>s.srAftermath.orders[o.orderId].phase==='completed','actual creditor notification');save();
const debtId='debt:su-yelan:gu-herbs',stock=h.s.stockpilesById['stockpile:sr-party'],beforeHerb=stock.resources.herb;
o=h.act('aftermathAction',{choice:'payDebt',personId:SU,counterpartyId:GU,debtId,informed:true});save();
h.act('aftermathAction',{choice:'cancel',orderId:o.orderId});assert.equal(h.s.stockpilesById[stock.id].resources.herb,beforeHerb);
o=h.act('aftermathAction',{choice:'payDebt',personId:SU,counterpartyId:GU,debtId,informed:true});save();h.until(s=>s.srAftermath.orders[o.orderId].phase==='completed','actual finite debt handover');save();
check('SR022 finite debt remains with deceased, voluntary payment conserves carried and creditor stock through cancellation/reload',()=>{
 const d=h.s.srAftermath.debts[debtId];assert.equal(d.debtorId,SU);assert.equal(d.paid,2);assert.equal(d.status,'settled');assert.equal(d.settlements.length,1);
 assert.equal(h.s.stockpilesById[stock.id].resources.herb,beforeHerb-2);assert.equal(h.s.stockpilesById[`stockpile:death-creditor:${GU}`].resources.herb,2);
 assert.throws(()=>h.act('aftermathAction',{choice:'payDebt',personId:SU,counterpartyId:GU,debtId,informed:true}),/未清/);
 assert.equal(h.s.srWorld.portrait.promises,2);assert.equal(h.s.personsById[KIN].appearance.recipe.id,`appearance:${KIN}:v1`);
 assert.equal(h.s.personsById[SU].lifeStatus,'dead');validateAftermath(h.s);
});

let rescueLineage;
check('SR020 normal rescue and fifty-step public sharing deliver distinct personal/faction responses on the next common step',()=>{
 const r=harness();r.act('masterAction','heal');r.until(s=>s.master.wound===0,'normal rescue initial healing');r.act('advanceStory');r.until(s=>s.weatherByRegionId['region:yunxiu'].phase==='rain','natural rescue weather',3000);r.act('srStoryCommand',{action:'activateRainChain'});r.until(s=>s.crisesById['crisis:rain:su-yelan']?.messageDelivered,'actual rain clue',500);
 r.travel('scene:valley');r.worldWalk(47,35);r.act('srCrisisCommand',{action:'search',crisisId:'crisis:rain:su-yelan'});r.act('srCrisisCommand',{action:'treat',crisisId:'crisis:rain:su-yelan'});r.save();r.until(s=>s.crisesById['crisis:rain:su-yelan'].outcome==='rescued','actual eight-herb rescue');r.save();
 const fid='fact:social:crisis:rain:su-yelan:rescue',claimId=`claim:fact:${fid}:person:master`;assert.equal(r.s.srWorld.portrait.help,1);assert.equal(r.s.personsById[KIN].mind.relationships.master.trust,55);
 r.travel('scene:market');r.worldWalk(28,27);const share=r.act('srWorldCommand',{action:'share',claimId,recipientId:KIN});assert.equal(share.durationTicks,50);r.until(s=>!s.srWorld.interaction,'real delivery to rescue beneficiary kin');assert.equal(r.s.personsById[KIN].mind.relationships.master.trust,55,'world delivery does not create another callback clock');S.tick(r.s,.1);assert.equal(r.s.personsById[KIN].mind.relationships.master.trust,64);r.save();assert.equal(r.act('srWorldCommand',{action:'share',claimId,recipientId:KIN}),false);
 const gu=r.s.personsById[GU],ft=r.s.factionsById[gu.factionId].reputation,gt=gu.mind.relationships.master.trust,unaware=r.s.personsById['person:zhou-an'],ut=unaware.mind.relationships.master.trust;
 r.worldWalk(gu.position.x,gu.position.y);r.act('srWorldCommand',{action:'share',claimId,recipientId:GU});r.until(s=>!s.srWorld.interaction,'real interested-faction contact delivery');S.tick(r.s,.1);assert.equal(r.s.personsById[GU].mind.relationships.master.trust,gt+3);assert.equal(r.s.factionsById[gu.factionId].reputation,ft+3);assert.equal(r.s.personsById['person:zhou-an'].mind.relationships.master.trust,ut);assert.equal(r.s.srWorld.portrait.help,1);r.save();rescueLineage=r.counts;
});
check('SR020 different interests react only to delivered evidence; actor, faction and public portrait are once-only',()=>{
 const s=S.initial({sr:true}),beneficiary=s.personsById['person:gu-wanyi'],enemy=s.personsById['person:wei-qingshu'],unaware=s.personsById['person:zhou-an'];
 // Explicit interest fixture; this tests appraisal semantics, not a normal rescue claim.
 enemy.mind.relationships[`d:${beneficiary.id}`]={trust:5};
 const f=recordFactSR(s,'fact:qa:interest-rescue',{kind:'rescue',actorId:'person:master',personId:beneficiary.personId,text:'定向验收：掌门实际救助顾婉仪'});
 publishFactSR(s,f.id);publishFactSR(s,f.id,beneficiary.personId);publishFactSR(s,f.id,enemy.personId);
 const bt=beneficiary.mind.relationships.master.trust,et=enemy.mind.relationships.master.trust,ut=unaware.mind.relationships.master.trust,br=s.factionsById[beneficiary.factionId].reputation;
 reconcileAftermathKnowledge(s);assert.equal(beneficiary.mind.relationships.master.trust,Math.min(100,bt+18));assert.equal(enemy.mind.relationships.master.trust,et-2);assert.equal(unaware.mind.relationships.master.trust,ut);assert.equal(s.factionsById[beneficiary.factionId].reputation,br+4);assert.equal(s.srWorld.portrait.help,1);
 const raw=JSON.stringify(s);reconcileAftermathKnowledge(s);assert.equal(JSON.stringify(s),raw);S.validateSave(JSON.parse(raw));
 const late=recordFactSR(s,'fact:qa:late-response',{kind:'rescue',actorId:'person:master',personId:beneficiary.personId,text:'定向验收：回应先发生，掌门后来才获证据'});publishFactSR(s,late.id,beneficiary.personId);
 const trust=beneficiary.mind.relationships.master.trust;reconcileAftermathKnowledge(s);const after=beneficiary.mind.relationships.master.trust;assert.equal(after,Math.min(100,trust+18));assert.equal(s.srWorld.personRelations[beneficiary.personId].memories.includes(late.id),false);
 publishFactSR(s,late.id);reconcileAftermathKnowledge(s);assert.equal(beneficiary.mind.relationships.master.trust,after);assert.equal(s.srWorld.personRelations[beneficiary.personId].memories.includes(late.id),true);assert.equal(s.srWorld.portrait.help,2);S.validateSave(JSON.parse(JSON.stringify(s)));
});
check('SR022 a delivered death message does not reveal unread private contracts; idle reconciliation never scans accumulated history',()=>{
 const s=S.validateSave(JSON.parse(undiscovered)),fid=s.deathRecordsByPersonId[SU].factId;publishFactSR(s,fid);reconcileAftermathKnowledge(s);
 const d=S.viewAftermath(s).deaths[0];assert.equal(d.obligationsKnown,false);assert.deepEqual(d.kin,[]);assert.deepEqual(d.creditors,[]);
 let scans=0;const original=s.claimsById;s.claimsById=new Proxy(original,{ownKeys(target){scans++;return Reflect.ownKeys(target);}});
 for(let n=0;n<20;n++)reconcileAftermathKnowledge(s);assert.equal(scans,0,'warm idle cache must not traverse claims');s.claimsById=original;
});
check('SR022 old save without aftermath metadata does not insert past family/debt or retrospectively change social facts',()=>{
 const s=S.validateSave(JSON.parse(undiscovered)),oldKin=s.personsById[KIN];delete s.personsById[KIN];delete s.srAftermath;
 const identities=Object.keys(s.personsById),reputation=JSON.stringify({portrait:s.srWorld.portrait,factions:s.factionsById,relations:s.srWorld.personRelations});
 initAftermath(s);reconcileAftermathKnowledge(s);assert.deepEqual(Object.keys(s.personsById),identities);assert.deepEqual(s.srAftermath.kinships,[]);assert.deepEqual(s.srAftermath.debts,{});assert.equal(s.srAftermath.migrationTick,s.worldTick);assert.equal(JSON.stringify({portrait:s.srWorld.portrait,factions:s.factionsById,relations:s.srWorld.personRelations}),reputation);assert(oldKin);
});
console.log(JSON.stringify({suite:'SR aftermath',passed:results.length,failed:0,results,normalLineage:h.counts,rescueLineage,boundary:'Normal natural-weather public-command custody/debt chain; explicit interests and legacy-shape fixtures are separately labeled. Physical devices and visible-UI acceptance remain separate.'},null,2));
