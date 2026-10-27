// Procedural textures, furniture/item meshes and character models (all original, built from primitives).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BODIES, DEFAULT_AVATAR } from '/shared/avatar.js';

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
  apple: new THREE.SphereGeometry(0.1, 10, 8), stem: new THREE.BoxGeometry(0.015, 0.06, 0.015), banana: new THREE.TorusGeometry(0.16, 0.035, 6, 12, 2.2), bottle: new THREE.CylinderGeometry(0.09, 0.09, 0.42, 12),
  neck: new THREE.CylinderGeometry(0.03, 0.08, 0.1, 10), patty: new THREE.CylinderGeometry(0.13, 0.13, 0.04, 14), bunTop: new THREE.SphereGeometry(0.14, 12, 6, 0, 6.3, 0, 1.4), bunBot: new THREE.CylinderGeometry(0.14, 0.13, 0.05, 14),
  choc: new THREE.BoxGeometry(0.3, 0.03, 0.14), wrap: new THREE.BoxGeometry(0.18, 0.035, 0.145), cookie: new THREE.CylinderGeometry(0.09, 0.09, 0.025, 14), chipdot: new THREE.BoxGeometry(0.025, 0.012, 0.025),
  box: new THREE.BoxGeometry(0.22, 0.26, 0.08), cone: new THREE.ConeGeometry(0.07, 0.2, 10), scoop: new THREE.SphereGeometry(0.075, 10, 8), lemon: new THREE.SphereGeometry(0.08, 10, 8),
  lslice: new THREE.CylinderGeometry(0.08, 0.08, 0.025, 14, 1, false, 0, 3.14), donut: new THREE.TorusGeometry(0.08, 0.04, 8, 16), corn: new THREE.ConeGeometry(0.035, 0.1, 3), shard: new THREE.ConeGeometry(0.07, 0.24, 3),
  tip: new THREE.ConeGeometry(0.06, 0.2, 6), hhead: new THREE.BoxGeometry(0.1, 0.1, 0.26), blade: new THREE.BoxGeometry(0.2, 0.03, 0.22), shield: new THREE.BoxGeometry(0.6, 0.06, 0.7), nail: new THREE.BoxGeometry(0.2, 0.02, 0.02), leaf: new THREE.SphereGeometry(0.06, 6, 4),
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
  apple: [[G.apple, 0xc0181f, 0, 0.1, 0], [G.stem, 0x5a3a1a, 0, 0.21, 0]],
  banana: [[G.banana, 0xf3d23a, 0, 0.04, 0, 3]],
  beans: [[G.can, 0xb8bcc0, 0, 0.11, 0], [G.cap, 0xc85a1a, 0, 0.11, 0, 4]],
  burger: [[G.bunBot, 0xd99a50, 0, 0.03, 0], [G.patty, 0x5a2d14, 0, 0.07, 0], [G.patty, 0x3fae3f, 0, 0.095, 0], [G.bunTop, 0xd99a50, 0, 0.1, 0]],
  chocolate: [[G.choc, 0x4a2612, 0, 0.02, 0], [G.wrap, 0xb8282e, -0.06, 0.025, 0]],
  cookie: [[G.cookie, 0xc8904a, 0, 0.02, 0], [G.chipdot, 0x3a1e0e, 0.03, 0.035, 0.02], [G.chipdot, 0x3a1e0e, -0.04, 0.035, -0.01], [G.chipdot, 0x3a1e0e, 0, 0.035, -0.05]],
  fishcrackers: [[G.box, 0x2c7fd0, 0, 0.13, 0], [G.cookie, 0xf0a030, 0, 0.18, 0.045, 5]],
  icecream: [[G.cone, 0xd8a060, 0, 0.1, 0, 6], [G.scoop, 0xfbe0ec, 0, 0.23, 0]],
  lemon: [[G.lemon, 0xf5e030, 0, 0.08, 0]], lemonslice: [[G.lslice, 0xf5e030, 0, 0.015, 0]],
  donut: [[G.donut, 0xd8955a, 0, 0.04, 0, 7], [G.donut, 0xf07ab0, 0, 0.06, 0, 7]],
  cola2l: [[G.bottle, 0x3a1a10, 0, 0.21, 0], [G.neck, 0x3a1a10, 0, 0.47, 0], [G.cap, 0xc01020, 0, 0.21, 0, 4]],
  cola: [[G.can, 0x8a1010, 0, 0.11, 0]],
  candycorn: [[G.corn, 0xf5f0e0, 0, 0.05, 0], [G.corn, 0xf08a20, 0.07, 0.05, 0.03], [G.corn, 0xf5d020, -0.06, 0.05, 0.04]],
  glass: [[G.shard, 0xbfe6ff, 0, 0.1, 0], [G.shard, 0x9fd0f0, 0.08, 0.06, 0.04, 2]],
  medkit: [[G.kit, 0xf4f4f4, 0, 0.11, 0], [G.crossA, 0xd02020, 0, 0.225, 0], [G.crossB, 0xd02020, 0, 0.225, 0]],
  hammer: [[G.pipe, 0x8b5a2b, 0, 0.05, 0, 1], [G.hhead, 0x55595e, 0.42, 0.05, 0]],
  axe: [[G.bat, 0xc0392b, 0, 0.06, 0, 1], [G.blade, 0xb8bec4, 0.36, 0.05, 0.1]],
  shield: [[G.shield, 0xa0724a, 0, 0.04, 0], [G.crossA, 0x777777, 0, 0.08, 0], [G.crossB, 0x777777, 0, 0.08, 0]],
  plastic: [[G.sheet, 0x3fa9f5, 0, 0.03, 0], [G.cup, 0xf06292, 0.1, 0.09, 0.05]],
  pane: [[G.sheet, 0xbfe6ff, 0, 0.03, 0], [G.shard, 0x9fd0f0, 0.08, 0.06, 0.04, 2]],
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
    if (lay === 3 || lay === 7) m.rotation.x = -Math.PI / 2; if (lay === 4) m.scale.set(0.85, 1.6, 0.85); if (lay === 5) m.rotation.x = Math.PI / 2; if (lay === 6) m.rotation.x = Math.PI;
    if (color === 0xbfe6ff || color === 0x9fd0f0) m.material = lam(color, { transparent: true, opacity: 0.6, roughness: 0.1 });
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
// ---------- characters: blocky avatar (original, built from boxes) ----------
// Classic six-part proportions: cube head, rectangular torso, single-block arms and legs.
// Hierarchy: g > root > hips{legL, legR, torso{arms, neck>head}}; arms pivot at the shoulder, legs at the hip.
const GEO = new Map();
const shared = (key, make) => { let g = GEO.get(key); if (!g) { g = make(); g.userData = { shared: true }; GEO.set(key, g); } return g; };
const rbox = (w, h, d, r) => shared(`rb${q(w)},${q(h)},${q(d)},${q(r)}`, () => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) / 2 - 0.001)));
const PLANE = () => shared('plane', () => new THREE.PlaneGeometry(1, 1));
const SPH = () => shared('sph', () => new THREE.SphereGeometry(0.5, 12, 8));
function mesh(geo, mat, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = shadow; parent.add(m); return m;
}
const joint = (parent, x, y, z = 0) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };
const decalCache = {};
const decal = (key, draw, w = 128, h = 128) => decalCache[key] ||= new THREE.MeshStandardMaterial({ map: canvasTex(draw, w, h), transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 });
// painted faces (drawn on canvas, original artwork)
const FACES = {
  smile: (g, w) => { g.fillStyle = '#1b1b1b'; for (const x of [0.34, 0.66]) { g.beginPath(); g.ellipse(x * w, 0.4 * w, 0.055 * w, 0.085 * w, 0, 0, 7); g.fill(); } g.lineWidth = 0.045 * w; g.lineCap = 'round'; g.strokeStyle = '#1b1b1b'; g.beginPath(); g.arc(w / 2, 0.52 * w, 0.2 * w, 0.18 * Math.PI, 0.82 * Math.PI); g.stroke(); },
  grin: (g, w) => { g.fillStyle = '#1b1b1b'; for (const x of [0.34, 0.66]) { g.beginPath(); g.ellipse(x * w, 0.4 * w, 0.05 * w, 0.08 * w, 0, 0, 7); g.fill(); } g.beginPath(); g.moveTo(0.3 * w, 0.62 * w); g.quadraticCurveTo(w / 2, 0.86 * w, 0.7 * w, 0.62 * w); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.fillRect(0.36 * w, 0.625 * w, 0.28 * w, 0.04 * w); },
  calm: (g, w) => { g.fillStyle = '#1b1b1b'; for (const x of [0.35, 0.65]) g.fillRect(x * w - 0.06 * w, 0.4 * w, 0.12 * w, 0.03 * w); g.lineWidth = 0.035 * w; g.lineCap = 'round'; g.strokeStyle = '#1b1b1b'; g.beginPath(); g.arc(w / 2, 0.55 * w, 0.13 * w, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke(); },
  // employee at night: hollow sockets and a flat, too-wide mouth
  blank: (g, w) => { g.fillStyle = 'rgba(0,0,0,.85)'; for (const x of [0.33, 0.67]) { g.beginPath(); g.ellipse(x * w, 0.42 * w, 0.08 * w, 0.07 * w, 0, 0, 7); g.fill(); } g.fillStyle = 'rgba(40,0,0,.85)'; g.fillRect(0.22 * w, 0.68 * w, 0.56 * w, 0.025 * w); },
};
const faceMat = (k) => decal('face-' + k, FACES[k]);
const tagMat = () => decal('tag', (g, w, h) => { g.fillStyle = '#f8f8f4'; g.fillRect(0, 0, w, h); g.fillStyle = '#1c3f8f'; g.fillRect(0, 0, w, h * 0.32); g.fillStyle = '#fff'; g.font = `bold ${h * 0.24}px Arial`; g.textAlign = 'center'; g.fillText('STAFF', w / 2, h * 0.26); g.fillStyle = '#222'; g.font = `bold ${h * 0.3}px Arial`; g.fillText('HELLO', w / 2, h * 0.78); }, 128, 64);

// o: shirt, pants, skin, shoes, W (width), L (limb length), npc
function buildBody(o) {
  const W = o.W ?? 1, L = o.L ?? 1, U = 0.35;                      // one "stud" = 0.35 m → ~1.85 m avatar
  const skin = lam(o.skin, { roughness: o.npc ? 0.35 : 0.6 }), shirt = o.shirtMat || lam(o.shirt, { roughness: 0.8 }), pants = o.pantsMat || lam(o.pants, { roughness: 0.85 }), shoes = lam(o.shoes ?? 0x262626, { roughness: 0.6 });
  const legH = 2 * U * L, legW = U * W, torW = 2 * U * W, torH = 2 * U, torD = U * Math.min(W, 1.15), armW = U * W * 0.97, armH = 2 * U * L;
  const g = new THREE.Group(), root = joint(g, 0, 0);
  const hipY = legH;
  const hips = joint(root, 0, hipY);
  const leg = (a) => {
    const hp = joint(hips, a * legW / 2, 0);
    const f = o.legSkin || 0, pl = legH * (1 - f);
    if (pl > 0.01) mesh(rbox(legW * 0.98, pl, torD * 0.98, 0.025), pants, hp, 0, -pl / 2, 0);
    if (f > 0) mesh(rbox(legW * 0.9, legH * f, torD * 0.9, 0.025), skin, hp, 0, -legH + legH * f / 2, 0);
    mesh(rbox(legW * 1.0, 0.1, torD * 1.04, 0.025), shoes, hp, 0, -legH + 0.05, 0.004);   // shoe band
    return hp;
  };
  const legL = leg(-1), legR = leg(1);
  const torso = joint(hips, 0, 0);
  mesh(rbox(torW, torH, torD, 0.03), shirt, torso, 0, torH / 2, 0);
  const arm = (a) => {
    const sh = joint(torso, a * (torW / 2 + armW / 2), torH - 0.13);
    mesh(rbox(armW, armH, torD * 0.98, 0.025), skin, sh, 0, 0.13 - armH / 2, 0);
    mesh(rbox(armW * 1.04, armH * 0.38 + 0.01, torD * 1.02, 0.025), shirt, sh, 0, 0.135 - armH * 0.19, 0);  // sleeve
    const hand = joint(sh, 0, 0.13 - armH + 0.06);
    return { sh, hand };
  };
  const A = arm(-1), B = arm(1);
  const neck = joint(torso, 0, torH + 0.02);
  const head = joint(neck, 0, 0);
  const hs = 0.44 * Math.min(Math.max(W, 0.9), 1.1);
  const headMesh = mesh(rbox(hs, hs * 0.95, hs * 0.95, 0.075), skin, head, 0, hs * 0.475, 0);
  const face = mesh(PLANE(), faceMat('smile'), head, 0, hs * 0.475, hs * 0.475 + 0.002, hs * 0.92, hs * 0.92, 1, false); face.visible = false;
  // dummy joints keep the old API surface stable
  const none = new THREE.Group();
  return { g, root, hips, torso, neck, head, headMesh, face, hs, hipY, legL, legR, kneeL: none, kneeR: none, footL: none, footR: none, armL: A.sh, armR: B.sh, elbowL: none, elbowR: none, handL: A.hand, hand: B.hand, skin, shirt, torW, torH, torD, height: hipY + torH + 0.02 + hs * 0.95 };
}

const HAT = [
  (H, s, m) => { mesh(rbox(s * 1.06, s * 0.2, s * 1.04, 0.04), m, H, 0, s * 0.92, 0); mesh(rbox(s * 1.06, s * 0.5, s * 0.16, 0.03), m, H, 0, s * 0.62, -s * 0.47); },               // short hair
  (H, s, m) => { mesh(rbox(s * 1.08, s * 0.22, s * 1.06, 0.04), m, H, 0, s * 0.92, 0); mesh(rbox(s * 1.08, s * 1.2, s * 0.2, 0.04), m, H, 0, s * 0.42, -s * 0.48); for (const a of [-1, 1]) mesh(rbox(s * 0.12, s * 0.75, s * 0.9, 0.03), m, H, a * s * 0.5, s * 0.6, -s * 0.03); }, // long hair
  (H, s, m, c) => { const cm = lam(c, { roughness: 0.7 }); mesh(rbox(s * 1.06, s * 0.3, s * 1.04, 0.06), cm, H, 0, s * 0.98, 0); mesh(rbox(s * 0.9, s * 0.05, s * 0.45, 0.02), cm, H, 0, s * 0.86, s * 0.68); }, // cap
  (H, s, m, c) => { const cm = lam(c, { roughness: 0.95 }); mesh(rbox(s * 1.08, s * 0.4, s * 1.06, 0.1), cm, H, 0, s * 0.98, 0); mesh(rbox(s * 1.1, s * 0.12, s * 1.08, 0.04), lam(0xf2f2f2, { roughness: 0.95 }), H, 0, s * 0.8, 0); mesh(SPH(), cm, H, 0, s * 1.26, 0, s * 0.22, s * 0.2, s * 0.22); }, // beanie
  () => {},                                                                                                                                                        // bald
];
export function makeHuman({ shirt = 0x3b6fd6, pants = 0x2c3e66, skin = 0xf2cf6b, hair = 0x3b2a1e, shoes = 0x262626, hairStyle = 0, hat = null, face = null } = {}) {
  const b = buildBody({ shirt, pants, skin, shoes });
  b.face.material = faceMat(face || ['smile', 'grin', 'calm'][hairStyle % 3]); b.face.visible = true;
  const style = hat ?? hairStyle;
  HAT[((style % HAT.length) + HAT.length) % HAT.length](b.head, b.hs, lam(hair, { roughness: 0.85 }), shirt === pants ? 0x222222 : new THREE.Color(shirt).offsetHSL(0.5, 0, -0.1).getHex());
  const r = rig(b, {}); r.labelY = b.height + 0.55; return r;
}

// Store employees: same blocky body in uniform; blank by day, hollow face + glowing red eyes at night.
export function makeEmployee(kind = 'staff') {
  const cfg = { staff: { s: 1.0, W: 1.0, L: 1.0 }, runner: { s: 1.0, W: 0.72, L: 1.3 }, giant: { s: 1.6, W: 1.22, L: 1.0 } }[kind] || { s: 1, W: 1, L: 1 };
  const b = buildBody({ shirt: 0xf2c014, pants: 0x1c3f8f, skin: kind === 'runner' ? 0xd6d0c4 : 0xe9e3d6, shoes: 0x151515, W: cfg.W, L: cfg.L, npc: true });
  // uniform details: collar band, name-tag decal, navy hem
  mesh(rbox(b.torW * 0.5, 0.05, b.torD * 1.02, 0.02), lam(0xd9a90c, { roughness: 0.8 }), b.torso, 0, b.torH - 0.02, 0, 1, 1, 1, false);
  mesh(PLANE(), tagMat(), b.torso, b.torW * 0.24, b.torH * 0.72, b.torD / 2 + 0.003, 0.16, 0.08, 1, false);
  mesh(rbox(b.torW * 1.01, 0.05, b.torD * 1.02, 0.02), lam(0x1c3f8f, { roughness: 0.8 }), b.torso, 0, 0.04, 0, 1, 1, 1, false);
  b.face.material = faceMat('blank');                              // hidden by day: a perfectly blank head
  const eyes = new THREE.Group(); b.head.add(eyes);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff2a10 });
  for (const a of [-1, 1]) {
    const x = a * (0.33 - 0.5) * -b.hs * 0.92, y = b.hs * 0.475 + b.hs * 0.92 * 0.08, z = b.hs * 0.475 + 0.006;
    mesh(SPH(), glowMat, eyes, x, y, z, 0.05, 0.035, 0.01, false);
    const sp = new THREE.Sprite(GLOW()); sp.position.set(x, y, z + 0.02); sp.scale.setScalar(0.2); eyes.add(sp);
  }
  eyes.visible = false;
  b.root.scale.setScalar(cfg.s);
  const r = rig(b, { eyes, mouth: b.face, npc: true, kind }); r.labelY = b.height * cfg.s + 0.55; return r;
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
  if (type) { h.held = makeItem(type); h.held.scale.setScalar(0.85); h.held.rotation.set(Math.PI / 2, 0, Math.PI / 2); h.held.position.set(0, -0.02, 0.12); h.hand.add(h.held); }
}
export function setCarry(h, type, partsFn) {
  if (h.carryType === type) return;
  if (h.carry) { h.root.remove(h.carry); disposeGroup(h.carry); }
  h.carry = null; h.carryType = type;
  if (type) {
    h.carry = partsFn(); const bb = new THREE.Box3().setFromObject(h.carry), size = bb.getSize(new THREE.Vector3());
    const s = Math.min(0.45, 0.9 / Math.max(size.x, size.y, size.z, 0.01)); h.carry.scale.setScalar(s);
    h.carry.position.set(0, h.hipY + 0.45 - size.y * s * 0.5, 0.5 + size.z * s * 0.5); h.root.add(h.carry);
  }
}

// state: {moving, speed (0..1.6), air, emote, sleeping, down, hostile}
const damp = (o, prop, axis, target, k, dt) => { const c = o[prop]; c[axis] += (target - c[axis]) * Math.min(1, dt * k); };
export function animate(h, dt, st) {
  const t = (h.time += dt), spd = st.speed || 1, moving = !!st.moving && !st.sleeping && !st.down;
  const run = moving && spd > 1.2;
  animateAccessories(h, dt, moving);
  if (moving) h.phase += dt * (run ? 11 : 7.5) * Math.min(spd, 1.3);
  const s = Math.sin(h.phase);
  // targets: legs/arms rotate about X at hip/shoulder (−x = forward); Z spreads limbs sideways
  const T = { hipL: 0, hipR: 0, hipLz: 0, hipRz: 0, shL: 0, shR: 0, shLz: 0, shRz: 0, torsoX: 0, torsoY: 0, headX: 0, headY: 0, rootRX: 0, rootY: 0, rootRY: 0, hipsY: h.hipY };
  if (moving) {
    const A = run ? 1.0 : 0.62;                                     // classic stiff swing, no knees
    T.hipL = s * A; T.hipR = -s * A; T.shL = -s * A; T.shR = s * A;
    if (run) T.torsoX = 0.08;
  } else {
    const br = Math.sin(t * 1.6);                                   // idle: gentle arm sway + head look
    T.shL = br * 0.035; T.shR = -br * 0.035; T.shLz = -0.03; T.shRz = 0.03; T.headY = Math.sin(t * 0.45) * 0.12; T.headX = Math.sin(t * 0.7) * 0.03;
  }
  if (st.air) { T.shL = T.shR = -Math.PI * 0.94; T.shLz = -0.12; T.shRz = 0.12; T.hipL = -0.35; T.hipR = 0.2; T.torsoX = 0; }
  if (h.carry) { T.shL = T.shR = -1.5; T.shLz = 0.1; T.shRz = -0.1; }
  const em = moving ? null : st.emote;
  if (em === 'wave') { T.shR = -0.05; T.shRz = 2.6 + Math.sin(t * 9) * 0.3; T.headY = 0; }
  if (em === 'cheer') { const b = Math.abs(Math.sin(t * 7)); T.shL = T.shR = -Math.PI * 0.95 + b * 0.25; T.shLz = -0.25; T.shRz = 0.25; T.hipsY = h.hipY + b * 0.14; }
  if (em === 'point') { T.shR = -1.57; T.shRz = 0.02; T.torsoY = -0.08; T.headY = 0; }
  if (em === 'dance') { const b = Math.sin(t * 8), w = Math.sin(t * 4); T.shL = -1.2 - b * 0.6; T.shR = -1.2 + b * 0.6; T.shLz = -0.5; T.shRz = 0.5; T.hipL = b * 0.35; T.hipR = -b * 0.35; T.hipsY = h.hipY + Math.abs(b) * 0.05; T.torsoY = w * 0.3; T.rootRY = w * 0.5; T.headX = b * 0.12; }
  if (em === 'sit') { T.hipsY = h.hipY * 0.28; T.hipL = T.hipR = -1.57; T.shL = T.shR = -0.9; T.shLz = -0.05; T.shRz = 0.05; }
  if (st.sleeping || st.down) {
    T.rootRX = -Math.PI / 2; T.rootY = h.torD / 2 * (h.root.scale.x) + 0.01; T.hipL = T.hipR = 0; T.torsoX = 0; T.torsoY = 0; T.hipsY = h.hipY; T.headY = 0; T.headX = 0;
    T.shL = T.shR = 0; T.shLz = st.down ? -0.6 : -0.05; T.shRz = st.down ? 0.9 : 0.05; T.hipLz = st.down ? -0.25 : 0; T.hipRz = st.down ? 0.15 : 0;
  }
  if (h.swing > 0) { h.swing -= dt * 3.5; const k = Math.sin(Math.max(0, h.swing) * Math.PI); T.shR = -0.3 - 2.3 * k; T.shRz = 0.1; T.torsoY = -0.3 * k; }
  if (h.npc && st.hostile && !st.down) {                            // zombie reach
    const j = Math.sin(t * 3);
    T.shL = -1.57 + j * 0.06; T.shLz = 0.04; if (h.swing <= 0) { T.shR = -1.57 - j * 0.06; T.shRz = -0.04; }
    T.torsoX = moving ? 0.1 : 0.04;
  }
  const k = 16;
  damp(h.legL, 'rotation', 'x', T.hipL, k, dt); damp(h.legR, 'rotation', 'x', T.hipR, k, dt);
  damp(h.legL, 'rotation', 'z', T.hipLz, 8, dt); damp(h.legR, 'rotation', 'z', T.hipRz, 8, dt);
  damp(h.armL, 'rotation', 'x', T.shL, k, dt); damp(h.armR, 'rotation', 'x', T.shR, k + 4, dt);
  damp(h.armL, 'rotation', 'z', T.shLz, 10, dt); damp(h.armR, 'rotation', 'z', T.shRz, 10, dt);
  damp(h.torso, 'rotation', 'x', T.torsoX, 8, dt); damp(h.torso, 'rotation', 'y', T.torsoY, 8, dt);
  damp(h.head, 'rotation', 'x', T.headX, 6, dt); damp(h.head, 'rotation', 'y', T.headY, 4, dt);
  damp(h.hips, 'position', 'y', T.hipsY, 14, dt);
  damp(h.root, 'rotation', 'x', T.rootRX, 6, dt); damp(h.root, 'rotation', 'y', T.rootRY, 6, dt); damp(h.root, 'position', 'y', T.rootY, 6, dt);
  if (h.npc) {
    h.eyes.visible = !!st.hostile; h.face.visible = !!st.hostile;  // blank by day, a face appears at night
    h.twitch -= dt;                                                 // unsettling head twitch
    if (h.twitch < 0) { h.twitch = st.hostile ? 0.25 + Math.random() * 1.1 : 2 + Math.random() * 4; h.tz = (Math.random() - 0.5) * (st.hostile ? 0.9 : 0.25); h.ty = st.hostile ? (Math.random() - 0.5) * 0.8 : 0; }
    h.neck.rotation.z += ((h.tz || 0) - h.neck.rotation.z) * Math.min(1, dt * (st.hostile ? 30 : 5));
    h.neck.rotation.y += ((h.ty || 0) - h.neck.rotation.y) * Math.min(1, dt * (st.hostile ? 30 : 5));
  }
}

// ======================================================================================
// Customisable player avatars (v2.4): faces, hair, hats, face accessories, clothing patterns,
// back accessories and body presets. Everything is built from primitives / painted on canvases.
// ======================================================================================
const CONE = () => shared('cone', () => new THREE.ConeGeometry(0.5, 1, 8));
const CYL = () => shared('cyl', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 16));
const TOR = () => shared('tor', () => new THREE.TorusGeometry(0.5, 0.08, 6, 20));
const HSPH = () => shared('hsph', () => new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2));
const BOX = () => shared('box', () => new THREE.BoxGeometry(1, 1, 1));
const hex = (c) => '#' + (c >>> 0).toString(16).padStart(6, '0');
const shade = (c, l) => new THREE.Color(c).offsetHSL(0, 0, l).getHex();
const ink = '#1b1b1b';
const eyes2 = (g, w, ry = 0.085, y = 0.4) => { g.fillStyle = ink; for (const x of [0.34, 0.66]) { g.beginPath(); g.ellipse(x * w, y * w, 0.055 * w, ry * w, 0, 0, 7); g.fill(); } };
const stroke = (g, w, lw = 0.045) => { g.lineWidth = lw * w; g.lineCap = 'round'; g.strokeStyle = ink; };
Object.assign(FACES, {
  wink: (g, w) => { g.fillStyle = ink; g.beginPath(); g.ellipse(0.34 * w, 0.4 * w, 0.055 * w, 0.085 * w, 0, 0, 7); g.fill(); stroke(g, w, 0.04); g.beginPath(); g.moveTo(0.58 * w, 0.42 * w); g.quadraticCurveTo(0.66 * w, 0.34 * w, 0.74 * w, 0.42 * w); g.stroke(); stroke(g, w); g.beginPath(); g.arc(w / 2, 0.52 * w, 0.2 * w, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); },
  wow: (g, w) => { eyes2(g, w, 0.1); g.fillStyle = ink; g.beginPath(); g.ellipse(w / 2, 0.7 * w, 0.07 * w, 0.09 * w, 0, 0, 7); g.fill(); stroke(g, w, 0.03); for (const x of [0.34, 0.66]) { g.beginPath(); g.moveTo((x - 0.07) * w, 0.24 * w); g.lineTo((x + 0.07) * w, 0.22 * w); g.stroke(); } },
  happy: (g, w) => { stroke(g, w, 0.045); for (const x of [0.34, 0.66]) { g.beginPath(); g.arc(x * w, 0.44 * w, 0.07 * w, 1.1 * Math.PI, 1.9 * Math.PI); g.stroke(); } g.fillStyle = ink; g.beginPath(); g.moveTo(0.3 * w, 0.6 * w); g.quadraticCurveTo(w / 2, 0.9 * w, 0.7 * w, 0.6 * w); g.closePath(); g.fill(); g.fillStyle = '#e06070'; g.beginPath(); g.ellipse(w / 2, 0.73 * w, 0.09 * w, 0.04 * w, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(240,110,120,.45)'; for (const x of [0.2, 0.8]) { g.beginPath(); g.ellipse(x * w, 0.58 * w, 0.07 * w, 0.04 * w, 0, 0, 7); g.fill(); } },
  smirk: (g, w) => { eyes2(g, w, 0.07); stroke(g, w, 0.04); g.beginPath(); g.moveTo(0.36 * w, 0.66 * w); g.quadraticCurveTo(0.56 * w, 0.7 * w, 0.68 * w, 0.58 * w); g.stroke(); g.beginPath(); g.moveTo(0.58 * w, 0.27 * w); g.lineTo(0.74 * w, 0.24 * w); g.stroke(); },
  sleepy: (g, w) => { stroke(g, w, 0.04); for (const x of [0.34, 0.66]) { g.beginPath(); g.moveTo((x - 0.07) * w, 0.42 * w); g.lineTo((x + 0.07) * w, 0.42 * w); g.stroke(); } g.beginPath(); g.ellipse(w / 2, 0.68 * w, 0.05 * w, 0.035 * w, 0, 0, 7); g.stroke(); g.fillStyle = '#5a7fbf'; g.font = `bold ${0.16 * w}px Arial`; g.fillText('z', 0.78 * w, 0.24 * w); },
  angry: (g, w) => { eyes2(g, w, 0.07, 0.44); stroke(g, w, 0.045); g.beginPath(); g.moveTo(0.24 * w, 0.28 * w); g.lineTo(0.42 * w, 0.36 * w); g.moveTo(0.76 * w, 0.28 * w); g.lineTo(0.58 * w, 0.36 * w); g.stroke(); g.beginPath(); g.arc(w / 2, 0.8 * w, 0.15 * w, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke(); },
  tongue: (g, w) => { eyes2(g, w); stroke(g, w); g.beginPath(); g.arc(w / 2, 0.52 * w, 0.2 * w, 0.18 * Math.PI, 0.82 * Math.PI); g.stroke(); g.fillStyle = '#e05a6a'; g.beginPath(); g.ellipse(0.55 * w, 0.75 * w, 0.06 * w, 0.08 * w, 0, 0, 7); g.fill(); },
  brave: (g, w) => { eyes2(g, w, 0.07); stroke(g, w, 0.05); for (const x of [0.34, 0.66]) { g.beginPath(); g.moveTo((x - 0.09) * w, 0.27 * w); g.lineTo((x + 0.09) * w, 0.27 * w); g.stroke(); } stroke(g, w, 0.04); g.beginPath(); g.moveTo(0.38 * w, 0.66 * w); g.lineTo(0.62 * w, 0.66 * w); g.stroke(); g.strokeStyle = '#a04040'; g.lineWidth = 0.02 * w; g.beginPath(); g.moveTo(0.7 * w, 0.48 * w); g.lineTo(0.8 * w, 0.62 * w); g.stroke(); },
  freckles: (g, w) => { FACES.smile(g, w); g.fillStyle = 'rgba(150,80,40,.7)'; for (const [x, y] of [[0.22, 0.54], [0.27, 0.58], [0.2, 0.6], [0.78, 0.54], [0.73, 0.58], [0.8, 0.6]]) { g.beginPath(); g.arc(x * w, y * w, 0.012 * w, 0, 7); g.fill(); } },
  cat: (g, w) => { eyes2(g, w, 0.075); g.fillStyle = '#e88aa0'; g.beginPath(); g.moveTo(0.46 * w, 0.52 * w); g.lineTo(0.54 * w, 0.52 * w); g.lineTo(0.5 * w, 0.57 * w); g.fill(); stroke(g, w, 0.03); g.beginPath(); g.arc(0.45 * w, 0.6 * w, 0.05 * w, 0, Math.PI); g.arc(0.55 * w, 0.6 * w, 0.05 * w, 0, Math.PI); g.stroke(); g.lineWidth = 0.012 * w; for (const a of [-1, 1]) for (const d of [-0.03, 0.02]) { g.beginPath(); g.moveTo((0.5 + a * 0.12) * w, (0.56 + d) * w); g.lineTo((0.5 + a * 0.3) * w, (0.54 + d * 2) * w); g.stroke(); } },
  stars: (g, w) => { const star = (cx, cy, r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fill(); }; g.fillStyle = '#f5b800'; star(0.34 * w, 0.4 * w, 0.1 * w); star(0.66 * w, 0.4 * w, 0.1 * w); g.fillStyle = ink; g.beginPath(); g.moveTo(0.32 * w, 0.62 * w); g.quadraticCurveTo(w / 2, 0.86 * w, 0.68 * w, 0.62 * w); g.closePath(); g.fill(); },
});

// ---- clothing textures (two-colour, cached by pattern + colours) ----
const clothTex = {};
function patternTex(kind, c1, c2) {
  const key = kind + c1 + '_' + c2; if (clothTex[key]) return clothTex[key];
  const a = hex(c1), b = hex(c2);
  const t = canvasTex((g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    if (kind === 'stripes') { g.fillStyle = b; for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 13); }
    if (kind === 'plaid') { g.globalAlpha = 0.55; g.fillStyle = b; for (let i = 0; i < w; i += 42) { g.fillRect(i, 0, 14, h); g.fillRect(0, i, w, 14); } g.globalAlpha = 0.3; g.fillStyle = '#000'; for (let i = 21; i < w; i += 42) { g.fillRect(i, 0, 3, h); g.fillRect(0, i, w, 3); } g.globalAlpha = 1; }
    if (kind === 'camo') { const cols = [b, hex(shade(c1, -0.12)), hex(shade(c2, -0.15))]; for (let i = 0; i < 60; i++) { g.fillStyle = cols[i % 3]; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 8 + Math.random() * 22, 5 + Math.random() * 12, Math.random() * 3, 0, 7); g.fill(); } }
    if (kind === 'galaxy') { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#120a2e'); gr.addColorStop(0.5, a); gr.addColorStop(1, '#0b1640'); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (let i = 0; i < 140; i++) { g.fillStyle = Math.random() < 0.3 ? b : '#fff'; const r = Math.random() * 1.8 + 0.4; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, r, 0, 7); g.fill(); } }
    if (kind === 'checker') { g.fillStyle = b; const s = 32; for (let y = 0; y < h; y += s) for (let x = (y / s) % 2 ? s : 0; x < w; x += 2 * s) g.fillRect(x, y, s, s); }
    if (kind === 'jeans') { noise(g, w, h, 5000, 0.12); g.strokeStyle = 'rgba(255,220,120,.6)'; g.setLineDash([5, 4]); g.lineWidth = 2; g.beginPath(); g.moveTo(w * 0.08, 0); g.lineTo(w * 0.08, h); g.moveTo(w * 0.92, 0); g.lineTo(w * 0.92, h); g.stroke(); }
    if (kind === 'knit') noise(g, w, h, 3000, 0.08);
  }, 256, 256);
  return clothTex[key] = t;
}
const clothMat = (kind, c1, c2) => lam(kind === 'plain' ? c1 : 0xffffff, kind === 'plain' ? { roughness: 0.85 } : { roughness: 0.85, map: patternTex(kind, c1, c2) });
// front logos for t-shirts (painted on a transparent decal)
const LOGOS = {
  star: (g, w, c) => { g.fillStyle = c; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? w * 0.17 : w * 0.38; g.lineTo(w / 2 + Math.cos(a) * r, w / 2 + Math.sin(a) * r); } g.closePath(); g.fill(); },
  heart: (g, w, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(w / 2, w * 0.82); g.bezierCurveTo(w * 0.02, w * 0.5, w * 0.2, w * 0.08, w / 2, w * 0.32); g.bezierCurveTo(w * 0.8, w * 0.08, w * 0.98, w * 0.5, w / 2, w * 0.82); g.fill(); },
  number: (g, w, c) => { g.fillStyle = c; g.font = `900 ${w * 0.62}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('08', w / 2, w * 0.55); },
  bolt: (g, w, c) => { g.fillStyle = c; g.beginPath(); [[0.58, 0.06], [0.22, 0.56], [0.46, 0.56], [0.36, 0.94], [0.78, 0.4], [0.54, 0.4], [0.66, 0.06]].forEach(([x, y], i) => i ? g.lineTo(x * w, y * w) : g.moveTo(x * w, y * w)); g.fill(); },
  store: (g, w, c) => { g.fillStyle = c; g.beginPath(); g.roundRect(w * 0.06, w * 0.24, w * 0.88, w * 0.52, w * 0.08); g.fill(); g.fillStyle = '#f5c518'; g.font = `900 ${w * 0.3}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('3008', w / 2, w * 0.46); g.font = `bold ${w * 0.1}px Arial`; g.fillStyle = '#fff'; g.fillText('THE STORE', w / 2, w * 0.66); },
  smiley: (g, w, c) => { g.fillStyle = c; g.beginPath(); g.arc(w / 2, w / 2, w * 0.4, 0, 7); g.fill(); g.fillStyle = ink; for (const x of [0.38, 0.62]) { g.beginPath(); g.ellipse(x * w, w * 0.42, w * 0.04, w * 0.07, 0, 0, 7); g.fill(); } g.lineWidth = w * 0.05; g.strokeStyle = ink; g.beginPath(); g.arc(w / 2, w * 0.5, w * 0.22, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); },
  skull: (g, w, c) => { g.fillStyle = c; g.beginPath(); g.arc(w / 2, w * 0.42, w * 0.3, 0, 7); g.fill(); g.fillRect(w * 0.34, w * 0.6, w * 0.32, w * 0.2); g.fillStyle = '#111'; for (const x of [0.38, 0.62]) { g.beginPath(); g.arc(x * w, w * 0.42, w * 0.08, 0, 7); g.fill(); } g.beginPath(); g.moveTo(w / 2, w * 0.52); g.lineTo(w * 0.45, w * 0.6); g.lineTo(w * 0.55, w * 0.6); g.fill(); for (const x of [0.4, 0.5, 0.6]) g.fillRect(x * w - 1.5, w * 0.68, 3, w * 0.12); },
  suit: (g, w, c) => { g.fillStyle = '#f4f4f4'; g.beginPath(); g.moveTo(w * 0.3, 0); g.lineTo(w * 0.7, 0); g.lineTo(w / 2, w * 0.75); g.fill(); g.fillStyle = c; g.beginPath(); g.moveTo(w * 0.46, w * 0.05); g.lineTo(w * 0.54, w * 0.05); g.lineTo(w * 0.57, w * 0.5); g.lineTo(w / 2, w * 0.62); g.lineTo(w * 0.43, w * 0.5); g.fill(); g.fillStyle = 'rgba(0,0,0,.35)'; for (const y of [0.7, 0.85]) { g.beginPath(); g.arc(w / 2, y * w, w * 0.025, 0, 7); g.fill(); } },
};
const logoMat = (k, c) => decal(`logo-${k}-${c}`, (g, w) => LOGOS[k](g, w, hex(c)), 128, 128);

// ---- hair (colour m) ----
const HAIR_B = {
  none: () => {},
  short: (H, s, m) => { mesh(rbox(s * 1.06, s * 0.2, s * 1.04, 0.04), m, H, 0, s * 0.92, 0); mesh(rbox(s * 1.06, s * 0.5, s * 0.16, 0.03), m, H, 0, s * 0.62, -s * 0.47); for (const a of [-1, 1]) mesh(rbox(s * 0.1, s * 0.3, s * 0.5, 0.02), m, H, a * s * 0.51, s * 0.72, -s * 0.2); },
  buzz: (H, s, m) => { mesh(rbox(s * 1.03, s * 0.08, s * 1.0, 0.03), m, H, 0, s * 0.955, 0); mesh(rbox(s * 1.03, s * 0.35, s * 0.06, 0.02), m, H, 0, s * 0.76, -s * 0.48); },
  long: (H, s, m) => { mesh(rbox(s * 1.08, s * 0.22, s * 1.06, 0.04), m, H, 0, s * 0.92, 0); mesh(rbox(s * 1.08, s * 1.3, s * 0.2, 0.04), m, H, 0, s * 0.38, -s * 0.48); for (const a of [-1, 1]) mesh(rbox(s * 0.12, s * 0.8, s * 0.9, 0.03), m, H, a * s * 0.5, s * 0.58, -s * 0.03); },
  spiky: (H, s, m) => { HAIR_B.short(H, s, m); for (const [x, z, r] of [[0, 0, 0], [-0.3, 0.15, 0.4], [0.3, 0.15, -0.4], [-0.25, -0.25, 0.3], [0.25, -0.25, -0.3], [0, 0.3, 0]]) { const c = mesh(CONE(), m, H, x * s, s * 1.12, z * s, s * 0.26, s * 0.38, s * 0.26); c.rotation.z = r; c.rotation.x = z * 1.2; } },
  mohawk: (H, s, m) => { mesh(rbox(s * 0.2, s * 0.38, s * 1.0, 0.04), m, H, 0, s * 1.12, -s * 0.02); for (let i = 0; i < 4; i++) mesh(CONE(), m, H, 0, s * 1.36, (-0.36 + i * 0.24) * s, s * 0.16, s * 0.18, s * 0.2); },
  afro: (H, s, m) => { mesh(SPH(), m, H, 0, s * 0.92, -s * 0.06, s * 1.55, s * 1.25, s * 1.45); },
  ponytail: (H, s, m) => { HAIR_B.short(H, s, m); const p = mesh(shared('cap', () => new THREE.CapsuleGeometry(0.5, 1.2, 4, 8)), m, H, 0, s * 0.45, -s * 0.66, s * 0.22, s * 0.32, s * 0.22); p.rotation.x = 0.35; mesh(SPH(), lam(0xe74c3c), H, 0, s * 0.78, -s * 0.56, s * 0.14, s * 0.14, s * 0.14); },
  bob: (H, s, m) => { mesh(rbox(s * 1.1, s * 0.24, s * 1.08, 0.05), m, H, 0, s * 0.92, 0); mesh(rbox(s * 1.12, s * 0.8, s * 0.22, 0.05), m, H, 0, s * 0.5, -s * 0.47); for (const a of [-1, 1]) mesh(rbox(s * 0.14, s * 0.72, s * 0.95, 0.04), m, H, a * s * 0.52, s * 0.5, -s * 0.02); mesh(rbox(s * 1.08, s * 0.14, s * 0.12, 0.03), m, H, 0, s * 0.86, s * 0.47); },
  swoop: (H, s, m) => { HAIR_B.short(H, s, m); const f = mesh(rbox(s * 0.85, s * 0.22, s * 0.26, 0.05), m, H, -s * 0.08, s * 0.88, s * 0.42); f.rotation.z = 0.28; },
  pigtails: (H, s, m) => { HAIR_B.short(H, s, m); for (const a of [-1, 1]) { mesh(SPH(), m, H, a * s * 0.66, s * 0.62, -s * 0.12, s * 0.3, s * 0.42, s * 0.3); mesh(SPH(), lam(0xf06292), H, a * s * 0.56, s * 0.8, -s * 0.12, s * 0.12, s * 0.12, s * 0.12); } },
  bun: (H, s, m) => { HAIR_B.buzz(H, s, m); mesh(rbox(s * 1.06, s * 0.16, s * 1.04, 0.04), m, H, 0, s * 0.94, 0); mesh(SPH(), m, H, 0, s * 1.18, -s * 0.18, s * 0.42, s * 0.36, s * 0.42); },
  curly: (H, s, m) => { for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2, r = (i % 2 ? 0.42 : 0.3) * s; mesh(SPH(), m, H, Math.cos(a) * r, s * (0.98 + (i % 3) * 0.04), Math.sin(a) * r - s * 0.05, s * 0.3, s * 0.26, s * 0.3); } mesh(rbox(s * 1.04, s * 0.5, s * 0.2, 0.05), m, H, 0, s * 0.66, -s * 0.46); },
  anime: (H, s, m) => { HAIR_B.short(H, s, m); for (const [x, y, z, rx, rz, l] of [[0, 1.2, -0.1, -0.6, 0, 0.6], [-0.3, 1.1, 0, -0.3, 0.8, 0.5], [0.3, 1.1, 0, -0.3, -0.8, 0.5], [-0.2, 0.9, 0.45, 2.6, 0.4, 0.4], [0.15, 0.9, 0.45, 2.6, -0.3, 0.42], [0, 1.05, -0.4, -1.4, 0, 0.55], [-0.45, 0.75, -0.2, 0, 1.6, 0.4], [0.45, 0.75, -0.2, 0, -1.6, 0.4]]) { const c = mesh(CONE(), m, H, x * s, y * s, z * s, s * 0.24, s * l, s * 0.24); c.rotation.set(rx, 0, rz); } },
};
// ---- hats (colour c) ----
const HAT_B = {
  none: () => {},
  cap: (H, s, c) => { const cm = lam(c, { roughness: 0.7 }); mesh(rbox(s * 1.08, s * 0.32, s * 1.06, 0.06), cm, H, 0, s * 1.0, 0); mesh(rbox(s * 0.92, s * 0.05, s * 0.5, 0.02), cm, H, 0, s * 0.87, s * 0.7); mesh(SPH(), lam(shade(c, -0.15)), H, 0, s * 1.17, 0, s * 0.1, s * 0.06, s * 0.1); },
  backcap: (H, s, c) => { const g = joint(H, 0, 0); g.rotation.y = Math.PI; HAT_B.cap(g, s, c); },
  beanie: (H, s, c) => { const cm = lam(c, { roughness: 0.95, map: patternTex('knit', 0xffffff, 0xffffff) }); mesh(rbox(s * 1.1, s * 0.42, s * 1.08, 0.1), cm, H, 0, s * 0.99, 0); mesh(rbox(s * 1.12, s * 0.14, s * 1.1, 0.04), lam(0xf2f2f2, { roughness: 0.95 }), H, 0, s * 0.8, 0); mesh(SPH(), cm, H, 0, s * 1.27, 0, s * 0.24, s * 0.22, s * 0.24); },
  tophat: (H, s, c) => { const cm = lam(0x1a1a1a, { roughness: 0.5 }); mesh(CYL(), cm, H, 0, s * 0.97, 0, s * 1.45, s * 0.05, s * 1.45); mesh(CYL(), cm, H, 0, s * 1.35, 0, s * 0.92, s * 0.75, s * 0.92); mesh(CYL(), lam(c), H, 0, s * 1.06, 0, s * 0.94, s * 0.12, s * 0.94); },
  cowboy: (H, s, c) => { const cm = lam(c, { roughness: 0.9 }); const b = mesh(CYL(), cm, H, 0, s * 0.97, 0, s * 1.9, s * 0.05, s * 1.7); mesh(rbox(s * 0.95, s * 0.42, s * 0.85, 0.12), cm, H, 0, s * 1.18, 0); mesh(CYL(), lam(0x3a2414), H, 0, s * 1.02, 0, s * 0.98, s * 0.08, s * 0.88); for (const a of [-1, 1]) mesh(rbox(s * 0.5, s * 0.05, s * 1.5, 0.02), cm, H, a * s * 0.75, s * 1.05, 0).rotation.z = a * 0.5; },
  headphones: (H, s, c) => { const cm = lam(c, { roughness: 0.4 }); const band = mesh(shared('half', () => new THREE.TorusGeometry(0.5, 0.06, 6, 20, Math.PI)), cm, H, 0, s * 0.62, 0, s * 1.15, s * 1.0, s * 1.1); for (const a of [-1, 1]) { const cup = mesh(CYL(), lam(0x222222), H, a * s * 0.56, s * 0.5, 0, s * 0.34, s * 0.12, s * 0.34); cup.rotation.z = Math.PI / 2; } band.rotation.y = 0; },
  hardhat: (H, s, c) => { const cm = lam(c, { roughness: 0.35 }); mesh(HSPH(), cm, H, 0, s * 0.86, 0, s * 1.18, s * 0.9, s * 1.18); mesh(CYL(), cm, H, 0, s * 0.88, s * 0.06, s * 1.32, s * 0.05, s * 1.38); mesh(rbox(s * 0.14, s * 0.12, s * 1.1, 0.03), lam(shade(c, -0.1)), H, 0, s * 1.3, 0); },
  chef: (H, s, c) => { const cm = lam(0xffffff, { roughness: 0.95 }); mesh(CYL(), cm, H, 0, s * 1.12, 0, s * 1.05, s * 0.42, s * 1.05); mesh(SPH(), cm, H, 0, s * 1.48, 0, s * 1.3, s * 0.65, s * 1.3); mesh(CYL(), lam(c), H, 0, s * 0.95, 0, s * 1.07, s * 0.06, s * 1.07); },
  party: (H, s, c) => { const cm = lam(c, { roughness: 0.6, map: patternTex('stripes', 0xffffff, 0xf5c518) }); mesh(CONE(), cm, H, 0, s * 1.33, 0, s * 0.62, s * 0.75, s * 0.62); mesh(SPH(), lam(0xffffff), H, 0, s * 1.74, 0, s * 0.16, s * 0.16, s * 0.16); },
  bucket: (H, s, c) => { const cm = lam(c, { roughness: 0.95 }); mesh(shared('frus', () => new THREE.CylinderGeometry(0.4, 0.5, 1, 16)), cm, H, 0, s * 1.06, 0, s * 1.18, s * 0.34, s * 1.18); mesh(shared('brim', () => new THREE.CylinderGeometry(0.5, 0.6, 1, 16, 1, true)), cm, H, 0, s * 0.86, 0, s * 1.5, s * 0.1, s * 1.5).material = lam(c, { roughness: 0.95, side: THREE.DoubleSide }); },
  beret: (H, s, c) => { const b = mesh(SPH(), lam(c, { roughness: 0.95 }), H, -s * 0.1, s * 1.02, 0, s * 1.25, s * 0.28, s * 1.2); b.rotation.z = 0.18; mesh(CYL(), lam(c), H, -s * 0.06, s * 1.17, 0, s * 0.06, s * 0.1, s * 0.06); },
  ushanka: (H, s, c) => { const fur = lam(0xd9cdb8, { roughness: 1, map: patternTex('knit', 0xffffff, 0xffffff) }); mesh(rbox(s * 1.14, s * 0.4, s * 1.12, 0.1), lam(c, { roughness: 0.95 }), H, 0, s * 1.04, 0); mesh(rbox(s * 1.2, s * 0.18, s * 1.18, 0.06), fur, H, 0, s * 0.85, 0); for (const a of [-1, 1]) mesh(rbox(s * 0.14, s * 0.6, s * 0.7, 0.05), fur, H, a * s * 0.6, s * 0.55, 0); mesh(rbox(s * 0.9, s * 0.3, s * 0.12, 0.05), fur, H, 0, s * 1.05, s * 0.56); },
  bandana: (H, s, c) => { const cm = lam(c, { roughness: 0.9, map: patternTex('camo', c, 0xffffff) }); mesh(rbox(s * 1.08, s * 0.16, s * 1.06, 0.04), cm, H, 0, s * 0.82, 0); mesh(rbox(s * 1.08, s * 0.12, s * 1.06, 0.06), cm, H, 0, s * 0.96, 0); for (const a of [-1, 1]) mesh(rbox(s * 0.08, s * 0.3, s * 0.12, 0.02), cm, H, a * s * 0.12, s * 0.66, -s * 0.58).rotation.z = a * 0.4; },
  helmet: (H, s, c) => { const cm = lam(c, { roughness: 0.3, metalness: 0.3 }); mesh(HSPH(), cm, H, 0, s * 0.7, 0, s * 1.3, s * 1.0, s * 1.3); mesh(rbox(s * 0.9, s * 0.18, s * 0.1, 0.04), lam(0x222831, { roughness: 0.2, metalness: 0.5 }), H, 0, s * 0.82, s * 0.6); mesh(rbox(s * 0.12, s * 0.12, s * 1.2, 0.03), lam(0xffffff), H, 0, s * 1.2, 0); },
  viking: (H, s, c) => { mesh(HSPH(), lam(0x9aa0a6, { roughness: 0.35, metalness: 0.6 }), H, 0, s * 0.82, 0, s * 1.18, s * 0.85, s * 1.18); mesh(CYL(), lam(0x6b4a2b), H, 0, s * 0.85, 0, s * 1.2, s * 0.1, s * 1.2); for (const a of [-1, 1]) { const h = mesh(CONE(), lam(0xf3ead2), H, a * s * 0.72, s * 1.15, 0, s * 0.2, s * 0.55, s * 0.2); h.rotation.z = -a * 0.9; } },
  pumpkin: (H, s, c) => { const pm = lam(0xe67e22, { roughness: 0.7 }); for (let i = 0; i < 6; i++) { const r = mesh(SPH(), pm, H, 0, s * 0.5, 0, s * 1.35, s * 1.15, s * 0.7); r.rotation.y = i * Math.PI / 6; } mesh(CYL(), lam(0x3f6b2a), H, 0, s * 1.15, 0, s * 0.12, s * 0.2, s * 0.12); mesh(PLANE(), decal('pumpkin', (g, w) => { g.fillStyle = '#2a1300'; g.beginPath(); g.moveTo(0.28 * w, 0.44 * w); g.lineTo(0.4 * w, 0.28 * w); g.lineTo(0.44 * w, 0.46 * w); g.fill(); g.beginPath(); g.moveTo(0.72 * w, 0.44 * w); g.lineTo(0.6 * w, 0.28 * w); g.lineTo(0.56 * w, 0.46 * w); g.fill(); g.beginPath(); g.moveTo(0.22 * w, 0.6 * w); for (let i = 0; i <= 8; i++) g.lineTo((0.22 + i * 0.07) * w, (i % 2 ? 0.66 : 0.6) * w); g.lineTo(0.78 * w, 0.66 * w); g.quadraticCurveTo(w / 2, 0.86 * w, 0.22 * w, 0.66 * w); g.fill(); }), H, 0, s * 0.5, s * 0.58, s * 1.05, s * 1.05, 1, false); H.userData.hideFace = true; },
  wizard: (H, s, c) => { const cm = lam(c, { roughness: 0.8 }); mesh(CYL(), cm, H, 0, s * 0.97, 0, s * 1.7, s * 0.05, s * 1.7); const t = mesh(CONE(), cm, H, 0, s * 1.6, -s * 0.05, s * 0.95, s * 1.3, s * 0.95); t.rotation.x = -0.12; mesh(PLANE(), decal('wizstar', (g, w) => LOGOS.star(g, w, '#f5c518')), H, 0, s * 1.4, s * 0.36, s * 0.3, s * 0.3, 1, false).rotation.x = -0.35; },
  crown: (H, s, c) => { const gold = lam(0xf5c518, { roughness: 0.25, metalness: 0.8 }); mesh(shared('crown', () => new THREE.CylinderGeometry(0.5, 0.45, 1, 8, 1, true)), gold, H, 0, s * 1.08, 0, s * 1.0, s * 0.3, s * 1.0).material = lam(0xf5c518, { roughness: 0.25, metalness: 0.8, side: THREE.DoubleSide }); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; mesh(CONE(), gold, H, Math.sin(a) * s * 0.48, s * 1.32, Math.cos(a) * s * 0.48, s * 0.14, s * 0.22, s * 0.14); if (i % 2 === 0) mesh(SPH(), lam([0xe74c3c, 0x3fa9f5, 0x2ecc71, 0x8e44ad][i / 2], { roughness: 0.1 }), H, Math.sin(a) * s * 0.51, s * 1.08, Math.cos(a) * s * 0.51, s * 0.1, s * 0.1, s * 0.1); } },
  halo: (H, s, c) => { const r = mesh(TOR(), new THREE.MeshBasicMaterial({ color: 0xfff3a0 }), H, 0, s * 1.35, 0, s * 0.95, s * 0.95, s * 0.95, false); r.rotation.x = Math.PI / 2; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW().map, color: 0xffe680, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 })); sp.scale.setScalar(s * 1.8); sp.position.y = s * 1.35; H.add(sp); },
};
// ---- face accessories (front of head is +z at hs*0.475) ----
const FW_B = {
  none: () => {},
  glasses: (H, s, c, F) => { const fm = lam(0x222222, { roughness: 0.4 }); for (const a of [-1, 1]) { mesh(rbox(s * 0.3, s * 0.2, s * 0.04, 0.01), fm, H, a * s * 0.16, s * 0.57, F + 0.012); mesh(BOX(), lam(0xcfe8ff, { transparent: true, opacity: 0.35, roughness: 0.05 }), H, a * s * 0.16, s * 0.57, F + 0.035, s * 0.24, s * 0.14, 0.004, false); mesh(BOX(), fm, H, a * s * 0.5, s * 0.6, F - s * 0.2, 0.012, 0.012, s * 0.44, false); } mesh(BOX(), fm, H, 0, s * 0.6, F + 0.02, s * 0.06, 0.012, 0.012, false); },
  sunglasses: (H, s, c, F) => { const fm = lam(0x111111, { roughness: 0.15, metalness: 0.4 }); for (const a of [-1, 1]) { mesh(rbox(s * 0.34, s * 0.18, s * 0.04, 0.02), fm, H, a * s * 0.17, s * 0.57, F + 0.014); mesh(BOX(), fm, H, a * s * 0.5, s * 0.6, F - s * 0.2, 0.012, 0.012, s * 0.44, false); } mesh(BOX(), fm, H, 0, s * 0.61, F + 0.02, s * 0.1, 0.014, 0.014, false); },
  round: (H, s, c, F) => { const fm = lam(0xc0a060, { roughness: 0.3, metalness: 0.7 }); for (const a of [-1, 1]) mesh(TOR(), fm, H, a * s * 0.16, s * 0.57, F + 0.015, s * 0.26, s * 0.26, s * 0.26, false); mesh(BOX(), fm, H, 0, s * 0.6, F + 0.015, s * 0.08, 0.01, 0.01, false); },
  eyepatch: (H, s, c, F) => { const fm = lam(0x111111, { roughness: 0.8 }); mesh(rbox(s * 0.22, s * 0.2, s * 0.03, 0.02), fm, H, s * 0.16, s * 0.57, F + 0.012); const st = mesh(BOX(), fm, H, 0, s * 0.66, 0, s * 1.04, 0.014, s * 0.98, false); st.rotation.z = -0.35; },
  mask: (H, s, c, F) => { const mm = lam(0xa8d8f0, { roughness: 0.95 }); mesh(rbox(s * 0.72, s * 0.32, s * 0.08, 0.03), mm, H, 0, s * 0.34, F + 0.02); for (const a of [-1, 1]) mesh(BOX(), lam(0xffffff), H, a * s * 0.43, s * 0.42, F - s * 0.15, 0.01, 0.01, s * 0.3, false); },
  goggles: (H, s, c, F) => { const band = lam(0x333333, { roughness: 0.9 }); mesh(rbox(s * 1.08, s * 0.14, s * 1.04, 0.03), band, H, 0, s * 0.58, 0); for (const a of [-1, 1]) { const g = mesh(CYL(), lam(c, { roughness: 0.3 }), H, a * s * 0.17, s * 0.58, F + 0.03, s * 0.28, s * 0.08, s * 0.28); g.rotation.x = Math.PI / 2; const l = mesh(CYL(), lam(0x99ddff, { roughness: 0.05, metalness: 0.3 }), H, a * s * 0.17, s * 0.58, F + 0.07, s * 0.22, 0.004, s * 0.22, false); l.rotation.x = Math.PI / 2; } },
  mustache: (H, s, c, F, hc) => { const hm = lam(hc, { roughness: 0.9 }); for (const a of [-1, 1]) { const m = mesh(rbox(s * 0.22, s * 0.07, s * 0.05, 0.02), hm, H, a * s * 0.1, s * 0.44, F + 0.014); m.rotation.z = a * 0.25; } },
  beard: (H, s, c, F, hc) => { const hm = lam(hc, { roughness: 0.95 }); mesh(rbox(s * 0.98, s * 0.3, s * 0.16, 0.05), hm, H, 0, s * 0.16, F - s * 0.02); for (const a of [-1, 1]) mesh(rbox(s * 0.12, s * 0.36, s * 0.6, 0.03), hm, H, a * s * 0.47, s * 0.32, F - s * 0.3); mesh(rbox(s * 0.5, s * 0.08, s * 0.05, 0.02), hm, H, 0, s * 0.44, F + 0.012); },
  visor: (H, s, c, F) => { mesh(rbox(s * 1.08, s * 0.22, s * 0.06, 0.03), lam(c, { transparent: true, opacity: 0.6, roughness: 0.05, metalness: 0.5, emissive: c, emissiveIntensity: 0.4 }), H, 0, s * 0.58, F + 0.025); mesh(rbox(s * 1.1, s * 0.06, s * 1.05, 0.02), lam(0xd9d9d9, { metalness: 0.6, roughness: 0.3 }), H, 0, s * 0.7, 0); },
  hockey: (H, s, c, F) => { mesh(PLANE(), decal('hockey', (g, w) => { g.fillStyle = '#f2efe6'; g.beginPath(); g.ellipse(w / 2, w / 2, w * 0.46, w * 0.5, 0, 0, 7); g.fill(); g.fillStyle = '#c0392b'; for (const a of [-1, 1]) { g.beginPath(); g.moveTo(w / 2 + a * w * 0.08, w * 0.12); g.lineTo(w / 2 + a * w * 0.2, w * 0.26); g.lineTo(w / 2 + a * w * 0.12, w * 0.3); g.fill(); } g.fillStyle = '#111'; for (const x of [0.33, 0.67]) { g.beginPath(); g.ellipse(x * w, 0.42 * w, 0.09 * w, 0.06 * w, 0, 0, 7); g.fill(); } for (let i = 0; i < 12; i++) { g.beginPath(); g.arc((0.34 + (i % 4) * 0.1) * w, (0.62 + ((i / 4) | 0) * 0.08) * w, 0.02 * w, 0, 7); g.fill(); } }), H, 0, s * 0.475, F + 0.02, s * 0.98, s * 0.95, 1, false); H.userData.hideFace = true; },
  monocle: (H, s, c, F) => { const gm = lam(0xf5c518, { metalness: 0.8, roughness: 0.2 }); mesh(TOR(), gm, H, s * 0.16, s * 0.57, F + 0.015, s * 0.28, s * 0.28, s * 0.28, false); const ch = mesh(BOX(), gm, H, s * 0.26, s * 0.38, F + 0.012, 0.008, s * 0.36, 0.008, false); ch.rotation.z = 0.3; },
};
// ---- back accessories (torso back is -z) ----
const BACK_B = {
  none: () => {},
  backpack: (T, b, c) => { const m = lam(c, { roughness: 0.85 }); mesh(rbox(b.torW * 0.78, b.torH * 0.85, 0.22, 0.05), m, T, 0, b.torH * 0.5, -b.torD / 2 - 0.11); mesh(rbox(b.torW * 0.6, b.torH * 0.32, 0.08, 0.03), lam(shade(c, -0.12)), T, 0, b.torH * 0.32, -b.torD / 2 - 0.25); for (const a of [-1, 1]) mesh(BOX(), lam(0x222222), T, a * b.torW * 0.26, b.torH * 0.6, b.torD / 2 + 0.004, 0.05, b.torH * 0.9, 0.012, false); },
  cape: (T, b, c) => { const cp = mesh(BOX(), lam(c, { roughness: 0.9, side: THREE.DoubleSide }), T, 0, b.torH - b.torH * 0.95, -b.torD / 2 - 0.04, b.torW * 1.1, b.torH * 1.9, 0.025); cp.rotation.x = 0.12; cp.position.y = b.torH * 0.06; T.userData.cape = cp; },
  guitar: (T, b, c) => { const g = joint(T, 0, b.torH * 0.45, -b.torD / 2 - 0.08); g.rotation.z = 0.7; const m = lam(c, { roughness: 0.4 }); for (const [y, r] of [[-0.18, 0.2], [0.04, 0.15]]) { const k = mesh(CYL(), m, g, 0, y, 0, r * 2, 0.08, r * 2); k.rotation.x = Math.PI / 2; } mesh(BOX(), lam(0x3a2414), g, 0, 0.38, 0, 0.06, 0.55, 0.04); mesh(BOX(), lam(0x222222), g, 0, 0.68, 0, 0.1, 0.12, 0.05); },
  tank: (T, b, c) => { for (const a of [-1, 1]) { mesh(CYL(), lam(c, { metalness: 0.6, roughness: 0.3 }), T, a * 0.11, b.torH * 0.5, -b.torD / 2 - 0.12, 0.2, b.torH * 0.95, 0.2); mesh(SPH(), lam(c, { metalness: 0.6, roughness: 0.3 }), T, a * 0.11, b.torH * 0.97, -b.torD / 2 - 0.12, 0.2, 0.14, 0.2); } mesh(CYL(), lam(0x888888, { metalness: 0.8 }), T, 0, b.torH * 1.05, -b.torD / 2 - 0.12, 0.06, 0.12, 0.06); },
  wings: (T, b, c) => { const m = lam(c, { roughness: 0.7, side: THREE.DoubleSide }); for (const a of [-1, 1]) { const w = joint(T, a * 0.1, b.torH * 0.7, -b.torD / 2 - 0.05); w.rotation.set(0, a * -0.5, a * -0.35); for (let i = 0; i < 3; i++) { const f = mesh(rbox(0.55 - i * 0.1, 0.14, 0.03, 0.02), m, w, a * (0.3 - i * 0.03), -i * 0.12, 0); f.rotation.z = a * (0.2 + i * 0.25); } T.userData.wings = (T.userData.wings || []).concat(w); } },
  sword: (T, b, c) => { const g = joint(T, 0, b.torH * 0.5, -b.torD / 2 - 0.06); g.rotation.z = -0.65; mesh(BOX(), lam(0x3a2414, { roughness: 0.5 }), g, 0, 0, 0, 0.1, 0.85, 0.05); mesh(BOX(), lam(0xf5c518, { metalness: 0.8, roughness: 0.3 }), g, 0, 0.45, 0, 0.26, 0.05, 0.07); mesh(BOX(), lam(c), g, 0, 0.58, 0, 0.05, 0.2, 0.05); mesh(SPH(), lam(0xf5c518, { metalness: 0.8 }), g, 0, 0.7, 0, 0.07, 0.07, 0.07); },
  jetpack: (T, b, c) => { const m = lam(c, { metalness: 0.5, roughness: 0.35 }); mesh(rbox(b.torW * 0.5, b.torH * 0.5, 0.12, 0.03), lam(0x555b62, { metalness: 0.6 }), T, 0, b.torH * 0.6, -b.torD / 2 - 0.07); for (const a of [-1, 1]) { mesh(CYL(), m, T, a * 0.15, b.torH * 0.55, -b.torD / 2 - 0.17, 0.17, b.torH * 0.8, 0.17); const n = mesh(CONE(), m, T, a * 0.15, b.torH * 0.08, -b.torD / 2 - 0.17, 0.15, 0.12, 0.15); n.rotation.x = Math.PI; const fl = mesh(CONE(), new THREE.MeshBasicMaterial({ color: 0xffa020, transparent: true, opacity: 0.85 }), T, a * 0.15, -b.torH * 0.08, -b.torD / 2 - 0.17, 0.11, 0.22, 0.11, false); fl.rotation.x = Math.PI; T.userData.flames = (T.userData.flames || []).concat(fl); } },
};

export function makeAvatar(av) {
  av = { ...DEFAULT_AVATAR, ...(av || {}) };
  const body = BODIES.find(o => o.id === av.body) || BODIES[1];
  const sp = av.shirtPat, pp = av.pantsPat;
  const shirtKind = ['stripes', 'plaid', 'camo', 'galaxy'].includes(sp) ? sp : 'plain';
  const pantsKind = pp === 'jeans' ? 'jeans' : pp === 'camo' ? 'camo' : pp === 'checker' ? 'checker' : 'plain';
  const shirtMat = clothMat(shirtKind, av.shirt, av.shirt2), pantsMat = clothMat(pantsKind, av.pants, pp === 'checker' ? 0xffffff : shade(av.pants, -0.12));
  const b = buildBody({ shirt: av.shirt, pants: av.pants, skin: av.skin, shoes: av.shoes, W: body.W, L: body.L, shirtMat, pantsMat, legSkin: pp === 'shorts' ? 0.5 : pp === 'skirt' ? 0.55 : 0 });
  const s = b.hs, F = s * 0.475;
  // shirt details
  if (LOGOS[sp]) mesh(PLANE(), logoMat(sp, av.shirt2), b.torso, 0, b.torH * 0.55, b.torD / 2 + 0.004, b.torW * 0.62, b.torW * 0.62, 1, false);
  if (sp === 'suit') { mesh(PLANE(), logoMat('suit', av.shirt2), b.torso, 0, b.torH * 0.62, b.torD / 2 + 0.004, b.torW * 0.55, b.torH * 0.75, 1, false); }
  if (sp === 'hoodie') { const hm = lam(shade(av.shirt, -0.06), { roughness: 0.9 }); mesh(rbox(b.torW * 0.7, 0.22, 0.2, 0.08), hm, b.torso, 0, b.torH - 0.02, -b.torD / 2 - 0.02); mesh(rbox(b.torW * 0.6, b.torH * 0.24, 0.03, 0.02), hm, b.torso, 0, b.torH * 0.25, b.torD / 2 + 0.01); for (const a of [-1, 1]) mesh(BOX(), lam(av.shirt2), b.torso, a * 0.06, b.torH * 0.78, b.torD / 2 + 0.012, 0.018, b.torH * 0.28, 0.01, false); }
  // pants details
  if (pp === 'track') for (const L of [b.legL, b.legR]) for (const a of [-1, 1]) mesh(BOX(), lam(0xffffff), L, a * b.torW * 0.25 * 0.98 + a * 0.003, -b.hipY / 2, 0, 0.006, b.hipY * 0.95, 0.04, false);
  if (pp === 'cargo') for (const [L, a] of [[b.legL, -1], [b.legR, 1]]) mesh(rbox(0.05, 0.16, 0.14, 0.015), lam(shade(av.pants, -0.08)), L, a * b.torW * 0.25 + a * 0.02, -b.hipY * 0.48, 0);
  if (pp === 'skirt') mesh(shared('skirt', () => new THREE.CylinderGeometry(0.5, 0.62, 1, 12)), pantsMat, b.hips, 0, -b.hipY * 0.27, 0, b.torW * 1.05, b.hipY * 0.55, b.torD * 1.5);
  // belt
  if (pp !== 'skirt') mesh(rbox(b.torW * 1.01, 0.05, b.torD * 1.02, 0.015), lam(0x2b2116, { roughness: 0.6 }), b.torso, 0, 0.03, 0, 1, 1, 1, false);
  b.face.material = faceMat(FACES[av.face] ? av.face : 'smile'); b.face.visible = true;
  const hm = lam(av.hairColor, { roughness: 0.85 });
  // hats sit over a flattened version of the hair
  const hatOn = av.hat !== 'none' && av.hat !== 'headphones' && av.hat !== 'halo' && av.hat !== 'bandana';
  const hairK = hatOn && ['afro', 'mohawk', 'spiky', 'anime', 'curly', 'bun'].includes(av.hair) ? 'short' : av.hair;
  (HAIR_B[hairK] || HAIR_B.short)(b.head, s, hm);
  (HAT_B[av.hat] || HAT_B.none)(b.head, s, av.hatColor);
  (FW_B[av.facewear] || FW_B.none)(b.head, s, av.accColor, F, av.hairColor);
  if (b.head.userData.hideFace) b.face.visible = false;
  (BACK_B[av.back] || BACK_B.none)(b.torso, b, av.accColor);
  const r = rig(b, { fx: b.torso.userData }); r.labelY = b.height + 0.55 + (['tophat', 'wizard', 'chef', 'party'].includes(av.hat) ? 0.3 : 0); r.av = av; return r;
}
// small per-frame touches for accessories (cape sway, jet flames, wing flap)
export function animateAccessories(h, dt, moving) {
  const fx = h.fx; if (!fx) return;
  if (fx.cape) fx.cape.rotation.x += ((moving ? 0.45 : 0.1) + Math.sin(h.time * 3) * 0.04 - fx.cape.rotation.x) * Math.min(1, dt * 5);
  if (fx.flames) for (const f of fx.flames) { f.scale.y = 0.18 + Math.random() * 0.12; f.visible = moving || Math.sin(h.time * 2) > 0; }
  if (fx.wings) fx.wings.forEach((w, i) => { w.rotation.y = (i ? 1 : -1) * (0.5 + Math.sin(h.time * (moving ? 8 : 2)) * 0.12); });
}
// Backwards-compatible: makeHuman(old colour args) maps onto the avatar system.
export function humanFromHue(hue) {
  const hsl = (h, s, l) => new THREE.Color().setHSL(h, s, l).getHex();
  return makeAvatar({ shirt: hsl(hue, 0.65, 0.5), pants: hsl((hue + 0.5) % 1, 0.3, 0.25), skin: [0xf2cf6b, 0xf0c8a0, 0xd1a07a, 0x8d5a3b][(hue * 40 | 0) % 4], hairColor: [0x3b2a1e, 0x111111, 0xd4a650, 0x8b3a1a][(hue * 97 | 0) % 4], hair: ['short', 'long', 'buzz', 'bob', 'spiky'][(hue * 10 | 0) % 5] });
}
