// Dev helper: ask Chrome itself whether the site is installable (no errors = Chrome will offer install).
// Usage: node scripts/installable.mjs <url>
import { chromium } from 'playwright';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const url = process.argv[2];
const proxy = url.startsWith('https:') && process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'inst-')), { proxy });
const p = ctx.pages()[0] ?? (await ctx.newPage());
await p.goto(url, { waitUntil: 'networkidle' });
await p.getByText('Ready to use offline').waitFor({ timeout: 60000 }).catch(() => {});
const cdp = await ctx.newCDPSession(p);
const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
const { url: manifestUrl, errors } = await cdp.send('Page.getAppManifest');
console.log('manifest:', manifestUrl, '| manifest errors:', JSON.stringify(errors));
console.log('installability errors:', JSON.stringify(installabilityErrors));
await ctx.close();
