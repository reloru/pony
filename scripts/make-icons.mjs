// Renders the app icons (PNG) from SVG with Playwright's Chromium. Run: node scripts/make-icons.mjs
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const beads = ['#AE2B20', '#EB8635', '#F9E44D', '#69D459', '#60BFE6', '#326FB8', '#AD56A2', '#EA5584', '#F0AED2', '#6DC7C8'];

function art({ full, scale }) {
  const n = beads.length;
  const r = 128 * scale;
  const bead = beads
    .map((c, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      const x = 256 + r * Math.cos(a);
      const y = 262 + r * Math.sin(a);
      const deg = (a * 180) / Math.PI + 90;
      const w = 62 * scale, h = 92 * scale;
      return `<g transform="translate(${x} ${y}) rotate(${deg})">
        <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${24 * scale}" fill="${c}" stroke="rgba(0,0,0,.25)" stroke-width="${3 * scale}"/>
        <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${24 * scale}" fill="url(#sh)"/>
      </g>`;
    })
    .join('');
  const star = (cx, cy, R, rr) => {
    const p = [];
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? rr : R;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      p.push(`${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`);
    }
    return p.join(' ');
  };
  const bg = full
    ? `<rect width="512" height="512" fill="url(#bg)"/>`
    : `<rect x="16" y="16" width="480" height="480" rx="110" fill="url(#bg)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7ab6"/><stop offset="1" stop-color="#8b6bff"/></linearGradient>
    <linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset=".35" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>
  </defs>
  ${bg}
  ${bead}
  <polygon points="${star(256, 262, 62 * scale, 28 * scale)}" fill="#fff6b0" stroke="#e5b800" stroke-width="${5 * scale}" stroke-linejoin="round"/>
</svg>`;
}

const out = [
  ['public/icons/icon-192.png', 192, art({ full: false, scale: 1 }), true],
  ['public/icons/icon-512.png', 512, art({ full: false, scale: 1 }), true],
  ['public/icons/maskable-512.png', 512, art({ full: true, scale: 0.78 }), false],
  ['public/icons/apple-touch-icon.png', 180, art({ full: true, scale: 0.92 }), false],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, svg, transparent] of out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
  const buf = await page.screenshot({ omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(file, buf);
  console.log('wrote', file);
}
await browser.close();
