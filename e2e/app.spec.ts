import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { Socket } from 'node:net';
import { extname, join, normalize } from 'node:path';

const BASE = 'http://localhost:4173';

/** Fail the test if anything is requested from another host. */
function guardNetwork(context: BrowserContext) {
  const offsite: string[] = [];
  context.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) offsite.push(u);
  });
  return offsite;
}

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

async function noHorizontalScroll(page: Page) {
  const { sw, vw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth }));
  expect(sw, 'page should not scroll sideways').toBeLessThanOrEqual(vw + 1);
}

/** Buttons a child taps should be at least 44 CSS px in both directions (Apple HIG minimum). */
async function bigTargets(page: Page, selector: string) {
  const small = await page.$$eval(selector, (els) =>
    els
      .map((e) => {
        const r = e.getBoundingClientRect();
        return { w: r.width, h: r.height, label: e.getAttribute('aria-label') ?? e.textContent?.trim().slice(0, 20) };
      })
      .filter((r) => r.w > 0 && (r.w < 44 || r.h < 44)),
  );
  expect(small, `small tap targets for ${selector}`).toEqual([]);
}

/**
 * If a 3D preview is on screen, wait until the GPU has really drawn it. Headless browsers in CI
 * render WebGL in software and stall for a while the first time a WebGL canvas is shown (a real
 * tablet GPU does not), so also wait until the page takes input again.
 */
async function settle3d(page: Page) {
  const v = page.getByTestId('view3d');
  if (!(await v.count())) return;
  await expect(v).toHaveAttribute('data-state', /drawn|fallback/, { timeout: 150_000 });
  await page.locator('.topbar h1, .topbar .name-btn').first().hover({ timeout: 150_000 });
}

async function openStarter(page: Page, kind: string, id: string) {
  await page.goto('/#/');
  await page.click(`[data-kind="${kind}"]`);
  await page.click(`[data-testid="idea-${id}"]`);
  await expect(page.getByTestId('edit-canvas')).toBeVisible();
  await settle3d(page);
}

test('home and galleries fit the screen with big buttons', async ({ page, context }) => {
  const offsite = guardNetwork(context);
  const errors = trackErrors(page);
  await page.goto('/#/');
  await expect(page.locator('[data-kind]')).toHaveCount(6);
  await noHorizontalScroll(page);
  await bigTargets(page, '.kind-tile, .wide-tile, .btn');
  for (const kind of ['bracelet', 'flat', 'cuff', 'peyote', 'xbase', 'critter']) {
    await page.goto(`/#/k/${kind}`);
    await expect(page.locator('[data-testid^="idea-"]').first()).toBeVisible();
    await noHorizontalScroll(page);
    await bigTargets(page, '.card, .btn');
  }
  expect(offsite).toEqual([]);
  expect(errors).toEqual([]);
});

test('make a shape: edit it, then follow every step; the steps use exactly the listed beads', async ({ page, context }) => {
  const offsite = guardNetwork(context);
  const errors = trackErrors(page);
  await openStarter(page, 'flat', 'f-kitty');
  await noHorizontalScroll(page);
  await bigTargets(page, '.editor .btn, .tool, .swatch');

  // Paint the first bead of row 1 with Hot Pink.
  await page.click('[data-color="s-hot-pink"]');
  const canvas = page.getByTestId('edit-canvas');
  const box = (await canvas.boundingBox())!;
  const firstBead = page.locator('[data-testid="edit-canvas"] g[transform^="translate(-12.00 0.00)"]').first();
  await expect(firstBead).toHaveCount(1);
  const bb = (await firstBead.boundingBox())!;
  await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await expect(page.locator('[data-testid="edit-canvas"] rect[fill="#EA5584"]').first()).toBeVisible();
  expect(box.width).toBeGreaterThan(200);

  // Undo then redo
  await page.click('[aria-label="Undo"]');
  await expect(page.locator('[data-testid="edit-canvas"] rect[fill="#EA5584"]')).toHaveCount(0);
  await page.click('[aria-label="Redo"]');
  await expect(page.locator('[data-testid="edit-canvas"] rect[fill="#EA5584"]').first()).toBeVisible();

  // Build mode: read the totals, then add up every bead shown in the steps.
  await page.click('[data-testid="make-it"]');
  await expect(page.getByTestId('gather')).toBeVisible();
  await noHorizontalScroll(page);
  const listed: Record<string, number> = {};
  for (const el of await page.locator('[data-testid="gather"] .gather-item').all()) {
    listed[(await el.getAttribute('data-color'))!] = Number(await el.getAttribute('data-count'));
  }
  expect(listed['s-hot-pink']).toBeGreaterThanOrEqual(1);
  const strung: Record<string, number> = {};
  let guard = 0;
  while ((await page.getByTestId('step-card').getAttribute('data-step')) !== 'done' && guard++ < 100) {
    await page.click('[data-testid="next"]');
    await noHorizontalScroll(page);
    for (const chip of await page.locator('[data-testid="bead-seq"] .chip').all()) {
      const c = (await chip.getAttribute('data-color'))!;
      strung[c] = (strung[c] ?? 0) + Number(await chip.getAttribute('data-count'));
    }
  }
  await expect(page.getByText('You made it!')).toBeVisible();
  expect(strung).toEqual(listed);

  await page.goto('/#/mine');
  await expect(page.locator('[data-testid="my-design"]')).toHaveCount(1);
  await expect(page.locator('.made-badge')).toHaveCount(1);
  expect(offsite).toEqual([]);
  expect(errors).toEqual([]);
});

test('designs survive a reload (saved on the device)', async ({ page }) => {
  await openStarter(page, 'bracelet', 'b-mermaid');
  await page.click('[data-tool="pattern"]');
  await page.locator('.sheet .btn').filter({ hasText: 'Fill bracelet' }).waitFor();
  await page.locator('.sheet [aria-label="Color B"]').click();
  await page.locator('.sheet .swatch[aria-label="Solid Black"]').click();
  await page.locator('.sheet .btn').filter({ hasText: 'Fill bracelet' }).click();
  await expect(page.locator('[data-testid="edit-canvas"] rect[fill="#1A1A1A"]').first()).toBeVisible();
  await page.waitForTimeout(700); // autosave debounce
  await page.reload();
  await expect(page.locator('[data-testid="edit-canvas"] rect[fill="#1A1A1A"]').first()).toBeVisible();
});

test('shape rules: grow a row, only end beads come off, stars only on legs', async ({ page }) => {
  await openStarter(page, 'flat', 'f-mushroom');
  const beads = page.locator('[data-testid="edit-canvas"] > g[transform][opacity]');
  const before = await beads.count();
  await page.locator('[data-ghost="0L"]').click();
  await expect(beads).toHaveCount(before + 1);
  // Erase a middle bead: refused
  await page.click('[data-tool="erase"]');
  const mid = page.locator('[data-testid="edit-canvas"] g[transform^="translate(-3.00 36.00)"]').first();
  await mid.click();
  await expect(page.getByRole('status')).toContainText('end beads');
  await expect(beads).toHaveCount(before + 1);
  // Erase an end bead: works
  await page.locator('[data-testid="edit-canvas"] g[transform^="translate(-21.00 36.00)"]').first().click();
  await expect(beads).toHaveCount(before);
  // A star can't go into a row
  // The row is now 7 wide and re-centered, so its middle bead sits at x = 0.
  await page.click('[data-tool="paint"]');
  await page.click('[data-color="star-red"]');
  await page.locator('[data-testid="edit-canvas"] g[transform^="translate(0.00 36.00)"]').first().click();
  await expect(page.getByRole('status')).toContainText('Stars go on leg tips');
});

test('critter: belly toggle, legs and the 3D preview', async ({ page, context }) => {
  const offsite = guardNetwork(context);
  const errors = trackErrors(page);
  await openStarter(page, 'critter', 'k-penguin');
  await page.locator('[data-belly="2"]').click();
  await expect(page.locator('[data-belly="2"] text')).toHaveText('belly');
  await page.click('[data-tool="leg"]');
  await page.locator('[data-legzone="6L"]').click();
  await expect(page.locator('[data-legzone="6L"]')).toHaveCount(0);
  const toggle = page.locator('[aria-label="3D view"]');
  if (await toggle.count()) await toggle.click();
  await settle3d(page);
  // Chromium must really draw it. Linux WebKit in CI may lack WebGL; then the flat fallback must show.
  if (test.info().project.name.includes('webkit')) await expect(page.getByTestId('view3d')).toHaveAttribute('data-state', /drawn|fallback/);
  else {
    await expect(page.getByTestId('view3d')).toHaveAttribute('data-state', 'drawn');
    await expect(page.locator('[data-testid="view3d"] canvas')).toHaveCount(1);
  }
  expect(offsite).toEqual([]);
  expect(errors).toEqual([]);
});

test('cuff size controls and "my beads" recolor', async ({ page }) => {
  await page.goto('/#/beads');
  for (const id of ['s-white', 's-black', 's-hot-pink']) await page.click(`[data-color="${id}"]`);
  await expect(page.locator('.own.on')).toHaveCount(3);
  await openStarter(page, 'cuff', 'c-rainbow');
  await page.getByTestId('size-width').getByLabel('More wide').click();
  await expect(page.getByTestId('size-width')).toContainText('6');
  await page.click('[data-tool="mybeads"]');
  const fills = await page.$$eval('[data-testid="edit-canvas"] g[opacity] > rect:first-child', (rs) => [...new Set(rs.map((r) => r.getAttribute('fill')))]);
  expect(fills.length).toBeGreaterThan(0);
  for (const f of fills) expect(['#1A1A1A', '#DDDDDD', '#EA5584']).toContain(f);
});

test('backup download and restore into a fresh device', async ({ page, browser }, info) => {
  await openStarter(page, 'critter', 'k-owl');
  await page.click('[data-testid="make-it"]'); // a starter copy is saved once she makes (or edits) it
  await expect(page.getByTestId('gather')).toBeVisible();
  await page.goto('/#/beads');
  await page.click('[data-color="p-pink"]');
  await page.waitForTimeout(600);
  await page.goto('/#/grownups');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-backup').click()]);
  const path = info.outputPath('backup.json');
  await dl.saveAs(path);
  const json = JSON.parse(readFileSync(path, 'utf8'));
  expect(json.app).toBe('pony-bead-studio');
  expect(json.designs).toHaveLength(1);
  expect(json.owned).toContain('p-pink');

  const fresh = await browser.newContext({ baseURL: BASE, viewport: page.viewportSize()! });
  const p2 = await fresh.newPage();
  await p2.goto('/#/grownups');
  await p2.getByTestId('restore-input').setInputFiles(path);
  await expect(p2.getByRole('status')).toContainText('1 new');
  await p2.goto('/#/mine');
  await expect(p2.locator('[data-testid="my-design"]')).toHaveCount(1);
  await p2.goto('/#/beads');
  await expect(p2.locator('[data-color="p-pink"]')).toHaveAttribute('aria-pressed', 'true');
  await fresh.close();
});

test('works fully offline after the first visit', async ({ page, context }) => {
  // In Playwright's Linux WebKit, reloading under context.setOffline() fails with "WebKit encountered
  // an internal error" before the service worker answers. WebKit's offline behaviour is covered by
  // "keeps working after the server is gone entirely", which switches the real server off instead.
  test.skip(test.info().project.name.includes('webkit'), 'Playwright WebKit offline emulation; see the server-gone test');
  const offsite = guardNetwork(context);
  const errors = trackErrors(page);
  await page.goto('/#/');
  await expect(page.getByText('Ready to use offline')).toBeVisible({ timeout: 45_000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('[data-kind]')).toHaveCount(6);
  // every screen, including the separately loaded 3D viewer, must load from the device
  await page.click('[data-kind="critter"]');
  await page.click('[data-testid="idea-k-ladybug"]');
  await expect(page.getByTestId('edit-canvas')).toBeVisible();
  const toggle = page.locator('[aria-label="3D view"]');
  if (await toggle.count()) await toggle.click();
  await settle3d(page);
  await expect(page.getByTestId('view3d')).toHaveAttribute('data-state', test.info().project.name.includes('webkit') ? /drawn|fallback/ : 'drawn');
  await page.click('[data-testid="make-it"]');
  await expect(page.getByTestId('gather')).toBeVisible();
  await page.click('[data-testid="next"]');
  await expect(page.getByTestId('step-card')).toHaveAttribute('data-step', 'cut');
  await page.goto('/#/beads');
  await expect(page.locator('.own')).toHaveCount(89);
  await page.goto('/#/grownups');
  await expect(page.getByText('works with no internet')).toBeVisible();
  // fonts and icons came from the cache too
  const fontsOk = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('600 20px Fredoka');
  });
  expect(fontsOk).toBe(true);
  await context.setOffline(false);
  expect(offsite).toEqual([]);
  expect(errors.filter((e) => !/ERR_INTERNET_DISCONNECTED/.test(e))).toEqual([]);
});

test('manifest and icons are installable', async ({ request }) => {
  const m = await (await request.get('/manifest.webmanifest')).json();
  expect(m.display).toBe('standalone');
  expect(m.start_url).toBe('/');
  const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  expect(m.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);
  for (const i of [...m.icons, { src: '/icons/apple-touch-icon.png' }]) {
    const r = await request.get(i.src);
    expect(r.status()).toBe(200);
    expect(r.headers()['content-type']).toContain('image/png');
  }
  const sw = await (await request.get('/sw.js')).text();
  expect(sw).toContain('"/assets/');
  expect(sw).not.toContain('__PRECACHE__');
});


/** A throwaway static server for dist/, so a test can switch the whole server off. */
function startStaticServer(port: number): Promise<{ stop: () => Promise<void> }> {
  const root = join(process.cwd(), 'dist');
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
  };
  const sockets = new Set<Socket>();
  const server: Server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
    const file = join(root, path === '/' ? 'index.html' : path);
    if (!file.startsWith(root) || !existsSync(file) || path.includes('..')) {
      res.writeHead(404).end();
      return;
    }
    // Like many servers (and vite preview), vary on Origin: the service worker must cope.
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache', Vary: 'Origin' });
    res.end(readFileSync(file));
  });
  server.on('connection', (s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });
  return new Promise((resolve) =>
    server.listen(port, '127.0.0.1', () =>
      resolve({
        stop: () =>
          new Promise<void>((done) => {
            server.close(() => done());
            sockets.forEach((s) => s.destroy());
          }),
      }),
    ),
  );
}

test('keeps working after the server is gone entirely', async ({ browser }, info) => {
  const port = 4300 + info.workerIndex * 10 + (info.retry % 10);
  const srv = await startStaticServer(port);
  const base = `http://127.0.0.1:${port}`;
  const ctx = await browser.newContext({ viewport: info.project.use.viewport ?? undefined });
  const page = await ctx.newPage();
  const errors = trackErrors(page);
  try {
    await page.goto(base + '/#/');
    await expect(page.getByText('Ready to use offline')).toBeVisible({ timeout: 60_000 });
    await srv.stop();
    // The server is closed: anything that loads now came from the service worker's cache.
    await page.reload();
    await expect(page.locator('[data-kind]')).toHaveCount(6);
    await page.click('[data-kind="flat"]');
    await page.click('[data-testid="idea-f-heart"]');
    await expect(page.getByTestId('edit-canvas')).toBeVisible();
    await page.click('[data-testid="make-it"]');
    await expect(page.getByTestId('gather')).toBeVisible();
    await page.goto(base + '/#/beads');
    await expect(page.locator('.own')).toHaveCount(89);
    const fontsOk = await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check('600 20px Fredoka');
    });
    expect(fontsOk).toBe(true);
    expect(errors.filter((e) => !/Failed to load resource|ERR_CONNECTION_REFUSED|Could not connect/i.test(e))).toEqual([]);
  } finally {
    await srv.stop().catch(() => undefined);
    await ctx.close();
  }
});


/** Read the bead list, then add up every bead shown in the steps; they must match exactly. */
async function followAllSteps(page: Page) {
  await expect(page.getByTestId('gather')).toBeVisible();
  const listed: Record<string, number> = {};
  for (const el of await page.locator('[data-testid="gather"] .gather-item').all()) {
    listed[(await el.getAttribute('data-color'))!] = Number(await el.getAttribute('data-count'));
  }
  const strung: Record<string, number> = {};
  const kinds = new Set<string>();
  let guard = 0;
  while ((await page.getByTestId('step-card').getAttribute('data-step')) !== 'done' && guard++ < 200) {
    await page.click('[data-testid="next"]');
    kinds.add((await page.getByTestId('step-card').getAttribute('data-step'))!);
    for (const chip of await page.locator('[data-testid="bead-seq"] .chip').all()) {
      const c = (await chip.getAttribute('data-color'))!;
      strung[c] = (strung[c] ?? 0) + Number(await chip.getAttribute('data-count'));
    }
  }
  await expect(page.getByText('You made it!')).toBeVisible();
  expect(strung).toEqual(listed);
  return kinds;
}

test('peyote cuff: ring, rounds with a marked first bead, step-ups, and exact bead totals', async ({ page, context }) => {
  const offsite = guardNetwork(context);
  const errors = trackErrors(page);
  await openStarter(page, 'peyote', 'y-hearts');
  await noHorizontalScroll(page);
  await bigTargets(page, '.editor .btn, .tool, .swatch');
  await page.click('[data-testid="make-it"]');
  const kinds = await followAllSteps(page);
  expect([...kinds]).toEqual(expect.arrayContaining(['cut', 'ring', 'tiering', 'round', 'stepup', 'tie', 'done']));
  expect(offsite).toEqual([]);
  expect(errors).toEqual([]);
});

test('peyote editor: size controls, mirror across a column, and the round-1 marker', async ({ page }) => {
  await openStarter(page, 'peyote', 'y-rainbow');
  await page.getByTestId('size-around').getByLabel('More around').click();
  await expect(page.getByTestId('size-around')).toContainText('30');
  await page.getByTestId('size-rows').getByLabel('Less rows').click();
  await expect(page.getByTestId('size-rows')).toContainText('11');
  await page.click('[data-tool="mirror"]');
  await expect(page.locator('[data-mirror-axis]')).toHaveCount(1);
  await page.click('[data-color="s-black"]');
  const beads = page.locator('[data-testid="edit-canvas"] > g[opacity]');
  await beads.nth(40).click();
  await expect(page.locator('[data-testid="edit-canvas"] rect[fill="#1A1A1A"]')).toHaveCount(2);
  await page.click('[data-testid="make-it"]');
  // gather, cut, ring chunks (30 beads -> 5), tie ring, then round 1
  for (let i = 0; i < 8; i++) await page.click('[data-testid="next"]');
  await expect(page.getByTestId('step-card')).toHaveAttribute('data-step', 'round');
  await expect(page.locator('[data-start-marker]')).toHaveCount(1);
});

test('X-base cuff: ring of sets, rounds of groups, knots and step-ups, exact bead totals', async ({ page, context }) => {
  const offsite = guardNetwork(context);
  const errors = trackErrors(page);
  await openStarter(page, 'xbase', 'x-rainbow');
  await noHorizontalScroll(page);
  await bigTargets(page, '.editor .btn, .tool, .swatch');
  await page.click('[data-testid="make-it"]');
  const kinds = await followAllSteps(page);
  expect([...kinds]).toEqual(expect.arrayContaining(['cut', 'xring', 'xtie', 'xround', 'xup', 'tie', 'done']));
  expect(offsite).toEqual([]);
  expect(errors).toEqual([]);
});

test('X-base editor: size controls, mirror, and the marked bead 1 in rounds', async ({ page }) => {
  await openStarter(page, 'xbase', 'x-ocean');
  await page.click('[data-tool="mirror"]');
  await expect(page.locator('[data-mirror-axis]')).toHaveCount(1);
  await page.click('[data-color="s-black"]');
  const beads = page.locator('[data-testid="edit-canvas"] > g[opacity]');
  await beads.nth(7).click();
  await expect(page.locator('[data-testid="edit-canvas"] rect[fill="#1A1A1A"]')).toHaveCount(2);
  await page.getByTestId('size-units').getByLabel('More sets').click();
  await expect(page.getByTestId('size-units')).toContainText('33');
  await page.getByTestId('size-high').getByLabel("More X's high").click();
  await expect(page.getByTestId('size-high')).toContainText('2');
  await page.getByTestId('size-high').getByLabel("More X's high").click();
  await page.getByTestId('size-high').getByLabel("More X's high").click();
  await page.getByTestId('size-high').getByLabel("More X's high").click();
  await expect(page.getByTestId('size-high')).toContainText('4');
  await page.getByTestId('size-units').getByLabel('Less sets').click();
  await page.getByTestId('size-units').getByLabel('Less sets').click();
  await expect(page.getByTestId('size-units')).toContainText('27');
  await page.click('[data-testid="make-it"]');
  const card = page.getByTestId('step-card');
  let guard = 0;
  while ((await card.getAttribute('data-step')) !== 'xround' && guard++ < 20) await page.click('[data-testid="next"]');
  await expect(page.locator('[data-start-marker]')).toHaveCount(1);
  await expect(page.locator('[data-testid="bead-seq"] .group-box')).toHaveCount(3);
  await expect(page.locator('[data-testid="bead-seq"] .through')).toHaveCount(3);
  await expect(card).toContainText('connector right after the knot');
  while ((await card.getAttribute('data-step')) !== 'xup' && guard++ < 40) await page.click('[data-testid="next"]');
  await expect(card).toContainText('Knot and step up');
  await expect(page.locator('[data-start-marker]')).toHaveCount(1);
  await page.click('[data-testid="next"]');
  await expect(card).toHaveAttribute('data-step', 'xround');
  await expect(card).toContainText('marked 1');
});

test('name keychain: type a name, pick colors, make it', async ({ page }) => {
  await page.goto('/#/k/flat');
  await page.getByTestId('name-keychain').click();
  await page.getByTestId('name-input').fill('zoe!');
  await expect(page.getByTestId('name-input')).toHaveValue('ZOE');
  await page.locator('.sheet [aria-label="Add a heart"]').click();
  await expect(page.getByTestId('name-input')).toHaveValue('ZOE♥');
  await page.locator('.sheet [aria-label="Letters s-purple"]').click();
  await expect(page.getByTestId('name-preview')).toBeVisible();
  await page.getByTestId('name-make').click();
  await expect(page.getByTestId('edit-canvas')).toBeVisible();
  await expect(page.locator('.name-btn')).toHaveText('ZOE♥');
  await page.click('[data-testid="make-it"]');
  const kinds = await followAllSteps(page);
  expect(kinds.has('keyring')).toBe(true);
});

test('Chrome install prompt: not suppressed, and the Install buttons open it', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.locator('[data-kind]')).toHaveCount(6);
  await expect(page.getByTestId('install')).toHaveCount(0);
  // Simulate Chrome deciding the app is installable (what Chrome on the Fire tablet does).
  const prevented = await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    (window as unknown as { __prompted: number }).__prompted = 0;
    e.prompt = async () => {
      (window as unknown as { __prompted: number }).__prompted++;
    };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
    return e.defaultPrevented;
  });
  expect(prevented, "the app must let Chrome show its own install prompt").toBe(false);
  await page.goto('/#/grownups');
  await expect(page.getByTestId('install-grownups')).toBeVisible();
  await page.goto('/#/');
  const btn = page.getByTestId('install');
  await expect(btn).toBeVisible();
  await noHorizontalScroll(page);
  await btn.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __prompted: number }).__prompted)).toBe(1);
  // accepted: the button goes away
  await expect(btn).toHaveCount(0);
});
