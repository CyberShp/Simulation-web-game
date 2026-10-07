/** SR-XF-017-AC-01: seven local contacts through a normal public-command save. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as SIM from '../dist/ea-opening-sim.mjs';
import {createEAPersistence} from '../dist/ea-persistence.mjs';
import {renderSRPanel} from '../dist/ea-sr-ui.mjs';
import {LOCAL_FACTIONS} from '../dist/ea-sr-world.mjs';
import {normalOpening} from './ea-sr-integration-acceptance.mjs';

const contacts = [
  {factionId:'faction:yunxiu-herb', personId:'person:gu-wanyi', sceneId:'scene:market', cardId:'card:local:medicine-care:v1'},
  {factionId:'faction:yunxiu-puppet', personId:'person:luo-ming', sceneId:'scene:market', cardId:'card:local:puppet-repair:v1'},
  {factionId:'faction:yunxiu-government', personId:'person:zhou-an', sceneId:'scene:market', cardId:'card:local:road-maintenance:v1'},
  {factionId:'faction:yunxiu-sword', personId:'person:wei-qingshu', sceneId:'scene:market', cardId:'card:local:sword-route:v1'},
  {factionId:'faction:chizhang', personId:'person:chizhang-steward', sceneId:'scene:supply', cardId:'card:local:workers-wages:v1'},
  {factionId:'faction:yunxiu-ghost', personId:'person:yin-shu', sceneId:'scene:ruins', cardId:'card:local:peace-lamps:v1'},
  {factionId:'faction:yunxiu-saber', personId:'person:duan-jin', sceneId:'scene:quarry', cardId:'card:local:knife-contract:v1'},
];
const evidenceDir = process.env.XIANFU_QA_SR017_AC01_DIR;

test('seven named local contacts exchange only their finite, physically held contract goods', () => {
  const h = normalOpening();
  const persistence = createEAPersistence({validate: SIM.validateSave, dataVersion: 6,
    gameVersion: '1.6.0-dev', writerId: 'qa-sr017-ac01'});
  const checkpoint = label => {
    h.save();
    const raw = JSON.stringify(h.s);
    const imported = persistence.parseImport(persistence.exportState(h.s, {slot: 1}));
    assert.equal(imported.ok, true, `${label}: native import succeeds`);
    assert.equal(JSON.stringify(imported.state), raw, `${label}: exact save survives import`);
    assert.equal(renderSRPanel(imported.state, SIM, 'explore'), renderSRPanel(h.s, SIM, 'explore'),
      `${label}: public world explanation survives import`);
    assert.equal(JSON.stringify(h.s), raw, `${label}: reading the world panel does not advance play`);
    if (!evidenceDir) return;
    const dir = resolve(evidenceDir);
    mkdirSync(dir, {recursive:true});
    writeFileSync(resolve(dir, `${label}.json`), JSON.stringify({provenance:{
      kind:'normal-public-command-checkpoint', label:`SR-XF-017-AC-01 ${label}`,
      counts:h.counts}, state:h.s}));
    writeFileSync(resolve(dir, `${label}-import.json`), persistence.exportState(h.s, {slot:1}));
  };
  const wait = label => h.until(s => !s.srWorld.interaction && !s.srWorld.activeTravelId, label, 6000);
  const approach = personId => {
    const p = h.s.personsById[personId];
    assert.equal(p.location.sceneId, h.s.master.location.sceneId, `${personId}: same actual scene`);
    const {x,y} = p.location;
    for (const [px,py] of [[x,y],[x-2,y],[x+2,y],[x,y+2],[x,y-2]]) {
      try {h.worldWalk(px,py);return;} catch (error) {
        if (!/阻挡/.test(error.message)) throw error;
      }
    }
    assert.fail(`${personId}: no reachable contact position`);
  };
  const offer = cardId => {
    for (let n=0;n<2500;n++) {
      const status = h.s.srWorldContent.records[cardId].status;
      if (status === 'offered' || status === 'verified') return;
      assert.equal(status, 'dormant', `${cardId}: unexpected previous disposition`);
      const visible = SIM.viewSRWorld(h.s).content.cards.filter(c => ['offered','verified'].includes(c.status));
      if (visible.length >= 3) {
        const other = visible.find(c => c.id !== cardId && c.sceneId === h.s.master.location.sceneId);
        assert(other, 'director cannot be blocked by target card');
        approach(other.personId);
        h.act('srWorldCommand', {action:'content', cardId:other.id, choice:'decline'});
      } else SIM.tick(h.s,.1);
    }
    assert.fail(`${cardId}: local opportunity was not offered in bounded play`);
  };
  const clearCurrentSceneOffers = () => {
    for (let n=0;n<40;n++) {
      const pending = SIM.viewSRWorld(h.s).content.cards.find(c =>
        ['offered','verified'].includes(c.status) && c.sceneId === h.s.master.location.sceneId);
      if (!pending) return;
      approach(pending.personId);
      h.act('srWorldCommand',{action:'content',cardId:pending.id,choice:'decline'});
    }
    assert.fail('local offered cards did not drain in bounded play');
  };
  const meet = (row,index) => {
    assert.equal(h.s.master.location.sceneId,row.sceneId);
    const faction = h.s.factionsById[row.factionId], person = h.s.personsById[row.personId];
    assert(faction && person && person.factionId === row.factionId);
    assert.equal(LOCAL_FACTIONS.find(f => f.id === row.factionId)?.contactId, row.personId);
    const publicFaction = SIM.viewSRWorld(h.s).reputation.factions.find(f => f.id === row.factionId);
    assert(publicFaction?.request && publicFaction?.industry && publicFaction?.contact === person.name,
      `${row.factionId}: player can read the named contact and request`);
    offer(row.cardId);
    approach(row.personId);
    const card = SIM.viewSRWorld(h.s).content.cards.find(c => c.id === row.cardId);
    assert(card && card.personId === row.personId && card.personName === person.name);
    assert(Object.values(card.cost).some(v => v > 0) && Object.values(card.reward).some(v => v > 0));
    const worldPanel = renderSRPanel(h.s, SIM, 'explore');
    const journalPanel = renderSRPanel(h.s, SIM, 'journal');
    for (const visible of [publicFaction.name, publicFaction.contact])
      assert(journalPanel.includes(visible), `${row.factionId}: ${visible} is explained in the journal`);
    for (const visible of [card.title, card.personName])
      assert(worldPanel.includes(visible), `${row.factionId}: ${visible} is explained in the world panel`);
    const bankId = `stockpile:content:${row.cardId.replaceAll(':','-')}`;
    const bank = h.s.stockpilesById[bankId], party = h.s.stockpilesById['stockpile:sr-party'];
    assert.equal(bank.ownerId,row.personId);
    assert.equal(bank.position.sceneId,row.sceneId);
    for (const [key,quantity] of Object.entries(card.reward)) assert(bank.resources[key] >= quantity);
    const beforeBank = {...bank.resources}, beforeParty = {...party.resources};
    h.act('srWorldCommand', {action:'content', cardId:row.cardId, choice:'verify'});
    wait(`${row.cardId}: original terms reviewed`);
    assert.equal(h.s.srWorldContent.records[row.cardId].verified,true);
    const verified = SIM.viewSRWorld(h.s).content.cards.find(c => c.id === row.cardId);
    assert(verified && verified.terms);
    h.act('srWorldCommand', {action:'content', cardId:row.cardId, choice:'negotiate'});
    wait(`${row.cardId}: finite exchange settled`);
    const result = h.s.factsById[`fact:content:${row.cardId}:result`];
    assert(result && result.personId === row.personId);
    assert.equal(h.s.srWorldContent.records[row.cardId].status,'completed');
    const afterBank = h.s.stockpilesById[bankId], afterParty = h.s.stockpilesById['stockpile:sr-party'];
    for (const [key,quantity] of Object.entries(card.reward)) {
      assert.equal(afterBank.resources[key],beforeBank[key]-quantity+((card.cost[key]||0)+(key==='food'?1:0)),
        `${row.cardId}: source holds no refreshed reward`);
      assert.equal(afterParty.resources[key],beforeParty[key]+quantity-(card.cost[key]||0)-(key==='food'?1:0),
        `${row.cardId}: player receives only the paid-for quantity`);
    }
    for (const key of Object.keys(beforeBank))
      assert(Math.abs((afterBank.resources[key] + afterParty.resources[key]) -
        (beforeBank[key] + beforeParty[key])) < 1e-9,
      `${row.cardId}: ${key} stays in a named physical stockpile`);
    const after = JSON.stringify(h.s);
    assert.throws(() => h.act('srWorldCommand', {action:'content',cardId:row.cardId,choice:'accept'}), /已结束/);
    assert.equal(JSON.stringify(h.s),after,`${row.cardId}: repeat trade does not create goods`);
    checkpoint(`contact-${index+1}`);
  };

  assert.equal(new Set(contacts.map(c => c.factionId)).size,7);
  h.travel('scene:market',{cargo:{wood:30,stone:15,herb:10,food:35}});
  for (let i=0;i<4;i++) meet(contacts[i],i);
  h.worldWalk(12.5,16);
  h.act('srWorldCommand',{action:'investigate',sourceId:'object:market:ledger'});
  wait('market ledger reveals the actual supply route');
  assert(h.s.srWorld.knownScenes.includes('scene:supply'));
  clearCurrentSceneOffers();
  h.travel('scene:supply');
  meet(contacts[4],4);
  clearCurrentSceneOffers();
  h.travel('scene:ruins');
  meet(contacts[5],5);
  clearCurrentSceneOffers();
  h.travel('scene:quarry');
  meet(contacts[6],6);
  assert.equal(contacts.filter(c => !!h.s.factsById[`fact:content:${c.cardId}:result`]).length,7);
  checkpoint('seven-contacts-complete');
  console.log(JSON.stringify({counts:h.counts, contacts:contacts.map(c => ({factionId:c.factionId,
    personId:c.personId, cardId:c.cardId, resultFactId:`fact:content:${c.cardId}:result`}))}));
});
