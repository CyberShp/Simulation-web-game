const TAU = Math.PI * 2;
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const mix = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - (1 - t) ** 3;
const noise = (seed, index) => {
  const n = Math.sin(seed * 19.17 + index * 127.1) * 43758.5453;
  return n - Math.floor(n);
};
const BLUE = { dark: '#2676a0', middle: '#31bad7', light: '#95e9eb', core: '#e7ffff', gold: '#e5c37d' };
const FIRE = { dark: '#a64224', middle: '#ef792b', light: '#ffbe54', core: '#fff0b0' };

// All positions are world coordinates. Small, aligned squares keep the effect
// legible at both the courtyard and close inspection camera scales.
function dot(ctx, x, y, size, color, alpha = 1) {
  if (alpha <= 0 || size <= 0) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  const s = Math.max(1, Math.round(size));
  ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
}

function line(ctx, ax, ay, bx, by, width, color, alpha = 1, step = 1.5) {
  const length = Math.hypot(bx - ax, by - ay);
  const count = Math.max(1, Math.ceil(length / step));
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    dot(ctx, mix(ax, bx, t), mix(ay, by, t), width, color, alpha);
  }
}

function ring(ctx, x, y, radius, color, alpha, width = 1, squash = .42, phase = 0, broken = false) {
  const count = Math.max(32, Math.ceil(radius * 4));
  for (let i = 0; i < count; i++) {
    if (broken && i % 13 > 9) continue;
    const a = i / count * TAU + phase;
    dot(ctx, x + Math.cos(a) * radius, y + Math.sin(a) * radius * squash, width, color, alpha);
  }
}

function glyph(ctx, x, y, size, color, alpha, shape) {
  const s = size;
  line(ctx, x - s, y - s * .45, x + s, y - s * .45, 1, color, alpha);
  line(ctx, x, y - s, x, y + s, 1, color, alpha);
  if (shape % 2 === 0) {
    line(ctx, x - s, y + s * .5, x + s, y + s * .5, 1, color, alpha);
    dot(ctx, x - s, y, 2, color, alpha);
    dot(ctx, x + s, y, 2, color, alpha);
  } else {
    line(ctx, x - s * .7, y, x + s * .7, y + s, 1, color, alpha);
    line(ctx, x + s * .7, y, x - s * .7, y + s, 1, color, alpha);
  }
}

function sparks(ctx, event, age, x, y, count, spread, palette, lift = 0) {
  const t = clamp(age);
  const fade = (1 - t) ** 1.3;
  for (let i = 0; i < count; i++) {
    const a = noise(event.id, i) * TAU;
    const speed = spread * (.25 + noise(event.id + 2, i) * .75);
    const px = x + Math.cos(a) * speed * easeOut(t);
    const py = y + Math.sin(a) * speed * .66 * easeOut(t) - Math.sin(t * Math.PI) * lift;
    const size = i % 5 === 0 ? 3 : i % 3 === 0 ? 2 : 1;
    dot(ctx, px, py, size, i % 3 === 0 ? palette.core : palette.light, fade);
    if (i % 4 === 0) {
      line(ctx, px, py, px - Math.cos(a) * 5 * (1 - t), py - Math.sin(a) * 3 * (1 - t), 1, palette.middle, fade * .75);
    }
  }
}

function groundEffect(ctx, event, age) {
  const { x, y, tx, ty, type } = event;
  if (type === 'ward') {
    const emerge = clamp(age / .28);
    const fade = clamp((event.duration - age) / .55);
    const radius = 57 * (.82 + .18 * easeOut(emerge));
    ring(ctx, x, y, radius + 4, BLUE.dark, .35 * fade, 3);
    ring(ctx, x, y, radius, BLUE.middle, .86 * fade, 2);
    ring(ctx, x, y, radius - 5, BLUE.core, .85 * fade);
    ring(ctx, x, y, radius - 12, BLUE.middle, .65 * fade, 1, .42, age * .14, true);
    ring(ctx, x, y, 24, BLUE.gold, .68 * fade, 1, .42);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU;
      const gx = x + Math.cos(a) * (radius - 8);
      const gy = y + Math.sin(a) * (radius - 8) * .42;
      glyph(ctx, gx, gy, 2.4, i % 2 ? BLUE.gold : BLUE.light, .82 * fade, i);
      if (i % 2 === 0) {
        line(ctx, x + Math.cos(a) * 27, y + Math.sin(a) * 11, x + Math.cos(a) * 38, y + Math.sin(a) * 16, 1, BLUE.middle, .6 * fade);
      }
    }
  } else if (type === 'fire') {
    const warning = clamp(age / .25) * clamp((.78 - age) / .28);
    ring(ctx, tx, ty, 24, FIRE.middle, warning * .8, 1);
    ring(ctx, tx, ty, 20, FIRE.light, warning * .45, 1, .42, 0, true);
    if (age > .52) {
      const p = clamp((age - .52) / .75);
      ring(ctx, tx, ty, 11 + easeOut(p) * 26, FIRE.middle, (1 - p) * .6, 2);
      ring(ctx, tx, ty, 6 + easeOut(p) * 23, FIRE.light, (1 - p) * .65, 1);
    }
  } else if (type === 'sword' && age > .3) {
    const p = clamp((age - .3) / .5);
    ring(ctx, tx, ty, 8 + easeOut(p) * 15, BLUE.middle, (1 - p) * .46, 1, .3);
  }
}

function swordEffect(ctx, event, age) {
  const { x, y, tx, ty } = event;
  const dx = tx - x;
  const dy = ty - y;
  const angle = Math.atan2(dy, dx);
  const nx = Math.cos(angle);
  const ny = Math.sin(angle);
  const px = -ny;
  const py = nx;
  const handX = x + nx * 11;
  const handY = y - 27 + ny * 8;
  if (age < .49) {
    const p = clamp(age / .49);
    const fade = Math.sin(Math.PI * p) ** .55;
    const sweep = mix(-1.1, .95, easeOut(p));
    const radius = 30 + p * 12;
    for (let i = 0; i < 65; i++) {
      const t = i / 64;
      const a = sweep - .95 + t * 1.6;
      const ahead = Math.cos(a) * radius;
      const across = Math.sin(a) * radius * .82;
      const sx = handX + nx * ahead + px * across;
      const sy = handY + ny * ahead + py * across;
      const taper = Math.sin(t * Math.PI) ** .6;
      dot(ctx, sx, sy, 1 + taper * 5, BLUE.middle, fade * .68);
      dot(ctx, sx + nx * 1.5, sy + ny * 1.5, 1 + taper * 2, BLUE.core, fade);
      if (i % 8 === 0) dot(ctx, sx - nx * 7, sy - ny * 7, 1, BLUE.light, fade * .72);
    }
  }
  const travel = clamp((age - .11) / .38);
  if (age > .11 && age < .55) {
    const cx = mix(handX, tx, travel);
    const cy = mix(handY, ty - 27, travel);
    const fade = clamp((.55 - age) / .1);
    for (let i = 4; i > 0; i--) {
      const tailX = cx - nx * i * 6;
      const tailY = cy - ny * i * 6;
      line(ctx, tailX - nx * 7, tailY - ny * 7, tailX + nx * 6, tailY + ny * 6, 2, BLUE.middle, fade * (1 - i / 5) * .5);
    }
    line(ctx, cx - nx * 10, cy - ny * 10, cx + nx * 10, cy + ny * 10, 3, BLUE.middle, fade);
    line(ctx, cx - nx * 6, cy - ny * 6, cx + nx * 10, cy + ny * 10, 1, BLUE.core, fade);
    line(ctx, cx - nx * 6 - px * 4, cy - ny * 6 - py * 4, cx - nx * 6 + px * 4, cy - ny * 6 + py * 4, 1, BLUE.gold, fade);
  }
  if (age > .46) {
    const p = (age - .46) / .63;
    sparks(ctx, event, p, tx, ty - 26, 20, 33, BLUE, 4);
    if (p < .28) {
      const f = 1 - p / .28;
      line(ctx, tx - 11, ty - 37, tx + 11, ty - 15, 2, BLUE.core, f);
      line(ctx, tx + 7, ty - 36, tx - 7, ty - 16, 1, BLUE.light, f);
    }
  }
}

function fireEffect(ctx, event, age) {
  const { x, y, tx, ty } = event;
  const dx = tx - x;
  const dy = ty - y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = dx / length;
  const ny = dy / length;
  const px = -ny;
  const py = nx;
  if (age < .58) {
    const p = clamp(age / .58);
    const cx = mix(x + nx * 14, tx, p);
    const cy = mix(y - 28, ty - 24, p) - Math.sin(p * Math.PI) * 9;
    for (let i = 13; i >= 0; i--) {
      const f = 1 - i / 15;
      const wobble = Math.sin(age * 24 + i * 1.8) * i * .2;
      dot(ctx, cx - nx * i * 2.3 + px * wobble, cy - ny * i * 2.3 + py * wobble, 1 + f * 5, FIRE.middle, f * .82);
      if (i % 3 === 0) dot(ctx, cx - nx * i * 2.5 - px * 5, cy - ny * i * 2.5 - py * 5, 1, FIRE.light, f * .85);
    }
    dot(ctx, cx, cy, 9, FIRE.middle, .94);
    dot(ctx, cx + nx, cy + ny, 6, FIRE.light, 1);
    dot(ctx, cx + nx * 2, cy + ny * 2, 3, FIRE.core, 1);
    dot(ctx, cx - px * 5 - nx * 3, cy - py * 5 - ny * 3, 3, FIRE.light, .86);
  }
  if (age > .52) {
    const p = clamp((age - .52) / .88);
    const burst = clamp(p / .15);
    const fade = (1 - p) ** 1.6;
    const cx = tx;
    const cy = ty - 25;
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU + noise(event.id, i) * .28;
      const r = (11 + noise(event.id, i + 15) * 23) * easeOut(burst);
      const ex = cx + Math.cos(a) * r;
      const ey = cy + Math.sin(a) * r * .85;
      line(ctx, cx + Math.cos(a) * r * .25, cy + Math.sin(a) * r * .2, ex, ey, 3 * (1 - p) + 1, FIRE.middle, fade);
      line(ctx, cx, cy, ex * .78 + cx * .22, ey * .78 + cy * .22, 1, FIRE.light, fade);
    }
    dot(ctx, cx, cy, Math.max(1, 9 * (1 - p)), FIRE.light, fade);
    dot(ctx, cx, cy, Math.max(1, 4 * (1 - p)), FIRE.core, fade);
    sparks(ctx, event, p, cx, cy, 30, 42, FIRE, 13);
    for (let i = 0; i < 7; i++) {
      const q = (p + i * .13) % 1;
      dot(ctx, cx + (noise(event.id, i + 80) - .5) * 35, cy - q * 44, i % 2 + 1, FIRE.light, (1 - q) * fade * .7);
    }
  }
}

function wardEffect(ctx, event, age) {
  const fade = clamp(age / .25) * clamp((event.duration - age) / .55);
  const radius = 57;
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * TAU;
    const x = event.x + Math.cos(a) * radius;
    const y = event.y + Math.sin(a) * radius * .42;
    const phase = (age * .5 + i * .17) % 1;
    const h = 12 + noise(event.id, i) * 23;
    const alpha = fade * (i % 2 === 0 ? .78 : .45);
    line(ctx, x, y - 2, x, y - h, 1, BLUE.middle, alpha * .6);
    dot(ctx, x, y - h * phase, 2, BLUE.core, alpha * Math.sin(Math.PI * phase));
    if (i % 2 === 0) glyph(ctx, x, y - h - 4, 2, BLUE.light, alpha, i + 1);
  }
  for (let i = 0; i < 13; i++) {
    const p = (age * .6 + noise(event.id + 2, i)) % 1;
    const a = noise(event.id + 3, i) * TAU;
    const r = 24 + noise(event.id + 1, i) * 24;
    dot(ctx, event.x + Math.cos(a) * r, event.y + Math.sin(a) * r * .42 - p * 38, 1, i % 4 === 0 ? BLUE.gold : BLUE.light, Math.sin(p * Math.PI) * fade * .65);
  }
}

export class Effects {
  constructor() {
    this.events = [];
    this.nextId = 1;
  }

  cast(type, x, y, tx, ty, time) {
    if (!['sword', 'fire', 'ward'].includes(type)) throw new RangeError(`Unknown effect type: ${type}`);
    if (![x, y, tx, ty, time].every(Number.isFinite)) throw new TypeError('Effect coordinates and time must be finite');
    const duration = { sword: 1.12, fire: 1.42, ward: 2.4 }[type];
    const event = { id: this.nextId++, type, x, y, tx, ty, start: time, duration, end: time + duration };
    this.events.push(event);
    return event;
  }

  drawGround(ctx, time) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const event of this.events) {
      const age = time - event.start;
      if (age >= 0 && age < event.duration) groundEffect(ctx, event, age);
    }
    ctx.restore();
  }

  drawAir(ctx, time) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const event of this.events) {
      const age = time - event.start;
      if (age < 0 || age >= event.duration) continue;
      if (event.type === 'sword') swordEffect(ctx, event, age);
      else if (event.type === 'fire') fireEffect(ctx, event, age);
      else wardEffect(ctx, event, age);
    }
    ctx.restore();
  }

  prune(time) {
    this.events = this.events.filter(event => time < event.end);
  }
}
