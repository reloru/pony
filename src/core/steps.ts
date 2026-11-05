import { around, chunkSizes, ringBeads, roundBeads } from './peyote';
import { topRow, unitsAround } from './xbase';
import { BEAD, type ColorId, type Design, type Leg, type PeyoteDesign, type Side, type WeaveRow, type XBaseDesign } from './types';

export type CordKind = 'lace' | 'stretch';

export interface Cord {
  kind: CordKind;
  /** length to cut, rounded up to a whole inch */
  inches: number;
  cm: number;
}

export type Step =
  | { t: 'cut'; cord: Cord }
  | { t: 'tape' }
  | { t: 'keyring' }
  | {
      t: 'row';
      /** 1-based row number */
      row: number;
      /** left-to-right as seen from the front (top side); also the stringing order */
      beads: ColorId[];
      /** 'center': slide onto the middle of the cord (row 1 without a key ring). 'cross': string on the left cord, push the right cord back through. */
      mode: 'center' | 'cross';
      belly: boolean;
    }
  | { t: 'leg'; row: number; side: Side; stem: ColorId[]; toes: ColorId[] }
  | { t: 'string'; from: number; beads: ColorId[]; total: number }
  | { t: 'close'; rows: number }
  /** peyote: string part of the starting ring (beads `from`… of `total`, in order) */
  | { t: 'ring'; from: number; beads: ColorId[]; total: number }
  /** peyote: tie the ring closed */
  | { t: 'tiering'; total: number }
  /**
   * peyote: part of a round. Round 1 builds row 3 (rows 1 and 2 are the ring). For each bead:
   * add it, skip the next bead, go through the one after. `from` counts beads within the round.
   */
  | { t: 'round'; round: number; rounds: number; from: number; beads: ColorId[]; perRound: number }
  /** peyote: go through the first bead of the round just finished */
  | { t: 'stepup'; round: number }
  /** X-base: string part of the base ring; whole units of (connector, pair, pair) */
  | { t: 'xring'; from: number; beads: ColorId[]; total: number }
  /** X-base: tie the base ring closed */
  | { t: 'xtie'; total: number }
  /**
   * X-base: part of a round. 'groups': for each group, string its 3 beads then go through the
   * next anchor. 'pairs' (the last round): string 2 beads, go through the next anchor.
   * `from` counts groups (or pairs) within the round; `count` is how many the round has.
   */
  | { t: 'xround'; round: number; rounds: number; kind: 'groups' | 'pairs'; from: number; groups: ColorId[][]; count: number }
  /** X-base: knot, then go through the first group's side bead and middle bead */
  | { t: 'xup'; round: number }
  | { t: 'tie'; style: 'bracelet' | 'weave' | 'cuff' | 'peyote' | 'xbase' };

/** Rows of the ladder weave for any kind that uses it. */
export function weaveRows(d: Design): WeaveRow[] | null {
  if (d.kind === 'flat' || d.kind === 'critter') return d.rows;
  if (d.kind === 'cuff') return d.rows.map((beads) => ({ beads }));
  return null;
}

export function usesKeyring(d: Design): boolean {
  return (d.kind === 'flat' || d.kind === 'critter') && d.keyring;
}

export function steps(d: Design): Step[] {
  const out: Step[] = [{ t: 'cut', cord: cordFor(d) }];
  if (d.kind === 'bracelet') {
    out.push({ t: 'tape' });
    const n = d.beads.length;
    const chunks = Math.ceil(n / 6);
    const base = Math.floor(n / chunks);
    const extra = n % chunks;
    let from = 0;
    for (let i = 0; i < chunks; i++) {
      const size = base + (i < extra ? 1 : 0);
      out.push({ t: 'string', from, beads: d.beads.slice(from, from + size), total: n });
      from += size;
    }
    out.push({ t: 'tie', style: 'bracelet' });
    return out;
  }

  if (d.kind === 'peyote') return [...out, ...peyoteSteps(d)];
  if (d.kind === 'xbase') return [...out, ...xbaseSteps(d)];

  const rows = weaveRows(d)!;
  const keyring = usesKeyring(d);
  if (keyring) out.push({ t: 'keyring' });
  rows.forEach((r, i) => {
    out.push({
      t: 'row',
      row: i + 1,
      beads: [...r.beads],
      mode: i === 0 && !keyring ? 'center' : 'cross',
      belly: !!r.belly,
    });
    if (r.legL) out.push({ t: 'leg', row: i + 1, side: 'L', stem: [...r.legL.stem], toes: [...r.legL.toes] });
    if (r.legR) out.push({ t: 'leg', row: i + 1, side: 'R', stem: [...r.legR.stem], toes: [...r.legR.toes] });
  });
  if (d.kind === 'cuff') {
    out.push({ t: 'close', rows: rows.length });
    out.push({ t: 'tie', style: 'cuff' });
  } else {
    out.push({ t: 'tie', style: 'weave' });
  }
  return out;
}

/** Peyote: ring in chunks, tie it, then each round in chunks with a step-up between rounds. */
function peyoteSteps(d: PeyoteDesign): Step[] {
  const out: Step[] = [];
  const ring = ringBeads(d.rows);
  let from = 0;
  for (const size of chunkSizes(ring.length, 7)) {
    out.push({ t: 'ring', from, beads: ring.slice(from, from + size), total: ring.length });
    from += size;
  }
  out.push({ t: 'tiering', total: ring.length });
  const rounds = d.rows.length - 2;
  for (let j = 1; j <= rounds; j++) {
    const beads = roundBeads(d.rows, j + 1);
    let k = 0;
    for (const size of chunkSizes(beads.length, 7)) {
      out.push({ t: 'round', round: j, rounds, from: k, beads: beads.slice(k, k + size), perRound: beads.length });
      k += size;
    }
    if (j < rounds) out.push({ t: 'stepup', round: j });
  }
  out.push({ t: 'tie', style: 'peyote' });
  return out;
}

/** X-base: base ring in whole units, tie, then group rounds and the pair round, step-ups between. */
function xbaseSteps(d: XBaseDesign): Step[] {
  const out: Step[] = [];
  const n = unitsAround(d);
  const top = topRow(d);
  const ring = d.rows[0];
  let u = 0;
  for (const size of chunkSizes(n, 2)) {
    out.push({ t: 'xring', from: 3 * u, beads: ring.slice(3 * u, 3 * (u + size)), total: ring.length });
    u += size;
  }
  out.push({ t: 'xtie', total: ring.length });
  for (let r = 1; r <= top; r++) {
    const pairs = r === top;
    const per = pairs ? 2 : 3;
    const groups = Array.from({ length: n }, (_, g) => d.rows[r].slice(per * g, per * g + per));
    let g = 0;
    for (const size of chunkSizes(n, pairs ? 4 : 3)) {
      out.push({ t: 'xround', round: r, rounds: top, kind: pairs ? 'pairs' : 'groups', from: g, groups: groups.slice(g, g + size), count: n });
      g += size;
    }
    if (!pairs) out.push({ t: 'xup', round: r });
  }
  out.push({ t: 'tie', style: 'xbase' });
  return out;
}

// ---------------------------------------------------------------------------
// Cord length. A model of the cord path, in mm, padded and rounded up.
// Checked against published patterns: the Dorr Library turtle asks for 60 in,
// the Brooklyn Bridge Park lizard for about 4 ft; this model gives more for both.

const TIE_ALLOWANCE = 150; // per cord end, enough for a child to tie a double knot
const MM_PER_IN = 25.4;

function rowGap(wPrev: number, w: number, layerChange: boolean): number {
  const dx = (Math.abs(w - wPrev) * BEAD.length) / 2;
  const dy = layerChange ? BEAD.diameter * 0.75 : BEAD.diameter;
  return Math.hypot(dx, dy) + 3 + (layerChange ? 4 : 0);
}

function legUse(leg: Leg): number {
  return leg.stem.length * BEAD.length * 2 + leg.toes.length * BEAD.length + 8 + (leg.toes.length > 1 ? 6 : 0);
}

/** Cord used by each of the two cord ends (left/right after row 1) plus the shared middle, in mm. */
export function weaveCordUse(rows: WeaveRow[], keyring: boolean, closeBand: boolean) {
  let middle = 0;
  // Track the two physical cord ends; after each crossed row they swap sides.
  const use = { A: 0, B: 0 };
  let left: 'A' | 'B' = 'A';
  const right = () => (left === 'A' ? 'B' : 'A');
  rows.forEach((r, i) => {
    const w = r.beads.length;
    if (i === 0) {
      if (keyring) {
        middle += 40; // lark's head knot around the ring
        use.A += 15 + w * BEAD.length;
        use.B += 15 + w * BEAD.length;
        left = 'B';
      } else {
        middle += w * BEAD.length;
      }
    } else {
      const prev = rows[i - 1];
      const g = rowGap(prev.beads.length, w, !!prev.belly !== !!r.belly);
      use.A += g + w * BEAD.length;
      use.B += g + w * BEAD.length;
      left = right();
    }
    if (r.legL) use[left] += legUse(r.legL);
    if (r.legR) use[right()] += legUse(r.legR);
  });
  if (closeBand) {
    const w = rows[0].beads.length;
    use[left] += rowGap(w, w, false) + w * BEAD.length;
  }
  use.A += TIE_ALLOWANCE;
  use.B += TIE_ALLOWANCE;
  return { middle, ...use };
}

function round(mm: number, kind: CordKind, minInches: number): Cord {
  const inches = Math.max(minInches, Math.ceil(mm / MM_PER_IN));
  return { kind, inches, cm: Math.round(inches * 2.54) };
}

export function cordFor(d: Design): Cord {
  if (d.kind === 'bracelet') {
    return round(d.beads.length * BEAD.length + 2 * 80, 'stretch', 10);
  }
  if (d.kind === 'xbase') {
    // One working end: tail, the base ring, then each group round goes round the cuff through
    // 3 new beads and an anchor per unit (with some slack in the arcs), knots, the pair round.
    const n = unitsAround(d);
    const groupRounds = topRow(d) - 1;
    const mm = 120 + 3 * n * BEAD.length + 60 + groupRounds * (n * (4 * BEAD.length + 8) + 40) + n * (3 * BEAD.length + 6) + 40 + 150;
    return round(mm * 1.15, 'stretch', 36);
  }
  if (d.kind === 'peyote') {
    // One working end: a short tail to tie the ring, the ring itself, then every round runs once
    // round the cuff (through the new beads and the raised ones) plus the step-up, then the tie-off.
    const circ = around(d) * BEAD.length;
    const rounds = d.rows.length - 2;
    const mm = 120 + circ + 60 + rounds * (circ * 1.15 + BEAD.length * 2) + 150;
    return round(mm * 1.1, 'stretch', 36);
  }
  const rows = weaveRows(d)!;
  const u = weaveCordUse(rows, usesKeyring(d), d.kind === 'cuff');
  const total = (u.middle + 2 * Math.max(u.A, u.B)) * 1.15;
  return round(total, d.kind === 'cuff' ? 'stretch' : 'lace', 24);
}

// ---------------------------------------------------------------------------

export interface BeadCount {
  color: ColorId;
  count: number;
}

/** Bead totals per color, most-used first. */
export function beadCounts(d: Design): BeadCount[] {
  const m = new Map<ColorId, number>();
  const add = (c: ColorId) => m.set(c, (m.get(c) ?? 0) + 1);
  if (d.kind === 'bracelet') d.beads.forEach(add);
  else if (d.kind === 'peyote' || d.kind === 'xbase') d.rows.forEach((r) => r.forEach(add));
  else
    for (const r of weaveRows(d)!) {
      r.beads.forEach(add);
      for (const leg of [r.legL, r.legR]) if (leg) [...leg.stem, ...leg.toes].forEach(add);
    }
  return [...m.entries()].map(([color, count]) => ({ color, count })).sort((a, b) => b.count - a.count || a.color.localeCompare(b.color));
}

export function totalBeads(d: Design): number {
  return beadCounts(d).reduce((s, b) => s + b.count, 0);
}

/** Beads strung during one step, in stringing order. */
export function stepBeads(s: Step): ColorId[] {
  switch (s.t) {
    case 'row':
    case 'string':
    case 'ring':
    case 'round':
    case 'xring':
      return s.beads;
    case 'xround':
      return s.groups.flat();
    case 'leg':
      return [...s.stem, ...s.toes];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Build progress after an edit

/** The parts of a design that affect what gets built (not its name or progress). */
export function buildBody(d: Design): string {
  switch (d.kind) {
    case 'bracelet':
      return JSON.stringify(['bracelet', d.beads]);
    case 'cuff':
      return JSON.stringify(['cuff', d.rows]);
    case 'peyote':
      return JSON.stringify(['peyote', d.rows]);
    case 'xbase':
      return JSON.stringify(['xbase', d.rows]);
    default:
      return JSON.stringify([d.kind, d.keyring, d.rows]);
  }
}

/**
 * Where to resume making a design after it was edited. Pages: 0 = bead list, k = step k,
 * steps+1 = done. If a step she already passed changed, she goes back to it, so the
 * instructions never skip something different from what she has strung. A different cord
 * length alone doesn't send her back (the cut step is skipped).
 */
export function progressAfterEdit(before: Design, after: Design, page: number): number {
  if (page <= 0 || buildBody(before) === buildBody(after)) return page;
  const a = steps(before);
  const b = steps(after);
  const n = Math.max(a.length, b.length);
  for (let i = 1; i < n; i++) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return Math.min(page, i + 1);
  }
  return Math.min(page, b.length + 1);
}
