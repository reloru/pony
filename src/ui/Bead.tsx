import { memo } from 'preact/compat';
import { color } from '../core/colors';
import { shade } from '../core/colormath';
import { BEAD } from '../core/types';

/** Shared gradients, rendered once at the app root and referenced by id from every SVG. */
export function BeadDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <linearGradient id="bd-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity="0.55" />
          <stop offset="0.28" stop-color="#fff" stop-opacity="0.12" />
          <stop offset="0.62" stop-color="#000" stop-opacity="0" />
          <stop offset="1" stop-color="#000" stop-opacity="0.32" />
        </linearGradient>
        <linearGradient id="bd-ends" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#000" stop-opacity="0.22" />
          <stop offset="0.2" stop-color="#000" stop-opacity="0" />
          <stop offset="0.8" stop-color="#000" stop-opacity="0" />
          <stop offset="1" stop-color="#000" stop-opacity="0.22" />
        </linearGradient>
        <radialGradient id="bd-pearl" cx="0.35" cy="0.25" r="0.75">
          <stop offset="0" stop-color="#fff" stop-opacity="0.95" />
          <stop offset="0.35" stop-color="#fff" stop-opacity="0.35" />
          <stop offset="1" stop-color="#fff" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="bd-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity="0.85" />
          <stop offset="0.3" stop-color="#fff" stop-opacity="0" />
          <stop offset="0.7" stop-color="#fff" stop-opacity="0" />
          <stop offset="1" stop-color="#fff" stop-opacity="0.5" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const W = BEAD.length - 0.35;
const H = BEAD.diameter - 0.35;
const R = 2.3;

function starPoints(outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}
const STAR = starPoints(6, 2.9);

export interface BeadProps {
  x: number;
  y: number;
  /** hole direction in degrees */
  angle: number;
  color: string;
  dim?: boolean;
  glow?: boolean;
}

/** One pony bead seen from the side: 6 mm along the hole, 9 mm across. */
export const Bead = memo(function Bead({ x, y, angle, color: id, dim, glow }: BeadProps) {
  const c = color(id);
  const t = `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${angle.toFixed(1)})`;
  const opacity = dim ? 0.28 : 1;
  if (c.finish === 'star') {
    return (
      <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`} opacity={opacity}>
        {glow && <polygon points={starPoints(8, 4.2)} fill="none" stroke="#fff" stroke-width="2.2" />}
        <polygon points={STAR} fill={c.hex} stroke={shade(c.hex, -0.45)} stroke-width="0.5" stroke-linejoin="round" />
        <polygon points={STAR} fill="url(#bd-pearl)" opacity="0.6" />
        <circle r="1.2" fill={shade(c.hex, -0.5)} opacity="0.8" />
      </g>
    );
  }
  const edge = shade(c.hex, -0.4);
  return (
    <g transform={t} opacity={opacity}>
      {glow && <rect x={-W / 2 - 1.2} y={-H / 2 - 1.2} width={W + 2.4} height={H + 2.4} rx={R + 1} fill="none" stroke="#fff" stroke-width="1.6" />}
      {c.finish === 'clear' ? (
        <>
          <rect x={-W / 2} y={-H / 2} width={W} height={H} rx={R} fill={c.hex} fill-opacity="0.62" stroke={shade(c.hex, -0.25)} stroke-width="0.45" />
          <rect x={-W / 2 + 1.4} y={-H / 2 + 0.6} width={W - 2.8} height={H - 1.2} rx="1" fill={c.hex} fill-opacity="0.35" />
          <rect x={-W / 2} y={-H / 2} width={W} height={H} rx={R} fill="url(#bd-glass)" />
        </>
      ) : (
        <>
          <rect x={-W / 2} y={-H / 2} width={W} height={H} rx={R} fill={c.hex} stroke={edge} stroke-width="0.45" />
          <rect x={-W / 2} y={-H / 2} width={W} height={H} rx={R} fill="url(#bd-shade)" />
          <rect x={-W / 2} y={-H / 2} width={W} height={H} rx={R} fill="url(#bd-ends)" />
          {c.finish === 'pearl' && <rect x={-W / 2} y={-H / 2} width={W} height={H} rx={R} fill="url(#bd-pearl)" />}
        </>
      )}
    </g>
  );
});

/** A round color chip for palettes and bead lists, showing the finish. */
export function Swatch({ id, size = 40 }: { id: string; size?: number }) {
  const c = color(id);
  return (
    <svg width={size} height={size} viewBox="-10 -10 20 20" aria-hidden="true" class="swatch-svg">
      {c.finish === 'star' ? (
        <>
          <polygon points={starPoints(9.4, 4.6)} fill={c.hex} stroke={shade(c.hex, -0.45)} stroke-width="0.7" stroke-linejoin="round" />
          <polygon points={starPoints(9.4, 4.6)} fill="url(#bd-pearl)" opacity="0.55" />
        </>
      ) : (
        <>
          <circle r="9" fill={c.hex} fill-opacity={c.finish === 'clear' ? 0.6 : 1} stroke={shade(c.hex, -0.35)} stroke-width="0.8" />
          {c.finish === 'clear' && <circle r="9" fill="url(#bd-glass)" />}
          {c.finish !== 'clear' && <circle r="9" fill="url(#bd-shade)" />}
          {c.finish === 'pearl' && <circle r="9" fill="url(#bd-pearl)" />}
          <circle r="3" fill="#000" fill-opacity="0.18" />
        </>
      )}
    </svg>
  );
}
