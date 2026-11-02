import { legBeads } from '../core/geometry';
import type { Step } from '../core/steps';
import { BEAD, type ColorId } from '../core/types';
import { Bead } from './Bead';

const PINK = '#ff4f9a';
const BLUE = '#3b82f6';
const GREY = 's-pale-blue';

function Arrow({ id, color }: { id: string; color: string }) {
  return (
    <marker id={id} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
      <path d="M0 0L10 5L0 10z" fill={color} />
    </marker>
  );
}

function Label({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-text.length * 1.45 - 2.2} y={-3.4} width={text.length * 2.9 + 4.4} height={6.8} rx={3.4} fill={color} />
      <text x={0} y={1.35} text-anchor="middle" font-size="3.9" font-weight="700" fill="#fff">
        {text}
      </text>
    </g>
  );
}

function rowX(n: number, i: number) {
  return (i - (n - 1) / 2) * BEAD.length;
}

/** String on the left cord (pink), push the right cord (blue) back through. */
function CrossRow({ beads, belly }: { beads: ColorId[]; belly: boolean }) {
  const n = beads.length;
  const half = (n / 2) * BEAD.length;
  const prevN = Math.max(1, Math.min(n, 3));
  const prevHalf = (prevN / 2) * BEAD.length;
  const w = Math.max(half * 2 + 56, 70);
  const py = -11;
  return (
    <svg viewBox={`${-w / 2} -22 ${w} ${belly ? 44 : 36}`} role="img" aria-label="How to weave this row">
      <defs>
        <Arrow id="ah-p" color={PINK} />
        <Arrow id="ah-b" color={BLUE} />
      </defs>
      {Array.from({ length: prevN }, (_, i) => (
        <Bead key={`p${i}`} x={rowX(prevN, i)} y={py} angle={0} color={GREY} dim />
      ))}
      <text x={-w / 2 + 2} y={py + 1.3} font-size="3.4" fill="#9a8aa6">
        last row
      </text>
      {/* left cord: comes from the last row, goes through the new beads, exits right */}
      <path d={`M${-prevHalf} ${py} C ${-half - 10} ${py}, ${-half - 10} -1, ${-half} -1 L ${half + 15} -1`} fill="none" stroke={PINK} stroke-width="1.2" marker-end="url(#ah-p)" />
      {/* right cord: comes from the last row, enters on the right, exits left */}
      <path d={`M${prevHalf} ${py} C ${half + 10} ${py}, ${half + 10} 1, ${half} 1 L ${-half - 15} 1`} fill="none" stroke={BLUE} stroke-width="1.2" marker-end="url(#ah-b)" />
      {beads.map((c, i) => (
        <Bead key={i} x={rowX(n, i)} y={0} angle={0} color={c} />
      ))}
      <Label x={-half - 10} y={-6} text="1 string" color={PINK} />
      <Label x={half + 10} y={7.5} text="2 push" color={BLUE} />
      {belly && (
        <g>
          <path d={`M0 7 C 10 16, -10 18, 0 ${py + 25}`} fill="none" stroke="#7a5c99" stroke-width="1" stroke-dasharray="1.6 1.2" marker-end="url(#ah-p)" />
          <Label x={0} y={17} text="tuck under" color="#7a5c99" />
        </g>
      )}
    </svg>
  );
}

function CenterRow({ beads }: { beads: ColorId[] }) {
  const n = beads.length;
  const half = (n / 2) * BEAD.length;
  const w = half * 2 + 70;
  return (
    <svg viewBox={`${-w / 2} -12 ${w} 24`} role="img" aria-label="Slide the beads to the middle of the cord">
      <defs>
        <Arrow id="ah-c" color={PINK} />
      </defs>
      <line x1={-w / 2 + 2} y1={0} x2={w / 2 - 2} y2={0} stroke={PINK} stroke-width="1.2" />
      <path d={`M${-half - 26} -7 L ${-half - 6} -7`} stroke={PINK} stroke-width="1.2" marker-end="url(#ah-c)" />
      <path d={`M${half + 26} -7 L ${half + 6} -7`} stroke={PINK} stroke-width="1.2" marker-end="url(#ah-c)" />
      {beads.map((c, i) => (
        <Bead key={i} x={rowX(n, i)} y={0} angle={0} color={c} />
      ))}
      <text x={0} y={10.5} text-anchor="middle" font-size="3.6" fill="#7b6688" font-weight="600">
        middle of the cord
      </text>
    </svg>
  );
}

function LegHow({ side, stem, toes }: { side: 'L' | 'R'; stem: ColorId[]; toes: ColorId[] }) {
  const dir = side === 'L' ? -1 : 1;
  const x0 = dir * 9;
  const placed = legBeads({ stem, toes }, side, x0, 0, 0);
  const far = Math.max(...placed.map((p) => Math.abs(p.x))) + 8;
  const w = far * 2 + 6;
  const stemEnd = x0 + dir * stem.length * BEAD.length;
  return (
    <svg viewBox={`${-w / 2} -15 ${w} 30`} role="img" aria-label="How to make this leg">
      <defs>
        <Arrow id="ah-l" color={PINK} />
        <Arrow id="ah-l2" color="#7a5c99" />
      </defs>
      {[-1, 0, 1].map((i) => (
        <Bead key={`r${i}`} x={i * BEAD.length} y={0} angle={0} color={GREY} dim />
      ))}
      <path d={`M${x0} -1 L ${stemEnd + dir * 3} -1`} stroke={PINK} stroke-width="1.1" fill="none" />
      <path d={`M${stemEnd + dir * 2} 2.2 L ${x0 + dir * 1} 2.2`} stroke="#7a5c99" stroke-width="1.1" fill="none" stroke-dasharray="1.6 1.1" marker-end="url(#ah-l2)" />
      {placed.map((p, i) => (
        <Bead key={i} x={p.x} y={p.y} angle={p.angle} color={p.color} glow={p.part === 'stem'} />
      ))}
      <Label x={(x0 + stemEnd) / 2} y={-9} text="1 string all" color={PINK} />
      <Label x={(x0 + stemEnd) / 2} y={10} text={`2 back through ${stem.length}`} color="#7a5c99" />
    </svg>
  );
}

function KeyringHow() {
  return (
    <svg viewBox="-30 -22 60 44" role="img" aria-label="Fold the cord and loop it onto the key ring">
      <circle cx="0" cy="-10" r="8" fill="none" stroke="#9aa3ad" stroke-width="2.2" />
      <path d="M-3 -3 C -3 -12, 3 -12, 3 -3" fill="none" stroke={PINK} stroke-width="1.6" />
      <path d="M-3 -3 C -6 2, -9 8, -14 18" fill="none" stroke={PINK} stroke-width="1.6" />
      <path d="M3 -3 C 6 2, 9 8, 14 18" fill="none" stroke={PINK} stroke-width="1.6" />
      <path d="M-4 -1 L 4 -1" stroke={PINK} stroke-width="1.6" />
      <text x="-26" y="18" font-size="4" fill="#7b6688" font-weight="600">
        left
      </text>
      <text x="17" y="18" font-size="4" fill="#7b6688" font-weight="600">
        right
      </text>
    </svg>
  );
}

function KnotHow() {
  return (
    <svg viewBox="-30 -16 60 32" role="img" aria-label="Tie a double knot">
      <path d="M-28 6 C -12 6, -6 -10, 2 -6 C 10 -2, 0 8, -6 2 C -10 -2, 6 -8, 28 6" fill="none" stroke={PINK} stroke-width="1.8" />
      <path d="M-28 -6 C -12 -6, -4 10, 4 6 C 12 2, 2 -8, -4 -2 C -8 2, 8 8, 28 -6" fill="none" stroke={BLUE} stroke-width="1.8" />
      <text x="0" y="14" text-anchor="middle" font-size="4" fill="#7b6688" font-weight="600">
        knot + knot
      </text>
    </svg>
  );
}

function CloseHow() {
  const n = 14;
  return (
    <svg viewBox="-30 -26 60 52" role="img" aria-label="Bend the band into a circle and join the ends">
      <defs>
        <Arrow id="ah-x" color={PINK} />
      </defs>
      {Array.from({ length: n }, (_, i) => {
        const a = -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / n;
        return <Bead key={i} x={18 * Math.cos(a)} y={18 * Math.sin(a)} angle={(a * 180) / Math.PI} color={i === 0 ? 's-hot-pink' : GREY} dim={i !== 0 && i !== n - 1} glow={i === 0} />;
      })}
      <path d="M-14 -24 C -6 -28, 4 -28, 12 -23" fill="none" stroke={PINK} stroke-width="1.2" marker-end="url(#ah-x)" />
      <text x="0" y="3" text-anchor="middle" font-size="4.4" fill="#7b6688" font-weight="700">
        Row 1
      </text>
    </svg>
  );
}

function CutHow({ inches }: { inches: number }) {
  return (
    <svg viewBox="0 0 100 34" role="img" aria-label={`Measure ${inches} inches`}>
      <rect x="4" y="4" width="92" height="12" rx="2" fill="#ffe08a" stroke="#d9a62b" stroke-width="0.6" />
      {Array.from({ length: 19 }, (_, i) => (
        <line key={i} x1={8 + i * 4.6} y1="4" x2={8 + i * 4.6} y2={i % 2 ? 8 : 10} stroke="#9c6f00" stroke-width="0.5" />
      ))}
      <path d="M4 24 C 30 20, 60 28, 92 23" fill="none" stroke={PINK} stroke-width="1.6" />
      <text x="50" y="33" text-anchor="middle" font-size="5" font-weight="700" fill="#3a2547">
        {inches} in
      </text>
    </svg>
  );
}

function TapeHow() {
  return (
    <svg viewBox="0 0 80 24" role="img" aria-label="Tape the end of the cord">
      <path d="M4 12 L 76 12" stroke={PINK} stroke-width="1.6" />
      <rect x="62" y="5" width="12" height="14" rx="1.5" fill="#fff6c9" stroke="#e5c84f" stroke-width="0.6" transform="rotate(-8 68 12)" />
    </svg>
  );
}

export function HowTo({ step }: { step: Step }) {
  switch (step.t) {
    case 'row':
      return step.mode === 'center' ? <CenterRow beads={step.beads} /> : <CrossRow beads={step.beads} belly={step.belly} />;
    case 'leg':
      return <LegHow side={step.side} stem={step.stem} toes={step.toes} />;
    case 'keyring':
      return <KeyringHow />;
    case 'tie':
      return <KnotHow />;
    case 'close':
      return <CloseHow />;
    case 'cut':
      return <CutHow inches={step.cord.inches} />;
    case 'tape':
      return <TapeHow />;
    default:
      return null;
  }
}
