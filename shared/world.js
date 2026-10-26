// Shared deterministic world generation + collision (used by server and client).
export const CHUNK = 24;
export const CEIL = 6;
export const CYCLE = 480;      // seconds per full day
export const DAY = 300;        // first 300s are day, rest is night
export const isNight = (t) => t >= DAY;

export function hash(a, b, c) {
  let h = (2166136261 ^ a) >>> 0;
  h = Math.imul(h ^ b, 16777619); h = Math.imul(h ^ c, 16777619);
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}
export function rng(s) {
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TYPES = {
  shelf:    { w: 4,   d: 1,   h: 2.4, name: 'Shelf' },
  bed:      { w: 2,   d: 2.4, h: 0.6, name: 'Bed' },
  sofa:     { w: 2.4, d: 1,   h: 0.9, name: 'Sofa' },
  table:    { w: 1.6, d: 1,   h: 0.8, name: 'Table' },
  chair:    { w: 0.6, d: 0.6, h: 0.9, name: 'Chair' },
  lamp:     { w: 0.4, d: 0.4, h: 1.7, name: 'Lamp' },
  wardrobe: { w: 2,   d: 0.8, h: 2.2, name: 'Wardrobe' },
  display:  { w: 1.4, d: 1.4, h: 1,   name: 'Display' },
  pillar:   { w: 1,   d: 1,   h: 6,   name: 'Pillar', fixed: true },
  sign:     { w: 0.2, d: 0.2, h: 3,   name: 'Sign', fixed: true },
};

export const ITEMS = {
  meatballs: { name: 'Meatballs', food: 30, weight: 5 },
  hotdog:    { name: 'Hot Dog', food: 22, weight: 5 },
  juice:     { name: 'Juice', food: 8, energy: 35, weight: 4 },
  cake:      { name: 'Cake', food: 40, weight: 2 },
  medkit:    { name: 'Medkit', heal: 50, weight: 2 },
  bat:       { name: 'Bat', weapon: true, dmg: 26, range: 2.4, cd: 600, weight: 1 },
  pipe:      { name: 'Pipe', weapon: true, dmg: 32, range: 2.2, cd: 750, weight: 1 },
  crowbar:   { name: 'Crowbar', weapon: true, dmg: 38, range: 2.0, cd: 850, weight: 0.6 },
};
export const FISTS = { dmg: 8, range: 1.8, cd: 450 };
const ITEM_POOL = Object.entries(ITEMS).flatMap(([k, v]) => Array(Math.round(v.weight * 5)).fill(k));

export const SIGN_TEXTS = ['BEDROOMS', 'LIVING ROOM', 'DINING', 'STORAGE', 'MARKET HALL', 'EXIT', 'SELF SERVE', 'KITCHENS', 'RESTAURANT', 'CHECKOUT'];

const WOODS = [0x8b5a2b, 0xc19a6b, 0x5c4033, 0xe0c9a6, 0x3b2a1e];
const FABRICS = [0x3b5b92, 0x8e3b46, 0x4f7942, 0x7a7a7a, 0xd9b44a, 0x2f2f3a, 0xb07fb5];
const METALS = [0x9aa0a6, 0x4a90c2, 0xd0d0d0, 0x2e5e8e];

// Parts in local space (rot 0): [x, y, z, sx, sy, sz, color]  (y is center)
export function localParts(type, c) {
  const r = rng(c);
  const wood = WOODS[c % WOODS.length], fab = FABRICS[(c >> 3) % FABRICS.length], met = METALS[(c >> 6) % METALS.length];
  const P = [];
  switch (type) {
    case 'shelf': {
      P.push([-1.95, 1.2, 0, 0.1, 2.4, 1, met], [1.95, 1.2, 0, 0.1, 2.4, 1, met], [0, 1.2, -0.47, 3.8, 2.4, 0.06, 0xb8b8b0]);
      for (const y of [0.1, 0.85, 1.6, 2.35]) P.push([0, y, 0, 3.8, 0.07, 1, met]);
      for (const y of [0.1, 0.85, 1.6]) for (let x = -1.5; x <= 1.5; x += 0.75) if (r() < 0.75) {
        const h = 0.25 + r() * 0.4;
        P.push([x, y + 0.035 + h / 2, 0, 0.6, h, 0.7, FABRICS[(r() * FABRICS.length) | 0] ^ 0x101010]);
      }
      break;
    }
    case 'bed':
      P.push([0, 0.2, 0, 2, 0.4, 2.4, wood], [0, 0.5, 0.05, 1.9, 0.2, 2.25, 0xf2f2ee], [0, 0.66, -0.9, 1.4, 0.13, 0.35, 0xffffff],
        [0, 0.62, 0.35, 1.94, 0.06, 1.55, fab], [0, 0.65, -1.15, 2, 1.3, 0.1, wood]);
      break;
    case 'sofa':
      P.push([0, 0.25, 0.05, 2.4, 0.5, 0.9, fab], [0, 0.6, -0.36, 2.4, 0.7, 0.26, fab], [-1.1, 0.45, 0.05, 0.2, 0.45, 0.9, fab], [1.1, 0.45, 0.05, 0.2, 0.45, 0.9, fab],
        [-0.5, 0.55, 0.1, 0.95, 0.12, 0.7, fab ^ 0x0a0a0a], [0.5, 0.55, 0.1, 0.95, 0.12, 0.7, fab ^ 0x0a0a0a]);
      break;
    case 'table':
      P.push([0, 0.76, 0, 1.6, 0.08, 1, wood]);
      for (const sx of [-0.72, 0.72]) for (const sz of [-0.42, 0.42]) P.push([sx, 0.36, sz, 0.08, 0.72, 0.08, wood]);
      break;
    case 'chair':
      P.push([0, 0.45, 0, 0.5, 0.06, 0.5, wood], [0, 0.75, -0.22, 0.5, 0.6, 0.06, wood]);
      for (const sx of [-0.2, 0.2]) for (const sz of [-0.2, 0.2]) P.push([sx, 0.21, sz, 0.05, 0.42, 0.05, wood]);
      break;
    case 'lamp':
      P.push([0, 0.03, 0, 0.35, 0.06, 0.35, 0x222222], [0, 0.8, 0, 0.05, 1.5, 0.05, 0x333333], [0, 1.55, 0, 0.42, 0.32, 0.42, 0xfff0c0]);
      break;
    case 'wardrobe':
      P.push([0, 1.1, 0, 2, 2.2, 0.8, wood], [0, 1.1, 0.41, 0.03, 2.1, 0.02, 0x222222], [-0.12, 1.1, 0.42, 0.04, 0.2, 0.04, met], [0.12, 1.1, 0.42, 0.04, 0.2, 0.04, met]);
      break;
    case 'display':
      P.push([0, 0.5, 0, 1.4, 1, 1.4, 0xeeeeee], [0, 1.15, 0, 0.5, 0.3, 0.5, fab]);
      break;
    case 'pillar':
      P.push([0, 3, 0, 1, 6, 1, 0xd8d6cc], [0, 1.2, 0, 1.04, 0.3, 1.04, 0xf5c518]);
      break;
    case 'sign':
      P.push([0, 1.5, 0, 0.08, 3, 0.08, 0x333333]);
      break;
  }
  return P;
}

// rotate local (x,z) by rot*90deg (matches three.js rotation.y)
export function rotXZ(x, z, rot) {
  switch (rot & 3) { case 0: return [x, z]; case 1: return [z, -x]; case 2: return [-x, -z]; default: return [-z, x]; }
}
export function worldParts(f) {
  return localParts(f.type, f.c).map(([x, y, z, sx, sy, sz, col]) => {
    const [rx, rz] = rotXZ(x, z, f.rot);
    const odd = f.rot & 1;
    return [f.x + rx, y, f.z + rz, odd ? sz : sx, sy, odd ? sx : sz, col];
  });
}
export function aabb(f) {
  const t = TYPES[f.type]; const odd = f.rot & 1;
  const hw = (odd ? t.d : t.w) / 2, hd = (odd ? t.w : t.d) / 2;
  return { x0: f.x - hw, x1: f.x + hw, z0: f.z - hd, z1: f.z + hd, h: t.h, f };
}

export class World {
  constructor(seed) { this.seed = seed | 0; this.cache = new Map(); this.removed = new Set(); this.placed = new Map(); }

  chunk(cx, cz) {
    const key = cx + ',' + cz;
    let ch = this.cache.get(key);
    if (ch) return ch;
    if (this.cache.size > 4000) this.cache.clear();
    ch = this.gen(cx, cz);
    this.cache.set(key, ch);
    return ch;
  }

  gen(cx, cz) {
    const r = rng(hash(this.seed, cx, cz));
    const ox = cx * CHUNK, oz = cz * CHUNK;
    const furn = [];
    const add = (type, x, z, rot = 0) => furn.push({ id: `${cx}_${cz}_${furn.length}`, type, x: ox + x, z: oz + z, rot, c: (r() * 1e9) | 0 });
    add('pillar', 0.5, 0.5);
    const kind = (r() * 7) | 0;
    let sign = null;
    if (kind <= 1) { // aisles
      const vertical = r() < 0.5;
      for (let a = 4; a <= 20; a += 4) for (let b = 5; b <= 20; b += 5) if (r() < 0.85) vertical ? add('shelf', a, b, 1) : add('shelf', b, a, 0);
      sign = r() < 0.5 ? 'STORAGE' : 'MARKET HALL';
    } else if (kind === 2) { // bedrooms
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        const x = 5 + i * 7, z = 6 + j * 9;
        if (r() < 0.9) add('bed', x, z, 0);
        if (r() < 0.7) add('lamp', x + 1.6, z - 0.9);
        if (r() < 0.5) add('wardrobe', x, z - 2.4, 0);
      }
      sign = 'BEDROOMS';
    } else if (kind === 3) { // living rooms
      for (const [x, z] of [[6, 6], [17, 6], [6, 17], [17, 17]]) {
        add('sofa', x, z - 1.6, 0); add('table', x, z, 0);
        if (r() < 0.6) add('chair', x + 1.6, z + 0.2, 3);
        if (r() < 0.6) add('lamp', x + 1.8, z - 1.8);
      }
      sign = 'LIVING ROOM';
    } else if (kind === 4) { // dining
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const x = 5 + i * 7, z = 5 + j * 7;
        add('table', x, z, 0);
        add('chair', x - 0.4, z - 0.85, 0); add('chair', x + 0.4, z - 0.85, 0);
        add('chair', x - 0.4, z + 0.85, 2); add('chair', x + 0.4, z + 0.85, 2);
      }
      sign = r() < 0.5 ? 'DINING' : 'RESTAURANT';
    } else if (kind === 5) { // displays
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (r() < 0.55) add('display', 4.5 + i * 5, 4.5 + j * 5);
      sign = 'SELF SERVE';
    } else { // mixed showroom
      for (let n = 0; n < 10; n++) {
        const types = ['sofa', 'table', 'wardrobe', 'bed', 'lamp', 'chair', 'shelf'];
        const t = types[(r() * types.length) | 0];
        const x = 4 + r() * 16, z = 4 + r() * 16, rot = (r() * 4) | 0;
        const cand = aabb({ type: t, x: ox + x, z: oz + z, rot });
        if (!furn.some(f => overlap(aabb(f), cand, 0.6))) add(t, x, z, rot);
      }
      sign = SIGN_TEXTS[(r() * SIGN_TEXTS.length) | 0];
    }
    if (r() < 0.35) { add('sign', 2, 12); furn[furn.length - 1].text = sign; }
    for (const f of furn) f.box = aabb(f);
    // items
    const items = [];
    const n = 1 + ((r() * 4) | 0);
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 8; tries++) {
        const x = ox + 1.5 + r() * 21, z = oz + 1.5 + r() * 21;
        if (furn.some(f => x > f.box.x0 - 0.4 && x < f.box.x1 + 0.4 && z > f.box.z0 - 0.4 && z < f.box.z1 + 0.4)) continue;
        items.push({ id: `i_${cx}_${cz}_${i}`, type: ITEM_POOL[(r() * ITEM_POOL.length) | 0], x, z });
        break;
      }
    }
    return { cx, cz, furn, items };
  }

  itemById(id) {
    const m = /^i_(-?\d+)_(-?\d+)_(\d+)$/.exec(id); if (!m) return null;
    return this.chunk(+m[1], +m[2]).items.find(i => i.id === id) || null;
  }
  furnById(id) {
    if (id.startsWith('p_')) return this.placed.get(id) || null;
    const m = /^(-?\d+)_(-?\d+)_(\d+)$/.exec(id); if (!m) return null;
    return this.chunk(+m[1], +m[2]).furn[+m[3]] || null;
  }
  addPlaced(o) { o.box = aabb(o); this.placed.set(o.id, o); return o; }

  boxesNear(x, z) {
    const out = [];
    const ccx = Math.floor(x / CHUNK), ccz = Math.floor(z / CHUNK);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      for (const f of this.chunk(ccx + i, ccz + j).furn) if (!this.removed.has(f.id)) out.push(f.box);
    }
    for (const p of this.placed.values()) if (Math.abs(p.x - x) < 20 && Math.abs(p.z - z) < 20) out.push(p.box);
    return out;
  }

  // push a circle (pos.x, pos.z, radius) out of boxes taller than the step height
  collide(pos, rad, y = 0) {
    const boxes = this.boxesNear(pos.x, pos.z);
    for (let iter = 0; iter < 2; iter++) for (const b of boxes) {
      if (b.h <= y + 0.45) continue;
      const cx = Math.max(b.x0, Math.min(pos.x, b.x1)), cz = Math.max(b.z0, Math.min(pos.z, b.z1));
      const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= rad * rad) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2); pos.x += dx / d * (rad - d); pos.z += dz / d * (rad - d); }
      else {
        const pen = [[pos.x - b.x0 + rad, -1, 0], [b.x1 - pos.x + rad, 1, 0], [pos.z - b.z0 + rad, 0, -1], [b.z1 - pos.z + rad, 0, 1]].sort((a, c) => a[0] - c[0])[0];
        pos.x += pen[1] * pen[0]; pos.z += pen[2] * pen[0];
      }
    }
    return boxes;
  }
  groundAt(x, z, y, rad = 0.3, boxes = null) {
    let g = 0;
    for (const b of boxes || this.boxesNear(x, z)) {
      if (b.h > y + 0.45) continue;
      if (x > b.x0 - rad && x < b.x1 + rad && z > b.z0 - rad && z < b.z1 + rad) g = Math.max(g, b.h);
    }
    return g;
  }
  isFree(x, z, rad = 0.6) {
    return !this.boxesNear(x, z).some(b => x > b.x0 - rad && x < b.x1 + rad && z > b.z0 - rad && z < b.z1 + rad);
  }
}
export function overlap(a, b, m = 0) { return a.x0 - m < b.x1 && a.x1 + m > b.x0 && a.z0 - m < b.z1 && a.z1 + m > b.z0; }
