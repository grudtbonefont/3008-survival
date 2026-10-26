import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { World, VERSION, CHUNK, ITEMS, TYPES, FISTS, RECIPES, CYCLE, DAY, isNight, levelOf, aabb } from './shared/world.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALLOW_DEBUG = process.env.ALLOW_DEBUG === '1';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SAVE_FILE = path.join(DATA_DIR, 'world.json');

// ---------- persistence ----------
let saved = {};
try { saved = JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8')); console.log(`Loaded save: ${saved.placed?.length || 0} placed, ${saved.removed?.length || 0} removed`); } catch { /* fresh world */ }
const SEED = process.env.SEED ? parseInt(process.env.SEED, 10) : (saved.seed ?? ((Math.random() * 2 ** 31) | 0));
const world = new World(SEED);
for (const id of saved.removed || []) world.markRemoved(id);
for (const o of saved.placed || []) world.addPlaced(o);
const board = saved.board || {};
let placedId = saved.placedId || 1, dirty = false;
function save() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const data = { version: VERSION, seed: SEED, placedId, removed: [...world.removed], placed: [...world.placed.values()].map(pubPlaced), board };
    fs.writeFileSync(SAVE_FILE + '.tmp', JSON.stringify(data)); fs.renameSync(SAVE_FILE + '.tmp', SAVE_FILE); dirty = false;
  } catch (e) { console.error('save failed', e.message); }
}
setInterval(() => dirty && save(), 30000);
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { save(); process.exit(0); });

// ---------- http ----------
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use('/shared', express.static(path.join(__dirname, 'shared')));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three')));
app.get('/health', (_q, s) => s.json({ ok: true, version: VERSION, players: players.size, npcs: npcs.size, day: dayNum(), night: isNight(tNow()) }));
app.get('/debug/time', (q, s) => { if (!ALLOW_DEBUG) return s.status(403).send('debug disabled'); setTime(+q.query.t || 0); s.send('t=' + tNow().toFixed(1)); });
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ---------- time ----------
const START = Date.now();
let timeOffset = +(process.env.START_TIME || 0);
const worldSec = () => (Date.now() - START) / 1000 + timeOffset;
const tNow = () => ((worldSec() % CYCLE) + CYCLE) % CYCLE;
const dayNum = () => Math.floor(worldSec() / CYCLE) + 1;
function setTime(t) { timeOffset += ((t % CYCLE) + CYCLE) % CYCLE - tNow(); }

// ---------- state ----------
const players = new Map(), npcs = new Map(), picked = new Map(), drops = new Map(), parties = new Map(), invites = new Map();
let npcId = 1, dropId = 1, partyId = 1;
const ITEM_RESPAWN = 240000, DROP_LIFE = 600000, MAX_PLACED = 4000, SLOTS = 8, CLAIM_R = 9;
const NPC_TYPES = {
  staff: { hp: 100, speed: 4.9, dmg: 12, reach: 1.5, name: 'Employee' },
  runner: { hp: 60, speed: 6.5, dmg: 8, reach: 1.4, name: 'Runner' },
  giant: { hp: 280, speed: 3.9, dmg: 26, reach: 2.1, name: 'Manager' },
};

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const pubPlaced = (p) => ({ id: p.id, type: p.type, x: p.x, z: p.z, rot: p.rot, c: p.c, owner: p.owner, ownerName: p.ownerName, hp: p.hp, locked: p.locked });
const sock = (p) => io.sockets.sockets.get(p.id);
const feed = (text) => io.emit('feed', text);
const sameParty = (a, b) => a.party && a.party === b.party;

function findSpawn(cx = 0, cz = 0, spread = CHUNK * 3) {
  for (let i = 0; i < 60; i++) {
    const x = cx + (Math.random() - 0.5) * spread, z = cz + (Math.random() - 0.5) * spread;
    if (world.isFree(x, z, 0.8)) return { x, z };
  }
  return { x: 12, z: 1.5 };
}
function statsOf(p) {
  return { hp: Math.round(p.hp), hunger: Math.round(p.hunger), energy: Math.round(p.energy), inv: p.inv, carry: p.carry, dead: p.dead, xp: p.xp, lv: levelOf(p.xp),
    days: p.days, kos: p.kos, pvp: p.pvp, sleeping: p.sleeping, party: p.party ? [...parties.get(p.party) || []].map(id => players.get(id)?.name).filter(Boolean) : [] };
}
function sendStats(p) { sock(p)?.emit('stats', statsOf(p)); }
const msg = (p, t) => sock(p)?.emit('msg', t);
function addXp(p, n) {
  const before = levelOf(p.xp); p.xp += n;
  if (levelOf(p.xp) > before) { msg(p, `LEVEL UP! You are now level ${levelOf(p.xp)}`); feed(`${p.name} reached level ${levelOf(p.xp)}`); }
  updateBoard(p);
}
function updateBoard(p) {
  const b = board[p.name] ||= { name: p.name, bestDays: 0, level: 1, kos: 0 };
  b.bestDays = Math.max(b.bestDays, p.days); b.level = Math.max(b.level, levelOf(p.xp)); b.kos = Math.max(b.kos, p.kos); dirty = true;
}
function giveItem(p, type, d) {
  const slot = p.inv.indexOf(null); if (slot < 0) return false;
  p.inv[slot] = { t: type, d: d ?? ITEMS[type].dur ?? null }; return true;
}
function dropItem(type, d, x, z) {
  const o = { id: 'd_' + dropId++, type, d, x, z, exp: Date.now() + DROP_LIFE };
  drops.set(o.id, o); io.emit('drop', o);
}
function kill(p, why) {
  if (p.dead) return;
  p.dead = true; p.hp = 0; p.sleeping = false;
  p.inv.forEach((it, i) => { if (it) dropItem(it.t, it.d, p.x + Math.cos(i) * 0.8, p.z + Math.sin(i) * 0.8); });
  p.inv = Array(SLOTS).fill(null); p.carry = null;
  feed(`☠ ${p.name} ${why} (survived ${p.days} night${p.days === 1 ? '' : 's'})`);
  updateBoard(p); p.days = 0;
  sendStats(p);
}
function claimBlocks(p, x, z) {
  for (const o of world.placed.values()) if (o.type === 'claim' && o.owner !== p.name && (x - o.x) ** 2 + (z - o.z) ** 2 < CLAIM_R ** 2) {
    const owner = [...players.values()].find(q => q.name === o.owner);
    if (owner && sameParty(owner, p)) continue;
    return o.ownerName || o.owner;
  }
  return null;
}
function leaveParty(p) {
  if (!p.party) return;
  const s = parties.get(p.party); s?.delete(p.id);
  for (const id of s || []) { const q = players.get(id); if (q) { msg(q, `${p.name} left the party`); sendStats(q); } }
  if (s && s.size <= 1) { for (const id of s) { const q = players.get(id); if (q) { q.party = null; sendStats(q); } } parties.delete(p.party); }
  p.party = null; sendStats(p);
}

function handleCommand(p, text) {
  const [cmd, ...args] = text.slice(1).split(/\s+/); const s = sock(p);
  const sys = (t) => s?.emit('chat', { sys: true, text: t });
  switch (cmd.toLowerCase()) {
    case 'help': sys('Commands: /pvp, /party invite <name>, /party accept, /party leave, /me <action>, /stuck' + (ALLOW_DEBUG ? ', /time day|night' : '')); break;
    case 'pvp': p.pvp = !p.pvp; sys(`PvP ${p.pvp ? 'ON — you can hit and be hit by other PvP players' : 'OFF'}`); sendStats(p); break;
    case 'me': io.emit('chat', { sys: true, text: `* ${p.name} ${clean(args.join(' '), 100)}` }); break;
    case 'stuck': if (!p.dead) { const sp = findSpawn(p.x, p.z, 20); p.x = sp.x; p.z = sp.z; p.y = 0; s.emit('teleport', { x: p.x, y: 0, z: p.z }); } break;
    case 'time': if (ALLOW_DEBUG) { setTime(args[0] === 'night' ? DAY + 1 : args[0] === 'day' ? 1 : +args[0] || 0); sys('Time set'); } else sys('Debug disabled'); break;
    case 'party': {
      const sub = (args[0] || '').toLowerCase();
      if (sub === 'invite') {
        const q = [...players.values()].find(x => x.name.toLowerCase() === (args[1] || '').toLowerCase());
        if (!q || q === p) return sys('Player not found');
        invites.set(q.id, p.id); sock(q)?.emit('chat', { sys: true, text: `${p.name} invited you to a party. Type /party accept` }); sys(`Invited ${q.name}`);
      } else if (sub === 'accept') {
        const from = players.get(invites.get(p.id)); invites.delete(p.id);
        if (!from) return sys('No pending invite');
        leaveParty(p);
        if (!from.party) { from.party = partyId++; parties.set(from.party, new Set([from.id])); }
        p.party = from.party; parties.get(p.party).add(p.id);
        for (const id of parties.get(p.party)) { const q = players.get(id); msg(q, `${p.name} joined the party`); sendStats(q); }
      } else if (sub === 'leave') leaveParty(p);
      else sys('Party: ' + (statsOf(p).party.join(', ') || 'none') + '  (/party invite <name>)');
      break;
    }
    default: sys('Unknown command. /help');
  }
}

io.on('connection', (s) => {
  const P = () => { const p = players.get(s.id); return p && !p.dead ? p : null; };
  s.on('join', (rawName) => {
    if (players.has(s.id)) return;
    let name = clean(rawName, 16).replace(/[<>]/g, '') || 'Guest' + ((Math.random() * 1000) | 0);
    while ([...players.values()].some(q => q.name === name)) name = name.slice(0, 13) + ((Math.random() * 100) | 0);
    const sp = findSpawn();
    const p = { id: s.id, name, x: sp.x, y: 0, z: sp.z, ry: 0, anim: 0, sel: 0, hp: 100, hunger: 100, energy: 100, inv: Array(SLOTS).fill(null), carry: null,
      dead: false, sprint: false, lastAtk: 0, hue: Math.random(), lastMove: Date.now(), sleeping: false, emote: null, emoteUntil: 0, xp: 0, days: 0, kos: 0, pvp: false, party: null };
    p.inv[0] = { t: 'juice', d: null };
    players.set(s.id, p);
    s.emit('init', { id: s.id, name, version: VERSION, seed: SEED, t: tNow(), day: dayNum(), cycle: CYCLE, dayLen: DAY, x: p.x, z: p.z, debug: ALLOW_DEBUG,
      removed: [...world.removed], placed: [...world.placed.values()].map(pubPlaced), picked: [...picked.keys()], drops: [...drops.values()] });
    sendStats(p);
    feed(`${name} wandered into the store`);
  });

  s.on('move', (m) => {
    const p = P(); if (!p || !m || !num(m.x) || !num(m.z) || !num(m.y)) return;
    if (p.sleeping) return;
    const dt = Math.max(0.05, (Date.now() - p.lastMove) / 1000);
    if (Math.sqrt(dist2(p, m)) > 12 * dt + 2) { s.emit('teleport', { x: p.x, y: p.y, z: p.z }); return; }
    p.x = m.x; p.y = Math.max(0, Math.min(6, m.y)); p.z = m.z; p.lastMove = Date.now();
    p.ry = num(m.ry) ? m.ry : 0; p.anim = Number.isInteger(m.anim) ? m.anim : 0; p.sprint = !!m.sprint;
    p.sel = Number.isInteger(m.sel) && m.sel >= 0 && m.sel < SLOTS ? m.sel : 0;
    if (p.anim && p.emoteUntil) { p.emote = null; p.emoteUntil = 0; }
  });

  s.on('pickup', (id) => {
    const p = P(); if (!p || typeof id !== 'string') return;
    const it = id.startsWith('d_') ? drops.get(id) : world.itemById(id);
    if (!it || picked.has(id) || dist2(p, it) > 3.5 ** 2) return;
    if (!giveItem(p, it.type, it.d)) return msg(p, 'Inventory full — press G to drop something');
    if (id.startsWith('d_')) drops.delete(id); else picked.set(id, Date.now() + ITEM_RESPAWN);
    io.emit('picked', id); s.emit('sfx', 'pickup'); sendStats(p);
  });

  s.on('use', (slot) => {
    const p = P(); if (!p || !Number.isInteger(slot) || !p.inv[slot]) return;
    const def = ITEMS[p.inv[slot].t]; if (!def || def.weapon || def.mat) return;
    if (def.food) p.hunger = Math.min(100, p.hunger + def.food);
    if (def.energy) p.energy = Math.min(100, p.energy + def.energy);
    if (def.heal) p.hp = Math.min(100, p.hp + def.heal);
    msg(p, `Used ${def.name}`); s.emit('sfx', def.heal && !def.food ? 'heal' : 'eat');
    p.inv[slot] = null; addXp(p, 1); sendStats(p);
  });

  s.on('discard', (slot) => {
    const p = P(); if (!p || !Number.isInteger(slot) || !p.inv[slot]) return;
    dropItem(p.inv[slot].t, p.inv[slot].d, p.x + Math.sin(p.ry) * 1, p.z + Math.cos(p.ry) * 1);
    p.inv[slot] = null; sendStats(p);
  });

  s.on('attack', (a) => {
    const p = P(); if (!p || !a || !num(a.ry) || p.sleeping) return;
    const held = p.inv[p.sel], w = held && ITEMS[held.t]?.weapon ? ITEMS[held.t] : FISTS;
    const now = Date.now(); if (now - p.lastAtk < w.cd * 0.85) return; p.lastAtk = now;
    p.ry = a.ry;
    io.emit('swing', s.id);
    const fx = Math.sin(a.ry), fz = Math.cos(a.ry);
    const inCone = (o) => { const dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz); return d <= w.range + 0.4 && (d < 0.6 || (dx * fx + dz * fz) / d > 0.45); };
    let hit = false;
    for (const n of npcs.values()) {
      if (n.down || !inCone(n)) continue;
      hit = true; n.hp -= w.dmg; n.aggro = now + 40000; n.stun = now + 250;
      n.x += fx * w.kb; n.z += fz * w.kb; world.collide(n, 0.4, 0);
      io.emit('hitfx', { x: n.x, z: n.z, y: 1.6, dmg: w.dmg, npc: n.id });
      if (n.hp <= 0) {
        n.down = now + 15000 + Math.random() * 8000; n.path = null;
        p.kos++; addXp(p, n.type === 'giant' ? 40 : 15);
        feed(`${p.name} 🗡 knocked down a ${NPC_TYPES[n.type].name}`);
      }
    }
    if (p.pvp) for (const q of players.values()) {
      if (q === p || q.dead || !q.pvp || sameParty(p, q) || !inCone(q)) continue;
      hit = true; const dmg = Math.round(w.dmg * 0.6); q.hp -= dmg; q.sleeping = false;
      sock(q)?.emit('knock', { dx: fx * w.kb, dz: fz * w.kb, dmg });
      io.emit('hitfx', { x: q.x, z: q.z, y: q.y + 1.6, dmg });
      if (q.hp <= 0) { kill(q, `was taken out by ${p.name}`); addXp(p, 20); } else sendStats(q);
    }
    if (hit && held && held.d != null) {
      held.d--;
      if (held.d <= 0) { msg(p, `Your ${ITEMS[held.t].name} broke!`); s.emit('sfx', 'break'); p.inv[p.sel] = null; }
      sendStats(p);
    }
  });

  s.on('grab', (id) => {
    const p = P(); if (!p || p.carry || typeof id !== 'string') return;
    const f = world.furnById(id);
    if (!f || TYPES[f.type].fixed || world.removed.has(id)) return;
    const b = f.box, cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1));
    if ((p.x - cx) ** 2 + (p.z - cz) ** 2 > 3 ** 2) return;
    const claimed = claimBlocks(p, f.x, f.z); if (claimed && f.owner !== p.name) return msg(p, `This area is claimed by ${claimed}`);
    if (f.locked && f.owner !== p.name) return msg(p, `Locked by ${f.ownerName}`);
    if (id.startsWith('p_')) { world.removePlaced(id); io.emit('unplaced', id); }
    else { world.markRemoved(id); io.emit('removed', id); }
    p.carry = { type: f.type, c: f.c, hp: f.hp };
    dirty = true; sendStats(p);
  });

  s.on('place', (o) => {
    const p = P(); if (!p || !p.carry || !o || !num(o.x) || !num(o.z)) return;
    const x = Math.round(o.x * 2) / 2, z = Math.round(o.z * 2) / 2, rot = (o.rot | 0) & 3;
    if ((p.x - x) ** 2 + (p.z - z) ** 2 > 6 ** 2) return msg(p, 'Too far to place');
    if (world.placed.size >= MAX_PLACED) return msg(p, 'The store is full of furniture!');
    const box = aabb({ type: p.carry.type, x, z, rot });
    if (!world.canPlace(box)) return msg(p, 'Something is in the way');
    if (Math.abs(p.x - x) < (box.x1 - box.x0) / 2 + 0.35 && Math.abs(p.z - z) < (box.z1 - box.z0) / 2 + 0.35 && !box.walk && p.y < 0.5) return msg(p, 'Step back to place it');
    const claimed = claimBlocks(p, x, z); if (claimed) return msg(p, `This area is claimed by ${claimed}`);
    if (p.carry.type === 'claim') for (const old of [...world.placed.values()]) if (old.type === 'claim' && old.owner === p.name) { world.removePlaced(old.id); io.emit('unplaced', old.id); }
    const t = TYPES[p.carry.type];
    const obj = world.addPlaced({ id: 'p_' + placedId++, type: p.carry.type, c: p.carry.c, x, z, rot, owner: p.name, ownerName: p.name,
      hp: t.hp ? (p.carry.hp || t.hp) : undefined, locked: p.carry.type === 'barricade' });
    p.carry = null; dirty = true; addXp(p, 1);
    io.emit('placed', pubPlaced(obj)); s.emit('sfx', 'place');
    if (obj.type === 'claim') feed(`🚩 ${p.name} claimed a base`);
    sendStats(p);
  });

  s.on('lock', (id) => {
    const p = P(); const o = typeof id === 'string' && world.placed.get(id);
    if (!p || !o || o.type !== 'barricade' || dist2(p, o) > 4 ** 2) return;
    if (o.owner !== p.name) return msg(p, 'Not your barricade');
    o.locked = !o.locked; dirty = true; io.emit('placedupd', pubPlaced(o)); msg(p, o.locked ? 'Barricade locked' : 'Barricade unlocked');
  });

  s.on('craft', (rid) => {
    const p = P(); const r = RECIPES.find(x => x.id === rid); if (!p || !r) return;
    const have = {}; p.inv.forEach(it => { if (it) have[it.t] = (have[it.t] || 0) + 1; });
    for (const [k, n] of Object.entries(r.needs)) if ((have[k] || 0) < n) return msg(p, `Missing ingredients for ${r.name}`);
    if (r.stove && !world.boxesNear(p.x, p.z).some(b => TYPES[b.f.type].stove && (b.f.x - p.x) ** 2 + (b.f.z - p.z) ** 2 < 3 ** 2)) return msg(p, 'You need to stand next to a stove to cook');
    if (r.carry && p.carry) return msg(p, 'Your hands are full');
    for (const [k, n] of Object.entries(r.needs)) for (let i = 0, left = n; i < SLOTS && left; i++) if (p.inv[i]?.t === k) { p.inv[i] = null; left--; }
    if (r.carry) p.carry = { type: r.carry, c: (Math.random() * 1e9) | 0 }; else giveItem(p, r.gives);
    msg(p, `Crafted ${r.name}!`); s.emit('sfx', 'craft'); addXp(p, 5); sendStats(p);
  });

  s.on('sleep', () => {
    const p = P(); if (!p || p.sleeping) return;
    const bed = world.boxesNear(p.x, p.z).find(b => TYPES[b.f.type].bed && Math.max(b.x0 - p.x, 0, p.x - b.x1) ** 2 + Math.max(b.z0 - p.z, 0, p.z - b.z1) ** 2 < 1.5 ** 2);
    if (!bed) return msg(p, 'You need to be next to a bed');
    p.sleeping = true; p.x = bed.f.x; p.z = bed.f.z; p.y = bed.h; p.ry = bed.f.rot * Math.PI / 2;
    s.emit('teleport', { x: p.x, y: p.y, z: p.z }); sendStats(p);
    msg(p, 'Sleeping… (move to wake up). If everyone sleeps at night, the night is skipped.');
  });
  s.on('wake', () => { const p = P(); if (p && p.sleeping) { p.sleeping = false; p.lastMove = Date.now(); sendStats(p); } });

  s.on('emote', (e) => {
    const p = P(); if (!p || !['wave', 'dance', 'sit', 'point', 'cheer'].includes(e)) return;
    p.emote = e; p.emoteUntil = Date.now() + (e === 'sit' ? 60000 : 4000);
  });

  s.on('chat', (t) => {
    const p = players.get(s.id); const text = clean(t, 160); if (!p || !text) return;
    const now = Date.now(); if (now - (p.lastChat || 0) < 400) return; p.lastChat = now;
    if (text.startsWith('/')) return handleCommand(p, text);
    io.emit('chat', { name: p.name, text, lv: levelOf(p.xp), party: p.party });
  });

  s.on('debugTime', (t) => { if (ALLOW_DEBUG && num(t)) setTime(t); });

  s.on('respawn', () => {
    const p = players.get(s.id); if (!p || !p.dead) return;
    const claim = [...world.placed.values()].find(o => o.type === 'claim' && o.owner === p.name);
    const sp = claim ? findSpawn(claim.x, claim.z, 6) : findSpawn();
    Object.assign(p, { x: sp.x, y: 0, z: sp.z, hp: 100, hunger: 100, energy: 100, dead: false, lastMove: Date.now() });
    s.emit('teleport', { x: p.x, y: 0, z: p.z }); sendStats(p);
    if (claim) msg(p, 'Respawned at your base');
  });

  s.on('disconnect', () => {
    const p = players.get(s.id);
    if (p) { leaveParty(p); updateBoard(p); players.delete(s.id); io.emit('left', s.id); feed(`${p.name} left the store`); }
  });
});

// ---------- world clock / announcements ----------
let lastNight = isNight(tNow()), lastDay = dayNum();
const DAY_ANN = ['Welcome! Today\'s special: Swedish-style meatballs in the restaurant.', 'Customers are reminded to stay hydrated.', 'Please do not climb on display furniture.',
  'Lost children can be collected at the… service desk.', 'Have you visited our Kitchens department?', 'The store will close soon. Please proceed to the checkout.', 'Attention: please do not feed the staff.'];
const NIGHT_ANN = ['The store is closed.', 'Please remain calm.', 'Staff will assist you shortly.', 'There is no exit.'];
setInterval(() => {
  const t = tNow(), night = isNight(t), d = dayNum();
  if (night !== lastNight || d !== lastDay) {
    if (night && !lastNight) { io.emit('announce', { text: `ATTENTION: Day ${d} is over. The store is now CLOSED. Please leave the building.`, kind: 'night' }); }
    if (!night && (lastNight || d !== lastDay)) {
      io.emit('announce', { text: `Good morning! Day ${d}. The store is now open.`, kind: 'day' });
      for (const p of players.values()) if (!p.dead) { p.days++; addXp(p, 50); msg(p, `You survived the night! (${p.days} total)`); sendStats(p); }
      for (const n of npcs.values()) if (Math.random() < 0.6) npcs.delete(n.id);
    }
    lastNight = night; lastDay = d;
  }
  if (!night && Math.random() < 0.01) io.emit('announce', { text: DAY_ANN[(Math.random() * DAY_ANN.length) | 0], kind: 'info' });
  if (night && Math.random() < 0.006) io.emit('announce', { text: NIGHT_ANN[(Math.random() * NIGHT_ANN.length) | 0], kind: 'creepy' });
  // sleep vote: everyone alive asleep at night -> skip to morning
  const alive = [...players.values()].filter(p => !p.dead);
  if (night && alive.length && alive.every(p => p.sleeping)) { setTime(CYCLE - 0.5); feed('😴 Everyone fell asleep… the night passes.'); }
}, 1000);

// ---------- stats tick ----------
setInterval(() => {
  const now = Date.now();
  for (const p of players.values()) {
    if (p.dead) continue;
    p.hunger = Math.max(0, p.hunger - (p.sprint ? 0.32 : 0.18));
    if (p.sleeping) p.energy = Math.min(100, p.energy + 5);
    else p.energy = Math.max(0, p.energy - (p.sprint ? 0.35 : 0.12));
    if (p.hunger <= 0) p.hp -= 1.5; else if (p.hunger > 60 && p.hp < 100) p.hp = Math.min(100, p.hp + (p.sleeping ? 1.5 : 0.4));
    if (p.energy <= 0) p.hp -= 0.5;
    if (p.emoteUntil && now > p.emoteUntil) { p.emote = null; p.emoteUntil = 0; }
    if (p.hp <= 0) kill(p, p.hunger <= 0 ? 'starved to death' : 'collapsed from exhaustion');
    sendStats(p);
  }
  for (const [id, at] of picked) if (now > at) { picked.delete(id); io.emit('unpicked', id); }
  for (const [id, d] of drops) if (now > d.exp) { drops.delete(id); io.emit('picked', id); }
}, 1000);
setInterval(() => {
  const top = Object.values(board).sort((a, b) => b.bestDays - a.bestDays || b.level - a.level || b.kos - a.kos).slice(0, 10);
  const online = [...players.values()].map(p => ({ name: p.name, lv: levelOf(p.xp), days: p.days, kos: p.kos, party: p.party }));
  io.emit('board', { top, online });
}, 3000);

// ---------- NPC simulation (10 Hz) ----------
const TICK = 0.1;
function spawnGroup(p, night) {
  const a = Math.random() * Math.PI * 2, d = 28 + Math.random() * 18;
  const cx = p.x + Math.cos(a) * d, cz = p.z + Math.sin(a) * d;
  const size = night ? 2 + ((Math.random() * 3) | 0) : 1, group = npcId;
  for (let i = 0; i < size; i++) {
    const x = cx + (Math.random() - 0.5) * 4, z = cz + (Math.random() - 0.5) * 4;
    if (!world.isFree(x, z, 0.6)) continue;
    const r = Math.random(), type = !night ? 'staff' : r < 0.6 ? 'staff' : r < 0.85 ? 'runner' : 'giant';
    const id = npcId++;
    npcs.set(id, { id, type, x, z, ry: 0, hp: NPC_TYPES[type].hp, dir: Math.random() * 6.28, moving: 0, atk: 0, aggro: 0, group, flank: (Math.random() - 0.5) * 2.4, path: null, pathAt: 0, down: 0 });
  }
}
function stepToward(n, tx, tz, speed) {
  const dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz) || 1, sp = Math.min(d, speed * TICK);
  n.x += dx / d * sp; n.z += dz / d * sp; world.collide(n, 0.4, 0); n.ry = Math.atan2(dx, dz);
}
setInterval(() => {
  const now = Date.now(), night = isNight(tNow()), hunt = night && tNow() - DAY > 20; // 20 s grace after closing
  const alive = [...players.values()].filter(p => !p.dead);
  for (const p of alive) {
    let near = 0; for (const n of npcs.values()) if (dist2(n, p) < 55 ** 2) near++;
    if (near < (night ? 7 : 2) && npcs.size < 40 + players.size * 8 && Math.random() < (night ? 0.08 : 0.03)) spawnGroup(p, night);
  }
  for (const n of npcs.values()) {
    const T = NPC_TYPES[n.type];
    let best = null, bd = Infinity;
    for (const p of alive) { const d = dist2(n, p); if (d < bd) { bd = d; best = p; } }
    if (!best || bd > 110 ** 2) { npcs.delete(n.id); continue; }
    if (n.down) { if (now > n.down) { n.down = 0; n.hp = T.hp * 0.6; n.aggro = now + 20000; } n.moving = 0; continue; }
    if (n.stun > now) { n.moving = 0; continue; }
    const hostile = hunt || n.aggro > now;
    const ox = n.x, oz = n.z;
    if (hostile && bd < 100 ** 2) {
      const d = Math.sqrt(bd);
      // group flanking: aim slightly to the side when far away
      const side = d > 6 ? n.flank : 0, ang = Math.atan2(best.x - n.x, best.z - n.z) + Math.PI / 2;
      const tx = best.x + Math.sin(ang) * side, tz = best.z + Math.cos(ang) * side;
      if (d > T.reach * 0.8) {
        if (d < 45 && world.lineClear(n.x, n.z, tx, tz)) { n.path = null; stepToward(n, tx, tz, T.speed); }
        else {
          if (!n.path || now - n.pathAt > 900 + Math.random() * 400 || !n.path.length) {
            n.path = world.findPath(n.x, n.z, best.x, best.z, d < 40 ? 2500 : 1200); n.pathAt = now;
          }
          if (n.path.length) {
            const [wx, wz] = n.path[0];
            stepToward(n, wx, wz, T.speed);
            if (Math.hypot(wx - n.x, wz - n.z) < 0.45) n.path.shift();
          } else stepToward(n, best.x, best.z, T.speed);
        }
      } else n.ry = Math.atan2(best.x - n.x, best.z - n.z);
      // stuck against a barricade -> smash it
      const moved = Math.hypot(n.x - ox, n.z - oz);
      if (moved < T.speed * TICK * 0.3 && d > T.reach) {
        n.stuck = (n.stuck || 0) + 1;
        if (n.stuck > 5 && now - n.atk > 1000) {
          const bar = [...world.placed.values()].find(o => o.type === 'barricade' && Math.max(o.box.x0 - n.x, 0, n.x - o.box.x1) ** 2 + Math.max(o.box.z0 - n.z, 0, n.z - o.box.z1) ** 2 < 1.2 ** 2);
          if (bar) {
            n.atk = now; bar.hp -= T.dmg; io.emit('npcatk', n.id); io.emit('hitfx', { x: bar.x, z: bar.z, y: 1.5, dmg: T.dmg, wood: true });
            if (bar.hp <= 0) { world.removePlaced(bar.id); io.emit('unplaced', bar.id); feed(`💥 Employees smashed ${bar.ownerName}'s barricade`); n.path = null; }
            else io.emit('placedupd', pubPlaced(bar));
            dirty = true;
          }
        }
      } else n.stuck = 0;
      const reachY = n.type === 'giant' ? 2.4 : 1.6;
      if (d < T.reach && best.y < reachY && now - n.atk > (n.type === 'runner' ? 700 : 1100)) {
        n.atk = now; best.hp -= T.dmg; best.sleeping = false;
        const k = n.type === 'giant' ? 3 : 1;
        sock(best)?.emit('knock', { dx: Math.sin(n.ry) * k, dz: Math.cos(n.ry) * k, dmg: T.dmg }); io.emit('npcatk', n.id);
        if (best.hp <= 0) kill(best, `was caught by a ${T.name}`);
        sendStats(best);
      }
    } else {
      if (Math.random() < 0.02) n.dir = Math.random() * Math.PI * 2;
      n.idle = (n.idle || 0) - TICK;
      if (n.idle <= 0) {
        const sp = 1.3 * TICK;
        n.x += Math.sin(n.dir) * sp; n.z += Math.cos(n.dir) * sp; world.collide(n, 0.4, 0); n.ry = n.dir;
        if (Math.hypot(n.x - ox, n.z - oz) < sp * 0.5) n.dir += Math.PI / 2;
        if (Math.random() < 0.01) n.idle = 2 + Math.random() * 3;
      }
    }
    n.moving = Math.hypot(n.x - ox, n.z - oz) > 0.01 ? 1 : 0;
  }
  const t = tNow(), day = dayNum();
  const plist = [...players.values()].map(p => ({ id: p.id, name: p.name, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), ry: +p.ry.toFixed(2), anim: p.anim, hue: p.hue,
    held: p.inv[p.sel]?.t || null, carry: p.carry?.type || null, dead: p.dead, sl: p.sleeping, em: p.emote, lv: levelOf(p.xp), pvp: p.pvp, party: p.party }));
  const nlist = [...npcs.values()].map(n => ({ id: n.id, x: +n.x.toFixed(2), z: +n.z.toFixed(2), ry: +n.ry.toFixed(2), m: n.moving, h: (hunt || n.aggro > now) ? 1 : 0, k: n.type, d: n.down ? 1 : 0 }));
  for (const p of players.values()) {
    const s = sock(p); if (!s) continue;
    s.emit('state', { t, day, players: plist, npcs: nlist.filter(n => (n.x - p.x) ** 2 + (n.z - p.z) ** 2 < 75 ** 2) });
  }
}, TICK * 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`3008 Survival v${VERSION} on :${PORT} (seed ${SEED}${ALLOW_DEBUG ? ', DEBUG' : ''})`));
