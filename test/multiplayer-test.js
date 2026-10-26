// Headless multiplayer check: starts the server, connects two clients, exchanges moves/chat, picks up an item.
import { spawn } from 'child_process';
import { io } from 'socket.io-client';
import { World } from '../shared/world.js';
const PORT = 3999, URL = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT, SEED: '1234' }, stdio: ['ignore', 'pipe', 'pipe'] });
let errOut = ''; srv.stderr.on('data', d => errOut += d);
await new Promise((res, rej) => { srv.stdout.on('data', d => { process.stdout.write('[server] ' + d); if (/server on/.test(d)) res(); }); setTimeout(() => rej(new Error('server start timeout')), 8000); });
const fail = (m) => { console.error('FAIL:', m); srv.kill(); process.exit(1); };
const ok = (m) => console.log('PASS:', m);
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const once = (s, ev, pred = () => true, ms = 4000) => new Promise((res, rej) => { const h = (d) => { if (pred(d)) { s.off(ev, h); res(d); } }; s.on(ev, h); setTimeout(() => rej(new Error('timeout waiting ' + ev)), ms); });

const html = await (await fetch(URL)).text(); if (!html.includes('3008')) fail('index not served'); ok('index.html served');
for (const p of ['/main.js', '/shared/world.js', '/vendor/three/build/three.module.js', '/socket.io/socket.io.js', '/health'])
  { const r = await fetch(URL + p); if (r.status !== 200) fail(p + ' ' + r.status); } ok('static assets + three + socket.io client served');

const a = io(URL, { transports: ['websocket'] }), b = io(URL, { transports: ['websocket'] });
const ia = once(a, 'init'), ib = once(b, 'init');
a.on('connect', () => a.emit('join', 'Alice')); b.on('connect', () => b.emit('join', 'Bob'));
const [initA, initB] = await Promise.all([ia, ib]);
if (initA.seed !== 1234 || initB.seed !== initA.seed) fail('seed mismatch'); ok('both clients joined with shared seed ' + initA.seed);
const wA = new World(initA.seed), wB = new World(initB.seed);
if (JSON.stringify(wA.chunk(3, -2).furn.map(f => [f.id, f.type, f.x, f.z])) !== JSON.stringify(wB.chunk(3, -2).furn.map(f => [f.id, f.type, f.x, f.z]))) fail('world not deterministic');
ok('deterministic world generation identical across clients');

// Alice moves; Bob should see it
let ax = initA.x, az = initA.z;
for (let i = 1; i <= 5; i++) { ax += 0.3; a.emit('move', { x: ax, y: 0, z: az, ry: 1.2, anim: 1, sprint: false, sel: 0 }); await wait(70); }
const st = await once(b, 'state', s => { const p = s.players.find(p => p.id === initA.id); return p && Math.abs(p.x - ax) < 0.01; });
const seen = st.players.find(p => p.id === initA.id);
ok(`Bob sees Alice "${seen.name}" at (${seen.x}, ${seen.z}) anim=${seen.anim}`);
if (st.players.length !== 2) fail('expected 2 players'); ok('state has 2 players, npcs=' + st.npcs.length + ', t=' + st.t.toFixed(1));

// Bob moves; Alice sees it
b.emit('move', { x: initB.x + 0.5, y: 0, z: initB.z, ry: 0, anim: 1, sel: 0 });
await once(a, 'state', s => { const p = s.players.find(p => p.id === initB.id); return p && Math.abs(p.x - (initB.x + 0.5)) < 0.01; });
ok('Alice sees Bob move');

// chat
const cp = once(b, 'chat', m => m.name === 'Alice'); a.emit('chat', 'hello <b>bob</b>'); const cm = await cp;
ok('chat delivered: ' + JSON.stringify(cm));

// anti-teleport
const tp = once(a, 'teleport'); a.emit('move', { x: ax + 500, y: 0, z: az, ry: 0, anim: 0, sel: 0 }); await tp; ok('server rejected teleport hack');

// item pickup: walk Alice to an item in her chunk (send small steps)
let item = null;
for (let r = 0; r < 3 && !item; r++) for (let i = -r; i <= r && !item; i++) for (let j = -r; j <= r && !item; j++) item = wA.chunk(Math.floor(ax / 24) + i, Math.floor(az / 24) + j).items[0];
const steps = Math.ceil(Math.hypot(item.x - ax, item.z - az) / 0.5);
const sx = (item.x - ax) / steps, sz = (item.z - az) / steps;
for (let i = 0; i < steps; i++) { ax += sx; az += sz; a.emit('move', { x: ax, y: 0, z: az, ry: 0, anim: 1, sel: 0 }); await wait(60); }
const pkB = once(b, 'picked', id => id === item.id); const stA = once(a, 'stats', s => s.inv.includes(item.type));
a.emit('pickup', item.id); await pkB; await stA; ok(`Alice picked up ${item.type} (${item.id}); Bob notified`);

// furniture grab + place
const furn = wA.chunk(Math.floor(ax / 24), Math.floor(az / 24)).furn.find(f => f.type !== 'pillar' && f.type !== 'sign');
if (furn) {
  const steps2 = Math.ceil(Math.hypot(furn.x - ax, furn.z - az) / 0.5);
  const dx = (furn.x - ax) / steps2, dz = (furn.z - az) / steps2;
  for (let i = 0; i < steps2 - 1; i++) { ax += dx; az += dz; a.emit('move', { x: ax, y: 0, z: az, ry: 0, anim: 1, sel: 0 }); await wait(60); }
  const rm = once(b, 'removed', id => id === furn.id); a.emit('grab', furn.id); await rm; ok('Alice grabbed ' + furn.type + ', Bob saw it removed');
  const pl = once(b, 'placed'); a.emit('place', { x: ax + 2, z: az, rot: 1 }); const po = await pl; ok('Alice placed ' + po.type + ' as ' + po.id + ', Bob saw it');
}
// combat (swing event)
const sw = once(b, 'swing', id => id === initA.id); a.emit('attack', { ry: 0 }); await sw; ok('attack swing broadcast');

const left = once(a, 'left', id => id === initB.id); b.disconnect(); await left; ok('disconnect propagated');
a.disconnect(); srv.kill();
if (errOut.trim()) fail('server stderr: ' + errOut);
console.log('\nALL TESTS PASSED'); process.exit(0);
