// Dev helper: screenshot chosen build steps of a starter. Usage: node scripts/steps.mjs <base> <kind> <idea> <outPrefix> <w> <h> <pages...>
import { chromium } from 'playwright';
const [, , base, kind, idea, out, w, h, ...pages] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, hasTouch: true });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(`${base}/#/k/${kind}`, { waitUntil: 'networkidle' });
await p.click(`[data-testid="idea-${idea}"]`);
await p.click('[data-testid="make-it"]');
let at = 0;
for (const pg of pages.map(Number)) {
  while (at < pg) { await p.click('[data-testid="next"]'); at++; }
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}-${pg}.png` });
}
await b.close();
