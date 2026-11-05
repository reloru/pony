# Bead Studio

An offline app for designing pony bead projects and then making them for real, step by step. Built for a 10-year-old using it alone on an iPhone or an Amazon Fire HD tablet: big buttons, bright pictures, very little reading.

**Live:** https://pony.reloru.workers.dev

## What she can make

| Kind | How it's built | Cord |
| --- | --- | --- |
| **Bracelets** | One strand of beads, knotted into a ring. | about 1 mm stretchy cord |
| **Keychains** (flat shapes on a key ring) | Two-cord ladder weave: string a row on the left cord and push the right cord back through it the other way; each row sits under the last, centered. Legs, ears, arms and tails hang off a cord between rows. Includes a **name keychain** maker: type up to 4 letters (or ♥) and pick two colors. | plastic lace (gimp / boondoggle) |
| **Ladder Cuffs** | The same ladder weave as one long band of equal-width rows, closed into a ring. | about 1 mm stretchy cord |
| **Peyote Cuffs** (3D) | Even-count tubular peyote, the kandi "peyote"/"multi" cuff: an even ring of beads tied in a circle, then each round *add a bead, skip one, go through the next*, stepping up through the round's first bead. | about 1 mm stretchy cord |
| **X-base Cuffs** (3D) | The kandi X-base: a ring of sets (1 connector bead + 2 beads) tied in a circle, then rounds of 3-bead groups that hang between neighbouring connectors; each group's middle bead is what the next round goes through, so the groups cross into X's. A last round of 2-bead pairs makes the other edge. 1 to 4 X's high. | about 1 mm stretchy cord |
| **Critters** (3D) | Ladder weave with two layers: a “belly” row is tucked under the row before it, so the body puffs up. | plastic lace |

There are 42 original starter designs (8 bracelets, 10 keychains, 6 ladder cuffs, 6 peyote cuffs, 6 X-base cuffs, 6 critters). She can start from one and change it, or start fresh.

**Editing:** paint (tap or drag), fill, swap one color for another everywhere, mirror mode, undo/redo, “Surprise” recoloring, and “My beads” (swaps every color she doesn't own for the closest one she does). Shapes and critters can grow or lose beads at the row ends, add rows, and add legs. Critter rows can be switched between top and belly. Bracelets have a pattern maker (AB, AAB, ABC…) and a size control. Ladder cuffs have width and length controls; peyote cuffs have beads-around (in steps of 2) and rows, and mirror across a column because peyote rows are offset. X-base cuffs have sets around (each set is 3 beads, 6 to 16 sets) and X's high (1 to 4), and mirror across the first connector. Critters and cuffs show a 3D preview you can spin. On a phone held upright, cuffs are drawn sideways so they fit; on wider screens they're drawn the right way up.

**Making it:** first a list of every bead by color with counts (colors she hasn't marked as owned are highlighted), the cord length and type, and a key ring if used. Then one step per screen: the beads for that step in order, a picture of exactly what to do with the cords, and a map of the design with the current part lit up. Progress is saved, and there's a read-aloud button when the device has an offline voice.

**My Beads:** tap the colors she owns from the full list: 49 solid, 20 see-through, 10 pearl and 10 star colors.

## How the instructions are kept exact

`src/core` is a pure TypeScript engine with no UI:

- `validate()` accepts only buildable designs. Rows have no gaps, widths and counts are within limits, belly rows only on critters (never row 1), and star beads only where the cord passes through once.
- `steps()` turns a design into ordered steps. `beadCounts()` totals the beads, and `cordFor()` estimates the cord.
- `rebuild()` follows the steps the way a person would (cords swap sides each row, legs right after their row, left before right, close the band before tying) and returns what ends up on the cord. For peyote it models every column as a stack of beads: each new bead must drop into a real gap (lower than both neighbours), the cord then goes through the next raised bead, and the step-up goes through the round's first bead. For X-base it keeps the ring of "anchor" beads (connectors, then each round's middle beads): every round must start at the first anchor, every group must be exactly 3 beads (2 on the last round) and fill the next gap, a round must close back at the start with every gap filled, and a step-up is only allowed after a finished round. It never uses the step generator's arithmetic.

The tests (`tests/core.test.ts`) check that for **every starter, every name-keychain letter and 400 random designs** (all kinds, peyote and X-base included), following the steps rebuilds exactly the design, and the beads used across all steps equal the bead list. They also apply 300 random edit sequences and check that no editor operation can produce an unbuildable design. The end-to-end tests additionally read the bead totals and every step's beads from the screen and compare them.

### Sources, and what is assumed

- **Bead size:** 9 mm across, 6 mm along the hole, 4 mm hole (given; matches [BeadTin's listing](https://www.beadtin.com/products/crystal-blue-transparent-9mm-barrel-pony-beads) of 6 mm high by 9 mm wide).
- **Ladder weave, row placement, key-ring start (lark's head), legs (go back through only the beads nearest the body):** published kids' patterns: [Dorr Library turtle](https://www.dorrlibrary.michlibrary.org/site-assets/files/bead-pet-turtle.pdf/@@download/file/Bead%20Pet%20Turtle.pdf), [Homan at Home turtle](https://homanathome.com/2026/01/pony-bead-turtle/), [Brooklyn Bridge Park lizard](https://www.brooklynbridgepark.org/wp-content/uploads/2020/10/Beaded-Lizard-Craft.pdf), [Craft Project Ideas bunny](https://craftprojectideas.com/bunny-bead-pet/).
- **Two-layer (belly) critters:** documented for seed beads on fishing line ([beadsis crocodile](https://beadsis.weebly.com/tutorial.html): rows in pairs, the second of each pair forms the belly). Using it with pony beads and plastic lace is an **extrapolation**. Stiff lace and pulling each row tight help it hold its shape.
- **Peyote cuffs:** [KandiCon](https://kandicon.com/how-to-make-kandi) says the kandi multi-stitch cuff is what other beaders call even tubular peyote, that the first row must be an even number of beads (about 28 around a wrist), and that each new row sits in the gaps of the row below. The kids' tutorial at [friendship-bracelets.net](https://friendship-bracelets.net/tutorials/1384) ties an even ring, then works "skip one bead… string on a bead, skip one" round the loop and goes through the first bead again at the end. [beadjewelrymaking.com](https://beadjewelrymaking.com/Arts_and_Craft_Idea/even_count_tubular_peyote_stitch_instruction.html) confirms the cord goes *through* the next bead and that each round ends "by passing the thread through the first bead added on this row". **Where the first new bead goes is this app's convention:** right after the knot, so each round then starts one column further round. The map marks each round's first bead "1", and every starter's ring is a single color, so a different starting habit doesn't spoil the pattern.
- **X-base cuffs:** the row rules follow [Piece of Kandi's standard X-base](https://pieceofkandi.blogspot.com/2015/01/how-to-make-standard-x-base-cuff.html): start with "one connector and two base beads" repeated round the wrist; next "string three beads and go into next connector bead"; then go through a middle bead and string "one base, one connector, then another base bead"; finish with "two base beads then go through next connector". For more than one X high, "repeat the second and third row". [iHeartRaves](https://iheartraves.com/blogs/post/3d-kandi-cuff-tutorial) and [Insomniac](https://www.insomniac.com/?p=6969) use the same 3-bead groups through every third bead, and both tie off the first ring and say **not** to cut the cord; Insomniac says most people use 30 to 38 beads in the first ring. The app's 1-X structure was also checked against a photo of a real 1-X cuff (lavender connectors and arms, mint edge pairs and X centres); in the app that cuff is 110 beads for a 30-bead ring (60 lavender, 50 mint). **This app's own conventions:** one cord for the whole cuff (Piece of Kandi ties off and cuts after each row instead), a small knot after every round, round 1 starts at the connector right after the knot, and each later round starts by going through the next bead and the first group's middle bead. The map marks that bead "1". Mirror is across connector 1 so the pattern stays centred on the connectors.
- **Name keychains:** the letters are this app's own 5 × 5 designs; keychain beads are taller than wide, so they come out like ordinary capitals. A name is limited to 4 letters to keep the keychain (and the lace) a sensible length.
- **Cuff as a closed ladder band:** this is the same ladder weave, closed by pushing one cord through Row 1 and tying. The closing method is **this app's own**, worked out from the ladder weave rather than taken from a published cuff tutorial.
- **Cord lengths** are an estimate from a model of the cord path, padded and rounded up. They come out longer than the published patterns above (60 in for a turtle-sized piece, about 4 ft for the lizard). For peyote there was no published length to check against; the estimate (one trip round the cuff per round, plus slack) gives about 9 ft for a 28-around, 12-row cuff. For X-base, none of the tutorials read gave a cord length for a whole cuff. A search snippet from a kandipad 1-X tutorial says to start with "a fathom of string" (about 72 in), but that page refused automated reading, so this is **unverified**. The estimate gives 69 in for a 30-bead ring 1 X high and 101 in for 2 X's high.
- **Star beads:** their size and hole aren't known, so they're offered only on bracelets and as leg tips, where the cord passes through once (never in peyote, where the step-up bead takes three passes, or X-base, where connectors and middle beads take two or more).
- **3D preview:** an approximation. Real beadwork shifts with cord tension.

## Install on a device

- **iPhone:** open the live link in Safari → Share → **Add to Home Screen**. Open it once from the icon while online and wait for “✓ Ready to use offline” on the home screen. A home-screen app keeps its own saved data, separate from Safari.
- **Fire HD (Chrome):** open the link in Chrome. Chrome offers to install it with its own prompt, and the app's home screen shows an **Install** button whenever Chrome says it can be installed. If neither appears: ⋮ menu → **Install app** / **Add to Home screen**.

The **Grown-ups** screen (gear icon) has backup, restore, offline status and these instructions.

The 3D preview needs WebGL 2 (iOS 15 or later, current Chrome). Without it, the app shows the flat picture instead. The app was tested in Chromium at iPhone and Fire HD screen sizes and in Linux WebKit in CI. It hasn't been tested on a physical iPhone or Fire tablet.

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
