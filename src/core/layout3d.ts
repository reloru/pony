import { legBeads, legTilt, ringRadius, rowBeadX, ROW_PITCH } from './geometry';
import { BEAD, type ColorId, type Design, type Leg, type Side, type WeaveRow } from './types';
import { UNIT, xbasePositions } from './xbase';

/** One bead in 3D (mm, y up). `axis` is the unit direction of the hole. */
export interface Bead3D {
  p: [number, number, number];
  axis: [number, number, number];
  color: ColorId;
}

const LAYER_Z = 3.4;

/**
 * An approximate 3D arrangement for the preview. Real beadwork shifts with cord tension,
 * so this is a picture of the idea, not a measurement.
 */
export function layout3d(d: Design): Bead3D[] {
  switch (d.kind) {
    case 'bracelet':
      return bracelet3d(d.beads);
    case 'cuff':
      return cuff3d(d.rows);
    case 'flat':
      return weave3d(d.rows, false);
    case 'critter':
      return weave3d(d.rows, true);
    case 'peyote':
      return peyote3d(d.rows);
    case 'xbase':
      return xbase3d(d.rows);
  }
}

/** The X-base chart wrapped round a tube; each bead's hole follows the cord across the surface. */
function xbase3d(rows: ColorId[][]): Bead3D[] {
  const n = rows[0].length / 3;
  const W = n * UNIT;
  const r = W / (2 * Math.PI);
  return xbasePositions(rows).map((p) => {
    const th = (p.x / W) * 2 * Math.PI;
    const a = (p.angle * Math.PI) / 180;
    const t: [number, number, number] = [-Math.sin(th), Math.cos(th), 0];
    // along the cord: mostly round the tube, tilted along its axis for the diagonal side beads
    const axis: [number, number, number] = [t[0] * Math.cos(a), t[1] * Math.cos(a), Math.sin(a)];
    return { p: [r * Math.cos(th), r * Math.sin(th), p.y] as [number, number, number], axis, color: rows[p.row][p.i] };
  });
}

/** A tube: holes run round the cuff; each row sits half a bead above the one before. */
function peyote3d(rows: ColorId[][]): Bead3D[] {
  const n = rows[0].length * 2;
  const r = (n * BEAD.length) / (2 * Math.PI);
  const out: Bead3D[] = [];
  rows.forEach((row, ri) =>
    row.forEach((c, k) => {
      const col = 2 * k + (ri % 2);
      const th = (col * 2 * Math.PI) / n;
      out.push({ p: [r * Math.cos(th), r * Math.sin(th), ri * (BEAD.diameter / 2)], axis: [-Math.sin(th), Math.cos(th), 0], color: c });
    }),
  );
  return out;
}

function bracelet3d(beads: ColorId[]): Bead3D[] {
  const n = beads.length;
  const r = ringRadius(n);
  return beads.map((c, i) => {
    const th = Math.PI / 2 - (i * 2 * Math.PI) / n;
    return {
      p: [r * Math.cos(th), r * Math.sin(th), 0],
      axis: [-Math.sin(th), Math.cos(th), 0],
      color: c,
    };
  });
}

function cuff3d(rows: ColorId[][]): Bead3D[] {
  const L = rows.length;
  const r = (L * BEAD.diameter) / (2 * Math.PI);
  const out: Bead3D[] = [];
  rows.forEach((row, i) => {
    const th = Math.PI / 2 - (i * 2 * Math.PI) / L;
    row.forEach((c, j) => {
      out.push({ p: [r * Math.cos(th), r * Math.sin(th), rowBeadX(row.length, j)], axis: [0, 0, 1], color: c });
    });
  });
  return out;
}

function weave3d(rows: WeaveRow[], layered: boolean): Bead3D[] {
  const out: Bead3D[] = [];
  let y = 0;
  rows.forEach((r, i) => {
    if (i > 0) {
      const prev = rows[i - 1];
      y -= !!prev.belly !== !!r.belly ? ROW_PITCH / 2 : ROW_PITCH;
    }
    const nearBelly = layered && (r.belly || rows[i - 1]?.belly || rows[i + 1]?.belly);
    const baseZ = !nearBelly ? 0 : r.belly ? -LAYER_Z : LAYER_Z;
    const w = r.beads.length;
    const halfSpan = Math.max(1, (w - 1) / 2);
    const curve = nearBelly ? 1.2 : 0;
    const sgn = r.belly ? 1 : -1;
    r.beads.forEach((c, j) => {
      const u = (j - (w - 1) / 2) / halfSpan;
      const z = baseZ + sgn * curve * u * u;
      const slope = sgn * curve * 2 * u * (1 / halfSpan) / BEAD.length;
      const len = Math.hypot(1, slope);
      out.push({ p: [rowBeadX(w, j), y, z], axis: [1 / len, 0, slope / len], color: c });
    });
    const tilt = legTilt(i, rows.length);
    const half = (w / 2) * BEAD.length;
    for (const [side, leg] of [
      ['L', r.legL],
      ['R', r.legR],
    ] as [Side, Leg | undefined][]) {
      if (!leg) continue;
      const x0 = side === 'L' ? -half : half;
      const zEnd = baseZ + sgn * curve;
      for (const b of legBeads(leg, side, x0, 0, tilt)) {
        const a = (b.angle * Math.PI) / 180;
        // chart y grows downward; 3D y grows upward
        out.push({ p: [b.x, y - b.y, zEnd], axis: [Math.cos(a), -Math.sin(a), 0], color: b.color });
      }
    }
  });
  return out;
}
