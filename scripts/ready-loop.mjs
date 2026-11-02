// Dev helper: load the home page N times in fresh contexts and report how often it fails to render.
import { chromium } from 'playwright';
const [, , base, n = '12'] = process.argv;
const b = await chromium.launch();
let fails = 0;
for (let i = 0; i < +n; i++) {
  const ctx = await b.newContext({ viewport: { width: 800, height: 1280 } });
  const p = await ctx.newPage();
  const logs = [];
  p.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message));
  p.on('console', (m) => logs.push('CONSOLE ' + m.type() + ' ' + m.text()));
  p.on('requestfailed', (r) => logs.push('REQFAIL ' + r.url() + ' ' + r.failure()?.errorText));
  await p.goto(base + '/#/', { waitUntil: 'load' });
  const ok = await p.waitForSelector('[data-kind="critter"]', { timeout: 8000 }).then(() => true, () => false);
  if (!ok) {
    fails++;
    const state = await p.evaluate(() => ({ html: document.getElementById('app')?.innerHTML.slice(-200), sw: !!navigator.serviceWorker?.controller }));
    console.log('FAIL', i, JSON.stringify(state), logs.join(' | '));
  }
  await ctx.close();
}
console.log(`fails ${fails}/${n}`);
await b.close();
