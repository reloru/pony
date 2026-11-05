import { BEAD, LIMITS, type ColorId, type XBaseDesign } from './types';

/**
 * Kandi X-base cuff (the base for rotator cuffs), as taught by pieceofkandi and others:
 *
 *   rows[0]       base ring, in stringing order: (connector, pair, pair) × n, tied in a ring.
 *   rows[1..2h]   group rows: n groups of 3 beads (side, middle, side). Group i is strung
 *                 between anchor i and anchor i+1 of the level below; its middle bead is
 *                 anchor i of this level. Level-0 anchors are the base connectors.
 *   rows[last]    top pairs: 2 beads between neighbouring anchors of the last group row.
 *
 * h = number of X's high (2 group rows per X). The X centres are the middles of the odd group
 * rows. Making it (the app's convention): one cord, a knot at the end of each round, every
 * round starting from anchor 0 (the connector right after the knot, then group 1's middle).
 */

export const unitsAround = (d: { rows: ColorId[][] }) => Math.floor((d.rows[0]?.length ?? 0) / 3);
export const xHigh = (d: { rows: ColorId[][] }) => Math.max(0, (d.rows.length - 2) / 2);
export const topRow = (d: { rows: ColorId[][] }) => d.rows.length - 1;

/** Bead index (row, i) of anchor `a` at `level` (0 = base connectors). */
export function anchorRef(level: number, a: number): { row: number; i: number } {
  return level === 0 ? { row: 0, i: 3 * a } : { row: level, i: 3 * a + 1 };
}

// ---------------------------------------------------------------------------
// Chart geometry (mm). One unit (connector + pair) is three beads wide along the ring.

export const UNIT = 3 * BEAD.length;
export const LEVEL = 8;
const SIDE_ANGLE = (Math.atan2(LEVEL / 2, UNIT / 4) * 180) / Math.PI;

export interface XPos {
  row: number;
  i: number;
  /** position round the cuff, 0 ≤ x < n·UNIT */
  x: number;
  /** distance from the base edge */
  y: number;
  /** cord direction through the bead, degrees */
  angle: number;
}

export function xbasePositions(rows: ColorId[][]): XPos[] {
  const n = unitsAround({ rows });
  const W = n * UNIT;
  const wrap = (x: number) => ((x % W) + W) % W;
  const out: XPos[] = [];
  const top = rows.length - 1;
  rows.forEach((row, r) =>
    row.forEach((_, i) => {
      if (r === 0) {
        const u = Math.floor(i / 3);
        const k = i % 3;
        out.push({ row: r, i, x: wrap(u * UNIT + k * BEAD.length), y: k === 0 ? 0 : -2, angle: 0 });
      } else if (r === top) {
        const u = Math.floor(i / 2);
        const k = i % 2;
        const a = u * UNIT + ((r - 1) * UNIT) / 2;
        out.push({ row: r, i, x: wrap(a + (k + 1) * BEAD.length), y: (r - 1) * LEVEL + 2, angle: 0 });
      } else {
        const g = Math.floor(i / 3);
        const k = i % 3;
        const a = g * UNIT + ((r - 1) * UNIT) / 2; // anchor below, at level r-1
        if (k === 1) out.push({ row: r, i, x: wrap(a + UNIT / 2), y: r * LEVEL, angle: 0 });
        else out.push({ row: r, i, x: wrap(a + (k === 0 ? UNIT / 4 : (3 * UNIT) / 4)), y: (r - 0.5) * LEVEL, angle: k === 0 ? SIDE_ANGLE : -SIDE_ANGLE });
      }
    }),
  );
  return out;
}

// ---------------------------------------------------------------------------
// Cord adjacency (for Fill) and mirror

/** Beads joined to (row, i) by the cord. */
export function xbaseNeighbours(d: XBaseDesign, row: number, i: number): { row: number; i: number }[] {
  const n = unitsAround(d);
  const top = topRow(d);
  const out: { row: number; i: number }[] = [];
  const add = (r: number, k: number) => out.push({ row: r, i: k });
  if (row === 0) {
    add(0, (i + 1) % (3 * n));
    add(0, (i + 3 * n - 1) % (3 * n));
  } else if (row === top) {
    const u = Math.floor(i / 2);
    if (i % 2 === 0) {
      add(row, i + 1);
      const a = anchorRef(row - 1, u);
      add(a.row, a.i);
    } else {
      add(row, i - 1);
      const a = anchorRef(row - 1, (u + 1) % n);
      add(a.row, a.i);
    }
  } else {
    const g = Math.floor(i / 3);
    const k = i % 3;
    if (k === 1) add(row, i - 1), add(row, i + 1);
    else {
      add(row, 3 * g + 1);
      const a = anchorRef(row - 1, k === 0 ? g : (g + 1) % n);
      add(a.row, a.i);
    }
  }
  // Anything strung onto this bead from the row above.
  if (row < top) {
    const isAnchor = row === 0 ? i % 3 === 0 : i % 3 === 1;
    if (isAnchor) {
      const a = row === 0 ? i / 3 : (i - 1) / 3;
      if (row + 1 === top) add(top, 2 * a), add(top, (2 * a - 1 + 2 * n) % (2 * n));
      else add(row + 1, 3 * a), add(row + 1, (3 * a - 1 + 3 * n) % (3 * n));
    }
  }
  return out;
}

const key = (row: number, x: number) => `${row}:${Math.round(x * 100)}`;

/** Mirror across the line x = 0 (and x = half way round): same row, mirrored position. */
export function xbaseMirror(d: XBaseDesign, row: number, i: number): { row: number; i: number } | null {
  const n = unitsAround(d);
  const W = n * UNIT;
  const pos = xbasePositions(d.rows);
  const me = pos.find((p) => p.row === row && p.i === i);
  if (!me) return null;
  const want = key(row, (W - me.x) % W);
  const hit = pos.find((p) => key(p.row, p.x) === want);
  return hit ? { row: hit.row, i: hit.i } : null;
}

// ---------------------------------------------------------------------------
// Resizing

function unitSlices(d: XBaseDesign): ColorId[][][] {
  const n = unitsAround(d);
  const top = topRow(d);
  return Array.from({ length: n }, (_, u) => d.rows.map((r, ri) => (ri === top ? r.slice(2 * u, 2 * u + 2) : r.slice(3 * u, 3 * u + 3))));
}

function fromUnits(units: ColorId[][][], rowCount: number): ColorId[][] {
  return Array.from({ length: rowCount }, (_, r) => units.flatMap((u) => u[r]));
}

/** One more or fewer unit round the cuff (three base beads), keeping a repeating pattern going. */
export function changeUnits(d: XBaseDesign, delta: 1 | -1): XBaseDesign {
  const n = unitsAround(d);
  const next = n + delta;
  if (next < LIMITS.xbase.minUnits || next > LIMITS.xbase.maxUnits) return d;
  const units = unitSlices(d);
  if (delta === 1) {
    const keys = units.map((u) => JSON.stringify(u));
    let p = 1;
    while (p < n && keys.some((k, j) => j >= p && k !== keys[j - p])) p++;
    units.push(JSON.parse(keys[n - p]) as ColorId[][]);
  } else units.pop();
  return { ...d, rows: fromUnits(units, d.rows.length) };
}

/** One more or fewer X high (two group rows), repeating the last X when it grows. */
export function changeHeight(d: XBaseDesign, delta: 1 | -1): XBaseDesign {
  const h = xHigh(d);
  const next = h + delta;
  if (next < LIMITS.xbase.minHigh || next > LIMITS.xbase.maxHigh) return d;
  const rows = d.rows.map((r) => [...r]);
  const top = rows.pop()!;
  if (delta === 1) rows.push([...rows[rows.length - 2]], [...rows[rows.length - 1]]);
  else rows.splice(rows.length - 2, 2);
  rows.push(top);
  return { ...d, rows };
}
