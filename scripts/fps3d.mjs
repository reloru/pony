// Dev helper: measure 3D preview frame rate (software GL in headless Chromium is a pessimistic proxy).
// Usage: node scripts/fps3d.mjs <base> <kind> <ideaId> <w> <h> <dpr> <cpuThrottle> [out.png]
import { chromium } from 'playwright';
const [, , base, kind, idea, w, h, dpr, thr, out] = process.argv;
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr, hasTouch: true });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(`${base}/#/k/${kind}`, { waitUntil: 'networkidle' });
await p.click(`[data-testid="idea-${idea}"]`);
await p.waitForSelector('[data-testid="edit-canvas"]');
const side = await p.$('[data-testid="view3d"]');
if (!side) await p.click('[aria-label="3D view"]');
await p.waitForSelector('[data-testid="view3d"][data-state="ready"]', { timeout: 20000 });
await p.waitForTimeout(+(process.env.WARM ?? 0));
const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: +thr });
const info = await p.evaluate(async () => {
  const c = document.querySelector('[data-testid="view3d"] canvas');
  const times = [];
  let last = performance.now();
  await new Promise((res) => {
    const end = last + 3000;
    const f = (t) => { times.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else res(); };
    requestAnimationFrame(f);
  });
  times.sort((a, b) => a - b);
  return { canvas: c ? `${c.width}x${c.height}` : 'none', frames: times.length, medianMs: times[times.length >> 1].toFixed(1), p90Ms: times[Math.floor(times.length * 0.9)].toFixed(1) };
});
console.log(kind, idea, `${w}x${h}@${dpr}`, `cpu x${thr}`, JSON.stringify(info));
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
if (out) {
  // stop auto-spin by simulating a drag so the screenshot can settle
  const box = await (await p.$('[data-testid="view3d"] canvas')).boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down(); await p.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 10, { steps: 4 }); await p.mouse.up();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: out, timeout: 60000 });
}
await b.close();
