import { describe, expect, it } from 'vitest';
import { COLORS, color, isStar } from '../src/core/colors';
import { STARTERS } from '../src/core/designs';
import * as E from '../src/core/edit';
import { rebuild, expected } from '../src/core/simulate';
import { beadCounts, cordFor, stepBeads, steps, weaveCordUse } from '../src/core/steps';
import type { ColorId, CritterDesign, CuffDesign, Design, FlatDesign, Leg, PeyoteDesign, WeaveRow, XBaseDesign } from '../src/core/types';
import { validate } from '../src/core/validate';
import { peyoteChart, peyoteStrip, weaveLayout, xbaseChart, xbaseStrip } from '../src/core/geometry';
import { UNIT, xbasePositions } from '../src/core/xbase';
import { ringBeads, roundColumns } from '../src/core/peyote';
import { GLYPHS, MAX_LETTERS, cleanName, nameKeychain } from '../src/core/letters';
import { layout3d } from '../src/core/layout3d';

/** Deterministic PRNG so failures are reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NON_STAR = COLORS.filter((c) => c.finish !== 'star').map((c) => c.id);
const ALL = COLORS.map((c) => c.id);

function randomLeg(r: () => number): Leg {
  const pick = (pool: string[]) => pool[Math.floor(r() * pool.length)];
  return {
    stem: Array.from({ length: 1 + Math.floor(r() * 6) }, () => pick(NON_STAR)),
    toes: Array.from({ length: 1 + Math.floor(r() * 5) }, () => pick(ALL)),
  };
}

function randomDesign(seed: number): Design {
  const r = rng(seed);
  const pick = (pool: string[]) => pool[Math.floor(r() * pool.length)];
  const base = { id: `x${seed}`, name: 'Random', createdAt: 0, updatedAt: 0 };
  const which = Math.floor(r() * 6);
  if (which === 5) {
    const n = 6 + Math.floor(r() * 11); // 6..16 units
    const h = 1 + Math.floor(r() * 4);
    const row = (len: number) => Array.from({ length: len }, () => pick(NON_STAR));
    return { ...base, kind: 'xbase', rows: [row(3 * n), ...Array.from({ length: 2 * h }, () => row(3 * n)), row(2 * n)] };
  }
  if (which === 4) {
    const half = 6 + Math.floor(r() * 15); // 12..40 around
    const rows = 3 + Math.floor(r() * 18);
    return { ...base, kind: 'peyote', rows: Array.from({ length: rows }, () => Array.from({ length: half }, () => pick(NON_STAR))) };
  }
  if (which === 0) {
    return { ...base, kind: 'bracelet', beads: Array.from({ length: 12 + Math.floor(r() * 37) }, () => pick(ALL)) };
  }
  if (which === 1) {
    const w = 2 + Math.floor(r() * 6);
    const n = 10 + Math.floor(r() * 21);
    return { ...base, kind: 'cuff', rows: Array.from({ length: n }, () => Array.from({ length: w }, () => pick(NON_STAR))) };
  }
  const critter = which === 3;
  const n = 1 + Math.floor(r() * 30);
  const rows: WeaveRow[] = Array.from({ length: n }, (_, i) => {
    const row: WeaveRow = { beads: Array.from({ length: 1 + Math.floor(r() * 11) }, () => pick(NON_STAR)) };
    if (critter && i > 0 && r() < 0.4) row.belly = true;
    if (r() < 0.2) row.legL = randomLeg(r);
    if (r() < 0.2) row.legR = randomLeg(r);
    return row;
  });
  return critter
    ? ({ ...base, kind: 'critter', keyring: r() < 0.5, rows } as CritterDesign)
    : ({ ...base, kind: 'flat', keyring: r() < 0.5, rows } as FlatDesign);
}

function countMap(list: ColorId[]) {
  const m: Record<string, number> = {};
  for (const c of list) m[c] = (m[c] ?? 0) + 1;
  return m;
}

/** The core promise: following the steps builds exactly the design, with exactly the listed beads. */
function assertInstructionsMatch(d: Design) {
  expect(validate(d)).toEqual([]);
  const s = steps(d);
  expect(rebuild(s)).toEqual(expected(d));
  const fromSteps = countMap(s.flatMap(stepBeads));
  const fromList = Object.fromEntries(beadCounts(d).map((b) => [b.color, b.count]));
  expect(fromSteps).toEqual(fromList);
  const cut = s[0];
  expect(cut.t).toBe('cut');
  if (cut.t === 'cut') expect(cut.cord.inches).toBeGreaterThan(0);
}

describe('palette', () => {
  it('has exactly the requested colors', () => {
    const by = (f: string) => COLORS.filter((c) => c.finish === f);
    expect(by('solid')).toHaveLength(49);
    expect(by('clear')).toHaveLength(20);
    expect(by('pearl')).toHaveLength(10);
    expect(by('star')).toHaveLength(10);
    expect(new Set(COLORS.map((c) => c.id)).size).toBe(COLORS.length);
    expect(color('s-white').hex).toBe('#DDDDDD');
    expect(color('s-black').hex).toBe('#1A1A1A');
    expect(color('s-medium-orchid').hex).toBe('#AD56A2');
    expect(color('t-smoky-brown').hex).toBe('#7A5E52');
    expect(color('t-golden-yellow').hex).toBe('#E6BA49');
    expect(color('p-steel-blue').hex).toBe('#5787A4');
    expect(color('star-royal-blue').hex).toBe('#13298C');
    for (const c of COLORS) expect(c.hex).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe('starter designs', () => {
  it('has original starters of every kind', () => {
    const kinds = new Set(STARTERS.map((d) => d.kind));
    expect([...kinds].sort()).toEqual(['bracelet', 'critter', 'cuff', 'flat', 'peyote', 'xbase']);
    expect(new Set(STARTERS.map((d) => d.id)).size).toBe(STARTERS.length);
  });
  for (const d of STARTERS) {
    it(`${d.name}: instructions rebuild the design exactly`, () => assertInstructionsMatch(d));
  }
  it('every critter has a puffy two-layer body', () => {
    for (const d of STARTERS.filter((x) => x.kind === 'critter') as CritterDesign[]) {
      expect(d.rows.some((r) => r.belly)).toBe(true);
    }
  });
  it('bracelet repeats meet at the knot', () => {
    for (const d of STARTERS) {
      if (d.kind !== 'bracelet') continue;
      const p = E.period(d.beads);
      const mirrored = d.beads.join() === [...d.beads].reverse().join();
      expect(d.beads.length % p === 0 || mirrored).toBe(true);
    }
  });
});

describe('random designs', () => {
  for (let seed = 1; seed <= 400; seed++) {
    it(`seed ${seed}`, () => assertInstructionsMatch(randomDesign(seed)));
  }
});

describe('steps', () => {
  it('row 1 goes on the middle of the cord without a key ring, and is woven after a key ring', () => {
    const d = STARTERS.find((x) => x.kind === 'flat') as FlatDesign;
    const a = steps({ ...d, keyring: false });
    const b = steps({ ...d, keyring: true });
    expect(a.find((s) => s.t === 'row')).toMatchObject({ row: 1, mode: 'center' });
    expect(a.some((s) => s.t === 'keyring')).toBe(false);
    expect(b[1]).toEqual({ t: 'keyring' });
    expect(b.find((s) => s.t === 'row')).toMatchObject({ row: 1, mode: 'cross' });
  });
  it('legs come right after their row, left before right', () => {
    for (const d of STARTERS) {
      const s = steps(d);
      s.forEach((st, i) => {
        if (st.t !== 'leg') return;
        const prev = s[i - 1];
        if (st.side === 'L') expect(prev).toMatchObject({ t: 'row', row: st.row });
        else expect(prev.t === 'row' || (prev.t === 'leg' && prev.side === 'L')).toBe(true);
      });
    }
  });
  it('rejects steps in an impossible order', () => {
    const d = STARTERS.find((x) => x.kind === 'flat' && x.rows.some((r) => r.legL)) as FlatDesign;
    const s = steps(d);
    const legAt = s.findIndex((x) => x.t === 'leg');
    const swapped = [...s];
    [swapped[legAt - 1], swapped[legAt]] = [swapped[legAt], swapped[legAt - 1]];
    expect(() => rebuild(swapped)).toThrow();
    expect(() => rebuild(s.filter((x) => x.t !== 'tie'))).toThrow();
  });
  it('bracelet chunks are small enough to follow', () => {
    for (const d of STARTERS.filter((x) => x.kind === 'bracelet')) {
      for (const st of steps(d)) if (st.t === 'string') expect(st.beads.length).toBeLessThanOrEqual(6);
    }
  });
});

describe('cord length', () => {
  const row = (n: number): WeaveRow => ({ beads: Array(n).fill('s-green') });
  const foot: Leg = { stem: ['s-green', 's-green'], toes: ['s-yellow', 's-yellow', 's-yellow'] };
  it('is at least what published patterns of similar size use', () => {
    // Turtle-sized piece (Dorr Library pattern asks for 60 in with a key ring).
    const turtle = [2, 3, 2, 5, 7, 7, 7, 7, 5, 2, 1].map(row);
    turtle[4] = { ...turtle[4], legL: foot, legR: foot };
    turtle[7] = { ...turtle[7], legL: foot, legR: foot };
    const t: FlatDesign = { id: 't', name: 't', createdAt: 0, updatedAt: 0, kind: 'flat', keyring: true, rows: turtle };
    expect(cordFor(t).inches).toBeGreaterThanOrEqual(60);
    // Lizard-sized piece (Brooklyn Bridge Park sheet: about 4 ft).
    const liz = [1, 2, 4, 3, 4, 4, 3, 4, 4, 3, 2, 1, 1, 1, 1, 1].map(row);
    liz[3] = { ...liz[3], legL: foot, legR: foot };
    liz[8] = { ...liz[8], legL: foot, legR: foot };
    const l: FlatDesign = { ...t, rows: liz };
    expect(cordFor(l).inches).toBeGreaterThanOrEqual(48);
  });
  it('both cord ends get the tie allowance', () => {
    const u = weaveCordUse([row(3), row(3)], false, false);
    expect(u.A).toBeGreaterThan(150);
    expect(u.B).toBeGreaterThan(150);
  });
  it('bracelet cord is the strand plus room to tie', () => {
    const b = STARTERS.find((x) => x.kind === 'bracelet')!;
    const c = cordFor(b);
    expect(c.kind).toBe('stretch');
    expect(c.inches).toBeGreaterThanOrEqual(10);
    expect(c.inches).toBeLessThanOrEqual(16);
  });
});

describe('validation', () => {
  it('refuses stars where the cord passes through twice', () => {
    const d = structuredClone(STARTERS.find((x) => x.kind === 'flat')) as FlatDesign;
    d.rows[0].beads[0] = 'star-red';
    expect(validate(d).join()).toMatch(/star/);
    const ok = structuredClone(d);
    ok.rows[0].beads[0] = 's-red';
    ok.rows[0].legL = { stem: ['s-red'], toes: ['star-red'] };
    expect(validate(ok)).toEqual([]);
  });
  it('refuses belly rows on flat shapes and on row 1', () => {
    const d = structuredClone(STARTERS.find((x) => x.kind === 'flat')) as FlatDesign;
    d.rows[2].belly = true;
    expect(validate(d).length).toBeGreaterThan(0);
    const c = structuredClone(STARTERS.find((x) => x.kind === 'critter')) as CritterDesign;
    c.rows[0].belly = true;
    expect(validate(c).length).toBeGreaterThan(0);
  });
  it('refuses unknown colors and uneven cuffs', () => {
    const c = structuredClone(STARTERS.find((x) => x.kind === 'cuff')) as CuffDesign;
    c.rows[1] = c.rows[1].slice(1);
    expect(validate(c).length).toBeGreaterThan(0);
    const b = structuredClone(STARTERS.find((x) => x.kind === 'bracelet')!) as Design & { beads: string[] };
    b.beads[0] = 'not-a-color';
    expect(validate(b).length).toBeGreaterThan(0);
  });
});

describe('editing never makes an unbuildable design', () => {
  it('random edit sequences stay valid', () => {
    const r = rng(42);
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
    for (let trial = 0; trial < 300; trial++) {
      let d: Design = structuredClone(pick(STARTERS));
      for (let k = 0; k < 40; k++) {
        const c = pick(ALL);
        const mirror = r() < 0.5;
        if (d.kind === 'bracelet') {
          const op = Math.floor(r() * 5);
          if (op === 0) d = E.paint(d, { t: 'ring', i: Math.floor(r() * d.beads.length) }, c, mirror);
          if (op === 1) d = E.braceletSize(d, d.beads.length + (r() < 0.5 ? -3 : 3));
          if (op === 2) d = E.applyRhythm(d, [c, pick(ALL), pick(ALL)], pick(E.RHYTHMS));
          if (op === 3) d = E.floodFill(d, { t: 'ring', i: 0 }, c, mirror);
          if (op === 4) d = E.surprise(d, ALL, r);
        } else if (d.kind === 'xbase') {
          const op = Math.floor(r() * 7);
          const row = Math.floor(r() * d.rows.length);
          const i = Math.floor(r() * d.rows[row].length);
          if (op === 0) d = E.paint(d, { t: 'row', row, i }, c, mirror);
          if (op === 1) d = E.xbaseUnits(d, r() < 0.5 ? 1 : -1);
          if (op === 2) d = E.xbaseHeight(d, r() < 0.5 ? 1 : -1);
          if (op === 3) d = E.floodFill(d, { t: 'row', row, i }, c, mirror);
          if (op === 4) d = E.swapColor(d, d.rows[0][0], c);
          if (op === 5) d = E.useMyBeads(d, new Set([pick(ALL), pick(NON_STAR)]));
          if (op === 6) d = E.surprise(d, ALL, r);
        } else if (d.kind === 'peyote') {
          const op = Math.floor(r() * 7);
          const row = Math.floor(r() * d.rows.length);
          const i = Math.floor(r() * d.rows[0].length);
          if (op === 0) d = E.paint(d, { t: 'row', row, i }, c, mirror);
          if (op === 1) d = E.peyoteAround(d, r() < 0.5 ? 1 : -1);
          if (op === 2) d = E.peyoteRows(d, d.rows.length + (r() < 0.5 ? -1 : 1));
          if (op === 3) d = E.floodFill(d, { t: 'row', row, i }, c, mirror);
          if (op === 4) d = E.swapColor(d, d.rows[0][0], c);
          if (op === 5) d = E.useMyBeads(d, new Set([pick(ALL), pick(NON_STAR)]));
          if (op === 6) d = E.surprise(d, ALL, r);
        } else if (d.kind === 'cuff') {
          const op = Math.floor(r() * 5);
          const row = Math.floor(r() * d.rows.length);
          const i = Math.floor(r() * d.rows[0].length);
          if (op === 0) d = E.paint(d, { t: 'row', row, i }, c, mirror);
          if (op === 1) d = E.cuffWidth(d, r() < 0.5 ? 1 : -1);
          if (op === 2) d = E.cuffLength(d, d.rows.length + (r() < 0.5 ? -2 : 2));
          if (op === 3) d = E.floodFill(d, { t: 'row', row, i }, c, mirror);
          if (op === 4) d = E.swapColor(d, d.rows[0][0], c);
        } else {
          const row = Math.floor(r() * d.rows.length);
          const w = d.rows[row].beads.length;
          const side = r() < 0.5 ? 'L' : 'R';
          const op = Math.floor(r() * 10);
          if (op === 0) d = E.paint(d, { t: 'row', row, i: Math.floor(r() * w) }, c, mirror);
          if (op === 1) d = E.addEnd(d, row, side, c, mirror);
          if (op === 2) d = E.erase(d, { t: 'row', row, i: r() < 0.5 ? 0 : w - 1 }, mirror);
          if (op === 3) d = E.erase(d, { t: 'row', row, i: Math.floor(r() * w) }, mirror);
          if (op === 4) d = E.addRow(d, r() < 0.5 ? 'top' : 'bottom');
          if (op === 5) d = E.toggleBelly(d, row);
          if (op === 6) d = E.cycleLeg(d, row, side, c, mirror);
          if (op === 7) d = E.floodFill(d, { t: 'row', row, i: 0 }, c, mirror);
          if (op === 8) d = E.useMyBeads(d, new Set([pick(ALL), pick(ALL), pick(NON_STAR)]));
          if (op === 9) {
            const lr = d.rows[row].legL;
            if (lr) d = E.paint(d, { t: 'leg', row, side: 'L', part: 'toes', i: 0 }, c, mirror);
          }
        }
        expect(validate(d)).toEqual([]);
      }
      assertInstructionsMatch(d);
    }
  });
  it('erasing only works on row ends, so rows never get holes', () => {
    const d = structuredClone(STARTERS.find((x) => x.kind === 'flat' && x.rows.some((r) => r.beads.length >= 5))) as FlatDesign;
    const row = d.rows.findIndex((r) => r.beads.length >= 5);
    expect(E.canErase(d, { t: 'row', row, i: 2 })).toBe(false);
    expect(E.erase(d, { t: 'row', row, i: 2 }, false)).toBe(d);
    expect(E.erase(d, { t: 'row', row, i: 0 }, false).rows[row].beads.length).toBe(d.rows[row].beads.length - 1);
  });
  it('use-my-beads only uses owned colors', () => {
    const owned = new Set(['s-red', 's-white', 's-blue', 'star-yellow']);
    for (const d of STARTERS) {
      const n = E.useMyBeads(d, owned);
      expect(validate(n)).toEqual([]);
      for (const c of E.usedColors(n)) expect(owned.has(c)).toBe(true);
    }
  });
  it('stars cannot be painted into weave rows', () => {
    const d = STARTERS.find((x) => x.kind === 'flat') as FlatDesign;
    const n = E.paint(d, { t: 'row', row: 0, i: 0 }, 'star-red', false) as FlatDesign;
    expect(isStar(n.rows[0].beads[0])).toBe(false);
  });
  it('bracelet resizing keeps the repeat going', () => {
    const b = STARTERS.find((x) => x.id === 'b-mermaid')!;
    if (b.kind !== 'bracelet') throw new Error();
    const big = E.braceletSize(b, 32);
    expect(big.beads.slice(28)).toEqual(b.beads.slice(0, 4));
  });
  it('cuff width grows and shrinks back to the same design', () => {
    const c = STARTERS.find((x) => x.kind === 'cuff') as CuffDesign;
    expect(E.cuffWidth(E.cuffWidth(c, 1), -1).rows).toEqual(c.rows);
    expect(E.cuffWidth(E.cuffWidth(c, -1), 1).rows[0].length).toBe(c.rows[0].length);
  });
});

describe('layouts', () => {
  it('every bead appears once in the chart and in 3D', () => {
    for (const d of STARTERS) {
      const total = beadCounts(d).reduce((s, b) => s + b.count, 0);
      expect(layout3d(d)).toHaveLength(total);
      if (d.kind === 'flat' || d.kind === 'critter') expect(weaveLayout(d.rows)).toHaveLength(total);
      if (d.kind === 'xbase') {
        expect(xbaseStrip(d.rows)).toHaveLength(total);
        expect(xbaseChart(d.rows)).toHaveLength(total);
      }
      if (d.kind === 'peyote') {
        expect(peyoteChart(d.rows)).toHaveLength(total);
        expect(peyoteStrip(d.rows)).toHaveLength(total);
      }
      for (const b of layout3d(d)) {
        expect(b.p.every(Number.isFinite)).toBe(true);
        expect(Math.hypot(...b.axis)).toBeCloseTo(1, 5);
      }
    }
  });
});

describe('peyote', () => {
  const cuff = STARTERS.find((d) => d.kind === 'peyote') as PeyoteDesign;
  const n = cuff.rows[0].length * 2;

  it('the ring is strung in column order, alternating the two first rows', () => {
    const ring = ringBeads(cuff.rows);
    expect(ring).toHaveLength(n);
    expect(ring[0]).toBe(cuff.rows[0][0]);
    expect(ring[1]).toBe(cuff.rows[1][0]);
    expect(ring[n - 1]).toBe(cuff.rows[1][n / 2 - 1]);
  });

  it('round 1 starts right after the knot; each round starts one column further round', () => {
    expect(roundColumns(2, n)[0]).toBe(0);
    expect(roundColumns(3, n)[0]).toBe(1);
    expect(roundColumns(4, n)[0]).toBe(2);
    expect(roundColumns(2, n)).toEqual(Array.from({ length: n / 2 }, (_, i) => 2 * i));
  });

  it('steps: ring in small chunks, a tie, rounds of half the ring, step-ups between rounds', () => {
    const s = steps(cuff);
    const ringChunks = s.filter((x) => x.t === 'ring');
    expect(ringChunks.reduce((a, x) => a + (x.t === 'ring' ? x.beads.length : 0), 0)).toBe(n);
    for (const x of s) if (x.t === 'ring' || x.t === 'round') expect(x.beads.length).toBeLessThanOrEqual(7);
    const rounds = cuff.rows.length - 2;
    expect(s.filter((x) => x.t === 'stepup')).toHaveLength(rounds - 1);
    expect(s.at(-1)).toEqual({ t: 'tie', style: 'peyote' });
  });

  it('the replay catches a round started in the wrong place', () => {
    // Make every bead a different color so any misplacement shows.
    const d = structuredClone(cuff);
    let i = 0;
    const pool = NON_STAR;
    d.rows = d.rows.map((r) => r.map(() => pool[i++ % pool.length]));
    const s = steps(d);
    expect(rebuild(s)).toEqual(expected(d));
    // Shift round 2 by one bead: the kid started in the wrong gap.
    const bad = s.map((x) => (x.t === 'round' && x.round === 2 && x.from === 0 ? { ...x, beads: [...x.beads.slice(1), x.beads[0]] } : x));
    expect(rebuild(bad)).not.toEqual(expected(d));
    // Forgetting the step-up is not possible to follow.
    expect(() => rebuild(s.filter((x) => x.t !== 'stepup'))).toThrow();
    // An odd ring can't be done this way.
    const odd = s.map((x) => (x.t === 'ring' && x.from === 0 ? { ...x, beads: x.beads.slice(1) } : x));
    expect(() => rebuild(odd)).toThrow();
  });

  it('cord: stretchy, at least 3 ft, and grows with the cuff', () => {
    const c = cordFor(cuff);
    expect(c.kind).toBe('stretch');
    expect(c.inches).toBeGreaterThanOrEqual(36);
    expect(cordFor(E.peyoteRows(cuff, cuff.rows.length + 4)).inches).toBeGreaterThan(c.inches);
  });

  it('mirror keeps a bead in its row; resizing around keeps the pattern repeating', () => {
    const m = E.mirrorRef(cuff, { t: 'row', row: 3, i: 2 });
    expect(m).toMatchObject({ t: 'row', row: 3 });
    const bigger = E.peyoteAround(cuff, 1);
    expect(bigger.rows[0].length).toBe(cuff.rows[0].length + 1);
    expect(validate(bigger)).toEqual([]);
    expect(E.peyoteAround(bigger, -1).rows).toEqual(cuff.rows);
  });

  it('stars are refused in peyote', () => {
    const d = structuredClone(cuff);
    d.rows[2][0] = 'star-red';
    expect(validate(d).join()).toMatch(/star/);
    expect(E.paint(cuff, { t: 'row', row: 2, i: 0 }, 'star-red', false).rows[2][0]).toBe(cuff.rows[2][0]);
  });
});

describe('name keychains', () => {
  const meta = { id: 'n', createdAt: 0, updatedAt: 0 };
  it('every letter is 5 × 5', () => {
    expect(Object.keys(GLYPHS)).toHaveLength(27);
    for (const [ch, g] of Object.entries(GLYPHS)) {
      expect(g, ch).toHaveLength(5);
      for (const line of g) expect(line, ch).toMatch(/^[#.]{5}$/);
    }
  });
  it('every letter, and some names, make a buildable keychain whose steps match', () => {
    for (const ch of Object.keys(GLYPHS)) assertInstructionsMatch(nameKeychain(ch, 's-hot-pink', 's-white', meta)!);
    for (const name of ['MIA', 'ZOE', 'A♥B', 'AVA♥']) assertInstructionsMatch(nameKeychain(name, 's-navy', 'p-white', meta)!);
  });
  it('keeps letters only, capitals, at most four, and fits the row limit', () => {
    expect(cleanName('olivia!')).toBe('OLIV');
    expect(cleanName('a b-c')).toBe('ABC');
    expect(nameKeychain('', 's-red', 's-white', meta)).toBeNull();
    const d = nameKeychain('WWWW', 's-red', 's-white', meta)!;
    expect(d.rows).toHaveLength(1 + 5 * MAX_LETTERS + (MAX_LETTERS - 1) + 1);
    expect(d.keyring).toBe(true);
    expect(d.rows.every((r) => r.beads.length === 7)).toBe(true);
  });
});

describe('x-base', () => {
  const ocean = STARTERS.find((d) => d.id === 'x-ocean') as XBaseDesign;
  const meta = { id: 'x', name: 'x', createdAt: 0, updatedAt: 0 };
  /** every bead a different color, so any misplacement shows */
  const distinct = (n: number, h: number): XBaseDesign => {
    let k = 0;
    const row = (len: number) => Array.from({ length: len }, () => NON_STAR[k++ % NON_STAR.length]);
    return { ...meta, kind: 'xbase', rows: [row(3 * n), ...Array.from({ length: 2 * h }, () => row(3 * n)), row(2 * n)] };
  };

  it('steps: whole units in the ring chunks, whole groups in the rounds, a step-up between rounds', () => {
    const s = steps(ocean);
    for (const x of s) {
      if (x.t === 'xring') {
        expect(x.from % 3).toBe(0);
        expect(x.beads.length % 3).toBe(0);
      }
      if (x.t === 'xround') for (const g of x.groups) expect(g).toHaveLength(x.kind === 'pairs' ? 2 : 3);
    }
    expect(s.filter((x) => x.t === 'xup')).toHaveLength(2); // after both group rounds
    expect(s.at(-2)).toMatchObject({ t: 'xround', kind: 'pairs' });
    expect(s.at(-1)).toEqual({ t: 'tie', style: 'xbase' });
  });

  it('the replay catches mistakes', () => {
    const d = distinct(8, 2);
    const s = steps(d);
    expect(rebuild(s)).toEqual(expected(d));
    // A round started one connector late: every group lands one gap over.
    const late = s.map((x) => (x.t === 'xround' && x.round === 2 ? { ...x, groups: x.groups.map((_, j) => d.rows[2].slice(3 * ((x.from + j + 1) % 8), 3 * ((x.from + j + 1) % 8) + 3)) } : x));
    expect(rebuild(late)).not.toEqual(expected(d));
    const short = s.map((x) => (x.t === 'xround' && x.round === 1 && x.from === 0 ? { ...x, groups: [x.groups[0].slice(0, 2), ...x.groups.slice(1)] } : x));
    expect(() => rebuild(short)).toThrow();
    const long = s.map((x) => (x.t === 'xround' && x.round === 1 && x.from === 0 ? { ...x, groups: [[...x.groups[0], 's-red'], ...x.groups.slice(1)] } : x));
    expect(() => rebuild(long)).toThrow();
    const pairs3 = s.map((x) => (x.t === 'xround' && x.kind === 'pairs' && x.from === 0 ? { ...x, groups: [[...x.groups[0], 's-red'], ...x.groups.slice(1)] } : x));
    expect(() => rebuild(pairs3)).toThrow();
    expect(() => rebuild(s.filter((x) => x.t !== 'xup'))).toThrow();
    const oddRing = s.map((x) => (x.t === 'xring' && x.from === 0 ? { ...x, beads: x.beads.slice(1) } : x));
    expect(() => rebuild(oddRing)).toThrow();
  });

  it('mirror twice gives back every bead, for every size', () => {
    const bad: string[] = [];
    for (let n = 6; n <= 16; n++)
      for (let h = 1; h <= 4; h++) {
        const d = distinct(n, h);
        d.rows.forEach((row, r) =>
          row.forEach((_, i) => {
            const m = E.mirrorRef(d, { t: 'row', row: r, i });
            const back = m && m.t === 'row' && m.row === r ? E.mirrorRef(d, m) : null;
            if (!back || back.t !== 'row' || back.row !== r || back.i !== i) bad.push(`n=${n} h=${h} row ${r} bead ${i}`);
          }),
        );
      }
    expect(bad).toEqual([]);
  });

  it('fill on a one-color cuff reaches every bead (the cord joins everything)', () => {
    for (const [n, h] of [
      [6, 1],
      [10, 2],
      [13, 4],
    ]) {
      const d = distinct(n, h);
      d.rows = d.rows.map((r) => r.map(() => 's-white'));
      const f = E.floodFill(d, { t: 'row', row: 1, i: 1 }, 's-red', false);
      expect(f.rows.flat().every((c) => c === 's-red')).toBe(true);
    }
  });

  it('her cuff: X centres line up with the edge pairs; connectors sit between pairs; 110 beads for a 30-bead ring', () => {
    // lavender connectors and arms, mint pairs and X centres, 1 X high (from her photo)
    const lav = 's-pale-lavender';
    const mint = 's-mint';
    const unitRow = (u: string[]) => Array.from({ length: 10 }, () => u).flat();
    const hers: XBaseDesign = { ...meta, kind: 'xbase', rows: [unitRow([lav, mint, mint]), unitRow([lav, mint, lav]), unitRow([lav, lav, lav]), unitRow([mint, mint])] };
    assertInstructionsMatch(hers);
    expect(beadCounts(hers)).toEqual([
      { color: lav, count: 60 },
      { color: mint, count: 50 },
    ]);
    const pos = xbasePositions(hers.rows);
    const at = (row: number, i: number) => pos.find((p) => p.row === row && p.i === i)!;
    for (let u = 0; u < 10; u++) {
      const centre = at(1, 3 * u + 1).x;
      const basePair = (at(0, 3 * u + 1).x + at(0, 3 * u + 2).x) / 2;
      const topPair = (at(3, 2 * u + 1).x + at(3, 2 * u + 2 >= 20 ? 0 : 2 * u + 2).x) / 2;
      expect(centre).toBeCloseTo(basePair, 5);
      expect(at(0, 3 * u).x).toBeCloseTo(u * UNIT, 5); // connectors between pairs
      void topPair;
    }
    // Top pairs sit above the X centres too (between the upper connectors).
    for (let u = 0; u < 10; u++) {
      const a = at(3, 2 * u).x;
      const b = at(3, 2 * u + 1).x;
      const mid = (a + b) / 2;
      const centre = at(1, 3 * ((u + 1) % 10) + 1).x;
      expect(Math.abs(mid - centre) < 1e-6 || Math.abs(Math.abs(mid - centre) - 10 * UNIT) < 1e-6).toBe(true);
    }
  });

  it('resizing keeps a valid cuff and grows by whole repeats', () => {
    const bigger = E.xbaseUnits(ocean, 1);
    expect(bigger.rows[0]).toHaveLength(33);
    expect(validate(bigger)).toEqual([]);
    expect(E.xbaseUnits(bigger, -1).rows).toEqual(ocean.rows);
    const taller = E.xbaseHeight(ocean, 1);
    expect(taller.rows).toHaveLength(ocean.rows.length + 2);
    expect(validate(taller)).toEqual([]);
    expect(E.xbaseHeight(taller, -1).rows).toEqual(ocean.rows);
    expect(E.xbaseHeight(ocean, -1)).toEqual(ocean); // 1 X high is the minimum
  });

  it('cord: stretchy and at least 3 ft', () => {
    const c = cordFor(ocean);
    expect(c.kind).toBe('stretch');
    expect(c.inches).toBeGreaterThanOrEqual(36);
  });
});
