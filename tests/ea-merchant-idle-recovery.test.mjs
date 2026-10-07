import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../dist/ea-opening-sim.mjs';
import {tickEconomy} from '../dist/ea-sr-economy.mjs';

test('an exhausted merchant recovers while idle in a scene, including after reload',()=>{
 let s=S.initial({sr:true,seed:618033});
 const merchant=s.personsById['person:merchant-qingxi'];
 merchant.energy=9.4;
 s.srEconomy.merchantArrivalTick=1000;
 s.srEconomy.merchantVisitEndsTick=1900;
 s.srEconomy.merchantSchedulePhase='market';
 const start=s.worldTick;
 for(let i=0;i<4;i++)S.tick(s,.1);
 assert.equal(s.worldTick,start+4);
 assert(merchant.energy>=10,'idle recovery restores eligibility for physical collection');
 const raw=JSON.stringify(s);
 s=S.validateSave(JSON.parse(raw));
 assert(s.personsById['person:merchant-qingxi'].energy>=10);
});

test('traveling merchant does not recover energy offscreen',()=>{
 const s=S.initial({sr:true,seed:618033}),merchant=s.personsById['person:merchant-qingxi'];
 merchant.energy=9.4;
 s.srEconomy.merchantSchedulePhase='arriving';
 s.srEconomy.merchantArrivalTick=s.worldTick+300;
 s.worldTick++;
 tickEconomy(s);
 assert.equal(merchant.position.kind,'worldTravel');
 const energy=merchant.energy;
 s.worldTick++;
 tickEconomy(s);
 assert.equal(merchant.energy,energy);
});

test('departure tick does not grant a scene rest before travel starts',()=>{
 const s=S.initial({sr:true,seed:618033}),merchant=s.personsById['person:merchant-qingxi'];
 merchant.energy=9.4;
 merchant.position={kind:'scene',sceneId:'scene:yunxiu-courtyard',x:32,y:18};
 s.srEconomy.merchantSchedulePhase='home';
 s.srEconomy.merchantVisitEndsTick=s.worldTick+1;
 s.worldTick++;
 tickEconomy(s);
 assert.equal(merchant.position.kind,'worldTravel');
 assert.equal(merchant.energy,9.4);
});
