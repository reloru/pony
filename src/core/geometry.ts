import { BEAD, type ColorId, type Leg, type Side, type WeaveRow } from './types';

/** Where a bead lives in the design, so the editor can change it. */
export type BeadRef =
  | { t: 'row'; row: number; i: number }
  | { t: 'leg'; row: number; side: Side; part: 'stem' | 'toes'; i: number }
  | { t: 'ring'; i: number };

/** A bead in chart space (mm). `angle` is the direction of the hole, in degrees (0 = left-right). */
export interface Placed {
  key: string;
  x: number;
  y: number;
  angle: number;
  color: ColorId;
  ref: BeadRef;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundsOf(beads: { x: number; y: number }[], pad = BEAD.diameter / 2 + 1): Bounds {
  if (!beads.length) return { minX: -10, minY: -10, maxX: 10, maxY: 10 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const b of beads) {
    minX = Math.min(minX, b.x);
    maxX = Math.max(maxX, b.x);
    minY = Math.min(minY, b.y);
    maxY = Math.max(maxY, b.y);
  }
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

export const ROW_PITCH = BEAD.diameter;

export function rowBeadX(width: number, i: number): number {
  return (i - (width - 1) / 2) * BEAD.length;
}

/** Tilt for legs: arms near the top point up, legs near the bottom point down. */
export function legTilt(row: number, rowCount: number): number {
  if (rowCount < 3) return 0;
  const t = row / (rowCount - 1);
  if (t < 0.34) return -25;
  if (t > 0.66) return 25;
  return 0;
}

/** Positions of the beads of one leg, starting from the row end at (x0, y0). */
export function legBeads(
  leg: Leg,
  side: Side,
  x0: number,
  y0: number,
  tiltDeg: number,
): { x: number; y: number; angle: number; color: ColorId; part: 'stem' | 'toes'; i: number }[] {
  const dirX = side === 'L' ? -1 : 1;
  const a = (tiltDeg * Math.PI) / 180;
  const ux = dirX * Math.cos(a);
  const uy = Math.sin(a);
  const holeAngle = (Math.atan2(uy, ux) * 180) / Math.PI;
  const out: { x: number; y: number; angle: number; color: ColorId; part: 'stem' | 'toes'; i: number }[] = [];
  const L = BEAD.length;
  leg.stem.forEach((c, i) => {
    const d = (i + 0.5) * L;
    out.push({ x: x0 + ux * d, y: y0 + uy * d, angle: holeAngle, color: c, part: 'stem', i });
  });
  const endD = leg.stem.length * L;
  if (leg.toes.length === 1) {
    const d = endD + 0.5 * L;
    out.push({ x: x0 + ux * d, y: y0 + uy * d, angle: holeAngle, color: leg.toes[0], part: 'toes', i: 0 });
  } else {
    const t = leg.toes.length;
    const r = ((t + 1) * L) / (2 * Math.PI);
    const cx = x0 + ux * (endD + r);
    const cy = y0 + uy * (endD + r);
    const back = Math.atan2(-uy, -ux);
    // Walk round the loop the same way on both sides so the picture is mirror-symmetric.
    const turn = side === 'L' ? -1 : 1;
    leg.toes.forEach((c, i) => {
      const th = back + turn * (i + 1) * ((2 * Math.PI) / (t + 1));
      const tx = cx + r * Math.cos(th);
      const ty = cy + r * Math.sin(th);
      out.push({ x: tx, y: ty, angle: (th * 180) / Math.PI + 90, color: c, part: 'toes', i });
    });
  }
  return out;
}

/** Chart layout for ladder-weave rows (shapes, critters, cuffs): rows stacked top to bottom, centered. */
export function weaveLayout(rows: WeaveRow[]): Placed[] {
  const out: Placed[] = [];
  rows.forEach((r, row) => {
    const w = r.beads.length;
    const y = row * ROW_PITCH;
    r.beads.forEach((c, i) => {
      out.push({ key: `r${row}-${i}`, x: rowBeadX(w, i), y, angle: 0, color: c, ref: { t: 'row', row, i } });
    });
    const tilt = legTilt(row, rows.length);
    const half = (w / 2) * BEAD.length;
    for (const [side, leg] of [
      ['L', r.legL],
      ['R', r.legR],
    ] as [Side, Leg | undefined][]) {
      if (!leg) continue;
      const x0 = side === 'L' ? -half : half;
      for (const b of legBeads(leg, side, x0, y, tilt)) {
        out.push({
          key: `l${row}${side}${b.part}${b.i}`,
          x: b.x,
          y: b.y,
          angle: b.angle,
          color: b.color,
          ref: { t: 'leg', row, side, part: b.part, i: b.i },
        });
      }
    }
  });
  return out;
}

/** Bracelet beads around a circle, bead 1 at the top, going clockwise. */
export function ringLayout(beads: ColorId[]): Placed[] {
  const n = beads.length;
  const r = Math.max((n * BEAD.length) / (2 * Math.PI), 12);
  return beads.map((c, i) => {
    const th = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return {
      key: `b${i}`,
      x: r * Math.cos(th),
      y: r * Math.sin(th),
      angle: (th * 180) / Math.PI + 90,
      color: c,
      ref: { t: 'ring', i },
    };
  });
}

export function ringRadius(n: number): number {
  return Math.max((n * BEAD.length) / (2 * Math.PI), 12);
}

// ---------------------------------------------------------------------------
// Peyote: column c, row r. Neighbouring columns are a bead-length apart (6 mm, along the hole);
// a column's beads are a bead-width apart, but each row is only half a bead above the last.

export const PEYOTE_ROW = BEAD.diameter / 2;

/** Editor/map chart: columns run down the screen, rows go left to right (ring on the left). */
export function peyoteChart(rows: ColorId[][]): Placed[] {
  const out: Placed[] = [];
  rows.forEach((row, r) =>
    row.forEach((c, k) => {
      const col = 2 * k + (r % 2);
      out.push({ key: `r${r}-${k}`, x: r * PEYOTE_ROW, y: col * BEAD.length, angle: 90, color: c, ref: { t: 'row', row: r, i: k } });
    }),
  );
  return out;
}

/** The cuff seen flat, like a band: columns left to right, ring at the top. */
export function peyoteStrip(rows: ColorId[][]): Placed[] {
  const out: Placed[] = [];
  rows.forEach((row, r) =>
    row.forEach((c, k) => {
      const col = 2 * k + (r % 2);
      out.push({ key: `r${r}-${k}`, x: col * BEAD.length, y: r * PEYOTE_ROW, angle: 0, color: c, ref: { t: 'row', row: r, i: k } });
    }),
  );
  return out;
}
