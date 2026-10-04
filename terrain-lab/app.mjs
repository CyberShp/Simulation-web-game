import { appearance, audit, command, createState, master, POIS, step, VERSION } from './world.mjs?v=terrain-lab-1.0.2';
import { createRenderer, portraitURL } from './renderer.mjs?v=terrain-lab-1.0.2';
import { attachMapInput } from '../map-input.mjs?v=terrain-lab-1.0.2';
const $ = id => document.getElementById(id), esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const storageKey = 'xianfu-terrain-lab-v1'; let state = createState(), freePlace = false, tour = null, lastFrame = performance.now(), lastUI = 0, lastSave = 0, fpsSamples = [], hidden = false;
const options = { paths: true, collision: false, silhouette: false, relocate: false };
try {
  const stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
  if (stored?.version === VERSION) {
    const candidate = createState();
    if (Array.isArray(stored.people) && stored.people.length >= 6 && stored.people.length <= 10) {
      for (let i = 6; i < stored.people.length; i++) command(candidate, 'recruit');
      candidate.actors.forEach((a, i) => { const p = stored.people[i]; if (p.id === a.id && Number.isSafeInteger(p.seed) && Number.isFinite(p.x) && Number.isFinite(p.y)) { a.seed = p.seed; a.appearance = appearance(p.seed); a.x = p.x; a.y = p.y; } });
      if (stored.workshop && Number.isInteger(stored.workshop.x) && Number.isInteger(stored.workshop.y)) { const b = candidate.map.buildings.find(b => b.id === 'workshop'); b.x = stored.workshop.x; b.y = stored.workshop.y; }
      if (!audit(candidate).length) { state = candidate; command(state, 'party', Array.isArray(stored.party) ? stored.party : []); state.notice = '已恢复本机山院体验，人物外观保持原样。'; }
    }
  }
} catch { /* A damaged lab save never reads or changes formal game saves. */ }
const renderer = createRenderer($('world'), () => state, () => options);
$('master-portrait').src = portraitURL(master(state));
$('world').dataset.version = VERSION;
const icons = { home: '⌂', west: '⌁', bridge: '≋', garden: '❧', arena: '⚔' };
document.querySelector('.destinations').innerHTML = POIS.map(p => `<button data-go="${p.id}"><span aria-hidden="true">${icons[p.id]}</span>${p.name}</button>`).join('');
let rosterSignature = '';
function updateRoster() {
  const signature = state.actors.map(a => a.id + ':' + a.seed).join(',') + state.party.join(','); if (signature === rosterSignature) return; rosterSignature = signature;
  $('roster').innerHTML = state.actors.slice(1).map(a => `<label class="person"><img src="${portraitURL(a)}" alt="${esc(a.name)}外观"><span><b>${esc(a.name)}</b><small>${state.party.includes(a.id) ? '愿意同行 · 自主行动' : '院中生活 · 自主走动'}</small></span><input type="checkbox" value="${a.id}" aria-label="邀请${esc(a.name)}同行" ${state.party.includes(a.id) ? 'checked' : ''}></label>`).join('');
}
function save() {
  try { const b = state.map.buildings.find(b => b.id === 'workshop'); localStorage.setItem(storageKey, JSON.stringify({ version: VERSION, people: state.actors.map(a => ({ id: a.id, seed: a.seed, x: a.x, y: a.y })), party: state.party, workshop: { x: b.x, y: b.y } })); $('save-status').textContent = '本机体验已保存'; }
  catch { $('save-status').textContent = '本次体验仅在当前页面保留'; }
}
function refresh() {
  updateRoster(); $('hp').value = master(state).hp; $('qi').value = master(state).qi;
  $('player-action').textContent = state.paused ? '世界暂停' : master(state).moving ? '沿路行走' : state.combat ? '试炼中' : '院中调息';
  $('notice').textContent = freePlace ? '点选地面安置百工坊；不能占用水面、台阶、人物或封死道路。' : state.notice || '点选道路，开始行走。';
  $('logs').innerHTML = state.logs.map(l => `<li>${esc(l)}</li>`).join('');
  $('pause').textContent = state.paused ? '▶' : 'Ⅱ'; $('pause').setAttribute('aria-label', state.paused ? '继续游戏' : '暂停游戏');
  $('trial').textContent = state.combat ? '结束试炼' : '开启试炼'; $('tour').textContent = tour ? '停止演示' : '演示一圈';
  const b = state.map.buildings.find(b => b.id === 'workshop'); $('build-status').textContent = `百工坊 · ${b.x === 9 && b.y === 4 ? '原位' : b.y === 11 ? '西路' : b.x === 9 && b.y === 9 ? '庭前' : '新址'}`;
  const samples = [...fpsSamples].sort((a, b) => a - b), frame = samples[Math.floor(samples.length * .95)] || 0;
  $('metrics').innerHTML = `<dl><dt>已抵达次数</dt><dd>${state.stats.arrivals}</dd><dt>重新寻路</dt><dd>${state.stats.replans}</dd><dt>受阻闪避 / 行走</dt><dd>${state.stats.blockedMoves}</dd><dt>同行自主出手</dt><dd>${state.stats.allyAttacks}</dd><dt>通行异常</dt><dd>${state.stats.violations}</dd><dt>被遮挡人物</dt><dd>${renderer.metrics.occluded}</dd><dt>本机帧间隔 P95</dt><dd>${frame.toFixed(1)} ms</dd><dt>掌门落脚点</dt><dd>${master(state).x.toFixed(2)}, ${master(state).y.toFixed(2)}</dd></dl>`;
}
function act(type, value) { const result = command(state, type, value); refresh(); save(); return result; }
document.querySelector('.destinations').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) { tour = null; act('walk', b.dataset.go); } });
$('roster').addEventListener('change', e => {
  const selected = [...$('roster').querySelectorAll('input:checked')].map(el => el.value);
  if (selected.length > 2) { e.target.checked = false; state.notice = '此次至多邀请两位同行，请先取消一位。'; refresh(); return; }
  act('party', selected);
});
$('recruit').onclick = () => act('recruit');
const positions = { road: { x: 9, y: 11 }, court: { x: 9, y: 9 }, reset: { x: 9, y: 4 } };
document.querySelectorAll('[data-place]').forEach(b => b.onclick = () => { tour = null; freePlace = false; options.relocate = false; act('relocate', positions[b.dataset.place]); });
$('free-place').onclick = () => { freePlace = !freePlace; options.relocate = freePlace; refresh(); };
$('pause').onclick = () => { state.paused = !state.paused; refresh(); };
$('trial').onclick = () => { tour = null; act('trial'); };
$('attack').onclick = () => act('attack'); $('dodge').onclick = () => act('dodge');
for (const name of ['paths', 'collision', 'silhouette']) $(name).onchange = () => { options[name] = $(name).checked; refresh(); };
$('fold').onclick = () => { const expanded = $('panel').classList.toggle('expanded'); $('fold').textContent = expanded ? '⌄' : '⌃'; $('fold').setAttribute('aria-expanded', String(expanded)); };
$('zoom-in').onclick = () => renderer.zoom(.15); $('zoom-out').onclick = () => renderer.zoom(-.15); $('locate').onclick = () => renderer.focus();
$('world').addEventListener('wheel', e => { e.preventDefault(); renderer.zoom(e.deltaY < 0 ? .06 : -.06); }, { passive: false });
const pan = { get x() { return renderer.camera.panX; }, set x(v) { renderer.camera.panX = v; renderer.resize(); }, get y() { return renderer.camera.panY; }, set y(v) { renderer.camera.panY = v; renderer.resize(); } };
attachMapInput($('world'), { pan, onHover() {}, enabled: () => !$('guide').open && !hidden, onDragChange: v => { $('world').classList.toggle('dragging', v); $('world').style.cursor = v ? 'grabbing' : 'crosshair'; }, onActivate(e) {
  const p = renderer.worldPoint(e); tour = null;
  if (freePlace) { const placed = act('relocate', { x: Math.floor(p.x), y: Math.floor(p.y) }); if (placed) { freePlace = options.relocate = false; refresh(); } }
  else act('walk', p);
} });
$('world').addEventListener('keydown', e => {
  const d = { w: { x: -1, y: -1 }, a: { x: -1, y: 1 }, s: { x: 1, y: 1 }, d: { x: 1, y: -1 }, ArrowUp: { x: -1, y: -1 }, ArrowLeft: { x: -1, y: 1 }, ArrowDown: { x: 1, y: 1 }, ArrowRight: { x: 1, y: -1 } }[e.key];
  if (d) { e.preventDefault(); tour = null; const m = master(state); act('walk', { x: m.x + d.x * 2, y: m.y + d.y * 2 }); }
  if (e.code === 'Space') { e.preventDefault(); act('dodge'); }
});
$('help').onclick = () => $('guide').showModal(); $('close-guide').onclick = $('start-guide').onclick = () => $('guide').close();
$('tour').onclick = () => {
  if (tour) { tour = null; state.notice = '演示已停止，可自由行走。'; refresh(); return; }
  state.paused = false; state.combat = false;
  tour = { phase: 0, started: state.elapsed, arrived: state.stats.arrivals };
  act('walk', 'home'); state.notice = '演示开始：归院、过桥、搬迁、试炼、换人和归途。'; refresh();
};
function tourStep() {
  if (!tour || master(state).path.length || state.elapsed - tour.started < .5) return;
  const steps = [() => { act('walk', 'garden'); act('relocate', positions.road); }, () => { act('walk', 'arena'); }, () => { act('trial'); act('attack'); }, () => { act('party', ['gu', 'su']); act('dodge', { x: 0, y: -1 }); }, () => { state.combat = false; act('walk', 'home'); }, () => { act('relocate', positions.reset); state.notice = `演示完成：重新寻路 ${state.stats.replans} 次，通行异常 ${state.stats.violations} 次。`; tour = null; refresh(); }];
  const fn = steps[tour.phase++]; if (fn) { tour.started = state.elapsed; fn(); } else tour = null;
}
function frame(now) {
  const elapsed = Math.max(0, (now - lastFrame) / 1000); lastFrame = now;
  if (!hidden && !$('guide').open) {
    if (elapsed < .25) { fpsSamples.push(elapsed * 1000); if (fpsSamples.length > 180) fpsSamples.shift(); }
    // Bound real elapsed time and subdivide; no background catch-up or collision tunnelling.
    let remaining = Math.min(elapsed, .1); while (remaining > 0) { const dt = Math.min(.025, remaining); step(state, dt); remaining -= dt; }
    tourStep(); renderer.render(now);
    if (now - lastUI > 200) { refresh(); lastUI = now; }
    if (now - lastSave > 5000) { save(); lastSave = now; }
  }
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { hidden = document.hidden; lastFrame = performance.now(); if (hidden) save(); });
window.addEventListener('pagehide', save); refresh(); renderer.render(performance.now()); requestAnimationFrame(frame);
