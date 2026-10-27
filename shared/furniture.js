// Furniture catalogue: real-world dimensions (metres) and hand-placed part lists.
// Local space: origin at footprint centre on the floor, +Y up, FRONT faces +Z.
// A part: { s: shape, x, y (centre), z, sx, sy, sz, c: colour, m: material, r?: bevel radius, t?: top/bottom ratio, seg?, rx?, ry?, rz? }
// shapes: b box · r rounded box · c cylinder (sx = diameter, sz = depth diameter) · s ellipsoid
// materials: w wood · f fabric · m metal · p plastic/painted · e emissive (unlit)
import { rng } from './rng.js';

// w,d = footprint, h = collision/standing height. walk: no collision. fixed: cannot be picked up.
export const TYPES = {
  shelf: { w: 4, d: 1, h: 2.0, name: 'Shelf' },
  bookshelf: { w: 1.6, d: 0.35, h: 2.0, name: 'Bookshelf' },
  bed: { w: 1.6, d: 2.1, h: 0.55, name: 'Bed', bed: true },
  bunkbed: { w: 1.0, d: 2.1, h: 1.7, name: 'Bunk Bed', bed: true },
  sofa: { w: 2.0, d: 0.9, h: 0.85, name: 'Sofa' },
  table: { w: 1.6, d: 0.9, h: 0.75, name: 'Table' },
  desk: { w: 1.4, d: 0.7, h: 0.75, name: 'Desk' },
  chair: { w: 0.45, d: 0.5, h: 0.9, name: 'Chair' },
  officechair: { w: 0.65, d: 0.65, h: 1.1, name: 'Office Chair' },
  lamp: { w: 0.4, d: 0.4, h: 1.6, name: 'Lamp' },
  wardrobe: { w: 1.8, d: 0.6, h: 2.0, name: 'Wardrobe' },
  display: { w: 1.2, d: 1.2, h: 0.9, name: 'Display' },
  counter: { w: 2, d: 0.65, h: 0.9, name: 'Kitchen Counter' },
  stove: { w: 0.6, d: 0.65, h: 0.9, name: 'Stove', stove: true },
  fridge: { w: 0.7, d: 0.68, h: 1.85, name: 'Fridge' },
  toilet: { w: 0.4, d: 0.65, h: 0.78, name: 'Toilet' },
  bathtub: { w: 1.7, d: 0.75, h: 0.58, name: 'Bathtub' },
  sink: { w: 0.55, d: 0.45, h: 0.85, name: 'Sink' },
  tv: { w: 1.6, d: 0.45, h: 1.3, name: 'TV Stand' },
  plant: { w: 0.5, d: 0.5, h: 1.35, name: 'Plant' },
  rug: { w: 2.4, d: 1.6, h: 0.02, name: 'Rug', walk: true },
  rack: { w: 4, d: 1.2, h: 4.6, name: 'Warehouse Rack' },
  toybox: { w: 0.8, d: 0.45, h: 0.5, name: 'Toy Box' },
  slide: { w: 1, d: 3, h: 2.1, name: 'Slide' },
  ballpit: { w: 3, d: 3, h: 0.55, name: 'Ball Pit' },
  barricade: { w: 2, d: 0.4, h: 2.4, name: 'Barricade', hp: 300 },
  claim: { w: 0.4, d: 0.4, h: 2.4, name: 'Claim Flag' },
  foodcounter: { w: 3, d: 0.9, h: 1.1, name: 'Food Counter', fixed: true },
  register: { w: 1.6, d: 0.8, h: 1.1, name: 'Checkout', fixed: true },
  clocktower: { w: 3, d: 3, h: 6, name: 'Clock Tower', fixed: true },
  fountain: { w: 4, d: 4, h: 0.8, name: 'Fountain', fixed: true },
  pillar: { w: 1, d: 1, h: 6, name: 'Pillar', fixed: true },
  sign: { w: 0.2, d: 0.2, h: 3, name: 'Sign', fixed: true },
  pallet: { w: 1.2, d: 1.0, h: 0.144, name: 'Pallet' },
  worklight: { w: 0.7, d: 0.7, h: 2.2, name: 'Tall Worklight', light: true },
  medstation: { w: 1.2, d: 0.45, h: 1.0, name: 'Medkit Station', fixed: true },
  tree: { w: 0.9, d: 0.9, h: 2.4, name: 'Small Tree' },
  infodesk: { w: 2.4, d: 1.0, h: 1.05, name: 'Information Desk', fixed: true },
};

// Coordinated palettes so every piece reads as one designed product.
const WOODS = [0xc8a27a, 0x9b6b43, 0x5e4130, 0xe3cfb0, 0x3a2a20, 0xb98c5e];          // oak, walnut, wenge, birch, espresso, teak
const FABRICS = [0x56637a, 0x8a4b4b, 0x5d7350, 0x8c8a85, 0xc9a85c, 0x3a3d48, 0x8f7aa0, 0xc07f5a, 0x4f8686, 0xd8d0c0];
const ACCENT = [0xe8c547, 0xd2694a, 0x5c86b8, 0x7fb07a, 0xe9e2d0, 0xb35a76];
const METALS = [0x2b2d30, 0xb8bcc0, 0x8c7553, 0xd8d8d4];                                  // black, steel, brass, white
const BOOKS = [0x7a2e2e, 0x2e4a7a, 0x2f5e3a, 0xb08a3e, 0x5a3d6e, 0xd8cfb8, 0x1f1f24, 0x8a5a2b, 0x406a7a, 0xa04a2a];
const BRIGHT = [0xe63946, 0xf4a261, 0x2a9d8f, 0xe9c46a, 0x457b9d, 0x9b5de5, 0x00bbf9, 0x7bc950];
const WHITE = 0xf2f1ec, OFFWHITE = 0xe6e3da, DARK = 0x222326, STEEL = 0xb5babf, CHROME = 0xd4d8dc;

export function localParts(type, c = 7) {
  const r = rng(c);
  const pick = (a) => a[(r() * a.length) | 0];
  const wood = WOODS[c % WOODS.length], fab = FABRICS[(c >>> 3) % FABRICS.length], acc = ACCENT[(c >>> 7) % ACCENT.length], met = METALS[(c >>> 11) % METALS.length];
  const P = [];
  // y arguments are the BOTTOM of the part (except ellipsoids and rotated parts, which use the centre)
  const box = (x, yb, z, sx, sy, sz, col, m = 'p', o) => P.push({ s: 'b', x, y: yb + sy / 2, z, sx, sy, sz, c: col, m, ...o });
  const rb = (x, yb, z, sx, sy, sz, col, m = 'p', rad = 0.012, o) => P.push({ s: 'r', x, y: yb + sy / 2, z, sx, sy, sz, c: col, m, r: rad, ...o });
  const cyl = (x, yb, z, d, h, col, m = 'm', o) => P.push({ s: 'c', x, y: yb + h / 2, z, sx: d, sy: h, sz: o?.dz ?? d, c: col, m, ...o });
  const sph = (x, yc, z, sx, sy, sz, col, m = 'p', o) => P.push({ s: 's', x, y: yc, z, sx, sy, sz, c: col, m, ...o });
  const raw = (o) => P.push(o);
  // four legs whose OUTER faces sit flush with the given half extents
  const legs = (hw, hd, h, s, col, m = 'w', round = false) => { for (const a of [-1, 1]) for (const b of [-1, 1]) { const x = a * (hw - s / 2), z = b * (hd - s / 2); round ? cyl(x, 0, z, s, h, col, m, { t: 0.8 }) : rb(x, 0, z, s, h, s, col, m, s * 0.2); } };
  const knob = (x, y, z, col = met) => cyl(x, y - 0.012, z, 0.024, 0.024, col, 'm', { rx: Math.PI / 2, y });
  const barH = (x, y, z, len, col = met) => cyl(x, 0, z, 0.014, len, col, 'm', { rz: Math.PI / 2, y });          // horizontal pull handle
  const barV = (x, y, z, len, col = met) => cyl(x, y - len / 2, z, 0.014, len, col, 'm');                          // vertical pull handle

  switch (type) {
    case 'shelf': { // double-sided store gondola, 4 m x 1 m x 2 m
      const steel = pick([0xe9e9e4, 0x6c7178, 0x2f3236]);
      rb(0, 0, 0, 3.96, 0.12, 0.96, 0x3a3c40, 'm', 0.01);                                           // plinth
      for (const x of [-1.96, 1.96]) rb(x, 0, 0, 0.08, 2.0, 1.0, steel, 'm', 0.01);                 // end uprights
      box(0, 0.12, 0, 3.84, 1.86, 0.04, steel, 'm');                                                // centre pegboard spine
      rb(0, 1.94, 0, 3.92, 0.06, 0.18, steel, 'm', 0.01);                                           // top cap
      for (const side of [-1, 1]) {
        for (const y of [0.12, 0.58, 1.04, 1.5]) {
          const z = side * 0.25;
          box(0, y, z, 3.84, 0.03, 0.46, steel, 'm');                                                 // shelf deck (touches spine & uprights)
          box(0, y - 0.03, side * 0.47, 3.84, 0.06, 0.012, 0xf3f3ee, 'p');                             // price-tag strip on lip
          if (y > 1.4 && r() < 0.5) continue;
          for (let x = -1.65; x <= 1.66; x += 0.55) {
            const kind = r(); const col = pick(BRIGHT), top = y + 0.03;
            if (r() < 0.12) continue;
            if (kind < 0.4) { const h = 0.2 + r() * 0.16; for (const dz of [0.12, 0.32]) rb(x, top, side * dz, 0.42, h, 0.17, col, 'p', 0.006); }
            else if (kind < 0.7) { for (let i = -2; i <= 2; i++) for (const dz of [0.12, 0.3]) cyl(x + i * 0.09, top, side * dz, 0.08, 0.13, i & 1 ? col : 0xd0d0cc, 'm', { seg: 10 }); }
            else { for (let i = -1; i <= 1; i++) { cyl(x + i * 0.14, top, side * 0.2, 0.09, 0.24, col, 'p', { seg: 10 }); cyl(x + i * 0.14, top + 0.24, side * 0.2, 0.035, 0.06, WHITE, 'p', { seg: 8 }); } }
          }
        }
      }
      break;
    }
    case 'bookshelf': { // two-bay 1.6 x 0.35 x 2.0
      const t = 0.025, w = wood;
      for (const x of [-0.8 + t / 2, 0, 0.8 - t / 2]) rb(x, 0, 0, t, 2.0, 0.35, w, 'w', 0.004);
      box(0, 0.06, -0.172, 1.58, 1.92, 0.006, w, 'w');                                                // back panel
      box(0, 0, 0.15, 1.55, 0.06, 0.02, w, 'w');                                                       // kick board
      rb(0, 1.975, 0, 1.6, 0.025, 0.35, w, 'w', 0.004);                                               // top
      const levels = [0.06, 0.44, 0.82, 1.2, 1.58];
      for (const y of levels) for (const bx of [-0.4, 0.4]) box(bx, y - t, 0.003, 0.775 - t, t, 0.34, w, 'w');
      for (const y of levels.slice(0, 4)) for (const bx of [-0.4, 0.4]) {
        let x = bx - 0.36; const end = bx + 0.36, roll = r();
        if (roll < 0.15) { // decorative vase + box
          cyl(bx - 0.15, y, 0, 0.1, 0.22, pick(ACCENT), 'p', { t: 0.7, seg: 14 }); rb(bx + 0.15, y, 0, 0.22, 0.14, 0.2, pick(FABRICS), 'f', 0.01); continue;
        }
        if (roll < 0.3) { // a horizontal stack
          let yy = y; for (let i = 0; i < 4; i++) { const th = 0.03 + r() * 0.02; rb(bx + (r() - 0.5) * 0.04, yy, -0.02, 0.26 + r() * 0.04, th, 0.2, pick(BOOKS), 'p', 0.003); yy += th; } x = bx + 0.02;
        }
        while (x < end - 0.03) {
          const bw = 0.022 + r() * 0.03, bh = 0.2 + r() * 0.12, bd = 0.17 + r() * 0.06;
          if (x + bw > end) break;
          if (r() < 0.06) { x += 0.06; continue; }
          rb(x + bw / 2, y, -0.165 + bd / 2, bw, bh, bd, pick(BOOKS), 'p', 0.003);
          x += bw + 0.002;
        }
      }
      break;
    }
    case 'bed': { // 1.6 x 2.0 mattress, 2.1 deep incl. headboard
      const frameZ0 = -0.99, frameZ1 = 1.05;
      rb(0, 0, -1.02, 1.64 - 0.04, 1.05, 0.06, wood, 'w', 0.015);                                       // headboard (stands on floor)
      rb(0, 0.42, -0.985, 1.36, 0.5, 0.03, fab, 'f', 0.012);                                            // upholstered inset
      for (const x of [-0.78, 0.78]) rb(x, 0.12, (frameZ0 + frameZ1) / 2, 0.04, 0.22, frameZ1 - frameZ0, wood, 'w', 0.008); // side rails
      rb(0, 0.12, frameZ1 - 0.02, 1.52, 0.22, 0.04, wood, 'w', 0.008);                                   // foot rail
      for (const [x, z] of [[-0.765, -0.96], [0.765, -0.96], [-0.765, 1.02], [0.765, 1.02]]) rb(x, 0, z, 0.07, 0.14, 0.07, wood, 'w', 0.01); // legs under corners
      box(0, 0.28, 0.03, 1.52, 0.02, 1.98, wood, 'w');                                                  // slat deck
      rb(0, 0.3, 0.025, 1.5, 0.22, 1.96, 0xf4f2ec, 'f', 0.06);                                          // mattress, top at 0.52
      const duv = pick(FABRICS);
      rb(0, 0.505, 0.39, 1.56, 0.05, 1.3, duv, 'f', 0.022);                                             // duvet over the foot 2/3
      for (const x of [-0.79, 0.79]) rb(x, 0.33, 0.39, 0.025, 0.2, 1.3, duv, 'f', 0.01);                 // drape down the sides
      rb(0, 0.53, -0.18, 1.56, 0.04, 0.22, 0xf8f6f0, 'f', 0.018);                                       // folded sheet edge
      rb(0, 0.54, 0.82, 1.58, 0.02, 0.32, acc, 'f', 0.008);                                             // throw blanket
      for (const x of [-0.37, 0.37]) rb(x, 0.505, -0.74, 0.62, 0.14, 0.38, 0xfbfaf6, 'f', 0.06);       // pillows
      if (r() < 0.6) raw({ s: 'r', x: 0, y: 0.68, z: -0.5, sx: 0.42, sy: 0.36, sz: 0.12, c: acc, m: 'f', r: 0.05, rx: -0.35 }); // accent cushion leaning on pillows
      break;
    }
    case 'bunkbed': { // 0.9 x 2.0 mattresses, top bunk at 1.2 m
      const post = 0.07, hw = 0.5, hd = 1.05;
      for (const a of [-1, 1]) for (const b of [-1, 1]) rb(a * (hw - post / 2), 0, b * (hd - post / 2), post, 1.7, post, wood, 'w', 0.012);
      for (const yb of [0.22, 1.12]) {
        for (const a of [-1, 1]) rb(a * (hw - post / 2), yb, 0, 0.035, 0.14, 2 * hd - 2 * post, wood, 'w', 0.006);
        for (const b of [-1, 1]) rb(0, yb, b * (hd - post / 2), 2 * hw - 2 * post, 0.14, 0.035, wood, 'w', 0.006);
        box(0, yb + 0.04, 0, 0.9, 0.02, 1.9, wood, 'w');
        rb(0, yb + 0.06, 0, 0.84, 0.15, 1.88, 0xf4f2ec, 'f', 0.04);
        rb(0, yb + 0.2, 0.25, 0.86, 0.04, 1.3, pick(FABRICS), 'f', 0.016);
        rb(0, yb + 0.2, -0.72, 0.55, 0.11, 0.32, 0xfbfaf6, 'f', 0.045);
      }
      rb(-(hw - post / 2), 1.42, 0, 0.035, 0.06, 2 * hd - 2 * post, wood, 'w', 0.006);                    // guard rails (gap for ladder)
      rb(hw - post / 2, 1.42, -0.25, 0.035, 0.06, 2 * hd - post - 0.55, wood, 'w', 0.006);
      for (const b of [-1, 1]) rb(0, 1.42, b * (hd - post / 2), 2 * hw - 2 * post, 0.18, 0.025, wood, 'w', 0.006);
      // ladder on the +X side, rails meet the top rail
      for (const z of [0.55, 0.95]) rb(hw - 0.0175, 0, z, 0.035, 1.48, 0.04, wood, 'w', 0.006);
      for (let y = 0.32; y < 1.4; y += 0.27) cyl(hw - 0.0175, 0, 0.75, 0.028, 0.37, wood, 'w', { rx: Math.PI / 2, y });
      break;
    }
    case 'sofa': { // 2.0 x 0.9 x 0.85, seat 0.45
      const leg = pick([DARK, 0x6b4a32, 0xb9b9b4]);
      for (const a of [-1, 1]) for (const b of [-1, 1]) cyl(a * 0.9, 0, b * 0.36, 0.045, 0.11, leg, 'w', { t: 0.75, seg: 10 });
      rb(0, 0.1, -0.02, 1.96, 0.2, 0.84, fab, 'f', 0.03);                                                   // base frame
      for (const a of [-1, 1]) rb(a * 0.91, 0.1, -0.02, 0.18, 0.52, 0.86, fab, 'f', 0.06);                  // arms, top 0.62
      rb(0, 0.3, -0.36, 1.64, 0.55, 0.18, fab, 'f', 0.05);                                                  // back frame, top 0.85
      for (const a of [-1, 1]) rb(a * 0.41, 0.3, 0.08, 0.81, 0.15, 0.6, fab, 'f', 0.05);                     // seat cushions, top 0.45
      for (const a of [-1, 1]) rb(a * 0.41, 0.46, -0.215, 0.79, 0.4, 0.15, fab, 'f', 0.06, { rx: -0.12 });  // back cushions (lean back)
      if (r() < 0.75) rb(-0.6, 0.47, -0.08, 0.4, 0.38, 0.12, acc, 'f', 0.05, { rx: -0.3, ry: 0.25 });        // throw pillow
      if (r() < 0.4) rb(0.6, 0.47, -0.08, 0.38, 0.36, 0.12, pick(ACCENT), 'f', 0.05, { rx: -0.3, ry: -0.2 });
      break;
    }
    case 'table': { // 1.6 x 0.9, height 0.75
      rb(0, 0.715, 0, 1.6, 0.035, 0.9, wood, 'w', 0.008);
      const ins = 0.06;
      for (const a of [-1, 1]) box(a * (0.8 - ins - 0.0275 + 0.01), 0.635, 0, 0.02, 0.08, 0.9 - 2 * ins - 0.055 + 0.02, wood, 'w'); // aprons
      for (const b of [-1, 1]) box(0, 0.635, b * (0.45 - ins - 0.0275 + 0.01), 1.6 - 2 * ins - 0.055 + 0.02, 0.08, 0.02, wood, 'w');
      for (const a of [-1, 1]) for (const b of [-1, 1]) rb(a * (0.8 - ins), 0, b * (0.45 - ins), 0.055, 0.715, 0.055, wood, 'w', 0.008);
      const deco = r();
      if (deco < 0.35) { cyl(0, 0.75, 0, 0.11, 0.24, pick(ACCENT), 'p', { t: 0.6, seg: 16 }); for (let i = 0; i < 3; i++) sph((r() - 0.5) * 0.06, 1.0 + i * 0.03, (r() - 0.5) * 0.06, 0.07, 0.07, 0.07, 0x4f8a3a, 'f'); }
      else if (deco < 0.6) { cyl(0, 0.75, 0, 0.32, 0.06, WHITE, 'p', { t: 1.3, seg: 18 }); for (let i = 0; i < 4; i++) sph(Math.cos(i * 1.6) * 0.07, 0.8, Math.sin(i * 1.6) * 0.07, 0.08, 0.08, 0.08, pick([0xd63c2a, 0xe0b030, 0x7fb040]), 'p'); }
      else if (deco < 0.8) for (const [x, z] of [[-0.45, -0.25], [0.45, -0.25], [-0.45, 0.25], [0.45, 0.25]]) cyl(x, 0.75, z, 0.26, 0.015, WHITE, 'p', { seg: 18 });
      break;
    }
    case 'desk': { // 1.4 x 0.7 x 0.75
      const body = pick([WHITE, 0x2c2d30, wood]);
      rb(0, 0.72, 0, 1.4, 0.03, 0.7, wood, 'w', 0.006);
      rb(-0.5, 0, 0, 0.4, 0.72, 0.68, body, 'p', 0.006);                                     // drawer pedestal
      rb(0.685, 0, 0, 0.03, 0.72, 0.68, body, 'p', 0.004);                                    // right side panel
      box(0.09, 0.3, -0.31, 1.15, 0.42, 0.018, body, 'p');                                    // modesty panel
      [[0.04, 0.2], [0.25, 0.2], [0.46, 0.24]].forEach(([yb, h]) => { rb(-0.5, yb, 0.343, 0.38, h - 0.008, 0.016, body, 'p', 0.004); barH(-0.5, yb + h - 0.05, 0.36, 0.16); });
      if (r() < 0.8) { // monitor, keyboard, mouse, mug
        rb(0.1, 0.75, -0.18, 0.24, 0.012, 0.18, DARK, 'm', 0.004);
        rb(0.1, 0.762, -0.2, 0.05, 0.3, 0.03, DARK, 'm', 0.006);
        rb(0.1, 0.92, -0.18, 0.62, 0.37, 0.025, 0x111214, 'p', 0.006);
        box(0.1, 0.94, -0.166, 0.59, 0.33, 0.002, pick([0x1f3a5c, 0x1d4a40, 0x33284f]), 'e');
        box(0.05, 1.0, -0.164, 0.3, 0.2, 0.002, 0x8e9cae, 'e'); box(0.05, 1.185, -0.163, 0.3, 0.015, 0.002, 0x4a6a96, 'e');
        rb(0.1, 0.75, 0.12, 0.44, 0.02, 0.14, 0x2a2b2e, 'p', 0.004);
        sph(0.42, 0.765, 0.13, 0.06, 0.03, 0.1, 0x2a2b2e, 'p');
        cyl(-0.45, 0.75, 0.15, 0.08, 0.1, pick(ACCENT), 'p', { seg: 14 });
      }
      break;
    }
    case 'chair': { // 0.45 x 0.5, seat 0.45, back 0.9
      const s = 0.035, hw = 0.225, hd = 0.25;
      for (const a of [-1, 1]) { rb(a * (hw - s / 2), 0, hd - s / 2, s, 0.42, s, wood, 'w', 0.006); rb(a * (hw - s / 2), 0, -hd + s / 2, s, 0.9, s, wood, 'w', 0.006); }
      rb(0, 0.42, 0, 0.45, 0.03, 0.5, wood, 'w', 0.006);                                     // seat board, top 0.45
      rb(0, 0.45, 0.02, 0.41, 0.03, 0.42, fab, 'f', 0.012);                                  // seat pad
      for (const y of [0.6, 0.73]) box(0, y, -hd + s / 2, 0.45 - 2 * s, 0.06, 0.02, wood, 'w'); // back slats
      rb(0, 0.83, -hd + s / 2, 0.45, 0.07, 0.03, wood, 'w', 0.008);                          // top rail
      for (const a of [-1, 1]) box(a * (hw - s / 2), 0.14, 0, 0.018, 0.025, 0.5 - 2 * s, wood, 'w'); // side stretchers
      break;
    }
    case 'officechair': {
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; raw({ s: 'r', x: Math.sin(a) * 0.14, y: 0.06, z: Math.cos(a) * 0.14, sx: 0.045, sy: 0.03, sz: 0.28, c: DARK, m: 'p', r: 0.01, ry: a }); sph(Math.sin(a) * 0.28, 0.026, Math.cos(a) * 0.28, 0.05, 0.05, 0.05, 0x111111, 'p'); }
      cyl(0, 0.045, 0, 0.07, 0.05, DARK, 'p');
      cyl(0, 0.075, 0, 0.035, 0.35, CHROME, 'm');                                            // gas lift
      rb(0, 0.41, 0, 0.3, 0.03, 0.3, DARK, 'p', 0.008);                                       // mechanism plate
      rb(0, 0.44, 0.02, 0.52, 0.08, 0.5, fab, 'f', 0.035);                                    // seat, top 0.52
      rb(0, 0.43, -0.24, 0.06, 0.25, 0.03, DARK, 'p', 0.008);                                 // back support
      rb(0, 0.6, -0.27, 0.48, 0.5, 0.065, fab, 'f', 0.03, { rx: -0.08 });                      // backrest
      for (const a of [-1, 1]) { rb(a * 0.25, 0.44, 0.02, 0.03, 0.2, 0.04, DARK, 'p', 0.008); rb(a * 0.25, 0.64, 0.03, 0.07, 0.03, 0.24, DARK, 'p', 0.012); }
      break;
    }
    case 'lamp': {
      const base = pick([DARK, CHROME, 0x8c7553]);
      cyl(0, 0, 0, 0.28, 0.025, base, 'm', { seg: 24 });
      cyl(0, 0.025, 0, 0.022, 1.32, base, 'm');
      cyl(0, 1.3, 0, 0.06, 0.04, base, 'm');
      cyl(0, 1.3, 0, 0.4, 0.3, pick([0xfff4dc, 0xffe9c4, 0xf4eadc]), 'e', { t: 0.65, seg: 24 }); // glowing shade
      break;
    }
    case 'wardrobe': { // 1.8 x 0.6 x 2.0, three doors
      const body = pick([wood, WHITE, wood]);
      rb(0, 0.06, -0.01, 1.8, 1.92, 0.58, body, body === WHITE ? 'p' : 'w', 0.008);
      box(0, 0, -0.03, 1.74, 0.06, 0.5, 0x2a2a2a, 'p');                                       // recessed plinth
      rb(0, 1.98, 0, 1.82, 0.02, 0.6, body, body === WHITE ? 'p' : 'w', 0.006);               // top
      const dw = (1.8 - 0.012 * 2) / 3;
      for (let i = 0; i < 3; i++) {
        const x = -0.9 + 0.006 + dw / 2 + i * (dw + 0.006);
        rb(x, 0.08, 0.289, dw - 0.004, 1.88, 0.02, body, body === WHITE ? 'p' : 'w', 0.004);
        barV(x + (i === 2 ? -1 : 1) * (dw / 2 - 0.05), 1.1, 0.307, 0.22);
      }
      break;
    }
    case 'display': { // showroom plinth with a featured product
      rb(0, 0, 0, 1.12, 0.06, 1.12, 0x3a3a3c, 'p', 0.01);
      rb(0, 0.06, 0, 1.2, 0.8, 1.2, WHITE, 'p', 0.02);
      rb(0, 0.86, 0, 1.22, 0.04, 1.22, wood, 'w', 0.01);
      const f = r();
      if (f < 0.33) { cyl(-0.2, 0.9, 0, 0.22, 0.42, pick(ACCENT), 'p', { t: 0.55, seg: 20 }); cyl(0.22, 0.9, 0.1, 0.16, 0.26, pick(ACCENT), 'p', { t: 1.3, seg: 20 }); }
      else if (f < 0.66) { for (let i = 0; i < 3; i++) rb((i - 1) * 0.02, 0.9 + i * 0.1, 0, 0.5 - i * 0.06, 0.1, 0.5 - i * 0.06, pick(FABRICS), 'f', 0.03); }
      else { cyl(0, 0.9, 0, 0.2, 0.02, DARK, 'm'); cyl(0, 0.92, 0, 0.02, 0.35, DARK, 'm'); cyl(0, 1.2, 0, 0.3, 0.2, 0xfff0d0, 'e', { t: 0.6 }); }
      break;
    }
    case 'counter': { // base cabinets + worktop + wall cabinets on a tiled splashback
      const door = pick([WHITE, 0x7d8c7a, 0x3d4a5c, wood]), dm = door === wood ? 'w' : 'p', top = pick([0x3a3a3c, 0xe8e4dc, 0x7a6a58]);
      rb(0, 0.1, -0.03, 2.0, 0.76, 0.57, door, dm, 0.004);                                   // carcass
      box(0, 0, -0.06, 1.98, 0.1, 0.5, 0x2a2a2a, 'p');                                        // toe kick
      rb(0, 0.86, 0, 2.0, 0.04, 0.65, top, 'p', 0.006);                                       // worktop, 0.9
      for (let i = 0; i < 4; i++) { const x = -0.75 + i * 0.5;
        rb(x, 0.68, 0.262, 0.494, 0.16, 0.018, door, dm, 0.004); barH(x, 0.75, 0.281, 0.2);    // drawers
        rb(x, 0.12, 0.262, 0.494, 0.54, 0.018, door, dm, 0.004); barV(x + (i & 1 ? -0.2 : 0.2), 0.55, 0.281, 0.14); }
      box(0, 0.9, -0.318, 2.0, 0.55, 0.014, 0xeceae4, 'p');                                   // splashback
      for (let x = -0.9; x <= 0.91; x += 0.1) box(x, 0.9, -0.31, 0.003, 0.55, 0.002, 0xc8c6c0, 'p'); // tile grout
      rb(0, 1.45, -0.15, 2.0, 0.7, 0.35, door, dm, 0.004);                                    // wall cabinets (on splashback)
      for (let i = 0; i < 4; i++) { const x = -0.75 + i * 0.5; rb(x, 1.46, 0.034, 0.494, 0.68, 0.018, door, dm, 0.004); barV(x + (i & 1 ? -0.2 : 0.2), 1.56, 0.053, 0.14); }
      rb(0.3, 0.9, 0.02, 0.5, 0.004, 0.4, STEEL, 'm', 0.002);                                 // sink rim
      box(0.3, 0.903, 0.02, 0.44, 0.003, 0.34, 0x6e7276, 'm');                                // basin
      cyl(0.3, 0.9, -0.22, 0.05, 0.03, CHROME, 'm');                                          // faucet base
      cyl(0.3, 0.93, -0.22, 0.026, 0.26, CHROME, 'm');
      cyl(0.3, 0, -0.14, 0.022, 0.18, CHROME, 'm', { rx: Math.PI / 2, y: 1.18 });             // spout
      if (r() < 0.6) { cyl(-0.6, 0.9, -0.15, 0.18, 0.02, 0x8a5a3a, 'w'); cyl(-0.6, 0.92, -0.15, 0.03, 0.2, wood, 'w'); }
      break;
    }
    case 'stove': { // freestanding cooker 0.6 x 0.65 x 0.9
      const body = pick([STEEL, WHITE, 0x2c2d30]);
      rb(0, 0.04, -0.01, 0.6, 0.82, 0.62, body, 'm', 0.006);
      box(0, 0, -0.04, 0.56, 0.04, 0.54, 0x1a1a1a, 'p');
      rb(0, 0.86, 0, 0.6, 0.02, 0.62, 0x101012, 'p', 0.004);                                  // glass cooktop
      for (const [x, z, d] of [[-0.14, -0.14, 0.2], [0.14, -0.14, 0.16], [-0.14, 0.14, 0.16], [0.14, 0.14, 0.2]]) cyl(x, 0.88, z, d, 0.002, 0x3a1612, 'p', { seg: 24 });
      rb(0, 0.86, -0.295, 0.6, 0.1, 0.03, body, 'm', 0.006);                                  // back guard
      rb(0, 0.12, 0.31, 0.54, 0.5, 0.02, 0x15171a, 'p', 0.008);                               // oven door
      box(0, 0.2, 0.322, 0.4, 0.26, 0.002, 0x2a3036, 'm');                                    // window
      barH(0, 0.57, 0.345, 0.46, CHROME); for (const x of [-0.2, 0.2]) cyl(x, 0, 0.33, 0.015, 0.025, CHROME, 'm', { rx: Math.PI / 2, y: 0.57 });
      for (let i = 0; i < 4; i++) knob(-0.21 + i * 0.14, 0.75, 0.302 + 0.012, 0x2a2a2a);
      box(0, 0.68, 0.3, 0.6, 0.14, 0.004, 0x202022, 'p');
      break;
    }
    case 'fridge': { // 0.7 x 0.68 x 1.85
      const body = pick([WHITE, STEEL, 0x2c2d30, 0xb94a3c]);
      rb(0, 0.04, -0.02, 0.7, 1.81, 0.62, body, 'm', 0.02);
      box(0, 0, -0.04, 0.66, 0.04, 0.56, 0x1a1a1a, 'p');
      rb(0, 0.06, 0.305, 0.69, 0.66, 0.04, body, 'm', 0.012);                                 // freezer door
      rb(0, 0.73, 0.305, 0.69, 1.11, 0.04, body, 'm', 0.012);                                 // fridge door
      for (const [y, l] of [[0.5, 0.28], [0.85, 0.4]]) { barV(-0.29, y + l / 2, 0.36, l, CHROME); for (const dy of [-l / 2 + 0.02, l / 2 - 0.02]) cyl(-0.29, 0, 0.335, 0.012, 0.03, CHROME, 'm', { rx: Math.PI / 2, y: y + dy }); }
      box(0, 1.5, 0.326, 0.3, 0.012, 0.002, 0x8a8a8a, 'p');                                   // logo strip
      break;
    }
    case 'toilet': {
      cyl(0, 0, 0.04, 0.22, 0.32, WHITE, 'p', { t: 1.3, dz: 0.3, seg: 18 });                   // pedestal
      cyl(0, 0.3, 0.06, 0.36, 0.1, WHITE, 'p', { t: 1.05, dz: 0.46, seg: 24 });                 // bowl
      cyl(0, 0.4, 0.06, 0.37, 0.02, OFFWHITE, 'p', { dz: 0.46, seg: 24 });                      // seat
      cyl(0, 0.42, 0.065, 0.36, 0.015, WHITE, 'p', { dz: 0.45, seg: 24 });                      // lid
      rb(0, 0.38, -0.235, 0.38, 0.36, 0.17, WHITE, 'p', 0.03);                                  // cistern
      rb(0, 0.74, -0.235, 0.4, 0.03, 0.19, WHITE, 'p', 0.012);
      cyl(0, 0.77, -0.235, 0.05, 0.01, CHROME, 'm');
      break;
    }
    case 'bathtub': { // built-in tub with panel, walls 7 cm, rolled rims
      const t = 0.07;
      rb(0, 0, 0, 1.7, 0.1, 0.75, WHITE, 'p', 0.02);                                          // floor of tub
      for (const z of [-0.375 + t / 2, 0.375 - t / 2]) rb(0, 0, z, 1.7, 0.58, t, WHITE, 'p', 0.03);
      for (const x of [-0.85 + t / 2, 0.85 - t / 2]) rb(x, 0, 0, t, 0.58, 0.75, WHITE, 'p', 0.03);
      rb(0, 0.1, 0, 1.56 - 0.02, 0.005, 0.61 - 0.02, 0xeef4f6, 'p', 0.002);                   // enamel interior
      if (r() < 0.5) box(0, 0.36, 0, 1.56, 0.005, 0.61, 0x8fc8de, 'e');                         // water
      cyl(-0.78, 0.58, 0, 0.05, 0.04, CHROME, 'm');                                          // mixer
      cyl(-0.78, 0.62, 0, 0.03, 0.14, CHROME, 'm');
      cyl(-0.73, 0, 0, 0.022, 0.12, CHROME, 'm', { rz: Math.PI / 2, y: 0.74 });
      for (const z of [-0.08, 0.08]) cyl(-0.78, 0.58, z, 0.04, 0.05, CHROME, 'm');
      break;
    }
    case 'sink': { // pedestal basin
      cyl(0, 0, -0.08, 0.2, 0.72, WHITE, 'p', { t: 0.75, dz: 0.18, seg: 18 });
      rb(0, 0.7, -0.01, 0.55, 0.15, 0.43, WHITE, 'p', 0.05);
      rb(0, 0.849, 0.02, 0.42, 0.003, 0.28, 0xdfe6ea, 'p', 0.001);                             // bowl
      cyl(0, 0.85, -0.17, 0.05, 0.03, CHROME, 'm'); cyl(0, 0.88, -0.17, 0.025, 0.12, CHROME, 'm');
      cyl(0, 0, -0.12, 0.02, 0.1, CHROME, 'm', { rx: Math.PI / 2, y: 0.99 });
      cyl(0.2, 0.85, -0.16, 0.06, 0.12, pick(ACCENT), 'p', { seg: 12 });                       // soap
      break;
    }
    case 'tv': { // media unit + 55" TV
      const body = pick([wood, WHITE, 0x2c2d30]), bm = body === wood ? 'w' : 'p';
      for (const a of [-1, 1]) for (const b of [-1, 1]) cyl(a * 0.74, 0, b * 0.17, 0.035, 0.08, DARK, 'm', { t: 0.8 });
      rb(0, 0.08, 0, 1.6, 0.42, 0.45, body, bm, 0.008);
      for (const x of [-0.53, 0.53]) { rb(x, 0.1, 0.221, 0.52, 0.38, 0.016, body, bm, 0.004); barH(x, 0.42, 0.24, 0.18); }
      box(0, 0.1, 0.18, 0.5, 0.38, 0.1, 0x1c1c1e, 'p');                                        // open niche shadow
      rb(0, 0.12, 0.1, 0.36, 0.06, 0.24, 0x111111, 'p', 0.006); box(0.12, 0.15, 0.221, 0.04, 0.004, 0.002, 0x30d060, 'e');
      rb(0, 0.5, -0.05, 0.32, 0.012, 0.2, DARK, 'm', 0.004);                                   // TV foot
      rb(0, 0.512, -0.07, 0.06, 0.1, 0.03, DARK, 'm', 0.006);
      rb(0, 0.58, -0.06, 1.23, 0.71, 0.04, 0x0d0d0f, 'p', 0.008);
      box(0, 0.6, -0.039, 1.19, 0.67, 0.002, 0x0e1216, 'm');
      break;
    }
    case 'plant': {
      const pot = pick([0xb86a45, WHITE, 0x2c2d30, 0x7a8a7a]);
      cyl(0, 0, 0, 0.28, 0.36, pot, 'p', { t: 1.25, seg: 20 });
      cyl(0, 0.34, 0, 0.37, 0.04, pot, 'p', { seg: 20 });
      cyl(0, 0.35, 0, 0.32, 0.03, 0x3b2a1e, 'f', { seg: 16 });
      cyl(0, 0.36, 0, 0.035, 0.55, 0x5a4030, 'w', { t: 0.6 });
      const greens = [0x2f6b32, 0x3f8a3c, 0x4f9a48, 0x386f3e];
      for (let i = 0; i < 15; i++) { const k = i / 14, a = i * 2.4 + r() * 0.5, d = 0.05 + r() * 0.06 * (1 - k * 0.5), y = 0.66 + k * 0.52 + r() * 0.04, s = 0.2 - k * 0.06 + r() * 0.04; sph(Math.cos(a) * d, y, Math.sin(a) * d, s, s * 0.9, s, pick(greens), 'f'); }
      break;
    }
    case 'rug': {
      const border = pick(FABRICS), field = pick(ACCENT.concat(FABRICS));
      rb(0, 0.001, 0, 2.3, 0.008, 1.6, border, 'f', 0.003);
      box(0, 0.009, 0, 2.0, 0.002, 1.3, field, 'f');
      for (let i = -1; i <= 1; i++) box(i * 0.55, 0.011, 0, 0.28, 0.002, 0.28, border, 'f', { ry: Math.PI / 4 });
      for (const a of [-1, 1]) for (let z = -0.75; z <= 0.751; z += 0.05) box(a * 1.17, 0.001, z, 0.06, 0.004, 0.012, 0xe8e0d0, 'f'); // fringe
      break;
    }
    case 'rack': { // pallet racking, 2 bays, 3 beam levels
      const up = 0xe0702a, beam = 0x2e5ea8;
      for (const x of [-1.96, 0, 1.96]) {
        for (const z of [-0.55, 0.55]) rb(x, 0, z, 0.08, 4.6, 0.08, up, 'm', 0.006);
        for (let y = 0.3; y < 4.3; y += 0.8) raw({ s: 'b', x, y: y + 0.4, z: 0, sx: 0.03, sy: 0.03, sz: 1.32, c: up, m: 'm', rx: (Math.floor(y / 0.8) & 1 ? 1 : -1) * 0.69 }); // diagonal bracing
        for (const z of [-0.55, 0.55]) box(x, 0, z, 0.1, 0.01, 0.1, 0x777777, 'm');
      }
      const levels = [0, 1.5, 3.0];
      for (const y of [1.5, 3.0, 4.45]) for (const z of [-0.55, 0.55]) for (const bx of [-0.98, 0.98]) box(bx, y, z, 1.88, 0.12, 0.06, beam, 'm');
      for (const y of [1.5, 3.0]) for (const bx of [-0.98, 0.98]) box(bx, y + 0.12, 0, 1.88, 0.012, 1.04, 0x9a9a9a, 'm');
      for (const y0 of levels) for (const bx of [-0.98, 0.98]) {
        if (r() < 0.15) continue;
        const y = y0 === 0 ? 0 : y0 + 0.132;
        for (const z of [-0.42, 0, 0.42]) box(bx, y, z, 1.2, 0.1, 0.1, 0xb08a5a, 'w');         // pallet runners
        box(bx, y + 0.1, 0, 1.2, 0.022, 1.0, 0xc4a070, 'w');                                     // deck
        const cols = 2, rows = 2, bh = 0.35 + r() * 0.25, stack = 1 + ((r() * 2) | 0);
        for (let s = 0; s < stack; s++) for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
          const yy = y + 0.122 + s * bh, xx = bx - 0.3 + i * 0.6, zz = -0.24 + j * 0.48;
          rb(xx, yy, zz, 0.58, bh - 0.005, 0.46, 0xc49a6c, 'p', 0.006);
          box(xx, yy + bh - 0.004, zz, 0.06, 0.001, 0.46, 0xd8c8a8, 'p');
        }
      }
      break;
    }
    case 'toybox': {
      const col = pick(BRIGHT);
      rb(0, 0, 0, 0.8, 0.44, 0.45, col, 'w', 0.03);
      rb(0, 0.44, 0, 0.82, 0.05, 0.47, pick(BRIGHT), 'w', 0.02);
      for (const a of [-1, 1]) rb(a * 0.401, 0.28, 0, 0.004, 0.05, 0.14, 0x222222, 'p', 0.001);
      sph(-0.22, 0.58, 0.05, 0.18, 0.18, 0.18, pick(BRIGHT), 'p');
      rb(0.05, 0.49, -0.05, 0.1, 0.1, 0.1, pick(BRIGHT), 'w', 0.01); rb(0.07, 0.59, -0.04, 0.1, 0.1, 0.1, pick(BRIGHT), 'w', 0.01, { ry: 0.4 });
      // teddy
      const ted = 0xa8784a; sph(0.25, 0.59, 0, 0.17, 0.2, 0.14, ted, 'f'); sph(0.25, 0.74, 0.01, 0.13, 0.12, 0.12, ted, 'f');
      for (const a of [-1, 1]) sph(0.25 + a * 0.055, 0.8, 0.01, 0.045, 0.045, 0.03, ted, 'f');
      sph(0.25, 0.73, 0.065, 0.045, 0.035, 0.03, 0xd8b890, 'f');
      break;
    }
    case 'slide': { // platform + ladder at back (-Z), chute descends to +Z
      const col = pick(BRIGHT), frame = 0xe9e9e4;
      const pz0 = -1.5, pz1 = -0.9, py = 1.45;
      for (const x of [-0.32, 0.32]) for (const z of [pz0 + 0.03, pz1 - 0.03]) cyl(x, 0, z, 0.06, 2.1, frame, 'm');
      rb(0, py, (pz0 + pz1) / 2, 0.7, 0.05, pz1 - pz0, col, 'p', 0.01);
      for (let y = 0.3; y < py; y += 0.29) cyl(0, 0, pz0 + 0.03, 0.035, 0.64, frame, 'm', { rz: Math.PI / 2, y });
      for (const x of [-0.32, 0.32]) cyl(x, 0, (pz0 + pz1) / 2, 0.04, pz1 - pz0, frame, 'm', { rx: Math.PI / 2, y: 2.0 }); // hand rails
      const z0 = pz1, y0 = py + 0.05, z1 = 1.2, y1 = 0.12, len = Math.hypot(z1 - z0, y0 - y1), th = Math.atan2(y0 - y1, z1 - z0);
      const cz = (z0 + z1) / 2, cy = (y0 + y1) / 2, nY = Math.cos(th), nZ = Math.sin(th);
      raw({ s: 'r', x: 0, y: cy - 0.02 * nY, z: cz - 0.02 * nZ, sx: 0.6, sy: 0.04, sz: len, c: col, m: 'p', r: 0.015, rx: th });
      for (const a of [-1, 1]) raw({ s: 'r', x: a * 0.32, y: cy + 0.07 * nY, z: cz + 0.07 * nZ, sx: 0.05, sy: 0.22, sz: len, c: col, m: 'p', r: 0.02, rx: th });
      rb(0, 0.08, 1.35, 0.6, 0.04, 0.3, col, 'p', 0.015);                                    // run-out
      for (const a of [-1, 1]) { rb(a * 0.32, 0.08, 1.35, 0.05, 0.15, 0.3, col, 'p', 0.02); rb(a * 0.27, 0, 1.4, 0.06, 0.08, 0.06, frame, 'm', 0.01); }
      break;
    }
    case 'ballpit': {
      const pad = pick([0x2a9d8f, 0x457b9d, 0x9b5de5]);
      rb(0, 0, 0, 2.6, 0.06, 2.6, 0x3a6ea8, 'f', 0.02);
      for (const s of [-1, 1]) { rb(0, 0, s * 1.4, 3.0, 0.55, 0.2, pad, 'f', 0.07); rb(s * 1.4, 0, 0, 0.2, 0.55, 2.6, pad, 'f', 0.07); }
      for (const a of [-1, 1]) for (const b of [-1, 1]) cyl(a * 1.38, 0, b * 1.38, 0.24, 0.6, 0xf4a261, 'f', { seg: 16 });
      rb(0, 0.06, 0, 2.6, 0.2, 2.6, 0x35507a, 'p', 0.02);                                    // ball mass
      for (let i = 0; i < 22; i++) for (let j = 0; j < 22; j++) if (r() < 0.82) sph(-1.2 + i * 0.114 + (r() - 0.5) * 0.04, 0.29 + r() * 0.025, -1.2 + j * 0.114 + (r() - 0.5) * 0.04, 0.11, 0.11, 0.11, pick(BRIGHT), 'p');
      break;
    }
    case 'barricade': { // two braced posts, staggered planks, nails and a steel patch
      const post = 0x5c4033, plank = [0xa0724a, 0x8e6440, 0xb3845a];
      for (const a of [-0.85, 0.85]) {
        rb(a, 0, 0, 0.1, 2.4, 0.1, post, 'w', 0.01);
        rb(a, 0, 0, 0.1, 0.06, 0.4, post, 'w', 0.008);                                       // foot
        raw({ s: 'r', x: a, y: 0.23, z: -0.11, sx: 0.06, sy: 0.05, sz: 0.36, c: post, m: 'w', r: 0.008, rx: -1.18 }); // back brace
      }
      [0.25, 0.75, 1.25, 1.75, 2.15].forEach((y, i) => {
        const tilt = (i & 1 ? 1 : -1) * 0.03, x = (i & 1 ? 0.02 : -0.02);
        raw({ s: 'r', x, y, z: 0.065, sx: 1.9, sy: 0.22, sz: 0.03, c: plank[i % 3], m: 'w', r: 0.006, rz: tilt });
        for (const a of [-0.85, 0.85]) for (const dy of [-0.05, 0.05]) box(a, y + dy - 0.006, 0.081, 0.012, 0.012, 0.004, 0x333333, 'm');
      });
      raw({ s: 'r', x: 0, y: 1.2, z: 0.095, sx: 2.1, sy: 0.16, sz: 0.03, c: 0x9a6a44, m: 'w', r: 0.006, rz: 0.82 });
      rb(0.35, 0.9, 0.111, 0.5, 0.42, 0.008, 0x8a9096, 'm', 0.003);
      for (const [dx, dy] of [[-0.22, 0.02], [0.22, 0.02], [-0.22, 0.4], [0.22, 0.4]]) box(0.35 + dx, 0.9 + dy - 0.006, 0.117, 0.012, 0.012, 0.004, 0x333333, 'm');
      break;
    }
    case 'claim': {
      cyl(0, 0, 0, 0.36, 0.08, 0x333333, 'm', { seg: 20 });
      cyl(0, 0.08, 0, 0.035, 2.3, 0xcccccc, 'm');
      sph(0, 2.4, 0, 0.07, 0.07, 0.07, 0xf5c518, 'm');
      const col = FABRICS[c % FABRICS.length];
      raw({ s: 'b', x: 0.17, y: 2.1, z: 0, sx: 0.32, sy: 0.4, sz: 0.012, c: col, m: 'f', ry: 0.1 });
      raw({ s: 'b', x: 0.48, y: 2.09, z: -0.03, sx: 0.3, sy: 0.38, sz: 0.012, c: col, m: 'f', ry: -0.12 });
      break;
    }
    case 'foodcounter': { // self-service hot counter
      rb(0, 0.08, -0.03, 3, 0.82, 0.8, wood, 'w', 0.01);
      box(0, 0, -0.06, 2.96, 0.08, 0.72, 0x2a2a2a, 'p');
      rb(0, 0.9, -0.03, 3.02, 0.04, 0.84, STEEL, 'm', 0.006);
      for (let x = -1.1; x <= 1.11; x += 0.55) {
        rb(x, 0.94, -0.03, 0.5, 0.012, 0.36, 0x6e7276, 'm', 0.003);
        rb(x, 0.95, -0.03, 0.44, 0.03, 0.3, pick([0xb5651d, 0xe9c46a, 0x8ab060, 0xc04030, 0xf0e0c0]), 'p', 0.012);
      }
      for (const x of [-1.45, 0, 1.45]) cyl(x, 0.94, -0.2, 0.03, 0.4, CHROME, 'm');
      raw({ s: 'b', x: 0, y: 1.32, z: -0.13, sx: 3.0, sy: 0.012, sz: 0.36, c: 0xcfe6ee, m: 'p', rx: 0.25 });
      box(0, 0.86, 0.42, 3.0, 0.02, 0.03, CHROME, 'm');                                     // tray rail
      for (const x of [-1.4, -0.47, 0.47, 1.4]) box(x, 0.82, 0.39, 0.03, 0.06, 0.05, CHROME, 'm');
      break;
    }
    case 'register': {
      rb(0, 0.08, 0, 1.6, 0.82, 0.8, 0xe2e2de, 'p', 0.01);
      box(0, 0, -0.03, 1.56, 0.08, 0.72, 0x2a2a2a, 'p');
      rb(-0.2, 0.9, 0.05, 1.1, 0.03, 0.45, 0x1a1a1a, 'p', 0.01);                               // conveyor belt
      for (const x of [-0.75, 0.35]) cyl(x, 0, 0.05, 0.04, 0.46, CHROME, 'm', { rx: Math.PI / 2, y: 0.915 });
      rb(0.55, 0.9, -0.15, 0.35, 0.12, 0.3, 0x2a2a2a, 'p', 0.01);                              // till drawer
      rb(0.55, 1.02, -0.2, 0.05, 0.18, 0.05, 0x2a2a2a, 'p', 0.01);
      rb(0.55, 1.18, -0.2, 0.32, 0.22, 0.03, 0x111111, 'p', 0.008, { rx: -0.25 });
      box(0.55, 1.19, -0.18, 0.28, 0.18, 0.002, 0x30a060, 'e', { rx: -0.25 });
      rb(0.25, 0.9, 0.2, 0.08, 0.03, 0.14, 0x333333, 'p', 0.006);                               // card terminal
      cyl(-0.66, 0.9, -0.3, 0.05, 1.3, 0x888888, 'm');
      rb(-0.66, 2.2, -0.3, 0.26, 0.26, 0.08, 0x1d4fa8, 'e', 0.02);
      break;
    }
    case 'clocktower': {
      rb(0, 0, 0, 3, 0.3, 3, 0x8a8070, 'p', 0.02);
      rb(0, 0.3, 0, 2.6, 0.3, 2.6, 0x9a9080, 'p', 0.02);
      rb(0, 0.6, 0, 2.0, 4.6, 2.0, 0xe8e0d0, 'p', 0.03);
      rb(0, 5.2, 0, 2.3, 0.2, 2.3, 0x9a9080, 'p', 0.02);
      raw({ s: 'c', x: 0, y: 5.6, z: 0, sx: 2.2, sy: 0.4, sz: 2.2, c: 0x6a5a48, m: 'p', seg: 4, t: 0.15, ry: Math.PI / 4 });
      for (let k = 0; k < 4; k++) {
        const ry = k * Math.PI / 2, s = Math.sin(ry), cs = Math.cos(ry), fx = s * 1.0, fz = cs * 1.0;
        raw({ s: 'c', x: fx * 1.01, y: 4.1, z: fz * 1.01, sx: 1.5, sy: 0.04, sz: 1.5, c: 0x3a3028, m: 'p', rx: Math.PI / 2, ry, seg: 32 });
        raw({ s: 'c', x: fx * 1.03, y: 4.1, z: fz * 1.03, sx: 1.36, sy: 0.02, sz: 1.36, c: 0xfff6dc, m: 'e', rx: Math.PI / 2, ry, seg: 32 });
        for (let h = 0; h < 12; h++) { const a = h * Math.PI / 6, rr = 0.58, lx = Math.sin(a) * rr; raw({ s: 'b', x: fx * 1.045 + cs * lx, y: 4.1 + Math.cos(a) * rr, z: fz * 1.045 - s * lx, sx: 0.03, sy: h % 3 ? 0.06 : 0.12, sz: 0.01, c: 0x222222, m: 'p', ry, rz: -a }); }
        raw({ s: 'b', x: fx * 1.047 + cs * 0.1, y: 4.1 + 0.1, z: fz * 1.047 - s * 0.1, sx: 0.04, sy: 0.32, sz: 0.01, c: 0x111111, m: 'p', ry, rz: -0.8 });
        raw({ s: 'b', x: fx * 1.047, y: 4.1 + 0.23, z: fz * 1.047, sx: 0.03, sy: 0.48, sz: 0.01, c: 0x111111, m: 'p', ry });
      }
      break;
    }
    case 'fountain': {
      raw({ s: 'c', x: 0, y: 0.225, z: 0, sx: 4.0, sy: 0.45, sz: 4.0, c: 0xb8b4ac, m: 'p', seg: 8, ry: Math.PI / 8 });
      raw({ s: 'c', x: 0, y: 0.46, z: 0, sx: 3.6, sy: 0.02, sz: 3.6, c: 0x5fb4e0, m: 'e', seg: 8, ry: Math.PI / 8 });
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = 1.75; raw({ s: 'r', x: Math.sin(a) * rr, y: 0.525, z: Math.cos(a) * rr, sx: 1.55, sy: 0.15, sz: 0.28, c: 0xd0ccc4, m: 'p', r: 0.03, ry: a }); }
      cyl(0, 0.45, 0, 0.5, 0.15, 0xc8c4bc, 'p', { seg: 16 });
      cyl(0, 0.6, 0, 0.3, 0.9, 0xd8d4cc, 'p', { t: 0.7, seg: 16 });
      cyl(0, 1.5, 0, 1.2, 0.2, 0xc8c4bc, 'p', { t: 1.5, seg: 20 });
      cyl(0, 1.69, 0, 1.1, 0.02, 0x7fc8ea, 'e', { seg: 20 });
      cyl(0, 1.7, 0, 0.12, 0.3, 0xd8d4cc, 'p', { seg: 12 });
      cyl(0, 2.0, 0, 0.05, 0.3, 0xbfe6f6, 'e', { seg: 8 });
      break;
    }
    case 'pillar': {
      rb(0, 0, 0, 1.0, 0.12, 1.0, 0x5a5a5c, 'p', 0.01);
      rb(0, 0.12, 0, 0.9, 5.76, 0.9, 0xd8d6cc, 'p', 0.03);
      rb(0, 1.1, 0, 0.92, 0.3, 0.92, 0xf5c518, 'p', 0.02);
      for (const y of [1.15, 1.27]) box(0, y, 0, 0.925, 0.03, 0.925, 0x222222, 'p');
      rb(0, 5.88, 0, 1.0, 0.12, 1.0, 0xc8c6bc, 'p', 0.01);
      break;
    }
    case 'pallet': { // EUR-style pallet: 3 bottom boards, 9 blocks, 3 stringers, 5 top boards
      const pw = 0xc9a874, pd = 0xb08f5c;
      for (const x of [-0.5, 0, 0.5]) box(x, 0, 0, 0.1, 0.022, 1.0, pd, 'w');
      for (const x of [-0.5, 0, 0.5]) for (const z of [-0.45, 0, 0.45]) box(x, 0.022, z, 0.1, 0.078, 0.1, pd, 'w');
      for (const x of [-0.5, 0, 0.5]) box(x, 0.1, 0, 0.1, 0.022, 1.0, pw, 'w');
      for (const z of [-0.45, -0.225, 0, 0.225, 0.45]) box(0, 0.122, z, 1.2, 0.022, 0.1, pw, 'w');
      break;
    }
    case 'worklight': { // tripod floodlight
      for (let i = 0; i < 3; i++) { const a = i * 2.094; box(Math.sin(a) * 0.27, 0, Math.cos(a) * 0.27, 0.06, 0.06, 0.06, 0x222222, 'm'); cyl(Math.sin(a) * 0.15, 0.03, Math.cos(a) * 0.15, 0.025, 0.72, 0xe0b020, 'm', { rx: Math.cos(a) * 0.38, rz: -Math.sin(a) * 0.38, y: 0.38 }); }
      cyl(0, 0.5, 0, 0.05, 1.4, 0x2b2d30, 'm');
      rb(0, 1.9, 0, 0.5, 0.36, 0.18, 0xe0b020, 'm', 0.02);
      box(0, 1.94, 0.091, 0.42, 0.28, 0.01, 0xfff6d8, 'e');
      break;
    }
    case 'medstation': { // wall-style first-aid cabinet on a counter
      rb(0, 0, 0, 1.2, 0.9, 0.45, OFFWHITE, 'p', 0.012);
      box(0, 0.9, 0, 1.22, 0.04, 0.47, 0x8c9296, 'p');
      for (const x of [-0.3, 0.3]) { rb(x, 0.1, 0.226, 0.56, 0.7, 0.01, WHITE, 'p', 0.004); barH(x + 0.2, 0.75, 0.24, 0.12); }
      box(0, 0.94, -0.2, 1.0, 0.06, 0.04, 0x2f9a4a, 'e');
      break;
    }
    case 'tree': {
      cyl(0, 0, 0, 0.5, 0.42, 0x3a3d40, 'p', { t: 1.2, seg: 20 });
      cyl(0, 0.4, 0, 0.44, 0.03, 0x3b2a1e, 'f', { seg: 16 });
      cyl(0, 0.42, 0, 0.08, 1.2, 0x6a4a32, 'w', { t: 0.6 });
      const greens = [0x2f6b32, 0x3f8a3c, 0x4f9a48, 0x386f3e];
      for (let i = 0; i < 14; i++) { const a = i * 2.4 + r() * 0.4, d = 0.12 + r() * 0.15, y = 1.45 + (i / 13) * 0.6 + r() * 0.05, sz = 0.4 - (i / 13) * 0.12; sph(Math.cos(a) * d, y, Math.sin(a) * d, sz, sz * 0.85, sz, pick(greens), 'f'); }
      cyl(0, 1.4, 0, 0.05, 0.5, 0x6a4a32, 'w');
      break;
    }
    case 'infodesk': { // curved-front information counter with a blue "i" sign
      rb(0, 0, 0, 2.4, 1.0, 1.0, 0xf2f1ec, 'p', 0.04);
      box(0, 1.0, 0, 2.4, 0.05, 1.0, 0x1d4fa8, 'p');
      box(0, 0.25, 0.501, 2.2, 0.5, 0.004, 0xf5c518, 'p');
      cyl(0.8, 1.05, -0.3, 0.04, 0.9, 0x555555, 'm');
      rb(0.8, 1.95, -0.3, 0.4, 0.4, 0.06, 0x1d4fa8, 'e', 0.03);
      box(0.8, 2.08, -0.268, 0.06, 0.06, 0.004, 0xffffff, 'e');
      box(0.8, 1.99, -0.268, 0.06, 0.13, 0.004, 0xffffff, 'e');
      rb(-0.5, 1.05, -0.2, 0.42, 0.28, 0.04, 0x111111, 'p', 0.01, { rx: -0.2 });
      break;
    }
    case 'sign': {
      cyl(0, 0, 0, 0.3, 0.04, 0x333333, 'm', { seg: 16 });
      cyl(0, 0.04, 0, 0.06, 2.8, 0x3a3a3c, 'm');
      cyl(0, 2.84, 0, 0.09, 0.04, 0x3a3a3c, 'm');
      break;
    }
  }
  return P;
}
