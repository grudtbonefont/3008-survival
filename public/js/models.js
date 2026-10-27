// Procedural textures, furniture/item meshes and character models (all original, built from primitives).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function canvasTex(draw, w = 256, h = 256, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const noise = (g, w, h, amt, alpha = 0.08) => { for (let i = 0; i < amt; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * alpha})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } };
// grayscale detail textures — multiplied by per-instance colors
export const TEX = {
  w: canvasTex((g, w, h) => { // fine straight grain with a few soft growth rings; stripes run along U
    g.fillStyle = '#d6d6d6'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) { const v = 205 + Math.sin(y * 0.35 + Math.sin(y * 0.05) * 3) * 9 + Math.sin(y * 1.7) * 4 + (Math.random() - 0.5) * 10; g.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`; g.fillRect(0, y, w, 1); }
    for (let i = 0; i < 40; i++) { const y = Math.random() * h; g.strokeStyle = `rgba(70,50,30,${0.05 + Math.random() * 0.08})`; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 2); g.stroke(); }
    for (let i = 0; i < 2; i++) { g.strokeStyle = 'rgba(80,60,40,.18)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 10, 3, 0, 0, 7); g.stroke(); }
  }, 512, 512),
  f: canvasTex((g, w, h) => { g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 3) { g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(i, 0, 1, h); g.fillRect(0, i, w, 1); } noise(g, w, h, 4000, 0.1); }),
  m: canvasTex((g, w, h) => { g.fillStyle = '#e0e0e0'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.03})`; g.fillRect(0, y, w, 1); } }),
  p: canvasTex((g, w, h) => { g.fillStyle = '#f0f0f0'; g.fillRect(0, 0, w, h); noise(g, w, h, 1500, 0.05); }),
};
export const floorTex = canvasTex((g, w) => {
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, w);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#cfcfcf' : '#e2e2e2'; g.fillRect(i * w / 2 + 2, j * w / 2 + 2, w / 2 - 4, w / 2 - 4); }
  noise(g, w, w, 3000, 0.06); g.strokeStyle = '#999'; g.lineWidth = 2; g.strokeRect(0, 0, w, w); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, w); g.moveTo(0, w / 2); g.lineTo(w, w / 2); g.stroke();
});
export const ceilTex = canvasTex((g, w) => { g.fillStyle = '#e8e6df'; g.fillRect(0, 0, w, w); noise(g, w, w, 2500, 0.08); g.strokeStyle = '#a8a59a'; g.lineWidth = 6; g.strokeRect(0, 0, w, w); });

export const MATS = {
  w: new THREE.MeshStandardMaterial({ map: TEX.w, roughness: 0.75 }),
  f: new THREE.MeshStandardMaterial({ map: TEX.f, roughness: 0.95 }),
  m: new THREE.MeshStandardMaterial({ map: TEX.m, roughness: 0.35, metalness: 0.5 }),
  p: new THREE.MeshStandardMaterial({ map: TEX.p, roughness: 0.6 }),
  e: new THREE.MeshBasicMaterial({ color: 0xffffff }),
};
export const unitBox = new THREE.BoxGeometry(1, 1, 1);
// Furniture materials: one draw call per material per chunk; colour lives in vertex colours.
export const FMATS = {
  w: new THREE.MeshStandardMaterial({ map: TEX.w, roughness: 0.62, vertexColors: true }),
  f: new THREE.MeshStandardMaterial({ map: TEX.f, roughness: 0.96, vertexColors: true }),
  m: new THREE.MeshStandardMaterial({ map: TEX.m, roughness: 0.32, metalness: 0.35, vertexColors: true }),
  p: new THREE.MeshStandardMaterial({ map: TEX.p, roughness: 0.5, vertexColors: true }),
  e: new THREE.MeshBasicMaterial({ vertexColors: true }),
};

// ---------- part templates (cached) ----------
const TPL = new Map();
const q = (v) => Math.round(v * 1000);
function template(p) {
  const S = [p.sx, p.sy, p.sz];
  if (p.s === 'r') {
    const mn = Math.min(p.sx, p.sy, p.sz), r = Math.min(p.r ?? 0.01, mn / 2 - 0.0005);
    if (r >= 0.004 && mn >= 0.016) {
      const seg = r >= 0.03 ? 3 : r >= 0.012 ? 2 : 1, key = `r${q(p.sx)},${q(p.sy)},${q(p.sz)},${q(r)},${seg}`;
      let g = TPL.get(key); if (!g) TPL.set(key, g = new RoundedBoxGeometry(p.sx, p.sy, p.sz, seg, r));
      return { g, S: [1, 1, 1], U: S };
    }
  }
  if (p.s === 'c') {
    const d = Math.max(p.sx, p.sz), seg = p.seg ?? (d < 0.04 ? 6 : d < 0.3 ? 12 : 20), t = p.t ?? 1, key = `c${t},${seg}`;
    let g = TPL.get(key); if (!g) TPL.set(key, g = new THREE.CylinderGeometry(0.5 * t, 0.5, 1, seg, 1));
    return { g, S, U: S };
  }
  if (p.s === 's') {
    const big = Math.max(p.sx, p.sy, p.sz) > 0.15, key = big ? 'S1' : 'S0';
    let g = TPL.get(key); if (!g) TPL.set(key, g = big ? new THREE.SphereGeometry(0.5, 16, 10) : new THREE.SphereGeometry(0.5, 9, 6));
    return { g, S, U: S };
  }
  return { g: unitBox, S, U: S };
}

// Merge a list of parts into one mesh per material. Parts carry their own placement (X, Z, yaw Y).
export function partsGroup(parts, { shadows = false, matOverride = null } = {}) {
  const by = {};
  for (const p of parts) (by[matOverride ? 'x' : p.m || 'p'] ||= []).push(p);
  const g = new THREE.Group();
  const L = new THREE.Matrix4(), W = new THREE.Matrix4(), M = new THREE.Matrix4(), N = new THREE.Matrix3(), e = new THREE.Euler(0, 0, 0, 'YXZ'), qt = new THREE.Quaternion();
  const v = new THREE.Vector3(), n = new THREE.Vector3(), col = new THREE.Color(), one = new THREE.Vector3(1, 1, 1);
  for (const [k, list] of Object.entries(by)) {
    const tps = list.map(template);
    let nv = 0, ni = 0;
    for (const t of tps) { nv += t.g.attributes.position.count; ni += t.g.index ? t.g.index.count : t.g.attributes.position.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), cl = new Float32Array(nv * 3);
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0, io = 0;
    list.forEach((p, pi) => {
      const { g: tg, S } = tps[pi];
      e.set(p.rx || 0, p.ry || 0, p.rz || 0); qt.setFromEuler(e);
      L.compose(v.set(p.x, p.y, p.z), qt, n.set(S[0], S[1], S[2]));
      W.makeRotationY(p.Y || 0).setPosition(p.X || 0, 0, p.Z || 0);
      M.multiplyMatrices(W, L); N.getNormalMatrix(M);
      col.setHex(p.c ?? 0xffffff);
      const P = tg.attributes.position.array, Nn = tg.attributes.normal.array, cnt = tg.attributes.position.count;
      for (let i = 0; i < cnt; i++) {
        const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2], nx = Nn[i * 3], ny = Nn[i * 3 + 1], nz = Nn[i * 3 + 2];
        v.set(px, py, pz).applyMatrix4(M); const o3 = (vo + i) * 3; pos[o3] = v.x; pos[o3 + 1] = v.y; pos[o3 + 2] = v.z;
        n.set(nx, ny, nz).applyMatrix3(N).normalize(); nor[o3] = n.x; nor[o3 + 1] = n.y; nor[o3 + 2] = n.z;
        // triplanar UVs in metres, chosen by the dominant (scaled) local normal
        const mx = px * S[0], my = py * S[1], mz = pz * S[2], ax = Math.abs(nx / S[0]), ay = Math.abs(ny / S[1]), az = Math.abs(nz / S[2]);
        let u, w;
        if (ay >= ax && ay >= az) { if (p.sx >= p.sz) { u = mx; w = mz; } else { u = mz; w = mx; } }
        else if (ax >= az) { if (p.sz >= p.sy) { u = mz; w = my; } else { u = my; w = mz; } }
        else if (p.sx >= p.sy) { u = mx; w = my; } else { u = my; w = mx; }
        uv[(vo + i) * 2] = u + (p.x || 0) * 0.37; uv[(vo + i) * 2 + 1] = w + (p.z || 0) * 0.29;
        cl[(vo + i) * 3] = col.r; cl[(vo + i) * 3 + 1] = col.g; cl[(vo + i) * 3 + 2] = col.b;
      }
      if (tg.index) { const I = tg.index.array; for (let i = 0; i < I.length; i++) idx[io + i] = I[i] + vo; io += I.length; }
      else { for (let i = 0; i < cnt; i++) idx[io + i] = vo + i; io += cnt; }
      vo += cnt;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.BufferAttribute(cl, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeBoundingSphere(); geo.computeBoundingBox();
    const m = new THREE.Mesh(geo, matOverride || FMATS[k]);
    if (k === 'e') m.userData.emissive = true;
    else if (shadows) { m.castShadow = true; m.receiveShadow = true; }
    g.add(m);
  }
  return g;
}
export function disposeGroup(g) { g.traverse(o => { if (o.isMesh && o.geometry !== unitBox && !o.geometry.userData?.shared && !o.userData.shared) o.geometry.dispose(); }); }

const matCache = {};
export const lam = (c, extra) => matCache[c + (extra ? JSON.stringify(extra) : '')] ||= new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, ...extra });

// ---------- items ----------
const G = {
  plate: new THREE.CylinderGeometry(0.28, 0.24, 0.05, 14), ball: new THREE.SphereGeometry(0.09, 8, 6), bun: new THREE.CapsuleGeometry(0.07, 0.3, 4, 8), sausage: new THREE.CapsuleGeometry(0.045, 0.34, 4, 8),
  carton: new THREE.BoxGeometry(0.16, 0.3, 0.16), cap: new THREE.BoxGeometry(0.17, 0.06, 0.17), cake: new THREE.CylinderGeometry(0.25, 0.25, 0.2, 18), icing: new THREE.CylinderGeometry(0.26, 0.26, 0.04, 18),
  cherry: new THREE.SphereGeometry(0.05, 8, 6), kit: new THREE.BoxGeometry(0.4, 0.22, 0.3), crossA: new THREE.BoxGeometry(0.22, 0.01, 0.06), crossB: new THREE.BoxGeometry(0.06, 0.01, 0.22),
  bat: new THREE.CylinderGeometry(0.06, 0.03, 0.9, 8), pipe: new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), bar: new THREE.BoxGeometry(0.05, 0.85, 0.05), hook: new THREE.BoxGeometry(0.05, 0.05, 0.18),
  can: new THREE.CylinderGeometry(0.07, 0.07, 0.22, 12), slice: new THREE.CylinderGeometry(0.3, 0.3, 0.04, 3, 1, false, 0, 1.1), bag: new THREE.BoxGeometry(0.28, 0.32, 0.1), bowl: new THREE.CylinderGeometry(0.2, 0.12, 0.12, 12),
  cup: new THREE.CylinderGeometry(0.08, 0.06, 0.18, 12), roll: new THREE.CylinderGeometry(0.08, 0.08, 0.2, 12), sheet: new THREE.BoxGeometry(0.35, 0.05, 0.3), plank: new THREE.BoxGeometry(0.9, 0.05, 0.16),
  tip: new THREE.ConeGeometry(0.06, 0.2, 6), nail: new THREE.BoxGeometry(0.2, 0.02, 0.02), leaf: new THREE.SphereGeometry(0.06, 6, 4),
};
for (const g of Object.values(G)) g.userData = { shared: true };
const ITEM_PARTS = {
  meatballs: [[G.plate, 0xffffff, 0, 0, 0], ...[[-0.08, 0], [0.08, 0], [0, 0.1], [0, -0.1], [0, 0]].map(([x, z]) => [G.ball, 0x6b3a1e, x, 0.08, z])],
  hotdog: [[G.bun, 0xe0a060, 0, 0.07, 0, 1], [G.sausage, 0xb03a20, 0, 0.13, 0, 1]],
  pizza: [[G.slice, 0xf0c050, 0, 0.03, 0], [G.ball, 0xc03020, 0.1, 0.06, 0.05], [G.ball, 0xc03020, 0.15, 0.06, -0.06]],
  chips: [[G.bag, 0xe63946, 0, 0.16, 0], [G.cap, 0xffd166, 0, 0.32, 0]],
  salad: [[G.bowl, 0xffffff, 0, 0.06, 0], ...[[0, 0], [0.07, 0.05], [-0.06, 0.04], [0.02, -0.07]].map(([x, z]) => [G.leaf, 0x5aa040, x, 0.13, z])],
  cake: [[G.cake, 0xf3c1d0, 0, 0.1, 0], [G.icing, 0xffffff, 0, 0.2, 0], [G.cherry, 0xd00020, 0, 0.25, 0]],
  juice: [[G.carton, 0xff8c1a, 0, 0.15, 0], [G.cap, 0x2a9d3a, 0, 0.3, 0]],
  soda: [[G.can, 0xc01020, 0, 0.11, 0]], water: [[G.can, 0x60b0ff, 0, 0.11, 0], [G.cap, 0x2050a0, 0, 0.23, 0]],
  coffee: [[G.cup, 0xffffff, 0, 0.09, 0], [G.cap, 0x5c3a1e, 0, 0.18, 0]], meal: [[G.plate, 0xffffff, 0, 0, 0], [G.bowl, 0xc07040, 0, 0.08, 0], [G.ball, 0x6b3a1e, 0, 0.16, 0]],
  medkit: [[G.kit, 0xf4f4f4, 0, 0.11, 0], [G.crossA, 0xd02020, 0, 0.225, 0], [G.crossB, 0xd02020, 0, 0.225, 0]],
  bandage: [[G.roll, 0xf8f0e0, 0, 0.08, 0, 1]], cloth: [[G.sheet, 0x8e3b46, 0, 0.03, 0]], scrap: [[G.sheet, 0x8a9096, 0, 0.03, 0], [G.pipe, 0x777777, 0.1, 0.08, 0, 1]],
  plank: [[G.plank, 0xc19a6b, 0, 0.03, 0], [G.plank, 0xa0724a, 0, 0.08, 0.05]],
  bat: [[G.bat, 0xc8955a, 0, 0.06, 0, 1]], pipe: [[G.pipe, 0x8a9096, 0, 0.05, 0, 1]], crowbar: [[G.bar, 0xc02020, 0, 0.05, 0, 1], [G.hook, 0xc02020, 0.42, 0.05, 0.07]],
  spear: [[G.pipe, 0x8a9096, 0, 0.05, 0, 1], [G.tip, 0xdddddd, 0.55, 0.05, 0, 2]], nailbat: [[G.bat, 0x9c6b3a, 0, 0.06, 0, 1], [G.nail, 0xcccccc, 0.3, 0.1, 0], [G.nail, 0xcccccc, 0.2, 0.06, 0.04]],
};
export function makeItem(type) {
  const g = new THREE.Group();
  for (const [geo, color, x, y, z, lay] of ITEM_PARTS[type] || [[G.kit, 0xff00ff, 0, 0.1, 0]]) {
    const m = new THREE.Mesh(geo, lam(color)); m.position.set(x, y, z);
    if (lay === 1) m.rotation.z = Math.PI / 2; if (lay === 2) m.rotation.z = -Math.PI / 2;
    m.castShadow = true; g.add(m);
  }
  return g;
}

// ---------- characters ----------
export function nameLabel(text, color = '#fff', sub = '') {
  const t = canvasTex((g, w, h) => {
    g.font = 'bold 34px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const tw = g.measureText(text).width + 30; g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.roundRect((w - tw) / 2, 8, tw, 48, 12); g.fill();
    g.fillStyle = color; g.fillText(text, w / 2, 33); if (sub) { g.font = 'bold 22px Arial'; g.fillStyle = '#f5c518'; g.fillText(sub, w / 2, 78); }
  }, 320, 96);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(2.2, 0.66, 1); s.position.y = 2.45; s.renderOrder = 10; return s;
}
// ---------- characters: jointed humanoid rig ----------
// Hierarchy: g > root > hips{pelvis, legL>kneeL>footL, legR…, torso{chest, armL>elbowL>hand, armR…, neck>head}}
// All joints are Groups placed at the anatomical pivot, so rotations bend where real joints bend.
const GEO = new Map();
const shared = (key, make) => { let g = GEO.get(key); if (!g) { g = make(); g.userData = { shared: true }; GEO.set(key, g); } return g; };
const capsule = (r, len) => shared(`cap${q(r)},${q(len)}`, () => new THREE.CapsuleGeometry(r, len, 5, 12));
const rbox = (w, h, d, r) => shared(`rb${q(w)},${q(h)},${q(d)},${q(r)}`, () => new RoundedBoxGeometry(w, h, d, 3, r));
const SPH = () => shared('sph', () => new THREE.SphereGeometry(0.5, 20, 14));
const CAP_HAIR = () => shared('hair', () => new THREE.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52));
const CYL = () => shared('cyl', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 14));
function mesh(geo, mat, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = shadow; parent.add(m); return m;
}
const joint = (parent, x, y, z = 0) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };

// opts: shirt, pants, skin, hair, shoes, hairStyle, W (girth), arm (arm length factor), npc, sleeve (short sleeves)
function buildBody(o) {
  const W = o.W ?? 1, A = o.arm ?? 1;
  const skin = lam(o.skin, { roughness: o.npc ? 0.28 : 0.6 }), shirt = lam(o.shirt, { roughness: 0.85 }), pants = lam(o.pants, { roughness: 0.9 }), shoes = lam(o.shoes ?? 0x222222, { roughness: 0.5 });
  const g = new THREE.Group(), root = joint(g, 0, 0);
  const hipY = 0.92;
  const hips = joint(root, 0, hipY);
  mesh(rbox(0.32 * W, 0.17, 0.2 * W, 0.06), pants, hips, 0, 0.01, 0);                     // pelvis
  mesh(rbox(0.33 * W, 0.045, 0.21 * W, 0.02), lam(0x1d1d1f, { roughness: 0.4 }), hips, 0, 0.085, 0); // belt
  mesh(rbox(0.045, 0.035, 0.012, 0.004), lam(0xb8a060, { metalness: 0.6, roughness: 0.3 }), hips, 0, 0.085, 0.108 * W); // buckle
  const torso = joint(hips, 0, 0.08);
  mesh(rbox(0.335 * W, 0.3, 0.195 * W, 0.08), shirt, torso, 0, 0.14, 0);                  // abdomen
  mesh(rbox(0.37 * W, 0.3, 0.215 * W, 0.085), shirt, torso, 0, 0.33, 0.005);             // chest
  for (const a of [-1, 1]) mesh(SPH(), shirt, torso, a * (0.17 * W + 0.02), 0.405, 0, 0.115 * Math.min(W, 1.1), 0.1, 0.12 * Math.min(W, 1.1)); // deltoids
  // neck + head
  const neck = joint(torso, 0, 0.455);
  mesh(CYL(), skin, neck, 0, 0.03, 0, 0.095, 0.11, 0.095);
  const head = joint(neck, 0, 0.075);
  const headMesh = mesh(SPH(), skin, head, 0, 0.12, 0.005, 0.19, o.npc ? 0.27 : 0.235, 0.215);
  // arms: shoulder > elbow > hand
  const arm = (a) => {
    const sh = joint(torso, a * (0.2 * W + 0.035), 0.4);
    const ua = 0.29 * A, fa = 0.25 * A, ur = 0.047 * Math.min(W, 1.15), fr = 0.04 * Math.min(W, 1.15);
    if (o.sleeve) { mesh(capsule(ur, ua), skin, sh, 0, -ua / 2, 0); mesh(capsule(ur * 1.15, 0.1), shirt, sh, 0, -0.06, 0); }
    else mesh(capsule(ur, ua), shirt, sh, 0, -ua / 2, 0);
    const el = joint(sh, 0, -ua);
    mesh(capsule(fr, fa), o.sleeve ? skin : shirt, el, 0, -fa / 2, 0);
    if (!o.sleeve) mesh(CYL(), skin, el, 0, -fa + 0.005, 0, fr * 2.1, 0.03, fr * 2.1);  // wrist
    const hand = joint(el, 0, -fa - 0.02);
    mesh(rbox(0.045, 0.095, 0.085, 0.02), skin, hand, 0, -0.04, 0.005);                    // palm + fingers
    mesh(capsule(0.014, 0.035), skin, hand, -a * 0.03, -0.03, 0.035, 1, 1, 1).rotation.set(0.5, 0, -a * 0.4); // thumb
    return { sh, el, hand };
  };
  const L = arm(-1), R = arm(1);
  // legs: hip > knee > ankle
  const leg = (a) => {
    const hp = joint(hips, a * 0.09 * W, -0.01);
    mesh(capsule(0.068 * Math.min(W, 1.2), 0.34), pants, hp, 0, -0.21, 0);
    const kn = joint(hp, 0, -0.42);
    mesh(capsule(0.054 * Math.min(W, 1.2), 0.34), pants, kn, 0, -0.2, 0);
    const an = joint(kn, 0, -0.43);
    mesh(rbox(0.1 * Math.min(W, 1.1), 0.075, 0.26, 0.03), shoes, an, 0, -0.035, 0.05);   // shoe
    mesh(rbox(0.105 * Math.min(W, 1.1), 0.02, 0.265, 0.008), lam(0xe8e4dc, { roughness: 0.8 }), an, 0, -0.065, 0.05); // sole
    return { hp, kn, an };
  };
  const LL = leg(-1), RL = leg(1);
  return { g, root, hips, torso, neck, head, headMesh, hipY, legL: LL.hp, legR: RL.hp, kneeL: LL.kn, kneeR: RL.kn, footL: LL.an, footR: RL.an, armL: L.sh, armR: R.sh, elbowL: L.el, elbowR: R.el, handL: L.hand, hand: R.hand, skin, shirt };
}

export function makeHuman({ shirt = 0x3b6fd6, pants = 0x2c3e66, skin = 0xf0c8a0, hair = 0x3b2a1e, shoes = 0x222222, hairStyle = 0 } = {}) {
  const b = buildBody({ shirt, pants, skin, hair, shoes, sleeve: true });
  const H = b.head, hm = lam(hair, { roughness: 0.85 }), dark = lam(0x1a1410, { roughness: 0.3 }), white = lam(0xf4f2ee, { roughness: 0.3 });
  // face (front = +Z)
  for (const a of [-1, 1]) {
    mesh(SPH(), white, H, a * 0.042, 0.132, 0.092, 0.03, 0.022, 0.02, false);
    mesh(SPH(), dark, H, a * 0.042, 0.132, 0.1, 0.015, 0.017, 0.008, false);
    mesh(rbox(0.04, 0.009, 0.012, 0.004), hm, H, a * 0.043, 0.162, 0.096, 1, 1, 1, false).rotation.z = a * -0.12; // brows
    mesh(SPH(), b.skin, H, a * 0.096, 0.12, -0.005, 0.022, 0.05, 0.036);                  // ears
  }
  mesh(rbox(0.026, 0.045, 0.03, 0.011), b.skin, H, 0, 0.105, 0.103, 1, 1, 1, false);       // nose
  mesh(rbox(0.05, 0.009, 0.01, 0.004), lam(0x8a3b32), H, 0, 0.062, 0.094, 1, 1, 1, false); // mouth
  // hair
  const cap = mesh(CAP_HAIR(), hm, H, 0, 0.125, -0.004, 0.205, 0.255, 0.23); cap.rotation.x = -0.32;
  if (hairStyle === 1) { mesh(rbox(0.19, 0.2, 0.06, 0.028), hm, H, 0, 0.08, -0.085); mesh(SPH(), hm, H, 0, 0.17, -0.11, 0.08, 0.08, 0.08); }
  else mesh(rbox(0.15, 0.03, 0.04, 0.014), hm, H, 0, 0.215, 0.075, 1, 1, 1, false).rotation.x = 0.4; // fringe
  // shirt details: collar + hem
  mesh(CYL(), b.shirt, b.torso, 0, 0.445, 0, 0.13, 0.03, 0.12);
  return rig(b, {});
}

// Store employees: same rig, uniform, featureless waxy egg-head, red eyes when hostile (night).
export function makeEmployee(kind = 'staff') {
  const cfg = { staff: { s: 1.1, W: 0.9, arm: 1.06, hunch: 0.04 }, runner: { s: 1.06, W: 0.72, arm: 1.2, hunch: 0.16 }, giant: { s: 1.42, W: 1.22, arm: 1.08, hunch: 0.07 } }[kind] || { s: 1.1, W: 0.9, arm: 1 };
  const b = buildBody({ shirt: 0xf2c014, pants: 0x1c3f8f, skin: kind === 'runner' ? 0xc9c3b8 : 0xe0dbd0, shoes: 0x141414, W: cfg.W, arm: cfg.arm, npc: true, sleeve: true });
  const H = b.head;
  // hollow suggestion of sockets — barely there, which is worse than eyes
  for (const a of [-1, 1]) mesh(SPH(), lam(kind === 'runner' ? 0x6f695f : 0x8a8478, { roughness: 0.6 }), H, a * 0.04, 0.15, 0.089, 0.04, 0.026, 0.016, false);
  // uniform: polo collar, placket, name tag, logo stripe
  const navy = lam(0x1c3f8f, { roughness: 0.8 });
  mesh(CYL(), lam(0xe0ae10, { roughness: 0.85 }), b.torso, 0, 0.445, 0, 0.14, 0.035, 0.13);
  mesh(rbox(0.035, 0.09, 0.01, 0.004), lam(0xe0ae10), b.torso, 0, 0.39, 0.112 * cfg.W, 1, 1, 1, false);
  mesh(rbox(0.07, 0.03, 0.008, 0.003), lam(0xf8f8f8), b.torso, 0.08 * cfg.W, 0.37, 0.114 * cfg.W, 1, 1, 1, false);
  mesh(rbox(0.07, 0.008, 0.009, 0.002), navy, b.torso, 0.08 * cfg.W, 0.38, 0.115 * cfg.W, 1, 1, 1, false);
  mesh(rbox(0.3 * cfg.W, 0.02, 0.2 * cfg.W, 0.008), navy, b.torso, 0, 0.215, 0.0, 1, 1, 1, false);
  // red eyes + soft additive glow (hidden by day)
  const eyes = new THREE.Group(); H.add(eyes);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff2a10 });
  for (const a of [-1, 1]) {
    mesh(SPH(), glowMat, eyes, a * 0.044, 0.15, 0.1, 0.03, 0.018, 0.012, false);
    const sp = new THREE.Sprite(GLOW()); sp.position.set(a * 0.044, 0.15, 0.115); sp.scale.setScalar(0.13); eyes.add(sp);
  }
  eyes.visible = false;
  const mouth = mesh(rbox(0.07, 0.012, 0.01, 0.004), lam(0x2a0505), H, 0, 0.06, 0.098, 1, 1, 1, false); mouth.visible = false;
  b.root.scale.setScalar(cfg.s);
  return rig(b, { eyes, mouth, npc: true, kind, hunch: cfg.hunch });
}
let _glow;
function GLOW() {
  return _glow ||= new THREE.SpriteMaterial({ map: canvasTex((g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,60,30,1)'); gr.addColorStop(0.25, 'rgba(255,20,0,.55)'); gr.addColorStop(1, 'rgba(255,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, 64, 64), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
}

function rig(b, extra) {
  return { ...b, mouth: null, eyes: null, npc: false, hunch: 0, ...extra, phase: 0, swing: 0, held: null, heldType: null, carry: null, carryType: null, twitch: 0, time: 0 };
}
export function setHeld(h, type) {
  if (h.heldType === type) return;
  if (h.held) h.hand.remove(h.held);
  h.held = null; h.heldType = type;
  if (type) { h.held = makeItem(type); h.held.scale.setScalar(0.85); h.held.rotation.set(Math.PI / 2, 0, Math.PI / 2); h.held.position.set(0, -0.05, 0.03); h.hand.add(h.held); }
}
export function setCarry(h, type, partsFn) {
  if (h.carryType === type) return;
  if (h.carry) { h.root.remove(h.carry); disposeGroup(h.carry); }
  h.carry = null; h.carryType = type;
  if (type) {
    h.carry = partsFn(); const bb = new THREE.Box3().setFromObject(h.carry), size = bb.getSize(new THREE.Vector3());
    const s = Math.min(0.45, 0.9 / Math.max(size.x, size.y, size.z, 0.01)); h.carry.scale.setScalar(s);
    h.carry.position.set(0, 1.05 - size.y * s * 0.5, 0.42 + size.z * s * 0.5); h.root.add(h.carry);
  }
}

// state: {moving, speed (0..1.6), air, emote, sleeping, down, hostile}
const damp = (o, prop, axis, target, k, dt) => { const c = o[prop]; c[axis] += (target - c[axis]) * Math.min(1, dt * k); };
export function animate(h, dt, st) {
  const t = (h.time += dt), spd = st.speed || 1, moving = !!st.moving && !st.sleeping && !st.down;
  const run = moving && spd > 1.2;
  if (moving) h.phase += dt * (run ? 10.5 : 7.5) * Math.min(spd, 1.3);
  const s = Math.sin(h.phase), c = Math.cos(h.phase);
  // targets (radians). thigh -x = forward, knee +x = bend, shoulder -x = forward, elbow -x = bend
  const T = { hipL: 0, hipR: 0, kneeL: 0.04, kneeR: 0.04, ftL: 0, ftR: 0, shL: 0.04, shR: 0.04, shLz: -0.07, shRz: 0.07, elL: -0.12, elR: -0.12, torsoX: h.hunch, torsoY: 0, pelvisY: 0, headX: 0, hipsY: h.hipY, rootRX: 0, rootY: 0, rootRY: 0 };
  if (moving) {
    const A = run ? 0.8 : 0.48, K = run ? 1.35 : 0.8;
    T.hipL = -s * A; T.hipR = s * A;
    T.kneeL = 0.06 + K * Math.max(0, c); T.kneeR = 0.06 + K * Math.max(0, -c);
    T.shL = s * A * 0.85; T.shR = -s * A * 0.85; T.shLz = -0.08; T.shRz = 0.08;
    T.elL = run ? -1.45 : -0.25 + Math.min(0, -s) * 0.45; T.elR = run ? -1.45 : -0.25 + Math.min(0, s) * 0.45;
    T.torsoX = h.hunch + (run ? 0.2 : 0.04); T.torsoY = s * (run ? 0.12 : 0.07); T.pelvisY = -s * 0.07;
    T.hipsY = h.hipY + (run ? -0.06 + 0.07 * Math.abs(c) : -0.03 + 0.035 * Math.abs(c));
    T.headX = -T.torsoX * 0.6;
  } else {
    const br = Math.sin(t * 1.7);                                                           // breathing / weight shift
    T.torsoX = h.hunch + br * 0.012; T.shLz = -0.07 - br * 0.015; T.shRz = 0.07 + br * 0.015; T.hipsY = h.hipY - 0.006 + br * 0.004; T.headX = Math.sin(t * 0.6) * 0.03;
  }
  T.ftL = -(T.hipL + T.kneeL) * 0.75; T.ftR = -(T.hipR + T.kneeR) * 0.75;
  if (moving) { T.ftL += Math.max(0, -c) * s * 0.3; T.ftR += Math.max(0, c) * -s * 0.3; }
  if (st.air) { T.hipL = -0.75; T.kneeL = 1.25; T.hipR = -0.15; T.kneeR = 0.45; T.ftL = -0.3; T.ftR = -0.2; T.shL = T.shR = -0.5; T.shLz = -0.55; T.shRz = 0.55; T.elL = T.elR = -0.6; T.torsoX = h.hunch + 0.1; }
  if (h.carry) { T.shL = T.shR = -1.2; T.elL = T.elR = -0.45; T.shLz = 0.12; T.shRz = -0.12; }
  const em = moving ? null : st.emote;
  if (em === 'wave') { T.shR = -0.2; T.shRz = 2.55 + Math.sin(t * 9) * 0.22; T.elR = -0.35; }
  if (em === 'cheer') { const b = Math.abs(Math.sin(t * 7)); T.shLz = -2.75; T.shRz = 2.75; T.elL = T.elR = -0.25; T.hipsY = h.hipY + b * 0.12; T.kneeL = T.kneeR = 0.3 * (1 - b); T.hipL = T.hipR = -0.15 * (1 - b); }
  if (em === 'point') { T.shR = -1.55; T.elR = -0.05; T.shRz = 0.05; T.torsoY = -0.1; }
  if (em === 'dance') {
    const b = Math.sin(t * 8), w = Math.sin(t * 4);
    T.hipsY = h.hipY - 0.05 + Math.abs(b) * 0.05; T.kneeL = T.kneeR = 0.25 - Math.abs(b) * 0.2; T.hipL = T.hipR = -0.12;
    T.shLz = -1.3 - w * 0.6; T.shRz = 1.3 - w * 0.6; T.elL = T.elR = -1.1; T.torsoY = w * 0.3; T.rootRY = w * 0.4; T.headX = b * 0.1;
  }
  if (em === 'sit') { T.hipsY = 0.13; T.hipL = T.hipR = -1.48; T.kneeL = T.kneeR = 0.12; T.ftL = T.ftR = -0.2; T.shL = T.shR = 0.45; T.elL = T.elR = 0; T.shLz = -0.18; T.shRz = 0.18; T.torsoX = -0.12; }
  if (st.sleeping || st.down) {
    T.rootRX = -Math.PI / 2; T.rootY = st.sleeping ? 0.13 : 0.12; T.hipL = T.hipR = 0; T.kneeL = T.kneeR = 0.05; T.ftL = T.ftR = 0.3; T.torsoX = 0; T.torsoY = 0; T.hipsY = h.hipY;
    T.shL = T.shR = 0; T.elL = T.elR = st.down ? 0 : -0.2; T.shLz = st.down ? -0.7 : -0.12; T.shRz = st.down ? 0.9 : 0.12; T.headX = st.down ? 0.3 : 0;
  }
  if (h.swing > 0) { h.swing -= dt * 3.5; const k = Math.sin(Math.max(0, h.swing) * Math.PI); T.shR = -0.4 - 2.2 * k; T.elR = -0.2 - 0.5 * k; T.shRz = 0.15; T.torsoY = -0.35 * k; T.torsoX = h.hunch + 0.1 * k; }
  if (h.npc && st.hostile && !st.down) {
    const j = Math.sin(t * 3);
    T.shL = -1.45 + j * 0.08; T.elL = -0.15; T.shLz = 0.06; if (h.swing <= 0) { T.shR = -1.45 - j * 0.08; T.elR = -0.15; T.shRz = -0.06; }
    T.torsoX = h.hunch + (moving ? 0.25 : 0.12);
  }
  const k = 14;
  damp(h.legL, 'rotation', 'x', T.hipL, k, dt); damp(h.legR, 'rotation', 'x', T.hipR, k, dt);
  damp(h.kneeL, 'rotation', 'x', T.kneeL, k, dt); damp(h.kneeR, 'rotation', 'x', T.kneeR, k, dt);
  damp(h.footL, 'rotation', 'x', T.ftL, k, dt); damp(h.footR, 'rotation', 'x', T.ftR, k, dt);
  damp(h.armL, 'rotation', 'x', T.shL, k, dt); damp(h.armR, 'rotation', 'x', T.shR, k + 4, dt);
  damp(h.armL, 'rotation', 'z', T.shLz, 10, dt); damp(h.armR, 'rotation', 'z', T.shRz, 10, dt);
  damp(h.elbowL, 'rotation', 'x', T.elL, k, dt); damp(h.elbowR, 'rotation', 'x', T.elR, k + 4, dt);
  damp(h.torso, 'rotation', 'x', T.torsoX, 8, dt); damp(h.torso, 'rotation', 'y', T.torsoY, 8, dt); damp(h.hips, 'rotation', 'y', T.pelvisY, 8, dt);
  damp(h.head, 'rotation', 'x', T.headX, 6, dt);
  damp(h.hips, 'position', 'y', T.hipsY, 14, dt);
  damp(h.root, 'rotation', 'x', T.rootRX, 6, dt); damp(h.root, 'rotation', 'y', T.rootRY, 6, dt); damp(h.root, 'position', 'y', T.rootY, 6, dt);
  if (h.npc) {
    h.eyes.visible = !!st.hostile; h.mouth.visible = !!st.hostile;
    h.twitch -= dt;                                                                          // unsettling head twitch
    if (h.twitch < 0) { h.twitch = st.hostile ? 0.3 + Math.random() * 1.2 : 2 + Math.random() * 4; h.tz = (Math.random() - 0.5) * (st.hostile ? 0.9 : 0.3); }
    h.neck.rotation.z += ((h.tz || 0) - h.neck.rotation.z) * Math.min(1, dt * (st.hostile ? 30 : 5));
  }
}
