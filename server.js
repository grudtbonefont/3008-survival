import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { World, VERSION, CHUNK, ITEMS, TYPES, FISTS, RECIPES, CYCLE, DAY, isNight, levelOf, aabb, dayInfo, stackOf, SLOTS, HOTBAR, LOOT, furnHp, breakable } from './shared/world.js';
import { validateAvatar, unlocksAt, DEFAULT_AVATAR } from './shared/avatar.js';
import { ACH } from './shared/achievements.js';

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
const profiles = saved.profiles || {};          // device token -> { xp, ach, stats, streak, lastDate, av, seen }
const respawnQ = new Map(saved.respawn || []);  // broken store furniture id -> respawn time
let placedId = saved.placedId || 1, dirty = false;
const trapIds = new Set([...world.placed.values()].filter(o => o.type === 'trap').map(o => o.id));
function save() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    // keep the 3000 most recently seen profiles
    const prof = Object.entries(profiles).sort((a, b) => (b[1].seen || 0) - (a[1].seen || 0)).slice(0, 3000);
    const data = { version: VERSION, seed: SEED, placedId, removed: [...world.removed], placed: [...world.placed.values()].map(o => ({ ...pubPlaced(o), ...(o.store ? { store: o.store } : {}) })),
      board, profiles: Object.fromEntries(prof), respawn: [...respawnQ] };
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
app.get('/health', (_q, s) => { const i = info(); s.json({ ok: true, version: VERSION, players: players.size, npcs: npcs.size, day: dayNum(), weekday: i.weekday, night: isNight(tNow()), foggy: i.fog, bloodNight: i.blood }); });
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
const info = () => dayInfo(SEED, dayNum());

// ---------- state ----------
const players = new Map(), npcs = new Map(), picked = new Map(), drops = new Map(), parties = new Map(), invites = new Map(), fdmg = new Map();
let npcId = 1, dropId = 1, partyId = 1;
const ITEM_RESPAWN = 240000, DROP_LIFE = 600000, MAX_PLACED = 4000, CLAIM_R = 9, CHEST_SLOTS = 12;
const FURN_RESPAWN = +(process.env.FURN_RESPAWN_MS || 8 * 60000);
const NPC_TYPES = {
  staff: { hp: 100, speed: 4.9, dmg: 12, reach: 1.5, name: 'Employee' },
  runner: { hp: 60, speed: 6.5, dmg: 8, reach: 1.4, name: 'Runner' },
  giant: { hp: 280, speed: 3.9, dmg: 26, reach: 2.1, name: 'Manager' },
};

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v < hi;
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const boxDist2 = (b, p) => Math.max(b.x0 - p.x, 0, p.x - b.x1) ** 2 + Math.max(b.z0 - p.z, 0, p.z - b.z1) ** 2;
const pubPlaced = (p) => ({ id: p.id, type: p.type, x: p.x, z: p.z, rot: p.rot, c: p.c, owner: p.owner, ownerName: p.ownerName, hp: p.hp, locked: p.locked, ...(p.y ? { y: p.y } : {}) });
const sock = (p) => io.sockets.sockets.get(p.id);
const feed = (text) => io.emit('feed', text);
const sameParty = (a, b) => a.party && a.party === b.party;
const tname = (t) => TYPES[t]?.name || t;
const iname = (t) => ITEMS[t]?.name || t;

function findSpawn(cx = 0, cz = 0, spread = CHUNK * 3) {
  for (let i = 0; i < 60; i++) {
    const x = cx + (Math.random() - 0.5) * spread, z = cz + (Math.random() - 0.5) * spread;
    if (world.isFree(x, z, 0.8)) return { x, z };
  }
  return { x: 12, z: 1.5 };
}
function statsOf(p) {
  return { hp: Math.round(p.hp), hunger: Math.round(p.hunger), energy: Math.round(p.energy), inv: p.inv, carry: p.carry && { type: p.carry.type }, dead: p.dead, xp: p.xp, lv: levelOf(p.xp),
    days: p.days, kos: p.kos, pvp: p.pvp, sleeping: p.sleeping, streak: p.prof.streak || 0, chest: p.chest || null,
    party: p.party ? [...parties.get(p.party) || []].map(id => players.get(id)?.name).filter(Boolean) : [] };
}
function sendStats(p) { sock(p)?.emit('stats', statsOf(p)); }
const msg = (p, t) => sock(p)?.emit('msg', t);

// ---------- profiles / progression ----------
function grant(p, id) {
  const a = ACH[id]; if (!a || p.prof.ach.includes(id)) return;
  p.prof.ach.push(id); dirty = true;
  sock(p)?.emit('ach', id);
  feed(`🏆 ${p.name} earned an achievement: ${a.en}`);
  if (a.xp) addXp(p, a.xp);
}
const STAT_ACH = { eat: [[10, 'eat10']], break: [[1, 'break1'], [25, 'break25']], mats: [[100, 'mats100']], craft: [[1, 'craft1'], [15, 'craft15']], build: [[10, 'build10']], ko: [[1, 'ko1'], [10, 'ko10']] };
function stat(p, key, n = 1) {
  const st = p.prof.stats; st[key] = (st[key] || 0) + n;
  for (const [need, id] of STAT_ACH[key] || []) if (st[key] >= need) grant(p, id);
}
function addXp(p, n) {
  const before = levelOf(p.xp); p.xp += n; p.prof.xp = p.xp; dirty = true;
  const now = levelOf(p.xp);
  if (now > before) {
    msg(p, `LEVEL UP! You are now level ${now}`); feed(`${p.name} reached level ${now}`);
    const items = []; for (let l = before + 1; l <= now; l++) items.push(...unlocksAt(l));
    if (items.length) sock(p)?.emit('unlock', { lv: now, items });
    if (now >= 5) grant(p, 'lv5'); if (now >= 10) grant(p, 'lv10');
  }
  updateBoard(p);
}
function updateBoard(p) {
  const b = board[p.name] ||= { name: p.name, bestDays: 0, level: 1, kos: 0 };
  b.bestDays = Math.max(b.bestDays, p.days); b.level = Math.max(b.level, levelOf(p.xp)); b.kos = Math.max(b.kos, p.kos); dirty = true;
}
function survivedNight(p, prevDay) {
  p.days++; addXp(p, 50); msg(p, `You survived the night! (${p.days} total)`);
  grant(p, 'night1'); if (p.days >= 5) grant(p, 'night5'); if (p.days >= 10) grant(p, 'night10');
  if (dayInfo(SEED, prevDay).blood) grant(p, 'blood');
  // real-life daily streak: survive at least one night per calendar day (UTC+3, the store's home time zone)
  const day = (ms) => new Date(ms + 3 * 3600e3).toISOString().slice(0, 10);
  const today = day(Date.now()), yest = day(Date.now() - 864e5), pr = p.prof;
  if (pr.lastDate !== today) {
    pr.streak = pr.lastDate === yest ? (pr.streak || 0) + 1 : 1; pr.lastDate = today;
    const bonus = Math.min(100, 10 * pr.streak);
    sock(p)?.emit('streak', { n: pr.streak, bonus }); addXp(p, bonus);
    if (pr.streak >= 3) grant(p, 'streak3');
  }
}

// ---------- inventory (24 slots, first 8 = hotbar, stacks {t, n, d}) ----------
const mkItem = (t, n = 1, d) => ({ t, n, d: d ?? ITEMS[t]?.dur ?? null });
function roomFor(p, t, inv = p.inv) {
  const max = stackOf(t); let r = 0;
  for (const it of inv) r += !it ? max : it.t === t && max > 1 ? max - it.n : 0;
  return r;
}
function addTo(inv, t, n = 1, d, matsBack = false) {
  const max = stackOf(t);
  if (max > 1) for (const it of inv) if (n > 0 && it && it.t === t && it.n < max) { const k = Math.min(n, max - it.n); it.n += k; n -= k; }
  const order = [...inv.keys()]; if (matsBack && inv.length > HOTBAR) order.push(...order.splice(0, HOTBAR));
  for (const i of order) { if (n <= 0) break; if (!inv[i]) { const k = Math.min(n, max); inv[i] = mkItem(t, k, d); n -= k; } }
  return n; // leftover that did not fit
}
const giveItem = (p, t, n = 1, d) => addTo(p.inv, t, n, d, !!ITEMS[t]?.mat);
const countItem = (p, t) => p.inv.reduce((s, it) => s + (it && it.t === t ? it.n : 0), 0);
function takeItem(p, t, n) {
  for (let i = SLOTS - 1; i >= 0 && n > 0; i--) { const it = p.inv[i]; if (it && it.t === t) { const k = Math.min(n, it.n); it.n -= k; n -= k; if (it.n <= 0) p.inv[i] = null; } }
}
function dropItem(type, d, x, z, n = 1) {
  const o = { id: 'd_' + dropId++, type, d, n, x, z, exp: Date.now() + DROP_LIFE };
  drops.set(o.id, o); io.emit('drop', o);
}
function giveOrDrop(p, t, n, d) {
  const left = giveItem(p, t, n, d);
  if (left > 0) dropItem(t, d ?? ITEMS[t]?.dur ?? null, p.x + Math.sin(p.ry) * 0.8, p.z + Math.cos(p.ry) * 0.8, left);
  return n - left;
}
function kill(p, why) {
  if (p.dead) return;
  p.dead = true; p.hp = 0; p.sleeping = false; p.chest = null;
  p.inv.forEach((it, i) => { if (it) dropItem(it.t, it.d, p.x + Math.cos(i) * 0.9, p.z + Math.sin(i) * 0.9, it.n); });
  p.inv = Array(SLOTS).fill(null); p.carry = null;
  feed(`☠ ${p.name} ${why} (survived ${p.days} night${p.days === 1 ? '' : 's'})`);
  updateBoard(p); p.days = 0;
  sendStats(p);
}
function claimAt(x, z, pad = 0) {
  for (const o of world.placed.values()) if (o.type === 'claim' && (x - o.x) ** 2 + (z - o.z) ** 2 < (CLAIM_R + pad) ** 2) return o;
  return null;
}
function claimBlocks(p, x, z) {
  for (const o of world.placed.values()) if (o.type === 'claim' && o.owner !== p.name && (x - o.x) ** 2 + (z - o.z) ** 2 < CLAIM_R ** 2) {
    const owner = [...players.values()].find(q => q.name === o.owner);
    if (owner && sameParty(owner, p)) continue;
    return o.ownerName || o.owner;
  }
  return null;
}
// may p use (open a door / chest) or move this placed piece?
function canUse(p, o) {
  if (o.owner === p.name || !o.locked) return true;
  const owner = [...players.values()].find(q => q.name === o.owner);
  return !!(owner && sameParty(owner, p));
}
function leaveParty(p) {
  if (!p.party) return;
  const s = parties.get(p.party); s?.delete(p.id);
  for (const id of s || []) { const q = players.get(id); if (q) { msg(q, `${p.name} left the party`); sendStats(q); } }
  if (s && s.size <= 1) { for (const id of s) { const q = players.get(id); if (q) { q.party = null; sendStats(q); } } parties.delete(p.party); }
  p.party = null; sendStats(p);
}

// ---------- destruction (server-authoritative) ----------
function unplace(o) { world.removePlaced(o.id); trapIds.delete(o.id); io.emit('unplaced', o.id); dirty = true; }
function hitFurniture(f, dmg, by) {
  const isP = f.id.startsWith('p_'), max = furnHp(f.type);
  const hp = (isP ? (f.hp ?? max) : (fdmg.get(f.id) ?? max)) - dmg;
  const b = f.box;
  io.emit('hitfx', { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, y: Math.min(b.h, 1.6), dmg: Math.round(dmg), wood: true, mat: Object.keys(LOOT[f.type] || { plank: 1 })[0] });
  if (hp > 0) {
    if (isP) { f.hp = hp; dirty = true; } else fdmg.set(f.id, hp);
    io.emit('furnhp', { id: f.id, hp: Math.round(hp), max });
    return false;
  }
  breakFurniture(f, by);
  return true;
}
function breakFurniture(f, by) {
  const isP = f.id.startsWith('p_'), b = f.box, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  if (isP) {
    unplace(f);
    for (const it of f.store || []) if (it) dropItem(it.t, it.d, cx + (Math.random() - 0.5), cz + (Math.random() - 0.5), it.n);
    for (const q of players.values()) if (q.chest === f.id) { q.chest = null; sock(q)?.emit('chest', null); }
  } else {
    world.markRemoved(f.id); fdmg.delete(f.id); io.emit('removed', f.id);
    respawnQ.set(f.id, Date.now() + FURN_RESPAWN); dirty = true;
    // anything that was sitting on it falls to the floor
    const ch = world.chunk(Math.floor(f.x / CHUNK), Math.floor(f.z / CHUNK));
    for (const it of ch.items) if (it.y && !picked.has(it.id) && it.x > b.x0 - 0.05 && it.x < b.x1 + 0.05 && it.z > b.z0 - 0.05 && it.z < b.z1 + 0.05) {
      picked.set(it.id, ITEMS[it.type]?.cons ? Infinity : Date.now() + ITEM_RESPAWN); io.emit('picked', it.id);
      dropItem(it.type, ITEMS[it.type]?.dur ?? null, it.x, it.z);
    }
  }
  io.emit('broke', { id: f.id, type: f.type, x: cx, z: cz, y: b.y0, w: b.x1 - b.x0, d: b.z1 - b.z0, h: b.h - b.y0, c: f.c });
  if (by) {
    const got = [];
    for (const [m, n0] of Object.entries(LOOT[f.type] || { plank: 1 })) {
      const n = isP ? Math.max(1, Math.floor(n0 / 2)) : n0 + (Math.random() < 0.35 ? 1 : 0);
      giveOrDrop(by, m, n); got.push({ t: m, n }); stat(by, 'mats', n);
    }
    sock(by)?.emit('loot', got); sock(by)?.emit('sfx', 'break');
    stat(by, 'break'); addXp(by, 2); sendStats(by);
  }
}
// broken store furniture comes back after a while - but never inside a claimed base
setInterval(() => {
  const now = Date.now();
  for (const [id, at] of respawnQ) {
    if (now < at) continue;
    const f = world.furnById(id);
    if (!f || !world.removed.has(id)) { respawnQ.delete(id); continue; }
    if (claimAt(f.x, f.z, 1.5)) { respawnQ.delete(id); dirty = true; continue; } // stays gone: it's part of someone's base now
    const pad = { x0: f.box.x0 - 0.4, x1: f.box.x1 + 0.4, z0: f.box.z0 - 0.4, z1: f.box.z1 + 0.4 };
    const busy = [...players.values(), ...npcs.values()].some(q => q.x > pad.x0 && q.x < pad.x1 && q.z > pad.z0 && q.z < pad.z1);
    if (busy || !world.canPlace(f.box)) { respawnQ.set(id, now + 30000); continue; }
    respawnQ.delete(id); world.unmarkRemoved(id); dirty = true; io.emit('restored', id);
  }
}, 2000);

function handleCommand(p, text) {
  const [cmd, ...args] = text.slice(1).split(/\s+/); const s = sock(p);
  const sys = (t) => s?.emit('chat', { sys: true, text: t });
  switch (cmd.toLowerCase()) {
    case 'help': sys('Commands: /pvp, /team (or /party) invite <name>, /team accept, /team leave, /me <action>, /stuck' + (ALLOW_DEBUG ? ', /time day|night, /give <item> [n]' : '')); break;
    case 'pvp': p.pvp = !p.pvp; sys(`PvP ${p.pvp ? 'ON — you can hit and be hit by other PvP players' : 'OFF'}`); sendStats(p); break;
    case 'me': io.emit('chat', { sys: true, text: `* ${p.name} ${clean(args.join(' '), 100)}` }); break;
    case 'stuck': if (!p.dead) { const sp = findSpawn(p.x, p.z, 20); p.x = sp.x; p.z = sp.z; p.y = 0; s.emit('teleport', { x: p.x, y: 0, z: p.z }); } break;
    case 'time': if (ALLOW_DEBUG) { setTime(args[0] === 'night' ? DAY + 1 : args[0] === 'day' ? 1 : +args[0] || 0); sys('Time set'); } else sys('Debug disabled'); break;
    case 'give': if (ALLOW_DEBUG && ITEMS[args[0]]) { giveOrDrop(p, args[0], Math.min(200, +args[1] || 1)); sendStats(p); } else sys('Debug disabled'); break;
    case 'team': case 'party': {
      const sub = (args[0] || '').toLowerCase();
      if (sub === 'invite') {
        const q = [...players.values()].find(x => x.name.toLowerCase() === (args[1] || '').toLowerCase());
        if (!q || q === p) return sys('Player not found');
        invites.set(q.id, p.id); sock(q)?.emit('chat', { sys: true, text: `${p.name} invited you to their team. Type /team accept` }); sys(`Invited ${q.name}`);
      } else if (sub === 'accept') {
        const from = players.get(invites.get(p.id)); invites.delete(p.id);
        if (!from) return sys('No pending invite');
        leaveParty(p);
        if (!from.party) { from.party = partyId++; parties.set(from.party, new Set([from.id])); }
        p.party = from.party; parties.get(p.party).add(p.id);
        for (const id of parties.get(p.party)) { const q = players.get(id); msg(q, `${p.name} joined the party`); sendStats(q); grant(q, 'team'); }
      } else if (sub === 'leave') leaveParty(p);
      else sys('Team: ' + (statsOf(p).party.join(', ') || 'none') + '  (/team invite <name>)');
      break;
    }
    default: sys('Unknown command. /help');
  }
}

io.on('connection', (s) => {
  const P = () => { const p = players.get(s.id); return p && !p.dead ? p : null; };
  // join accepts a plain name (old clients) or { name, token, avatar }
  s.on('join', (raw) => {
    if (players.has(s.id)) return;
    const o = raw && typeof raw === 'object' ? raw : { name: raw };
    let name = clean(o.name, 16).replace(/[<>]/g, '') || 'Guest' + ((Math.random() * 1000) | 0);
    while ([...players.values()].some(q => q.name === name)) name = name.slice(0, 13) + ((Math.random() * 100) | 0);
    const token = typeof o.token === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(o.token) ? o.token : null;
    const prof = token ? (profiles[token] ||= { xp: 0, ach: [], stats: {}, streak: 0, lastDate: null }) : { xp: 0, ach: [], stats: {}, streak: 0, lastDate: null };
    prof.seen = Date.now(); prof.ach ||= []; prof.stats ||= {};
    for (const q of players.values()) if (token && q.token === token) { q.token = null; } // same device twice: the newer tab owns the profile
    const sp = findSpawn();
    const p = { id: s.id, name, token, prof, x: sp.x, y: 0, z: sp.z, ry: 0, anim: 0, sel: 0, hp: 100, hunger: 100, energy: 100, inv: Array(SLOTS).fill(null), carry: null,
      dead: false, sprint: false, lastAtk: 0, hue: Math.random(), lastMove: Date.now(), sleeping: false, emote: null, emoteUntil: 0, xp: prof.xp || 0, days: 0, kos: 0, pvp: false, party: null,
      joinedAt: Date.now(), placedLog: [] };
    p.av = validateAvatar(o.avatar ?? prof.av, levelOf(p.xp)); prof.av = p.av;
    p.inv[0] = mkItem('water');
    players.set(s.id, p);
    const avatars = {}; for (const q of players.values()) avatars[q.id] = q.av;
    s.emit('init', { id: s.id, name, version: VERSION, seed: SEED, t: tNow(), day: dayNum(), info: info(), cycle: CYCLE, dayLen: DAY, x: p.x, z: p.z, debug: ALLOW_DEBUG,
      removed: [...world.removed], placed: [...world.placed.values()].map(pubPlaced), picked: [...picked.keys()], drops: [...drops.values()],
      avatars, av: p.av, ach: prof.ach, streak: prof.streak || 0, pstats: prof.stats, fhp: [...fdmg].map(([id, hp]) => [id, Math.round(hp), furnHp(world.furnById(id)?.type)]) });
    s.broadcast.emit('avatar', { id: s.id, av: p.av });
    sendStats(p);
    feed(`${name} wandered into the store`);
  });

  s.on('setAvatar', (a) => {
    const p = players.get(s.id); if (!p) return;
    const now = Date.now(); if (now - (p.lastAv || 0) < 400) return; p.lastAv = now;
    p.av = validateAvatar(a, levelOf(p.xp)); p.prof.av = p.av; dirty = true;
    io.emit('avatar', { id: s.id, av: p.av });
    if (JSON.stringify(p.av) !== JSON.stringify(DEFAULT_AVATAR)) grant(p, 'style');
  });

  s.on('move', (m) => {
    const p = P(); if (!p || !m || !num(m.x) || !num(m.z) || !num(m.y)) return;
    if (p.sleeping) return;
    const dt = Math.max(0.05, (Date.now() - p.lastMove) / 1000);
    if (Math.sqrt(dist2(p, m)) > 12 * dt + 2) { s.emit('teleport', { x: p.x, y: p.y, z: p.z }); return; }
    p.x = m.x; p.y = Math.max(0, Math.min(6, m.y)); p.z = m.z; p.lastMove = Date.now();
    p.ry = num(m.ry) ? m.ry : 0; p.anim = Number.isInteger(m.anim) ? m.anim : 0; p.sprint = !!m.sprint;
    p.sel = int(m.sel, 0, HOTBAR) ? m.sel : 0;
    if (p.anim && p.emoteUntil) { p.emote = null; p.emoteUntil = 0; }
    if (p.chest) { const c = world.placed.get(p.chest); if (!c || dist2(p, c) > 4 ** 2) { p.chest = null; s.emit('chest', null); } }
  });

  s.on('pickup', (id) => {
    const p = P(); if (!p || typeof id !== 'string') return;
    const it = id.startsWith('d_') ? drops.get(id) : world.itemById(id);
    if (!it || picked.has(id) || dist2(p, it) > 3.5 ** 2) return;
    const n = it.n || 1;
    if (roomFor(p, it.type) < n) return msg(p, 'Inventory full — press G to drop something');
    giveItem(p, it.type, n, it.d);
    if (ITEMS[it.type]?.mat) stat(p, 'mats', n);
    // consumables restock on Monday/Friday mornings (like the original); materials and tools respawn on a timer
    if (id.startsWith('d_')) drops.delete(id); else picked.set(id, ITEMS[it.type]?.cons ? Infinity : Date.now() + ITEM_RESPAWN);
    io.emit('picked', id); s.emit('sfx', 'pickup'); sendStats(p);
  });

  s.on('use', (slot) => {
    const p = P(); if (!p || !int(slot, 0, SLOTS) || !p.inv[slot]) return;
    const it = p.inv[slot], def = ITEMS[it.t]; if (!def || def.weapon || def.mat) return;
    if (def.food) p.hunger = Math.min(100, p.hunger + def.food);
    if (def.energy) p.energy = Math.min(100, p.energy + def.energy);
    if (def.heal && def.healTime) { p.healLeft = (p.healLeft || 0) + def.heal; p.healRate = def.heal / def.healTime; }
    else if (def.heal) p.hp = Math.min(100, p.hp + def.heal);
    msg(p, def.heal < 0 ? `Ouch! The ${def.name} hurt you (${def.heal} HP)` : `Used ${def.name}`); s.emit('sfx', def.heal > 0 && !def.food ? 'heal' : 'eat');
    if (--it.n <= 0) p.inv[slot] = null;
    addXp(p, 1); if (def.food) stat(p, 'eat');
    if (p.hp <= 0) kill(p, `died eating a ${def.name}`); else sendStats(p);
  });

  // drop a whole stack (number) or { slot, n }
  s.on('discard', (a) => {
    const p = P(); const slot = typeof a === 'object' && a ? a.slot : a;
    if (!p || !int(slot, 0, SLOTS) || !p.inv[slot]) return;
    const it = p.inv[slot], n = Number.isInteger(a?.n) && a.n > 0 ? Math.min(a.n, it.n) : it.n;
    dropItem(it.t, it.d, p.x + Math.sin(p.ry) * 1, p.z + Math.cos(p.ry) * 1, n);
    it.n -= n; if (it.n <= 0) p.inv[slot] = null; sendStats(p);
  });

  // move / merge / swap / split stacks inside the inventory
  s.on('invmove', (a) => {
    const p = P(); if (!p || !a || !int(a.from, 0, SLOTS) || !int(a.to, 0, SLOTS) || a.from === a.to) return;
    const A = p.inv[a.from], B = p.inv[a.to]; if (!A) return;
    const n = Number.isInteger(a.n) && a.n > 0 ? Math.min(a.n, A.n) : A.n, max = stackOf(A.t);
    if (!B) { if (n >= A.n) { p.inv[a.to] = A; p.inv[a.from] = null; } else { p.inv[a.to] = mkItem(A.t, n, A.d); A.n -= n; } }
    else if (B.t === A.t && max > 1) { const k = Math.min(n, max - B.n); B.n += k; A.n -= k; if (A.n <= 0) p.inv[a.from] = null; }
    else if (n >= A.n) { p.inv[a.to] = A; p.inv[a.from] = B; }
    sendStats(p);
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
      hit = true; n.hp -= w.dmg; n.aggro = now + 40000; n.stun = now + (w.stun || 250);
      n.x += fx * w.kb; n.z += fz * w.kb; world.collide(n, 0.4, 0);
      io.emit('hitfx', { x: n.x, z: n.z, y: 1.6, dmg: w.dmg, npc: n.id });
      if (n.hp <= 0) {
        n.down = now + 15000 + Math.random() * 8000; n.path = null;
        p.kos++; addXp(p, n.type === 'giant' ? 40 : 15); stat(p, 'ko');
        feed(`${p.name} 🗡 knocked down a ${NPC_TYPES[n.type].name}`);
      }
    }
    if (p.pvp) for (const q of players.values()) {
      if (q === p || q.dead || !q.pvp || sameParty(p, q) || !inCone(q)) continue;
      hit = true; let dmg = Math.round(w.dmg * 0.6);
      if (q.inv[q.sel]?.t === 'shield') dmg = Math.round(dmg * (1 - ITEMS.shield.block));
      q.hp -= dmg; q.sleeping = false;
      sock(q)?.emit('knock', { dx: fx * w.kb, dz: fz * w.kb, dmg });
      io.emit('hitfx', { x: q.x, z: q.z, y: q.y + 1.6, dmg });
      if (q.hp <= 0) { kill(q, `was taken out by ${p.name}`); addXp(p, 20); } else sendStats(q);
    }
    // nobody in reach: hit the furniture the player is aiming at
    if (!hit && typeof a.fid === 'string') {
      const f = world.furnById(a.fid);
      if (f && !world.removed.has(f.id) && (f.id.startsWith('p_') ? world.placed.has(f.id) : true) && breakable(f.type)
        && boxDist2(f.box, p) <= (w.range + 0.7) ** 2 && f.box.y0 < p.y + 2.6 && f.box.h > p.y - 0.5) {
        const claimed = claimBlocks(p, f.x, f.z);
        if (claimed && f.owner !== p.name) msg(p, `This area is claimed by ${claimed}`);
        else if (f.locked && !canUse(p, f) && f.owner !== p.name) msg(p, `Anchored by ${f.ownerName}`);
        else if (world.supports(f.box)) msg(p, 'Something is resting on top of it');
        else { hit = true; hitFurniture(f, w.dmg * (w.fx ?? 1), p); }
      }
    }
    if (hit && held && held.d != null && ITEMS[held.t]?.weapon) {
      held.d--;
      if (held.d <= 0) { msg(p, `Your ${iname(held.t)} broke!`); s.emit('sfx', 'break'); p.inv[p.sel] = null; }
      sendStats(p);
    }
  });

  s.on('grab', (id) => {
    const p = P(); if (!p || p.carry || typeof id !== 'string') return;
    const f = world.furnById(id);
    if (!f || TYPES[f.type].fixed || world.removed.has(id)) return;
    if (boxDist2(f.box, p) > 3 ** 2) return;
    const claimed = claimBlocks(p, f.x, f.z); if (claimed && f.owner !== p.name) return msg(p, `This area is claimed by ${claimed}`);
    if (f.locked && f.owner !== p.name) return msg(p, `Anchored by ${f.ownerName}`);
    if (world.supports(f.box)) return msg(p, 'Something is resting on top of it');
    if (f.store?.some(Boolean)) return msg(p, 'Empty the chest first');
    if (id.startsWith('p_')) unplace(f);
    else { world.markRemoved(id); io.emit('removed', id); }
    p.carry = { type: f.type === 'dooropen' ? 'door' : f.type, c: f.c, hp: f.hp ?? fdmg.get(id) };
    fdmg.delete(id); dirty = true; sendStats(p);
  });

  s.on('place', (o) => {
    const p = P(); if (!p || !p.carry || !o || !num(o.x) || !num(o.z)) return;
    const x = Math.round(o.x * 2) / 2, z = Math.round(o.z * 2) / 2, rot = (o.rot | 0) & 3, type = p.carry.type;
    if ((p.x - x) ** 2 + (p.z - z) ** 2 > 6 ** 2) return msg(p, 'Too far to place');
    if (world.placed.size >= MAX_PLACED) return msg(p, 'The store is full of furniture!');
    const flat = aabb({ type, x, z, rot });
    // height: the client may pick any valid surface under the footprint (floor or on top of something); default = highest
    let y = world.stackY(flat);
    if (num(o.y)) { const ys = world.surfaces(flat); const m = ys.find(v => Math.abs(v - o.y) < 0.02); if (m !== undefined) y = m; }
    const box = aabb({ type, x, z, rot, y });
    if (!world.canPlace(box)) return msg(p, box.h > 6 ? 'Too high — that would hit the ceiling' : 'Something is in the way');
    if (Math.abs(p.x - x) < (box.x1 - box.x0) / 2 + 0.35 && Math.abs(p.z - z) < (box.z1 - box.z0) / 2 + 0.35 && !box.walk && box.y0 < p.y + 1.7 && box.h > p.y + 0.3) return msg(p, 'Step back to place it');
    const claimed = claimBlocks(p, x, z); if (claimed) return msg(p, `This area is claimed by ${claimed}`);
    if (type === 'claim') for (const old of [...world.placed.values()]) if (old.type === 'claim' && old.owner === p.name) unplace(old);
    const obj = world.addPlaced({ id: 'p_' + placedId++, type, c: p.carry.c, x, z, rot, ...(y ? { y } : {}), owner: p.name, ownerName: p.name,
      hp: Math.min(furnHp(type), p.carry.hp || furnHp(type)), locked: ['barricade', 'wall', 'door', 'trap', 'chest'].includes(type),
      ...(TYPES[type].chest ? { store: p.carry.store || Array(CHEST_SLOTS).fill(null) } : {}) });
    if (type === 'trap') trapIds.add(obj.id);
    p.carry = null; dirty = true; addXp(p, 1); stat(p, 'build');
    p.placedLog.push({ id: obj.id, at: Date.now() }); if (p.placedLog.length > 12) p.placedLog.shift();
    io.emit('placed', pubPlaced(obj)); s.emit('sfx', 'place');
    if (obj.type === 'claim') { feed(`🚩 ${p.name} set up a base camp`); grant(p, 'base'); }
    sendStats(p);
  });

  // undo: pick your most recent placement (last 2 minutes) back up
  s.on('undo', () => {
    const p = P(); if (!p) return;
    if (p.carry) return msg(p, 'Your hands are full');
    while (p.placedLog.length) {
      const e = p.placedLog.pop(), o = world.placed.get(e.id);
      if (!o || Date.now() - e.at > 120000) continue;
      if (dist2(p, o) > 10 ** 2) return msg(p, 'Too far to undo');
      if (world.supports(o.box)) return msg(p, 'Something is resting on top of it');
      unplace(o);
      p.carry = { type: o.type === 'dooropen' ? 'door' : o.type, c: o.c, hp: o.hp, store: o.store };
      msg(p, `Picked up ${tname(o.type)}`); s.emit('sfx', 'pickup'); sendStats(p); return;
    }
    msg(p, 'Nothing to undo');
  });

  s.on('lock', (id) => {
    const p = P(); const o = typeof id === 'string' && world.placed.get(id);
    if (!p || !o || dist2(p, o) > 4.5 ** 2) return;
    if (o.owner !== p.name) return msg(p, `Only ${o.ownerName} can weld this`);
    // "Anchor / weld": anchored pieces can't be picked up or moved by anyone else (base building)
    o.locked = !o.locked; dirty = true; io.emit('placedupd', pubPlaced(o)); msg(p, o.locked ? `🔩 ${tname(o.type)} anchored` : `${tname(o.type)} unanchored`);
    if (o.locked) grant(p, 'anchor');
  });

  s.on('door', (id) => {
    const p = P(); const o = typeof id === 'string' && world.placed.get(id);
    if (!p || !o || !TYPES[o.type].door || boxDist2(o.box, p) > 3 ** 2) return;
    if (!canUse(p, o)) return msg(p, `Locked by ${o.ownerName}`);
    const next = o.type === 'door' ? 'dooropen' : 'door';
    if (next === 'door') {
      const nb = aabb({ ...o, type: next });
      if ([...players.values(), ...npcs.values()].some(q => q.x > nb.x0 - 0.3 && q.x < nb.x1 + 0.3 && q.z > nb.z0 - 0.3 && q.z < nb.z1 + 0.3)) return msg(p, 'Something is in the doorway');
    }
    world.removePlaced(o.id); o.type = next; world.addPlaced(o); dirty = true;
    io.emit('placedupd', pubPlaced(o)); io.emit('sfxat', { k: 'door', x: o.x, z: o.z });
  });

  // ---- storage chests ----
  const chestOf = (p, id) => { const c = typeof id === 'string' && world.placed.get(id); return c && c.store && boxDist2(c.box, p) < 3 ** 2 && canUse(p, c) ? c : null; };
  const chestSync = (c) => { for (const q of players.values()) if (q.chest === c.id) { sock(q)?.emit('chest', { id: c.id, store: c.store }); sendStats(q); } };
  s.on('chestopen', (id) => {
    const p = P(); if (!p) return; const c = chestOf(p, id);
    if (!c) { const o = typeof id === 'string' && world.placed.get(id); if (o?.store) msg(p, `Locked by ${o.ownerName}`); return; }
    p.chest = c.id; s.emit('chest', { id: c.id, store: c.store }); s.emit('sfx', 'chest');
  });
  s.on('chestclose', () => { const p = players.get(s.id); if (p) p.chest = null; });
  // { dir: 'in'|'out', slot, n? }: move a stack between inventory and the open chest
  s.on('chestmove', (a) => {
    const p = P(); if (!p || !a || !p.chest) return; const c = chestOf(p, p.chest); if (!c) return;
    const [src, dst, lim] = a.dir === 'in' ? [p.inv, c.store, SLOTS] : [c.store, p.inv, CHEST_SLOTS];
    if (!int(a.slot, 0, lim) || !src[a.slot]) return;
    const it = src[a.slot], n = Number.isInteger(a.n) && a.n > 0 ? Math.min(a.n, it.n) : it.n;
    const left = addTo(dst, it.t, n, it.d), moved = n - left;
    if (!moved) return msg(p, a.dir === 'in' ? 'The chest is full' : 'Inventory full — press G to drop something');
    it.n -= moved; if (it.n <= 0) src[a.slot] = null;
    dirty = true; chestSync(c);
  });

  s.on('craft', (rid) => {
    const p = P(); const r = RECIPES.find(x => x.id === rid); if (!p || !r) return;
    const label = r.gives ? iname(r.gives) : tname(r.carry);
    for (const [k, n] of Object.entries(r.needs)) if (countItem(p, k) < n) return msg(p, `Missing materials for ${label}`);
    const near = (flag) => world.boxesNear(p.x, p.z).some(b => TYPES[b.f.type][flag] && boxDist2(b, p) < 2.5 ** 2);
    if (r.bench && !near('bench')) return msg(p, 'You need to stand next to a workbench');
    if (r.stove && !near('stove')) return msg(p, 'You need to stand next to a stove to cook');
    if (r.carry && p.carry) return msg(p, 'Your hands are full');
    for (const [k, n] of Object.entries(r.needs)) takeItem(p, k, n);
    if (r.carry) p.carry = { type: r.carry, c: (Math.random() * 1e9) | 0, hp: furnHp(r.carry) };
    else giveOrDrop(p, r.gives, r.n || 1);
    msg(p, `Crafted ${label}!`); s.emit('sfx', 'craft'); addXp(p, 5); stat(p, 'craft'); sendStats(p);
  });

  s.on('sleep', () => {
    const p = P(); if (!p || p.sleeping) return;
    const bed = world.boxesNear(p.x, p.z).find(b => TYPES[b.f.type].bed && boxDist2(b, p) < 1.5 ** 2);
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
    if (claim) msg(p, 'Respawned at your base camp');
  });

  s.on('disconnect', () => {
    const p = players.get(s.id);
    if (p) { leaveParty(p); updateBoard(p); p.prof.seen = Date.now(); players.delete(s.id); io.emit('left', s.id); feed(`${p.name} left the store`); }
  });
});

// ---------- world clock / announcements ----------
// Wording follows the original's PA announcements (Day_Cycle page on the SCP-3008 Roblox wiki).
let lastNight = isNight(tNow()), lastDay = dayNum();
const DAY_ANN = ['Welcome! Today\'s special: meatballs in the Cafeteria.', 'Have you visited the Information Booth?', 'Please do not climb on display furniture.',
  'Lost children can be collected at the Information Booth.', 'Remember to eat and rest. Energy matters.', 'Please do not feed the staff.', 'Please do not break the display furniture.'];
const NIGHT_ANN = ['The store is closed.', 'Please exit the building.', 'Staff will assist you shortly.', 'There is no exit.'];
const CLOSED_LINE = 'Excuse me, the store is now closed. Please exit the building.';
function npcSay(text, cap = 6) {
  let n = 0;
  for (const e of npcs.values()) { if (e.down || n >= cap) continue; if ([...players.values()].some(p => dist2(p, e) < 30 ** 2)) { io.emit('npcsay', { id: e.id, text }); n++; } }
}
setInterval(() => {
  const t = tNow(), night = isNight(t), d = dayNum(), di = info();
  if (night !== lastNight || d !== lastDay) {
    if (night && !lastNight) {
      io.emit('announce', { text: di.blood ? 'Attention customers: the store is now closed. Please exit the building. Tonight is a BLOOD NIGHT.' : 'Attention customers: the store is now closed. Please exit the building.', kind: di.blood ? 'blood' : 'night' });
      io.emit('dayinfo', di);
      npcSay(CLOSED_LINE);
      if (di.fog) for (const p of players.values()) if (!p.dead && Date.now() - p.joinedAt > 60000) grant(p, 'fog');
    }
    if (!night && (lastNight || d !== lastDay)) {
      io.emit('dayinfo', di);
      io.emit('announce', { text: `Good morning! It's ${di.weekday}, Day ${d}. The store is now open.` + (di.fog ? ' Today is a FOGGY DAY — employees remain hostile.' : '') + (di.restock ? ' Shelves have been restocked.' : ''), kind: di.fog ? 'fog' : 'day' });
      for (const p of players.values()) if (!p.dead) { survivedNight(p, d - 1); sendStats(p); }
      // employees that came out at night leave at opening time
      for (const n of npcs.values()) if (n.night) npcs.delete(n.id);
      if (di.restock) for (const [id, at] of picked) if (at === Infinity) { picked.delete(id); io.emit('unpicked', id); }
    }
    lastNight = night; lastDay = d;
  }
  if (!night && t > DAY - 30 && t <= DAY - 29) io.emit('announce', { text: 'The store will close in 30 seconds. Please proceed to the exit.', kind: 'info' });
  if (!night && Math.random() < 0.008) io.emit('announce', { text: DAY_ANN[(Math.random() * DAY_ANN.length) | 0], kind: 'info' });
  if (night && Math.random() < 0.006) io.emit('announce', { text: NIGHT_ANN[(Math.random() * NIGHT_ANN.length) | 0], kind: 'creepy' });
  if (night && Math.random() < 0.05) npcSay(CLOSED_LINE, 2);
  // sleep vote: everyone alive asleep at night -> skip to morning
  const alive = [...players.values()].filter(p => !p.dead);
  if (night && alive.length && alive.every(p => p.sleeping)) { setTime(CYCLE - 0.5); feed('😴 Everyone fell asleep… the night passes.'); }
}, 1000);

// ---------- stats tick ----------
setInterval(() => {
  const now = Date.now();
  for (const p of players.values()) {
    if (p.dead) continue;
    // Survival_Guide: hunger runs out in ~25 min; energy drains faster while sprinting; with no energy you can't
    // sprint and get hungry twice as fast; at 0 hunger you lose health. Energy refills by sleeping or drinks.
    p.hunger = Math.max(0, p.hunger - 0.067 * (p.energy <= 0 ? 2 : 1));
    if (p.sleeping) p.energy = Math.min(100, p.energy + 5);
    else p.energy = Math.max(0, p.energy - (p.sprint && p.energy > 0 ? 0.4 : 0.16));
    if (p.healLeft > 0) { const h = Math.min(p.healLeft, p.healRate || 15); p.hp = Math.min(100, p.hp + h); p.healLeft -= h; }
    if (p.hunger <= 0) p.hp -= 1; else if (p.hunger > 50 && p.energy > 0 && p.hp < 100) p.hp = Math.min(100, p.hp + (p.sleeping ? 1.5 : 0.3));
    if (p.emoteUntil && now > p.emoteUntil) { p.emote = null; p.emoteUntil = 0; }
    if (p.hp <= 0) kill(p, 'starved to death');
    sendStats(p);
  }
  for (const [id, at] of picked) if (now > at) { picked.delete(id); io.emit('unpicked', id); }
  for (const [id, d] of drops) if (now > d.exp) { drops.delete(id); io.emit('picked', id); }
  // damaged store furniture slowly mends if left alone
  for (const [id, hp] of fdmg) { const f = world.furnById(id), max = furnHp(f?.type); if (!f || hp + 0.5 >= max) fdmg.delete(id); else fdmg.set(id, hp + 0.5); }
}, 1000);
setInterval(() => {
  const top = Object.values(board).sort((a, b) => b.bestDays - a.bestDays || b.level - a.level || b.kos - a.kos).slice(0, 10);
  const online = [...players.values()].map(p => ({ name: p.name, lv: levelOf(p.xp), days: p.days, kos: p.kos, party: p.party }));
  io.emit('board', { top, online });
}, 3000);

// ---------- NPC simulation (10 Hz) ----------
const TICK = 0.1;
function spawnGroup(p, night, di) {
  const a = Math.random() * Math.PI * 2, d = 28 + Math.random() * 18;
  const cx = p.x + Math.cos(a) * d, cz = p.z + Math.sin(a) * d;
  const size = night ? 2 + ((Math.random() * 3) | 0) + (di.blood ? 2 : 0) : di.fog ? 2 : 1, group = npcId;
  for (let i = 0; i < size; i++) {
    const x = cx + (Math.random() - 0.5) * 4, z = cz + (Math.random() - 0.5) * 4;
    if (!world.isFree(x, z, 0.6)) continue;
    const r = Math.random(), type = !night ? 'staff' : r < 0.6 ? 'staff' : r < 0.85 ? 'runner' : 'giant';
    const id = npcId++;
    npcs.set(id, { id, type, night, x, z, ry: 0, hp: NPC_TYPES[type].hp, dir: Math.random() * 6.28, moving: 0, atk: 0, aggro: 0, group, flank: (Math.random() - 0.5) * 2.4, path: null, pathAt: 0, down: 0 });
  }
}
function stepToward(n, tx, tz, speed) {
  const dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz) || 1, sp = Math.min(d, speed * TICK);
  n.x += dx / d * sp; n.z += dz / d * sp; world.collide(n, 0.4, 0); n.ry = Math.atan2(dx, dz);
}
// employees smash player-built pieces (barricades, walls, doors, chests...) that are in their way
function npcSmash(n, T, blood, now, range = 1.3) {
  if (now - n.atk < 1000) return false;
  let best = null, bd = range ** 2;
  for (const o of world.placed.values()) {
    if (o.box.walk || o.box.y0 > 1.8 || Math.abs(o.x - n.x) > 4 || Math.abs(o.z - n.z) > 4) continue;
    const d = boxDist2(o.box, n); if (d < bd) { bd = d; best = o; }
  }
  if (!best) return false;
  n.atk = now; n.ry = Math.atan2(best.x - n.x, best.z - n.z); io.emit('npcatk', n.id);
  const owner = best.ownerName, type = best.type;
  if (hitFurniture(best, T.dmg * (blood ? 1.5 : 1) * (n.type === 'giant' ? 1.4 : 1), null)) {
    feed(`💥 Employees smashed ${owner}'s ${tname(type)}`); n.path = null; n.raid = null;
  }
  return true;
}
setInterval(() => {
  const now = Date.now(), t0 = tNow(), night = isNight(t0), di = info();
  // Employees turn hostile once the store has been closed for a moment; on a Foggy Day they never stop hunting.
  const hunt = (night && t0 - DAY > 20) || (di.fog && t0 > 10);
  const blood = night && di.blood, fog = di.fog && !night;
  const detect = blood ? 40 : fog ? 14 : 22, giveUp = blood ? 70 : 45;
  const spdMul = blood ? 1.5 : 1, cdMul = blood ? 0.5 : 1;
  const alive = [...players.values()].filter(p => !p.dead);
  for (const p of alive) {
    let near = 0; for (const n of npcs.values()) if (dist2(n, p) < 55 ** 2) near++;
    const want = night ? (blood ? 11 : 7) : fog ? 5 : 2;
    if (near < want && npcs.size < 40 + players.size * 10 && Math.random() < (night || fog ? 0.08 : 0.03)) spawnGroup(p, night || fog, di);
  }
  // snap traps
  for (const id of trapIds) {
    const tr = world.placed.get(id); if (!tr) { trapIds.delete(id); continue; }
    if (now < (tr.cool || 0)) continue;
    for (const n of npcs.values()) {
      if (n.down || n.x < tr.box.x0 - 0.2 || n.x > tr.box.x1 + 0.2 || n.z < tr.box.z0 - 0.2 || n.z > tr.box.z1 + 0.2) continue;
      tr.cool = now + 4000; n.stun = now + 4000; n.hp -= 35; n.path = null;
      io.emit('hitfx', { x: n.x, z: n.z, y: 0.5, dmg: 35, npc: n.id }); io.emit('sfxat', { k: 'trap', x: tr.x, z: tr.z });
      const owner = [...players.values()].find(q => q.name === tr.owner); if (owner) grant(owner, 'trap');
      if (n.hp <= 0) { n.down = now + 20000; if (owner) { owner.kos++; addXp(owner, 15); stat(owner, 'ko'); } }
      hitFurniture(tr, 40, null); // a trap survives 3 snaps
      break;
    }
  }
  for (const n of npcs.values()) {
    const T = NPC_TYPES[n.type];
    let best = null, bd = Infinity;
    for (const p of alive) { const d = dist2(n, p); if (d < bd) { bd = d; best = p; } }
    if (!best || bd > 110 ** 2) { npcs.delete(n.id); continue; }
    if (n.down) { if (now > n.down) { n.down = 0; n.hp = T.hp * 0.6; n.aggro = now + 20000; } n.moving = 0; continue; }
    if (n.stun > now) { n.moving = 0; continue; }
    // detection: employees notice survivors inside their sight range and give up once they are far enough away
    if (hunt) { if (bd < detect ** 2) n.chase = best.id; else if (bd > giveUp ** 2) n.chase = null; } else n.chase = null;
    const hostile = (hunt && n.chase) || n.aggro > now;
    const ox = n.x, oz = n.z;
    if (hostile && bd < 100 ** 2) {
      n.raid = null;
      const d = Math.sqrt(bd);
      // group flanking: aim slightly to the side when far away
      const side = d > 6 ? n.flank : 0, ang = Math.atan2(best.x - n.x, best.z - n.z) + Math.PI / 2;
      const tx = best.x + Math.sin(ang) * side, tz = best.z + Math.cos(ang) * side;
      if (n.jitter > now) stepToward(n, n.x + Math.sin(n.dir) * 2, n.z + Math.cos(n.dir) * 2, T.speed * 0.6);
      else if (d > T.reach * 0.8) {
        const spd = T.speed * spdMul;
        if (d < 45 && world.lineClear(n.x, n.z, tx, tz)) { n.path = null; stepToward(n, tx, tz, spd); }
        else {
          if (!n.path || now - n.pathAt > 900 + Math.random() * 400 || !n.path.length) {
            n.path = world.findPath(n.x, n.z, best.x, best.z, d < 40 ? 2500 : 1200); n.pathAt = now;
          }
          if (n.path.length) {
            const [wx, wz] = n.path[0];
            stepToward(n, wx, wz, spd);
            if (Math.hypot(wx - n.x, wz - n.z) < 0.45) n.path.shift();
          } else stepToward(n, best.x, best.z, spd);
        }
      } else n.ry = Math.atan2(best.x - n.x, best.z - n.z);
      // stuck: smash whatever player-built thing is in the way; otherwise wiggle, repath, and as a last resort hop free
      const moved = Math.hypot(n.x - ox, n.z - oz);
      if (moved < T.speed * TICK * 0.3 && d > T.reach) {
        n.stuck = (n.stuck || 0) + 1;
        if (n.stuck > 5 && npcSmash(n, T, blood, now)) n.stuck = 6;
        else if (n.stuck === 25) { n.path = null; n.dir = Math.random() * Math.PI * 2; n.jitter = now + 700; }
        else if (n.stuck > 70) { const sp = findSpawn(n.x, n.z, 6); n.x = sp.x; n.z = sp.z; n.stuck = 0; n.path = null; }
      } else n.stuck = 0;
      const reachY = (n.type === 'giant' ? 3.0 : 1.6) + (blood ? 1.2 : 0);
      if (d < T.reach && best.y < reachY && now - n.atk > (n.type === 'runner' ? 700 : 1100) * cdMul) {
        // damage: 7-13 normally (giants hit harder), x0.75 on a Blood Night, very heavy in Foggy Day fog
        let dmg = Math.round((fog ? 30 + Math.random() * 10 : 7 + Math.random() * 6) * (n.type === 'giant' ? 2 : n.type === 'runner' ? 0.7 : 1) * (blood ? 0.75 : 1));
        const sh = best.inv[best.sel];
        if (sh?.t === 'shield') { dmg = Math.round(dmg * (1 - ITEMS.shield.block)); if (--sh.d <= 0) { best.inv[best.sel] = null; msg(best, `Your ${iname('shield')} broke!`); } }
        n.atk = now; best.hp -= dmg; best.sleeping = false;
        const k = n.type === 'giant' ? 3 : 1;
        sock(best)?.emit('knock', { dx: Math.sin(n.ry) * k, dz: Math.cos(n.ry) * k, dmg }); io.emit('npcatk', n.id);
        if (best.hp <= 0) kill(best, `was caught by a ${T.name}`);
        sendStats(best);
      }
    } else if (hunt && n.night) {
      // night raids: idle employees go after nearby bases and barricades
      let tgt = n.raid && world.placed.get(n.raid);
      if (!tgt && Math.random() < 0.02) {
        let bd2 = 30 ** 2;
        for (const o of world.placed.values()) if (!o.box.walk && o.type !== 'claim') { const dd = dist2(o, n); if (dd < bd2) { bd2 = dd; tgt = o; } }
        n.raid = tgt?.id || null; n.path = null;
      }
      if (tgt) {
        if (boxDist2(tgt.box, n) > 1.1 ** 2) {
          if (!n.path || !n.path.length || now - n.pathAt > 2000) { n.path = world.findPath(n.x, n.z, tgt.x, tgt.z, 1500); n.pathAt = now; }
          if (n.path.length) { const [wx, wz] = n.path[0]; stepToward(n, wx, wz, T.speed * 0.7); if (Math.hypot(wx - n.x, wz - n.z) < 0.45) n.path.shift(); }
          else stepToward(n, tgt.x, tgt.z, T.speed * 0.7);
          if (Math.hypot(n.x - ox, n.z - oz) < 0.05) { n.stuck = (n.stuck || 0) + 1; if (n.stuck > 5) npcSmash(n, T, blood, now); if (n.stuck > 60) { n.raid = null; n.stuck = 0; } } else n.stuck = 0;
        } else npcSmash(n, T, blood, now, 1.6);
      } else wander(n, ox, oz);
    } else wander(n, ox, oz);
    n.moving = Math.hypot(n.x - ox, n.z - oz) > 0.01 ? 1 : 0;
  }
  const t = tNow(), day = dayNum();
  const plist = [...players.values()].map(p => ({ id: p.id, name: p.name, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), ry: +p.ry.toFixed(2), anim: p.anim, hue: p.hue,
    held: p.inv[p.sel]?.t || null, carry: p.carry?.type || null, dead: p.dead, sl: p.sleeping, em: p.emote, lv: levelOf(p.xp), pvp: p.pvp, party: p.party }));
  const nlist = [...npcs.values()].map(n => ({ id: n.id, x: +n.x.toFixed(2), z: +n.z.toFixed(2), ry: +n.ry.toFixed(2), m: n.moving, h: ((hunt && n.chase) || n.aggro > now || n.raid) ? 1 : 0, b: blood ? 1 : 0, k: n.type, d: n.down ? 1 : 0 }));
  for (const p of players.values()) {
    const s = sock(p); if (!s) continue;
    s.emit('state', { t, day, players: plist, npcs: nlist.filter(n => (n.x - p.x) ** 2 + (n.z - p.z) ** 2 < 75 ** 2) });
  }
}, TICK * 1000);
function wander(n, ox, oz) {
  if (Math.random() < 0.02) n.dir = Math.random() * Math.PI * 2;
  n.idle = (n.idle || 0) - TICK;
  if (n.idle <= 0) {
    const sp = 1.3 * TICK;
    n.x += Math.sin(n.dir) * sp; n.z += Math.cos(n.dir) * sp; world.collide(n, 0.4, 0); n.ry = n.dir;
    if (Math.hypot(n.x - ox, n.z - oz) < sp * 0.5) n.dir += Math.PI / 2 + Math.random();
    if (Math.random() < 0.01) n.idle = 2 + Math.random() * 3;
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`3008 Survival v${VERSION} on :${PORT} (seed ${SEED}${ALLOW_DEBUG ? ', DEBUG' : ''})`));
