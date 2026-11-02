import { boundsOf, legBeads, legTilt, ringLayout, ringRadius, rowBeadX, ROW_PITCH, weaveLayout, type BeadRef, type Placed } from '../core/geometry';
import { weaveRows } from '../core/steps';
import { BEAD, type Design, type Leg, type Side, type WeaveRow } from '../core/types';
import { Bead } from './Bead';

/** Chart placement of every bead in build order (rows top to bottom, each row centered). */
export function chartPlacements(d: Design): Placed[] {
  if (d.kind === 'bracelet') return ringLayout(d.beads);
  return weaveLayout(weaveRows(d)!);
}

/** What she would see looking down on a critter: belly rows tucked between and under the top rows. */
export function topViewPlacements(rows: WeaveRow[]): Placed[] {
  const under: Placed[] = [];
  const over: Placed[] = [];
  let y = 0;
  rows.forEach((r, row) => {
    if (row > 0) y += !!rows[row - 1].belly !== !!r.belly ? ROW_PITCH / 2 : ROW_PITCH;
    const target = r.belly ? under : over;
    const w = r.beads.length;
    r.beads.forEach((c, i) => target.push({ key: `r${row}-${i}`, x: rowBeadX(w, i), y, angle: 0, color: c, ref: { t: 'row', row, i } }));
    const half = (w / 2) * BEAD.length;
    for (const [side, leg] of [
      ['L', r.legL],
      ['R', r.legR],
    ] as [Side, Leg | undefined][]) {
      if (!leg) continue;
      for (const b of legBeads(leg, side, side === 'L' ? -half : half, y, legTilt(row, rows.length))) {
        over.push({ key: `l${row}${side}${b.part}${b.i}`, x: b.x, y: b.y, angle: b.angle, color: b.color, ref: { t: 'leg', row, side, part: b.part, i: b.i } });
      }
    }
  });
  return [...under, ...over];
}

/** A cuff laid flat sideways, like a band you could wrap round a wrist. */
export function cuffStripPlacements(rows: string[][]): Placed[] {
  const out: Placed[] = [];
  rows.forEach((r, row) =>
    r.forEach((c, i) => out.push({ key: `r${row}-${i}`, x: row * ROW_PITCH, y: rowBeadX(r.length, i), angle: 90, color: c, ref: { t: 'row', row, i } })),
  );
  return out;
}

export function previewPlacements(d: Design): Placed[] {
  if (d.kind === 'critter') return topViewPlacements(d.rows);
  if (d.kind === 'cuff') return cuffStripPlacements(d.rows);
  return chartPlacements(d);
}

export type Highlight = (ref: BeadRef) => 'on' | 'dim' | undefined;

interface Props {
  design: Design;
  /** 'preview' draws critters from above; 'chart' shows every row in build order */
  mode?: 'preview' | 'chart';
  highlight?: Highlight;
  class?: string;
  label?: string;
}

export function DesignView({ design, mode = 'preview', highlight, class: cls, label }: Props) {
  const beads = mode === 'preview' ? previewPlacements(design) : chartPlacements(design);
  const b = boundsOf(beads, 6.5);
  if (design.kind === 'bracelet') {
    const r = ringRadius(design.beads.length);
    b.minX = Math.min(b.minX, -r - 8);
    b.maxX = Math.max(b.maxX, r + 8);
  }
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const chartBelly = mode === 'chart' && design.kind === 'critter';
  return (
    <svg class={cls} viewBox={`${b.minX} ${b.minY} ${w} ${h}`} role="img" aria-label={label ?? design.name} preserveAspectRatio="xMidYMid meet">
      {design.kind === 'bracelet' && (
        <circle r={ringRadius(design.beads.length)} fill="none" stroke="#c9b8c4" stroke-width="0.6" stroke-dasharray="1.5 1.5" />
      )}
      {chartBelly &&
        design.rows.map((r, i) =>
          r.belly ? (
            <rect key={`band${i}`} x={b.minX + 1} y={i * ROW_PITCH - ROW_PITCH / 2} width={w - 2} height={ROW_PITCH} rx="3" fill="#7a5c99" fill-opacity="0.13" />
          ) : null,
        )}
      {beads.map((p) => {
        const hl = highlight?.(p.ref);
        return <Bead key={p.key} x={p.x} y={p.y} angle={p.angle} color={p.color} dim={hl === 'dim'} glow={hl === 'on'} />;
      })}
    </svg>
  );
}
