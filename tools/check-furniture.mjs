// Static sanity check for furniture part lists: floor contact, floating parts, footprint, scale.
import { TYPES, localParts } from '../shared/furniture.js';
function rotM(rx = 0, ry = 0, rz = 0) { // R = Ry * Rx * Rz  (matches the renderer: Euler order 'YXZ')
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(rx), Math.sin(rx), Math.cos(ry), Math.sin(ry), Math.cos(rz), Math.sin(rz)];
  const X = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]], Yr = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]], Z = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]];
  const mul = (a, b) => a.map((r, i) => [0, 1, 2].map(j => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j]));
  return mul(mul(Yr, X), Z);
}
export function partBox(p) {
  const round = p.s === 'c' || p.s === 's', R = rotM(p.rx, round && p.sx === p.sz && !p.rx && !p.rz ? 0 : p.ry, p.rz), h = [p.sx / 2, p.sy / 2, p.sz / 2], e = [0, 1, 2].map(i => Math.abs(R[i][0]) * h[0] + Math.abs(R[i][1]) * h[1] + Math.abs(R[i][2]) * h[2]);
  return { x0: p.x - e[0], x1: p.x + e[0], y0: p.y - e[1], y1: p.y + e[1], z0: p.z - e[2], z1: p.z + e[2] };
}
const touch = (a, b, t = 0.004) => a.x0 - t <= b.x1 && a.x1 + t >= b.x0 && a.y0 - t <= b.y1 && a.y1 + t >= b.y0 && a.z0 - t <= b.z1 && a.z1 + t >= b.z0;
let bad = 0;
for (const type of Object.keys(TYPES)) {
  const T = TYPES[type], issues = new Set();
  for (const c of [1, 7, 12345, 987654, 31337, 4242, 77777, 2 ** 20 + 5]) {
    const P = localParts(type, c), B = P.map(partBox);
    const minY = Math.min(...B.map(b => b.y0)), maxY = Math.max(...B.map(b => b.y1));
    if (Math.abs(minY) > 0.003) issues.add(`lowest point ${minY.toFixed(3)} (should be 0)`);
    B.forEach((b, i) => { if (b.y0 < -0.003) issues.add(`part ${i} below floor ${b.y0.toFixed(3)}`); });
    if (!['claim', 'sign'].includes(type)) B.forEach((b, i) => { const tol = Math.min(P[i].sx, P[i].sz) <= 0.03 ? 0.045 : 0.012; if (b.x0 < -T.w / 2 - tol || b.x1 > T.w / 2 + tol || b.z0 < -T.d / 2 - tol || b.z1 > T.d / 2 + tol) issues.add(`part ${i} (${P[i].s} ${P[i].sx}x${P[i].sy}x${P[i].sz}) outside footprint x[${b.x0.toFixed(2)},${b.x1.toFixed(2)}] z[${b.z0.toFixed(2)},${b.z1.toFixed(2)}]`); });
    if (maxY > Math.max(T.h, 0.05) + 0.6 && !T.fixed && !['tv', 'counter', 'bunkbed', 'sign', 'claim'].includes(type)) issues.add(`top ${maxY.toFixed(2)} far above h ${T.h}`);
    // connectivity from the floor
    const seen = new Set(), q = [];
    B.forEach((b, i) => { if (b.y0 < 0.004) { seen.add(i); q.push(i); } });
    while (q.length) { const i = q.pop(); B.forEach((b, j) => { if (!seen.has(j) && touch(B[i], b)) { seen.add(j); q.push(j); } }); }
    B.forEach((b, i) => { if (!seen.has(i)) issues.add(`FLOATING part ${i} ${P[i].s} ${P[i].sx}x${P[i].sy}x${P[i].sz} @ y ${b.y0.toFixed(3)}..${b.y1.toFixed(3)}`); });
  }
  if (issues.size) { bad++; console.log(`✗ ${type}:`); for (const s of [...issues].slice(0, 8)) console.log('   ' + s); }
  else console.log(`✓ ${type} (${localParts(type, 7).length} parts)`);
}
if (bad) { console.log(`\n${bad} types with issues`); process.exitCode = 1; } else console.log('\nall furniture OK');
