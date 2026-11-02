// Dev helper: measure drag-painting cost on a maximum-size design with CPU throttling.
// Usage: node scripts/drag-probe.mjs <base> <w> <h> <cpuThrottle>
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [, , base, w, h, thr, starter] = process.argv;

const C = ['s-pink', 's-light-pink', 's-hot-pink', 's-white'];
const rows = Array.from({ length: 30 }, (_, i) => {
  const r = { beads: Array.from({ length: 11 }, (_, j) => C[(i + j) % C.length]) };
  if (i > 0 && i % 2 === 0) r.belly = true;
  if (i % 3 === 1) { r.legL = { stem: ['s-pink', 's-pink'], toes: ['s-white', 's-white', 's-white'] }; r.legR = { stem: ['s-pink', 's-pink'], toes: ['s-white', 's-white', 's-white'] }; }
  return r;
});
const big = { id: 'probe-big', name: 'Big Probe', createdAt: 1, updatedAt: 1, kind: 'critter', keyring: true, rows };
const file = join(tmpdir(), 'bead-probe-backup.json');
writeFileSync(file, JSON.stringify({ app: 'pony-bead-studio', schemaVersion: 1, exportedAt: new Date().toISOString(), designs: [big], owned: [], settings: { sound: false, mineOnly: false } }));

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, hasTouch: true });
const p = await ctx.newPage();
if (starter) {
  const [kind, id] = starter.split(':');
  await p.goto(`${base}/#/k/${kind}`);
  await p.click(`[data-testid="idea-${id}"]`);
} else {
  await p.goto(base + '/#/grownups');
  await p.getByTestId('restore-input').setInputFiles(file);
  await p.getByRole('status').waitFor();
  await p.goto(base + '/#/e/probe-big');
}
await p.waitForSelector('[data-testid="edit-canvas"]');
console.log('beads on canvas:', await p.locator('[data-testid="edit-canvas"] > g[opacity]').count());
await p.click('[data-color="s-black"]');
await p.evaluate(() => {
  window.__long = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ type: 'longtask', buffered: false });
  window.__ev = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__ev.push(e.duration))).observe({ type: 'event', durationThreshold: 16, buffered: false });
});
const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: +thr });
// drag along a zigzag over the middle rows
const box = await p.locator('[data-testid="edit-canvas"]').boundingBox();
const pts = [];
for (let k = 0; k < 40; k++) pts.push({ x: box.x + box.width * (0.35 + 0.3 * ((k % 10) / 9)), y: box.y + box.height * (0.25 + 0.5 * (k / 39)) });
if (process.env.PROFILE) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
const t0 = Date.now();
await p.mouse.move(pts[0].x, pts[0].y);
await p.mouse.down();
for (const q of pts) await p.mouse.move(q.x, q.y, { steps: 3 });
await p.mouse.up();
const dragMs = Date.now() - t0;
if (process.env.PROFILE) {
  const { profile } = await cdp.send('Profiler.stop');
  const self = new Map();
  const dt = profile.timeDeltas; const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  profile.samples.forEach((id, i) => { const n = byId.get(id); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) || 0) + (dt[i] || 0) / 1000); });
  console.log([...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => `${v.toFixed(0).padStart(6)} ms  ${k}`).join('\n'));
}
await p.waitForTimeout(1500);
const r = await p.evaluate(() => ({ long: window.__long, ev: window.__ev, black: document.querySelectorAll('[data-testid="edit-canvas"] rect[fill="#1A1A1A"]').length }));
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
const lt = r.long.sort((a, b) => b - a);
console.log(`${w}x${h} cpu x${thr}: drag of 120 pointer moves took ${dragMs} ms; beads painted ${r.black}; long tasks ${lt.length} (max ${lt[0]?.toFixed(0) ?? 0} ms, total ${lt.reduce((s, x) => s + x, 0).toFixed(0)} ms); slow input events (>16ms) ${r.ev.length}, max ${Math.max(0, ...r.ev).toFixed(0)} ms`);
await b.close();
