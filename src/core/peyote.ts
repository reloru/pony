import { LIMITS, type ColorId, type PeyoteDesign } from './types';

/**
 * Even-count tubular peyote, the kandi "peyote" cuff.
 *
 * The tube has N columns around it (N even). Each column is a stack of beads; neighbouring
 * columns are offset by half a bead. Row r has a bead in every other column, the columns with
 * c % 2 === r % 2, so rows[r][k] sits in column 2k + (r % 2). Rows 0 and 1 are the starting
 * ring: strung as one circle, column 0 to N-1, alternating between the two rows.
 *
 * Making it (the app's convention): string the ring and tie it; the long end comes out of the
 * last ring bead, next to the knot. Each round: add a bead, skip the next bead, go through the
 * one after (the new bead drops into the gap above the bead it skipped). After the last bead of
 * a round, step up through the first bead of that round. So round j (row j+1) starts in column
 * j-1 and moves two columns each bead.
 */

export function around(d: { rows: ColorId[][] }): number {
  return (d.rows[0]?.length ?? 0) * 2;
}

export const colOf = (row: number, k: number) => 2 * k + (row % 2);
export const kOf = (row: number, col: number) => (col - (row % 2)) / 2;

/** The ring in stringing order: column 0, 1, 2 … alternating between rows 0 and 1. */
export function ringBeads(rows: ColorId[][]): ColorId[] {
  const n = around({ rows });
  return Array.from({ length: n }, (_, c) => rows[c % 2][kOf(c % 2, c)]);
}

/** Columns filled by the round that builds `row` (row ≥ 2), in the order the beads are added. */
export function roundColumns(row: number, n: number): number[] {
  const start = (((row - 2) % n) + n) % n;
  return Array.from({ length: n / 2 }, (_, i) => (start + 2 * i) % n);
}

/** Beads of a round in the order they are added. */
export function roundBeads(rows: ColorId[][], row: number): ColorId[] {
  const n = around({ rows });
  return roundColumns(row, n).map((c) => rows[row][kOf(row, c)]);
}

/** Split `n` items into chunks of at most `max`, as evenly as possible. */
export function chunkSizes(n: number, max: number): number[] {
  const count = Math.ceil(n / max);
  const base = Math.floor(n / count);
  const extra = n % count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

// ---------------------------------------------------------------------------
// Editing in column form: columns[c] lists the beads of column c from the ring upwards.

type Columns = ColorId[][];

function toColumns(rows: ColorId[][]): Columns {
  const n = around({ rows });
  const cols: Columns = Array.from({ length: n }, () => []);
  rows.forEach((row, r) => row.forEach((c, k) => cols[colOf(r, k)].push(c)));
  return cols;
}

function fromColumns(cols: Columns, rowCount: number): ColorId[][] {
  const rows: ColorId[][] = Array.from({ length: rowCount }, () => []);
  cols.forEach((col, c) =>
    col.forEach((color, j) => {
      const r = 2 * j + (c % 2);
      if (r < rowCount) rows[r][kOf(r, c)] = color;
    }),
  );
  return rows;
}

function periodOf<T>(seq: T[], step: number): number {
  const k = seq.map((x) => JSON.stringify(x));
  for (let p = step; p <= k.length; p += step) {
    let ok = true;
    for (let i = p; i < k.length && ok; i++) if (k[i] !== k[i - p]) ok = false;
    if (ok) return p;
  }
  return k.length;
}

/** Two beads more or fewer around (one per row), keeping a repeating pattern going. */
export function changeAround(d: PeyoteDesign, delta: 1 | -1): PeyoteDesign {
  const n = around(d);
  const next = n + 2 * delta;
  if (next < LIMITS.peyote.minAround || next > LIMITS.peyote.maxAround) return d;
  const cols = toColumns(d.rows);
  if (delta === 1) {
    const p = periodOf(cols, 2);
    cols.push([...cols[n - p]], [...cols[n - p + 1]]);
  } else cols.splice(n - 2, 2);
  return { ...d, rows: fromColumns(cols, d.rows.length) };
}

/** Grow or shrink the cuff to `count` rows, repeating the pattern when it grows. */
export function changeRows(d: PeyoteDesign, count: number): PeyoteDesign {
  const target = Math.max(LIMITS.peyote.minRows, Math.min(LIMITS.peyote.maxRows, count));
  const rows = d.rows.map((r) => [...r]);
  while (rows.length > target) rows.pop();
  while (rows.length < target) {
    const p = periodOf(rows, 2);
    rows.push([...rows[rows.length - p]]);
  }
  return { ...d, rows };
}

/** Cells touching (row, k): same column two rows away, and the four diagonal neighbours (wrapping round). */
export function peyoteNeighbours(d: PeyoteDesign, row: number, k: number): { row: number; i: number }[] {
  const n = around(d);
  const c = colOf(row, k);
  const out: { row: number; i: number }[] = [];
  for (const [dr, dc] of [
    [-2, 0],
    [2, 0],
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]) {
    const r = row + dr;
    if (r < 0 || r >= d.rows.length) continue;
    const cc = (((c + dc) % n) + n) % n;
    out.push({ row: r, i: kOf(r, cc) });
  }
  return out;
}

/** Mirror image across column 0 (and N/2): keeps the bead in the same row. */
export function peyoteMirror(d: PeyoteDesign, row: number, k: number): { row: number; i: number } {
  const n = around(d);
  const c = colOf(row, k);
  return { row, i: kOf(row, (n - c) % n) };
}
