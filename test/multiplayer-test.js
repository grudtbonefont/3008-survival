// Headless multiplayer test for v2: two clients, movement, chat, items, building, crafting, sleep, combat, debug time, persistence.
import { spawn } from 'child_process';
import { io } from 'socket.io-client';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { World, aabb, VERSION, TYPES } from '../shared/world.js';
const PORT = 3999, URL = `http://localhost:${PORT}`;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), '3008-'));
const srv = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT, SEED: '1234', DATA_DIR, ALLOW_DEBUG: '1', START_TIME: '30' }, stdio: ['ignore', 'pipe', 'pipe'] });
let errOut = ''; srv.stderr.on('data', d => errOut += d);
await new Promise((res, rej) => { srv.stdout.on('data', d => { process.stdout.write('[server] ' + d); if (/ on :\d+/.test(d)) res(); }); setTimeout(() => rej(new Error('server start timeout')), 8000); });
const fail = (m) => { console.error('FAIL:', m); srv.kill(); process.exit(1); };
const ok = (m) => console.log('PASS:', m);
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const once = (s, ev, pred = () => true, ms = 5000) => new Promise((res, rej) => { const h = (d) => { if (pred(d)) { s.off(ev, h); res(d); } }; s.on(ev, h); setTimeout(() => rej(new Error('timeout waiting ' + ev)), ms); });
process.on('unhandledRejection', (e) => fail(e.message));

const html = await (await fetch(URL)).text(); if (!html.includes('3008')) fail('index not served'); ok('index.html served');
for (const p of ['/main.js', '/js/models.js', '/js/audio.js', '/style.css', '/shared/world.js', '/vendor/three/build/three.module.js', '/socket.io/socket.io.js'])
  { const r = await fetch(URL + p); if (r.status !== 200) fail(p + ' ' + r.status); } ok('static assets + three + socket.io client served');
const health = await (await fetch(URL + '/health')).json();
if (health.version !== VERSION || !health.ok) fail('health ' + JSON.stringify(health)); ok('/health reports ' + JSON.stringify(health));

const a = io(URL, { transports: ['websocket'] }), b = io(URL, { transports: ['websocket'] });
const ia = once(a, 'init'), ib = once(b, 'init');
let statsA = null; a.on('stats', s => statsA = s);
a.on('connect', () => a.emit('join', 'Alice')); b.on('connect', () => b.emit('join', 'Bob'));
const [initA, initB] = await Promise.all([ia, ib]);
if (initA.seed !== 1234 || initB.seed !== initA.seed) fail('seed mismatch'); ok('both clients joined with shared seed ' + initA.seed + ', version ' + initA.version);
const wA = new World(initA.seed), wB = new World(initB.seed);
if (JSON.stringify(wA.chunk(3, -2).furn.map(f => [f.id, f.type, f.x, f.z])) !== JSON.stringify(wB.chunk(3, -2).furn.map(f => [f.id, f.type, f.x, f.z]))) fail('world not deterministic');
ok('deterministic world generation identical across clients');
const zones = new Set(); for (let i = -6; i < 6; i++) for (let j = -6; j < 6; j++) zones.add(wA.chunk(i, j).zone); ok('zones present: ' + [...zones].join(', '));
const t0 = Date.now(); const pth = wA.findPath(2, 2, 60, 40); ok(`A* path ${pth ? pth.length : 'none'} steps in ${Date.now() - t0} ms`);
await wait(200);
if (!statsA || statsA.inv.length !== 8 || statsA.inv[0]?.t !== 'water') fail('starting inventory ' + JSON.stringify(statsA?.inv)); ok('8-slot object inventory with starter water');

let ax = initA.x, az = initA.z;
async function walkTo(x, z, stop = 0) {
  const d = Math.hypot(x - ax, z - az), steps = Math.max(1, Math.ceil((d - stop) / 1.2)), k = Math.max(0, d - stop) / d || 0;
  const tx = ax + (x - ax) * k, tz = az + (z - az) * k, sx = (tx - ax) / steps, sz = (tz - az) / steps;
  for (let i = 0; i < steps; i++) { ax += sx; az += sz; a.emit('move', { x: ax, y: 0, z: az, ry: 0, anim: 1, sel: 0 }); await wait(110); }
}
await walkTo(ax + 1.5, az);
const st = await once(b, 'state', s => { const p = s.players.find(p => p.id === initA.id); return p && Math.abs(p.x - ax) < 0.01; });
ok(`Bob sees Alice at (${st.players.find(p => p.id === initA.id).x}, ${az.toFixed(2)}); players=${st.players.length} npcs=${st.npcs.length}`);
b.emit('move', { x: initB.x + 0.5, y: 0, z: initB.z, ry: 0, anim: 1, sel: 0 });
await once(a, 'state', s => { const p = s.players.find(p => p.id === initB.id); return p && Math.abs(p.x - (initB.x + 0.5)) < 0.01; }); ok('Alice sees Bob move');

const cp = once(b, 'chat', m => m.name === 'Alice'); a.emit('chat', 'hello <b>bob</b>'); ok('chat delivered: ' + JSON.stringify(await cp));
const hp = once(a, 'chat', m => m.sys && /pvp|PvP/.test(m.text)); await wait(450); a.emit('chat', '/pvp'); await hp; await wait(100); if (!statsA.pvp) fail('pvp toggle'); ok('/pvp command toggles PvP');
await wait(450); a.emit('chat', '/pvp');
const em = once(b, 'state', s => s.players.find(p => p.id === initA.id)?.em === 'wave'); a.emit('emote', 'wave'); await em; ok('emote broadcast');
const tp = once(a, 'teleport'); a.emit('move', { x: ax + 500, y: 0, z: az, ry: 0, anim: 0, sel: 0 }); await tp; ok('server rejected teleport hack');

// item pickup
let item = null, bd = 1e9;
for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const it of wA.chunk(Math.floor(ax / 24) + i, Math.floor(az / 24) + j).items) { const d = Math.hypot(it.x - ax, it.z - az); if (d < bd) { bd = d; item = it; } }
await walkTo(item.x, item.z);
const pkB = once(b, 'picked', id => id === item.id); const stA = once(a, 'stats', s => s.inv.some(x => x?.t === item.type) && s.inv.filter(Boolean).length >= 2);
a.emit('pickup', item.id); await pkB; await stA; ok(`Alice picked up ${item.type} (${item.id}); Bob notified`);
// use water (slot 0)
const used = once(a, 'stats', s => s.inv[0] === null); a.emit('use', 0); await used; ok('used water from slot 0');
// drop + re-pickup
const slot = statsA.inv.findIndex(Boolean);
const dr = once(b, 'drop'); a.emit('discard', slot); const drop = await dr; ok('dropped item ' + drop.type + ' as ' + drop.id);
const rp = once(b, 'picked', id => id === drop.id); a.emit('pickup', drop.id); await rp; ok('re-picked dropped item');
// craft without ingredients
const cm = once(a, 'msg', m => /Missing/.test(m)); a.emit('craft', 'bandage'); await cm; ok('crafting validates ingredients');

// furniture grab + place with overlap check
const ccx = Math.floor(ax / 24), ccz = Math.floor(az / 24);
const furn = wA.chunk(ccx, ccz).furn.find(f => !TYPES[f.type].fixed && f.type !== 'rug');
await walkTo(furn.x, furn.z, 1.0);
const rm = once(b, 'removed', id => id === furn.id); a.emit('grab', furn.id); await rm; wA.markRemoved(furn.id); ok('Alice grabbed ' + furn.type + ', Bob saw it removed');
await wait(150); if (statsA.carry?.type !== furn.type) fail('carry not set');
// overlap rejection: try to place onto a pillar
const pil = wA.chunk(ccx, ccz).furn.find(f => f.type === 'pillar');
await walkTo(pil.x + 2.5, pil.z + 2.5);
const bad = once(a, 'msg', m => /in the way|claimed|Step back|Too high/.test(m)); a.emit('place', { x: pil.x, z: pil.z, rot: 0 }); await bad; ok('placement overlapping a pillar rejected');
let spot = null;
for (let r = 2; r < 6 && !spot; r += 0.5) for (let k = 0; k < 16 && !spot; k++) { const x = Math.round((ax + Math.cos(k / 16 * 6.283) * r) * 2) / 2, z = Math.round((az + Math.sin(k / 16 * 6.283) * r) * 2) / 2; const bx = aabb({ type: furn.type, x, z, rot: 1 }); if (wA.canPlace(bx) && !(ax > bx.x0 - 0.5 && ax < bx.x1 + 0.5 && az > bx.z0 - 0.5 && az < bx.z1 + 0.5)) spot = { x, z }; }
const pl = once(b, 'placed'); a.emit('place', { ...spot, rot: 1 }); const po = await pl; ok(`Alice placed ${po.type} as ${po.id} at (${po.x}, ${po.z}), Bob saw it`);

// sleep in the nearest bed
let bed = null; bd = 1e9;
for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) for (const f of wA.chunk(ccx + i, ccz + j).furn) if (TYPES[f.type].bed) { const d = Math.hypot(f.x - ax, f.z - az); if (d < bd) { bd = d; bed = f; } }
if (bed) {
  const bx = bed.box; await walkTo(bx.x1 + 0.6, (bx.z0 + bx.z1) / 2);
  const sl = once(a, 'stats', s => s.sleeping); a.emit('sleep'); await sl; ok(`Alice sleeps in a ${bed.type}`);
  a.emit('wake'); await once(a, 'stats', s => !s.sleeping); ok('Alice woke up');
  const tpd = await once(a, 'teleport', () => true, 100).catch(() => null); // teleport from sleep already consumed
  ax = bed.x; az = bed.z;
}

const sw = once(b, 'swing', id => id === initA.id); a.emit('attack', { ry: 0 }); await sw; ok('attack swing broadcast');

// debug time → night
const ann = once(b, 'announce', x => x.kind === 'night');
await fetch(URL + '/debug/time?t=385'); await ann; ok('night announcement after debug time');
const h2 = await (await fetch(URL + '/health')).json(); if (!h2.night) fail('health not night'); ok('health reports night: ' + JSON.stringify(h2));
await wait(2500);
const sn = await once(a, 'state'); ok(`night state: ${sn.npcs.length} employees nearby (${[...new Set(sn.npcs.map(n => n.k))].join(',') || 'none yet'}), hostile=${sn.npcs.filter(n => n.h).length}`);
const brd = await once(a, 'board', () => true, 4000); ok('leaderboard broadcast: online=' + brd.online.map(p => p.name).join(','));

const left = once(a, 'left', id => id === initB.id); b.disconnect(); await left; ok('disconnect propagated');
a.disconnect();
// persistence on SIGTERM
const exited = new Promise(r => srv.on('exit', r)); srv.kill('SIGTERM'); await exited;
const saved = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'world.json'), 'utf8'));
if (!saved.placed.some(p => p.id === po.id) || !saved.removed.includes(furn.id)) fail('persistence missing data');
ok(`world persisted: ${saved.placed.length} placed, ${saved.removed.length} removed, board ${Object.keys(saved.board).length}`);
fs.rmSync(DATA_DIR, { recursive: true, force: true });
if (errOut.trim()) fail('server stderr: ' + errOut);
console.log('\nALL TESTS PASSED'); process.exit(0);
