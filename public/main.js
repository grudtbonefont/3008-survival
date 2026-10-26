import * as THREE from 'three';
import { World, CHUNK, CEIL, ITEMS, TYPES, FISTS, worldParts, aabb, isNight } from '/shared/world.js';

const $ = (id) => document.getElementById(id);
const RADIUS = 2;              // chunk view radius
let socket, world, myId, cycle = 480, dayLen = 300, clockT = 0;
let stats = { hp: 100, hunger: 100, energy: 100, inv: Array(6).fill(null), carry: null, dead: false };
let sel = 0, carryRot = 0, flashlight = false;

// ---------- three setup ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const DAY_BG = new THREE.Color(0xd8d4c4), NIGHT_BG = new THREE.Color(0x05060a);
scene.background = DAY_BG.clone();
scene.fog = new THREE.Fog(DAY_BG.clone(), 10, 55);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 200);
const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8070, 1.1); scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 0.5); dir.position.set(3, 10, 2); scene.add(dir);
const flash = new THREE.SpotLight(0xfff4d0, 0, 30, 0.5, 0.5, 1.2); scene.add(flash); scene.add(flash.target);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

function canvasTex(draw, w = 256, h = 256) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const floorTex = canvasTex((g, w) => { g.fillStyle = '#b9b3a3'; g.fillRect(0, 0, w, w); g.fillStyle = '#aaa494'; g.fillRect(0, 0, w / 2, w / 2); g.fillRect(w / 2, w / 2, w / 2, w / 2); g.strokeStyle = '#8f8a7c'; g.lineWidth = 3; g.strokeRect(0, 0, w, w); });
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(100, 100);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ map: floorTex }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);
const ceilTex = canvasTex((g, w) => { g.fillStyle = '#e8e6df'; g.fillRect(0, 0, w, w); g.strokeStyle = '#c4c1b6'; g.lineWidth = 4; g.strokeRect(0, 0, w, w); });
ceilTex.wrapS = ceilTex.wrapT = THREE.RepeatWrapping; ceilTex.repeat.set(200, 200);
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ map: ceilTex }));
ceil.rotation.x = Math.PI / 2; ceil.position.y = CEIL; scene.add(ceil);

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const furnMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
const panelMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const signTex = {};
function getSignTex(text) {
  return signTex[text] ||= canvasTex((g, w, h) => { g.fillStyle = '#1d4fa8'; g.fillRect(0, 0, w, h); g.fillStyle = '#f5c518'; g.font = 'bold 38px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2); }, 512, 128);
}

// Build an InstancedMesh (one draw call) from a list of world parts
function partsMesh(parts, mat = furnMat) {
  const m = new THREE.InstancedMesh(unitBox, mat, Math.max(1, parts.length));
  const o = new THREE.Object3D(), col = new THREE.Color();
  parts.forEach((p, i) => { o.position.set(p[0], p[1], p[2]); o.scale.set(p[3], p[4], p[5]); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, col.setHex(p[6])); });
  m.count = parts.length; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.computeBoundingSphere();
  return m;
}

// ---------- items ----------
const itemGeo = {
  meatballs: [[new THREE.CylinderGeometry(0.28, 0.24, 0.05, 12), 0xffffff, 0], [new THREE.SphereGeometry(0.09, 8, 6), 0x6b3a1e, 0.08, [[-0.08, 0], [0.08, 0], [0, 0.1], [0, -0.1]]]],
  hotdog: [[new THREE.CapsuleGeometry(0.07, 0.3, 4, 8), 0xe0a060, 0.07, null, true], [new THREE.CapsuleGeometry(0.045, 0.34, 4, 8), 0xb03a20, 0.13, null, true]],
  juice: [[new THREE.BoxGeometry(0.16, 0.3, 0.16), 0xff8c1a, 0.15], [new THREE.BoxGeometry(0.17, 0.08, 0.17), 0x2a9d3a, 0.2]],
  cake: [[new THREE.CylinderGeometry(0.25, 0.25, 0.2, 16), 0xf3c1d0, 0.1], [new THREE.CylinderGeometry(0.26, 0.26, 0.04, 16), 0xffffff, 0.2], [new THREE.SphereGeometry(0.05), 0xd00020, 0.25]],
  medkit: [[new THREE.BoxGeometry(0.4, 0.22, 0.3), 0xf4f4f4, 0.11], [new THREE.BoxGeometry(0.22, 0.01, 0.06), 0xd02020, 0.225], [new THREE.BoxGeometry(0.06, 0.01, 0.22), 0xd02020, 0.225]],
  bat: [[new THREE.CylinderGeometry(0.06, 0.03, 0.9, 8), 0xc8955a, 0.06, null, true]],
  pipe: [[new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), 0x8a9096, 0.05, null, true]],
  crowbar: [[new THREE.BoxGeometry(0.05, 0.85, 0.05), 0xc02020, 0.05, null, true], [new THREE.BoxGeometry(0.05, 0.05, 0.18), 0xc02020, 0.05]],
};
const matCache = {};
const lam = (c) => matCache[c] ||= new THREE.MeshLambertMaterial({ color: c });
function makeItem(type) {
  const g = new THREE.Group();
  for (const [geo, color, y, multi, lay] of itemGeo[type] || []) {
    for (const [ox, oz] of multi || [[0, 0]]) {
      const m = new THREE.Mesh(geo, lam(color)); m.position.set(ox, y, oz); if (lay) m.rotation.z = Math.PI / 2; g.add(m);
    }
  }
  return g;
}

// ---------- characters ----------
function label(text, color = '#fff') {
  const t = canvasTex((g, w, h) => { g.font = 'bold 34px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(0,0,0,.45)'; const tw = g.measureText(text).width + 24; g.fillRect((w - tw) / 2, 10, tw, 44); g.fillStyle = color; g.fillText(text, w / 2, 33); }, 256, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(2, 0.5, 1); s.position.y = 2.35; s.renderOrder = 10; return s;
}
function makeHuman({ shirt, pants = 0x2c3e66, skin = 0xf0c8a0, npc = false }) {
  const g = new THREE.Group();
  const box = (w, h, d, c, x, y, z, parent = g) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c)); m.position.set(x, y, z); parent.add(m); return m; };
  box(0.62, 0.7, 0.36, shirt, 0, 1.15, 0);
  const head = box(0.42, 0.42, 0.42, skin, 0, 1.73, 0);
  let eyes;
  if (npc) { eyes = new THREE.Group(); for (const x of [-0.09, 0.09]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: 0xff1010 })); e.position.set(x, 0.04, 0.215); eyes.add(e); } head.add(eyes); eyes.visible = false; box(0.2, 0.12, 0.02, 0x1d4fa8, 0.15, 1.3, 0.185); }
  else for (const x of [-0.09, 0.09]) box(0.06, 0.07, 0.02, 0x222222, x, 1.77, 0.215);
  const limb = (x, y, w, h, c) => { const p = new THREE.Group(); p.position.set(x, y, 0); g.add(p); box(w, h, w + 0.02, c, 0, -h / 2, 0, p); return p; };
  const legL = limb(-0.16, 0.8, 0.26, 0.8, pants), legR = limb(0.16, 0.8, 0.26, 0.8, pants);
  const armL = limb(-0.42, 1.48, 0.2, 0.68, npc ? shirt : skin), armR = limb(0.42, 1.48, 0.2, 0.68, npc ? shirt : skin);
  const hand = new THREE.Group(); hand.position.set(0, -0.62, 0.1); armR.add(hand);
  const carryBox = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.7), lam(0xa07850)); carryBox.position.set(0, 1.3, 0.55); carryBox.visible = false; g.add(carryBox);
  return { g, legL, legR, armL, armR, hand, eyes, carryBox, phase: 0, swing: 0, held: null, heldType: null };
}
function animateHuman(h, moving, dt, speed = 1) {
  h.phase += dt * (moving ? 9 * speed : 0);
  const a = moving ? Math.sin(h.phase) * 0.7 : h.legL.rotation.x * 0.8;
  h.legL.rotation.x = a; h.legR.rotation.x = -a; h.armL.rotation.x = -a * 0.8;
  if (h.carryBox.visible) { h.armL.rotation.x = h.armR.rotation.x = -1.3; }
  else if (h.swing > 0) { h.swing -= dt * 4; h.armR.rotation.x = -2.2 * Math.sin(Math.max(0, h.swing) * Math.PI); }
  else h.armR.rotation.x = a * 0.8;
}
function setHeld(h, type) {
  if (h.heldType === type) return;
  if (h.held) h.hand.remove(h.held);
  h.held = null; h.heldType = type;
  if (type) { h.held = makeItem(type); if (ITEMS[type]?.weapon) { h.held.rotation.x = Math.PI / 2; h.held.children.forEach(c => c.rotation.z = 0); h.held.rotation.set(Math.PI / 2, 0, 0); h.held.position.z = 0.3; } h.hand.add(h.held); }
}

// ---------- local player ----------
const me = { x: 0, y: 0, z: 0, vy: 0, ry: 0, onGround: true, human: makeHuman({ shirt: 0x3b6fd6 }) };
scene.add(me.human.g);
let yaw = 0, pitch = 0.3, camDist = 5;

// ---------- world rendering (chunk streaming) ----------
const chunks = new Map();    // key -> {group, items: Map}
const itemMeshes = new Map(); // id -> mesh
let picked = new Set();
const placedMeshes = new Map();
function buildChunk(cx, cz) {
  const key = cx + ',' + cz;
  const old = chunks.get(key); if (old) disposeChunk(key);
  const ch = world.chunk(cx, cz), group = new THREE.Group();
  const parts = [];
  for (const f of ch.furn) {
    if (world.removed.has(f.id)) continue;
    parts.push(...worldParts(f));
    if (f.type === 'sign') {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: getSignTex(f.text || 'EXIT'), side: THREE.DoubleSide }));
      b.position.set(f.x, 3.2, f.z); b.rotation.y = Math.PI / 2; group.add(b);
    }
  }
  group.add(partsMesh(parts));
  const panels = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) panels.push([cx * CHUNK + 3 + i * 6, CEIL - 0.03, cz * CHUNK + 3 + j * 6, 1.4, 0.05, 1.4, 0xffffff]);
  group.add(partsMesh(panels, panelMat));
  scene.add(group);
  const items = [];
  for (const it of ch.items) if (!picked.has(it.id)) items.push(spawnItemMesh(it));
  chunks.set(key, { group, items: ch.items });
}
function spawnItemMesh(it) {
  if (itemMeshes.has(it.id)) return;
  const m = makeItem(it.type); m.position.set(it.x, 0.05, it.z); m.userData.item = it; scene.add(m); itemMeshes.set(it.id, m);
}
function disposeChunk(key) {
  const c = chunks.get(key); if (!c) return;
  scene.remove(c.group);
  c.group.traverse(o => { if (o.isInstancedMesh) o.dispose(); if (o.isMesh && o.geometry !== unitBox) o.geometry.dispose(); });
  for (const it of c.items) { const m = itemMeshes.get(it.id); if (m) { scene.remove(m); itemMeshes.delete(it.id); } }
  chunks.delete(key);
}
function streamChunks() {
  const pcx = Math.floor(me.x / CHUNK), pcz = Math.floor(me.z / CHUNK);
  const want = new Set();
  for (let i = -RADIUS; i <= RADIUS; i++) for (let j = -RADIUS; j <= RADIUS; j++) want.add((pcx + i) + ',' + (pcz + j));
  for (const k of [...chunks.keys()]) if (!want.has(k)) disposeChunk(k);
  let built = 0;
  for (const k of want) if (!chunks.has(k) && built < 3) { const [a, b] = k.split(',').map(Number); buildChunk(a, b); built++; }
}
const chunkKeyOf = (x, z) => Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK);
function rebuildChunkOf(x, z) { const k = chunkKeyOf(x, z); if (chunks.has(k)) { const [a, b] = k.split(',').map(Number); buildChunk(a, b); } }
function addPlacedMesh(o) {
  world.addPlaced(o);
  const m = partsMesh(worldParts(o)); scene.add(m); placedMeshes.set(o.id, m);
}

// ---------- other players / npcs ----------
const others = new Map(), npcViews = new Map();
function upsertOther(s) {
  let o = others.get(s.id);
  if (!o) {
    const h = makeHuman({ shirt: new THREE.Color().setHSL(s.hue, 0.6, 0.5).getHex() });
    h.g.add(label(s.name)); scene.add(h.g);
    o = { h, x: s.x, y: s.y, z: s.z, ry: s.ry }; others.set(s.id, o);
  }
  Object.assign(o, { tx: s.x, ty: s.y, tz: s.z, try: s.ry, anim: s.anim, dead: s.dead });
  o.h.carryBox.visible = !!s.carry; setHeld(o.h, s.carry ? null : s.held);
}
function upsertNpc(s) {
  let n = npcViews.get(s.id);
  if (!n) { const h = makeHuman({ shirt: 0xf5c518, pants: 0x1d3060, skin: 0xd9c3a5, npc: true }); h.g.position.set(s.x, 0, s.z); scene.add(h.g); n = { h }; npcViews.set(s.id, n); }
  Object.assign(n, { tx: s.x, tz: s.z, try: s.ry, m: s.m, hostile: s.h, seen: performance.now() });
}
const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };

// ---------- HUD ----------
const hotbar = $('hotbar');
for (let i = 0; i < 6; i++) { const d = document.createElement('div'); d.className = 'slot'; hotbar.appendChild(d); }
function renderHud() {
  $('hp').style.width = stats.hp + '%'; $('hunger').style.width = stats.hunger + '%'; $('energy').style.width = stats.energy + '%';
  [...hotbar.children].forEach((d, i) => { d.className = 'slot' + (i === sel ? ' sel' : ''); d.innerHTML = `<b>${i + 1}</b>`; d.append(stats.inv[i] ? ITEMS[stats.inv[i]].name : ''); });
  $('carry').textContent = stats.carry ? `Carrying: ${TYPES[stats.carry.type].name} — LMB/Q place · R rotate` : '';
}
let msgTimer, annTimer;
function showMsg(t) { $('msg').textContent = t; clearTimeout(msgTimer); msgTimer = setTimeout(() => $('msg').textContent = '', 2000); }
function showAnnounce(t) { $('announce').textContent = '📢 ' + t; clearTimeout(annTimer); annTimer = setTimeout(() => $('announce').textContent = '', 7000); }
function addChat(m) {
  const d = document.createElement('div');
  if (m.sys) { d.className = 'sys'; d.textContent = m.text; } else { const b = document.createElement('b'); b.textContent = m.name + ': '; d.append(b, m.text); }
  $('log').appendChild(d); while ($('log').children.length > 12) $('log').firstChild.remove();
}

// ---------- input ----------
const keys = {};
const chatOpen = () => $('chat').classList.contains('open');
addEventListener('keydown', (e) => {
  if (!socket) return;
  if (e.code === 'Enter') {
    if (chatOpen()) { const v = $('chatin').value.trim(); if (v) socket.emit('chat', v); $('chatin').value = ''; $('chat').classList.remove('open'); renderer.domElement.requestPointerLock(); }
    else { $('chat').classList.add('open'); document.exitPointerLock(); setTimeout(() => $('chatin').focus(), 0); }
    e.preventDefault(); return;
  }
  if (chatOpen()) { if (e.code === 'Escape') $('chat').classList.remove('open'); return; }
  keys[e.code] = true;
  if (e.code.startsWith('Digit')) { const n = +e.code.slice(5) - 1; if (n >= 0 && n < 6) { sel = n; renderHud(); } }
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyQ' && stats.carry) placeCarry();
  if (e.code === 'KeyR') carryRot = (carryRot + 1) & 3;
  if (e.code === 'KeyG' && stats.inv[sel]) socket.emit('discard', sel);
  if (e.code === 'KeyF') flashlight = !flashlight;
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
renderer.domElement.addEventListener('click', () => { if (socket && !stats.dead && !chatOpen()) renderer.domElement.requestPointerLock(); });
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  yaw -= e.movementX * 0.0025; pitch = Math.max(-0.6, Math.min(1.3, pitch + e.movementY * 0.0025));
});
addEventListener('wheel', (e) => { if (e.ctrlKey) return; if (e.shiftKey) { camDist = Math.max(2.5, Math.min(9, camDist + Math.sign(e.deltaY) * 0.5)); return; } sel = (sel + (e.deltaY > 0 ? 1 : 5)) % 6; renderHud(); });
addEventListener('mousedown', (e) => {
  if (document.pointerLockElement !== renderer.domElement || e.button !== 0 || stats.dead) return;
  if (stats.carry) return placeCarry();
  const it = stats.inv[sel];
  if (it && !ITEMS[it].weapon) { socket.emit('use', sel); return; }
  const w = it ? ITEMS[it] : FISTS;
  if (performance.now() - lastAtk < w.cd) return;
  lastAtk = performance.now(); me.human.swing = 1;
  socket.emit('attack', { ry: me.ry });
});
let lastAtk = 0;

// ---------- interaction ----------
let target = null;
function findTarget() {
  const fx = Math.sin(me.ry), fz = Math.cos(me.ry);
  let best = null, bd = 2.6;
  for (const m of itemMeshes.values()) {
    const it = m.userData.item, d = Math.hypot(it.x - me.x, it.z - me.z);
    if (d < bd) { bd = d; best = { kind: 'item', id: it.id, name: ITEMS[it.type].name }; }
  }
  if (best || stats.carry) return best;
  bd = 1.4;
  for (const b of world.boxesNear(me.x, me.z)) {
    if (TYPES[b.f.type].fixed) continue;
    const cx = Math.max(b.x0, Math.min(me.x, b.x1)), cz = Math.max(b.z0, Math.min(me.z, b.z1));
    const d = Math.hypot(me.x - cx, me.z - cz);
    const dot = d > 0.01 ? ((cx - me.x) * fx + (cz - me.z) * fz) / d : 1;
    if (d < bd && dot > 0.3) { bd = d; best = { kind: 'furn', id: b.f.id, name: TYPES[b.f.type].name }; }
  }
  return best;
}
function interact() {
  if (stats.dead) return;
  if (stats.carry) return placeCarry();
  if (!target) return;
  socket.emit(target.kind === 'item' ? 'pickup' : 'grab', target.id);
}
const ghost = { mesh: null, type: null, x: 0, z: 0 };
function updateGhost() {
  if (!stats.carry) { if (ghost.mesh) { scene.remove(ghost.mesh); ghost.mesh = null; ghost.type = null; } return; }
  const t = TYPES[stats.carry.type], depth = (carryRot & 1) ? t.w : t.d;
  const d = 1.2 + depth / 2 + 0.3;
  ghost.x = Math.round((me.x + Math.sin(me.ry) * d) * 4) / 4; ghost.z = Math.round((me.z + Math.cos(me.ry) * d) * 4) / 4;
  const key = stats.carry.type + carryRot;
  if (ghost.type !== key) {
    if (ghost.mesh) scene.remove(ghost.mesh);
    ghost.mesh = partsMesh(worldParts({ type: stats.carry.type, c: stats.carry.c, x: 0, z: 0, rot: carryRot }), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }));
    ghost.mesh.frustumCulled = false; scene.add(ghost.mesh); ghost.type = key;
  }
  ghost.mesh.position.set(ghost.x, 0, ghost.z);
}
function placeCarry() {
  if (!stats.carry) return;
  const box = aabb({ type: stats.carry.type, x: ghost.x, z: ghost.z, rot: carryRot });
  const r = 0.4;
  if (me.x > box.x0 - r && me.x < box.x1 + r && me.z > box.z0 - r && me.z < box.z1 + r) return showMsg('Step back to place it');
  socket.emit('place', { x: ghost.x, z: ghost.z, rot: carryRot });
}

// ---------- networking ----------
$('name').value = localStorage.getItem('name3008') || '';
$('name').addEventListener('keydown', e => { if (e.code === 'Enter') start(); });
$('play').onclick = start;
function start() {
  if (socket) return;
  const name = $('name').value.trim() || 'Guest'; localStorage.setItem('name3008', name);
  socket = io();
  socket.on('connect', () => socket.emit('join', name));
  socket.on('init', (d) => {
    myId = d.id; cycle = d.cycle; dayLen = d.day; clockT = d.t;
    world = new World(d.seed);
    for (const id of d.removed) world.removed.add(id);
    picked = new Set(d.picked);
    for (const k of [...chunks.keys()]) disposeChunk(k);
    for (const o of d.placed) addPlacedMesh(o);
    me.x = d.x; me.z = d.z; me.y = 0;
    $('start').classList.add('hidden'); $('hud').classList.remove('hidden');
    renderer.domElement.requestPointerLock();
    showAnnounce('Welcome to the store. Please enjoy your visit.');
  });
  socket.on('stats', (s) => {
    const wasDead = stats.dead; stats = s; if (stats.carry == null) stats.carry = null;
    if (s.dead && !wasDead) { $('dead').classList.remove('hidden'); document.exitPointerLock(); }
    renderHud();
  });
  socket.on('state', (s) => {
    clockT = s.t;
    const seenP = new Set();
    for (const p of s.players) { if (p.id === myId) continue; seenP.add(p.id); upsertOther(p); }
    for (const [id, o] of others) if (!seenP.has(id)) { scene.remove(o.h.g); others.delete(id); }
    const seenN = new Set();
    for (const n of s.npcs) { seenN.add(n.id); upsertNpc(n); }
    for (const [id, n] of npcViews) if (!seenN.has(id)) { scene.remove(n.h.g); npcViews.delete(id); }
    $('online').textContent = `Online: ${s.players.length}\n` + s.players.map(p => p.name).slice(0, 10).join('\n');
  });
  socket.on('picked', (id) => { picked.add(id); const m = itemMeshes.get(id); if (m) { scene.remove(m); itemMeshes.delete(id); } });
  socket.on('unpicked', (id) => { picked.delete(id); const it = world.itemById(id); if (it && chunks.has(chunkKeyOf(it.x, it.z))) spawnItemMesh(it); });
  socket.on('removed', (id) => { world.removed.add(id); const f = world.furnById(id); if (f) rebuildChunkOf(f.x, f.z); });
  socket.on('placed', (o) => addPlacedMesh(o));
  socket.on('unplaced', (id) => { world.placed.delete(id); const m = placedMeshes.get(id); if (m) { scene.remove(m); m.dispose(); placedMeshes.delete(id); } });
  socket.on('teleport', (p) => { me.x = p.x; me.y = p.y; me.z = p.z; me.vy = 0; });
  socket.on('announce', showAnnounce);
  socket.on('chat', addChat);
  socket.on('msg', showMsg);
  socket.on('hurt', () => { $('hurt').style.opacity = 1; setTimeout(() => $('hurt').style.opacity = 0, 250); });
  socket.on('swing', (id) => { const o = others.get(id); if (o) o.h.swing = 1; });
  socket.on('npcatk', (id) => { const n = npcViews.get(id); if (n) n.h.swing = 1; });
  socket.on('npchit', (d) => { const n = npcViews.get(d.id); if (n) { n.flash = 0.2; } });
  socket.on('left', (id) => { const o = others.get(id); if (o) { scene.remove(o.h.g); others.delete(id); } });
  socket.on('disconnect', () => showAnnounce('Disconnected from server… reconnecting'));
}
$('respawn').onclick = () => { socket.emit('respawn'); $('dead').classList.add('hidden'); renderer.domElement.requestPointerLock(); };

// ---------- main loop ----------
let last = performance.now(), sendAcc = 0, nightF = 0;
function update(dt) {
  if (!world) return;
  clockT = (clockT + dt) % cycle;
  const night = isNight(clockT);
  // smooth lighting transition
  nightF += ((night ? 1 : 0) - nightF) * Math.min(1, dt * 0.6);
  hemi.intensity = 1.1 - nightF * 1.02; dir.intensity = 0.5 * (1 - nightF);
  scene.background.copy(DAY_BG).lerp(NIGHT_BG, nightF); scene.fog.color.copy(scene.background);
  scene.fog.far = 55 - nightF * 25;
  panelMat.color.setScalar(1 - nightF * 0.92);
  const hrs = (clockT < dayLen ? 8 + clockT / dayLen * 14 : 22 + (clockT - dayLen) / (cycle - dayLen) * 10) % 24;
  $('clock').textContent = `${night ? '🌙 NIGHT — STORE CLOSED' : '☀️ DAY — STORE OPEN'}  ${String(Math.floor(hrs)).padStart(2, '0')}:${String(Math.floor(hrs % 1 * 60)).padStart(2, '0')}`;

  // movement
  if (!stats.dead && !chatOpen()) {
    let mx = 0, mz = 0;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    if (keys.KeyW) { mx += fx; mz += fz; } if (keys.KeyS) { mx -= fx; mz -= fz; }
    if (keys.KeyD) { mx += rx; mz += rz; } if (keys.KeyA) { mx -= rx; mz -= rz; }
    const len = Math.hypot(mx, mz);
    me.sprint = !!(keys.ShiftLeft || keys.ShiftRight) && len > 0 && stats.energy > 3;
    let speed = me.sprint ? 7.5 : 4.5; if (stats.carry) speed *= 0.7;
    me.moving = len > 0;
    if (len > 0) { mx /= len; mz /= len; me.x += mx * speed * dt; me.z += mz * speed * dt; me.ry = lerpAngle(me.ry, Math.atan2(mx, mz), Math.min(1, dt * 12)); }
    if (keys.Space && me.onGround) { me.vy = 7; me.onGround = false; }
  } else me.moving = false;
  me.vy -= 22 * dt; me.y += me.vy * dt;
  const boxes = world.collide(me, 0.4, me.y);
  const g = world.groundAt(me.x, me.z, me.y, 0.2, boxes);
  if (me.y <= g) { me.y = g; me.vy = 0; me.onGround = true; } else me.onGround = me.y - g < 0.05;
  if (me.y > CEIL - 2) { me.y = CEIL - 2; me.vy = Math.min(0, me.vy); }
  me.human.g.position.set(me.x, me.y, me.z); me.human.g.rotation.y = me.ry;
  me.human.carryBox.visible = !!stats.carry; setHeld(me.human, stats.carry ? null : stats.inv[sel]);
  me.human.g.visible = !stats.dead;
  animateHuman(me.human, me.moving, dt, me.sprint ? 1.4 : 1);

  // camera (orbit + simple anti-clip against ceiling)
  const ch = new THREE.Vector3(me.x, me.y + 1.6, me.z);
  camera.position.set(me.x + Math.sin(yaw) * Math.cos(pitch) * camDist, Math.min(CEIL - 0.3, me.y + 1.6 + Math.sin(pitch) * camDist), me.z + Math.cos(yaw) * Math.cos(pitch) * camDist);
  if (camera.position.y < 0.3) camera.position.y = 0.3;
  camera.lookAt(ch);
  floor.position.set(Math.round(me.x / 4) * 4, 0, Math.round(me.z / 4) * 4);
  ceil.position.set(Math.round(me.x / 2) * 2, CEIL, Math.round(me.z / 2) * 2);
  flash.intensity = flashlight ? 40 : 0;
  flash.position.set(me.x, me.y + 1.5, me.z); flash.target.position.set(me.x + Math.sin(me.ry) * 5, me.y + 1, me.z + Math.cos(me.ry) * 5);

  // network send (15 Hz)
  sendAcc += dt;
  if (sendAcc > 1 / 15 && socket && !stats.dead) { sendAcc = 0; socket.emit('move', { x: me.x, y: me.y, z: me.z, ry: me.ry, anim: me.moving ? 1 : 0, sprint: me.sprint, sel }); }

  // others
  const k = Math.min(1, dt * 10);
  for (const o of others.values()) {
    o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; o.z += (o.tz - o.z) * k; o.ry = lerpAngle(o.ry, o.try, k);
    o.h.g.position.set(o.x, o.y, o.z); o.h.g.rotation.y = o.ry; o.h.g.visible = !o.dead; animateHuman(o.h, o.anim, dt);
  }
  for (const n of npcViews.values()) {
    const p = n.h.g.position; p.x += (n.tx - p.x) * k; p.z += (n.tz - p.z) * k; n.h.g.rotation.y = lerpAngle(n.h.g.rotation.y, n.try, k);
    n.h.eyes.visible = !!n.hostile; animateHuman(n.h, n.m, dt, n.hostile ? 1.4 : 0.6);
    if (n.flash > 0) { n.flash -= dt; n.h.g.scale.setScalar(1.08); } else n.h.g.scale.setScalar(1);
  }
  // items bob
  const tt = performance.now() / 1000;
  for (const m of itemMeshes.values()) { m.rotation.y = tt; m.position.y = 0.05 + Math.sin(tt * 2 + m.position.x) * 0.05; }

  streamChunks();
  updateGhost();
  target = findTarget();
  $('prompt').textContent = target ? `[E] Pick up ${target.name}` : '';
}
function loop() {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
renderHud();
loop();
