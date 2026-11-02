# Bead Studio

An offline app for designing pony bead projects and then making them for real, step by step. Built for a 10-year-old using it alone on an iPhone or an Amazon Fire HD tablet: big buttons, bright pictures, very little reading.

**Live:** https://pony.reloru.workers.dev

## What she can make

| Kind | How it's built | Cord |
| --- | --- | --- |
| **Bracelets** | One strand of beads, knotted into a ring. | about 1 mm stretchy cord |
| **Shapes** (keychains, flat pictures) | Two-cord ladder weave: string a row on the left cord and push the right cord back through it the other way; each row sits under the last, centered. Legs, ears, arms and tails hang off a cord between rows. | plastic lace (gimp / boondoggle) |
| **Cuffs** | The same ladder weave as one long band of equal-width rows, closed into a ring. | about 1 mm stretchy cord |
| **Critters** (3D) | Ladder weave with two layers: a “belly” row is tucked under the row before it, so the body puffs up. | plastic lace |

There are 30 original starter designs (8 bracelets, 10 shapes, 6 cuffs, 6 critters). She can start from one and change it, or start fresh.

**Editing:** paint (tap or drag), fill, swap one color for another everywhere, mirror mode, undo/redo, “Surprise” recoloring, and “My beads” (swaps every color she doesn't own for the closest one she does). Shapes and critters can grow or lose beads at the row ends, add rows, and add legs. Critter rows can be switched between top and belly. Bracelets have a pattern maker (AB, AAB, ABC…) and a size control. Cuffs have width and length controls. Critters and cuffs show a 3D preview you can spin.

**Making it:** first a list of every bead by color with counts (colors she hasn't marked as owned are highlighted), the cord length and type, and a key ring if used. Then one step per screen: the beads for that step in order, a picture of exactly what to do with the cords, and a map of the design with the current part lit up. Progress is saved, and there's a read-aloud button when the device has an offline voice.

**My Beads:** tap the colors she owns from the full list: 49 solid, 20 see-through, 10 pearl and 10 star colors.

## How the instructions are kept exact

`src/core` is a pure TypeScript engine with no UI:

- `validate()` accepts only buildable designs. Rows have no gaps, widths and counts are within limits, belly rows only on critters (never row 1), and star beads only where the cord passes through once.
- `steps()` turns a design into ordered steps. `beadCounts()` totals the beads, and `cordFor()` estimates the cord.
- `rebuild()` follows the steps the way a person would (cords swap sides each row, legs right after their row, left before right, close the band before tying) and returns what ends up on the cord.

The tests (`tests/core.test.ts`) check that for **every starter and 400 random designs**, following the steps rebuilds exactly the design, and the beads used across all steps equal the bead list. They also apply 300 random edit sequences and check that no editor operation can produce an unbuildable design. The end-to-end tests additionally read the bead totals and every step's beads from the screen and compare them.

### Sources, and what is assumed

- **Bead size:** 9 mm across, 6 mm along the hole, 4 mm hole (given; matches [BeadTin's listing](https://www.beadtin.com/products/crystal-blue-transparent-9mm-barrel-pony-beads) of 6 mm high by 9 mm wide).
- **Ladder weave, row placement, key-ring start (lark's head), legs (go back through only the beads nearest the body):** published kids' patterns: [Dorr Library turtle](https://www.dorrlibrary.michlibrary.org/site-assets/files/bead-pet-turtle.pdf/@@download/file/Bead%20Pet%20Turtle.pdf), [Homan at Home turtle](https://homanathome.com/2026/01/pony-bead-turtle/), [Brooklyn Bridge Park lizard](https://www.brooklynbridgepark.org/wp-content/uploads/2020/10/Beaded-Lizard-Craft.pdf), [Craft Project Ideas bunny](https://craftprojectideas.com/bunny-bead-pet/).
- **Two-layer (belly) critters:** documented for seed beads on fishing line ([beadsis crocodile](https://beadsis.weebly.com/tutorial.html): rows in pairs, the second of each pair forms the belly). Using it with pony beads and plastic lace is an **extrapolation**. Stiff lace and pulling each row tight help it hold its shape.
- **Cuff as a closed ladder band:** this is the same ladder weave, closed by pushing one cord through Row 1 and tying. The closing method is **this app's own**, worked out from the ladder weave rather than taken from a published cuff tutorial.
- **Cord lengths** are an estimate from a model of the cord path, padded and rounded up. They come out longer than the published patterns above (60 in for a turtle-sized piece, about 4 ft for the lizard).
- **Star beads:** their size and hole aren't known, so they're offered only on bracelets and as leg tips, where the cord passes through once.
- **3D preview:** an approximation. Real beadwork shifts with cord tension.

## Install on a device

- **iPhone:** open the live link in Safari → Share → **Add to Home Screen**. Open it once from the icon while online and wait for “✓ Ready to use offline” on the home screen. A home-screen app keeps its own saved data, separate from Safari.
- **Fire HD (Chrome):** open the link in Chrome → ⋮ menu → **Add to Home screen** / **Install app**. The app doesn't depend on Chrome's automatic install prompt.

The **Grown-ups** screen (gear icon) has backup, restore, offline status and these instructions.

## Privacy and offline

- No accounts, ads, analytics or tracking. Everything is stored on the device in IndexedDB.
- A service worker (`sw/sw-template.js`, filled in at build time with the exact list of built files) caches the whole app on first load, including fonts, icons and the 3D viewer.
- After the first load the app makes no network requests of its own. A Content-Security-Policy (`public/_headers`) restricts every connection to the app's own origin. When the device is online the browser re-checks `/sw.js` on launch; that is how updates arrive.
- **Backup:** Grown-ups → Save backup / Download file writes a JSON file with every design, the owned colors and settings. Restore adds designs from a file and never deletes; if both copies exist, the newer one wins. Backup files are validated before anything is saved.

## Run locally

```sh
npm ci
npm run dev          # dev server (no service worker)
npm run typecheck
npm test             # unit tests (engine, starters, backup)
npm run build        # production build into dist/ (+ sw.js, version.json)
npm run e2e          # Playwright end-to-end tests against the build (vite preview)
npm run deploy:dry   # wrangler deploy --dry-run
```

`npm run e2e` needs a build first. It runs at iPhone 14 Pro Max, iPhone SE, and Fire HD 10 portrait and landscape sizes. CI also runs the iPhone project in WebKit (`E2E_WEBKIT=1`).

## Deployment

GitHub Actions (`.github/workflows/ci-deploy.yml`) runs typecheck, unit tests, the build, a wrangler dry run, and the end-to-end tests on every pull request and push. On pushes to `main` it then deploys `dist/` as an assets-only Cloudflare Worker named `pony` (`wrangler.jsonc`), using the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets. It then checks that https://pony.reloru.workers.dev/version.json reports the deployed commit.

## Project layout

```
src/core/      bead engine: colors, design types, validate, steps, rebuild, editing, geometry, 3D layout, starters
src/app/       storage (IndexedDB), backup format, router, service worker registration, install prompt
src/ui/        Preact screens and components (editor canvas, build mode, diagrams, palette)
src/three/     three.js viewer (loaded only when a 3D view opens)
sw/            service worker template
public/        manifest, icons, Cloudflare _headers
tests/         unit tests (Vitest)
e2e/           end-to-end tests (Playwright)
scripts/       dev helpers: icon generation, screenshots, 3D frame-rate probe
```

## License

MIT, see [LICENSE](LICENSE).
