// Dev helper: screenshot the 3D preview once the shaders have compiled and auto-spin has stopped.
// Usage: node scripts/snap3d.mjs <base> <kind> <ideaId> <w> <h> <out.png>
import { chromium } from 'playwright';
const [, , base, kind, idea, w, h, out] = process.argv;
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: true });
await p.goto(`${base}/#/k/${kind}`, { waitUntil: 'networkidle' });
await p.click(`[data-testid="idea-${idea}"]`);
await p.waitForSelector('[data-testid="edit-canvas"]');
if (!(await p.$('[data-testid="view3d"]'))) await p.click('[aria-label="3D view"]');
await p.waitForSelector('[data-testid="view3d"][data-state="ready"]', { timeout: 20000 });
const t0 = Date.now();
await p.waitForTimeout(+(process.env.WARM ?? 45000));
await p.screenshot({ path: out, timeout: 90000 });
console.log('shot after', Date.now() - t0, 'ms');
await b.close();
