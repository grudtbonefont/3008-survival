// Procedural textures, furniture/item meshes and character models (all original, built from primitives).
import * as THREE from 'three';

export function canvasTex(draw, w = 256, h = 256, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const noise = (g, w, h, amt, alpha = 0.08) => { for (let i = 0; i < amt; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * alpha})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } };
// grayscale detail textures — multiplied by per-instance colors
export const TEX = {
  w: canvasTex((g, w, h) => { g.fillStyle = '#ddd'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 2) { const v = 190 + Math.sin(y * 0.09 + Math.sin(y * 0.02) * 4) * 30 + Math.random() * 15; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y, w, 2); } for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(80,60,40,.25)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 12, 4, 0, 0, 7); g.stroke(); } }),
  f: canvasTex((g, w, h) => { g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 3) { g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(i, 0, 1, h); g.fillRect(0, i, w, 1); } noise(g, w, h, 4000, 0.1); }),
  m: canvasTex((g, w, h) => { g.fillStyle = '#e0e0e0'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? 0 : 255},${Math.random() < 0.5 ? 0 : 255},255,${Math.random() * 0.06})`; g.fillRect(0, y, w, 1); } }),
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

// One InstancedMesh per material for a list of parts [x,y,z,sx,sy,sz,color,mat]
export function partsGroup(parts, { shadows = false, matOverride = null } = {}) {
  const by = {};
  for (const p of parts) (by[matOverride ? 'x' : p[7] || 'p'] ||= []).push(p);
  const g = new THREE.Group(), o = new THREE.Object3D(), col = new THREE.Color();
  for (const [k, list] of Object.entries(by)) {
    const m = new THREE.InstancedMesh(unitBox, matOverride || MATS[k], list.length);
    list.forEach((p, i) => { o.position.set(p[0], p[1], p[2]); o.scale.set(p[3], p[4], p[5]); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, col.setHex(p[6])); });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    if (shadows && k !== 'e') { m.castShadow = true; m.receiveShadow = true; }
    g.add(m);
  }
  return g;
}
export function disposeGroup(g) { g.traverse(o => { if (o.isInstancedMesh) o.dispose(); if (o.isMesh && o.geometry !== unitBox && !o.userData.shared) o.geometry.dispose(); }); }

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
const bx = (w, h, d, mat, x, y, z, parent) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };

export function makeHuman({ shirt = 0x3b6fd6, pants = 0x2c3e66, skin = 0xf0c8a0, hair = 0x3b2a1e, shoes = 0x222222, hairStyle = 0 } = {}) {
  const g = new THREE.Group(), root = new THREE.Group(); g.add(root);
  const hips = new THREE.Group(); hips.position.y = 0.85; root.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  bx(0.6, 0.62, 0.34, lam(shirt), 0, 0.33, 0, torso); bx(0.62, 0.08, 0.36, lam(0x222222), 0, 0.02, 0, torso);
  bx(0.2, 0.12, 0.02, lam(0xffffff), 0, 0.5, 0.18, torso);
  const neck = new THREE.Group(); neck.position.y = 0.66; torso.add(neck);
  const head = bx(0.42, 0.42, 0.4, lam(skin), 0, 0.23, 0, neck);
  for (const x of [-0.09, 0.09]) { bx(0.07, 0.07, 0.02, lam(0xffffff), x, 0.03, 0.205, head); bx(0.035, 0.045, 0.02, lam(0x1a1a1a), x, 0.025, 0.212, head); }
  bx(0.14, 0.03, 0.02, lam(0x9a4a3a), 0, -0.11, 0.205, head);
  bx(0.44, 0.1, 0.42, lam(hair), 0, 0.22, 0, head); bx(0.44, 0.25, 0.08, lam(hair), 0, 0.1, -0.18, head);
  if (hairStyle === 1) bx(0.3, 0.15, 0.3, lam(hair), 0, 0.3, -0.05, head);
  const limb = (x, y, w, h, mat, parent, endMat) => { const p = new THREE.Group(); p.position.set(x, y, 0); parent.add(p); bx(w, h, w + 0.02, mat, 0, -h / 2, 0, p); if (endMat) bx(w + 0.02, 0.1, w + 0.1, endMat, 0, -h + 0.03, 0.04, p); return p; };
  const legL = limb(-0.15, 0, 0.25, 0.85, lam(pants), hips, lam(shoes)), legR = limb(0.15, 0, 0.25, 0.85, lam(pants), hips, lam(shoes));
  const armL = limb(-0.41, 0.6, 0.19, 0.66, lam(shirt), torso, lam(skin)), armR = limb(0.41, 0.6, 0.19, 0.66, lam(shirt), torso, lam(skin));
  const hand = new THREE.Group(); hand.position.set(0, -0.62, 0.08); armR.add(hand);
  return rig(g, { root, hips, torso, neck, head, legL, legR, armL, armR, hand });
}

// Employees: too tall, too thin, featureless pale faces, hollow eyes that glow at night.
export function makeEmployee(kind = 'staff') {
  const g = new THREE.Group(), root = new THREE.Group(); g.add(root);
  const scale = kind === 'giant' ? 1.4 : kind === 'runner' ? 0.95 : 1.12, thin = kind === 'runner' ? 0.8 : kind === 'giant' ? 1.3 : 0.9;
  const shirt = kind === 'giant' ? 0x1d4fa8 : 0xf5c518, pants = kind === 'runner' ? 0x5a1a1a : 0x1d3060, skin = kind === 'runner' ? 0xb8b0a8 : 0xd9d2c5;
  const hips = new THREE.Group(); hips.position.y = 1.0; root.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  bx(0.56 * thin, 0.74, 0.3 * thin, lam(shirt), 0, 0.38, 0, torso);
  bx(0.24, 0.14, 0.02, lam(kind === 'giant' ? 0xf5c518 : 0x1d4fa8), 0.12, 0.55, 0.16 * thin, torso);
  const neck = new THREE.Group(); neck.position.y = 0.76; torso.add(neck);
  bx(0.12, 0.16, 0.12, lam(skin), 0, 0.06, 0, neck);
  const head = bx(0.4, 0.46, 0.38, lam(skin, { roughness: 0.3 }), 0, 0.34, 0, neck);
  const eyes = new THREE.Group(); head.add(eyes);
  const sockets = [];
  for (const x of [-0.09, 0.09]) { sockets.push(bx(0.08, 0.06, 0.02, lam(0x050505), x, 0.04, 0.195, head)); }
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff2010 });
  for (const x of [-0.09, 0.09]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.02), glowMat); e.position.set(x, 0.04, 0.2); eyes.add(e); }
  eyes.visible = false;
  const mouth = bx(0.18, 0.02, 0.02, lam(0x2a0a0a), 0, -0.13, 0.195, head); mouth.visible = false;
  const limb = (x, y, w, h, mat, parent, endMat) => { const p = new THREE.Group(); p.position.set(x, y, 0); parent.add(p); bx(w, h, w, mat, 0, -h / 2, 0, p); if (endMat) bx(w * 0.9, 0.16, w, endMat, 0, -h - 0.04, 0, p); return p; };
  const legL = limb(-0.14, 0, 0.2 * thin, 1.0, lam(pants), hips, lam(0x111111)), legR = limb(0.14, 0, 0.2 * thin, 1.0, lam(pants), hips, lam(0x111111));
  const armL = limb(-0.36 * thin - 0.03, 0.72, 0.15 * thin, 0.95, lam(shirt), torso, lam(skin)), armR = limb(0.36 * thin + 0.03, 0.72, 0.15 * thin, 0.95, lam(shirt), torso, lam(skin));
  root.scale.setScalar(scale);
  return rig(g, { root, hips, torso, neck, head, legL, legR, armL, armR, eyes, mouth, npc: true, hand: new THREE.Group() });
}

function rig(g, parts) {
  return { g, ...parts, phase: 0, swing: 0, held: null, heldType: null, carry: null, carryType: null, twitch: 0 };
}
export function setHeld(h, type) {
  if (h.heldType === type) return;
  if (h.held) h.hand.remove(h.held);
  h.held = null; h.heldType = type;
  if (type) { h.held = makeItem(type); h.held.scale.setScalar(0.9); h.held.rotation.set(Math.PI / 2, 0, Math.PI / 2); h.held.position.set(0, 0, 0.02); h.hand.add(h.held); }
}
export function setCarry(h, type, partsFn) {
  if (h.carryType === type) return;
  if (h.carry) { h.root.remove(h.carry); disposeGroup(h.carry); }
  h.carry = null; h.carryType = type;
  if (type) { h.carry = partsFn(); const s = 0.45; h.carry.scale.setScalar(s); h.carry.position.set(0, 1.15, 0.55); h.root.add(h.carry); }
}

// state: {moving, speed (0..1.5), air, emote, sleeping, sitting, down, hostile}
export function animate(h, dt, st) {
  const t = (h.time = (h.time || 0) + dt);
  h.phase += dt * (st.moving ? 8 * (st.speed || 1) : 0);
  const s = Math.sin(h.phase), run = (st.speed || 1) > 1.2;
  const amp = st.moving ? (run ? 0.95 : 0.65) : 0;
  const L = (a, b, k) => a + (b - a) * Math.min(1, dt * k);
  let legL = s * amp, legR = -s * amp, armL = -s * amp * 0.9, armR = s * amp * 0.9, torsoX = run ? 0.25 : 0, hipsY = (h.npc ? 1.0 : 0.85) + (st.moving ? Math.abs(Math.cos(h.phase)) * 0.06 : Math.sin(t * 2) * 0.008), rootRX = 0, armLz = 0, armRz = 0;
  if (st.air) { legL = -0.6; legR = 0.3; armL = -2.6; armR = -2.6; }
  if (h.carry) { armL = armR = -1.4; }
  if (st.emote === 'wave') { armR = -2.9 + Math.sin(t * 10) * 0.1; armRz = 0.3 + Math.sin(t * 10) * 0.4; }
  if (st.emote === 'cheer') { armL = armR = -3.0; hipsY += Math.abs(Math.sin(t * 8)) * 0.15; }
  if (st.emote === 'point') { armR = -1.6; }
  if (st.emote === 'dance') { hipsY += Math.abs(Math.sin(t * 8)) * 0.1; armL = -2.5 + Math.sin(t * 8); armR = -0.5 - Math.sin(t * 8); torsoX = Math.sin(t * 4) * 0.2; h.root.rotation.y = Math.sin(t * 4) * 0.5; } else h.root.rotation.y = 0;
  if (st.emote === 'sit') { legL = legR = -1.5; hipsY = 0.45; armL = armR = -0.3; }
  if (st.sleeping || st.down) { rootRX = -Math.PI / 2; legL = legR = 0; armL = armR = st.down ? -0.4 : 0; }
  if (h.swing > 0) { h.swing -= dt * 3.5; const k = Math.max(0, h.swing); armR = -2.6 * Math.sin(k * Math.PI) - 0.2; torsoX = 0.15 * Math.sin(k * Math.PI); }
  if (h.npc && st.hostile && !st.down) { armL = L(h.armL.rotation.x, -1.3 + Math.sin(t * 3) * 0.1, 8); if (h.swing <= 0) armR = -1.3 + Math.cos(t * 3) * 0.1; torsoX = 0.3; }
  h.legL.rotation.x = L(h.legL.rotation.x, legL, 15); h.legR.rotation.x = L(h.legR.rotation.x, legR, 15);
  h.armL.rotation.x = L(h.armL.rotation.x, armL, 15); h.armR.rotation.x = L(h.armR.rotation.x, armR, 18);
  h.armR.rotation.z = L(h.armR.rotation.z, armRz, 10); h.armL.rotation.z = L(h.armL.rotation.z, -armLz, 10);
  h.torso.rotation.x = L(h.torso.rotation.x, torsoX, 8); h.hips.position.y = L(h.hips.position.y, hipsY, 15);
  h.root.rotation.x = L(h.root.rotation.x, rootRX, 6); h.root.position.y = rootRX ? 0.25 : 0;
  if (h.npc) {
    h.eyes.visible = !!st.hostile; h.mouth.visible = !!st.hostile;
    // unsettling head twitch
    h.twitch -= dt;
    if (h.twitch < 0) { h.twitch = st.hostile ? 0.3 + Math.random() * 1.2 : 2 + Math.random() * 4; h.tz = (Math.random() - 0.5) * (st.hostile ? 0.9 : 0.3); }
    h.neck.rotation.z = L(h.neck.rotation.z, h.tz || 0, st.hostile ? 30 : 5);
  }
}
