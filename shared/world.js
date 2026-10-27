// Shared deterministic world generation, navigation and collision (server + client).
export const VERSION = '2.3.0';
export const CHUNK = 24;
export const CEIL = 6;
// Day/night lengths follow the Roblox 3008 wiki: a Day (and Foggy Day) lasts 6 minutes, a Night (and Blood Night) 5 minutes.
export const DAY = 360;     // first DAY seconds of a cycle are daytime
export const NIGHT = 300;
export const CYCLE = DAY + NIGHT;
export const isNight = (t) => t >= DAY;
export const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const weekday = (d) => WEEK[(((d - 1) % 7) + 7) % 7];
export const isRestockDay = (d) => { const w = weekday(d); return w === 'Monday' || w === 'Friday'; };

import { hash, rng } from './rng.js';
import { TYPES, localParts } from './furniture.js';
export { hash, rng, TYPES, localParts };

// Special days (wiki): a Foggy Day happens every 15th day or with a 1% chance; a Blood Night every 10th night or with a 5% chance.
export function dayInfo(seed, d) {
  const r = rng(hash(seed | 0, d | 0, 0x3008));
  const fog = d > 1 && (d % 15 === 0 || r() < 0.01);
  const blood = d % 10 === 0 || (d > 1 && r() < 0.05);
  return { day: d, weekday: weekday(d), fog, blood, restock: isRestockDay(d) };
}

// Consumables use the values from the wiki's Consumables table (food = hunger, energy, heal = health; negative values hurt).
// cons: true -> restocks on in-game Mondays and Fridays instead of respawning on a timer.
export const ITEMS = {
  apple: { name: 'Apple', heal: 5, energy: 6, food: 12, cons: true },
  banana: { name: 'Banana', heal: 5, energy: 6, food: 14, cons: true },
  beans: { name: 'Beans', heal: -10, energy: 5, food: 18, cons: true },
  burger: { name: 'Burger', energy: 6, food: 20, cons: true },
  chips: { name: 'Chips', energy: 4, food: 10, cons: true },
  chocolate: { name: 'The Good Chocolate', energy: 18, food: 15, cons: true, rare: true },
  cookie: { name: 'Cookie', energy: 8, food: 8, cons: true },
  fishcrackers: { name: 'Fish Crackers', energy: 2, food: 18, cons: true },
  hotdog: { name: 'Hot Dog', energy: 3, food: 18, cons: true },
  icecream: { name: 'Ice Cream', energy: 13, food: 6, cons: true },
  lemon: { name: 'Lemon', heal: 4, energy: 10, food: 10, cons: true },
  lemonslice: { name: 'Lemon Slice', heal: 2, energy: 5, food: 5, cons: true },
  meatballs: { name: 'Meatballs', energy: 6, food: 30, cons: true },
  pizza: { name: 'Pizza Slice', energy: 2, food: 5, cons: true },
  donut: { name: 'Striped Donut', energy: 15, food: 9, cons: true },
  cola2l: { name: '2 Litre Cola', heal: -5, energy: 23, cons: true },
  soda: { name: 'Soda Can', energy: 17, cons: true },
  cola: { name: 'Cola Bottle', energy: 17, cons: true },
  water: { name: 'Water', heal: 3, energy: 12, cons: true },
  cake: { name: 'Cake', energy: 15, food: 20, cons: true, rare: true },
  candycorn: { name: 'Candy Corn', heal: 1, energy: 3, food: 2, cons: true, rare: true },
  glass: { name: 'Glass Shard', heal: -33, cons: true },
  medkit: { name: 'Medkit', heal: 30, healTime: 2, cons: true },
  // this game's own extras (not in the original): crafting materials, crafted food and improvised tools
  meal: { name: 'Cooked Meal', food: 45, energy: 10, heal: 10 },
  bandage: { name: 'Bandage', heal: 15 },
  cloth: { name: 'Cloth', mat: true, w: 4 },
  scrap: { name: 'Scrap Metal', mat: true, w: 4 },
  plank: { name: 'Plank', mat: true, w: 4 },
  bat: { name: 'Bat', weapon: true, dmg: 26, range: 2.4, cd: 600, dur: 45, kb: 1.2, w: 1 },
  pipe: { name: 'Pipe', weapon: true, dmg: 32, range: 2.2, cd: 750, dur: 60, kb: 1.0, w: 1 },
  crowbar: { name: 'Crowbar', weapon: true, dmg: 38, range: 2.0, cd: 850, dur: 80, kb: 1.4, w: 0.4 },
  spear: { name: 'Spear', weapon: true, dmg: 34, range: 3.2, cd: 700, dur: 50, kb: 0.8, w: 0 },
  nailbat: { name: 'Nail Bat', weapon: true, dmg: 44, range: 2.4, cd: 650, dur: 60, kb: 1.6, w: 0 },
};
// Empty hands = the original's left-click shove: little damage, strong knock-back and a short stun.
export const FISTS = { name: 'Shove', dmg: 6, range: 1.9, cd: 450, kb: 1.8, stun: 900 };
export const RECIPES = [
  { id: 'bandage', name: 'Bandage', needs: { cloth: 2 }, gives: 'bandage' },
  { id: 'meal', name: 'Cooked Meal', needs: { meatballs: 1, hotdog: 1 }, gives: 'meal', stove: true },
  { id: 'meal2', name: 'Cooked Meal (pizza)', needs: { pizza: 2, chips: 1 }, gives: 'meal', stove: true },
  { id: 'spear', name: 'Spear', needs: { pipe: 1, scrap: 1 }, gives: 'spear' },
  { id: 'nailbat', name: 'Nail Bat', needs: { bat: 1, scrap: 1 }, gives: 'nailbat' },
  { id: 'barricade', name: 'Barricade', needs: { plank: 2, scrap: 1 }, carry: 'barricade' },
  { id: 'claim', name: 'Claim Flag', needs: { plank: 1, cloth: 1 }, carry: 'claim' },
];
const pool = (filter) => Object.entries(ITEMS).filter(([k, v]) => v.w > 0 && filter(v)).flatMap(([k, v]) => Array(Math.round(v.w * 4)).fill(k));
const ITEM_POOL = pool(() => true);
// Plot loot tables (wiki "List of Consumable-spawning plots"). Cafeteria counts are exact.
const CAFETERIA_LOOT = { burger: 6, hotdog: 2, cola2l: 3, chips: 10, beans: 1, donut: 1, soda: 4, meatballs: 3, banana: 5, apple: 2, lemon: 2, pizza: 8, water: 5, medkit: 1 };
const expand = (o) => Object.entries(o).flatMap(([k, n]) => Array(n).fill(k));

export const ZONES = {
  aisles: { name: 'Market Hall', w: 10, floor: 0xb9b3a3 },
  bedrooms: { name: 'Bedrooms', w: 8, floor: 0xc8b8a0 },
  living: { name: 'Living Rooms', w: 8, floor: 0xbfae94 },
  dining: { name: 'Dining', w: 6, floor: 0xc4b49a },
  kitchen: { name: 'Kitchens', w: 7, floor: 0xd0d0cc },
  bathroom: { name: 'Bathrooms', w: 6, floor: 0xc6d4dc },
  office: { name: 'Workspaces', w: 6, floor: 0xa9aeb5 },
  warehouse: { name: 'Industrial Shelves', w: 5, floor: 0x9c9a94 },
  displays: { name: 'Showroom', w: 5, floor: 0xbcb6a8 },
  mixed: { name: 'Bargain Corner', w: 6, floor: 0xb5ad9c },
  cafeteria: { name: 'Cafeteria', w: 2.4, floor: 0xd6c7a8 },
  kids: { name: 'Play Plot', w: 2, floor: 0xb8d0b0 },
  snack: { name: 'Snack Shop', w: 2, floor: 0xd8c9b0 },
  pharmacy: { name: 'Pharmacy', w: 2.5, floor: 0xdfe6e8 },
  greenhouse: { name: 'Greenhouse', w: 1.6, floor: 0xa8b89a },
  infobooth: { name: 'Information Booth', w: 0.8, floor: 0xc9c2b2, special: true },
  checkout: { name: 'Checkout', w: 3, floor: 0xc0c0c8 },
  clock: { name: 'The Atrium', w: 0.8, floor: 0xd8d0c0, special: true },
  fountain: { name: 'Fountain Court', w: 0.8, floor: 0xd0d8dc, special: true },
};
const ZONE_POOL = Object.entries(ZONES).flatMap(([k, v]) => Array(Math.round(v.w * 5)).fill(k));

export function rotXZ(x, z, rot) {
  switch (rot & 3) { case 0: return [x, z]; case 1: return [z, -x]; case 2: return [-x, -z]; default: return [-z, x]; }
}
// Parts plus the owning object's placement (X, Z, yaw Y). Rendering composes the transforms.
export function worldParts(f) {
  const Y = (f.rot & 3) * Math.PI / 2;
  const yo = f.y || 0;
  return localParts(f.type, f.c).map(p => ({ ...p, y: p.y + yo, X: f.x, Z: f.z, Y }));
}
export function aabb(f) {
  const t = TYPES[f.type]; const odd = f.rot & 1;
  const hw = (odd ? t.d : t.w) / 2, hd = (odd ? t.w : t.d) / 2;
  const y0 = f.y || 0;
  return { x0: f.x - hw, x1: f.x + hw, z0: f.z - hd, z1: f.z + hd, y0, h: y0 + t.h, walk: !!t.walk, f };
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
        for (let i = 0; i < 6; i++) add('pallet', 2.5 + i * 3.4, 22.2, (r() * 2) | 0);
        maybe(0.8, () => add('worklight', 21.5, 1.8, 0));
        break;
      case 'cafeteria':
        add('foodcounter', 6, 3, 0); add('foodcounter', 10, 3, 0); add('foodcounter', 14, 3, 0);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const x = 6 + i * 6, z = 10 + j * 7; add('table', x, z, 0); add('chair', x, z - 0.85, 0); add('chair', x, z + 0.85, 2); }
        add('plant', 20, 4);
        break;
      case 'snack':
        add('counter', 8, 4, 0); add('counter', 10, 4, 0); add('fridge', 12.35, 4, 0); add('fridge', 13.05, 4, 0);
        for (const [x, z] of [[7, 11], [12, 11], [17, 11], [7, 17], [12, 17], [17, 17]]) { add('table', x, z, 0); add('chair', x, z - 0.85, 0); }
        break;
      case 'pharmacy':
        for (let i = 0; i < 4; i++) add('medstation', 5 + i * 4.5, 3, 0);
        for (let i = 0; i < 3; i++) add('shelf', 7 + i * 5, 12, 0);
        add('register', 12, 19, 2);
        break;
      case 'greenhouse':
        for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) maybe(0.8, () => add(r() < 0.3 ? 'tree' : 'plant', 4 + i * 4, 4 + j * 5));
        break;
      case 'infobooth':
        add('infodesk', 12, 12, 0); for (const [x, z] of [[10.5, 14], [13.5, 14]]) add('chair', x, z, 2); add('plant', 8, 9); add('plant', 16, 9);
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
    const put = (type, x, z, y = 0) => items.push({ id: `i_${cx}_${cz}_${items.length}`, type, x: ox + x, z: oz + z, ...(y ? { y } : {}) });
    const floorSpot = () => {
      for (let tries = 0; tries < 8; tries++) {
        const x = ox + 1.5 + r() * 21, z = oz + 1.5 + r() * 21;
        if (furn.some(f => !f.box.walk && x > f.box.x0 - 0.4 && x < f.box.x1 + 0.4 && z > f.box.z0 - 0.4 && z < f.box.z1 + 0.4)) continue;
        return [x - ox, z - oz];
      }
      return null;
    };
    // lay a list of items in rows along the top of some furniture
    const onTop = (list, hosts, rows = 2) => {
      let k = 0;
      for (const f of hosts) {
        const t = TYPES[f.type], per = Math.max(1, Math.floor(t.w / 0.36));
        for (let row = 0; row < rows; row++) for (let i = 0; i < per && k < list.length; i++, k++) {
          const along = -t.w / 2 + (i + 0.5) * t.w / per, across = rows > 1 ? (row - (rows - 1) / 2) * t.d * 0.5 : 0;
          const [dx, dz] = rotXZ(along, across, f.rot);
          put(list[k], f.x - ox + dx, f.z - oz + dz, t.h);
        }
      }
      return k;
    };
    const host = (type) => furn.filter(f => f.type === type);
    if (zone === 'cafeteria') onTop(expand(CAFETERIA_LOOT), [...host('foodcounter'), ...host('table')]);
    else if (zone === 'snack') onTop([...expand({ icecream: 3, cola: 2 }), ...(r() < 0.5 ? ['cookie'] : [])], host('counter'));
    else if (zone === 'pharmacy') onTop(expand({ medkit: 4 }), host('medstation'), 1);
    else if (zone === 'kids') { onTop(expand({ apple: 3 }), host('toybox'), 1); if (r() < 0.5) { const s = floorSpot(); if (s) put('fishcrackers', ...s); } }
    else if (zone === 'greenhouse') { for (let i = 0; i < 4; i++) { const s = floorSpot(); if (s) put('glass', ...s); } }
    else if (zone === 'kitchen') onTop(['lemon', 'lemonslice', 'water', 'hotdog', 'cookie', 'pizza'].filter(() => r() < 0.45), host('counter'));
    else if (zone === 'infobooth') { if (r() < 0.35) onTop(['chocolate'], host('infodesk'), 1); }
    else if (zone === 'warehouse') { const s = floorSpot(); if (s) put('crowbar', ...s); }
    if (zone === 'dining' && r() < 0.06) onTop(['cake'], host('table'), 1);
    // scattered crafting materials / improvised tools (this game's extras)
    const n = (r() * 3) | 0;
    for (let i = 0; i < n; i++) { const s = floorSpot(); if (s) put(ITEM_POOL[(r() * ITEM_POOL.length) | 0], ...s); }
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
      if (b.walk || b.h <= y + 0.45 || b.y0 >= y + 1.75) continue;
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
    if (box.h > CEIL + 0.01) return false;
    return !this.boxesNear((box.x0 + box.x1) / 2, (box.z0 + box.z1) / 2).some(b => b.f.id !== ignoreId && !b.walk && !box.walk && overlap(b, box, -0.02) && b.h > box.y0 + 0.02 && b.y0 < box.h - 0.02);
  }
  // Height a piece would rest at if dropped here: on top of the highest thing under its footprint (stacking / building up).
  stackY(box, ignoreId = null) {
    let y = 0;
    if (box.walk) return 0;
    for (const b of this.boxesNear((box.x0 + box.x1) / 2, (box.z0 + box.z1) / 2)) if (b.f.id !== ignoreId && !b.walk && overlap(b, box, -0.05)) y = Math.max(y, b.h);
    return Math.round(y * 100) / 100;
  }
  // Is something resting on top of this box?
  supports(box) {
    for (const p of this.placed.values()) if (p.box !== box && !p.box.walk && overlap(p.box, box, -0.05) && Math.abs(p.box.y0 - box.h) < 0.05) return true;
    return false;
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
    if (s) { let blocked = false; for (const id of s) { const o = this.placed.get(id); if (!o || (o.y || 0) >= 1.8) continue; if (o.type !== 'barricade') return Infinity; blocked = true; } if (blocked) return 12; }
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
