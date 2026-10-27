// 3008 Survival v2 client
import * as THREE from 'three';
import { World, CHUNK, CEIL, CYCLE, DAY, ITEMS, TYPES, FISTS, RECIPES, ZONES, worldParts, aabb, levelOf, weekday } from '/shared/world.js';
import { Sfx } from '/js/audio.js';
import { MATS, floorTex, ceilTex, partsGroup, disposeGroup, makeItem, makeHuman, makeEmployee, nameLabel, setHeld, setCarry, animate, unitBox } from '/js/models.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer:coarse)').matches || params.has('touch');
const sfx = new Sfx();

// ---------------- settings ----------------
const QUALITY = {
  low: { radius: 1, pr: 0.7, shadows: false, lights: 4, shadowSize: 512, flashShadow: false },
  med: { radius: 2, pr: 1, shadows: true, lights: 8, shadowSize: 1024, flashShadow: false },
  high: { radius: 2, pr: Math.min(devicePixelRatio, 2), shadows: true, lights: 12, shadowSize: 2048, flashShadow: true },
};
const settings = Object.assign({ sens: 1, quality: isTouch ? 'low' : 'med', vol: 0.7, name: '', invertY: false, tips: true }, JSON.parse(localStorage.getItem('3008s') || '{}'));
const saveSettings = () => localStorage.setItem('3008s', JSON.stringify(settings));
let Q = QUALITY[settings.quality] || QUALITY.med;

function buildSettings(el) {
  el.innerHTML = `
  <label>Mouse sensitivity <input type="range" min="0.2" max="3" step="0.1" data-s="sens"></label>
  <label>Volume <input type="range" min="0" max="1" step="0.05" data-s="vol"></label>
  <label>Graphics <select data-s="quality"><option value="low">Low (fast)</option><option value="med">Medium</option><option value="high">High (shadows)</option></select></label>
  <label>Invert Y <input type="checkbox" data-s="invertY"></label>
  <label>Show tips <input type="checkbox" data-s="tips"></label>`;
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
const renderer = new THREE.WebGLRenderer({ antialias: settings.quality !== 'low', powerPreference: 'high-performance' });
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
  Q = QUALITY[settings.quality] || QUALITY.med;
  renderer.setPixelRatio(Q.pr);
  renderer.shadowMap.enabled = Q.shadows;
  sun.castShadow = Q.shadows; sun.shadow.mapSize.set(Q.shadowSize, Q.shadowSize); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  flash.castShadow = Q.flashShadow; flash.shadow.mapSize.set(512, 512); if (flash.shadow.map) { flash.shadow.map.dispose(); flash.shadow.map = null; }
  while (lightPool.length > Q.lights) scene.remove(lightPool.pop());
  while (lightPool.length < Q.lights) { const l = new THREE.PointLight(0xfff3dc, 0, 16, 1.6); scene.add(l); lightPool.push(l); }
  sfx.setVolume(settings.vol);
  scene.traverse(o => { if (o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; });
  if (world) for (const ch of chunks.values()) setChunkShadows(ch);
}

// ---------------- game state ----------------
let socket, world, myId, myName, debugAllowed = false;
let me = { x: 0, y: 0, z: 0, vy: 0, ry: 0, onGround: true };
let stats = { hp: 100, hunger: 100, energy: 100, inv: [], carry: null, dead: false, xp: 0, lv: 1, days: 0, kos: 0, pvp: false, sleeping: false, party: [] };
let _myEm = null;
let sel = 0, stamina = 100, gameT = 0, dayN = 1, nightF = 0, flashOn = false, rotPlace = 0, emote = null;
let yaw = Math.PI, pitch = 0.25, camDist = 5.5, playing = false;
const keys = {};
const picked = new Set(), drops = new Map();
const others = new Map(), npcs = new Map();
const chunks = new Map(), placedObjs = new Map(), itemMeshes = new Map();
let boxesCache = [], boxesAt = { x: 1e9, z: 1e9, t: 0 };
const ICON = { apple: '🍎', banana: '🍌', beans: '🥫', burger: '🍔', chips: '🍟', chocolate: '🍫', cookie: '🍪', fishcrackers: '🐟', hotdog: '🌭', icecream: '🍦', lemon: '🍋', lemonslice: '🍋',
  meatballs: '🍝', pizza: '🍕', donut: '🍩', cola2l: '🧴', soda: '🥤', cola: '🍾', water: '💧', cake: '🎂', candycorn: '🌽', glass: '🔷', medkit: '💊', meal: '🍲', bandage: '🩹',
  cloth: '🧶', scrap: '🔩', plank: '🪵', bat: '🏏', pipe: '🔧', crowbar: '🪛', spear: '🔱', nailbat: '🦯' };
let dinfo = { day: 1, weekday: 'Monday', fog: false, blood: false };
const waypoints = [];

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
    const s = nameLabel(f.text, '#f5c518'); s.scale.set(4, 1.2, 1); s.position.set(f.x, 3.4, f.z); s.material.depthTest = true; g.add(s); ch.signs.push(s);
  }
  scene.add(g);
  for (const it of data.items) if (!picked.has(it.id)) addItemMesh(it);
  return ch;
}
function rebuildFurn(ch) {
  if (ch.furnG) { ch.g.remove(ch.furnG); disposeGroup(ch.furnG); }
  const parts = [];
  for (const f of world.chunk(ch.cx, ch.cz).furn) if (!world.removed.has(f.id)) for (const p of worldParts(f)) parts.push(p);
  ch.furnG = partsGroup(parts, { shadows: Q.shadows }); ch.g.add(ch.furnG);
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
  if (o.type === 'barricade' || o.type === 'claim') {
    const s = nameLabel(o.type === 'claim' ? `⛺ ${o.ownerName}'s Base Camp` : (o.locked ? '🔩 ' : '') + o.ownerName, o.type === 'claim' ? '#7fdbff' : '#ffb', o.hp ? `HP ${o.hp}` : '');
    s.position.set(o.x, (o.y || 0) + 2.9, o.z); s.scale.set(1.8, 0.54, 1); g.add(s); g.userData.label = s;
  }
  scene.add(g); placedObjs.set(o.id, g); boxesAt.t = 0;
}
function removePlacedObj(id) { const g = placedObjs.get(id); if (g) { scene.remove(g); if (g.userData.label) g.userData.label.material.map.dispose(); disposeGroup(g); placedObjs.delete(id); } world.removePlaced(id); boxesAt.t = 0; }

// ---------------- characters ----------------
function hsl(h, s, l) { return new THREE.Color().setHSL(h, s, l).getHex(); }
function addOther(p) {
  const h = makeHuman({ shirt: hsl(p.hue, 0.65, 0.5), pants: hsl((p.hue + 0.5) % 1, 0.3, 0.25), skin: [0xf2cf6b, 0xf0c8a0, 0xd1a07a, 0x8d5a3b][(p.hue * 40 | 0) % 4], hair: [0x3b2a1e, 0x111111, 0xd4a650, 0x8b3a1a][(p.hue * 97 | 0) % 4], hairStyle: (p.hue * 10 | 0) % 5 });
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
function removeModel(o) { scene.remove(o.h.g); o.h.g.traverse(m => { if (m.isMesh && m.geometry !== unitBox && !m.geometry.userData?.shared) m.geometry.dispose(); }); if (o.label) o.label.material.map.dispose(); }
function carryParts(type) { return () => partsGroup(worldParts({ type, x: 0, z: 0, rot: 0, c: 7 })); }

// ---------------- networking ----------------
function connect() {
  socket = io({ transports: ['websocket', 'polling'] });
  socket.on('connect', () => socket.emit('join', myName));
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
    if (!myModel) { myModel = makeHuman({ shirt: 0xf5c518, pants: 0x1d4fa8 }); scene.add(myModel.g); }
    const dt = params.get('debugTime');
    if (dt && debugAllowed) socket.emit('debugTime', dt === 'night' ? DAY + 30 : dt === 'day' ? 60 : +dt);
    streamChunks(); applySettings(); updateHotbar();
    tip(0);
  });
  socket.on('stats', (s) => {
    const prevLv = stats.lv, prevHp = stats.hp, wasDead = stats.dead;
    stats = s; if (s.lv > prevLv && prevLv) sfx.play('levelup');
    if (s.hp < prevHp - 0.5 && !s.dead) hurtFlash();
    if (s.dead && !wasDead) { sfx.play('death'); $('death').classList.remove('hidden'); document.exitPointerLock?.(); }
    if (!s.dead && wasDead) $('death').classList.add('hidden');
    updateHud(); updateHotbar(); if (!$('craft').classList.contains('hidden')) renderCraft();
  });
  socket.on('state', (s) => {
    gameT = s.t; dayN = s.day;
    const seen = new Set();
    for (const p of s.players) {
      if (p.id === myId) { _myEm = p.em; if (myModel) { setHeld(myModel, p.held); setCarry(myModel, p.carry, carryParts(p.carry)); } continue; }
      seen.add(p.id); const o = others.get(p.id) || addOther(p);
      o.tx = p.x; o.ty = p.y; o.tz = p.z; o.try = p.ry; o.data = p;
      const key = p.name + p.lv + p.pvp + (p.party || '');
      if (o.labelKey !== key) { if (o.label) { o.h.g.remove(o.label); o.label.material.map.dispose(); } o.label = nameLabel(p.name, p.party && p.party === myParty() ? '#7fdbff' : p.pvp ? '#ff7766' : '#fff', `Lv ${p.lv}${p.pvp ? ' ⚔' : ''}`); o.label.position.y = o.h.labelY || 2.45; o.h.g.add(o.label); o.labelKey = key; }
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
  socket.on('removed', (id) => { world.markRemoved(id); const ch = chunkOfId(id); if (ch) { rebuildFurn(ch); } boxesAt.t = 0; });
  socket.on('placed', addPlacedObj);
  socket.on('placedupd', addPlacedObj);
  socket.on('unplaced', removePlacedObj);
  socket.on('teleport', (p) => { me.x = p.x; me.y = p.y; me.z = p.z; me.vy = 0; boxesAt.t = 0; });
  socket.on('announce', (a) => announce(a));
  socket.on('dayinfo', (i) => { dinfo = i; });
  socket.on('npcsay', (m) => npcSay(m));
  socket.on('chat', (c) => addChat(c));
  socket.on('feed', (t) => addFeed(t));
  socket.on('msg', (t) => showMsg(t));
  socket.on('sfx', (n) => sfx.play(n));
  socket.on('swing', (id) => { const o = id === myId ? { h: myModel } : others.get(id); if (o?.h) { o.h.swing = 1; sfx.play('swing', spatial(o.h.g.position)); } });
  socket.on('npcatk', (id) => { const o = npcs.get(id); if (o) { o.h.swing = 1; sfx.play('swing', spatial(o.h.g.position)); } });
  socket.on('hitfx', (h) => { dmgNumber(h); sfx.play(h.wood ? 'wood' : 'hit', spatial(h)); if (h.npc != null && Math.random() < 0.5) sfx.play('scream', spatial(h)); });
  socket.on('knock', (k) => { kx += k.dx * 6; kz += k.dz * 6; me.vy = Math.max(me.vy, 3); sfx.play('hurt'); hurtFlash(); shake = 0.35; });
  socket.on('board', renderBoard);
  socket.on('left', (id) => { const o = others.get(id); if (o) { removeModel(o); others.delete(id); } });
  socket.on('disconnect', () => showMsg('Disconnected — reconnecting…'));
}
const myParty = () => stats.party?.length ? ([...others.values()].find(o => stats.party.includes(o.data.name))?.data.party ?? null) : null;
function chunkOfItem(id) { const m = /^i_(-?\d+)_(-?\d+)_/.exec(id); return m && chunks.get(m[1] + ',' + m[2]); }
function spatial(p) {
  const dx = p.x - me.x, dz = p.z - me.z, d = Math.hypot(dx, dz);
  const ang = Math.atan2(dx, dz) - (yaw + Math.PI);
  return { gain: Math.max(0, 1 - d / 30), pan: -Math.sin(ang) * Math.min(1, d / 4) };
}

// ---------------- HUD ----------------
function setBar(cls, v) { const b = document.querySelector('.bar.' + cls); b.querySelector('i').style.width = Math.max(0, v) + '%'; b.querySelector('em').textContent = Math.max(0, Math.round(v)); b.classList.toggle('low', v < 20); }
function updateHud() {
  setBar('hp', stats.hp); setBar('food', stats.hunger); setBar('energy', stats.energy);
  const lv = stats.lv || 1, a = 40 * (lv - 1) ** 2, b = 40 * lv ** 2;
  $('lvNum').textContent = `Lv ${lv}  ·  ${stats.xp} XP`; $('xpBar').firstElementChild.style.width = ((stats.xp - a) / (b - a) * 100) + '%';
  $('daysLabel').textContent = `${stats.days} night${stats.days === 1 ? '' : 's'} survived · ${stats.kos} KOs`;
  $('party').textContent = stats.party?.length ? '👥 Party: ' + stats.party.join(', ') : '';
  $('flags').innerHTML = (stats.pvp ? '<span>⚔ PvP ON</span>' : '') + (stats.sleeping ? '<span style="background:#2c3e66">💤 Sleeping</span>' : '');
  const c = stats.carry;
  $('carryInfo').style.display = c ? 'block' : 'none';
  if (c) $('carryInfo').innerHTML = `Carrying <b>${TYPES[c.type]?.name}</b> — <b>LMB/Q</b> place · <b>R</b> rotate`;
}
function updateHotbar() {
  const hb = $('hotbar'); hb.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const it = stats.inv?.[i], d = document.createElement('div'); d.className = 'slot' + (i === sel ? ' sel' : '');
    d.innerHTML = `<small>${i + 1}</small>${it ? ICON[it.t] || '❔' : ''}` + (it && it.d != null ? `<div class="dur"><i style="width:${it.d / ITEMS[it.t].dur * 100}%;background:${it.d / ITEMS[it.t].dur < 0.25 ? '#e74c3c' : '#2ecc71'}"></i></div>` : '');
    d.title = it ? ITEMS[it.t].name : 'Empty';
    d.onclick = () => { sel = i; updateHotbar(); };
    hb.appendChild(d);
  }
  const it = stats.inv?.[sel];
  if (it) showMsg(ITEMS[it.t].name + (ITEMS[it.t].weapon ? ` — ${ITEMS[it.t].dmg} dmg` : ITEMS[it.t].mat ? ' — crafting material' : ' — RMB/X to use'), 1200, true);
}
let msgTimer;
function showMsg(t, ms = 2500, soft) { const m = $('msg'); m.textContent = t; m.style.opacity = soft ? 0.75 : 1; clearTimeout(msgTimer); msgTimer = setTimeout(() => (m.style.opacity = 0), ms); }
let annTimer;
function announce(a) {
  const el = $('announce'); el.textContent = '📢 ' + a.text; el.className = 'show ' + (a.kind || '');
  clearTimeout(annTimer); annTimer = setTimeout(() => (el.className = ''), 7000);
  if (a.kind === 'night') { sfx.play('alarm'); bigText(`NIGHT ${dayN}`, 'night'); }
  else if (a.kind === 'blood') { sfx.play('alarm'); bigText('BLOOD NIGHT', 'night'); }
  else if (a.kind === 'fog') { sfx.play('chime'); bigText(`FOGGY DAY`, 'fog'); }
  else if (a.kind === 'day') { sfx.play('chime'); bigText(`DAY ${dayN} · ${weekday(dayN).toUpperCase()}`, ''); }
  else sfx.play(a.kind === 'creepy' ? 'creak' : 'chime', { gain: 0.5 });
  addChat({ sys: true, text: '📢 ' + a.text });
}
function npcSay(m) {
  const o = npcs.get(m.id); if (!o) return;
  if (o.bubble) { o.h.g.remove(o.bubble); o.bubble.material.map.dispose(); }
  const b = nameLabel('“' + m.text.replace('Excuse me, ', 'Excuse me… ').slice(0, 44) + (m.text.length > 44 ? '…”' : '”'), '#fff');
  b.scale.set(3.6, 1.08, 1); b.position.y = (o.h.labelY || 2.4) + 0.5; o.h.g.add(b); o.bubble = b; o.bubbleT = 4;
  const sp = spatial(o.h.g.position);
  // the employees' monotone voice (optional, browser TTS) for the nearest one only
  if (sp.gain > 0.55 && settings.vol > 0 && 'speechSynthesis' in window && !speechSynthesis.speaking) {
    try { const u = new SpeechSynthesisUtterance(m.text); u.rate = 0.85; u.pitch = 0.3; u.volume = Math.min(1, settings.vol * sp.gain); speechSynthesis.speak(u); } catch { /* no TTS */ }
  }
}
function bigText(t, cls) { const b = $('bigDay'); b.textContent = t; b.className = 'show ' + cls; setTimeout(() => (b.className = cls), 3500); }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function addChat(c) {
  const d = document.createElement('div');
  if (c.sys) { d.className = 'sys'; d.textContent = c.text; }
  else { if (c.party && c.party === myParty()) d.className = 'pt'; d.innerHTML = `<b style="color:#f5c518">[${c.lv}] ${esc(c.name)}:</b> ${esc(c.text)}`; }
  const log = $('chatLog'); log.appendChild(d); while (log.children.length > 9) log.firstChild.remove();
  setTimeout(() => d.style.opacity = chatOpen ? 1 : 0.35, 12000);
}
function addFeed(t) { const d = document.createElement('div'); d.textContent = t; const f = $('feed'); f.prepend(d); while (f.children.length > 6) f.lastChild.remove(); setTimeout(() => d.remove(), 12000); }
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
  $('plist').innerHTML = '<div class="ph"><span>Players</span><span>Days</span><span>Lv</span></div>' + b.online.slice(0, 12).map(p => `<div class="pr${p.name === myName ? ' me' : ''}${p.party && p.party === myParty() ? ' tm' : ''}"><span>${esc(p.name)}</span><span>${p.days}</span><span>${p.lv}</span></div>`).join('');
  $('onlineT').innerHTML = '<tr><th>Name</th><th>Lv</th><th>Nights</th><th>KOs</th></tr>' + b.online.map(p => `<tr><td>${esc(p.name)}${p.party ? ' 👥' : ''}</td><td>${p.lv}</td><td>${p.days}</td><td>${p.kos}</td></tr>`).join('');
  $('topT').innerHTML = '<tr><th>#</th><th>Name</th><th>Best</th><th>Lv</th></tr>' + b.top.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.name)}</td><td>${p.bestDays}</td><td>${p.level}</td></tr>`).join('');
}
function nearStove() { return boxesCache.some(b => TYPES[b.f.type]?.stove && (b.f.x - me.x) ** 2 + (b.f.z - me.z) ** 2 < 9); }
function renderCraft() {
  const have = {}; (stats.inv || []).forEach(it => { if (it) have[it.t] = (have[it.t] || 0) + 1; });
  const stove = nearStove();
  $('recipes').innerHTML = '';
  for (const r of RECIPES) {
    const ok = Object.entries(r.needs).every(([k, n]) => (have[k] || 0) >= n) && (!r.stove || stove) && (!r.carry || !stats.carry);
    const div = document.createElement('div'); div.className = 'recipe';
    div.innerHTML = `<div><b>${ICON[r.gives] || (r.carry === 'barricade' ? '🚧' : '🚩')} ${r.name}</b><div class="need">${Object.entries(r.needs).map(([k, n]) => `<span class="${(have[k] || 0) >= n ? '' : 'miss'}">${n}× ${ITEMS[k].name}</span>`).join(' + ')}${r.stove ? ` <span class="${stove ? '' : 'miss'}">· at a stove</span>` : ''}</div></div>`;
    const b = document.createElement('button'); b.textContent = 'Craft'; b.disabled = !ok; b.onclick = () => { socket.emit('craft', r.id); sfx.play('click'); };
    div.appendChild(b); $('recipes').appendChild(div);
  }
}
const TIPS = [
  'Welcome to the store! Days last 6 minutes, nights 5. Food restocks every Monday and Friday morning — the Cafeteria has the most.',
  'Employees wander harmlessly by day. At night they hunt anyone they spot — build a fort (E grab, LMB place, stack pieces on top of each other).',
  'Press L to anchor (weld) your placed furniture so nobody else can move it. Press T to drop a waypoint.',
  'Watch out for Foggy Days (thick fog, employees hunt all day) and Blood Nights (red lights, faster employees).',
  'Empty hands shove employees back. They can be knocked down, but never stay down for long.',
  'Sleep in a bed (Z) to restore energy. If everyone sleeps at night, the night is skipped!',
  'Press F for your flashlight. Shift sprints but uses stamina.',
  'Place a Claim Flag to set up a Base Camp: it protects your fort and you respawn there. /team invite NAME to team up.',
  'Press Tab for the leaderboard, Enter to chat, Esc for settings.',
];
let tipIdx = 0, tipTimer;
function tip(i) {
  tipIdx = i; const el = $('tip');
  if (!settings.tips || i >= TIPS.length) { el.style.opacity = 0; return; }
  el.textContent = '💡 ' + TIPS[i]; el.style.opacity = 1;
  clearTimeout(tipTimer); tipTimer = setTimeout(() => tip(i + 1), 14000);
}

// ---------------- input ----------------
function lockPointer() { try { const r = renderer.domElement.requestPointerLock?.(); r?.catch?.(() => {}); } catch (e) { /* needs a user gesture */ } }
let chatOpen = false, locked = false, kx = 0, kz = 0, shake = 0;
const canvas = renderer.domElement;
canvas.addEventListener('click', () => { if (playing && !isTouch && !locked && !anyPanel()) lockPointer(); });
document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === canvas; if (!locked && playing && !chatOpen && !anyPanel() && !stats.dead && !isTouch) openPause(); });
const anyPanel = () => ['pause', 'help', 'craft', 'death'].some(id => !$(id).classList.contains('hidden'));
document.addEventListener('mousemove', (e) => {
  if (!locked) return;
  const s = 0.0022 * settings.sens;
  yaw -= e.movementX * s; pitch += e.movementY * s * (settings.invertY ? -1 : 1);
  pitch = Math.max(-0.6, Math.min(1.25, pitch));
});
document.addEventListener('wheel', (e) => { camDist = Math.max(2.2, Math.min(10, camDist + e.deltaY * 0.004)); });
document.addEventListener('mousedown', (e) => { if (!locked || !playing) return; if (e.button === 0) primary(); if (e.button === 2) useItem(); });
document.addEventListener('contextmenu', (e) => e.preventDefault());
function openPause() { $('pause').classList.remove('hidden'); if (document.pointerLockElement) document.exitPointerLock(); }
$('menuBtn').onclick = () => openPause();
$('resumeBtn').onclick = () => { $('pause').classList.add('hidden'); if (!isTouch) lockPointer(); };
$('helpBtn').onclick = () => $('help').classList.remove('hidden');
$('helpClose').onclick = () => $('help').classList.add('hidden');
$('respawnBtn').onclick = () => { socket.emit('respawn'); $('death').classList.add('hidden'); if (!isTouch) lockPointer(); };
function toggleCraft() { const c = $('craft'); c.classList.toggle('hidden'); if (!c.classList.contains('hidden')) { renderCraft(); document.exitPointerLock?.(); } else if (!isTouch) lockPointer(); }

addEventListener('keydown', (e) => {
  if (!playing) return;
  if (chatOpen) {
    if (e.key === 'Enter') { const v = $('chatInput').value.trim(); if (v) socket.emit('chat', v); closeChat(); }
    else if (e.key === 'Escape') closeChat();
    return;
  }
  if (e.key === 'Tab') { e.preventDefault(); $('board').classList.remove('hidden'); return; }
  if (e.key === 'Enter') { chatOpen = true; const i = $('chatInput'); i.style.display = 'block'; i.focus(); document.exitPointerLock?.(); [...$('chatLog').children].forEach(d => d.style.opacity = 1); return; }
  const k = e.code; keys[k] = true;
  if (stats.dead) return;
  if (k === 'KeyC') toggleCraft();
  if (k === 'Escape') { ['craft', 'help', 'pause'].forEach(id => $(id).classList.add('hidden')); }
  if (/^Digit[1-8]$/.test(k)) { sel = +k.slice(5) - 1; updateHotbar(); sfx.play('click'); }
  if (k === 'KeyE') interact();
  if (k === 'KeyQ') placeCarry();
  if (k === 'KeyR') { rotPlace = (rotPlace + 1) & 3; }
  if (k === 'KeyG') { if (stats.inv[sel]) socket.emit('discard', sel); }
  if (k === 'KeyX') useItem();
  if (k === 'KeyF') { flashOn = !flashOn; sfx.play('click'); }
  if (k === 'KeyZ') { if (stats.sleeping) socket.emit('wake'); else socket.emit('sleep'); }
  if (k === 'KeyL') lockNearest();
  if (k === 'KeyT') { if (e.shiftKey) { while (waypoints.length) removeWaypoint(0); showMsg('Waypoints cleared'); } else addWaypoint(); }
  if (k === 'KeyM') openPause();
  const em = { KeyH: 'wave', KeyJ: 'dance', KeyK: 'sit', KeyU: 'point', KeyY: 'cheer' }[k];
  if (em) socket.emit('emote', em);
});
addEventListener('keyup', (e) => { keys[e.code] = false; if (e.key === 'Tab') $('board').classList.add('hidden'); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function closeChat() { chatOpen = false; const i = $('chatInput'); i.value = ''; i.style.display = 'none'; i.blur(); if (!isTouch) lockPointer(); }
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

// ---------------- actions ----------------
const fwd = () => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });
function target() {
  // nearest item first, then furniture in front
  const f = fwd(); let best = null, bd = 1e9;
  for (const m of itemMeshes.values()) {
    const u = m.userData, dx = u.x - me.x, dz = u.z - me.z, d = Math.hypot(dx, dz);
    if (d > 2.8) continue; const score = d - (dx * f.x + dz * f.z) / Math.max(d, 0.1);
    if (score < bd) { bd = score; best = { kind: 'item', id: u.id, name: ITEMS[u.type]?.name }; }
  }
  if (best) return best;
  if (stats.carry) return null;
  const px = me.x + f.x * 1.2, pz = me.z + f.z * 1.2;
  for (const b of boxesCache) {
    const t = TYPES[b.f.type]; if (!t || t.fixed) continue;
    const cx = Math.max(b.x0, Math.min(px, b.x1)), cz = Math.max(b.z0, Math.min(pz, b.z1)), d = Math.hypot(px - cx, pz - cz);
    if (d < 1.3 && d < bd) { bd = d; best = { kind: 'furn', id: b.f.id, name: t.name, f: b.f }; }
  }
  return best;
}
function interact() {
  const t = target(); if (!t) return;
  if (t.kind === 'item') socket.emit('pickup', t.id); else socket.emit('grab', t.id);
}
function ghostPos() {
  const f = fwd(), c = stats.carry, t = TYPES[c.type];
  const dist = Math.max(t.w, t.d) / 2 + 1.1;
  return { x: Math.round((me.x + f.x * dist) * 2) / 2, z: Math.round((me.z + f.z * dist) * 2) / 2, rot: rotPlace };
}
function placeCarry() { if (!stats.carry) return; socket.emit('place', ghostPos()); }
function primary() {
  if (stats.carry) return placeCarry();
  if (stats.sleeping) return;
  socket.emit('attack', { ry: me.ry });
}
function useItem() { const it = stats.inv[sel]; if (!it) return; const d = ITEMS[it.t]; if (d.weapon || d.mat) return showMsg(d.weapon ? 'Attack with LMB' : 'Use materials in crafting (C)'); socket.emit('use', sel); }
function lockNearest() {
  // anchor / weld the placed piece you're looking at (or the nearest one you own)
  const t = target(); if (t?.kind === 'furn' && t.id.startsWith('p_')) return socket.emit('lock', t.id);
  let best = null, bd = 16;
  for (const [id] of placedObjs) { const o = world.placed.get(id); if (o && o.owner === myName) { const d = (o.x - me.x) ** 2 + (o.z - me.z) ** 2; if (d < bd) { bd = d; best = id; } } }
  if (best) socket.emit('lock', best); else showMsg('Nothing of yours to anchor nearby');
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
  const n = waypoints.length + 1, lab = nameLabel('◆ Waypoint ' + n, col); lab.position.y = me.y + 2.6; lab.scale.set(2.2, 0.66, 1); lab.material.depthTest = false; lab.material.fog = false; g.add(lab);
  g.position.set(me.x, 0, me.z); scene.add(g);
  waypoints.push({ x: me.x, z: me.z, col, g, n }); sfx.play('click'); showMsg(`Waypoint placed (${waypoints.length}/4) — Shift+T clears`);
}
function removeWaypoint(i) { const w = waypoints.splice(i, 1)[0]; if (!w) return; scene.remove(w.g); w.g.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); }); }

// ---------------- ghost preview ----------------
let ghost = null, ghostType = null;
const ghostOk = new THREE.MeshBasicMaterial({ color: 0x44ff66, transparent: true, opacity: 0.35, depthWrite: false });
const ghostBad = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.35, depthWrite: false });
function updateGhost() {
  const c = stats.carry;
  if (!c) { if (ghost) { scene.remove(ghost); disposeGroup(ghost); ghost = null; ghostType = null; } return; }
  const gp = ghostPos();
  const gy = world.stackY(aabb({ type: c.type, x: gp.x, z: gp.z, rot: gp.rot }));
  const box = aabb({ type: c.type, x: gp.x, z: gp.z, rot: gp.rot, y: gy });
  const ok = world.canPlace(box);
  const key = c.type + gp.rot + ok;
  if (ghostType !== key) {
    if (ghost) { scene.remove(ghost); disposeGroup(ghost); }
    ghost = partsGroup(worldParts({ type: c.type, x: 0, z: 0, rot: gp.rot, c: c.c || 7 }), { matOverride: ok ? ghostOk : ghostBad });
    scene.add(ghost); ghostType = key;
  }
  ghost.position.set(gp.x, gy, gp.z);
}

// ---------------- touch controls ----------------
const joy = { x: 0, y: 0, id: null };
if (isTouch) {
  $('touch').classList.remove('hidden');
  const j = $('joy'), knob = j.firstElementChild;
  j.addEventListener('touchstart', e => { joy.id = e.changedTouches[0].identifier; e.preventDefault(); });
  j.addEventListener('touchmove', e => {
    for (const t of e.changedTouches) if (t.identifier === joy.id) {
      const r = j.getBoundingClientRect(), dx = t.clientX - r.left - r.width / 2, dy = t.clientY - r.top - r.height / 2, l = Math.min(1, Math.hypot(dx, dy) / 55), a = Math.atan2(dy, dx);
      joy.x = Math.cos(a) * l; joy.y = Math.sin(a) * l; knob.style.transform = `translate(${joy.x * 40}px,${joy.y * 40}px)`;
    } e.preventDefault();
  });
  j.addEventListener('touchend', () => { joy.x = joy.y = 0; joy.id = null; knob.style.transform = ''; });
  let look = null;
  canvas.addEventListener('touchstart', e => { const t = e.changedTouches[0]; look = { id: t.identifier, x: t.clientX, y: t.clientY }; });
  canvas.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (look && t.identifier === look.id) { yaw -= (t.clientX - look.x) * 0.006 * settings.sens; pitch = Math.max(-0.6, Math.min(1.25, pitch + (t.clientY - look.y) * 0.006 * settings.sens)); look.x = t.clientX; look.y = t.clientY; } e.preventDefault(); });
  document.querySelectorAll('#tbtns button').forEach(b => {
    const k = b.dataset.k;
    b.addEventListener('touchstart', e => {
      e.preventDefault(); sfx.init();
      if (k === 'jump') keys.Space = true; if (k === 'sprint') keys.ShiftLeft = !keys.ShiftLeft;
      if (k === 'attack') primary(); if (k === 'use') interact(); if (k === 'place') { if (stats.carry) placeCarry(); else rotPlace = (rotPlace + 1) & 3; }
      if (k === 'eat') useItem(); if (k === 'sleep') socket.emit(stats.sleeping ? 'wake' : 'sleep'); if (k === 'craft') toggleCraft();
    });
    b.addEventListener('touchend', () => { if (k === 'jump') keys.Space = false; });
  });
}

// ---------------- main menu ----------------
$('nameInput').value = settings.name || '';
$('playBtn').onclick = startGame;
$('nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') startGame(); });
function startGame() {
  sfx.init(); sfx.play('click');
  myName = $('nameInput').value.trim().slice(0, 16); settings.name = myName; saveSettings();
  $('menu').classList.add('hidden'); $('hud').classList.remove('hidden');
  playing = true; if (!socket) connect();
  if (!isTouch && !params.has('autoplay')) lockPointer();
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
  const dirs = [['N', 0, -1], ['E', 1, 0], ['S', 0, 1], ['W', -1, 0]];
  mm.font = 'bold 13px Arial'; mm.textAlign = 'center'; mm.textBaseline = 'middle';
  const a = yaw - Math.PI;
  for (const [l, x, z] of dirs) { const rx = x * Math.cos(a) - z * Math.sin(a), rz = x * Math.sin(a) + z * Math.cos(a); mm.fillStyle = l === 'N' ? '#f5c518' : '#ddd'; mm.fillText(l, S / 2 + rx * 78, S / 2 + rz * 78); }
  $('compass').textContent = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((((-(yaw - Math.PI)) % 6.283) + 6.283) % 6.283 / 0.785) % 8];
  $('coords').textContent = `X ${me.x.toFixed(0)}  Z ${me.z.toFixed(0)}`;
  const zn = ZONES[world.zoneAt(me.x, me.z)];
  $('zoneName').textContent = (zn?.special ? '✨ ' : '') + (zn?.name || '');
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
  if (moving && me.onGround) { stepT -= dt * (wantSprint ? 1.6 : 1); if (stepT <= 0) { sfx.play('step', { gain: 0.6 }); stepT = 0.36; } }
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
    g.visible = !o.data.dead;
    animate(o.h, dt, { moving: o.data.anim > 0, speed: o.data.anim === 2 ? 1.5 : 1, air: o.data.y > 0.1 && Math.abs(o.ty - g.position.y) > 0.02, sleeping: o.data.sl, emote: o.data.em });
    if (o.data.anim > 0) { o.stepT -= dt; if (o.stepT <= 0) { o.stepT = 0.4; const sp = spatial(g.position); if (sp.gain > 0.3) sfx.play('step', { ...sp, gain: sp.gain * 0.4 }); } }
  }
  // ---- employees ----
  for (const o of npcs.values()) {
    const g = o.h.g, k = Math.min(1, dt * 8); g.position.x += (o.tx - g.position.x) * k; g.position.z += (o.tz - g.position.z) * k;
    let d = o.try - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g.rotation.y += d * k;
    const hostile = !!o.data.h || gameT >= DAY || dinfo.fog; // night (and Foggy Day) employees look hostile even before they spot you
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
  scene.fog.near = (10 - nightF * 8) * (1 - fogF) + 2 * fogF; scene.fog.far = (70 - nightF * 44) * (1 - fogF) + 18 * fogF;
  if (bloodF) hemi.color.setRGB(1, 0.25, 0.22);
  panelMat.color.setRGB(1 - nightF * 0.92, 1 - nightF * 0.96, 1 - nightF * 0.96);
  const flick = Math.random() < 0.08 ? 0.15 : (Math.sin(now * 0.05) > 0.7 ? 0.5 : 1);
  flickerMat.color.setScalar(flick * (1 - nightF * 0.9));
  if (now - lastPanelUpdate > 400) {
    lastPanelUpdate = now;
    const panels = [];
    for (const ch of chunks.values()) for (const p of ch.panels) { const d = (p[0] - me.x) ** 2 + (p[1] - me.z) ** 2; if (d < 900) panels.push([d, p, ch.flick.includes(p)]); }
    panels.sort((a, b) => a[0] - b[0]);
    lightPool.forEach((l, i) => { const p = panels[i]; if (p) { l.position.set(p[1][0], CEIL - 0.4, p[1][1]); l.userData.flick = p[2]; } l.visible = !!p; });
  }
  lightPool.forEach((l, i) => { const base = 14 * day + (i === 0 || i === 3 ? nightF * 3 : 0); l.intensity = base * (l.userData.flick ? flick : 1); l.color.setRGB(1, (0.95 - nightF * 0.6) * (1 - bloodF * 0.8), (0.85 - nightF * 0.7) * (1 - bloodF * 0.8)); if (bloodF) l.intensity += bloodF * 4; });
  flash.intensity = flashOn ? 40 + nightF * 20 : 0;
  sfx.setNight(nightF);
  $('vignette').style.background = `radial-gradient(ellipse at center,transparent ${55 - nightF * 25}%,rgba(0,0,0,${0.55 + nightF * 0.4}) 100%)`;
  grainT -= dt; if (grainT <= 0 && settings.quality !== 'low') { drawGrain(); grain.style.opacity = 0.04 + nightF * 0.1; grainT = 0.08; }

  // ---- camera ----
  const head = new THREE.Vector3(me.x, me.y + 1.7, me.z);
  let cd = camDist;
  const off = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  // simple camera collision against nearby boxes
  for (let s = 0.5; s <= camDist; s += 0.25) {
    const px = head.x + off.x * s, py = head.y + off.y * s, pz = head.z + off.z * s;
    if (py > CEIL - 0.2 || py < 0.2 || boxesCache.some(b => !b.walk && b.h > py && px > b.x0 && px < b.x1 && pz > b.z0 && pz < b.z1)) { cd = Math.max(0.6, s - 0.3); break; }
  }
  camera.position.copy(head).addScaledVector(off, cd);
  if (shake > 0) { shake -= dt; camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; }
  camera.lookAt(head.x, head.y + 0.1, head.z);
  myModel.g.visible = cd > 1.1 && !stats.dead;

  // ---- prompt / ghost / misc ----
  updateGhost();
  slowT -= dt;
  if (slowT <= 0) {
    slowT = 0.15; streamChunks(); drawMinimap();
    const t = target(), pr = $('prompt');
    const bed = boxesCache.find(b => TYPES[b.f.type]?.bed && Math.max(b.x0 - me.x, 0, me.x - b.x1) ** 2 + Math.max(b.z0 - me.z, 0, me.z - b.z1) ** 2 < 2.25);
    let html = '';
    if (t) html = t.kind === 'item' ? `<b>E</b> pick up ${t.name}` : `<b>E</b> grab ${t.name}${t.f?.locked ? ' 🔩 anchored' : ''}${t.id.startsWith('p_') && t.f?.owner === myName ? ' · <b>L</b> ' + (t.f.locked ? 'unanchor' : 'anchor') : ''}`;
    if (bed && !stats.sleeping && !stats.carry) html += (html ? ' · ' : '') + '<b>Z</b> sleep';
    if (stats.sleeping) html = '💤 Sleeping… <b>Z</b>/move to wake';
    if (nearStove() && !stats.carry) html += (html ? ' · ' : '') + '<b>C</b> cook';
    pr.innerHTML = html; pr.style.display = html ? 'block' : 'none';
    const hrs = (gameT / CYCLE * 24 + 9) % 24, night = gameT >= DAY;
    const left = Math.ceil(night ? CYCLE - gameT : DAY - gameT), mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    $('dayLabel').textContent = `Day ${dayN} · ${weekday(dayN)}`;
    $('timeLabel').textContent = (night ? (dinfo.blood ? '🩸 BLOOD NIGHT' : '🌙 NIGHT') : dinfo.fog ? '🌫 FOGGY DAY' : '☀ DAY') + ` · ${night ? 'opens' : 'closes'} in ${mmss}` + `  ·  ${String(Math.floor(hrs)).padStart(2, '0')}:${String(Math.floor(hrs % 1 * 60)).padStart(2, '0')}`;
    $('timeBar').firstElementChild.style.width = (gameT / CYCLE * 100) + '%';
    $('clock').classList.toggle('night', night); $('clock').classList.toggle('blood', night && dinfo.blood); $('clock').classList.toggle('fog', !night && dinfo.fog);
    $('wpList').innerHTML = waypoints.map(w => `<div style="color:${w.col}">◆ ${w.n} · ${Math.round(Math.hypot(w.x - me.x, w.z - me.z))} m</div>`).join('');
  }
  renderer.render(scene, camera);
}
function h0attackFacing() { return locked && myModel && myModel.swing > 0.8; }
requestAnimationFrame(loop);
applySettings();
// expose for automated tests
window.__game = { get dinfo() { return dinfo; }, setInfo: (i) => Object.assign(dinfo, i), addWaypoint: () => addWaypoint(), get me() { return me; }, get stats() { return stats; }, get npcs() { return npcs.size; }, get others() { return others.size; }, get chunks() { return chunks.size; }, get night() { return nightF; }, get t() { return gameT; }, setYaw: (y) => (yaw = y), setPitch: (p) => (pitch = p), emit: (...a) => socket.emit(...a), toggleFlash: () => (flashOn = !flashOn), keys };
