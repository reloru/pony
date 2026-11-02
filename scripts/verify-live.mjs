// Post-deploy check of the live site: commit, headers, no injected scripts, no off-site
// requests, no CSP violations, and a full offline reload including the 3D viewer.
// Usage: node scripts/verify-live.mjs <url> <expectedCommit>
import { chromium } from 'playwright';
const [, , url, commit] = process.argv;
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const b = await chromium.launch({ proxy, args: ['--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, hasTouch: true, isMobile: true });
const problems = [];
const origin = new URL(url).origin;
ctx.on('request', (r) => {
  const u = r.url();
  if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) problems.push('OFFSITE ' + u);
});
const p = await ctx.newPage();
p.on('pageerror', (e) => problems.push('PAGEERROR ' + e.message));
p.on('console', (m) => {
  if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED/.test(m.text())) problems.push('CONSOLE ' + m.text());
});
await p.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => console.error('CSP violation', e.violatedDirective, e.blockedURI)));

const v = await (await ctx.request.get(`${origin}/version.json?ts=${Date.now()}`)).json();
console.log('version.json', JSON.stringify(v));
if (commit && v.commit !== commit) problems.push(`live commit ${v.commit} != ${commit}`);
const home = await ctx.request.get(origin + '/');
const html = await home.text();
const h = home.headers();
console.log('CSP header present:', !!h['content-security-policy'], '| nosniff:', h['x-content-type-options']);
if (!h['content-security-policy']) problems.push('missing CSP header');
const scripts = [...html.matchAll(/<script[^>]*>/g)].map((m) => m[0]);
console.log('script tags in HTML:', scripts);
if (scripts.length !== 1 || /cloudflareinsights|beacon|analytics/i.test(html)) problems.push('unexpected script in HTML');
const asset = html.match(/\/assets\/index-[^"]+\.js/)[0];
console.log('asset cache-control:', (await ctx.request.get(origin + asset)).headers()['cache-control']);

await p.goto(url + '#/');
await p.getByText('Ready to use offline').waitFor({ timeout: 90000 });
console.log('precache complete');
await ctx.setOffline(true);
await p.reload();
await p.locator('[data-kind]').first().waitFor({ timeout: 20000 });
await p.click('[data-kind="critter"]');
await p.click('[data-testid="idea-k-penguin"]');
await p.click('[aria-label="3D view"]');
await p.waitForSelector('[data-testid="view3d"][data-state="drawn"]', { timeout: 200000 });
console.log('offline: 3D viewer loaded from cache and drew a frame');
await p.locator('.name-btn').hover({ timeout: 200000 });
await p.click('[data-testid="make-it"]');
await p.getByTestId('gather').waitFor();
await p.click('[data-testid="next"]');
console.log('offline: build mode works; step =', await p.getByTestId('step-card').getAttribute('data-step'));
await ctx.setOffline(false);
console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'LIVE CHECK PASSED');
await b.close();
process.exit(problems.length ? 1 : 0);
