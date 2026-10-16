import test from 'node:test';
import assert from 'node:assert/strict';
import { INTRO_FRAMES, BUNDLE_FRAMES, restoreOpeningPresentation, advanceBundleFrame } from '../../../apps/courtyard/courtyard-opening-presentation.mjs';
import { createOpeningSectSession, commandSect, openingView, snapshotSect, restoreSect, advanceSect } from '../../../apps/courtyard/sect-sim.mjs';

const send = (session, request) => assert.equal(commandSect(session, request).ok, true);
const savedPresentation = (session, presentation) => {
  const data = snapshotSect(session);
  data.courtyardPresentation = { version: 2, manualPause: false, opening: presentation };
  return restoreSect(JSON.stringify(data));
};

test('six visual frames save and restore on the same three-page story, including backwards navigation', () => {
  let session = createOpeningSectSession();
  assert.equal(INTRO_FRAMES.length, 6);
  assert.equal(new Set(INTRO_FRAMES.map(frame => frame.image)).size, 6);
  assert.deepEqual(INTRO_FRAMES.map(frame => frame.page), [0, 0, 1, 1, 2, 2]);
  for (const frame of [0, 1, 2, 3, 2, 1, 2, 3, 4, 5]) {
    const page = INTRO_FRAMES[frame].page;
    if (openingView(session).introPage !== page) send(session, { type: 'opening-intro', page });
    const presentation = restoreOpeningPresentation(null, openingView(session));
    presentation.introFrame = frame;
    session = savedPresentation(session, presentation);
    assert.equal(restoreOpeningPresentation(session.courtyardPresentation.opening, openingView(session)).introFrame, frame);
    assert.equal(session.state.story.onboarding.introPage, page);
    assert.equal(session.state.worldTick, 0);
    assert.equal(session.state.story.intro, false);
  }
  send(session, { type: 'opening-intro', complete: true });
  assert.equal(openingView(session).stage, 'shelter');
});

test('legacy and invalid presentation records start at the corresponding formal scene', () => {
  for (const introPage of [0, 1, 2]) {
    const view = { stage: 'intro', introPage };
    for (const saved of [null, { version: 9, introFrame: 1 }, { version: 1, introFrame: -1 }, { version: 1, introFrame: 7 }]) {
      assert.equal(restoreOpeningPresentation(saved, view).introFrame, introPage * 2);
    }
  }
  assert.equal(restoreOpeningPresentation({ version: 1, introFrame: 0 }, { stage: 'intro', introPage: 2 }).introFrame, 4);
  assert.deepEqual(restoreOpeningPresentation(null, { stage: 'inheritance', introPage: 2 }).bundle, { phase: 'closed', frame: 0 });
  assert.deepEqual(restoreOpeningPresentation({ version: 1, bundle: { phase: 'open', frame: 0 } }, { stage: 'inheritance' }).bundle, { phase: 'open', frame: 3 });
});

test('bundle frames and replay retain pending inheritance, one heal charge and frozen world through reload', () => {
  let session = createOpeningSectSession();
  send(session, { type: 'opening-intro', page: 2 });
  send(session, { type: 'opening-intro', complete: true });
  send(session, { type: 'heal' });
  const world = structuredClone(session.state);
  let presentation = restoreOpeningPresentation(null, openingView(session));
  for (let replay = 0; replay < 2; replay++) {
    presentation.bundle = { phase: 'playing', frame: 0 };
    for (let frame = 0; frame < BUNDLE_FRAMES.length; frame++) {
      session = savedPresentation(session, presentation);
      presentation = restoreOpeningPresentation(session.courtyardPresentation.opening, openingView(session));
      assert.deepEqual(presentation.bundle, { phase: 'playing', frame });
      advanceSect(session, 60);
      assert.deepEqual(session.state, world);
      presentation.bundle = advanceBundleFrame(presentation.bundle);
    }
    assert.deepEqual(presentation.bundle, { phase: 'open', frame: 3 });
    session = savedPresentation(session, presentation);
    assert.deepEqual(restoreOpeningPresentation(session.courtyardPresentation.opening, openingView(session)), presentation);
    assert.equal(session.state.stockpilesById['stockpile:yunxiu'].resources.herb, 16);
  }
  send(session, { type: 'choose-inheritance', lineage: 'hanquan' });
  assert.equal(openingView(session).stage, 'recovering');
  assert.equal(session.state.stockpilesById['stockpile:yunxiu'].resources.herb, 16);
});
