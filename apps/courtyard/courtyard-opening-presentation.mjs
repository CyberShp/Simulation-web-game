/** Versioned desktop presentation; the shared opening remains three formal pages. */
export const INTRO_FRAMES = Object.freeze([
  { page: 0, chapter: '序章 · 破门', title: '雨夜成灰', image: 'prologue-breach-v2.png',
    lines: ['赤嶂门破开沈氏山门，火光照亮满院冷雨。'] },
  { page: 0, chapter: '序章 · 守阵', title: '最后一道阵', image: 'prologue-stand-v2.png',
    lines: ['父亲反转残阵，独自挡住追兵，为你们争得片刻生路。'] },
  { page: 1, chapter: '序章 · 下山', title: '沿山路逃离', image: 'prologue-escape-v2.png',
    lines: ['母亲带着你沿侧山石阶向下奔逃。身后的旧宅，仍在雨中燃烧。'] },
  { page: 1, chapter: '序章 · 诀别', title: '留住这一息', image: 'prologue-farewell-v2.png',
    lines: ['母亲将旧布包紧紧按在你怀中，叮嘱你活下去，随后转身阻住追兵。', '双亲把性命留在了那个雨夜，换你独自逃出生天。'] },
  { page: 2, chapter: '序章 · 流亡', title: '一人走过长夜', image: 'prologue-exile-v2.png',
    lines: ['此后数月，你带伤隐匿山野，独自走过一程又一程。'] },
  { page: 2, chapter: '四个月后 · 云岫', title: '余烬立山', image: 'prologue-arrival-v2.png',
    lines: ['四个月后，你独自抵达母亲提起过的云岫山中。', '旧伤未愈，家传尚在。先在这里活下来。'] }
]);

export const BUNDLE_FRAMES = Object.freeze([
  { image: 'bundle-tied-v2.png', title: '母亲的旧布包', line: '你将一路护在怀中的布包，轻轻放在身前。' },
  { image: 'bundle-knot-v2.png', title: '解开绳结', line: '雨水浸过的绳结，在指间缓缓松开。' },
  { image: 'bundle-unfold-v2.png', title: '展开旧布', line: '你一层层揭开旧布，露出那卷家传。' },
  { image: 'prologue-scroll-v1.png', title: '一卷薪火', line: '布包中央，静静躺着母亲留下的一卷传承。' }
]);
export const BUNDLE_FRAME_MS = 1000;

export function restoreOpeningPresentation(saved, view) {
  const page = Math.max(0, Math.min(2, Math.trunc(view.introPage || 0)));
  const fallback = view.stage === 'intro' ? page * 2 : INTRO_FRAMES.length - 1;
  const valid = saved?.version === 1;
  const requestedFrame = valid ? saved.introFrame : null;
  const frameValid = Number.isInteger(requestedFrame) && requestedFrame >= 0 && requestedFrame < INTRO_FRAMES.length;
  const introFrame = frameValid && (view.stage !== 'intro' || INTRO_FRAMES[requestedFrame].page === page) ? requestedFrame : fallback;
  const raw = valid ? saved.bundle : null;
  const phase = ['closed', 'playing', 'open'].includes(raw?.phase) ? raw.phase : 'closed';
  const frame = phase === 'open' ? BUNDLE_FRAMES.length - 1 : phase === 'playing' && Number.isInteger(raw.frame)
    ? Math.max(0, Math.min(BUNDLE_FRAMES.length - 1, raw.frame)) : 0;
  return { version: 1, introFrame, bundle: { phase, frame } };
}

export function advanceBundleFrame(bundle) {
  if (bundle.phase !== 'playing') return { ...bundle };
  return bundle.frame < BUNDLE_FRAMES.length - 1
    ? { phase: 'playing', frame: bundle.frame + 1 }
    : { phase: 'open', frame: BUNDLE_FRAMES.length - 1 };
}
