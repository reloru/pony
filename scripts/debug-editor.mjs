// Dev helper: open a starter in the editor and report canvas geometry.
import { chromium } from 'playwright';
const [, , base, idea] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 430, height: 932 } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(base + '/#/k/critter', { waitUntil: 'networkidle' });
await p.click(`[data-testid="idea-${idea}"]`);
await p.waitForSelector('[data-testid="edit-canvas"]');
const info = await p.evaluate(() => {
  const s = document.querySelector('[data-testid="edit-canvas"]');
  const r = s.getBoundingClientRect();
  const wrap = s.parentElement.getBoundingClientRect();
  return { viewBox: s.getAttribute('viewBox'), w: r.width, h: r.height, wrapW: wrap.width, wrapH: wrap.height, children: s.childElementCount, docW: document.documentElement.scrollWidth };
});
console.log(JSON.stringify(info));
await b.close();
