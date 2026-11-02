import { BEAD, type ColorId, type Design, type Leg, type Side, type WeaveRow } from './types';

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
  | { t: 'tie'; style: 'bracelet' | 'weave' | 'cuff' };

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
      return s.beads;
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
