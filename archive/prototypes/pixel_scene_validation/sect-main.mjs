import { createSectSession, commandSect, advanceSect, snapshotSect, restoreSect, viewSect } from '../../../apps/courtyard/sect-sim.mjs';
import { SectRenderer } from './sect-renderer.mjs';

const $ = id => document.getElementById(id);
const canvas = $('scene'), renderer = new SectRenderer(canvas);
const host = window.sectHost;
const errors = [], samples = [];
let session = createSectSession(), view = viewSect(session), started = false, restored = null;
let modal = null, manualPause = false, suspended = false, closing = false, saving = false;
let selectedPerson = null, lastPump = performance.now(), lastView = 0, lastFrame = performance.now();
let runSeconds = 0, backgroundSeconds = 0, lastSaveTime = 0, saveMessage = '尚未开始';
let activity = { active: true, visible: true, minimized: false }, noticeUntil = 0, resetArmed = false;
let lastDigest = '', frameCount = 0, frameStart = performance.now();
const activityNames = { rest:'休整', groundRest:'歇脚', cultivate:'修炼', plant:'照料灵草', harvest:'采集', transport:'搬运', move:'行走', heal:'疗伤', break:'突破', learn:'研习' };
const amount = n => Number(n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 1 });
const text = (id, value) => { $(id).textContent = value; };
function notice(message) { text('notice', message); $('notice').classList.add('show'); noticeUntil = performance.now() + 4500; }
function fail(error) { const message = error?.message || String(error); errors.push({ message, tick:session.state.worldTick }); notice(message); }
addEventListener('error', event => fail(event.error || event.message));
addEventListener('unhandledrejection', event => fail(event.reason));
function refresh() { view = viewSect(session); drawUI(); return view; }
function issue(request) {
  const result = commandSect(session, request);
  if (!result.ok) notice(result.error || '当前无法进行这项行动。');
  refresh();
  return result;
}
function syncPause() {
  const paused = manualPause || !!modal || !started || suspended || closing;
  if ((session.state.speed === 0) !== paused) issue({ type:'pause', paused });
  lastPump = performance.now();
}
function openModal(id) {
  if (!started) return;
  if (modal) $(modal).hidden = true;
  modal = id; $(id).hidden = false; syncPause();
}
function closeModal(id = modal) {
  if (!id) return;
  $(id).hidden = true;
  if (modal === id) modal = null;
  syncPause();
}
function openPolicy() {
  $('herb-target').value = session.policy.herbTarget;
  $('herb-target').max = '500';
  $('spending-cap').value = session.policy.spendingCap;
  document.querySelector('input[name="risk"][value="' + session.policy.risk + '"]').checked = true;
  text('budget-copy', '已用于自主整备 ' + amount(session.budget.spent) + ' 灵石。额度按本院务存档累计；日常口粮、生产和人物成长耗用另记。');
  openModal('policy-modal');
}
function row(parent, content, className = '') { const node = document.createElement('p'); node.className = className; node.textContent = content; parent.append(node); return node; }
function openPerson(person) {
  selectedPerson = person.id;
  text('person-name', person.name);
  text('person-role', person.id === 'person:master' ? '云岫掌门' : person.resident ? '院中同伴' : '山院来客');
  $('person-conversation').replaceChildren();
  row($('person-conversation'), person.name + ' · ' + (person.indoor ? '屋内' : '院中') + (activityNames[person.activity] || '料理事务'), 'speech');
  row($('person-conversation'), person.activityDetail?.reason || person.reason || '正在院中停留。', 'speech');
  row($('person-conversation'), '精力 ' + amount(person.energy) + ' · 伤势 ' + amount(person.wound), 'observation');
  renderer.drawPortrait($('portrait'), person);
  openModal('person-modal');
}
function eventList(id, events) {
  const list = $(id); list.replaceChildren();
  for (const event of events) {
    const li = document.createElement('li');
    const time = document.createElement('time'); time.textContent = '+' + amount((event.tick - session.baseline.tick) / 10) + ' 秒';
    const content = document.createElement('span'); content.textContent = event.text;
    li.append(time, content); list.append(li);
  }
}
function showJournal() {
  const summary = $('account-summary'); summary.replaceChildren();
  const initial = view.baseline.publicResources;
  row(summary, '公库灵草 ' + amount(initial.herb) + ' → ' + amount(view.resources.herb) + ' 份；田边尚有 ' + amount(view.crop?.herbOnSite) + ' 份。');
  row(summary, '公库灵石 ' + amount(initial.jade) + ' → ' + amount(view.resources.jade) + '；其中自主整备 ' + amount(view.budget.spent) + '，药田工资 ' + amount(view.economy.productionWages) + '。');
  row(summary, '口粮 ' + amount(initial.food) + ' → ' + amount(view.resources.food) + '。人物日常与成长按各自实际活动耗用。');
  eventList('journal-events', [...view.ledger].reverse());
  openModal('journal-modal');
}
function currentSite() { return view.domain?.sites?.find(s=>s.id==='site:domain:east-residence-1'); }
function cargoFrom(resources = {}) {
  let remaining=40;
  return Object.fromEntries(['wood','stone','herb','food'].map(key=>{
    const value=Math.min(remaining,resources[key]||0);remaining-=value;return [key,value];
  }).filter(([,value])=>value>0));
}
function carriedCargo() {return cargoFrom(view.stockpiles.find(s=>s.id==='stockpile:carried:master')?.resources);}
function pendingDrop() {
  const master=view.people.find(p=>p.id==='person:master');
  const distance=s=>Math.hypot(s.position.x-master.x,s.position.y-master.y);
  return view.stockpiles.filter(s=>s.id.startsWith('stockpile:dropped:')&&s.position&&Object.keys(cargoFrom(s.resources)).length)
    .sort((a,b)=>distance(a)-distance(b))[0];
}
function openBuilding() {
  const site=currentSite();
  if(!site) return notice('东台布局尚未就绪。');
  text('site-status',site.status==='complete'?'门人居已落成，可查看实际容量与人物活动。':site.status==='building'?(view.construction?.reason||'按现场进度施工。'):site.reason||'东路连着旧院，台地上预留一处新居。');
  $('site-materials').replaceChildren();
  const names={jade:'灵石',wood:'木材',stone:'石材'};
  for(const [key,cost] of Object.entries(site.cost||{})) row($('site-materials'),names[key]+'  '+amount(view.resources[key])+' / '+amount(cost),view.resources[key]<cost?'warning':'');
  const cargo=carriedCargo(), labels={wood:'木材',stone:'石材',herb:'灵草',food:'口粮'};
  text('site-carried',Object.keys(cargo).length?'掌门随身：'+Object.entries(cargo).map(([key,n])=>labels[key]+' '+amount(n)).join('，'):'掌门随身暂无待交物资。');
  $('deliver-materials').disabled=!Object.keys(cargo).length;
  const drop=pendingDrop();
  $('recover-materials').hidden=!drop;
  if(drop)text('recover-materials','把路边物资运回：'+Object.entries(cargoFrom(drop.resources)).map(([key,n])=>labels[key]+' '+amount(n)).join('，'));
  $('domain-enable').hidden=view.domain.enabled;
  $('site-build').disabled=site.status!=='available'||Object.entries(site.cost||{}).some(([key,n])=>(view.resources[key]||0)<n);
  text('site-build',site.status==='complete'?'已落成':site.status==='building'?'营造中 '+Math.floor(site.progress*100)+'%':'营造门人居');
  openModal('building-modal');
}
function drawUI() {
  text('day', view.timeLabel);
  text('world-status', view.paused ? '静观' : '院务运行中');
  text('pause', manualPause ? '继续' : '暂停');
  $('pause-note').hidden = !started || !view.paused || !!modal;
  text('goal-progress', amount(view.resources.herb) + ' / ' + amount(view.policy.herbTarget) + ' 份');
  $('goal-fill').style.width = Math.min(100, view.policy.herbTarget ? view.resources.herb / view.policy.herbTarget * 100 : 100) + '%';
  text('goal-title', view.targetMet ? '灵草已备足' : '灵草常备');
  text('decision-reason', view.reason);
  text('control-toggle', view.control.mode === 'auto' ? '接管掌门' : '交回自主');
  text('control-note', view.control.mode === 'auto' ? '按方略安排院务，可随时接管' : Math.max(0, Math.ceil((30000 - view.control.idleMs) / 1000)) + ' 秒未下达行动后转入自主');
  const master = view.people.find(p => p.id === 'person:master');
  text('activity-mode', view.control.mode === 'auto' ? '掌门自主' : '掌门亲控');
  text('activity-text', master?.activityDetail?.reason || master?.reason || '院中停留');
  text('save-state', saveMessage);
  const resourceDigest = JSON.stringify(view.resources);
  if (resourceDigest !== $('resources').dataset.value) {
    $('resources').dataset.value = resourceDigest;
    $('resources').replaceChildren();
    for (const [key, label] of [['herb','灵草'],['food','口粮'],['jade','灵石'],['wood','木材'],['stone','石材']]) {
      const entry = document.createElement('div'), name = document.createElement('span'), value = document.createElement('strong');
      entry.className = 'resource';
      name.textContent = label; value.textContent = amount(view.resources[key]); entry.append(name,value); $('resources').append(entry);
    }
  }
  text('supplies-note', view.resources.food <= 12 ? '口粮余 ' + amount(view.resources.food) + '，仍在按日耗用；留意后续补给。' : '田边灵草 ' + amount(view.crop?.herbOnSite) + ' · 整备余度 ' + amount(view.budget.remaining));
  const digest = JSON.stringify(view.people.filter(p => p.resident).map(p => [p.id,p.activity,p.indoor,Math.round(p.energy)]));
  if (digest !== lastDigest) {
    lastDigest = digest; $('residents').replaceChildren();
    for (const person of view.people.filter(p => p.resident)) {
      const button = document.createElement('button'); button.className = 'resident panel';
      const name = document.createElement('strong'), status = document.createElement('span');
      name.textContent = person.name; status.textContent = (person.indoor ? '屋内 · ' : '') + (activityNames[person.activity] || '料理事务') + ' · 精力 ' + Math.round(person.energy);
      button.append(name,status); button.onclick = () => openPerson(view.people.find(p => p.id === person.id)); $('residents').append(button);
    }
  }
  const events = view.ledger.filter(e => e.kind !== 'waiting').slice(-3).reverse();
  if ($('recent-events').dataset.last !== String(events[0]?.id)) {
    $('recent-events').dataset.last = String(events[0]?.id); eventList('recent-events', events);
  }
}
async function save(reason = '手动') {
  if (!started) return { ok:false, error:'尚未入院。' };
  if (!host) return { ok:false, error:'请从桌面应用保存院务。' };
  if (saving) return { ok:false, busy:true };
  saving = true; saveMessage = '正在保存'; drawUI();
  try {
    // Reading panels are presentation pauses. Persist the explicit player pause.
    const data = snapshotSect(session);
    data.state.speed = manualPause ? 0 : 1;
    const result = await host.save(data);
    if (!result.ok) throw Error(result.error || '保存失败，院务仍留在当前窗口。');
    lastSaveTime = performance.now(); saveMessage = '已保存';
    if (reason === '手动') notice('院务已保存。');
    return result;
  } catch (error) { saveMessage = '保存未完成'; fail(error); return { ok:false,error:error.message }; }
  finally { saving = false; drawUI(); }
}
function start(mode = 'new') {
  if (mode === 'continue' && restored) {
    session = restoreSect(restored); manualPause = session.state.speed === 0;
  } else {
    session = createSectSession(); manualPause = false; issue({ type:'auto' });
  }
  started = true; $('welcome').hidden = true; lastPump = performance.now(); lastSaveTime = lastPump;
  syncPause(); refresh(); renderer.showCourtyard?.();
  return snapshotSect(session);
}
function pump() {
  const now = performance.now(), elapsed = Math.max(0, (now - lastPump) / 1000); lastPump = now;
  if (started && !suspended && !closing && !view.paused) {
    const before = performance.now();
    try { advanceSect(session, elapsed); }
    catch (error) { manualPause = true; syncPause(); fail(error); return; }
    runSeconds += elapsed;
    if (!activity.active || activity.minimized || !activity.visible) backgroundSeconds += elapsed;
    samples.push(performance.now() - before); if (samples.length > 2400) samples.shift();
  }
  if (now - lastView > 250) { view = viewSect(session); drawUI(); lastView = now; }
  if (started && !closing && now - lastSaveTime > 15000 && !saving) void save('自动');
  if (noticeUntil && now > noticeUntil) { $('notice').classList.remove('show'); noticeUntil = 0; }
}
function frame(now) {
  renderer.draw(view, Math.min(.1, Math.max(0,(now-lastFrame)/1000)));
  lastFrame = now; frameCount++; requestAnimationFrame(frame);
}
function metrics() {
  const sorted = [...samples].sort((a,b) => a-b);
  return { runtimeSeconds:runSeconds, backgroundSeconds, tick:session.state.worldTick,
    sourceTick:session.baseline.tick, control:session.control, policy:session.policy,
    resources:view.resources, budget:view.budget, targetMet:view.targetMet,
    errors:[...errors], simulationPumpP95Ms:sorted[Math.floor(sorted.length*.95)] || 0,
    foregroundRenderedFrames:frameCount, observedWallSeconds:(performance.now()-frameStart)/1000,
    activity:{...activity}, suspended, paused:view.paused, source:session.provenance.id };
}
$('start').onclick = () => {
  if (restored && !resetArmed) { resetArmed = true; text('start','确认从初成小院重新开始'); notice('继续上次院务可保留现有进展。再次点击将开始新院务。'); return; }
  start('new');
};
$('continue').onclick = () => start('continue');
$('overview').onclick = () => renderer.showOverview();
$('courtyard').onclick = () => renderer.showCourtyard?.();
$('follow').onclick = () => renderer.followPerson('person:master');
$('building-open').onclick = openBuilding;
$('pause').onclick = () => { if (!started || modal) return; manualPause = !manualPause; syncPause(); refresh(); };
$('save').onclick = () => void save();
$('policy-open').onclick = openPolicy;
$('journal-open').onclick = showJournal;
$('control-toggle').onclick = () => { if (started) issue({ type:view.control.mode === 'auto' ? 'manual' : 'auto' }); };
$('rest').onclick = () => { if (started) issue({type:'rest'}); };
$('cultivate').onclick = () => { if (started) issue({type:'cultivate'}); };
$('person-focus').onclick = () => { renderer.followPerson(selectedPerson); closeModal(); };
$('gather-wood').onclick = () => {
  if(issue({type:'harvest',resource:'wood'}).ok){closeModal();renderer.followPerson('person:master');}
};
$('deliver-materials').onclick = () => {
  if(issue({type:'transport',sourceStockpileId:'stockpile:carried:master',targetStockpileId:'stockpile:yunxiu',cargo:carriedCargo()}).ok){closeModal();renderer.followPerson('person:master');}
};
$('recover-materials').onclick = () => {
  const drop=pendingDrop();
  if(drop&&issue({type:'transport',sourceStockpileId:drop.id,targetStockpileId:'stockpile:yunxiu',cargo:cargoFrom(drop.resources)}).ok){closeModal();renderer.followPerson('person:master');}
};
$('site-build').onclick = () => {
  const site=currentSite();if(site&&issue({type:'build-site',siteId:site.id}).ok){closeModal();renderer.followPerson('person:master');}
};
$('site-focus').onclick = () => {const site=currentSite();if(site){renderer.followPoint?.(site.x+site.width/2,site.y+site.height);closeModal();}};
$('domain-enable').onclick = () => {if(issue({type:'enable-domain'}).ok)openBuilding();};
for (const button of document.querySelectorAll('[data-close]')) button.onclick = () => closeModal(button.dataset.close);
$('policy-form').onsubmit = event => {
  event.preventDefault();
  const fields = new FormData(event.currentTarget);
  const result = issue({type:'policy', policy:{herbTarget:Number(fields.get('herbTarget')),spendingCap:Number(fields.get('spendingCap')),risk:fields.get('risk')}});
  if (result.ok) { closeModal(); notice('方略已采用。'); }
};
let drag = null;
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('pointerdown', event => {
  if (!started || modal) return;
  if (event.button === 2) { drag = {x:event.clientX,y:event.clientY}; canvas.setPointerCapture(event.pointerId); return; }
  if (event.button !== 0) return;
  if (renderer.mode === 'planning') { notice('山域图显示地域规划。点击“回小院”或“寻掌门”进入近景。'); return; }
  const box = canvas.getBoundingClientRect(), x = event.clientX-box.left, y=event.clientY-box.top;
  const person = renderer.pickPerson(x,y);
  if (person) return openPerson(person);
  const world = renderer.screenToWorld(x,y);
  issue({type:'move',x:world.x,y:world.y});
});
canvas.addEventListener('pointermove', event => { if (drag) { renderer.panBy(event.clientX-drag.x,event.clientY-drag.y); drag={x:event.clientX,y:event.clientY}; } });
canvas.addEventListener('pointerup', () => { drag=null; });
canvas.addEventListener('wheel', event => {
  event.preventDefault(); if (!started || modal) return;
  const box=canvas.getBoundingClientRect(); renderer.zoomAt(event.deltaY<0?1.1:1/1.1,event.clientX-box.left,event.clientY-box.top);
},{passive:false});
addEventListener('keydown',event => {
  if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if (event.key==='Escape' && modal) { closeModal(); return; }
  if (event.code==='Space') { event.preventDefault(); $('pause').click(); }
});
addEventListener('resize', () => renderer.resize());
try {
  const settings = host ? await host.settings() : {qa:false};
  suspended = !!settings.suspended;
  if (host) {
    host.onActivity(value => { activity = value; });
    host.onPower(value => { suspended = value.suspended; syncPause(); refresh(); });
    host.onClosing(async () => {
      closing = true; syncPause();
      while(saving) await new Promise(resolve => setTimeout(resolve,50));
      const result = started ? await save('退出') : {ok:true};
      if (result.ok) await host.closeReady();
      else { closing = false; manualPause = true; syncPause(); }
    });
    const loaded = await host.load();
    if (loaded.ok && loaded.found) { restored = restoreSect(loaded.data); $('continue').hidden=false; text('start','另开初成小院'); }
    else if (!loaded.ok) { text('load-warning',loaded.error || '上次院务未能读取。'); $('load-warning').hidden=false; }
  }
  await renderer.load(); renderer.resize(); syncPause(); refresh(); renderer.showOverview();
  $('loading').hidden = true;
  setInterval(pump, 50); requestAnimationFrame(frame);
  if (settings.qa) {
    window.sectQA = { start, issue, save, metrics, snapshot:()=>snapshotSect(session), view:()=>refresh(),
      renderer,canvas, openPolicy,openPerson,showJournal,openBuilding,closeModal,
      setPaused:paused=>{manualPause=paused;syncPause();refresh();},
      activity:()=>({...activity}), restored:()=>restored ? structuredClone(restored) : null };
    if (settings.qaScenario && settings.qaScenario !== 'native') {
      const { runSectQA } = await import('./sect-qa.mjs'); void runSectQA(window.sectQA,settings).catch(fail);
    }
  }
} catch (error) { fail(error); text('loading','入院未完成：'+error.message); }
