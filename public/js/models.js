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
  apple: new THREE.SphereGeometry(0.1, 10, 8), stem: new THREE.BoxGeometry(0.015, 0.06, 0.015), banana: new THREE.TorusGeometry(0.16, 0.035, 6, 12, 2.2), bottle: new THREE.CylinderGeometry(0.09, 0.09, 0.42, 12),
  neck: new THREE.CylinderGeometry(0.03, 0.08, 0.1, 10), patty: new THREE.CylinderGeometry(0.13, 0.13, 0.04, 14), bunTop: new THREE.SphereGeometry(0.14, 12, 6, 0, 6.3, 0, 1.4), bunBot: new THREE.CylinderGeometry(0.14, 0.13, 0.05, 14),
  choc: new THREE.BoxGeometry(0.3, 0.03, 0.14), wrap: new THREE.BoxGeometry(0.18, 0.035, 0.145), cookie: new THREE.CylinderGeometry(0.09, 0.09, 0.025, 14), chipdot: new THREE.BoxGeometry(0.025, 0.012, 0.025),
  box: new THREE.BoxGeometry(0.22, 0.26, 0.08), cone: new THREE.ConeGeometry(0.07, 0.2, 10), scoop: new THREE.SphereGeometry(0.075, 10, 8), lemon: new THREE.SphereGeometry(0.08, 10, 8),
  lslice: new THREE.CylinderGeometry(0.08, 0.08, 0.025, 14, 1, false, 0, 3.14), donut: new THREE.TorusGeometry(0.08, 0.04, 8, 16), corn: new THREE.ConeGeometry(0.035, 0.1, 3), shard: new THREE.ConeGeometry(0.07, 0.24, 3),
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
  const skin = lam(o.skin, { roughness: o.npc ? 0.35 : 0.6 }), shirt = lam(o.shirt, { roughness: 0.8 }), pants = lam(o.pants, { roughness: 0.85 }), shoes = lam(o.shoes ?? 0x262626, { roughness: 0.6 });
  const legH = 2 * U * L, legW = U * W, torW = 2 * U * W, torH = 2 * U, torD = U * Math.min(W, 1.15), armW = U * W * 0.97, armH = 2 * U * L;
  const g = new THREE.Group(), root = joint(g, 0, 0);
  const hipY = legH;
  const hips = joint(root, 0, hipY);
  const leg = (a) => {
    const hp = joint(hips, a * legW / 2, 0);
    mesh(rbox(legW * 0.98, legH, torD * 0.98, 0.025), pants, hp, 0, -legH / 2, 0);
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
