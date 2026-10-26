// Shared deterministic world generation, navigation and collision (server + client).
export const VERSION = '2.0.0';
export const CHUNK = 24;
export const CEIL = 6;
export const CYCLE = 600;   // seconds per day
export const DAY = 380;     // first DAY seconds are daytime
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

// w,d = footprint, h = collision height. walk: no collision. fixed: cannot be picked up.
export const TYPES = {
  shelf: { w: 4, d: 1, h: 2.4, name: 'Shelf' },
  bookshelf: { w: 2, d: 0.5, h: 2.2, name: 'Bookshelf' },
  bed: { w: 2, d: 2.4, h: 0.6, name: 'Bed', bed: true },
  bunkbed: { w: 1.2, d: 2.2, h: 1.9, name: 'Bunk Bed', bed: true },
  sofa: { w: 2.4, d: 1, h: 0.9, name: 'Sofa' },
  table: { w: 1.6, d: 1, h: 0.8, name: 'Table' },
  desk: { w: 1.6, d: 0.8, h: 0.78, name: 'Desk' },
  chair: { w: 0.6, d: 0.6, h: 0.9, name: 'Chair' },
  officechair: { w: 0.6, d: 0.6, h: 1.1, name: 'Office Chair' },
  lamp: { w: 0.4, d: 0.4, h: 1.7, name: 'Lamp' },
  wardrobe: { w: 2, d: 0.8, h: 2.2, name: 'Wardrobe' },
  display: { w: 1.4, d: 1.4, h: 1, name: 'Display' },
  counter: { w: 2, d: 0.7, h: 0.95, name: 'Kitchen Counter' },
  stove: { w: 0.8, d: 0.7, h: 0.95, name: 'Stove', stove: true },
  fridge: { w: 0.9, d: 0.8, h: 2, name: 'Fridge' },
  toilet: { w: 0.5, d: 0.7, h: 0.8, name: 'Toilet' },
  bathtub: { w: 1.8, d: 0.8, h: 0.6, name: 'Bathtub' },
  sink: { w: 0.7, d: 0.5, h: 0.9, name: 'Sink' },
  tv: { w: 1.8, d: 0.5, h: 1.4, name: 'TV Stand' },
  plant: { w: 0.6, d: 0.6, h: 1.4, name: 'Plant' },
  rug: { w: 2.4, d: 1.6, h: 0.02, name: 'Rug', walk: true },
  rack: { w: 4, d: 1.2, h: 4.6, name: 'Warehouse Rack' },
  toybox: { w: 1, d: 0.6, h: 0.6, name: 'Toy Box' },
  slide: { w: 1, d: 3, h: 1.6, name: 'Slide' },
  ballpit: { w: 3, d: 3, h: 0.6, name: 'Ball Pit' },
  barricade: { w: 2, d: 0.4, h: 2.4, name: 'Barricade', hp: 300 },
  claim: { w: 0.4, d: 0.4, h: 2.4, name: 'Claim Flag' },
  foodcounter: { w: 3, d: 0.9, h: 1.1, name: 'Food Counter', fixed: true },
  register: { w: 1.6, d: 0.8, h: 1.1, name: 'Checkout', fixed: true },
  clocktower: { w: 3, d: 3, h: 6, name: 'Clock Tower', fixed: true },
  fountain: { w: 4, d: 4, h: 0.8, name: 'Fountain', fixed: true },
  pillar: { w: 1, d: 1, h: 6, name: 'Pillar', fixed: true },
  sign: { w: 0.2, d: 0.2, h: 3, name: 'Sign', fixed: true },
};

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

const WOODS = [0x8b5a2b, 0xc19a6b, 0x5c4033, 0xe0c9a6, 0x3b2a1e, 0xa0724a];
const FABRICS = [0x3b5b92, 0x8e3b46, 0x4f7942, 0x7a7a7a, 0xd9b44a, 0x2f2f3a, 0xb07fb5, 0xd88c5a, 0x5aa0a0];
const METALS = [0x9aa0a6, 0x4a90c2, 0xd0d0d0, 0x2e5e8e, 0x404448];
const BRIGHT = [0xe63946, 0xf4a261, 0x2a9d8f, 0xe9c46a, 0x457b9d, 0x9b5de5, 0x00bbf9];

// Parts in local space (rot 0): [x, yCenter, z, sx, sy, sz, color, mat]  mat: w wood, f fabric, m metal, p plain, e emissive
export function localParts(type, c) {
  const r = rng(c);
  const wood = WOODS[c % WOODS.length], fab = FABRICS[(c >> 3) % FABRICS.length], met = METALS[(c >> 6) % METALS.length];
  const pick = (a) => a[(r() * a.length) | 0];
  const P = [], B = (x, y, z, sx, sy, sz, col, m = 'p') => P.push([x, y, z, sx, sy, sz, col, m]);
  const legs = (hw, hd, h, s, col, m = 'w') => { for (const a of [-hw, hw]) for (const b of [-hd, hd]) B(a, h / 2, b, s, h, s, col, m); };
  switch (type) {
    case 'shelf':
      B(-1.95, 1.2, 0, 0.1, 2.4, 1, met, 'm'); B(1.95, 1.2, 0, 0.1, 2.4, 1, met, 'm'); B(0, 1.2, -0.47, 3.8, 2.4, 0.05, 0xb8b8b0, 'm');
      for (const y of [0.1, 0.85, 1.6, 2.35]) B(0, y, 0, 3.8, 0.07, 1, met, 'm');
      for (const y of [0.1, 0.85, 1.6]) for (let x = -1.5; x <= 1.5; x += 0.75) if (r() < 0.75) { const h = 0.25 + r() * 0.4; B(x, y + 0.035 + h / 2, 0.05, 0.6, h, 0.7, pick(BRIGHT) & 0xdddddd, r() < 0.5 ? 'p' : 'f'); }
      break;
    case 'bookshelf':
      B(-0.97, 1.1, 0, 0.06, 2.2, 0.5, wood, 'w'); B(0.97, 1.1, 0, 0.06, 2.2, 0.5, wood, 'w'); B(0, 1.1, -0.23, 1.9, 2.2, 0.04, wood, 'w');
      for (let i = 0; i < 5; i++) { const y = 0.05 + i * 0.52; B(0, y, 0, 1.9, 0.05, 0.5, wood, 'w');
        if (i < 4) for (let x = -0.85; x < 0.85;) { const bw = 0.05 + r() * 0.08, bh = 0.25 + r() * 0.2; if (r() < 0.85) B(x + bw / 2, y + 0.025 + bh / 2, 0.02, bw, bh, 0.36, pick(BRIGHT) & 0xbbbbbb, 'f'); x += bw + 0.01; } }
      break;
    case 'bed':
      B(0, 0.2, 0, 2, 0.3, 2.4, wood, 'w'); legs(0.9, 1.1, 0.1, 0.1, wood);
      B(0, 0.45, 0.05, 1.9, 0.2, 2.25, 0xf2f2ee, 'f'); B(-0.45, 0.6, -0.9, 0.75, 0.13, 0.35, 0xffffff, 'f'); B(0.45, 0.6, -0.9, 0.75, 0.13, 0.35, 0xffffff, 'f');
      B(0, 0.57, 0.35, 1.96, 0.06, 1.55, fab, 'f'); B(0, 0.65, -1.17, 2, 1.3, 0.08, wood, 'w'); B(0, 1.25, -1.17, 2.1, 0.08, 0.12, wood, 'w');
      break;
    case 'bunkbed':
      for (const a of [-0.55, 0.55]) for (const b of [-1.05, 1.05]) B(a, 0.95, b, 0.08, 1.9, 0.08, wood, 'w');
      for (const y of [0.3, 1.35]) { B(0, y, 0, 1.1, 0.1, 2.1, wood, 'w'); B(0, y + 0.12, 0, 1.05, 0.14, 2.0, fab, 'f'); B(0, y + 0.22, -0.8, 0.8, 0.1, 0.3, 0xffffff, 'f'); }
      B(0, 1.75, 0.6, 1.1, 0.06, 0.06, wood, 'w'); B(0, 1.75, -1.05, 1.1, 0.25, 0.04, wood, 'w');
      for (let y = 0.6; y < 1.4; y += 0.25) B(0.6, y, 0.9, 0.04, 0.04, 0.3, wood, 'w');
      break;
    case 'sofa':
      B(0, 0.12, 0.05, 2.3, 0.14, 0.85, 0x2a2a2a, 'p'); B(0, 0.3, 0.05, 2.4, 0.3, 0.9, fab, 'f'); B(0, 0.62, -0.36, 2.4, 0.7, 0.26, fab, 'f');
      B(-1.1, 0.5, 0.05, 0.2, 0.45, 0.9, fab, 'f'); B(1.1, 0.5, 0.05, 0.2, 0.45, 0.9, fab, 'f');
      B(-0.5, 0.5, 0.1, 0.95, 0.12, 0.7, fab, 'f'); B(0.5, 0.5, 0.1, 0.95, 0.12, 0.7, fab, 'f');
      if (r() < 0.6) B(-0.7, 0.7, -0.15, 0.4, 0.35, 0.12, pick(BRIGHT), 'f');
      break;
    case 'table':
      B(0, 0.76, 0, 1.6, 0.06, 1, wood, 'w'); legs(0.72, 0.42, 0.73, 0.07, wood);
      if (r() < 0.4) B(0, 0.85, 0, 0.12, 0.12, 0.12, 0xffffff, 'p');
      break;
    case 'desk':
      B(0, 0.76, 0, 1.6, 0.05, 0.8, wood, 'w'); B(-0.65, 0.37, 0, 0.3, 0.74, 0.76, 0xdddddd, 'p'); B(0.78, 0.37, 0, 0.04, 0.74, 0.76, 0xdddddd, 'p');
      for (const y of [0.2, 0.45, 0.65]) B(-0.65, y, 0.39, 0.25, 0.16, 0.01, 0xaaaaaa, 'm');
      if (r() < 0.75) { B(0.1, 0.8, -0.2, 0.2, 0.03, 0.15, 0x222222, 'p'); B(0.1, 0.98, -0.2, 0.04, 0.35, 0.04, 0x222222, 'p'); B(0.1, 1.15, -0.2, 0.7, 0.42, 0.04, 0x111111, 'p'); B(0.1, 1.15, -0.175, 0.64, 0.36, 0.01, 0x4a7fbf, 'e'); B(0.1, 0.79, 0.15, 0.5, 0.02, 0.16, 0x333333, 'p'); }
      break;
    case 'chair':
      B(0, 0.45, 0, 0.5, 0.06, 0.5, wood, 'w'); B(0, 0.78, -0.22, 0.5, 0.6, 0.05, wood, 'w'); B(0, 0.5, 0, 0.44, 0.04, 0.44, fab, 'f');
      legs(0.2, 0.2, 0.42, 0.05, wood);
      break;
    case 'officechair':
      B(0, 0.05, 0, 0.6, 0.05, 0.08, 0x222222, 'm'); B(0, 0.05, 0, 0.08, 0.05, 0.6, 0x222222, 'm'); B(0, 0.28, 0, 0.06, 0.45, 0.06, 0x555555, 'm');
      B(0, 0.52, 0, 0.55, 0.1, 0.52, fab, 'f'); B(0, 0.85, -0.24, 0.5, 0.6, 0.08, fab, 'f');
      break;
    case 'lamp':
      B(0, 0.03, 0, 0.35, 0.06, 0.35, 0x222222, 'm'); B(0, 0.8, 0, 0.05, 1.5, 0.05, 0x333333, 'm'); B(0, 1.55, 0, 0.44, 0.34, 0.44, 0xfff0c0, 'e');
      break;
    case 'wardrobe':
      B(0, 1.1, 0, 2, 2.2, 0.8, wood, 'w'); B(0, 1.1, 0.41, 0.03, 2.1, 0.02, 0x222222, 'p');
      B(-0.12, 1.1, 0.42, 0.04, 0.25, 0.04, met, 'm'); B(0.12, 1.1, 0.42, 0.04, 0.25, 0.04, met, 'm'); B(0, 0.05, 0, 2.02, 0.1, 0.82, 0x222222, 'p');
      break;
    case 'display':
      B(0, 0.5, 0, 1.4, 1, 1.4, 0xeeeeee, 'p'); B(0, 1.02, 0, 1.42, 0.04, 1.42, 0xcccccc, 'm'); B(0, 1.2, 0, 0.5, 0.35, 0.5, fab, 'f');
      break;
    case 'counter':
      B(0, 0.45, 0, 2, 0.85, 0.65, 0xf4f4f0, 'p'); B(0, 0.92, 0, 2.02, 0.06, 0.7, 0x3a3a3c, 'm');
      B(-0.5, 0.45, 0.33, 0.9, 0.75, 0.01, 0xe0e0dc, 'p'); B(0.5, 0.45, 0.33, 0.9, 0.75, 0.01, 0xe0e0dc, 'p');
      B(0.3, 0.93, 0, 0.6, 0.05, 0.4, 0x9aa0a6, 'm'); B(0.3, 1.1, -0.25, 0.04, 0.3, 0.04, 0xcccccc, 'm'); B(0.3, 1.24, -0.15, 0.04, 0.04, 0.2, 0xcccccc, 'm');
      B(0, 1.9, -0.18, 2, 0.7, 0.35, 0xf4f4f0, 'p');
      break;
    case 'stove':
      B(0, 0.46, 0, 0.8, 0.9, 0.68, 0xdadada, 'm'); B(0, 0.93, 0, 0.8, 0.04, 0.7, 0x111111, 'p');
      for (const a of [-0.2, 0.2]) for (const b of [-0.15, 0.15]) B(a, 0.955, b, 0.18, 0.01, 0.18, 0x552222, 'e');
      B(0, 0.45, 0.345, 0.6, 0.35, 0.01, 0x222222, 'p'); B(0, 0.72, 0.35, 0.6, 0.04, 0.04, 0x999999, 'm');
      break;
    case 'fridge':
      B(0, 1, 0, 0.9, 2, 0.75, 0xeef0f2, 'm'); B(0, 1.3, 0.38, 0.88, 0.02, 0.01, 0x888888, 'p'); B(0.35, 1.6, 0.4, 0.04, 0.4, 0.05, 0x777777, 'm'); B(0.35, 0.9, 0.4, 0.04, 0.4, 0.05, 0x777777, 'm');
      break;
    case 'toilet':
      B(0, 0.2, 0.05, 0.3, 0.4, 0.4, 0xffffff, 'p'); B(0, 0.42, 0.08, 0.42, 0.06, 0.5, 0xf0f0f0, 'p'); B(0, 0.6, -0.25, 0.45, 0.4, 0.18, 0xffffff, 'p');
      break;
    case 'bathtub':
      B(0, 0.28, 0, 1.8, 0.55, 0.8, 0xffffff, 'p'); B(0, 0.5, 0, 1.6, 0.06, 0.6, 0x9fd3e8, 'e'); B(-0.8, 0.7, 0, 0.05, 0.3, 0.05, 0xcccccc, 'm');
      break;
    case 'sink':
      B(0, 0.4, -0.1, 0.18, 0.8, 0.18, 0xffffff, 'p'); B(0, 0.83, 0, 0.6, 0.12, 0.45, 0xffffff, 'p'); B(0, 0.95, -0.15, 0.04, 0.15, 0.04, 0xcccccc, 'm');
      B(0, 1.55, -0.24, 0.55, 0.7, 0.02, 0xcfe6f2, 'e');
      break;
    case 'tv':
      B(0, 0.25, 0, 1.8, 0.5, 0.45, wood, 'w'); B(0, 0.25, 0.23, 0.02, 0.4, 0.01, 0x222222, 'p');
      B(0, 0.52, -0.05, 0.3, 0.04, 0.2, 0x111111, 'p'); B(0, 0.95, -0.05, 1.5, 0.85, 0.06, 0x0a0a0a, 'p'); B(0, 0.95, -0.015, 1.42, 0.78, 0.01, pick([0x3060a0, 0x40a070, 0xa05030]), 'e');
      break;
    case 'plant':
      B(0, 0.2, 0, 0.4, 0.4, 0.4, pick([0xb35f3a, 0xeeeeee, 0x333333]), 'p'); B(0, 0.42, 0, 0.36, 0.04, 0.36, 0x3b2a1e, 'p');
      for (let i = 0; i < 6; i++) { const a = r() * 6.28, d = r() * 0.15, s = 0.25 + r() * 0.25; B(Math.cos(a) * d, 0.7 + r() * 0.6, Math.sin(a) * d, s, s * 1.3, s, pick([0x2f6b32, 0x3f8a3c, 0x4f9a48]), 'f'); }
      break;
    case 'rug':
      B(0, 0.01, 0, 2.4, 0.02, 1.6, fab, 'f'); B(0, 0.015, 0, 1.8, 0.02, 1.1, pick(BRIGHT) & 0xcccccc, 'f');
      break;
    case 'rack':
      for (const a of [-1.95, 0, 1.95]) for (const b of [-0.55, 0.55]) B(a, 2.3, b, 0.1, 4.6, 0.1, 0xe07020, 'm');
      for (const y of [0.15, 1.6, 3.05, 4.5]) { B(0, y, -0.55, 4, 0.12, 0.08, 0x2e5ea8, 'm'); B(0, y, 0.55, 4, 0.12, 0.08, 0x2e5ea8, 'm'); B(0, y + 0.07, 0, 3.9, 0.03, 1.1, 0x8a7a5a, 'w'); }
      for (const y of [0.15, 1.6, 3.05]) for (let x = -1.5; x <= 1.5; x += 1) if (r() < 0.8) { const h = 0.5 + r() * 0.6; B(x, y + 0.1 + h / 2, 0, 0.85, h, 0.9, 0xc4a070, 'p'); }
      break;
    case 'toybox':
      B(0, 0.28, 0, 1, 0.55, 0.6, pick(BRIGHT), 'w'); B(0, 0.57, 0, 1.02, 0.05, 0.62, pick(BRIGHT), 'w'); B(0.2, 0.7, 0, 0.2, 0.2, 0.2, pick(BRIGHT), 'p');
      break;
    case 'slide':
      B(0, 0.8, -1.3, 1, 1.6, 0.4, pick(BRIGHT), 'p');
      for (let i = 0; i < 6; i++) B(0, 1.5 - i * 0.26, -0.9 + i * 0.37, 0.8, 0.12, 0.4, 0xf4a261, 'p');
      B(-0.45, 1.0, -0.2, 0.06, 0.4, 2.4, 0xe63946, 'p'); B(0.45, 1.0, -0.2, 0.06, 0.4, 2.4, 0xe63946, 'p');
      break;
    case 'ballpit':
      B(0, 0.3, -1.45, 3, 0.6, 0.1, 0x2a9d8f, 'p'); B(0, 0.3, 1.45, 3, 0.6, 0.1, 0x2a9d8f, 'p'); B(-1.45, 0.3, 0, 0.1, 0.6, 3, 0x2a9d8f, 'p'); B(1.45, 0.3, 0, 0.1, 0.6, 3, 0x2a9d8f, 'p');
      for (let i = 0; i < 40; i++) B(-1.25 + r() * 2.5, 0.35 + r() * 0.15, -1.25 + r() * 2.5, 0.16, 0.16, 0.16, pick(BRIGHT), 'p');
      B(0, 0.2, 0, 2.8, 0.3, 2.8, 0xe9c46a, 'p');
      break;
    case 'barricade':
      B(-0.85, 1.2, 0, 0.12, 2.4, 0.3, 0x5c4033, 'w'); B(0.85, 1.2, 0, 0.12, 2.4, 0.3, 0x5c4033, 'w');
      for (const y of [0.35, 0.9, 1.45, 2.0]) B(0, y, 0.05, 2, 0.35, 0.08, 0xa0724a, 'w');
      B(0, 1.2, 0.12, 0.15, 2.3, 0.04, 0x777777, 'm');
      break;
    case 'claim':
      B(0, 0.05, 0, 0.4, 0.1, 0.4, 0x333333, 'm'); B(0, 1.2, 0, 0.06, 2.4, 0.06, 0xcccccc, 'm'); B(0.35, 2.05, 0, 0.7, 0.45, 0.03, FABRICS[c % FABRICS.length], 'e');
      break;
    case 'foodcounter':
      B(0, 0.45, 0, 3, 0.9, 0.85, 0x8b5a2b, 'w'); B(0, 0.92, 0, 3.02, 0.05, 0.9, 0xcccccc, 'm');
      for (let x = -1.1; x <= 1.1; x += 0.73) B(x, 0.97, 0, 0.6, 0.06, 0.45, pick([0xb5651d, 0xe9c46a, 0x8ab060, 0xc04030]), 'p');
      B(0, 1.25, -0.1, 3, 0.03, 0.6, 0xd8f0ff, 'e'); B(-1.48, 1.1, -0.1, 0.03, 0.3, 0.6, 0xcccccc, 'm'); B(1.48, 1.1, -0.1, 0.03, 0.3, 0.6, 0xcccccc, 'm');
      break;
    case 'register':
      B(0, 0.45, 0, 1.6, 0.9, 0.8, 0xdddddd, 'p'); B(0, 0.91, 0, 1.6, 0.03, 0.5, 0x111111, 'p'); B(0.6, 1.1, -0.25, 0.3, 0.3, 0.25, 0x333333, 'p'); B(0.6, 1.15, -0.12, 0.25, 0.18, 0.01, 0x30c060, 'e');
      B(-0.75, 1.6, 0, 0.05, 1.4, 0.05, 0x888888, 'm'); B(-0.75, 2.3, 0, 0.3, 0.3, 0.1, 0x1d4fa8, 'e');
      break;
    case 'clocktower':
      B(0, 3, 0, 2.4, 6, 2.4, 0xe8e0d0, 'p'); B(0, 0.3, 0, 3, 0.6, 3, 0x8a8070, 'p');
      for (const [x, z, sx, sz] of [[0, 1.21, 1.4, 0.02], [0, -1.21, 1.4, 0.02], [1.21, 0, 0.02, 1.4], [-1.21, 0, 0.02, 1.4]]) B(x, 4, z, sx, 1.4, sz, 0xfff8e0, 'e');
      B(0, 4, 0, 2.5, 0.08, 0.1, 0x111111, 'p'); B(0, 4.3, 0, 0.1, 0.6, 2.5, 0x111111, 'p');
      break;
    case 'fountain':
      B(0, 0.3, 0, 4, 0.6, 4, 0xbbbbbb, 'p'); B(0, 0.55, 0, 3.6, 0.1, 3.6, 0x5fb4e0, 'e'); B(0, 1.2, 0, 0.4, 1.3, 0.4, 0xdddddd, 'p'); B(0, 1.9, 0, 1, 0.1, 1, 0xbbbbbb, 'p'); B(0, 2.1, 0, 0.3, 0.4, 0.3, 0x8fd0f0, 'e');
      break;
    case 'pillar':
      B(0, 3, 0, 1, 6, 1, 0xd8d6cc, 'p'); B(0, 1.2, 0, 1.04, 0.3, 1.04, 0xf5c518, 'p'); B(0, 0.05, 0, 1.1, 0.1, 1.1, 0x666666, 'm');
      break;
    case 'sign':
      B(0, 1.5, 0, 0.08, 3, 0.08, 0x333333, 'm');
      break;
  }
  return P;
}

export function rotXZ(x, z, rot) {
  switch (rot & 3) { case 0: return [x, z]; case 1: return [z, -x]; case 2: return [-x, -z]; default: return [-z, x]; }
}
export function worldParts(f) {
  return localParts(f.type, f.c).map(([x, y, z, sx, sy, sz, col, m]) => {
    const [rx, rz] = rotXZ(x, z, f.rot); const odd = f.rot & 1;
    return [f.x + rx, y, f.z + rz, odd ? sz : sx, sy, odd ? sx : sz, col, m];
  });
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
