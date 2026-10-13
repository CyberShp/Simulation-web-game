import { Effects } from './effects.mjs';
import { WORLD, isWalkable, findPath, moveTowards, createCooldowns, tryCast } from './world.mjs';

const canvas = document.querySelector('#scene');
const ctx = canvas.getContext('2d', { alpha: false });
const host = window.sceneHost;
const options = host ? await host.settings() : { qa: false, record: false, start: 0, duration: 0 };
const errors = [];
window.addEventListener('error', e => errors.push(e.message));
window.addEventListener('unhandledrejection', e => errors.push(String(e.reason)));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const load = src => new Promise((resolve, reject) => {
  const im = new Image(); im.onload = () => resolve(im); im.onerror = () => reject(new Error(`素材加载失败: ${src}`)); im.src = src;
});
const [ground, people, props, disciples] = await Promise.all([
  load('assets/courtyard-v1.png'), load('assets/cultivator-v1.png'), load('assets/garden-props-v1.png'), load('assets/disciples-v1.png')
]);

// Coordinates refer to the authored atlas, including a stable foot anchor.
const frames = [
  [55, 18, 250, 335, 173, 328], [433, 18, 225, 335, 154, 329],
  [803, 18, 237, 335, 157, 330], [1200, 18, 211, 335, 137, 329],
  [76, 360, 281, 300, 125, 293], [444, 360, 288, 300, 133, 294],
  [805, 360, 296, 300, 136, 294], [1212, 360, 279, 300, 130, 294],
  [70, 660, 218, 335, 134, 329], [426, 668, 317, 330, 160, 322],
  [758, 686, 406, 298, 189, 287], [1172, 674, 299, 325, 185, 314]
];
const normalizedSprites = frames.map((f, index) => {
  const [sx, sy, sw, sh, ax, ay] = f;
  const c = document.createElement('canvas'); c.width = 104; c.height = 82;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  // Strides share their body scale. Attack poses retain the same head size.
  const scale = index >= 4 && index <= 7 ? .237 : .217;
  g.drawImage(people, sx, sy, sw, sh, Math.round(52 - ax * scale), Math.round(77 - ay * scale), Math.round(sw * scale), Math.round(sh * scale));
  return c;
});
const discipleRects = [
  [55,42,280,447,151,438],[407,44,270,446,160,436],[784,42,286,449,177,438],[1121,89,414,397,190,383],
  [57,525,274,469,139,449],[410,531,290,458,158,442],[788,531,288,460,161,448],[1140,535,375,462,183,447]
];
const discipleSprites = discipleRects.map(f=>{
  const c=document.createElement('canvas');c.width=104;c.height=82;const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  const [sx,sy,sw,sh,ax,ay]=f,scale=.159;
  g.drawImage(disciples,sx,sy,sw,sh,Math.round(52-ax*scale),Math.round(77-ay*scale),Math.round(sw*scale),Math.round(sh*scale));return c;
});
const garden = [
  { id: 'lantern', x: 510, y: 665, rect: [135, 155, 370, 795], height: 108, width: 50 },
  { id: 'pine', x: 1210, y: 685, rect: [623, 10, 913, 945], height: 155, width: 150 }
];
const effects = new Effects();
const cooldowns = createCooldowns();
const hero = { id: 'master', x: 825, y: 720, dir: 1, back: true, frame: 8, distance: 0, moving: false, action: null, path: [], color: 'blue' };
const crowd = Array.from({ length: 15 }, (_, i) => {
  const side = i % 2;
  const x = i === 12 ? 675 : 420 + (i % 5) * 192 + Math.sin(i*3)*30;
  const y = i === 12 ? 618 : 463 + Math.floor(i / 5) * 103 + Math.sin(i*2.3)*17;
  return { id: `disciple-${i}`, x, y, homeX: x, homeY: y, dir: side ? -1 : 1, back: false, moving: false, distance: i * 7, action: null, color: side ? 'red' : i%4===0 ? 'white' : 'blue', nextCast: 2 + i * .43 };
});
const state = { time: options.start || 0, paused: false, auto: true, manualCamera: false, shot: 0, cycle: 0, phase: '', target: null, toast: '', toastUntil: 0, lastAutoCast: -10 };
const camera = { x: WORLD.width / 2, y: WORLD.height / 2, zoom: 1 };
let viewport = { w: 1600, h: 900, fit: 1 };
const keys = new Set();
const stats = { frames: 0, intervals: [], renderMs: [], casts: { sword: 0, fire: 0, ward: 0 }, releases: { sword: 0, fire: 0, ward: 0 }, rejectedCasts: 0, walkDistance: 0, spriteFrames: new Set(), occlusionSamples: [], captures: [], checks: [] };
let pointer = null;
let recording = null;

function resize() {
  viewport = { w: innerWidth, h: innerHeight, fit: Math.min(innerWidth / WORLD.width, innerHeight / WORLD.height) };
  canvas.width = innerWidth; canvas.height = innerHeight;
  ctx.imageSmoothingEnabled = false;
}
resize(); addEventListener('resize', resize);
function worldToScreen(x, y) {
  const s = viewport.fit * camera.zoom;
  return { x: (x - camera.x) * s + viewport.w / 2, y: (y - camera.y) * s + viewport.h / 2 };
}
function screenToWorld(x, y) {
  const s = viewport.fit * camera.zoom;
  return { x: (x - viewport.w / 2) / s + camera.x, y: (y - viewport.h / 2) / s + camera.y };
}
function constrainCamera() {
  const hw = viewport.w / (2 * viewport.fit * camera.zoom), hh = viewport.h / (2 * viewport.fit * camera.zoom);
  camera.x = hw >= WORLD.width / 2 ? WORLD.width / 2 : clamp(camera.x, hw, WORLD.width - hw);
  camera.y = hh >= WORLD.height / 2 ? WORLD.height / 2 : clamp(camera.y, hh, WORLD.height - hh);
}
function toast(text) { state.toast = text; state.toastUntil = state.time + 1.5; }
function takeControl() { state.auto = false; state.manualCamera = false; document.querySelector('#auto').textContent = '自动游览'; }
function walkTo(target) {
  const path = findPath(hero, target);
  if (!path) { toast('沿石阶与庭院通行'); return false; }
  hero.path = path; state.target = target; return true;
}
function cast(type, actor = hero, target = null) {
  if (actor === hero) {
    const result = tryCast(cooldowns, type, state.time);
    if (!result.ok) { stats.rejectedCasts++; toast(`调息中 · ${result.remaining.toFixed(1)} 秒`); return false; }
    hero.path = []; state.target = null;
  }
  const aim = target || { x: actor.x + actor.dir * 130, y: actor.y - 8 };
  actor.dir = aim.x >= actor.x ? 1 : -1; actor.back = false;
  actor.action = { type, start: state.time, target: aim, released: false };
  if (actor === hero) stats.casts[type]++;
  return true;
}
function updateAction(actor) {
  const a = actor.action;
  if (!a) return;
  const age = state.time - a.start;
  if (age >= .24 && !a.released) {
    a.released = true;
    effects.cast(a.type, actor.x, actor.y, a.target.x, a.target.y, state.time);
    if(actor===hero)stats.releases[a.type]++;
  }
  actor.frame = a.type === 'sword' ? age < .24 ? 9 : 10 : 11;
  if (age >= .72) actor.action = null;
}
const shots = [
  { end: 5, title: '云岫山院', detail: '主殿 · 练武坪 · 松庭', camera: [836, 470, 1] },
  { end: 14, title: '入院', detail: '人物行走与石阶比例', camera: [826, 562, 1.45], destination: [824, 386] },
  { end: 22, title: '灯下穿行', detail: '前后层次与脚点', camera: [588, 611, 1.9], destination: [508, 645] },
  { end: 25, title: '灯前驻足', detail: '同一石灯 · 人物前后遮挡', camera: [588, 611, 1.9], destination: [510, 686] },
  { end: 29, title: '回到庭中', detail: '近景动作与轮廓', camera: [690, 660, 1.8], destination: [765, 692] },
  { end: 37, title: '青岚剑气', detail: '起势 · 出剑 · 命中', camera: [850, 650, 2] },
  { end: 45, title: '赤阳火诀', detail: '符火与落点', camera: [850, 650, 2] },
  { end: 52, title: '凝气护阵', detail: '阵法与人物层次', camera: [850, 650, 1.75] },
  { end: 66, title: '庭中演武', detail: '十六人同场 · 即时动作', camera: [836, 510, 1.12] }
];
function updateAuto(dt) {
  const t = state.time % 66;
  const index = shots.findIndex(s => t < s.end);
  const shot = shots[index];
  if (state.phase !== shot.title) {
    state.phase = shot.title; state.shot = index;
    if (shot.destination) walkTo({ x: shot.destination[0], y: shot.destination[1] });
    if (index === 0 && state.cycle !== Math.floor(state.time / 66)) {
      state.cycle = Math.floor(state.time / 66); walkTo({ x: 825, y: 720 });
    }
  }
  const k = 1 - Math.exp(-dt * 2.4);
  camera.x = lerp(camera.x, shot.camera[0], k); camera.y = lerp(camera.y, shot.camera[1], k); camera.zoom = lerp(camera.zoom, shot.camera[2], k);
  if (index >= 5 && index <= 7 && state.time - state.lastAutoCast > 3.1) {
    const type = ['sword', 'fire', 'ward'][index - 5];
    if (state.time >= cooldowns.readyAt[type] && !hero.action) { cast(type); state.lastAutoCast = state.time; }
  }
}
function moveActor(actor, target, dt, speed) {
  const oldX = actor.x, oldY = actor.y;
  const result = moveTowards(actor, target, dt, speed);
  const dx = actor.x - oldX, dy = actor.y - oldY, distance = Math.hypot(dx, dy);
  actor.moving = distance > .01; actor.distance += distance;
  if (actor.moving) {
    if (Math.abs(dx) > .01) actor.dir = dx > 0 ? 1 : -1;
    actor.back = dy < -.15;
    actor.frame = (actor.back ? 4 : 0) + Math.floor(actor.distance / 12) % 4;
  }
  if (actor === hero) stats.walkDistance += distance;
  return result;
}
function update(dt) {
  state.time += dt;
  if (state.auto) updateAuto(dt);
  hero.moving = false;
  if (!hero.action) {
    let dx = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
    let dy = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
    if (dx || dy) {
      const len = Math.hypot(dx, dy); hero.path = [];
      moveActor(hero, { x: hero.x + dx / len * 20, y: hero.y + dy / len * 20 }, dt, 108);
    } else if (hero.path.length) {
      const result = moveActor(hero, hero.path[0], dt, 112);
      if (result.reached) hero.path.shift();
    }
    if (!hero.moving) hero.frame = hero.back ? 5 : 8;
  }
  updateAction(hero);
  for (let i = 0; i < crowd.length; i++) {
    const p = crowd[i];
    const active = !state.auto || state.shot === 8;
    p.moving = false;
    if (active) {
      if (state.time > p.nextCast && !p.action && i % 3 !== 2) {
        const type = ['sword', 'fire', 'ward'][Math.floor(i / 3) % 3];
        const opponent = crowd[(i + 1) % crowd.length];
        cast(type, p, { x: lerp(p.x, opponent.x, .6), y: lerp(p.y, opponent.y, .6) });
        p.nextCast = state.time + 5.5 + i * .23;
      } else if (!p.action) {
        const tx = p.homeX + Math.sin(state.time * .22 + i * 1.7) * 35;
        const ty = p.homeY + Math.cos(state.time * .26 + i * 1.1) * 17;
        moveActor(p, { x: tx, y: ty }, dt, 34);
      }
    }
    if (!p.moving && !p.action) p.frame = 8;
    updateAction(p);
  }
  if (!state.auto && !state.manualCamera) {
    const k = 1 - Math.exp(-dt * 3);
    camera.x = lerp(camera.x, hero.x, k); camera.y = lerp(camera.y, hero.y - 90, k);
  }
  constrainCamera(); effects.prune(state.time);
  stats.spriteFrames.add(hero.frame);
}
function roundedPanel(x, y, w, h, alpha = .88) {
  ctx.fillStyle = `rgba(16,35,40,${alpha})`; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#bda56f'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
  ctx.strokeStyle = '#56665b'; ctx.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
}
function label(text, x, y, size = 14, color = '#f1e5c7', align = 'left') {
  ctx.font = `${size}px "Songti SC", "Noto Serif CJK SC", serif`; ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(text, x, y);
}
function drawActor(actor) {
  const selected = actor === hero;
  ctx.save(); ctx.translate(Math.round(actor.x), Math.round(actor.y));
  ctx.fillStyle = '#142c3548'; ctx.beginPath(); ctx.ellipse(0, -1, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
  if (selected) {
    ctx.strokeStyle = '#e5c774'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 8, 0, .15, Math.PI * 2 - .15); ctx.stroke();
    ctx.fillStyle = '#f6dea0'; ctx.fillRect(-2, -86, 4, 4);
  }
  let sprite=normalizedSprites[actor.frame||0];
  if(actor.color==='red'||actor.color==='white') {
    const offset=actor.color==='white'?4:0;
    const f=actor.action?3:actor.moving?1+Math.floor(actor.distance/14)%2:0;
    sprite=discipleSprites[offset+f];
  }
  ctx.scale(actor.dir, 1); ctx.drawImage(sprite, -52, -77); ctx.restore();
}
function drawProp(p) {
  ctx.save(); ctx.fillStyle = '#21363240'; ctx.beginPath(); ctx.ellipse(p.x + 8, p.y - 1, p.width * .33, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(props, ...p.rect, Math.round(p.x - p.width / 2), Math.round(p.y - p.height), p.width, p.height); ctx.restore();
}
function drawFrontRail() {
  // Authored foreground section of the same plate. It shares exact world pixels.
  const polygons = [
    [[305,663],[375,651],[409,693],[401,874],[375,941],[307,941]],
    [[1270,658],[1340,664],[1339,923],[1283,941],[1260,876]],
    [[550,727],[603,727],[626,774],[626,846],[549,831]],
    [[1050,720],[1116,720],[1132,840],[1045,842]]
  ];
  for (const poly of polygons) {
    ctx.save(); ctx.beginPath(); poly.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.clip(); ctx.drawImage(ground, 0, 0); ctx.restore();
  }
}
function drawEnvironmentMotion() {
  // Independent drifting motes are kept away from the floor silhouettes.
  for (let i = 0; i < 24; i++) {
    const x = 95 + (i * 131 + state.time * (3 + i % 3)) % 1480;
    const y = 115 + (i * 73) % 500 + Math.sin(state.time * .9 + i) * 9;
    ctx.fillStyle = i % 3 ? '#ead88b77' : '#cce8cb55'; ctx.fillRect(Math.round(x), Math.round(y), 2, 1);
  }
}
function skillIcon(type, x, y, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  if (type === 'sword') {
    ctx.strokeStyle = '#64c7e5'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-10, 11); ctx.lineTo(11, -13); ctx.stroke();
    ctx.strokeStyle = '#e0ffff'; ctx.lineWidth = 2; ctx.stroke(); ctx.strokeStyle = '#d5b96b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-12, 4); ctx.lineTo(-4, 11); ctx.stroke();
  } else if (type === 'fire') {
    ctx.fillStyle = '#eb7a32'; ctx.beginPath(); ctx.moveTo(1,-17); ctx.lineTo(12,4); ctx.lineTo(7,14); ctx.lineTo(-7,14); ctx.lineTo(-13,3); ctx.lineTo(-6,-6); ctx.lineTo(-2,4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffe6a1'; ctx.fillRect(-3,1,6,10);
  } else {
    ctx.strokeStyle = '#85ced0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0,0,13,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle = '#daca91'; ctx.strokeRect(-7,-7,14,14); ctx.fillStyle = '#def1d4'; ctx.fillRect(-2,-10,4,20);
  }
  ctx.restore();
}
function drawHUD() {
  const {w,h} = viewport;
  roundedPanel(24, 22, 228, 82);
  label('沈 砚', 42, 51, 21); label('青岚剑修', 145, 50, 13, '#bdbf9f');
  ctx.fillStyle = '#452d29'; ctx.fillRect(42,62,188,6); ctx.fillStyle = '#b96949'; ctx.fillRect(42,62,188,6);
  ctx.fillStyle = '#1b3a49'; ctx.fillRect(42,76,188,5); ctx.fillStyle = '#62a4b1'; ctx.fillRect(42,76,188,5);
  roundedPanel(w/2-104,14,208,65,.75);
  label('云岫山院', w/2, 44, 26, '#fff0c7', 'center');
  label('练 武 坪', w/2, 67, 12, '#e6d1a6', 'center');
  const shot = shots[state.shot];
  roundedPanel(24, h - 135, 235, 105, .9);
  label(state.paused ? '静观' : state.auto ? '自动游览' : '自由行走', 42, h-109, 12, '#b4c9bb');
  label(state.auto ? shot.title : '漫步山院', 42, h-78, 23);
  label(state.auto ? shot.detail : 'WASD 行走 · 点击地面寻路', 42, h-52, 12, '#cfccad');
  const slot = clamp(Math.floor((w-600)/12), 32, 46), gap=5;
  const rowW = (slot+gap)*12-gap, x0=(w-rowW)/2, y0=h-slot*2-37;
  const types=['sword','fire','ward'];
  const names=['剑气','火诀','护阵'];
  for(let row=0;row<2;row++) for(let i=0;i<12;i++) {
    const x=x0+i*(slot+gap),y=y0+row*(slot+gap);
    ctx.fillStyle = '#10252aed';ctx.fillRect(x,y,slot,slot);ctx.strokeStyle=i<3&&row===0?'#b9a16b':'#60706888';ctx.strokeRect(x+.5,y+.5,slot-1,slot-1);
    if(row===0&&i<3) {
      skillIcon(types[i],x+slot/2,y+slot/2,slot/48);
      const remain=Math.max(0,cooldowns.readyAt[types[i]]-state.time);
      if(remain>0) {ctx.fillStyle='#061a20cc';ctx.fillRect(x,y,slot,slot);label(remain.toFixed(1),x+slot/2,y+slot*.64,17,'#fff0c4','center');}
      label(String(i+1),x+5,y+12,10,'#ebdaa9');
    } else {ctx.fillStyle='#63736955';ctx.fillRect(x+slot/2-2,y+slot/2-2,4,4);}
  }
  ctx.fillStyle='#11292fe8';ctx.fillRect(x0-4,h-25,rowW+8,23);
  label('1 剑气   2 火诀   3 护阵    ·    滚轮缩放   右键拖动   空格静观',w/2,h-10,12,'#e8dfc2','center');
  roundedPanel(w-218,h-76,194,46,.88);
  label(`十六人演武  ·  ${Math.round(camera.zoom*100)}%`,w-121,h-48,13,'#ded3b1','center');
  if(state.time<state.toastUntil) {roundedPanel(w/2-140,110,280,42);label(state.toast,w/2,137,15,'#f0dfb4','center');}
  // Click regions derive from these same dimensions.
  state.skillRects=types.map((type,i)=>({type,x:x0+i*(slot+gap),y:y0,w:slot,h:slot}));
  state.hotbarRect={x:x0,y:y0,w:rowW,h:slot*2+gap};
}
function render() {
  const began = performance.now();
  ctx.fillStyle='#10262c';ctx.fillRect(0,0,viewport.w,viewport.h);
  ctx.save();ctx.translate(viewport.w/2,viewport.h/2);ctx.scale(viewport.fit*camera.zoom,viewport.fit*camera.zoom);ctx.translate(-camera.x,-camera.y);
  ctx.drawImage(ground,0,0,WORLD.width,WORLD.height); drawEnvironmentMotion(); effects.drawGround(ctx,state.time);
  if(state.target&&hero.path.length) {ctx.strokeStyle='#ddc17a';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(state.target.x,state.target.y,12,4,0,0,Math.PI*2);ctx.stroke();}
  const all=[...crowd.map(a=>({y:a.y,actor:a})),{y:hero.y,actor:hero},...garden.map(p=>({y:p.y,prop:p}))].sort((a,b)=>a.y-b.y);
  for(const item of all) item.actor?drawActor(item.actor):drawProp(item.prop);
  effects.drawAir(ctx,state.time);drawFrontRail();ctx.restore();drawHUD();
  stats.renderMs.push(performance.now()-began);if(stats.renderMs.length>6000)stats.renderMs.shift();
}

document.querySelector('#pause').onclick=()=>{state.paused=!state.paused;document.querySelector('#pause').textContent=state.paused?'继续':'暂停';};
function resetTour(){
  state.auto=true;state.manualCamera=false;state.phase='';state.time=0;state.shot=0;state.lastAutoCast=-10;state.cycle=0;state.target=null;state.toastUntil=0;
  hero.path=[];hero.action=null;hero.x=825;hero.y=720;hero.dir=1;hero.back=true;hero.distance=0;
  crowd.forEach((p,i)=>{p.x=p.homeX;p.y=p.homeY;p.action=null;p.nextCast=2+i*.43;p.frame=8;p.moving=false;p.distance=i*7;});
  Object.assign(cooldowns,createCooldowns());effects.events.length=0;
}
document.querySelector('#auto').onclick=resetTour;
document.querySelector('#overview').onclick=()=>{takeControl();state.manualCamera=true;camera.x=WORLD.width/2;camera.y=WORLD.height/2;camera.zoom=1;};
addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();
  if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key))e.preventDefault();
  if(e.repeat&&[' ','1','2','3'].includes(key))return;
  if(key===' '){document.querySelector('#pause').click();return;}
  if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){takeControl();keys.add(key);}
  const type={'1':'sword','2':'fire','3':'ward'}[key];
  if(type&&!state.paused){takeControl();cast(type);}
});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',()=>{keys.clear();pointer=null;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{pointer={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,button:e.button};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{
  if(!pointer||pointer.button===0)return;
  takeControl();state.manualCamera=true;const s=viewport.fit*camera.zoom;
  camera.x-=(e.clientX-pointer.x)/s;camera.y-=(e.clientY-pointer.y)/s;pointer.x=e.clientX;pointer.y=e.clientY;constrainCamera();
});
canvas.addEventListener('pointerup',e=>{
  if(!pointer)return;
  if(pointer.button===0&&Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)<6&&!state.paused){
    const hit=state.skillRects?.find(r=>e.clientX>=r.x&&e.clientX<=r.x+r.w&&e.clientY>=r.y&&e.clientY<=r.y+r.h);
    const r=state.hotbarRect,emptySlot=r&&e.clientX>=r.x&&e.clientX<=r.x+r.w&&e.clientY>=r.y&&e.clientY<=r.y+r.h;
    if(hit){takeControl();cast(hit.type);}else if(!emptySlot){takeControl();walkTo(screenToWorld(e.clientX,e.clientY));}
  }pointer=null;
});
canvas.addEventListener('wheel',e=>{
  e.preventDefault();takeControl();state.manualCamera=true;
  const before=screenToWorld(e.clientX,e.clientY);camera.zoom=clamp(camera.zoom*Math.exp(-e.deltaY*.001),1,2.8);
  const after=screenToWorld(e.clientX,e.clientY);camera.x+=before.x-after.x;camera.y+=before.y-after.y;constrainCamera();
},{passive:false});

function inspect() {return {time:state.time,auto:state.auto,paused:state.paused,hero:{x:hero.x,y:hero.y,frame:hero.frame,action:hero.action?.type,path:hero.path.length},camera:{...camera},actors:16,castCounts:{...stats.casts},releases:{...stats.releases},activeEffects:effects.events.map(e=>({type:e.type,age:state.time-e.start,x:e.x,y:e.y})),cooldowns:structuredClone(cooldowns),errors:[...errors]};}
window.pixelScene={inspect,cast:type=>cast(type),walkTo,screenToWorld,worldToScreen};
document.querySelector('#loading').classList.add('hidden');
let last=performance.now();let raf;
function tick(now){
  const interval=now-last;last=now;
  const dt=Math.min(interval/1000,.05);
  if(!state.paused&&(!document.hidden||options.qa))update(dt);
  render();stats.frames++;if(stats.frames>5)stats.intervals.push(interval);
  raf=requestAnimationFrame(tick);
}
raf=requestAnimationFrame(tick);

async function startRecording() {
  const stream=canvas.captureStream(30);const chunks=[];
  const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:9000000});
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  recorder.start(1000);return {recorder,stream,chunks};
}
async function finishRecording() {
  if(!recording)return;
  await new Promise(resolve=>{recording.recorder.onstop=resolve;recording.recorder.stop();});
  const blob=new Blob(recording.chunks,{type:'video/webm'});
  await host.recording({filename:'pixel-scene-tour.webm',bytes:await blob.arrayBuffer()});
  recording.stream.getTracks().forEach(t=>t.stop());
}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function waitForTime(t){while(state.time<t)await delay(40);}
function check(name,ok,detail){stats.checks.push({name,ok,detail});if(!ok)errors.push(`CHECK: ${name}`);}
async function capture(name){render();await delay(80);await host.capture(name);stats.captures.push({name,...inspect()});}
function summarize() {
  const sorted=[...stats.intervals].sort((a,b)=>a-b);
  const renderSorted=[...stats.renderMs].sort((a,b)=>a-b);
  return {kind:'desktop-pixel-scene-validation',viewport,world:WORLD,actors:16,sourceAssets:[ground.src,people.src,props.src,disciples.src].map(x=>x.split('/').pop()),...inspect(),frames:stats.frames,walkDistance:stats.walkDistance,spriteFrames:[...stats.spriteFrames],rejectedCasts:stats.rejectedCasts,checks:stats.checks,captures:stats.captures,performance:{sampleFrames:sorted.length,meanFPS:1000/(sorted.reduce((a,b)=>a+b,0)/sorted.length),p95FrameMs:sorted[Math.floor(sorted.length*.95)],p95RenderMs:renderSorted[Math.floor(renderSorted.length*.95)]},errors};
}
async function captureSkill(type,earliest,minAge,name){
  await waitForTime(earliest);
  let event;
  while(!(event=effects.events.find(e=>e.type===type&&e.x===hero.x&&e.y===hero.y&&state.time-e.start>=minAge&&state.time-e.start<minAge+.25)))await delay(15);
  await capture(name);
}
async function runQA() {
  if(options.record)recording=await startRecording();
  await waitForTime(1);await capture('01-overview.png');
  await waitForTime(12);await capture('02-hall-walk.png');
  await waitForTime(21);await capture('03-lantern-behind.png');
  check('actor-approached-lantern',Math.hypot(hero.x-508,hero.y-645)<10,{x:hero.x,y:hero.y});
  await waitForTime(24);await capture('04-lantern-front.png');
  check('actor-reached-lantern-front',Math.hypot(hero.x-510,hero.y-686)<10,{x:hero.x,y:hero.y});
  await captureSkill('sword',29,.28,'05-sword.png');
  await captureSkill('fire',37,.55,'06-fire.png');
  await captureSkill('ward',45,.5,'07-ward.png');
  await waitForTime(58);await capture('08-sixteen-actors.png');
  check('walking-uses-frames',stats.walkDistance>500&&stats.spriteFrames.has(0)&&stats.spriteFrames.has(4),{distance:stats.walkDistance,frames:[...stats.spriteFrames]});
  check('all-skills-released',Object.values(stats.releases).every(v=>v>0),stats.releases);
  takeControl();hero.action=null;hero.path=[];camera.zoom=1;camera.x=836;camera.y=470;state.manualCamera=true;
  const before={x:hero.x,y:hero.y};const illegal=walkTo({x:830,y:180});
  check('roof-rejected',illegal===false&&hero.x===before.x&&hero.y===before.y,{illegal,before,after:{x:hero.x,y:hero.y}});
  const now=state.time;cooldowns.readyAt.sword=now;const accepted=cast('sword');const rejected=cast('sword');
  check('cooldown-rejects-repeat',accepted&&!rejected,{accepted,rejected});
  await waitForTime(now+3);hero.action=null;const ready=cast('sword');check('cooldown-recovers',ready,{ready});
  const freeze=state.time;state.paused=true;await delay(350);check('pause-freezes-time',state.time===freeze,{before:freeze,after:state.time});
  state.paused=false;await capture('09-manual-overview.png');
  check('actors-on-navigation',isWalkable(hero.x,hero.y)&&crowd.every(p=>isWalkable(p.x,p.y)),{hero:{x:hero.x,y:hero.y}});
  if(recording)await finishRecording();
  crowd[0].action={type:'fire',start:state.time,released:false,target:{x:500,y:500}};
  resetTour();
  check('replay-resets-every-actor',crowd.every((p,i)=>!p.action&&p.x===p.homeX&&p.y===p.homeY&&p.nextCast===2+i*.43)&&state.time===0&&hero.path.length===0,{crowdActions:crowd.filter(p=>p.action).length});
  const result=summarize();await host.metrics(result);await host.finish({failed:errors.length>0});
}
if(options.qa)runQA().catch(async e=>{errors.push(e.stack||String(e));await host.metrics(summarize());await host.finish({failed:true});});
