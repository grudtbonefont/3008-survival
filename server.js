import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { World, CHUNK, ITEMS, TYPES, FISTS, CYCLE, DAY, isNight } from './shared/world.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use('/shared', express.static(path.join(__dirname, 'shared')));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three')));
app.get('/health', (_q, s) => s.send('ok'));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const SEED = process.env.SEED ? parseInt(process.env.SEED, 10) : (Math.random() * 2 ** 31) | 0;
const world = new World(SEED);
const START = Date.now();
const timeNow = () => ((Date.now() - START) / 1000) % CYCLE;
const players = new Map();
const npcs = new Map();
const picked = new Map();          // itemId -> respawnAt
let npcId = 1, placedId = 1;
const ITEM_RESPAWN = 240000, MAX_PLACED = 3000;

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const pubPlaced = (p) => ({ id: p.id, type: p.type, x: p.x, z: p.z, rot: p.rot, c: p.c });

function findSpawn() {
  for (let i = 0; i < 50; i++) {
    const x = (Math.random() - 0.5) * CHUNK * 8, z = (Math.random() - 0.5) * CHUNK * 8;
    if (world.isFree(x, z, 0.8)) return { x, z };
  }
  return { x: 12, z: 1.5 };
}
function sendStats(p) {
  const s = io.sockets.sockets.get(p.id);
  if (s) s.emit('stats', { hp: Math.round(p.hp), hunger: Math.round(p.hunger), energy: Math.round(p.energy), inv: p.inv, carry: p.carry, dead: p.dead });
}
function announce(text) { io.emit('announce', text); }
function kill(p, why) {
  if (p.dead) return;
  p.dead = true; p.hp = 0; p.inv = Array(6).fill(null); p.carry = null;
  io.emit('chat', { sys: true, text: `${p.name} ${why}` });
  sendStats(p);
}

io.on('connection', (s) => {
  s.on('join', (rawName) => {
    if (players.has(s.id)) return;
    const name = clean(rawName, 16) || 'Guest' + ((Math.random() * 1000) | 0);
    const sp = findSpawn();
    const p = { id: s.id, name, x: sp.x, y: 0, z: sp.z, ry: 0, anim: 0, sel: 0, hp: 100, hunger: 100, energy: 100,
      inv: Array(6).fill(null), carry: null, dead: false, sprint: false, lastAtk: 0, hue: Math.random(), lastMove: Date.now() };
    players.set(s.id, p);
    s.emit('init', { id: s.id, seed: SEED, t: timeNow(), cycle: CYCLE, day: DAY, x: p.x, z: p.z,
      removed: [...world.removed], placed: [...world.placed.values()].map(pubPlaced), picked: [...picked.keys()] });
    sendStats(p);
    io.emit('chat', { sys: true, text: `${name} wandered into the store.` });
  });

  s.on('move', (m) => {
    const p = players.get(s.id);
    if (!p || p.dead || !m || !num(m.x) || !num(m.z) || !num(m.y)) return;
    const dt = Math.max(0.05, (Date.now() - p.lastMove) / 1000);
    if (Math.sqrt(dist2(p, m)) > 12 * dt + 2) { s.emit('teleport', { x: p.x, y: p.y, z: p.z }); return; } // anti-teleport
    p.x = m.x; p.y = Math.max(0, Math.min(6, m.y)); p.z = m.z; p.lastMove = Date.now();
    p.ry = num(m.ry) ? m.ry : 0; p.anim = num(m.anim) ? m.anim : 0; p.sprint = !!m.sprint;
    p.sel = Number.isInteger(m.sel) && m.sel >= 0 && m.sel < 6 ? m.sel : 0;
  });

  s.on('pickup', (id) => {
    const p = players.get(s.id); if (!p || p.dead || typeof id !== 'string') return;
    const it = world.itemById(id);
    if (!it || picked.has(id) || dist2(p, it) > 3.5 ** 2) return;
    const slot = p.inv.indexOf(null);
    if (slot < 0) return s.emit('msg', 'Inventory full');
    p.inv[slot] = it.type;
    picked.set(id, Date.now() + ITEM_RESPAWN);
    io.emit('picked', id);
    sendStats(p);
  });

  s.on('use', (slot) => {
    const p = players.get(s.id); if (!p || p.dead || !Number.isInteger(slot) || slot < 0 || slot > 5) return;
    const def = ITEMS[p.inv[slot]]; if (!def || def.weapon) return;
    if (def.food) p.hunger = Math.min(100, p.hunger + def.food);
    if (def.energy) p.energy = Math.min(100, p.energy + def.energy);
    if (def.heal) p.hp = Math.min(100, p.hp + def.heal);
    s.emit('msg', `Used ${def.name}`);
    p.inv[slot] = null; sendStats(p);
  });

  s.on('discard', (slot) => {
    const p = players.get(s.id); if (!p || !Number.isInteger(slot) || slot < 0 || slot > 5) return;
    p.inv[slot] = null; sendStats(p);
  });

  s.on('attack', (a) => {
    const p = players.get(s.id); if (!p || p.dead || !a || !num(a.ry)) return;
    const w = ITEMS[p.inv[p.sel]]?.weapon ? ITEMS[p.inv[p.sel]] : FISTS;
    const now = Date.now(); if (now - p.lastAtk < w.cd * 0.9) return; p.lastAtk = now;
    io.emit('swing', s.id);
    const fx = Math.sin(a.ry), fz = Math.cos(a.ry);
    for (const n of npcs.values()) {
      const dx = n.x - p.x, dz = n.z - p.z, d = Math.hypot(dx, dz);
      if (d > w.range + 0.4 || (d > 0.5 && (dx * fx + dz * fz) / d < 0.4)) continue;
      n.hp -= w.dmg; n.aggro = now + 30000;
      n.x += fx * 0.8; n.z += fz * 0.8; world.collide(n, 0.4, 0);
      io.emit('npchit', { id: n.id, hp: n.hp });
      if (n.hp <= 0) { npcs.delete(n.id); io.emit('chat', { sys: true, text: `${p.name} knocked out an employee.` }); }
    }
  });

  s.on('grab', (id) => {
    const p = players.get(s.id); if (!p || p.dead || p.carry || typeof id !== 'string') return;
    const f = world.furnById(id);
    if (!f || TYPES[f.type].fixed || world.removed.has(id)) return;
    const b = f.box, cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1));
    if ((p.x - cx) ** 2 + (p.z - cz) ** 2 > 3 ** 2) return;
    if (id.startsWith('p_')) { world.placed.delete(id); io.emit('unplaced', id); }
    else { world.removed.add(id); io.emit('removed', id); }
    p.carry = { type: f.type, c: f.c };
    sendStats(p);
  });

  s.on('place', (o) => {
    const p = players.get(s.id); if (!p || p.dead || !p.carry || !o || !num(o.x) || !num(o.z)) return;
    if (dist2(p, o) > 6 ** 2) return s.emit('msg', 'Too far to place');
    if (world.placed.size >= MAX_PLACED) return s.emit('msg', 'Store is full of furniture!');
    const obj = world.addPlaced({ id: 'p_' + placedId++, type: p.carry.type, c: p.carry.c, x: o.x, z: o.z, rot: (o.rot | 0) & 3 });
    p.carry = null;
    io.emit('placed', pubPlaced(obj));
    sendStats(p);
  });

  s.on('chat', (t) => {
    const p = players.get(s.id); const text = clean(t, 140); if (!p || !text) return;
    const now = Date.now(); if (now - (p.lastChat || 0) < 400) return; p.lastChat = now;
    io.emit('chat', { name: p.name, text });
  });

  s.on('respawn', () => {
    const p = players.get(s.id); if (!p || !p.dead) return;
    const sp = findSpawn();
    Object.assign(p, { x: sp.x, y: 0, z: sp.z, hp: 100, hunger: 100, energy: 100, dead: false, lastMove: Date.now() });
    s.emit('teleport', { x: p.x, y: 0, z: p.z });
    sendStats(p);
  });

  s.on('disconnect', () => {
    const p = players.get(s.id);
    if (p) { players.delete(s.id); io.emit('left', s.id); io.emit('chat', { sys: true, text: `${p.name} left.` }); }
  });
});

// ---------- simulation ----------
let lastNight = isNight(timeNow());
const DAY_ANN = ['Welcome to the store! Today\'s special: meatballs.', 'Customers are reminded to stay hydrated.', 'Please do not climb on display furniture.',
  'Lost children can be collected at the... service desk.', 'The store will close soon. Please proceed to checkout.'];
setInterval(() => {
  const t = timeNow(), night = isNight(t);
  if (night !== lastNight) {
    announce(night ? 'ATTENTION: The store is now closed. Please leave the building.' : 'Good morning! The store is now open. Have a pleasant day.');
    lastNight = night;
  }
  if (!night && Math.random() < 0.012) announce(DAY_ANN[(Math.random() * DAY_ANN.length) | 0]);
}, 1000);

// stats tick
setInterval(() => {
  for (const p of players.values()) {
    if (p.dead) continue;
    p.hunger = Math.max(0, p.hunger - (p.sprint ? 0.4 : 0.22));
    if (p.sprint) p.energy = Math.max(0, p.energy - 5); else p.energy = Math.min(100, p.energy + (p.anim ? 1.5 : 3));
    if (p.hunger <= 0) p.hp -= 1.5; else if (p.hunger > 70 && p.hp < 100) p.hp = Math.min(100, p.hp + 0.5);
    if (p.hp <= 0) kill(p, 'starved to death.');
    sendStats(p);
  }
  const now = Date.now();
  for (const [id, at] of picked) if (now > at) { picked.delete(id); io.emit('unpicked', id); }
}, 1000);

// npc tick (10Hz)
const TICK = 0.1;
setInterval(() => {
  const now = Date.now(), night = isNight(timeNow());
  const alive = [...players.values()].filter(p => !p.dead);
  // spawn / despawn
  for (const p of alive) {
    let near = 0; for (const n of npcs.values()) if (dist2(n, p) < 50 ** 2) near++;
    const want = night ? 5 : 2;
    if (near < want && npcs.size < 40 + players.size * 5) {
      const a = Math.random() * Math.PI * 2, d = 25 + Math.random() * 15;
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (world.isFree(x, z, 0.6)) { const id = npcId++; npcs.set(id, { id, x, z, ry: 0, hp: 100, dir: Math.random() * 6.28, moving: 0, atk: 0, aggro: 0 }); }
    }
  }
  for (const n of npcs.values()) {
    let best = null, bd = Infinity;
    for (const p of alive) { const d = dist2(n, p); if (d < bd) { bd = d; best = p; } }
    if (!best || bd > 90 ** 2) { npcs.delete(n.id); continue; }
    const hostile = night || n.aggro > now;
    const ox = n.x, oz = n.z;
    if (hostile && bd < 60 ** 2) {
      const d = Math.sqrt(bd), dx = (best.x - n.x) / (d || 1), dz = (best.z - n.z) / (d || 1);
      if (d > 1.1) {
        // steer: try direct, else sidestep around obstacles
        const sp = 4.9 * TICK;
        n.x += dx * sp; n.z += dz * sp; world.collide(n, 0.4, 0);
        if (Math.hypot(n.x - ox, n.z - oz) < sp * 0.3) {
          n.side = n.side || (Math.random() < 0.5 ? 1 : -1);
          n.x = ox - dz * sp * n.side; n.z = oz + dx * sp * n.side; world.collide(n, 0.4, 0);
        }
      }
      n.ry = Math.atan2(dx, dz);
      if (d < 1.5 && Math.abs(best.y) < 1.6 && now - n.atk > 1000) {
        n.atk = now; best.hp -= 12;
        io.to(best.id).emit('hurt', 12); io.emit('npcatk', n.id);
        if (best.hp <= 0) kill(best, 'was caught by an employee.');
        sendStats(best);
      }
    } else {
      if (Math.random() < 0.02) n.dir = Math.random() * Math.PI * 2;
      n.idle = (n.idle || 0) - TICK;
      if (n.idle <= 0) {
        const sp = 1.3 * TICK;
        n.x += Math.sin(n.dir) * sp; n.z += Math.cos(n.dir) * sp; world.collide(n, 0.4, 0);
        n.ry = n.dir;
        if (Math.hypot(n.x - ox, n.z - oz) < sp * 0.5) n.dir += Math.PI / 2;
        if (Math.random() < 0.01) n.idle = 2 + Math.random() * 3;
      }
    }
    n.moving = Math.hypot(n.x - ox, n.z - oz) > 0.01 ? 1 : 0;
  }
  io.emit('state', {
    t: timeNow(),
    players: [...players.values()].map(p => ({ id: p.id, name: p.name, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), ry: +p.ry.toFixed(2), anim: p.anim, hue: p.hue, held: p.inv[p.sel], carry: p.carry?.type || null, dead: p.dead })),
    npcs: [...npcs.values()].map(n => ({ id: n.id, x: +n.x.toFixed(2), z: +n.z.toFixed(2), ry: +n.ry.toFixed(2), m: n.moving, h: hostileFlag(n, night, now) })),
  });
}, TICK * 1000);
const hostileFlag = (n, night, now) => (night || n.aggro > now) ? 1 : 0;

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`3008 Survival server on :${PORT} (seed ${SEED})`));
