import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const root = fileURLToPath(new URL('../../apps/courtyard/', import.meta.url));

test('development DOM preserves explicit policy save, personal refusal and disclosed contact boundaries', { timeout: 30000 }, async () => {
  const server = http.createServer(async (request, response) => {
    try {
      const file = path.resolve(root, '.' + new URL(request.url, 'http://localhost').pathname);
      if (!file.startsWith(root)) throw Error('outside root');
      response.setHeader('Content-Type', 'text/javascript'); response.end(await fs.readFile(file));
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
    const page = await browser.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/courtyard-development-panel.mjs`);
    const result = await page.evaluate(async () => {
      const { renderDiscipleDevelopment } = await import('/courtyard-development-panel.mjs');
      const { createCourtyardPersonDialogue } = await import('/courtyard-person-dialogue.mjs');
      document.body.replaceChildren();
      const holder = document.createElement('div'); document.body.append(holder);
      const calls = [], member = { personId: 'person:test', name: '试验门人', goal: '精研医理', activityLabel: '做工', reason: '先完成照料药田的承诺。', contact: { available: true },
        learning: { id: 'qingwind', name: '清风诀', progress: 2, total: 10, practice: 1 }, knowledge: [{ techniqueId: 'qingwind', name: '清风诀', value: 2 }], skills: [{ id: 'medicine', label: '医理', value: 3 }],
        options: [{ techniqueId: 'qingwind', name: '清风诀', available: true, willing: false, reason: '此法与我眼下志向不合。' }] };
      member.hiddenKnowledge = { secret: '未知功法真相' }; member.hiddenMotive = '未知私下动机';
      const data = { workFocus: { value: 'balanced', label: '均衡', options: [{ id: 'balanced', label: '均衡' }, { id: 'herb', label: '灵草' }] }, members: [member] };
      let draft = null;
      const render = () => { holder.replaceChildren(); renderDiscipleDevelopment(holder, { data, value: draft, change: value => { draft = value; }, save: value => calls.push({ type: 'disciple-work-focus', value }), openPerson: id => calls.push(id) }); };
      render(); let select = holder.querySelector('select'); select.value = 'herb'; select.onchange();
      if (calls.length) throw Error('changing selection submitted policy');
      render(); if (holder.querySelector('select').value !== 'herb') throw Error('draft lost on render');
      holder.querySelector('[data-ui-key="development:save-focus"]').click();
      if (calls[0]?.value !== 'herb') throw Error('save lost selected value');
      data.workFocus = { ...data.workFocus, value: 'herb', label: '灵草' }; draft = null; render();
      if (!holder.textContent.includes('当前已保存：灵草')) throw Error('saved projection missing');
      for (const id of ['person-content', 'person-reading', 'person-name', 'person-role', 'person-eyebrow', 'person-speech', 'person-detail', 'focus-person', 'approach-person', 'portrait']) {
        const element = document.createElement('div'); element.id = id; document.body.append(element);
      }
      const person = { id: member.personId, name: member.name, energy: 90, wound: 0, admission: { membership: { rankLabel: '外门', affiliationLabel: '本院' }, distance: { near: true } } };
      const view = { people: [person], discipleDevelopment: data }, known = { people: [{ id: person.id, detail: '照料药田。', location: { label: '本院' } }] };
      const commands = [], announcements = [];
      const ui = createCourtyardPersonDialogue({ getView: () => view, inspect: () => known, command: request => {
        commands.push(request); member.recommendation = { name: '清风诀', status: 'refused', accepted: false, publicReason: '此法与我眼下志向不合。' };
        return { ok: false, refused: true, error: '此法与我眼下志向不合。' };
      }, drawPortrait() {}, announce: text => announcements.push(text) });
      ui.open(person.id);
      const content = document.getElementById('person-content');
      if (content.textContent.includes('未知功法真相') || content.textContent.includes('未知私下动机')) throw Error('raw private data exposed');
      if (!content.textContent.includes('2 / 10') || !content.textContent.includes('医理')) throw Error('learning and skill missing');
      content.querySelector('[data-ui-key="person:recommend:qingwind"]').click();
      if (commands[0]?.type !== 'recommend-disciple-technique' || commands[0]?.personId !== person.id) throw Error('wrong recommendation command');
      if (!content.querySelector('[role="status"]')?.textContent.includes('志向不合')) throw Error('refusal feedback missing');
      ui.close(); ui.open(person.id);
      if (!content.textContent.includes('上次商议 · 清风诀：此法与我眼下志向不合。')) throw Error('persisted refusal projection missing');
      member.activityLabel = '研习'; member.activityStatus = 'waiting'; member.physicalReason = '正在等候阅卷工位。';
      ui.render();
      if (!content.textContent.includes('等候 · 研习') || !content.textContent.includes('当前状态：正在等候阅卷工位。') || !content.textContent.includes('本人打算：先完成照料药田的承诺。')) throw Error('physical wait and intent were conflated');
      member.activityStatus = 'moving'; member.physicalReason = '正在前往藏经阁。';
      ui.render();
      if (!content.textContent.includes('前往 · 研习') || !content.textContent.includes('当前状态：正在前往藏经阁。')) throw Error('moving state not visible');
      render();
      if (!holder.textContent.includes('前往 · 研习') || !holder.textContent.includes('当前状态：正在前往藏经阁。')) throw Error('affairs physical state not visible');
      member.learning = { id: 'qingwind', name: '清风诀', progress: 5, practice: true };
      ui.render();
      if (!content.textContent.includes('本轮研考5 / 40') || content.textContent.includes('运用积累')) throw Error('practice boolean rendered as a numeric skill');
      delete member.activityStatus; delete member.physicalReason;
      member.activityLabel = '待当面了解';
      member.contact = { available: false, reason: '已报备外出，待归院后再谈。' };
      member.learning.name = '不应远程显示的当前研习'; member.options.push({ techniqueId: 'hidden', name: '不应远程显示的法门', available: true });
      ui.render();
      if (content.querySelector('[data-ui-key^="person:recommend:"]') || content.textContent.includes('不应远程显示')) throw Error('away member exposed current learning or remote controls');
      if (!content.textContent.includes('待归院后再谈')) throw Error('away disclosure missing');
      return { calls, commands, announcements };
    });
    assert.equal(result.calls[0].value, 'herb'); assert.equal(result.commands.length, 1); assert.equal(result.announcements.length, 1); assert.deepEqual(errors, []);
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});
