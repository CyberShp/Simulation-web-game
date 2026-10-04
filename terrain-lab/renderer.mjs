import { depthOrder, heightAt, master, POIS, project, unproject } from './world.mjs?v=terrain-lab-1.0.3';
import { blockedCells } from '../ea-navigation.mjs?v=terrain-lab-1.0.3';
const ink = '#213f36', gold = '#d8be79';
const rand = n => { const v = Math.sin(n * 132.73 + 78.3) * 43875.15; return v - Math.floor(v); };
function polygon(ctx, points, fill, stroke) { ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = .8; ctx.stroke(); } }
function line(ctx, a, b, color, width = 1) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); }
function ellipse(ctx, x, y, rx, ry, color) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
function rectPoints(x, y, w, h, z = 0) { return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([x, y]) => project(x, y, z)); }
function label(ctx, text, x, y, dark = false) {
  ctx.font = '12px system-ui,sans-serif'; const w = ctx.measureText(text).width + 18;
  ctx.fillStyle = dark ? '#25473cec' : '#f4eedcea'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 10, w, 22, 5); ctx.fill(); ctx.fillStyle = dark ? '#f3e9c9' : ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 1);
}
export function drawCharacter(ctx, a, { selected = false, miniature = false } = {}) {
  const style = a.appearance, movement = a.moving ? Math.sin(a.phase) : 0, attack = a.actionTime > 0 ? Math.sin(a.actionTime * 12) * .7 : 0;
  const dir = project(a.facing.x, a.facing.y), back = dir.y < -2, side = dir.x < 0 ? -1 : 1;
  ellipse(ctx, 0, 0, 12, 5, '#163a3340');
  if (selected) { ctx.strokeStyle = gold; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, 0, 15, 6, 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.save(); if (miniature) ctx.scale(1.8, 1.8);
  const body = style.body ? 1.06 : .94; ctx.scale(body, 1);
  line(ctx, { x: -4, y: -7 }, { x: -5 + movement * 3, y: -1 }, '#384a3b', 3.7);
  line(ctx, { x: 4, y: -7 }, { x: 5 - movement * 3, y: -1 }, '#384a3b', 3.7);
  polygon(ctx, [{ x: -5, y: -31 }, { x: 5, y: -31 }, { x: 12 + movement * 1.4, y: -5 }, { x: -12 + movement * 1.4, y: -5 }], style.robe, '#29423670');
  line(ctx, { x: -1, y: -29 }, { x: 4, y: -7 }, style.trim, 2);
  line(ctx, { x: -7, y: -21 }, { x: 7, y: -20 }, style.trim, 2.5);
  line(ctx, { x: -4, y: -28 }, { x: -12 - movement * 2, y: -15 }, style.robe, 7);
  line(ctx, { x: 4, y: -28 }, { x: 13 + movement * 2 + attack * 8, y: -15 - attack * 7 }, style.robe, 7);
  ellipse(ctx, -12 - movement * 2, -14, 2.3, 2.2, '#e4c9a2'); ellipse(ctx, 13 + movement * 2 + attack * 8, -14 - attack * 7, 2.3, 2.2, '#e4c9a2');
  if (back || style.hairstyle > 1) { line(ctx, { x: 0, y: -38 }, { x: side * 5 + movement, y: -20 }, style.hair, 6); }
  ellipse(ctx, 0, -37, 6.2, 7.6, '#e2c29e');
  ctx.beginPath(); ctx.ellipse(0, -40, 7, 6, 0, Math.PI, Math.PI * 2); ctx.lineTo(7, -35); ctx.lineTo(-6, -35); ctx.closePath(); ctx.fillStyle = style.hair; ctx.fill();
  if (back) ellipse(ctx, 0, -37, 6.1, 7.1, style.hair);
  if (style.hairstyle % 2 === 0) { ellipse(ctx, 0, -47, 4, 3.5, style.hair); line(ctx, { x: -5, y: -46 }, { x: 6, y: -46 }, style.trim, 1.7); }
  else { line(ctx, { x: side * 4, y: -42 }, { x: side * 7, y: -29 }, style.hair, 3); line(ctx, { x: -3, y: -43 }, { x: 5, y: -43 }, style.trim, 1.5); }
  if (!back) { ellipse(ctx, side * 2, -37, .8, .65, '#37372f'); line(ctx, { x: 0, y: -33 }, { x: 2, y: -33 }, '#b47d63', .7); }
  const hand = { x: 13 + movement * 2 + attack * 8, y: -15 - attack * 7 };
  if (style.weapon === 'sword') { line(ctx, hand, { x: hand.x + side * (6 + attack * 16), y: hand.y - 23 }, '#d2dcce', 2); line(ctx, { x: hand.x - 4, y: hand.y - 3 }, { x: hand.x + 4, y: hand.y - 3 }, style.trim, 2); }
  if (style.weapon === 'staff') line(ctx, { x: hand.x + 1, y: 1 }, { x: hand.x + 1, y: -37 }, '#8f7856', 2.6);
  if (style.weapon === 'fan') polygon(ctx, [{ x: hand.x, y: hand.y }, { x: hand.x + 9, y: hand.y - 11 }, { x: hand.x - 7, y: hand.y - 12 }], style.trim, '#756e4c');
  ctx.restore();
}
export function portraitURL(a) {
  const canvas = document.createElement('canvas'); canvas.width = 84; canvas.height = 100; const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 84, 100); gradient.addColorStop(0, '#e6e3c9'); gradient.addColorStop(1, '#b9cabc'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 84, 100); ctx.translate(42, 91); drawCharacter(ctx, { ...a, moving: false, actionTime: 0, facing: { x: 1, y: 1 } }, { miniature: true }); return canvas.toDataURL();
}
export function createRenderer(canvas, getState, getOptions) {
  let ctx = canvas.getContext('2d'); const camera = { scale: 1, x: 0, y: 0, zoom: 1, panX: 0, panY: 0 }, metrics = { draws: 0, visibleActors: 0, occluded: 0, order: [] }; let width = 0, height = 0;
  function resize() {
    width = canvas.clientWidth; height = canvas.clientHeight; const dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    camera.scale = Math.min(width / (width < 760 ? 880 : 1450), height / (width < 760 ? 650 : 820)) * camera.zoom;
    camera.x = width / 2 - 80 * camera.scale + camera.panX; camera.y = height / 2 - 350 * camera.scale + camera.panY;
  }
  const ground = document.createElement('canvas'); ground.width = 1900; ground.height = 1250; let groundKey = '';
  function terrainBase(s, options) {
    const occupied = options.collision ? blockedCells(s.map) : null;
    for (let diagonal = 0; diagonal < s.map.width + s.map.height; diagonal++) for (let y = 0; y < s.map.height; y++) {
      const x = diagonal - y, t = s.map.tiles[y]?.[x]; if (!t) continue;
      const corners = rectPoints(x, y, 1, 1, t.height), noise = rand(x * 33 + y);
      if (t.kind === 'cliff') { polygon(ctx, corners, '#76907c'); const lower = corners.map(p => ({ x: p.x, y: p.y + 30 })); polygon(ctx, [corners[1], corners[2], lower[2], lower[1]], '#607965'); polygon(ctx, [corners[2], corners[3], lower[3], lower[2]], '#4d685a'); continue; }
      let color = t.kind === 'water' ? `hsl(169 27% ${40 + noise * 6}%)` : t.kind === 'bridge' ? '#b9b69b' : ['road', 'stairs'].includes(t.kind) ? `hsl(43 20% ${66 + noise * 5}%)` : `hsl(84 26% ${49 + noise * 6}%)`;
      polygon(ctx, corners, color);
      const p = project(x + .5, y + .5, t.height);
      if (t.kind === 'water') { line(ctx, { x: p.x - 12, y: p.y + Math.sin(x + y) * 2 }, { x: p.x + 9, y: p.y }, '#aad4c28c', 1); }
      if (['bridge', 'road', 'stairs'].includes(t.kind)) { line(ctx, corners[0], corners[1], '#8a897450'); line(ctx, corners[0], corners[3], '#eee3c455'); }
      if (t.kind === 'grass' && noise > .4) { for (let i = 0; i < 3; i++) { const xx = p.x + (rand(x * 82 + y * 3 + i) - .5) * 30; line(ctx, { x: xx, y: p.y + 3 }, { x: xx + 2, y: p.y - 2 }, '#547b4770'); } }
      if (occupied && (!t.walkable || occupied.has(`${x},${y}`))) polygon(ctx, corners, '#b460534b', '#ce9380');
      else if (options.collision && t.walkable) polygon(ctx, corners, '#72ad9140', '#a9cdae55');
    }
    // Plant beds are ground decoration; their working paths remain walkable.
    for (let x = 19; x < 26; x++) for (let y = 8; y < 11; y++) {
      if (x === 21 || x === 22 || x === 25 && y === 10) continue; const p = project(x + .5, y + .5, .8);
      polygon(ctx, rectPoints(x + .08, y + .1, .84, .8, .8), '#8d8560', '#c3b392');
      for (let i = 0; i < 4; i++) { const xx = p.x + (i - 1.5) * 7; line(ctx, { x: xx, y: p.y + 2 }, { x: xx, y: p.y - 8 }, '#3b6950', 1.5); ellipse(ctx, xx - 2, p.y - 6, 3, 2, '#80aa6c'); ellipse(ctx, xx + 2, p.y - 9, 3, 2, '#b9cba1'); }
    }
    polygon(ctx, rectPoints(19, 18, 8, 5, .8), '#a5aa8a', '#c7c5a1');
    const arena = project(23, 20.4, .8); ctx.strokeStyle = '#c4b482'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(arena.x, arena.y, 58, 28, 0, 0, Math.PI * 2); ctx.stroke();
  }
  function terrain(s, options) {
    const key = `${s.map.revision}:${options.collision}`;
    if (groundKey !== key) {
      const live = ctx; ctx = ground.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ground.width, ground.height); ctx.translate(850, 210); terrainBase(s, options); ctx = live; groundKey = key;
    }
    ctx.drawImage(ground, -850, -210);
    if (options.paths) for (const a of s.actors) {
      if (!a.path.length) continue; ctx.beginPath(); const p = project(a.x, a.y, heightAt(s.map, a.x, a.y)); ctx.moveTo(p.x, p.y);
      for (const n of a.path) { const q = project(n.x, n.y, heightAt(s.map, n.x, n.y)); ctx.lineTo(q.x, q.y); }
      ctx.strokeStyle = a.id === 'master' ? '#ffe3a7' : '#a0d1d4'; ctx.lineWidth = a.id === 'master' ? 2.5 : 1.4; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
    }
    if (s.targetMarker && master(s).path.length) { const p = project(s.targetMarker.x, s.targetMarker.y, heightAt(s.map, s.targetMarker.x, s.targetMarker.y)); ctx.strokeStyle = gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x, p.y, 10, 5, 0, 0, Math.PI * 2); ctx.stroke(); }
  }
  function building(b, s, selected) {
    const z = heightAt(s.map, b.x, b.y), points = rectPoints(b.x, b.y, b.w, b.h, z), lift = 46, upper = points.map(p => ({ x: p.x, y: p.y - lift }));
    if (selected) polygon(ctx, points, '#f3d98c4b', '#f8dc92');
    polygon(ctx, [points[1], points[2], upper[2], upper[1]], '#c8c2a3', '#716c52'); polygon(ctx, [points[2], points[3], upper[3], upper[2]], '#ddd2b0', '#847d60');
    for (let i = 0; i <= b.w; i++) { const p = project(b.x + i, b.y + b.h, z); line(ctx, p, { x: p.x, y: p.y - lift }, '#897755', 2.3); }
    for (let i = 0; i <= b.h; i++) { const p = project(b.x + b.w, b.y + i, z); line(ctx, p, { x: p.x, y: p.y - lift }, '#8b7855', 2.3); }
    const door = project(b.x + b.w * .57, b.y + b.h, z); polygon(ctx, [{ x: door.x - 9, y: door.y - 28 }, { x: door.x + 9, y: door.y - 19 }, { x: door.x + 9, y: door.y }, { x: door.x - 9, y: door.y - 8 }], '#3f5544', '#98774d');
    for (let i = 1; i < b.w; i++) { const p = project(b.x + i, b.y + b.h, z); if (Math.abs(p.x - door.x) < 13) continue; polygon(ctx, [{ x: p.x - 7, y: p.y - 31 }, { x: p.x + 5, y: p.y - 24 }, { x: p.x + 5, y: p.y - 14 }, { x: p.x - 7, y: p.y - 21 }], '#f4d792', '#a18b5a'); }
    const roof = rectPoints(b.x - .28, b.y - .28, b.w + .56, b.h + .56, z).map(p => ({ x: p.x, y: p.y - lift - 5 })), ridgeA = project(b.x + b.w / 2, b.y - .15, z), ridgeB = project(b.x + b.w / 2, b.y + b.h + .15, z); ridgeA.y -= lift + 31; ridgeB.y -= lift + 31;
    polygon(ctx, [roof[0], ridgeA, ridgeB, roof[3]], b.kind === 'workshop' ? '#566b60' : '#42746b', '#284d43'); polygon(ctx, [ridgeA, roof[1], roof[2], ridgeB], '#36594d', '#264838');
    for (let i = 0; i < 14; i++) { const t = i / 14; line(ctx, { x: roof[0].x + (ridgeA.x - roof[0].x) * t, y: roof[0].y + (ridgeA.y - roof[0].y) * t }, { x: roof[3].x + (ridgeB.x - roof[3].x) * t, y: roof[3].y + (ridgeB.y - roof[3].y) * t }, '#83a79988', .7); }
    line(ctx, ridgeA, ridgeB, '#c6b781', 3); line(ctx, roof[3], roof[2], '#d1c28f', 3);
    label(ctx, b.name, door.x, door.y - 48, true);
    if (b.kind === 'clinic') { const p = project(b.x + b.w, b.y + b.h, z); line(ctx, { x: p.x + 8, y: p.y - 16 }, { x: p.x + 8, y: p.y - 43 }, gold, 2); line(ctx, { x: p.x + 2, y: p.y - 33 }, { x: p.x + 14, y: p.y - 33 }, gold, 2); }
  }
  function obstacle(o, s) {
    const z = heightAt(s.map, o.x, o.y), p = project(o.x + o.w / 2, o.y + o.h / 2, z);
    if (o.kind === 'rail') {
      const a = project(o.x - .1, o.y), b = project(o.x + o.w + .1, o.y); line(ctx, { x: a.x, y: a.y - 17 }, { x: b.x, y: b.y - 17 }, '#dbd3af', 4);
      for (let x = o.x; x <= o.x + o.w; x++) { const p = project(x, o.y); line(ctx, p, { x: p.x, y: p.y - 24 }, '#7d8b78', 4); ellipse(ctx, p.x, p.y - 24, 3.7, 2.7, '#e8e0c3'); }
    } else if (o.kind === 'dummy') {
      line(ctx, p, { x: p.x, y: p.y - 42 }, '#816c48', 8); line(ctx, { x: p.x - 16, y: p.y - 29 }, { x: p.x + 16, y: p.y - 29 }, '#9f8456', 5); ellipse(ctx, p.x, p.y - 49, 8, 8, '#a69165'); ellipse(ctx, p.x, p.y - 30, 10, 16, '#a69165'); label(ctx, '试炼木人', p.x, p.y + 14, true);
    } else if (o.kind === 'wall') {
      const base = rectPoints(o.x, o.y, o.w, o.h, z), top = base.map(p => ({ x: p.x, y: p.y - 32 })); polygon(ctx, [base[1], base[2], top[2], top[1]], '#8b9d88', '#586e5d'); polygon(ctx, [base[2], base[3], top[3], top[2]], '#b3b7a0', '#788874'); polygon(ctx, top, '#627e70', '#c5c9ad');
      for (let i = 0; i < o.w; i++) { const p = project(o.x + i + .5, o.y + o.h, z); line(ctx, { x: p.x, y: p.y - 8 }, { x: p.x, y: p.y - 29 }, '#8c9c86', 1); }
    } else if (o.kind === 'rock') { polygon(ctx, [{ x: p.x - 25, y: p.y }, { x: p.x - 18, y: p.y - 22 }, { x: p.x + 10, y: p.y - 30 }, { x: p.x + 30, y: p.y - 6 }, { x: p.x + 7, y: p.y + 7 }], '#7b8c7a', '#c2c8ad'); }
    else {
      ellipse(ctx, p.x, p.y, 28, 12, '#24463825'); line(ctx, p, { x: p.x - 3, y: p.y - 57 }, '#77744f', 6); line(ctx, { x: p.x, y: p.y - 30 }, { x: p.x + 19, y: p.y - 51 }, '#77744f', 3);
      for (const [dx, dy, r] of [[-22, -62, 27], [22, -65, 28], [0, -89, 30], [-5, -65, 33]]) { const g = ctx.createRadialGradient(p.x + dx - 8, p.y + dy - 9, 0, p.x + dx, p.y + dy, r); g.addColorStop(0, '#9fb079'); g.addColorStop(.6, '#58845b'); g.addColorStop(1, '#326347'); ellipse(ctx, p.x + dx, p.y + dy, r, r * .65, g); }
    }
  }
  function render(now) {
    if (!width || !height) resize(); const s = getState(), options = getOptions(), dpr = canvas.width / width;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    const sky = ctx.createLinearGradient(0, 0, 0, height); sky.addColorStop(0, '#b8c9bc'); sky.addColorStop(1, '#e6dfc4'); ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
    for (let layer = 0; layer < 3; layer++) { ctx.beginPath(); ctx.moveTo(0, height); for (let i = 0; i <= 18; i++) ctx.lineTo(i * width / 18, height * (.2 + layer * .18) + Math.sin(i * 1.1 + layer) * height * .08); ctx.lineTo(width, height); ctx.closePath(); ctx.fillStyle = ['#77998937', '#6c958344', '#76917728'][layer]; ctx.fill(); }
    if (width < 760 && master(s).moving) { const a = master(s), p = project(a.x, a.y, heightAt(s.map, a.x, a.y)); camera.x += (width * .48 - (p.x * camera.scale + camera.x)) * .08; camera.y += (height * .47 - (p.y * camera.scale + camera.y)) * .08; camera.panX = camera.x - width / 2 + 80 * camera.scale; camera.panY = camera.y - height / 2 + 350 * camera.scale; }
    ctx.save(); ctx.translate(camera.x, camera.y); ctx.scale(camera.scale, camera.scale); terrain(s, options);
    if (s.strike) { const p = project(s.strike.x, s.strike.y, heightAt(s.map, s.strike.x, s.strike.y)); ctx.fillStyle = '#bc59454f'; ctx.strokeStyle = '#cf654e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x, p.y, 47, 24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); label(ctx, `落点 ${Math.max(0, s.strike.remaining).toFixed(1)}秒`, p.x, p.y - 25, true); }
    const ordered = depthOrder(s); metrics.order = ordered.map(e => e.item.id); metrics.visibleActors = 0; metrics.occluded = 0;
    for (const e of ordered) {
      if (e.type === 'building') building(e.item, s, options.relocate);
      else if (e.type === 'actor') {
        const a = e.item, p = project(a.x, a.y, heightAt(s.map, a.x, a.y)); ctx.save(); ctx.translate(p.x, p.y); drawCharacter(ctx, a, { selected: a.id === 'master' }); ctx.restore(); metrics.visibleActors++;
      } else obstacle(e.item, s);
    }
    // Labels are separate overlays; silhouettes appear only when requested for inspection.
    for (const a of s.actors) {
      const p = project(a.x, a.y, heightAt(s.map, a.x, a.y)), occluded = ordered.slice(ordered.findIndex(e => e.item === a) + 1).some(e => {
        if (e.type === 'actor') return false; const o = e.item, center = project(o.x + o.w / 2, o.y + o.h / 2, heightAt(s.map, o.x, o.y)); return Math.abs(center.x - p.x) < (o.kind === 'tree' ? 48 : (o.w + o.h) * 17) && p.y < center.y && p.y > center.y - (o.kind === 'tree' ? 110 : 75);
      });
      if (occluded) metrics.occluded++;
      if (options.silhouette && occluded) { ellipse(ctx, p.x, p.y - 24, 6, 18, '#e3cf8290'); }
      if (a.id === 'master' || s.party.includes(a.id)) label(ctx, a.name, p.x, p.y + 15, a.id === 'master');
    }
    for (const p of POIS.filter(p => p.id === 'bridge' || p.id === 'garden' || p.id === 'arena')) { const q = project(p.x, p.y, heightAt(s.map, p.x, p.y)); label(ctx, p.name, q.x, q.y + 35); }
    ctx.restore(); metrics.draws++; return metrics;
  }
  function worldPoint(event) {
    const rect = canvas.getBoundingClientRect(), px = (event.clientX - rect.left - camera.x) / camera.scale, py = (event.clientY - rect.top - camera.y) / camera.scale;
    // Solve against each walkable height layer; the elevated plateau cannot use the lowland inverse.
    for (const z of [.8, .4, 0]) { const p = unproject(px, py, z); if (Math.abs(heightAt(getState().map, p.x, p.y) - z) < .01) return p; }
    return unproject(px, py);
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
  return { render, metrics, worldPoint, camera, resize, zoom(delta) { camera.zoom = Math.max(.7, Math.min(1.8, camera.zoom + delta)); resize(); }, recenter() { camera.panX = camera.panY = 0; camera.zoom = 1; resize(); }, focus() { const a = master(getState()), p = project(a.x, a.y, heightAt(getState().map, a.x, a.y)); camera.panX += width * .48 - (p.x * camera.scale + camera.x); camera.panY += height * .47 - (p.y * camera.scale + camera.y); resize(); }, destroy() { observer.disconnect(); } };
}
