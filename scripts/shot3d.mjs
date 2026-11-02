// Dev helper: open a starter in the editor at a viewport and screenshot, waiting for 3D.
// Usage: node scripts/shot3d.mjs <base> <kind> <ideaId> <out.png> <w> <h> [open3d 1|0]
import { chromium } from 'playwright';
const [, , base, kind, idea, out, w, h, open3d] = process.argv;
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1.5, hasTouch: true });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
await p.goto(`${base}/#/k/${kind}`, { waitUntil: 'networkidle' });
await p.click(`[data-testid="idea-${idea}"]`);
await p.waitForSelector('[data-testid="edit-canvas"]');
if (open3d === '1') await p.click('[aria-label="3D view"]');
await p.waitForSelector('[data-testid="view3d"][data-state="ready"], [data-testid="view3d"][data-state="fallback"]', { timeout: 15000 });
await p.waitForTimeout(1500);
console.log('3D state:', await p.getAttribute('[data-testid="view3d"]', 'data-state'));
await p.screenshot({ path: out });
await b.close();
