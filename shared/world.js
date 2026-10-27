// Shared deterministic world generation, navigation and collision (server + client).
export const VERSION = '2.1.0';
export const CHUNK = 24;
export const CEIL = 6;
export const CYCLE = 600;   // seconds per day
export const DAY = 380;     // first DAY seconds are daytime
export const isNight = (t) => t >= DAY;

import { hash, rng } from './rng.js';
import { TYPES, localParts } from './furniture.js';
export { hash, rng, TYPES, localParts };

export const ITEMS = {
  meatballs: { name: 'Meatballs', food: 30, w: 5 },
  hotdog: { name: 'Hot Dog', food: 22, w: 5 },
  pizza: { name: 'Pizza Slice', food: 26, w: 4 },
  chips: { name: 'Chips', food: 12, w: 5 },
  salad: { name: 'Salad', food: 16, heal: 5, w: 3 },
  cake: { name: 'Cake', food: 40, w: 2 },
  juice: { name: 'Juice', food: 6, energy: 25, w: 4 },
  soda: { name: 'Soda', food: 4, energy: 30, w: 4 },
  water: { name: 'Water', energy: 15, heal: 3, w: 4 },
  coffee: { name: 'Coffee', energy: 50, w: 2 },
  meal: { name: 'Cooked Meal', food: 75, heal: 15, w: 0 },
  medkit: { name: 'Medkit', heal: 60, w: 1.5 },
  bandage: { name: 'Bandage', heal: 30, w: 0 },
  cloth: { name: 'Cloth', mat: true, w: 4 },
  scrap: { name: 'Scrap Metal', mat: true, w: 4 },
  plank: { name: 'Plank', mat: true, w: 4 },
  bat: { name: 'Bat', weapon: true, dmg: 26, range: 2.4, cd: 600, dur: 45, kb: 1.2, w: 1 },
  pipe: { name: 'Pipe', weapon: true, dmg: 32, range: 2.2, cd: 750, dur: 60, kb: 1.0, w: 1 },
  crowbar: { name: 'Crowbar', weapon: true, dmg: 38, range: 2.0, cd: 850, dur: 80, kb: 1.4, w: 0.6 },
  spear: { name: 'Spear', weapon: true, dmg: 34, range: 3.2, cd: 700, dur: 50, kb: 0.8, w: 0 },
  nailbat: { name: 'Nail Bat', weapon: true, dmg: 44, range: 2.4, cd: 650, dur: 60, kb: 1.6, w: 0 },
};
export const FISTS = { name: 'Fists', dmg: 8, range: 1.8, cd: 450, kb: 0.6 };
export const RECIPES = [
  { id: 'bandage', name: 'Bandage', needs: { cloth: 2 }, gives: 'bandage' },
  { id: 'meal', name: 'Cooked Meal', needs: { meatballs: 1, hotdog: 1 }, gives: 'meal', stove: true },
  { id: 'meal2', name: 'Cooked Meal (pizza)', needs: { pizza: 1, salad: 1 }, gives: 'meal', stove: true },
  { id: 'spear', name: 'Spear', needs: { pipe: 1, scrap: 1 }, gives: 'spear' },
  { id: 'nailbat', name: 'Nail Bat', needs: { bat: 1, scrap: 1 }, gives: 'nailbat' },
  { id: 'barricade', name: 'Barricade', needs: { plank: 2, scrap: 1 }, carry: 'barricade' },
  { id: 'claim', name: 'Claim Flag', needs: { plank: 1, cloth: 1 }, carry: 'claim' },
];
const pool = (filter) => Object.entries(ITEMS).filter(([k, v]) => v.w > 0 && filter(v)).flatMap(([k, v]) => Array(Math.round(v.w * 4)).fill(k));
const ITEM_POOL = pool(() => true), FOOD_POOL = pool(v => v.food || v.energy);

export const ZONES = {
  aisles: { name: 'Market Hall', w: 10, floor: 0xb9b3a3 },
  bedrooms: { name: 'Bedrooms', w: 8, floor: 0xc8b8a0 },
  living: { name: 'Living Rooms', w: 8, floor: 0xbfae94 },
  dining: { name: 'Dining', w: 6, floor: 0xc4b49a },
  kitchen: { name: 'Kitchens', w: 7, floor: 0xd0d0cc },
  bathroom: { name: 'Bathrooms', w: 6, floor: 0xc6d4dc },
  office: { name: 'Workspaces', w: 6, floor: 0xa9aeb5 },
  warehouse: { name: 'Self-Serve Warehouse', w: 5, floor: 0x9c9a94 },
  displays: { name: 'Showroom', w: 5, floor: 0xbcb6a8 },
  mixed: { name: 'Bargain Corner', w: 6, floor: 0xb5ad9c },
  cafeteria: { name: 'Restaurant', w: 3, floor: 0xd6c7a8 },
  kids: { name: 'Kids Land', w: 3, floor: 0xb8d0b0 },
  checkout: { name: 'Checkout', w: 3, floor: 0xc0c0c8 },
  clock: { name: 'The Clock Atrium', w: 0.8, floor: 0xd8d0c0, special: true },
  fountain: { name: 'Fountain Court', w: 0.8, floor: 0xd0d8dc, special: true },
};
const ZONE_POOL = Object.entries(ZONES).flatMap(([k, v]) => Array(Math.round(v.w * 5)).fill(k));

export function rotXZ(x, z, rot) {
  switch (rot & 3) { case 0: return [x, z]; case 1: return [z, -x]; case 2: return [-x, -z]; default: return [-z, x]; }
}
// Parts plus the owning object's placement (X, Z, yaw Y). Rendering composes the transforms.
export function worldParts(f) {
  const Y = (f.rot & 3) * Math.PI / 2;
  return localParts(f.type, f.c).map(p => ({ ...p, X: f.x, Z: f.z, Y }));
}
export function aabb(f) {
  const t = TYPES[f.type]; const odd = f.rot & 1;
  const hw = (odd ? t.d : t.w) / 2, hd = (odd ? t.w : t.d) / 2;
  return { x0: f.x - hw, x1: f.x + hw, z0: f.z - hd, z1: f.z + hd, h: t.h, walk: !!t.walk, f };
}
export function overlap(a, b, m = 0) { return a.x0 - m < b.x1 && a.x1 + m > b.x0 && a.z0 - m < b.z1 && a.z1 + m > b.z0; }

// ---------------- binary heap for A* ----------------
class Heap {
  constructor() { this.a = []; }
  push(n) { const a = this.a; a.push(n); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; }
  get size() { return this.a.length; }
}

export class World {
  constructor(seed) { this.seed = seed | 0; this.cache = new Map(); this.removed = new Set(); this.placed = new Map(); this.placedCells = new Map(); }

  chunk(cx, cz) {
    const key = cx + ',' + cz;
    let ch = this.cache.get(key);
    if (ch) return ch;
    if (this.cache.size > 3000) this.cache.clear();
    ch = this.gen(cx, cz); this.cache.set(key, ch);
    return ch;
  }
  zoneAt(x, z) { return this.chunk(Math.floor(x / CHUNK), Math.floor(z / CHUNK)).zone; }

  gen(cx, cz) {
    const r = rng(hash(this.seed, cx, cz));
    const ox = cx * CHUNK, oz = cz * CHUNK;
    const furn = [];
    const add = (type, x, z, rot = 0) => { const f = { id: `${cx}_${cz}_${furn.length}`, type, x: ox + x, z: oz + z, rot: rot & 3, c: (r() * 1e9) | 0 }; furn.push(f); return f; };
    const maybe = (p, fn) => { if (r() < p) fn(); };
    add('pillar', 0.5, 0.5);
    // spawn area near origin is always a gentle zone
    let zone = (Math.abs(cx) <= 0 && Math.abs(cz) <= 0) ? 'living' : ZONE_POOL[(r() * ZONE_POOL.length) | 0];
    switch (zone) {
      case 'aisles': {
        const vertical = r() < 0.5;
        for (let a = 4; a <= 20; a += 4) for (let b = 5; b <= 20; b += 5) maybe(0.85, () => vertical ? add('shelf', a, b, 1) : add('shelf', b, a, 0));
        break;
      }
      case 'bedrooms':
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
          const x = 5 + i * 7, z = 6 + j * 9;
          if (r() < 0.3) add('bunkbed', x, z, 0); else add('bed', x, z, 0);
          maybe(0.7, () => add('lamp', x + 1.6, z - 0.9)); maybe(0.5, () => add('wardrobe', x, z - 2.5, 0));
          maybe(0.5, () => add('rug', x, z + 2.2, 0)); maybe(0.3, () => add('plant', x - 1.6, z - 1));
        }
        break;
      case 'living':
        for (const [x, z] of [[6, 6], [17, 6], [6, 17], [17, 17]]) {
          add('rug', x, z - 0.3, 0); add('sofa', x, z - 1.6, 0); add('table', x, z, 0);
          maybe(0.7, () => add('tv', x, z + 2.2, 2)); maybe(0.6, () => add('chair', x + 1.6, z + 0.2, 3)); maybe(0.6, () => add('lamp', x + 1.8, z - 1.8)); maybe(0.5, () => add('plant', x - 1.8, z - 1.8));
        }
        break;
      case 'dining':
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
          const x = 5 + i * 7, z = 5 + j * 7; add('table', x, z, 0);
          add('chair', x - 0.4, z - 0.85, 0); add('chair', x + 0.4, z - 0.85, 0); add('chair', x - 0.4, z + 0.85, 2); add('chair', x + 0.4, z + 0.85, 2);
        }
        break;
      case 'kitchen':
        for (const z of [4, 12, 20]) {
          let x = 4;
          for (const t of ['fridge', 'counter', 'stove', 'counter', 'counter']) { const w = TYPES[t].w; add(t, x + w / 2, z, 0); x += w; }
          maybe(0.7, () => add('table', 9, z + 3, 0)); maybe(0.5, () => add('plant', 18, z + 2));
        }
        break;
      case 'bathroom':
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
          const x = 4 + i * 7, z = 5 + j * 10;
          add('bathtub', x + 1, z, 0); add('toilet', x + 3, z, 0); add('sink', x + 4.2, z - 0.1, 0);
          maybe(0.6, () => add('rug', x + 2, z + 1.6, 0)); maybe(0.4, () => add('plant', x + 5.2, z));
        }
        break;
      case 'office':
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
          const x = 5 + i * 6.5, z = 5 + j * 6.5;
          add('desk', x, z, 0); add('officechair', x + 0.1, z + 0.8, 2); maybe(0.4, () => add('bookshelf', x, z - 1.8, 0)); maybe(0.3, () => add('plant', x + 1.4, z - 1));
        }
        break;
      case 'warehouse':
        for (let a = 4; a <= 20; a += 5.5) for (let b = 5; b <= 20; b += 5) maybe(0.9, () => add('rack', b, a, 0));
        break;
      case 'cafeteria':
        add('foodcounter', 6, 3, 0); add('foodcounter', 10, 3, 0); add('foodcounter', 14, 3, 0);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const x = 6 + i * 6, z = 10 + j * 7; add('table', x, z, 0); add('chair', x, z - 0.85, 0); add('chair', x, z + 0.85, 2); }
        add('plant', 20, 4);
        break;
      case 'kids':
        add('ballpit', 7, 7, 0); add('slide', 16, 7, (r() * 4) | 0); add('rug', 7, 15, 0); add('rug', 16, 16, 1);
        for (let i = 0; i < 4; i++) add('toybox', 4 + i * 4.5, 20, 0);
        break;
      case 'checkout':
        for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) add('register', 4 + i * 5, 7 + j * 9, 0);
        break;
      case 'displays':
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) maybe(0.55, () => add('display', 4.5 + i * 5, 4.5 + j * 5));
        break;
      case 'clock':
        add('clocktower', 12, 12, 0); for (const [x, z] of [[8, 8], [16, 8], [8, 16], [16, 16]]) add('plant', x, z);
        break;
      case 'fountain':
        add('fountain', 12, 12, 0); for (const [x, z] of [[7, 12], [17, 12]]) add('chair', x, z, 1); for (const [x, z] of [[12, 7], [12, 17]]) add('plant', x, z);
        break;
      default: { // mixed
        const types = ['sofa', 'table', 'wardrobe', 'bed', 'lamp', 'chair', 'shelf', 'bookshelf', 'tv', 'plant', 'fridge', 'desk', 'bunkbed'];
        for (let n = 0; n < 12; n++) {
          const t = types[(r() * types.length) | 0], x = 4 + r() * 16, z = 4 + r() * 16, rot = (r() * 4) | 0;
          const cand = aabb({ type: t, x: ox + x, z: oz + z, rot });
          if (!furn.some(f => overlap(aabb(f), cand, 0.7))) add(t, x, z, rot);
        }
      }
    }
    if (r() < 0.4 || ZONES[zone].special) { const s = add('sign', 2, 12); s.text = ZONES[zone].name.toUpperCase(); }
    for (const f of furn) f.box = aabb(f);
    // items
    const items = [];
    const n = 1 + ((r() * 4) | 0) + (zone === 'cafeteria' ? 4 : 0) + (zone === 'warehouse' ? 1 : 0);
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 8; tries++) {
        const x = ox + 1.5 + r() * 21, z = oz + 1.5 + r() * 21;
        if (furn.some(f => !f.box.walk && x > f.box.x0 - 0.4 && x < f.box.x1 + 0.4 && z > f.box.z0 - 0.4 && z < f.box.z1 + 0.4)) continue;
        const pl = zone === 'cafeteria' || (zone === 'kitchen' && r() < 0.5) ? FOOD_POOL : ITEM_POOL;
        items.push({ id: `i_${cx}_${cz}_${i}`, type: pl[(r() * pl.length) | 0], x, z }); break;
      }
    }
    return { cx, cz, zone, furn, items };
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
  markRemoved(id) {
    this.removed.add(id);
    const m = /^(-?\d+)_(-?\d+)_/.exec(id); if (m) { const ch = this.cache.get(m[1] + ',' + m[2]); if (ch) ch.nav = null; }
  }
  cellsOf(box, pad = 0.25) {
    const out = [];
    for (let x = Math.floor(box.x0 - pad); x <= Math.floor(box.x1 + pad); x++) for (let z = Math.floor(box.z0 - pad); z <= Math.floor(box.z1 + pad); z++)
      if (x + 0.5 > box.x0 - pad && x + 0.5 < box.x1 + pad && z + 0.5 > box.z0 - pad && z + 0.5 < box.z1 + pad) out.push(x + ',' + z);
    return out;
  }
  addPlaced(o) {
    o.box = aabb(o); this.placed.set(o.id, o);
    if (!o.box.walk) for (const k of this.cellsOf(o.box)) { let s = this.placedCells.get(k); if (!s) this.placedCells.set(k, s = new Set()); s.add(o.id); }
    return o;
  }
  removePlaced(id) {
    const o = this.placed.get(id); if (!o) return null;
    this.placed.delete(id);
    for (const k of this.cellsOf(o.box)) { const s = this.placedCells.get(k); if (s) { s.delete(id); if (!s.size) this.placedCells.delete(k); } }
    return o;
  }

  boxesNear(x, z, rad = 1) {
    const out = [];
    const ccx = Math.floor(x / CHUNK), ccz = Math.floor(z / CHUNK);
    for (let i = -rad; i <= rad; i++) for (let j = -rad; j <= rad; j++)
      for (const f of this.chunk(ccx + i, ccz + j).furn) if (!this.removed.has(f.id)) out.push(f.box);
    const lim = CHUNK * (rad + 1);
    for (const p of this.placed.values()) if (Math.abs(p.x - x) < lim && Math.abs(p.z - z) < lim) out.push(p.box);
    return out;
  }

  collide(pos, rad, y = 0, boxes = null) {
    boxes = boxes || this.boxesNear(pos.x, pos.z);
    for (let iter = 0; iter < 2; iter++) for (const b of boxes) {
      if (b.walk || b.h <= y + 0.45) continue;
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
      if (b.walk || b.h > y + 0.45) continue;
      if (x > b.x0 - rad && x < b.x1 + rad && z > b.z0 - rad && z < b.z1 + rad) g = Math.max(g, b.h);
    }
    return g;
  }
  isFree(x, z, rad = 0.6) {
    return !this.boxesNear(x, z).some(b => !b.walk && x > b.x0 - rad && x < b.x1 + rad && z > b.z0 - rad && z < b.z1 + rad);
  }
  canPlace(box, ignoreId = null) {
    return !this.boxesNear((box.x0 + box.x1) / 2, (box.z0 + box.z1) / 2).some(b => b.f.id !== ignoreId && !b.walk && !box.walk && overlap(b, box, -0.02));
  }

  // ---- navigation (1m grid) ----
  navGrid(cx, cz) {
    const ch = this.chunk(cx, cz);
    if (ch.nav) return ch.nav;
    const g = new Uint8Array(CHUNK * CHUNK), ox = cx * CHUNK, oz = cz * CHUNK;
    for (const f of ch.furn) {
      if (this.removed.has(f.id) || f.box.walk || f.box.h <= 0.45) continue;
      for (const k of this.cellsOf(f.box)) {
        const [x, z] = k.split(',').map(Number), lx = x - ox, lz = z - oz;
        if (lx >= 0 && lx < CHUNK && lz >= 0 && lz < CHUNK) g[lz * CHUNK + lx] = 1;
      }
    }
    return ch.nav = g;
  }
  // 1 = free, >1 = barricade (breakable), Infinity = blocked
  cellCost(ix, iz) {
    const cx = Math.floor(ix / CHUNK), cz = Math.floor(iz / CHUNK);
    if (this.navGrid(cx, cz)[(iz - cz * CHUNK) * CHUNK + (ix - cx * CHUNK)]) return Infinity;
    const s = this.placedCells.get(ix + ',' + iz);
    if (s) { for (const id of s) if (this.placed.get(id)?.type !== 'barricade') return Infinity; return 12; }
    return 1;
  }
  lineClear(x0, z0, x1, z1) {
    const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 0.4);
    for (let i = 1; i < n; i++) { const t = i / n; if (this.cellCost(Math.floor(x0 + (x1 - x0) * t), Math.floor(z0 + (z1 - z0) * t)) !== 1) return false; }
    return true;
  }
  findPath(sx, sz, tx, tz, maxNodes = 2500) {
    const s = [Math.floor(sx), Math.floor(sz)], t = [Math.floor(tx), Math.floor(tz)];
    const K = (x, z) => x * 100003 + z;
    const h = (x, z) => { const dx = Math.abs(x - t[0]), dz = Math.abs(z - t[1]); return Math.max(dx, dz) + 0.41 * Math.min(dx, dz); };
    const open = new Heap(), g = new Map(), came = new Map();
    g.set(K(s[0], s[1]), 0); open.push([h(s[0], s[1]), s[0], s[1]]);
    let best = s, bestH = h(s[0], s[1]), n = 0;
    while (open.size && n++ < maxNodes) {
      const [, x, z] = open.pop(), kc = K(x, z), gc = g.get(kc);
      if (x === t[0] && z === t[1]) { best = t; break; }
      const hc = h(x, z); if (hc < bestH) { bestH = hc; best = [x, z]; }
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue;
        const nx = x + dx, nz = z + dz;
        let c = (nx === t[0] && nz === t[1]) ? 1 : this.cellCost(nx, nz);
        if (c === Infinity) continue;
        if (dx && dz && (this.cellCost(x + dx, z) === Infinity || this.cellCost(x, z + dz) === Infinity)) continue;
        const ng = gc + c * (dx && dz ? 1.414 : 1), kn = K(nx, nz);
        if (ng < (g.get(kn) ?? Infinity)) { g.set(kn, ng); came.set(kn, [x, z]); open.push([ng + h(nx, nz), nx, nz]); }
      }
    }
    const path = []; let cur = best;
    while (cur && !(cur[0] === s[0] && cur[1] === s[1])) { path.push([cur[0] + 0.5, cur[1] + 0.5]); cur = came.get(K(cur[0], cur[1])); }
    return path.reverse();
  }
}

export const levelOf = (xp) => Math.floor(Math.sqrt(xp / 40)) + 1;
