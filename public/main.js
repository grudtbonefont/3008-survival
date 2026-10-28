// 3008 Survival v2 client
import * as THREE from 'three';
import { World, CHUNK, CEIL, CYCLE, DAY, ITEMS, TYPES, FISTS, RECIPES, ZONES, worldParts, aabb, levelOf, weekday, SLOTS, HOTBAR, stackOf, furnHp, breakable, LOOT } from '/shared/world.js';
import { Sfx } from '/js/audio.js';
import { MATS, floorTex, ceilTex, partsGroup, disposeGroup, makeItem, makeHuman, makeEmployee, nameLabel, setHeld, setCarry, animate, unitBox, makeAvatar, humanFromHue, canvasTex } from '/js/models.js';
import { t, tr, lang, setLang, iname, tname, zname, wd, nm, nightsLabel, streakLabel, noEmo } from '/js/i18n.js';
import { svg, itemSvg, carrySvg } from '/js/icons.js';
import { openEditor, loadAvatar, saveAvatar } from '/js/avatar-editor.js';
import { ACHIEVEMENTS, ACH } from '/shared/achievements.js';
import { unlocksAt } from '/shared/avatar.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer:coarse)').matches || params.has('touch');
const sfx = new Sfx();

// ---------------- settings ----------------
const QUALITY = {
  low: { radius: 1, pr: Math.min(0.65, devicePixelRatio), shadows: false, lights: 3, shadowSize: 512, flashShadow: false, fogScale: 0.55, grain: false },
  med: { radius: 2, pr: Math.min(1, devicePixelRatio), shadows: true, lights: 8, shadowSize: 1024, flashShadow: false, fogScale: 0.85, grain: true },
  high: { radius: 2, pr: Math.min(devicePixelRatio, 2), shadows: true, lights: 12, shadowSize: 2048, flashShadow: true, fogScale: 1, grain: true },
};
function pickAutoQuality() {
  const mem = navigator.deviceMemory || (isTouch ? 2 : 8);
  const cores = navigator.hardwareConcurrency || 4;
  if (isTouch || mem <= 4 || cores <= 4) return 'low';
  if (mem >= 8 && cores >= 8 && devicePixelRatio >= 1.5) return 'high';
  return 'med';
}
const settings = Object.assign({ sens: 1, quality: 'auto', vol: 0.7, name: '', invertY: false, tips: true, fps: false, hud: 'min', map: false }, JSON.parse(localStorage.getItem('3008s') || '{}'));
const saveSettings = () => localStorage.setItem('3008s', JSON.stringify(settings));
function resolveQuality() { const q = settings.quality === 'auto' ? pickAutoQuality() : settings.quality; return QUALITY[q] || QUALITY.med; }
let Q = resolveQuality();

function buildSettings(el) {
  el.innerHTML = `
  <label>${t('language')} <select data-lang><option value="ru">Русский</option><option value="en">English</option></select></label>
  <label>${t('sens')} <input type="range" min="0.2" max="3" step="0.1" data-s="sens"></label>
  <label>${t('vol')} <input type="range" min="0" max="1" step="0.05" data-s="vol"></label>
  <label>${t('gfx')} <select data-s="quality"><option value="auto">${t('gfxAuto')}</option><option value="low">${t('low')}</option><option value="med">${t('med')}</option><option value="high">${t('high')}</option></select></label>
  <label>${t('invY')} <input type="checkbox" data-s="invertY"></label>
  <label>${t('tips')} <input type="checkbox" data-s="tips"></label>
  <label>${t('hudMode')} <select data-s="hud"><option value="full">${t('hudFull')}</option><option value="min">${t('hudMin')}</option><option value="off">${t('hudOff')}</option></select></label>
  <label>${t('mapSet')} <input type="checkbox" data-s="map"></label>
  <label>${t('fps')} <input type="checkbox" data-s="fps"></label>`;
  const ls = el.querySelector('[data-lang]'); ls.value = lang; ls.onchange = () => applyLang(ls.value);
  el.querySelectorAll('[data-s]').forEach(inp => {
    const k = inp.dataset.s;
    if (inp.type === 'checkbox') inp.checked = settings[k]; else inp.value = settings[k];
    inp.addEventListener('input', () => {
      settings[k] = inp.type === 'checkbox' ? inp.checked : inp.type === 'range' ? +inp.value : inp.value;
      saveSettings(); applySettings(); document.querySelectorAll('.settings').forEach(o => o !== el && buildSettings(o));
    });
  });
}
document.querySelectorAll('.settings').forEach(buildSettings);

// ---------------- renderer / scene ----------------
const renderer = new THREE.WebGLRenderer({ antialias: resolveQuality() !== QUALITY.low, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const DAY_FOG = new THREE.Color(0xcfc9b8), NIGHT_FOG = new THREE.Color(0x030304), FOGGY = new THREE.Color(0xe8e8e6), BLOOD_FOG = new THREE.Color(0x3a0002);
scene.background = DAY_FOG.clone(); scene.fog = new THREE.Fog(DAY_FOG.clone(), 10, 70);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 160);
scene.add(camera);

const hemi = new THREE.HemisphereLight(0xfff8e8, 0x8a8070, 1.3); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4dd, 1.1);
sun.shadow.camera.left = sun.shadow.camera.bottom = -22; sun.shadow.camera.right = sun.shadow.camera.top = 22; sun.shadow.camera.near = 1; sun.shadow.camera.far = 30;
sun.shadow.bias = -0.0005; scene.add(sun, sun.target);
const flash = new THREE.SpotLight(0xfff2d0, 0, 32, 0.45, 0.5, 1.2);
flash.position.set(0.3, -0.2, 0); camera.add(flash); flash.target.position.set(0, -0.6, -5); camera.add(flash.target);
const lightPool = [];
const panelEmissive = new THREE.Color();
const flickerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

function applySettings() {
  Q = resolveQuality();
  renderer.setPixelRatio(Q.pr);
  renderer.shadowMap.enabled = Q.shadows;
  sun.castShadow = Q.shadows; sun.shadow.mapSize.set(Q.shadowSize, Q.shadowSize); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  flash.castShadow = Q.flashShadow; flash.shadow.mapSize.set(512, 512); if (flash.shadow.map) { flash.shadow.map.dispose(); flash.shadow.map = null; }
  while (lightPool.length > Q.lights) scene.remove(lightPool.pop());
  while (lightPool.length < Q.lights) { const l = new THREE.PointLight(0xfff3dc, 0, 16, 1.6); scene.add(l); lightPool.push(l); }
  sfx.setVolume(settings.vol);
  scene.traverse(o => { if (o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; });
  if (world) for (const ch of chunks.values()) setChunkShadows(ch);
  if ($('hud')) applyHud();
}

// ---------------- game state ----------------
let socket, world, myId, myName, debugAllowed = false;
let me = { x: 0, y: 0, z: 0, vy: 0, ry: 0, onGround: true };
let stats = { hp: 100, hunger: 100, energy: 100, inv: [], carry: null, dead: false, xp: 0, lv: 1, days: 0, kos: 0, pvp: false, sleeping: false, party: [] };
let _myEm = null;
let sel = 0, stamina = 100, gameT = 0, dayN = 1, nightF = 0, flashOn = false, rotPlace = 0, emote = null;
let yaw = Math.PI, pitch = 0.25, tyaw = Math.PI, tpitch = 0.25, camDist = 5.5, playing = false;
const keys = {};
const picked = new Set(), drops = new Map();
const others = new Map(), npcs = new Map();
const chunks = new Map(), placedObjs = new Map(), itemMeshes = new Map();
let boxesCache = [], boxesAt = { x: 1e9, z: 1e9, t: 0 };
const ICON = new Proxy({}, { get: (_, k) => itemSvg(k) });
let dinfo = { day: 1, weekday: 'Monday', fog: false, blood: false };
const waypoints = [];
const lightObjs = new Map(), avatars = {}, fhp = new Map();
let myAch = new Set(JSON.parse(localStorage.getItem('3008ach') || '[]')), myStreak = +(localStorage.getItem('3008streak') || 0), placeH = -1, invOpen = false, invTab = 'craft', craftCat = 'all', chestData = null;
const token = localStorage.getItem('3008tok') || (() => { const v = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem('3008tok', v); return v; })();

// ---------------- chunk streaming ----------------
const floorMats = {}, ceilMat = new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.9 });
ceilTex.repeat.set(8, 8);
const planeGeo = new THREE.PlaneGeometry(CHUNK, CHUNK);
function floorMat(zone) {
  if (floorMats[zone]) return floorMats[zone];
  const t = floorTex.clone(); t.needsUpdate = true; t.repeat.set(12, 12);
  return floorMats[zone] = new THREE.MeshStandardMaterial({ map: t, color: ZONES[zone]?.floor || 0xbbbbbb, roughness: 0.8 });
}
const panelGeo = new THREE.BoxGeometry(1.6, 0.06, 0.6);
const panelMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
function buildChunk(cx, cz) {
  const data = world.chunk(cx, cz), g = new THREE.Group();
  const ox = cx * CHUNK, oz = cz * CHUNK;
  const floor = new THREE.Mesh(planeGeo, floorMat(data.zone)); floor.rotation.x = -Math.PI / 2; floor.position.set(ox + CHUNK / 2, 0, oz + CHUNK / 2); floor.receiveShadow = true; g.add(floor);
  const ceil = new THREE.Mesh(planeGeo, ceilMat); ceil.rotation.x = Math.PI / 2; ceil.position.set(ox + CHUNK / 2, CEIL, oz + CHUNK / 2); g.add(ceil);
  // ceiling light panels: some flicker
  const pos = []; const flick = [];
  for (let i = 3; i < CHUNK; i += 6) for (let j = 3; j < CHUNK; j += 6) ((((cx * 7 + cz * 13 + i * 3 + j) % 11) === 0) ? flick : pos).push([ox + i, oz + j]);
  const mk = (list, mat) => { if (!list.length) return; const m = new THREE.InstancedMesh(panelGeo, mat, list.length); const o = new THREE.Object3D(); list.forEach((p, k) => { o.position.set(p[0], CEIL - 0.03, p[1]); o.updateMatrix(); m.setMatrixAt(k, o.matrix); }); g.add(m); };
  mk(pos, panelMat); mk(flick, flickerMat);
  const ch = { cx, cz, g, furnG: null, signs: [], panels: pos.concat(flick), flick };
  rebuildFurn(ch);
  // signs (landmark labels)
  for (const f of data.furn) if (f.type === 'sign' && f.text) {
    const label = f.zone && ZONES[f.zone] ? zname(f.zone).toUpperCase() : f.text;
    const s = nameLabel(label, '#f5c518'); s.scale.set(4, 1.2, 1); s.position.set(f.x, 3.4, f.z); s.material.depthTest = true; g.add(s); ch.signs.push(s);
  }
  // hanging zone banner in the middle of the plot: icon + name, in the zone's colour (a landmark you can spot from afar)
  const zb = zoneBanner(data.zone); if (zb) { zb.position.set(ox + CHUNK / 2, CEIL - 0.9, oz + CHUNK / 2); g.add(zb); ch.signs.push(zb.userData.sprite); }
  ch.zone = data.zone;
  scene.add(g);
  for (const it of data.items) if (!picked.has(it.id)) addItemMesh(it);
  return ch;
}
const ZONE_ICON = { aisles: '🛒', bedrooms: '🛏', living: '🛋', dining: '🍽', kitchen: '🍳', bathroom: '🛁', office: '💼', warehouse: '📦', displays: '✨', mixed: '🏷', cafeteria: '☕', kids: '🧸', snack: '🌭', pharmacy: '💊', greenhouse: '🌿', infobooth: 'ℹ', checkout: '🧾', clock: '🕰', fountain: '⛲' };
const ZONE_COL = { aisles: '#f5c518', bedrooms: '#6a8cc8', living: '#c8955a', dining: '#b5651d', kitchen: '#3fa9f5', bathroom: '#7fdbff', office: '#95a5a6', warehouse: '#e67e22', displays: '#f06292', mixed: '#e74c3c', cafeteria: '#d4a650', kids: '#2ecc71', snack: '#ff8c1a', pharmacy: '#2ecc71', greenhouse: '#1e8449', infobooth: '#3fa9f5', checkout: '#8e44ad', clock: '#f5c518', fountain: '#3fa9f5' };
// per-zone ceiling light tint (warm bedrooms, cold pharmacy, sodium warehouse, green greenhouse…)
const ZONE_LIGHT = { bedrooms: [1, 0.86, 0.7], living: [1, 0.9, 0.75], dining: [1, 0.88, 0.72], kitchen: [0.92, 0.97, 1], bathroom: [0.88, 0.96, 1], office: [0.95, 0.98, 1], warehouse: [1, 0.78, 0.5], pharmacy: [0.85, 1, 0.95], greenhouse: [0.82, 1, 0.75], kids: [1, 0.95, 0.85], cafeteria: [1, 0.9, 0.7], snack: [1, 0.88, 0.7] };
const bannerCache = {};
function zoneBanner(zone) {
  if (!ZONES[zone]) return null;
  const k = zone + lang, tex = bannerCache[k] ||= canvasTex((c, w, h) => {
    c.fillStyle = ZONE_COL[zone] || '#f5c518'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, h - 18, w, 18);
    c.fillStyle = '#fff'; c.font = 'bold 64px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ZONE_ICON[zone] || '', 70, h / 2);
    const name = zname(zone); c.font = `bold ${name.length > 12 ? 40 : 52}px Arial`; c.textAlign = 'left'; c.fillStyle = '#1b1a17'; c.fillText(name, 130, h / 2 + 2);
  }, 512, 128);
  const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ map: tex }), pg = new THREE.PlaneGeometry(4, 1);
  for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(pg, mat); m.rotation.y = i * Math.PI / 2; g.add(m); } // front-faced on every side so text never reads mirrored
  for (const sx of [-1.6, 1.6]) { const w = new THREE.Mesh(unitBox, MATS.metal || new THREE.MeshStandardMaterial({ color: 0x888888 })); w.scale.set(0.02, 0.9, 0.02); w.position.set(sx, 0.95, 0); g.add(w); }
  g.userData.sprite = { material: { map: { dispose() {} } } };
  return g;
}
function rebuildFurn(ch) {
  if (ch.furnG) { ch.g.remove(ch.furnG); disposeGroup(ch.furnG); }
  const parts = [];
  for (const f of world.chunk(ch.cx, ch.cz).furn) if (!world.removed.has(f.id)) for (const p of worldParts(f)) parts.push(p);
  ch.furnG = partsGroup(parts, { shadows: Q.shadows }); ch.g.add(ch.furnG);
  for (const f of world.chunk(ch.cx, ch.cz).furn) { const h = fhp.get(f.id); if (h && !world.removed.has(f.id) && h.hp < h.max * 0.85) addCrack(ch.furnG, f.box || aabb(f), h.hp / h.max); }
}
function setChunkShadows(ch) { ch.furnG.traverse(o => { if (o.isMesh && !o.userData.emissive) { o.castShadow = Q.shadows; o.receiveShadow = Q.shadows; } }); }
function unloadChunk(key) {
  const ch = chunks.get(key); scene.remove(ch.g); disposeGroup(ch.g);
  ch.signs.forEach(s => s.material.map.dispose());
  for (const it of world.chunk(ch.cx, ch.cz).items) removeItemMesh(it.id);
  chunks.delete(key);
}
function streamChunks() {
  const ccx = Math.floor(me.x / CHUNK), ccz = Math.floor(me.z / CHUNK), R = Q.radius;
  let built = 0;
  for (let d = 0; d <= R; d++) for (let i = -d; i <= d; i++) for (let j = -d; j <= d; j++) {
    if (Math.max(Math.abs(i), Math.abs(j)) !== d) continue;
    const key = (ccx + i) + ',' + (ccz + j);
    if (!chunks.has(key) && built < 2) { chunks.set(key, buildChunk(ccx + i, ccz + j)); built++; }
  }
  for (const [key, ch] of chunks) if (Math.abs(ch.cx - ccx) > R + 1 || Math.abs(ch.cz - ccz) > R + 1) unloadChunk(key);
}
function chunkOfId(id) { const m = /^(-?\d+)_(-?\d+)_/.exec(id); return m ? chunks.get(m[1] + ',' + m[2]) : null; }

// ---------------- items ----------------
function addItemMesh(it) {
  if (itemMeshes.has(it.id)) return;
  const m = makeItem(it.type); m.position.set(it.x, (it.y || 0) + 0.02, it.z); m.rotation.y = (it.x * 13 + it.z * 7) % 6.28;
  const glow = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.45, 20), new THREE.MeshBasicMaterial({ color: 0xf5c518, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.01; m.add(glow);
  m.userData = { id: it.id, type: it.type, x: it.x, z: it.z, y: it.y || 0, glow };
  scene.add(m); itemMeshes.set(it.id, m);
}
function removeItemMesh(id) { const m = itemMeshes.get(id); if (m) { scene.remove(m); m.userData.glow.geometry.dispose(); itemMeshes.delete(id); } }
function itemData(id) { return id.startsWith('d_') ? drops.get(id) : world.itemById(id); }

// ---------------- placed furniture ----------------
function addPlacedObj(o) {
  removePlacedObj(o.id);
  const obj = world.addPlaced({ ...o });
  const g = partsGroup(worldParts(obj), { shadows: Q.shadows });
  if (o.type === 'barricade' || o.type === 'claim' || o.type === 'wall' || o.type === 'door' || o.type === 'chest') {
    const s = nameLabel(o.type === 'claim' ? t('baseCamp', { n: o.ownerName }) : (o.locked ? '🔩 ' : '') + o.ownerName, o.type === 'claim' ? '#7fdbff' : '#ffb', o.hp ? `HP ${o.hp}/${furnHp(o.type)}` : '');
    s.position.set(o.x, (o.y || 0) + (TYPES[o.type]?.h || 1) + 0.6, o.z); s.scale.set(1.8, 0.54, 1); g.add(s); g.userData.label = s;
  }
  if (TYPES[o.type]?.light) lightObjs.set(o.id, { x: o.x, z: o.z, y: (o.y || 0) + (TYPES[o.type].h || 1.5), torch: o.type === 'torch' });
  else lightObjs.delete(o.id);
  if (o.hp != null && o.hp < furnHp(o.type) * 0.6) addCrack(g, aabb(obj), o.hp / furnHp(o.type));
  scene.add(g); placedObjs.set(o.id, g); boxesAt.t = 0;
}
function removePlacedObj(id) { lightObjs.delete(id); const g = placedObjs.get(id); if (g) { scene.remove(g); if (g.userData.label) g.userData.label.material.map.dispose(); disposeGroup(g); placedObjs.delete(id); } world.removePlaced(id); boxesAt.t = 0; }

// ---------------- characters ----------------
function hsl(h, s, l) { return new THREE.Color().setHSL(h, s, l).getHex(); }
function addOther(p) {
  const h = avatars[p.id] ? makeAvatar(avatars[p.id]) : humanFromHue(p.hue || 0);
  const o = { h, label: null, labelKey: '', tx: p.x, ty: p.y, tz: p.z, try: p.ry, data: p, stepT: 0 };
  scene.add(h.g); h.g.position.set(p.x, p.y, p.z); others.set(p.id, o); return o;
}
let myModel = null;
function npcColor(k) { return k; }
function addNpc(n) {
  const h = makeEmployee(n.k);
  const o = { h, tx: n.x, tz: n.z, try: n.ry, data: n, voice: 2 + Math.random() * 8, step: 0 };
  h.g.position.set(n.x, 0, n.z); scene.add(h.g); npcs.set(n.id, o); return o;
}
function rebuildOther(id) {
  const o = others.get(id); if (!o) return;
  const pos = o.h.g.position.clone(), ry = o.h.g.rotation.y;
  if (o.label) o.h.g.remove(o.label);
  scene.remove(o.h.g); disposeGroup(o.h.g);
  o.h = makeAvatar(avatars[id]); o.h.g.position.copy(pos); o.h.g.rotation.y = ry; scene.add(o.h.g);
  if (o.label) { o.label.position.y = o.h.labelY || 2.45; o.h.g.add(o.label); }
}
function rebuildMe(av) {
  if (myModel) { scene.remove(myModel.g); disposeGroup(myModel.g); }
  myModel = makeAvatar(av); scene.add(myModel.g);
}
function removeModel(o) { scene.remove(o.h.g); o.h.g.traverse(m => { if (m.isMesh && m.geometry !== unitBox && !m.geometry.userData?.shared) m.geometry.dispose(); }); if (o.label) o.label.material.map.dispose(); }
function carryParts(type) { return () => partsGroup(worldParts({ type, x: 0, z: 0, rot: 0, c: 7 })); }

// ---------------- networking ----------------
function connect() {
  socket = io({ transports: ['websocket', 'polling'] });
  socket.on('connect', () => socket.emit('join', { name: myName, token, avatar: loadAvatar() }));
  socket.on('init', (d) => {
    myId = d.id; myName = d.name; debugAllowed = d.debug;
    world = new World(d.seed);
    d.removed.forEach(id => world.removed.add(id));
    d.picked.forEach(id => picked.add(id));
    for (const ch of [...chunks.keys()]) unloadChunk(ch);
    for (const id of [...placedObjs.keys()]) removePlacedObj(id);
    d.placed.forEach(addPlacedObj);
    d.drops.forEach(o => { drops.set(o.id, o); addItemMesh(o); });
    me.x = d.x; me.z = d.z; me.y = 0; gameT = d.t; dayN = d.day; if (d.info) dinfo = d.info;
    $('ver').textContent = 'v' + d.version;
    Object.assign(avatars, d.avatars || {}); rebuildMe(d.av || loadAvatar()); saveAvatar(d.av || loadAvatar());
    myAch = new Set(d.ach || []); localStorage.setItem('3008ach', JSON.stringify([...myAch])); myStreak = d.streak || 0; localStorage.setItem('3008streak', myStreak);
    fhp.clear(); for (const [id, hp, max] of d.fhp || []) fhp.set(id, { hp, max });
    const dt = params.get('debugTime');
    if (dt && debugAllowed) socket.emit('debugTime', dt === 'night' ? DAY + 30 : dt === 'day' ? 60 : +dt);
    streamChunks(); applySettings(); updateHotbar();
    tip(0);
  });
  socket.on('stats', (s) => {
    const prevLv = stats.lv, prevHp = stats.hp, wasDead = stats.dead;
    stats = s; if (s.lv > prevLv && prevLv) sfx.play('levelup');
    if (s.hp < prevHp - 0.5 && !s.dead) hurtFlash();
    if (s.dead && !wasDead) { sfx.play('death'); $('death').classList.remove('hidden'); syncPanelClass(); document.exitPointerLock?.(); }
    if (!s.dead && wasDead) { $('death').classList.add('hidden'); syncPanelClass(); }
    if (!s.chest && chestData) { chestData = null; if (invTab === 'chest') invTab = 'craft'; }
    updateHud(); updateHotbar();
    if (invOpen && !drag) { const sig = JSON.stringify([s.inv, s.carry, s.lv, nearFlag('bench'), nearFlag('stove')]); if (sig !== invSig) renderInv(); }
  });
  socket.on('state', (s) => {
    gameT = s.t; dayN = s.day;
    const seen = new Set();
    for (const p of s.players) {
      if (p.id === myId) { _myEm = p.em; if (myModel) { setHeld(myModel, p.held); setCarry(myModel, p.carry, carryParts(p.carry)); } continue; }
      seen.add(p.id); const o = others.get(p.id) || addOther(p);
      o.tx = p.x; o.ty = p.y; o.tz = p.z; o.try = p.ry; o.data = p;
      const key = p.name + p.lv + p.pvp + (p.party || '');
      if (o.labelKey !== key) { if (o.label) { o.h.g.remove(o.label); o.label.material.map.dispose(); } o.label = nameLabel(p.name, p.party && p.party === myParty() ? '#7fdbff' : p.pvp ? '#ff7766' : '#fff', `${lang === 'ru' ? 'Ур.' : 'Lv'} ${p.lv}${p.pvp ? ' ⚔' : ''}`); o.label.position.y = o.h.labelY || 2.45; o.h.g.add(o.label); o.labelKey = key; }
      setHeld(o.h, p.held); setCarry(o.h, p.carry, carryParts(p.carry));
    }
    for (const [id, o] of others) if (!seen.has(id)) { removeModel(o); others.delete(id); }
    const ns = new Set();
    for (const n of s.npcs) { ns.add(n.id); const o = npcs.get(n.id) || addNpc(n); o.tx = n.x; o.tz = n.z; o.try = n.ry; o.data = n; }
    for (const [id, o] of npcs) if (!ns.has(id)) { removeModel(o); npcs.delete(id); }
  });
  socket.on('picked', (id) => { picked.add(id); drops.delete(id); removeItemMesh(id); });
  socket.on('unpicked', (id) => { picked.delete(id); const it = world?.itemById(id); if (it && chunkOfItem(id)) addItemMesh(it); });
  socket.on('drop', (o) => { drops.set(o.id, o); addItemMesh(o); });
  socket.on('removed', (id) => { world.markRemoved(id); fhp.delete(id); const ch = chunkOfId(id); if (ch) { rebuildFurn(ch); } boxesAt.t = 0; });
  socket.on('restored', (id) => { world.unmarkRemoved(id); fhp.delete(id); const ch = chunkOfId(id); if (ch) { rebuildFurn(ch); const f = world.furnById?.(id); if (f) puff(f.x, 0.4, f.z, 0xffffff, 10); } boxesAt.t = 0; });
  socket.on('furnhp', (h) => { fhp.set(h.id, { hp: h.hp, max: h.max }); const ch = chunkOfId(h.id); if (ch) rebuildFurn(ch); const f = world.furnById?.(h.id) || world.placed.get(h.id); if (f) { showHpBar(f, h.hp, h.max); const b = f.box || aabb(f); const sp = spatial({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 }); sfx.play('crack', sp); chips((b.x0 + b.x1) / 2, Math.min(b.h, 1.4), (b.z0 + b.z1) / 2, matColor(f), 6); } });
  socket.on('broke', (b) => { debris(b); const sp = spatial(b); const m = matOf(b.type); sfx.play(m === 'pane' ? 'shatter' : m === 'scrap' ? 'metal' : 'wood', sp); sfx.play('break', sp); if (Math.hypot(b.x - me.x, b.z - me.z) < 6) shake = Math.max(shake, 0.15); });
  socket.on('loot', (got) => { for (const g of got) toast(`${ICON[g.t]}<span>+${g.n} ${esc(iname(g.t))}</span>`, 'loot', 2200); });
  socket.on('ach', (id) => { const a = ACH[id]; myAch.add(id); localStorage.setItem('3008ach', JSON.stringify([...myAch])); if (a) { toast(`${achIc(a)}<span><b>${esc(nm(a))}</b><small>${t('achGot')} · +${a.xp} XP</small></span>`, 'ach', 4000); sfx.play('ach'); } });
  socket.on('unlock', (u) => { const list = (u.items || []).map(o => nm(o)).join(', '); if (list) toast(`${svg('gift', 16)}<span><b>${t('unlocked', { lv: u.lv })}</b><small>${esc(list)}</small></span>`, 'unlock', 4500); });
  socket.on('streak', (k) => { myStreak = k.n; localStorage.setItem('3008streak', k.n); toast(`${svg('fire', 16)}<span>${esc(streakLabel(k.n, k.bonus))}</span>`, 'streak', 4000); });
  socket.on('avatar', (a) => { avatars[a.id] = a.av; if (a.id === myId) { rebuildMe(a.av); saveAvatar(a.av); } else rebuildOther(a.id); });
  socket.on('chest', (c) => { chestData = c; if (c) { invTab = 'chest'; openInv(); } else if (invTab === 'chest') { invTab = 'craft'; if (invOpen) renderInv(); } });
  socket.on('sfxat', (a) => sfx.play(a.k, spatial(a)));
  socket.on('placed', addPlacedObj);
  socket.on('placedupd', addPlacedObj);
  socket.on('unplaced', removePlacedObj);
  socket.on('teleport', (p) => { me.x = p.x; me.y = p.y; me.z = p.z; me.vy = 0; boxesAt.t = 0; });
  socket.on('announce', (a) => announce({ ...a, text: tr(a.text) }));
  socket.on('dayinfo', (i) => { dinfo = i; });
  socket.on('npcsay', (m) => npcSay({ ...m, text: tr(m.text) }));
  socket.on('chat', (c) => addChat(c.sys ? { ...c, text: tr(c.text) } : c));
  socket.on('feed', (x) => addFeed(tr(x)));
  socket.on('msg', (x) => showMsg(tr(x)));
  socket.on('sfx', (n) => sfx.play(n));
  socket.on('swing', (id) => { const o = id === myId ? { h: myModel } : others.get(id); if (o?.h) { o.h.swing = 1; sfx.play('swing', spatial(o.h.g.position)); } });
  socket.on('npcatk', (id) => { const o = npcs.get(id); if (o) { o.h.swing = 1; sfx.play('swing', spatial(o.h.g.position)); } });
  socket.on('hitfx', (h) => { dmgNumber(h); sfx.play(h.wood ? 'wood' : 'hit', spatial(h)); if (h.npc != null && Math.random() < 0.5) sfx.play('scream', spatial(h)); });
  socket.on('knock', (k) => { kx += k.dx * 6; kz += k.dz * 6; me.vy = Math.max(me.vy, 3); sfx.play('hurt'); hurtFlash(); shake = 0.35; });
  socket.on('board', renderBoard);
  socket.on('left', (id) => { const o = others.get(id); if (o) { removeModel(o); others.delete(id); } });
  socket.on('disconnect', () => showMsg(t('disconnected')));
}
const myParty = () => stats.party?.length ? ([...others.values()].find(o => stats.party.includes(o.data.name))?.data.party ?? null) : null;
function chunkOfItem(id) { const m = /^i_(-?\d+)_(-?\d+)_/.exec(id); return m && chunks.get(m[1] + ',' + m[2]); }
function spatial(p) {
  const dx = p.x - me.x, dz = p.z - me.z, d = Math.hypot(dx, dz);
  const ang = Math.atan2(dx, dz) - (yaw + Math.PI);
  return { gain: Math.max(0, 1 - d / 30), pan: -Math.sin(ang) * Math.min(1, d / 4) };
}

// ---------------- HUD ----------------
function setBar(cls, v) { const b = document.querySelector('.bar.' + cls); b.querySelector('i').style.width = Math.max(0, v) + '%'; b.querySelector('em').textContent = Math.max(0, Math.round(v)); b.classList.toggle('low', v < 20); b.classList.toggle('full', v >= 99.5); }
function updateHud() {
  setBar('hp', stats.hp); setBar('food', stats.hunger); setBar('energy', stats.energy);
  const lv = stats.lv || 1, a = 40 * (lv - 1) ** 2, b = 40 * lv ** 2;
  $('lvNum').textContent = `${lang === 'ru' ? 'Ур.' : 'Lv'} ${lv}`; $('level').title = `${stats.xp} XP`; lastLv = lv; localStorage.setItem('3008lv', lv); $('xpBar').firstElementChild.style.width = ((stats.xp - a) / (b - a) * 100) + '%';
  $('daysLabel').textContent = nightsLabel(stats.days, stats.kos) + (myStreak > 1 ? ` · ${t('streakDays').toLowerCase()} ${myStreak}` : '');
  $('party').textContent = stats.party?.length ? t('party') + stats.party.join(', ') : '';
  $('flags').innerHTML = (stats.pvp ? `<span class="pvp">${t('pvpOn')}</span>` : '') + (stats.sleeping ? `<span>${t('sleepingFlag')}</span>` : '');
  const c = stats.carry;
  $('carryInfo').style.display = c ? 'block' : 'none';
  if (c) $('carryInfo').innerHTML = `${CARRY_ICON[c.type]}<b>${esc(tname(c.type))}</b><small>${t('carryHelp')}</small>`;
}
function updateHotbar() {
  const hb = $('hotbar'); hb.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const it = stats.inv?.[i], d = document.createElement('div'); d.className = 'slot' + (i === sel ? ' sel' : '');
    d.innerHTML = `<small>${i + 1}</small>${it ? ICON[it.t] : ''}` + (it && it.d != null ? `<div class="dur${it.d / ITEMS[it.t].dur < 0.25 ? ' low' : ''}"><i style="width:${it.d / ITEMS[it.t].dur * 100}%"></i></div>` : '');
    if (it && it.n > 1) d.innerHTML += `<b class="cnt">${it.n}</b>`;
    d.title = it ? iname(it.t) : t('empty');
    d.onpointerdown = (e) => { if (e.button && e.button !== 0) return; e.preventDefault(); sel = i; updateHotbar(); sfx.play('click'); };
    hb.appendChild(d);
  }
  const it = stats.inv?.[sel];
  if (it) showMsg(iname(it.t), 1100, true);
}
let msgTimer;
function showMsg(t, ms = 2500, soft) { const m = $('msg'); m.textContent = noEmo(t); m.style.opacity = soft ? 0.75 : 1; clearTimeout(msgTimer); msgTimer = setTimeout(() => (m.style.opacity = 0), ms); }
let annTimer;
function announce(a) {
  const el = $('announce'); el.textContent = noEmo(a.text); el.className = 'show ' + (a.kind || '');
  clearTimeout(annTimer); annTimer = setTimeout(() => (el.className = ''), 4500);
  if (a.kind === 'night') { sfx.play('alarm'); bigText(`${t('night')} ${dayN}`, 'night'); }
  else if (a.kind === 'blood') { sfx.play('alarm'); bigText(t('blood'), 'night'); }
  else if (a.kind === 'fog') { sfx.play('chime'); bigText(t('fog'), 'fog'); }
  else if (a.kind === 'day') { sfx.play('chime'); bigText(`${t('day').toUpperCase()} ${dayN} · ${wd(weekday(dayN)).toUpperCase()}`, ''); }
  else sfx.play(a.kind === 'creepy' ? 'creak' : 'chime', { gain: 0.5 });
  addChat({ sys: true, text: noEmo(a.text) });
}
function npcSay(m) {
  const o = npcs.get(m.id); if (!o) return;
  if (o.bubble) { o.h.g.remove(o.bubble); o.bubble.material.map.dispose(); }
  const b = nameLabel('“' + m.text.slice(0, 44) + (m.text.length > 44 ? '…”' : '”'), '#fff');
  b.scale.set(3.6, 1.08, 1); b.position.y = (o.h.labelY || 2.4) + 0.5; o.h.g.add(b); o.bubble = b; o.bubbleT = 4;
  const sp = spatial(o.h.g.position);
  // the employees' monotone voice (optional, browser TTS) for the nearest one only
  if (sp.gain > 0.55 && settings.vol > 0 && 'speechSynthesis' in window && !speechSynthesis.speaking) {
    try { const u = new SpeechSynthesisUtterance(m.text); u.lang = lang === 'ru' ? 'ru-RU' : 'en-US'; u.rate = 0.85; u.pitch = 0.3; u.volume = Math.min(1, settings.vol * sp.gain); speechSynthesis.speak(u); } catch { /* no TTS */ }
  }
}
function bigText(t, cls) { const b = $('bigDay'); b.textContent = t; b.className = 'show ' + cls; setTimeout(() => (b.className = cls), 2600); }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function addChat(c) {
  const d = document.createElement('div');
  if (c.sys) { d.className = 'sys'; d.textContent = noEmo(c.text); }
  else { if (c.party && c.party === myParty()) d.className = 'pt'; d.innerHTML = `<b>${esc(c.name)}</b> ${esc(c.text)}`; }
  const log = $('chatLog'); log.appendChild(d); while (log.children.length > 7) log.firstChild.remove();
  chatPing();
}
function addFeed(t) { const d = document.createElement('div'); d.textContent = noEmo(t); const f = $('feed'); f.prepend(d); while (f.children.length > 3) f.lastChild.remove(); setTimeout(() => d.classList.add('out'), 5000); setTimeout(() => d.remove(), 5600); }
// chat stays visible for a few seconds after a new line, then fades out until Enter is pressed
let chatIdle;
function chatPing() { const c = $('chat'); c.classList.add('active'); clearTimeout(chatIdle); chatIdle = setTimeout(() => { if (!chatOpen) c.classList.remove('active'); }, 8000); }
// HUD modes: full / min / off (H cycles); minimap toggle (N)
function applyHud() {
  const m = settings.hud || 'min'; const h = $('hud');
  h.classList.toggle('hud-full', m === 'full'); h.classList.toggle('hud-min', m === 'min'); h.classList.toggle('hud-off', m === 'off');
  h.classList.toggle('map-on', !!settings.map || m === 'full');
  $('fps').style.display = settings.fps ? 'block' : 'none';
}
function cycleHud() {
  settings.hud = { full: 'min', min: 'off', off: 'full' }[settings.hud] || 'min'; saveSettings(); applyHud();
  document.querySelectorAll('.settings').forEach(buildSettings);
  const hh = $('hudHint'); hh.textContent = `HUD · ${t({ full: 'hudFull', min: 'hudMin', off: 'hudOff' }[settings.hud])}`; hh.classList.add('show'); clearTimeout(hh._t); hh._t = setTimeout(() => hh.classList.remove('show'), 1400);
}
function hurtFlash() { const f = $('dmgflash'); f.style.transition = 'none'; f.style.opacity = 1; requestAnimationFrame(() => { f.style.transition = 'opacity .6s'; f.style.opacity = 0; }); }
function dmgNumber(h) {
  const v = new THREE.Vector3(h.x, h.y || 1.6, h.z).project(camera);
  if (v.z > 1) return;
  const d = document.createElement('div'); d.className = 'dmgnum'; d.textContent = '-' + h.dmg;
  d.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; d.style.top = ((1 - v.y) / 2 * innerHeight) + 'px';
  if (h.wood) d.style.color = '#d9b06a';
  document.body.appendChild(d);
  requestAnimationFrame(() => { d.style.transform = `translate(${(Math.random() - 0.5) * 40}px,-60px)`; d.style.opacity = 0; });
  setTimeout(() => d.remove(), 900);
}
function renderBoard(b) {
  lastBoard = b;
  $('plist').innerHTML = `<div class="ph"><span>${t('players')}</span><span>${t('days')}</span><span>${t('bLv')}</span></div>` + b.online.slice(0, 12).map(p => `<div class="pr${p.name === myName ? ' me' : ''}${p.party && p.party === myParty() ? ' tm' : ''}"><span>${esc(p.name)}</span><span>${p.days}</span><span>${p.lv}</span></div>`).join('');
  $('onlineT').innerHTML = `<tr><th>${t('bName')}</th><th>${t('bLv')}</th><th>${t('bNights')}</th><th>${t('bKos')}</th></tr>` + b.online.map(p => `<tr><td>${esc(p.name)}${p.party ? ' ·' : ''}</td><td>${p.lv}</td><td>${p.days}</td><td>${p.kos}</td></tr>`).join('');
  $('topT').innerHTML = `<tr><th>#</th><th>${t('bName')}</th><th>${t('bBest')}</th><th>${t('bLv')}</th></tr>` + b.top.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.name)}</td><td>${p.bestDays}</td><td>${p.level}</td></tr>`).join('');
}
const CARRY_ICON = new Proxy({}, { get: (_, k) => carrySvg(k) });
const ACH_IC = { night1: 'moon', night5: 'moon', night10: 'moon', blood: 'drop', fog: 'cloud', eat10: 'food', break1: 'hammer', break25: 'hammer', mats100: 'plank', craft1: 'craft', craft15: 'craft', build10: 'wall', base: 'flag', anchor: 'pin', ko1: 'bat', ko10: 'bat', trap: 'trap', lv5: 'star', lv10: 'star', streak3: 'fire', style: 'user', team: 'users' };
const achIc = (a, n = 16) => svg(ACH_IC[a.id] || 'trophy', n);
function nearFlag(flag) { return boxesCache.some(b => TYPES[b.f.type]?.[flag] && Math.max(b.x0 - me.x, 0, me.x - b.x1) ** 2 + Math.max(b.z0 - me.z, 0, me.z - b.z1) ** 2 < 2.5 ** 2); }
const nearStove = () => nearFlag('stove');
// material a piece of furniture breaks into (drives colours of chips + sound)
function matOf(type) { const l = LOOT[type]; if (!l) return 'plank'; return Object.entries(l).sort((a, b) => b[1] - a[1])[0][0]; }
const MAT_COL = { plank: 0xa0743f, scrap: 0x9aa0a6, cloth: 0xd9c9a8, plastic: 0xeeeeee, pane: 0xbfe6ff, glass: 0xbfe6ff };
const matColor = (f) => MAT_COL[matOf(f.type)] || 0xa0743f;

// ---------------- inventory / crafting / chest panel ----------------
let hoverSlot = -1, drag = null, invSig = '';
function openInv() { invOpen = true; $('inv').classList.remove('hidden'); document.exitPointerLock?.(); renderInv(); sfx.play('click'); syncPanelClass(); }
function closeInv() {
  invOpen = false; $('inv').classList.add('hidden'); hideTip(); hoverSlot = -1;
  if (chestData) { socket.emit('chestclose'); chestData = null; }
  if (invTab === 'chest') invTab = 'craft';
  syncPanelClass();
  if (!isTouch && playing) lockPointer();
}
function itemTip(it) {
  const d = ITEMS[it.t]; if (!d) return '';
  const lines = [`<b>${esc(iname(it.t))}</b>${it.n > 1 ? ` <span class="dim">×${it.n}</span>` : ''}`];
  if (d.weapon) lines.push(`${d.dmg} ${t('dmg')}` + (d.fx ? ` · ${t('breakPow')}${d.fx}` : ''));
  if (d.dur) lines.push(`${t('durab')}: ${it.d ?? d.dur}/${d.dur}`);
  if (d.food) lines.push(`+${d.food} ${t('food_')}`); if (d.energy) lines.push(`+${d.energy} ${t('energy_')}`); if (d.heal) lines.push(`+${d.heal} ${t('heal_')}`);
  if (d.mat) lines.push(`<i>${t('matDesc')}</i>`);
  lines.push(`<small>${lang === 'ru' ? 'В стопке до' : 'Stacks to'} ${stackOf(it.t)}</small>`);
  return lines.join('<br>');
}
function showTip(html, e) { const tt = $('itTip'); if (!html) return hideTip(); tt.innerHTML = html; tt.style.display = 'block'; tt.style.left = Math.min(innerWidth - 260, e.clientX + 16) + 'px'; tt.style.top = Math.min(innerHeight - 140, e.clientY + 12) + 'px'; }
function hideTip() { $('itTip').style.display = 'none'; }
function slotEl(it, idx, kind) {
  const d = document.createElement('div'); d.className = 'islot' + (kind === 'inv' && idx < HOTBAR ? ' hb' : '') + (kind === 'inv' && idx === sel ? ' sel' : '');
  d.dataset.idx = idx; d.dataset.kind = kind;
  if (kind === 'inv' && idx < HOTBAR) d.innerHTML = `<small>${idx + 1}</small>`;
  if (it) {
    d.innerHTML += `<span class="ic">${ICON[it.t]}</span>` + (it.n > 1 ? `<b class="cnt">${it.n}</b>` : '');
    if (it.d != null && ITEMS[it.t].dur) { const f = it.d / ITEMS[it.t].dur; d.innerHTML += `<div class="dur${f < 0.25 ? ' low' : ''}"><i style="width:${f * 100}%"></i></div>`; }
  }
  d.onpointerenter = (e) => { hoverSlot = kind === 'inv' ? idx : -1; if (it && !drag) showTip(itemTip(it), e); };
  d.onpointermove = (e) => { if (it && !drag) showTip(itemTip(it), e); };
  d.onpointerleave = () => { hoverSlot = -1; hideTip(); };
  d.oncontextmenu = (e) => { e.preventDefault(); if (!it) return; if (kind === 'inv') { if (chestData) socket.emit('chestmove', { dir: 'in', slot: idx, n: it.n }); else useItem(idx); } else socket.emit('chestmove', { dir: 'out', slot: idx, n: it.n }); };
  d.onpointerdown = (e) => {
    if (e.button !== 0 || !it) return; e.preventDefault();
    if (e.shiftKey && kind === 'inv' && it.n > 1) { const empty = stats.inv.findIndex((x, i) => !x && i >= 0); if (empty >= 0) socket.emit('invmove', { from: idx, to: empty, n: Math.floor(it.n / 2) }); sfx.play('click'); return; }
    if (e.ctrlKey && kind === 'inv') { socket.emit('discard', { slot: idx, n: 1 }); return; }
    const ghostEl = document.createElement('div'); ghostEl.className = 'dragGhost'; ghostEl.innerHTML = ICON[it.t] + (it.n > 1 ? `<b>${it.n}</b>` : ''); document.body.appendChild(ghostEl);
    drag = { from: idx, kind, it, el: ghostEl, sx: e.clientX, sy: e.clientY, moved: false }; hideTip(); moveDrag(e);
  };
  return d;
}
function moveDrag(e) { if (!drag) return; drag.el.style.left = e.clientX - 24 + 'px'; drag.el.style.top = e.clientY - 24 + 'px'; if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) drag.moved = true; }
addEventListener('pointermove', moveDrag);
addEventListener('pointerup', (e) => {
  if (!drag) return; const d = drag; drag = null; d.el.remove();
  if (!d.moved) { if (d.kind === 'inv' && d.from < HOTBAR) { sel = d.from; updateHotbar(); renderInv(); } return; }
  const tgt = document.elementFromPoint(e.clientX, e.clientY)?.closest('.islot'), inPanel = document.elementFromPoint(e.clientX, e.clientY)?.closest('#inv .box');
  if (tgt) {
    const to = +tgt.dataset.idx, tk = tgt.dataset.kind;
    if (d.kind === 'inv' && tk === 'inv' && to !== d.from) socket.emit('invmove', { from: d.from, to });
    else if (d.kind === 'inv' && tk === 'chest') socket.emit('chestmove', { dir: 'in', slot: d.from, n: d.it.n });
    else if (d.kind === 'chest' && tk === 'inv') socket.emit('chestmove', { dir: 'out', slot: d.from, n: d.it.n });
    sfx.play('click');
  } else if (!inPanel && d.kind === 'inv') { socket.emit('discard', { slot: d.from, n: d.it.n }); sfx.play('swing', { gain: 0.5 }); }
});
function have() { const h = {}; (stats.inv || []).forEach(it => { if (it) h[it.t] = (h[it.t] || 0) + (it.n || 1); }); return h; }
function renderInv() {
  invSig = JSON.stringify([stats.inv, stats.carry, stats.lv, nearFlag('bench'), nearFlag('stove')]);
  if (!invOpen) return;
  const box = $('invBody'); box.innerHTML = '';
  // left: backpack grid
  const left = document.createElement('div'); left.className = 'invL';
  left.innerHTML = `<h3>${t('inventory')}</h3><div class="sub">${t('hotbar')}</div>`;
  const hb = document.createElement('div'); hb.className = 'igrid'; for (let i = 0; i < HOTBAR; i++) hb.appendChild(slotEl(stats.inv?.[i], i, 'inv')); left.appendChild(hb);
  left.insertAdjacentHTML('beforeend', `<div class="sub">${t('backpack')}</div>`);
  const bp = document.createElement('div'); bp.className = 'igrid'; for (let i = HOTBAR; i < SLOTS; i++) bp.appendChild(slotEl(stats.inv?.[i], i, 'inv')); left.appendChild(bp);
  const h = have(), mats = ['plank', 'scrap', 'cloth', 'plastic', 'pane'].map(m => `<span title="${esc(iname(m))}">${svg({ plank: 'plank', scrap: 'scrap', cloth: 'cloth', plastic: 'plastic', pane: 'pane' }[m], 15)}${h[m] || 0}</span>`).join('');
  left.insertAdjacentHTML('beforeend', `<div class="matsum"><b>${t('materials')}:</b> ${mats}</div><div class="ihint">${t('invHint')}</div>`);
  box.appendChild(left);
  // right: crafting or chest
  const right = document.createElement('div'); right.className = 'invR';
  const tabs = document.createElement('div'); tabs.className = 'itabs';
  for (const [k, label] of [['craft', t('crafting')], ...(chestData ? [['chest', t('chest')]] : [])]) { const b = document.createElement('button'); b.textContent = label; b.className = invTab === k ? 'on' : ''; b.onclick = () => { invTab = k; renderInv(); }; tabs.appendChild(b); }
  right.appendChild(tabs);
  if (invTab === 'chest' && chestData) {
    const g = document.createElement('div'); g.className = 'igrid chestG';
    for (let i = 0; i < 12; i++) g.appendChild(slotEl(chestData.store?.[i], i, 'chest'));
    right.appendChild(g); right.insertAdjacentHTML('beforeend', `<div class="ihint">${lang === 'ru' ? 'Перетаскивай между рюкзаком и сундуком · ПКМ — переложить всю стопку' : 'Drag between backpack and chest · RMB moves the whole stack'}</div>`);
  } else {
    const cats = document.createElement('div'); cats.className = 'icats';
    for (const c of ['all', 'build', 'defense', 'weapon', 'tool', 'med', 'food', 'light']) { const b = document.createElement('button'); b.textContent = t(c); b.className = craftCat === c ? 'on' : ''; b.onclick = () => { craftCat = c; renderInv(); }; cats.appendChild(b); }
    right.appendChild(cats);
    const list = document.createElement('div'); list.className = 'rlist';
    const bench = nearFlag('bench'), stove = nearFlag('stove');
    for (const r of RECIPES) {
      if (craftCat !== 'all' && r.cat !== craftCat) continue;
      const okMat = Object.entries(r.needs).every(([k, n]) => (h[k] || 0) >= n), ok = okMat && (!r.bench || bench) && (!r.stove || stove) && (!r.carry || !stats.carry);
      const name = r.gives ? iname(r.gives) : tname(r.carry), icon = r.gives ? ICON[r.gives] : CARRY_ICON[r.carry];
      const div = document.createElement('div'); div.className = 'recipe' + (ok ? ' ok' : '');
      const sub = r.carry ? `<small class="pl">${t('placeable')}</small>` : (r.n > 1 ? ` ×${r.n}` : '');
      div.innerHTML = `<div class="ric">${icon}</div><div class="rinfo"><b>${esc(name)}</b> ${sub}<div class="need">${Object.entries(r.needs).map(([k, n]) => `<span class="${(h[k] || 0) >= n ? '' : 'miss'}">${esc(iname(k))} ${h[k] || 0}/${n}</span>`).join('')}${r.bench ? `<span class="${bench ? '' : 'miss'}">${t('needBench')}</span>` : ''}${r.stove ? `<span class="${stove ? '' : 'miss'}">${t('needStove')}</span>` : ''}</div></div>`;
      const b = document.createElement('button'); b.textContent = t('craftBtn'); b.disabled = !ok; b.onclick = () => { socket.emit('craft', r.id); sfx.play('craft'); if (r.carry) closeInv(); };
      if (r.gives) div.onpointerenter = (e) => showTip(itemTip({ t: r.gives, n: r.n || 1 }), e), div.onpointerleave = hideTip;
      div.appendChild(b); list.appendChild(div);
    }
    right.appendChild(list);
  }
  box.appendChild(right);
}
const renderCraft = renderInv;
$('invClose').onclick = () => closeInv();

// ---------------- toasts / achievements ----------------
function toast(html, cls = '', ms = 3500) {
  const d = document.createElement('div'); d.className = 'toast ' + cls; d.innerHTML = html; $('toasts').appendChild(d);
  while ($('toasts').children.length > 5) $('toasts').firstChild.remove();
  if (cls !== 'loot') sfx.play('toast');
  setTimeout(() => d.classList.add('out'), ms); setTimeout(() => d.remove(), ms + 600);
}
function openAch() {
  const el = $('achList'); $('achTitleH').textContent = t('achTitle') + ` — ${myAch.size}/${ACHIEVEMENTS.length}`;
  el.innerHTML = `<div class="streakRow">${svg('fire', 14)} ${t('streakDays')}: <b>${myStreak}</b></div>` + ACHIEVEMENTS.map(a => `<div class="ach${myAch.has(a.id) ? ' got' : ''}"><span class="ai">${achIc(a, 18)}</span><div><b>${esc(nm(a))}</b><small>${esc(lang === 'ru' ? a.dru : a.den)}</small></div><em>+${a.xp} XP</em></div>`).join('');
  $('achP').classList.remove('hidden'); document.exitPointerLock?.(); syncPanelClass();
}

// ---------------- destruction visuals ----------------
const fxParts = [], fxGeo = new THREE.BoxGeometry(1, 1, 1), hpBars = new Map();
function spawnPart(x, y, z, col, s, vx, vy, vz, life) {
  if (fxParts.length > 220) { const o = fxParts.shift(); scene.remove(o.m); o.m.material.dispose(); }
  const m = new THREE.Mesh(fxGeo, new THREE.MeshLambertMaterial({ color: col, transparent: true })); m.scale.setScalar(s); m.position.set(x, y, z); m.rotation.set(Math.random() * 3, Math.random() * 3, 0); scene.add(m);
  fxParts.push({ m, vx, vy, vz, life, max: life, spin: (Math.random() - 0.5) * 10 });
}
function chips(x, y, z, col, n) { for (let i = 0; i < n; i++) spawnPart(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4, col, 0.05 + Math.random() * 0.06, (Math.random() - 0.5) * 4, 1.5 + Math.random() * 3, (Math.random() - 0.5) * 4, 0.9); }
function puff(x, y, z, col, n) { for (let i = 0; i < n; i++) spawnPart(x + (Math.random() - 0.5), y, z + (Math.random() - 0.5), col, 0.25 + Math.random() * 0.2, (Math.random() - 0.5) * 1.2, 0.4 + Math.random(), (Math.random() - 0.5) * 1.2, 1.2); }
function debris(b) {
  const col = MAT_COL[matOf(b.type)] || 0xa0743f, vol = Math.max(0.3, (b.w || 1) * (b.d || 1) * (b.h || 1)), n = Math.min(26, 8 + vol * 5 | 0);
  for (let i = 0; i < n; i++) spawnPart(b.x + (Math.random() - 0.5) * (b.w || 1), (b.y || 0) + Math.random() * (b.h || 1), b.z + (Math.random() - 0.5) * (b.d || 1), Math.random() < 0.25 ? 0x5a4632 : col, 0.08 + Math.random() * 0.22, (Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 6, 1.6 + Math.random());
  puff(b.x, (b.y || 0) + 0.3, b.z, 0xcfc6b5, 8);
}
function updateFx(dt) {
  for (let i = fxParts.length - 1; i >= 0; i--) {
    const p = fxParts[i], m = p.m; p.life -= dt;
    if (p.life <= 0) { scene.remove(m); m.material.dispose(); fxParts.splice(i, 1); continue; }
    p.vy -= (p.m.scale.x > 0.24 ? 0.5 : 14) * dt; m.position.x += p.vx * dt; m.position.y += p.vy * dt; m.position.z += p.vz * dt;
    if (m.position.y < m.scale.y / 2) { m.position.y = m.scale.y / 2; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; p.spin *= 0.5; }
    m.rotation.x += p.spin * dt; m.rotation.z += p.spin * dt * 0.7;
    if (m.scale.x > 0.24) m.scale.multiplyScalar(1 + dt * 0.8);
    m.material.opacity = Math.min(1, p.life / (p.max * 0.4));
  }
}
const crackTex = canvasTex((c, w, h) => {
  c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(20,12,6,.85)'; c.lineWidth = 3;
  for (let k = 0; k < 7; k++) { let x = w / 2 + (Math.random() - 0.5) * 40, y = h / 2 + (Math.random() - 0.5) * 40; c.beginPath(); c.moveTo(x, y); const a = Math.random() * 6.28; for (let s = 0; s < 6; s++) { x += Math.cos(a + (Math.random() - 0.5)) * 22; y += Math.sin(a + (Math.random() - 0.5)) * 22; c.lineTo(x, y); } c.stroke(); }
}, 256, 256, true);
function addCrack(g, b, frac) {
  const m = new THREE.Mesh(fxGeo, new THREE.MeshBasicMaterial({ map: crackTex, transparent: true, opacity: Math.min(0.95, 1.15 - frac), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  const y0 = b.y0 || 0; m.scale.set(b.x1 - b.x0 + 0.02, b.h - y0 + 0.02, b.z1 - b.z0 + 0.02); m.position.set((b.x0 + b.x1) / 2 - (g.position?.x || 0), (y0 + b.h) / 2 - (g.position?.y || 0), (b.z0 + b.z1) / 2 - (g.position?.z || 0)); m.userData.crack = true; g.add(m);
}
function showHpBar(f, hp, max) {
  const b = f.box || aabb(f); let e = hpBars.get(f.id);
  if (!e) { const el = document.createElement('div'); el.className = 'fhp'; el.innerHTML = '<span></span><b><i></i></b>'; document.body.appendChild(el); e = { el }; hpBars.set(f.id, e); }
  Object.assign(e, { x: (b.x0 + b.x1) / 2, y: b.h + 0.4, z: (b.z0 + b.z1) / 2, t: 3 });
  const fr = Math.max(0, hp / max); e.el.querySelector('i').style.width = fr * 100 + '%'; e.el.classList.toggle('low', fr < 0.3); e.el.firstChild.textContent = tname(f.type);
}
function updateHpBars(dt) {
  for (const [id, e] of hpBars) {
    e.t -= dt; if (e.t <= 0 || world.removed.has(id)) { e.el.remove(); hpBars.delete(id); continue; }
    const v = new THREE.Vector3(e.x, e.y, e.z).project(camera);
    if (v.z > 1) { e.el.style.display = 'none'; continue; }
    e.el.style.display = 'block'; e.el.style.left = (v.x + 1) / 2 * innerWidth + 'px'; e.el.style.top = (1 - v.y) / 2 * innerHeight + 'px'; e.el.style.opacity = Math.min(1, e.t);
  }
}

// ---------------- language ----------------
function applyStatic() {
  document.querySelectorAll('[data-t]').forEach(e => { e.innerHTML = t(e.dataset.t); });
  document.querySelectorAll('[data-tp]').forEach(e => { e.placeholder = t(e.dataset.tp); });
  document.querySelectorAll('.settings').forEach(buildSettings);
  $('helpBody').innerHTML = HELP[lang];
  document.querySelectorAll('[data-ic]').forEach(e => { if (e.dataset.icDone !== '1') { e.insertAdjacentHTML('afterbegin', svg(e.dataset.ic, e.closest('#tbtns') ? 22 : 18)); e.dataset.icDone = '1'; } });
  updateRotateHint?.();
  applyHud();
}
$('setBtn').onclick = () => $('menuSettings').classList.toggle('collapsed');
function applyLang(l) {
  setLang(l); applyStatic();
  for (const k of [...chunks.keys()]) unloadChunk(k);
  for (const o of others.values()) o.labelKey = null;
  if (stats.inv) { updateHud(); updateHotbar(); }
  if (invOpen) renderInv(); if (lastBoard) renderBoard(lastBoard); tip(tipIdx);
}
const HELP = {
  ru: `<table><tr><td>WASD</td><td>ходить · <b>Shift</b> бег · <b>Пробел</b> прыжок</td></tr><tr><td>Мышь</td><td>камера · колесо — отдалить</td></tr><tr><td>ЛКМ</td><td>удар / ломать мебель / поставить</td></tr><tr><td>ПКМ / X</td><td>съесть / использовать</td></tr><tr><td>E</td><td>подобрать · взять мебель · открыть дверь/сундук (Shift+E — взять)</td></tr><tr><td>Q / R / V</td><td>поставить · повернуть · высота (на столы и полки)</td></tr><tr><td>Ctrl+Z</td><td>забрать последнее поставленное</td></tr><tr><td>I / C</td><td>инвентарь · крафт</td></tr><tr><td>L</td><td>закрепить свою постройку</td></tr><tr><td>Z</td><td>спать у кровати</td></tr><tr><td>F / T</td><td>фонарик · метка</td></tr><tr><td>G</td><td>выбросить предмет</td></tr><tr><td>1–8</td><td>панель быстрого доступа</td></tr><tr><td>B J K U Y</td><td>эмоции</td></tr><tr><td>H</td><td>интерфейс: полный / минимальный / скрыт</td></tr><tr><td>N</td><td>миникарта</td></tr><tr><td>Tab / Enter</td><td>таблица · чат</td></tr><tr><td>F1 / ?</td><td>эта подсказка</td></tr><tr><td>Esc / M</td><td>пауза · настройки</td></tr></table><p>Ломай мебель (лучше молотком или топором), чтобы получить дерево, металлолом, ткань, пластик и стекло. Крафти верстак — у него открываются стены, двери и ловушки. Сломанная мебель со временем возвращается, но не на территории чужой базы. Ночью сотрудники ломают баррикады — укрепляй крепость!</p>`,
  en: `<table><tr><td>WASD</td><td>move · <b>Shift</b> sprint · <b>Space</b> jump</td></tr><tr><td>Mouse</td><td>camera · wheel zooms</td></tr><tr><td>LMB</td><td>attack / break furniture / place</td></tr><tr><td>RMB / X</td><td>eat / use</td></tr><tr><td>E</td><td>pick up · grab furniture · open door/chest (Shift+E grabs)</td></tr><tr><td>Q / R / V</td><td>place · rotate · height (onto tables and shelves)</td></tr><tr><td>Ctrl+Z</td><td>pick your last piece back up</td></tr><tr><td>I / C</td><td>inventory · crafting</td></tr><tr><td>L</td><td>anchor your build</td></tr><tr><td>Z</td><td>sleep near a bed</td></tr><tr><td>F / T</td><td>flashlight · waypoint</td></tr><tr><td>G</td><td>drop item</td></tr><tr><td>1–8</td><td>hotbar</td></tr><tr><td>B J K U Y</td><td>emotes</td></tr><tr><td>H</td><td>interface: full / minimal / hidden</td></tr><tr><td>N</td><td>minimap</td></tr><tr><td>Tab / Enter</td><td>leaderboard · chat</td></tr><tr><td>F1 / ?</td><td>this hint</td></tr><tr><td>Esc / M</td><td>pause · settings</td></tr></table><p>Break furniture (a hammer or axe is fastest) for wood, scrap, cloth, plastic and glass. Craft a workbench to unlock walls, doors and traps. Broken furniture grows back over time, but never inside someone's base. At night the employees smash barricades, so reinforce your fort!</p>`,
};
const TIPS = {
  ru: ['Добро пожаловать в магазин! День длится 6 минут, ночь — 5. Еду завозят по понедельникам и пятницам — больше всего в столовой.',
    'Днём сотрудники безобидны. Ночью они охотятся на всех, кого видят, и ломают баррикады. Строй крепость!',
    'Ломай мебель ЛКМ — из неё выпадают материалы. Молоток и топор ломают в разы быстрее.',
    'Открой инвентарь (I) или крафт (C). Сначала сделай верстак — с ним открываются стены, двери и ловушки.',
    'Неся мебель: R — повернуть, V — выбрать высоту (можно ставить на столы), Ctrl+Z — забрать обратно.',
    'Флаг базы защищает твою крепость: внутри неё мебель не появляется снова, и ты возрождаешься там.',
    'Нажми «Персонаж» в меню — новые причёски, шапки и узоры открываются с уровнем.',
    'F — фонарик, T — метка, L — закрепить, N — карта, H — интерфейс, F1 — управление, Tab — таблица, Enter — чат.'],
  en: ['Welcome to the store! Days last 6 minutes, nights 5. Food restocks every Monday and Friday — the Cafeteria has the most.',
    'Employees are harmless by day. At night they hunt anyone they spot and smash barricades. Build a fort!',
    'Break furniture with LMB for materials. A hammer or axe breaks things much faster.',
    'Open the inventory (I) or crafting (C). Craft a workbench first — it unlocks walls, doors and traps.',
    'While carrying: R rotates, V picks the height (you can place on tables), Ctrl+Z picks it back up.',
    'A Claim Flag protects your fort: furniture never respawns inside it and you respawn there.',
    'Press «Avatar» in the menu — new hair, hats and patterns unlock as you level up.',
    'F flashlight, T waypoint, L anchor, N map, H interface, F1 controls, Tab leaderboard, Enter chat.'],
};
let tipIdx = 0, tipTimer;
function tip(i) {
  tipIdx = i; const el = $('tip');
  if (!settings.tips || i >= TIPS[lang].length) { el.style.opacity = 0; return; }
  el.textContent = TIPS[lang][i]; el.style.opacity = 1;
  clearTimeout(tipTimer); tipTimer = setTimeout(() => { el.style.opacity = 0; tipTimer = setTimeout(() => tip(i + 1), 6000); }, 9000);
}

// ---------------- input ----------------
function lockPointer() { try { const r = renderer.domElement.requestPointerLock?.(); r?.catch?.(() => {}); } catch (e) { /* needs a user gesture */ } }
let chatOpen = false, locked = false, kx = 0, kz = 0, shake = 0, escOpenedPause = false;
const canvas = renderer.domElement;
canvas.addEventListener('click', () => { if (playing && !isTouch && !locked && !anyPanel()) lockPointer(); });
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked && playing && !chatOpen && !anyPanel() && !stats.dead && !isTouch) { openPause(); escOpenedPause = true; }
});
const anyPanel = () => ['pause', 'help', 'inv', 'death', 'achP'].some(id => !$(id).classList.contains('hidden')) || !!$('avatarEd');
function syncPanelClass() { document.body.classList.toggle('panel-open', anyPanel() || chatOpen || !$('menu').classList.contains('hidden')); }
document.addEventListener('mousemove', (e) => {
  if (!locked) return;
  const s = 0.0022 * settings.sens;
  tyaw -= e.movementX * s;
  tpitch += e.movementY * s * (settings.invertY ? -1 : 1);
  tpitch = Math.max(-0.6, Math.min(1.25, tpitch));
});
document.addEventListener('wheel', (e) => { if (invOpen) return; if (stats.carry && (e.altKey || keys.KeyV)) { cycleHeight(e.deltaY > 0 ? -1 : 1); return; } camDist = Math.max(2.2, Math.min(10, camDist + e.deltaY * 0.004)); });
document.addEventListener('mousedown', (e) => { if (!locked || !playing) return; if (e.button === 0) primary(); if (e.button === 2) useItem(); });
document.addEventListener('contextmenu', (e) => e.preventDefault());
function openPause() { $('pause').classList.remove('hidden'); $('keysHint').classList.add('hidden'); if (document.pointerLockElement) document.exitPointerLock(); syncPanelClass(); }
function resumePlay() { $('pause').classList.add('hidden'); $('help').classList.add('hidden'); syncPanelClass(); if (!isTouch && playing && !stats.dead) lockPointer(); }
$('menuBtn').onclick = () => openPause();
$('resumeBtn').onclick = () => resumePlay();
$('helpBtn').onclick = () => { $('help').classList.remove('hidden'); syncPanelClass(); };
$('helpClose').onclick = () => { $('help').classList.add('hidden'); syncPanelClass(); if (!$('pause').classList.contains('hidden')) return; if (!isTouch) lockPointer(); };
$('respawnBtn').onclick = () => { socket.emit('respawn'); $('death').classList.add('hidden'); syncPanelClass(); if (!isTouch) lockPointer(); };
function toggleCraft() { if (invOpen && invTab === 'craft') closeInv(); else { invTab = 'craft'; openInv(); } }
function toggleKeysHint() {
  const el = $('keysHint');
  if (!el.classList.contains('hidden')) { el.classList.add('hidden'); return; }
  el.innerHTML = HELP[lang]; el.classList.remove('hidden');
}
function closePanelsAndResume() {
  ['help', 'pause', 'achP'].forEach(id => $(id).classList.add('hidden'));
  $('keysHint').classList.add('hidden');
  syncPanelClass();
  if (!isTouch && playing && !stats.dead && !invOpen && !chatOpen) lockPointer();
}

addEventListener('keydown', (e) => {
  if (!playing) return;
  if (e.code === 'F1' || (e.key === '?' || (e.shiftKey && e.code === 'Slash'))) { e.preventDefault(); toggleKeysHint(); return; }
  if (chatOpen) {
    if (e.key === 'Enter') { const v = $('chatInput').value.trim(); if (v) socket.emit('chat', v); closeChat(); }
    else if (e.key === 'Escape') closeChat();
    return;
  }
  if (e.key === 'Tab' && !invOpen) { e.preventDefault(); $('board').classList.remove('hidden'); return; }
  if (e.key === 'Enter') { chatOpen = true; const i = $('chatInput'); i.style.display = 'block'; i.focus(); document.exitPointerLock?.(); $('chat').classList.add('active', 'open'); syncPanelClass(); return; }
  const k = e.code; keys[k] = true;
  if (stats.dead) return;
  if (invOpen) {
    if (/^Digit[1-8]$/.test(k) && hoverSlot >= 0) { const to = +k.slice(5) - 1; if (to !== hoverSlot) socket.emit('invmove', { from: hoverSlot, to }); sfx.play('click'); return; }
    if (k === 'KeyI' || k === 'Escape' || k === 'Tab' || (k === 'KeyC' && invTab === 'craft') || k === 'KeyE') { closeInv(); return; }
    if (k === 'KeyC') { invTab = 'craft'; renderInv(); }
    return;
  }
  if (k === 'Escape') {
    if (escOpenedPause) { escOpenedPause = false; return; } // browser unlock already opened pause
    if (!$('keysHint').classList.contains('hidden')) { $('keysHint').classList.add('hidden'); return; }
    if (!$('help').classList.contains('hidden') || !$('achP').classList.contains('hidden') || !$('pause').classList.contains('hidden')) { closePanelsAndResume(); return; }
    openPause(); return;
  }
  if (k === 'KeyC') toggleCraft();
  if (k === 'KeyI') { if (invTab === 'chest' && !chestData) invTab = 'craft'; openInv(); }
  if ((e.ctrlKey && k === 'KeyZ') || k === 'Backspace') { e.preventDefault(); socket.emit('undo'); return; }
  if (k === 'KeyV' && stats.carry && !e.repeat) cycleHeight(e.shiftKey ? -1 : 1);
  if (/^Digit[1-8]$/.test(k)) { sel = +k.slice(5) - 1; updateHotbar(); sfx.play('click'); }
  if (k === 'KeyE') interact();
  if (k === 'KeyQ') placeCarry();
  if (k === 'KeyR') { rotPlace = (rotPlace + 1) & 3; }
  if (k === 'KeyG') { if (stats.inv[sel]) socket.emit('discard', sel); }
  if (k === 'KeyX') useItem();
  if (k === 'KeyF') { flashOn = !flashOn; sfx.play('click'); }
  if (k === 'KeyZ' && !e.ctrlKey) { if (stats.sleeping) socket.emit('wake'); else socket.emit('sleep'); }
  if (k === 'KeyL') lockNearest();
  if (k === 'KeyT') { if (e.shiftKey) { while (waypoints.length) removeWaypoint(0); showMsg(t('wpCleared')); } else addWaypoint(); }
  if (k === 'KeyM') openPause();
  if (k === 'KeyH' && !e.repeat) cycleHud();
  if (k === 'KeyN' && !e.repeat) { settings.map = !settings.map; saveSettings(); applyHud(); document.querySelectorAll('.settings').forEach(buildSettings); }
  const em = { KeyB: 'wave', KeyJ: 'dance', KeyK: 'sit', KeyU: 'point', KeyY: 'cheer' }[k];
  if (em) socket.emit('emote', em);
});
addEventListener('keyup', (e) => { keys[e.code] = false; if (e.key === 'Tab') $('board').classList.add('hidden'); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function closeChat() { chatOpen = false; const i = $('chatInput'); i.value = ''; i.style.display = 'none'; i.blur(); $('chat').classList.remove('open'); chatPing(); syncPanelClass(); if (!isTouch) lockPointer(); }
function onResize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  updateRotateHint();
}
addEventListener('resize', onResize);
addEventListener('orientationchange', () => setTimeout(onResize, 200));
function updateRotateHint() {
  const el = $('rotateHint'); if (!el) return;
  const need = isTouch && playing && innerHeight > innerWidth + 40;
  el.classList.toggle('hidden', !need);
}
function tryFullscreen() {
  if (!isTouch) return;
  const root = document.documentElement;
  (root.requestFullscreen || root.webkitRequestFullscreen)?.call(root)?.catch?.(() => {});
}

// ---------------- actions ----------------
const fwd = () => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });
function target() {
  // nearest item first, then furniture in front
  const f = fwd(); let best = null, bd = 1e9;
  for (const m of itemMeshes.values()) {
    const u = m.userData, dx = u.x - me.x, dz = u.z - me.z, d = Math.hypot(dx, dz);
    if (d > 2.8) continue; const score = d - (dx * f.x + dz * f.z) / Math.max(d, 0.1);
    if (score < bd) { bd = score; best = { kind: 'item', id: u.id, name: iname(u.type) }; }
  }
  if (best) return best;
  if (stats.carry) return null;
  const px = me.x + f.x * 1.2, pz = me.z + f.z * 1.2;
  for (const b of boxesCache) {
    const t = TYPES[b.f.type]; if (!t || t.fixed) continue;
    const cx = Math.max(b.x0, Math.min(px, b.x1)), cz = Math.max(b.z0, Math.min(pz, b.z1)), d = Math.hypot(px - cx, pz - cz);
    if (d < 1.3 && d < bd) { bd = d; best = { kind: 'furn', id: b.f.id, name: tname(b.f.type), f: b.f }; }
  }
  return best;
}
function interact() {
  const t = target(); if (!t) return;
  if (t.kind === 'item') return socket.emit('pickup', t.id);
  const ty = t.f?.type;
  if ((ty === 'door' || ty === 'dooropen') && t.id.startsWith('p_') && !keys.ShiftLeft) return socket.emit('door', t.id);
  if (ty === 'chest' && t.id.startsWith('p_') && !keys.ShiftLeft) return socket.emit('chestopen', t.id);
  socket.emit('grab', t.id);
}
// furniture straight ahead (also while carrying): what LMB would hit
function targetFurn() {
  const f = fwd(), px = me.x + f.x * 1.1, pz = me.z + f.z * 1.1; let best = null, bd = 1.5;
  for (const b of boxesCache) {
    if (!breakable(b.f.type) && !b.f.id.startsWith('p_')) continue;
    if (b.y0 > me.y + 1.9 || b.h < me.y + 0.1) continue;
    const cx = Math.max(b.x0, Math.min(px, b.x1)), cz = Math.max(b.z0, Math.min(pz, b.z1)), d = Math.hypot(px - cx, pz - cz);
    if (d < bd) { bd = d; best = b.f; }
  }
  return best;
}
function ghostPos() {
  const f = fwd(), c = stats.carry, t = TYPES[c.type];
  const dist = Math.max(t.w, t.d) / 2 + 1.1;
  const gp = { x: Math.round((me.x + f.x * dist) * 2) / 2, z: Math.round((me.z + f.z * dist) * 2) / 2, rot: rotPlace };
  // available surfaces under that spot (floor, table tops, stacked pieces…); V cycles, -1 = auto (lowest that fits)
  const flat = aabb({ type: c.type, x: gp.x, z: gp.z, rot: gp.rot });
  let ys = world.surfaces(flat, null); if (!ys.length) ys = [world.stackY(flat)];
  gp.ys = ys; gp.y = placeH >= 0 && placeH < ys.length ? ys[placeH] : world.stackY(flat);
  return gp;
}
function cycleHeight(dir) { const gp = ghostPos(), n = gp.ys.length; let i = placeH < 0 ? Math.max(0, gp.ys.indexOf(gp.y)) : placeH; i = ((i + dir) % n + n) % n; placeH = i; sfx.play('click', { gain: 0.5 }); showMsg(t('height', { h: gp.ys[i].toFixed(2) }), 900, true); }
function placeCarry() { if (!stats.carry) return; const gp = ghostPos(); socket.emit('place', { x: gp.x, z: gp.z, rot: gp.rot, y: gp.y }); placeH = -1; }
function primary() {
  if (stats.carry) return placeCarry();
  if (stats.sleeping) return;
  const tf = targetFurn(); socket.emit('attack', tf ? { ry: me.ry, fid: tf.id } : { ry: me.ry });
}
function useItem(slot = sel) { const it = stats.inv[slot]; if (!it) return; const d = ITEMS[it.t]; if (d.weapon || d.mat) return showMsg(d.weapon ? t('attackLmb') : t('matUse')); socket.emit('use', slot); }
function lockNearest() {
  // anchor / weld the placed piece you're looking at (or the nearest one you own)
  const tg = target(); if (tg?.kind === 'furn' && tg.id.startsWith('p_')) return socket.emit('lock', tg.id);
  let best = null, bd = 16;
  for (const [id] of placedObjs) { const o = world.placed.get(id); if (o && o.owner === myName) { const d = (o.x - me.x) ** 2 + (o.z - me.z) ** 2; if (d < bd) { bd = d; best = id; } } }
  if (best) socket.emit('lock', best); else showMsg(t('nothingAnchor'));
}
// ---------------- waypoints ----------------
const WP_COL = ['#2ecc71', '#3fa9f5', '#f5c518', '#e67e22'];
function addWaypoint() {
  if (waypoints.length >= 4) removeWaypoint(0);
  const col = WP_COL.find(c => !waypoints.some(w => w.col === c)) || WP_COL[0];
  const g = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, CEIL, 8, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.45, depthWrite: false, fog: false }));
  beam.position.y = CEIL / 2; g.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.6, 24), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.8, fog: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = me.y + 0.03; g.add(ring);
  const n = waypoints.length + 1, lab = nameLabel('◆ ' + t('wp') + ' ' + n, col); lab.position.y = me.y + 2.6; lab.scale.set(2.2, 0.66, 1); lab.material.depthTest = false; lab.material.fog = false; g.add(lab);
  g.position.set(me.x, 0, me.z); scene.add(g);
  waypoints.push({ x: me.x, z: me.z, col, g, n }); sfx.play('click'); showMsg(t('wpPlaced', { n: waypoints.length }));
}
function removeWaypoint(i) { const w = waypoints.splice(i, 1)[0]; if (!w) return; scene.remove(w.g); w.g.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); }); }

// ---------------- ghost preview ----------------
let ghost = null, ghostType = null;
const ghostOk = new THREE.MeshBasicMaterial({ color: 0x44ff66, transparent: true, opacity: 0.35, depthWrite: false });
const ghostBad = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.35, depthWrite: false });
function updateGhost() {
  const c = stats.carry;
  if (!c) { gridH.visible = false; if (ghost) { scene.remove(ghost); disposeGroup(ghost); ghost = null; ghostType = null; } return; }
  const gp = ghostPos();
  const gy = gp.y;
  const box = aabb({ type: c.type, x: gp.x, z: gp.z, rot: gp.rot, y: gy });
  const ok = world.canPlace(box);
  const key = c.type + gp.rot + ok;
  if (ghostType !== key) {
    if (ghost) { scene.remove(ghost); disposeGroup(ghost); }
    ghost = partsGroup(worldParts({ type: c.type, x: 0, z: 0, rot: gp.rot, c: c.c || 7 }), { matOverride: ok ? ghostOk : ghostBad });
    scene.add(ghost); ghostType = key;
  }
  ghost.position.set(gp.x, gy, gp.z);
  gridH.visible = true; gridH.position.set(gp.x, gy + 0.02, gp.z); gridH.material.color.set(ok ? 0x44ff66 : 0xff3333);
  if (ghost.userData.ok !== ok) { ghost.userData.ok = ok; }
}
const gridH = new THREE.GridHelper(4, 8, 0xffffff, 0xffffff); gridH.material.transparent = true; gridH.material.opacity = 0.45; gridH.material.depthWrite = false; gridH.visible = false; scene.add(gridH);

// ---------------- touch controls ----------------
const joy = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
let look = null;
if (isTouch) {
  document.documentElement.classList.add('touch');
  $('touch').classList.remove('hidden');
  const joyEl = $('joy'), knob = joyEl.firstElementChild, zone = $('joyZone'), lookZ = $('lookZone');
  const placeJoy = (x, y) => {
    joy.ox = x; joy.oy = y;
    joyEl.style.left = (x - 55) + 'px'; joyEl.style.top = (y - 55) + 'px';
    joyEl.classList.remove('hidden'); knob.style.transform = '';
  };
  const moveJoy = (x, y) => {
    const dx = x - joy.ox, dy = y - joy.oy, l = Math.min(1, Math.hypot(dx, dy) / 52), a = Math.atan2(dy, dx);
    joy.x = Math.cos(a) * l; joy.y = Math.sin(a) * l;
    knob.style.transform = `translate(${joy.x * 36}px,${joy.y * 36}px)`;
  };
  const endJoy = () => { joy.x = joy.y = 0; joy.id = null; joyEl.classList.add('hidden'); knob.style.transform = ''; };
  zone.addEventListener('touchstart', e => {
    if (anyPanel() || chatOpen) return;
    const t = e.changedTouches[0]; joy.id = t.identifier; placeJoy(t.clientX, t.clientY); e.preventDefault();
  }, { passive: false });
  zone.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) if (t.identifier === joy.id) moveJoy(t.clientX, t.clientY);
    e.preventDefault();
  }, { passive: false });
  const joyEnd = e => { for (const t of e.changedTouches) if (t.identifier === joy.id) endJoy(); };
  zone.addEventListener('touchend', joyEnd); zone.addEventListener('touchcancel', joyEnd);
  lookZ.addEventListener('touchstart', e => {
    if (anyPanel() || chatOpen) return;
    const t = e.changedTouches[0]; look = { id: t.identifier, x: t.clientX, y: t.clientY };
  }, { passive: true });
  lookZ.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) if (look && t.identifier === look.id) {
      const sc = 0.0045 * settings.sens;
      tyaw -= (t.clientX - look.x) * sc;
      tpitch = Math.max(-0.6, Math.min(1.25, tpitch + (t.clientY - look.y) * sc * (settings.invertY ? -1 : 1)));
      look.x = t.clientX; look.y = t.clientY;
    }
    e.preventDefault();
  }, { passive: false });
  lookZ.addEventListener('touchend', e => { for (const t of e.changedTouches) if (look && t.identifier === look.id) look = null; });
  lookZ.addEventListener('touchcancel', () => { look = null; });
  document.querySelectorAll('#tbtns button').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('touchstart', e => {
      e.preventDefault(); e.stopPropagation(); sfx.init();
      if (k === 'jump') keys.Space = true;
      if (k === 'sprint') { keys.ShiftLeft = !keys.ShiftLeft; b.classList.toggle('on', !!keys.ShiftLeft); }
      if (k === 'attack') primary();
      if (k === 'use') interact();
      if (k === 'place') { if (stats.carry) placeCarry(); else rotPlace = (rotPlace + 1) & 3; }
      if (k === 'eat') useItem();
      if (k === 'inv') { if (invOpen) closeInv(); else { if (invTab === 'chest' && !chestData) invTab = 'craft'; openInv(); } }
      if (k === 'craft') toggleCraft();
      if (k === 'chat') {
        if (chatOpen) closeChat();
        else { chatOpen = true; const i = $('chatInput'); i.style.display = 'block'; i.focus(); $('chat').classList.add('active', 'open'); syncPanelClass(); }
      }
      if (k === 'menu') openPause();
    }, { passive: false });
    b.addEventListener('touchend', () => { if (k === 'jump') keys.Space = false; });
  });
  // prevent page scroll / pinch zoom while playing
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('touchmove', e => { if (playing && !anyPanel() && e.target.closest?.('#touch,#hud,#game')) e.preventDefault(); }, { passive: false });
}

// ---------------- main menu ----------------
$('nameInput').value = settings.name || '';
$('playBtn').onclick = startGame;
$('avatarBtn').onclick = () => { sfx.init(); sfx.play('click'); openEditor({ level: lastLv, onSave: (av) => { saveAvatar(av); if (socket) socket.emit('setAvatar', av); if (myModel) rebuildMe(av); } }); };
$('achBtn').onclick = () => openAch();
$('pAchBtn').onclick = () => openAch();
$('achClose').onclick = () => { $('achP').classList.add('hidden'); syncPanelClass(); };
$('pAvBtn').onclick = () => $('avatarBtn').onclick();
$('nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') startGame(); });
function startGame() {
  sfx.init(); sfx.play('click');
  myName = $('nameInput').value.trim().slice(0, 16); settings.name = myName; saveSettings();
  $('menu').classList.add('hidden'); $('hud').classList.remove('hidden');
  playing = true; if (!socket) connect();
  syncPanelClass();
  if (!isTouch && !params.has('autoplay')) lockPointer();
  if (isTouch) { tryFullscreen(); updateRotateHint(); }
}
if (params.has('autoplay')) { $('nameInput').value = params.get('name') || 'Tester'; startGame(); }

// ---------------- minimap ----------------
const mm = $('minimap').getContext('2d');
function drawMinimap() {
  const S = 180, sc = 2.6; mm.clearRect(0, 0, S, S);
  mm.save(); mm.beginPath(); mm.arc(S / 2, S / 2, S / 2, 0, 7); mm.clip();
  mm.fillStyle = nightF > 0.5 ? 'rgba(30,0,0,.6)' : 'rgba(40,40,40,.5)'; mm.fillRect(0, 0, S, S);
  mm.translate(S / 2, S / 2); mm.rotate(yaw - Math.PI); mm.scale(sc, sc); mm.translate(-me.x, -me.z);
  for (const b of boxesCache) { if (b.walk) continue; const t = b.f.type; mm.fillStyle = t === 'barricade' ? '#c8955a' : t === 'claim' ? '#7fdbff' : TYPES[t]?.bed ? '#6a8cc8' : TYPES[t]?.stove ? '#e67e22' : 'rgba(210,200,180,.75)'; mm.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0); }
  mm.fillStyle = '#f5c518'; for (const m of itemMeshes.values()) { mm.fillRect(m.userData.x - 0.4, m.userData.z - 0.4, 0.8, 0.8); }
  for (const o of npcs.values()) { mm.fillStyle = o.data.d ? '#555' : o.data.h ? '#ff2020' : '#e0d070'; mm.beginPath(); mm.arc(o.h.g.position.x, o.h.g.position.z, o.data.k === 'giant' ? 1.3 : 0.9, 0, 7); mm.fill(); }
  for (const w of waypoints) { mm.fillStyle = w.col; mm.save(); mm.translate(w.x, w.z); mm.rotate(Math.PI / 4); mm.fillRect(-1.1, -1.1, 2.2, 2.2); mm.restore(); }
  for (const o of others.values()) { mm.fillStyle = o.data.party && o.data.party === myParty() ? '#7fdbff' : '#fff'; mm.beginPath(); mm.arc(o.h.g.position.x, o.h.g.position.z, 0.9, 0, 7); mm.fill(); }
  mm.restore();
  // me (always pointing up)
  mm.fillStyle = '#2ecc71'; mm.beginPath(); mm.moveTo(S / 2, S / 2 - 7); mm.lineTo(S / 2 - 5, S / 2 + 5); mm.lineTo(S / 2 + 5, S / 2 + 5); mm.fill();
  // compass ring
  const dirs = lang === 'ru' ? [['С', 0, -1], ['В', 1, 0], ['Ю', 0, 1], ['З', -1, 0]] : [['N', 0, -1], ['E', 1, 0], ['S', 0, 1], ['W', -1, 0]];
  mm.font = 'bold 13px Arial'; mm.textAlign = 'center'; mm.textBaseline = 'middle';
  const a = yaw - Math.PI;
  for (const [l, x, z] of dirs) { const rx = x * Math.cos(a) - z * Math.sin(a), rz = x * Math.sin(a) + z * Math.cos(a); mm.fillStyle = l === dirs[0][0] ? '#f5c518' : '#ddd'; mm.fillText(l, S / 2 + rx * 78, S / 2 + rz * 78); }
  $('compass').textContent = (lang === 'ru' ? ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'] : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'])[Math.round((((-(yaw - Math.PI)) % 6.283) + 6.283) % 6.283 / 0.785) % 8];
  $('coords').textContent = `X ${me.x.toFixed(0)}  Z ${me.z.toFixed(0)}`;
  const zk = world.zoneAt(me.x, me.z), zn = ZONES[zk];
  $('zoneName').textContent = zname(zk);
  curZone = zk;
}

// ---------------- film grain ----------------
const grain = $('grain'), gctx = grain.getContext('2d'); grain.width = 160; grain.height = 90;
const gimg = gctx.createImageData(160, 90);
function drawGrain() { const d = gimg.data; for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } gctx.putImageData(gimg, 0, 0); }

// ---------------- main loop ----------------
const clock = new THREE.Clock();
let sendT = 0, slowT = 0, stepT = 0, prevGround = true, sentAnim = -1, lastPanelUpdate = 0, grainT = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05), now = performance.now();
  if (!world || !myModel) { renderer.render(scene, camera); return; }
  gameT = (gameT + dt) % CYCLE;
  // night factor (smooth 15 s transitions)
  const nf = gameT >= DAY ? Math.min(1, (gameT - DAY) / 15, (CYCLE - gameT) / 15) : 0;
  nightF += (nf - nightF) * Math.min(1, dt * 2);

  if (now - boxesAt.t > 250 || Math.hypot(me.x - boxesAt.x, me.z - boxesAt.z) > 6) { boxesCache = world.boxesNear(me.x, me.z, 1); boxesAt = { x: me.x, z: me.z, t: now }; }

  // ---- movement ----
  let mx = 0, mz = 0;
  if (!chatOpen && !stats.dead && playing) {
    if (keys.KeyW) mz += 1; if (keys.KeyS) mz -= 1; if (keys.KeyA) mx -= 1; if (keys.KeyD) mx += 1;
    if (joy.x || joy.y) { mx += joy.x; mz -= joy.y; }
  }
  const moving = Math.hypot(mx, mz) > 0.1 && !stats.sleeping;
  if (Math.hypot(mx, mz) > 0.1 && stats.sleeping) socket.emit('wake');
  const wantSprint = (keys.ShiftLeft || keys.ShiftRight) && moving && stamina > 1 && stats.energy > 0; // no energy = no sprinting (wiki)
  stamina = Math.max(0, Math.min(100, stamina + (wantSprint ? -22 : moving ? 8 : 16) * dt));
  let speed = (wantSprint ? 8.4 : 5.2) * (stats.energy <= 0 ? 0.8 : 1) * (stats.carry ? 0.85 : 1);
  if (moving) {
    const l = Math.max(1, Math.hypot(mx, mz)); mx /= l; mz /= l;
    const f = fwd(), rx = -f.z, rz = f.x;
    const vx = (f.x * mz + rx * mx) * speed, vz = (f.z * mz + rz * mx) * speed;
    me.x += vx * dt; me.z += vz * dt;
    const target = Math.atan2(vx, vz); let d = target - me.ry; d = Math.atan2(Math.sin(d), Math.cos(d)); me.ry += d * Math.min(1, dt * 14);
  } else if (stats.carry || locked) { /* face camera when idle & aiming */ }
  if (h0attackFacing()) me.ry = Math.atan2(fwd().x, fwd().z);
  me.x += kx * dt; me.z += kz * dt; kx *= Math.pow(0.02, dt); kz *= Math.pow(0.02, dt);
  if (!stats.sleeping) {
    world.collide(me, 0.35, me.y, boxesCache);
    const g = world.groundAt(me.x, me.z, me.y, 0.3, boxesCache);
    if (keys.Space && me.onGround && !chatOpen && !stats.dead) { me.vy = 7.2; me.onGround = false; sfx.play('jump'); }
    me.vy -= 22 * dt; me.y += me.vy * dt;
    if (me.y <= g) { if (!prevGround && me.vy < -6) sfx.play('land'); me.y = g; me.vy = 0; me.onGround = true; } else me.onGround = me.y - g < 0.05;
    if (me.y > CEIL - 2) { me.y = CEIL - 2; me.vy = Math.min(0, me.vy); }
    prevGround = me.onGround;
  }
  if (moving && me.onGround) { stepT -= dt * (wantSprint ? 1.6 : 1); if (stepT <= 0) { sfx.play('step', { gain: 0.5 + Math.random() * 0.2, surf: stepSurface() }); stepT = 0.33 + Math.random() * 0.06; } }
  setBar('stam', stamina);

  // ---- send ----
  sendT -= dt;
  const anim = moving ? (wantSprint ? 2 : 1) : 0;
  if (sendT <= 0 && !stats.dead && !stats.sleeping) { socket.emit('move', { x: +me.x.toFixed(2), y: +me.y.toFixed(2), z: +me.z.toFixed(2), ry: +me.ry.toFixed(2), anim, sel, sprint: wantSprint }); sendT = 1 / 15; }

  // ---- my model ----
  myModel.g.position.set(me.x, me.y, me.z); myModel.g.rotation.y = me.ry; myModel.g.visible = !stats.dead && camDist > 1.5;
  animate(myModel, dt, { moving, speed: wantSprint ? 1.5 : 1, air: !me.onGround, sleeping: stats.sleeping, emote: moving ? null : _myEm });

  // ---- others ----
  for (const o of others.values()) {
    const g = o.h.g, k = Math.min(1, dt * 10); g.position.x += (o.tx - g.position.x) * k; g.position.y += (o.ty - g.position.y) * k; g.position.z += (o.tz - g.position.z) * k;
    let d = o.try - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g.rotation.y += d * k;
    const od = (g.position.x - me.x) ** 2 + (g.position.z - me.z) ** 2, far = od > (scene.fog.far + 6) ** 2;
    g.visible = !o.data.dead && !far; if (o.label) o.label.visible = od < 625 || !!(o.data.party && o.data.party === myParty());
    if (far) continue;
    animate(o.h, dt, { moving: o.data.anim > 0, speed: o.data.anim === 2 ? 1.5 : 1, air: o.data.y > 0.1 && Math.abs(o.ty - g.position.y) > 0.02, sleeping: o.data.sl, emote: o.data.em });
    if (o.data.anim > 0) { o.stepT -= dt; if (o.stepT <= 0) { o.stepT = 0.4; const sp = spatial(g.position); if (sp.gain > 0.3) sfx.play('step', { ...sp, gain: sp.gain * 0.4 }); } }
  }
  // ---- employees ----
  for (const o of npcs.values()) {
    const g = o.h.g, k = Math.min(1, dt * 8); g.position.x += (o.tx - g.position.x) * k; g.position.z += (o.tz - g.position.z) * k;
    let d = o.try - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g.rotation.y += d * k;
    const hostile = !!o.data.h || gameT >= DAY || dinfo.fog;
    const nd = (g.position.x - me.x) ** 2 + (g.position.z - me.z) ** 2; g.visible = nd < (scene.fog.far + 8) ** 2; if (!g.visible) continue; // night (and Foggy Day) employees look hostile even before they spot you
    if (o.bubble) { o.bubbleT -= dt; if (o.bubbleT <= 0) { o.h.g.remove(o.bubble); o.bubble.material.map.dispose(); o.bubble = null; } }
    animate(o.h, dt, { moving: !!o.data.m && !o.data.d, speed: o.data.k === 'runner' ? 1.6 : hostile ? 1.3 : 0.6, hostile, down: !!o.data.d });
    const sp = spatial(g.position);
    if (sp.gain > 0 && !o.data.d) {
      o.voice -= dt; if (o.voice <= 0) { o.voice = hostile ? 3 + Math.random() * 5 : 8 + Math.random() * 12; sfx.play(hostile ? 'employee' : 'creak', { ...sp, gain: sp.gain * (hostile ? 1 : 0.4) }); }
      if (o.data.m && (o.data.k === 'giant' || hostile)) { o.step -= dt; if (o.step <= 0) { o.step = o.data.k === 'giant' ? 0.55 : 0.3; sfx.play(o.data.k === 'giant' ? 'heavystep' : 'step', { ...sp, gain: sp.gain * 0.7 }); } }
    }
  }
  // items bob
  for (const m of itemMeshes.values()) { m.rotation.y += dt * 0.8; m.position.y = m.userData.y + 0.05 + Math.sin(now * 0.003 + m.userData.x) * 0.04; m.userData.glow.material.opacity = 0.3 + Math.sin(now * 0.005) * 0.2; }

  // ---- lighting ----
  const day = 1 - nightF;
  hemi.intensity = 0.12 + day * 1.1; hemi.color.setRGB(1, 0.97 - nightF * 0.4, 0.9 - nightF * 0.5);
  sun.intensity = day * 1.0; sun.position.set(me.x + 6, CEIL + 8, me.z + 4); sun.target.position.set(me.x, 0, me.z);
  const bloodF = dinfo.blood ? nightF : 0, fogF = dinfo.fog ? day : 0;
  scene.fog.color.copy(DAY_FOG).lerp(FOGGY, fogF).lerp(NIGHT_FOG, nightF).lerp(BLOOD_FOG, bloodF * 0.6); scene.background.copy(scene.fog.color);
  const fs = Q.fogScale || 1;
  scene.fog.near = ((10 - nightF * 8) * (1 - fogF) + 2 * fogF) * fs;
  scene.fog.far = ((70 - nightF * 44) * (1 - fogF) + 18 * fogF) * fs;
  if (bloodF) hemi.color.setRGB(1, 0.25, 0.22);
  panelMat.color.setRGB(1 - nightF * 0.92, 1 - nightF * 0.96, 1 - nightF * 0.96);
  const flick = Math.random() < 0.08 ? 0.15 : (Math.sin(now * 0.05) > 0.7 ? 0.5 : 1);
  flickerMat.color.setScalar(flick * (1 - nightF * 0.9));
  if (now - lastPanelUpdate > 400) {
    lastPanelUpdate = now;
    const panels = [];
    for (const ch of chunks.values()) for (const p of ch.panels) { const d = (p[0] - me.x) ** 2 + (p[1] - me.z) ** 2; if (d < 900) panels.push([d, p, ch.flick.includes(p), null, ZONE_LIGHT[ch.zone]]); }
    // player torches / lanterns win over ceiling panels at night (warm flickering light)
    for (const o of lightObjs.values()) { const d = (o.x - me.x) ** 2 + (o.z - me.z) ** 2; if (d < 900) panels.push([d - 200 * nightF, [o.x, o.z], false, o]); }
    panels.sort((a, b) => a[0] - b[0]);
    lightPool.forEach((l, i) => { const p = panels[i]; if (p) { l.position.set(p[1][0], p[3] ? p[3].y + 0.3 : CEIL - 0.4, p[1][1]); l.userData.flick = p[2]; l.userData.fire = p[3]; l.userData.tint = p[4]; } l.visible = !!p; });
  }
  lightPool.forEach((l, i) => {
    if (l.userData.fire) { const f = l.userData.fire; l.intensity = (f.torch ? 9 : 12) * (0.85 + Math.sin(now * 0.017 + i) * 0.08 + Math.random() * 0.07); l.color.setRGB(1, 0.62, 0.3); return; }
    const base = 14 * day + (i === 0 || i === 3 ? nightF * 3 : 0); l.intensity = base * (l.userData.flick ? flick : 1);
    const tn = l.userData.tint || [1, 0.95, 0.85];
    l.color.setRGB(tn[0], (tn[1] - nightF * 0.6) * (1 - bloodF * 0.8), (tn[2] - nightF * 0.7) * (1 - bloodF * 0.8)); if (bloodF) l.intensity += bloodF * 4;
  });
  flash.intensity = flashOn ? 40 + nightF * 20 : 0;
  sfx.setNight(nightF);
  $('vignette').style.background = `radial-gradient(ellipse at center,transparent ${55 - nightF * 25}%,rgba(0,0,0,${0.55 + nightF * 0.4}) 100%)`;
  grainT -= dt; if (grainT <= 0 && Q.grain) { drawGrain(); grain.style.opacity = 0.04 + nightF * 0.1; grainT = 0.08; } else if (!Q.grain) grain.style.opacity = 0;

  // ---- camera ----
  // smooth look (targets set by mouse / touch)
  {
    const k = 1 - Math.exp(-dt * (isTouch ? 22 : 28));
    let dy = tyaw - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    yaw += dy * k; pitch += (tpitch - pitch) * k;
  }
  const head = new THREE.Vector3(me.x, me.y + 1.7, me.z);
  let cd = camDist;
  const off = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  // simple camera collision against nearby boxes
  for (let s = 0.5; s <= camDist; s += 0.25) {
    const px = head.x + off.x * s, py = head.y + off.y * s, pz = head.z + off.z * s;
    if (py > CEIL - 0.2 || py < 0.2 || boxesCache.some(b => !b.walk && b.h > py && px > b.x0 && px < b.x1 && pz > b.z0 && pz < b.z1)) { cd = Math.max(0.6, s - 0.3); break; }
  }
  // smoothed follow camera: ease toward the target, but snap closer instantly when something blocks the view
  camSm = camSm == null ? cd : (cd < camSm ? cd : camSm + (cd - camSm) * Math.min(1, dt * 6));
  if (!camHead) camHead = head.clone(); else camHead.lerp(head, Math.min(1, dt * 18));
  camera.position.copy(camHead).addScaledVector(off, camSm);
  if (shake > 0) { shake -= dt; camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; }
  camera.lookAt(camHead.x, camHead.y + 0.1, camHead.z);
  myModel.g.visible = cd > 1.1 && !stats.dead;

  // ---- prompt / ghost / misc ----
  updateGhost(); updateFx(dt); updateHpBars(dt);
  fpsN++; if (now - fpsT > 500) { fpsV = Math.round(fpsN * 1000 / (now - fpsT)); fpsN = 0; fpsT = now; const fe = $('fps'); fe.style.display = settings.fps ? 'block' : 'none'; if (settings.fps) fe.textContent = `${fpsV} ${t('fpsL')} · ${renderer.info.render.calls} dc`; }
  slowT -= dt;
  if (slowT <= 0) {
    slowT = 0.15; streamChunks(); drawMinimap();
    const pr = $('prompt');
    const bed = boxesCache.find(b => TYPES[b.f.type]?.bed && Math.max(b.x0 - me.x, 0, me.x - b.x1) ** 2 + Math.max(b.z0 - me.z, 0, me.z - b.z1) ** 2 < 2.25);
    let html = '';
    const tg = target(), tf = targetFurn();
    if (tg) {
      if (tg.kind === 'item') html = `<b>E</b> — ${t('pickUp')} ${esc(tg.name)}`;
      else {
        const ty = tg.f?.type, mine = tg.id.startsWith('p_');
        html = mine && (ty === 'door' || ty === 'dooropen') ? `<b>E</b> — ${ty === 'dooropen' ? t('closeDoor') : t('open')} · <b>Shift+E</b> — ${t('grab')}` : mine && ty === 'chest' ? `<b>E</b> — ${t('open')} ${esc(tg.name)} · <b>Shift+E</b> — ${t('grab')}` : `<b>E</b> — ${t('grab')} ${esc(tg.name)}`;
        if (tg.f?.locked) html += ' · ' + t('anchored');
        if (mine && tg.f?.owner === myName) html += ' · <b>L</b> — ' + (tg.f.locked ? t('unanchor') : t('anchor'));
      }
    }
    if (tf && !stats.carry && breakable(tf.type)) { const h = fhp.get(tf.id) || { hp: tf.hp ?? furnHp(tf.type), max: furnHp(tf.type) }; html += (html ? ' · ' : '') + `<b>${lang === 'ru' ? 'ЛКМ' : 'LMB'}</b> — ${t('hit')}${h.hp < h.max ? ' ' + Math.round(Math.max(0, h.hp) / h.max * 100) + '%' : ''}`; }
    if (bed && !stats.sleeping && !stats.carry) html += (html ? ' · ' : '') + `<b>Z</b> — ${t('sleep')}`;
    if (stats.sleeping) html = t('sleeping');
    if (nearFlag('bench') && !stats.carry) html += (html ? ' · ' : '') + `<b>C</b> — ${t('craftHere')}`;
    if (nearFlag('stove') && !stats.carry) html += (html ? ' · ' : '') + `<b>C</b> — ${t('cook')}`;
    pr.innerHTML = html; pr.style.display = html ? 'block' : 'none';
    const hrs = (gameT / CYCLE * 24 + 9) % 24, night = gameT >= DAY;
    const left = Math.ceil(night ? CYCLE - gameT : DAY - gameT), mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    $('dayLabel').textContent = `${t('day')} ${dayN} · ${wd(weekday(dayN))}`;
    const cic = night ? 'moon' : dinfo.fog ? 'cloud' : 'sun'; if ($('clockIc').dataset.k !== cic) { $('clockIc').dataset.k = cic; $('clockIc').innerHTML = svg(cic, 14); }
    $('timeLabel').textContent = `${String(Math.floor(hrs)).padStart(2, '0')}:${String(Math.floor(hrs % 1 * 60)).padStart(2, '0')}` + (left <= 60 || night ? ` · ${night && dinfo.blood ? t('blood').toLowerCase() + ' · ' : ''}${night ? t('opens') : t('closes')} ${mmss}` : '');
    $('timeBar').firstElementChild.style.width = (gameT / CYCLE * 100) + '%';
    $('clock').classList.toggle('night', night); $('clock').classList.toggle('blood', night && dinfo.blood); $('clock').classList.toggle('fog', !night && dinfo.fog);
    $('wpList').innerHTML = waypoints.map(w => `<div><i style="background:${w.col}"></i>${w.n} · ${Math.round(Math.hypot(w.x - me.x, w.z - me.z))} ${lang === 'ru' ? 'м' : 'm'}</div>`).join('');
  }
  renderer.render(scene, camera);
}
let camSm = null, camHead = null, fpsN = 0, fpsT = 0, fpsV = 0, curZone = '', lastLv = +(localStorage.getItem('3008lv') || 1), lastBoard = null;
function stepSurface() {
  const b = boxesCache.find(b => me.y > 0.05 && Math.abs(b.h - me.y) < 0.08 && me.x > b.x0 && me.x < b.x1 && me.z > b.z0 && me.z < b.z1);
  if (b) { const m = matOf(b.f.type); return m === 'scrap' ? 'metal' : m === 'cloth' ? 'carpet' : 'wood'; }
  return { bedrooms: 'carpet', living: 'carpet', kids: 'carpet', warehouse: 'metal', office: 'carpet' }[curZone] || 'tile';
}
function h0attackFacing() { return locked && myModel && myModel.swing > 0.8; }
requestAnimationFrame(loop);
applySettings(); applyStatic();
// expose for automated tests
window.__game = { get dinfo() { return dinfo; }, setInfo: (i) => Object.assign(dinfo, i), addWaypoint: () => addWaypoint(), get me() { return me; }, get stats() { return stats; }, get npcs() { return npcs.size; }, get others() { return others.size; }, get chunks() { return chunks.size; }, get night() { return nightF; }, get t() { return gameT; }, setYaw: (y) => (yaw = tyaw = y), setPitch: (p) => (pitch = tpitch = p), emit: (...a) => socket.emit(...a), toggleFlash: () => (flashOn = !flashOn), keys };
Object.assign(window.__game, { openInv: (tab) => { if (tab) invTab = tab; openInv(); }, closeInv: () => closeInv(), targetFurn: () => targetFurn()?.id, attack: () => primary(), applyLang: (l) => applyLang(l), fhp: () => [...fhp.entries()] });
