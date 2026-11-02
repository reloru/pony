# Bead Studio — notes for Claude

Offline PWA for a 10-year-old to design pony bead projects (bracelets, flat shapes, cuffs, 3D critters) and make them step by step. She uses it alone on an iPhone (Safari home-screen app) and an Amazon Fire HD (Chrome). See README.md for features and sources.

## Checks (run all before merging)

```sh
npm run typecheck
npm test               # Vitest: engine invariants, starters, backup parsing
npm run build          # also writes dist/sw.js (precache list) and dist/version.json
npm run e2e            # Playwright vs `vite preview` (build first); 4 viewports
npm run deploy:dry     # wrangler deploy --dry-run
```

Opening a 3D view in headless Chromium stalls for 20–80 s the first time, because WebGL runs on the software renderer (SwiftShader) with no GPU. The e2e helper `settle3d` waits for it. Don't shorten those timeouts.

## Deploy

Automatic: push to `main` → `.github/workflows/ci-deploy.yml` runs the checks, then deploys `dist/` with `cloudflare/wrangler-action` as the assets-only Worker `pony` (`wrangler.jsonc`), then verifies https://pony.reloru.workers.dev/version.json shows the commit. Merge PRs with squash.

## Rules specific to this repo

- **Instructions must match designs exactly.** Every design kind goes through `validate()` → `steps()` → `rebuild()` in `src/core`. If you change a technique, step type or editor operation, keep `tests/core.test.ts` passing: steps rebuild the design, the beads in the steps equal `beadCounts()`, and random edit sequences stay valid. Editor operations (`src/core/edit.ts`) must never produce a design that fails `validate()`. Refuse the change and show a toast instead.
- Ladder-weave rows are always centered and unbroken. Only end beads can be erased. Star beads are only allowed where the cord passes once (bracelet beads, leg toes).
- **Starter designs** (`src/core/designs.ts`) are original. Don't copy published patterns. After changing them, look at `#/sheet` (hidden contact sheet) in a screenshot.
- **No network calls after first load.** No CDNs, fonts or analytics; everything is bundled. The CSP in `public/_headers` enforces `connect-src 'self'`. The e2e tests fail on any off-site request.
- **Service worker**: generated from `sw/sw-template.js` by the Vite plugin in `vite.config.ts`. Cache matching uses `ignoreVary`, because module scripts and styles are CORS requests and servers answer with `Vary: Origin`. Precache `/`, never `/index.html` (Cloudflare redirects it). Keep the previous version's cache on activate.
- **Store hooks** (`useStore`, `useOffline`) re-check state after subscribing; keep that, or the app can render blank on load.
- **Kid UX**: tap targets ≥ 44 px (the e2e suite checks), icons plus one-word labels, no horizontal page scroll at 375–1280 px wide.
- **Palette**: exactly the colors in `src/core/colors.ts` (49 solid, 20 see-through, 10 pearl, 10 star). Don't add colors.
- Dev helpers in `scripts/` (`shot.mjs`, `tour.mjs`, `steps.mjs`, `fps3d.mjs`, `snap3d.mjs`, `csp-check.mjs`, `make-icons.mjs`) need `vite preview` (or `wrangler dev` for headers) running on the given base URL.
