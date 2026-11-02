// Dev helper: print errors, failed requests and the start of the rendered DOM for a URL.
import { chromium } from 'playwright';
const url = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
p.on('console', (m) => console.log('CONSOLE', m.type(), m.text()));
p.on('requestfailed', (r) => console.log('REQFAIL', r.url(), r.failure()?.errorText));
p.on('response', (r) => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); });
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
const html = await p.content(); const i = html.indexOf("</defs></svg>"); console.log(html.slice(i, i + 1200));
await b.close();
