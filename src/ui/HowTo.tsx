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
function CrossRow({ beads, belly, fromRing }: { beads: ColorId[]; belly: boolean; fromRing: boolean }) {
  const n = beads.length;
  const half = (n / 2) * BEAD.length;
  const prevN = Math.max(1, Math.min(n, 3));
  const prevHalf = fromRing ? 2.5 : (prevN / 2) * BEAD.length;
  const w = Math.max(half * 2 + 64, 80);
  const py = -12;
  return (
    <svg viewBox={`${-w / 2} -22 ${w} ${belly ? 46 : 36}`} role="img" aria-label="How to weave this row">
      <defs>
        <Arrow id="ah-p" color={PINK} />
        <Arrow id="ah-b" color={BLUE} />
      </defs>
      {fromRing ? (
        <circle cx="0" cy={py - 3} r="5" fill="none" stroke="#9aa3ad" stroke-width="1.6" />
      ) : (
        Array.from({ length: prevN }, (_, i) => <Bead key={`p${i}`} x={rowX(prevN, i)} y={py} angle={0} color={GREY} dim />)
      )}
      <text x={-w / 2 + 2} y={py + 1.3} font-size="3.4" fill="#9a8aa6">
        {fromRing ? 'key ring' : 'last row'}
      </text>
      {/* left cord: comes from the last row, goes through the new beads, exits right */}
      <path d={`M${-prevHalf} ${py} C ${-half - 10} ${py}, ${-half - 10} -1, ${-half} -1 L ${half + 15} -1`} fill="none" stroke={PINK} stroke-width="1.2" marker-end="url(#ah-p)" />
      {/* right cord: comes from the last row, enters on the right, exits left */}
      <path d={`M${prevHalf} ${py} C ${half + 10} ${py}, ${half + 10} 1, ${half} 1 L ${-half - 15} 1`} fill="none" stroke={BLUE} stroke-width="1.2" marker-end="url(#ah-b)" />
      {beads.map((c, i) => (
        <Bead key={i} x={rowX(n, i)} y={0} angle={0} color={c} />
      ))}
      <Label x={-half - 19} y={5.5} text="1 string" color={PINK} />
      <Label x={half + 18} y={5.5} text="2 push" color={BLUE} />
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
  const w = Math.max(far * 2 + 6, 70);
  const stemEnd = x0 + dir * stem.length * BEAD.length;
  return (
    <svg viewBox={`${-w / 2} -18 ${w} 36`} role="img" aria-label="How to make this leg">
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
      <Label x={dir * 14} y={-12.5} text="1 string all" color={PINK} />
      <Label x={dir * 14} y={12.5} text={`2 back through ${stem.length}`} color="#7a5c99" />
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

/** Peyote ring: beads on the cord, short tail at the start, not tied yet. */
function RingHow({ beads }: { beads: ColorId[] }) {
  const n = beads.length;
  const w = n * BEAD.length + 60;
  const x0 = -w / 2 + 22;
  return (
    <svg viewBox={`${-w / 2} -12 ${w} 24`} role="img" aria-label="String the ring beads in order">
      <defs>
        <Arrow id="ah-r" color={PINK} />
      </defs>
      <path d={`M${-w / 2 + 2} 0 L ${w / 2 - 8} 0`} stroke={PINK} stroke-width="1.2" marker-end="url(#ah-r)" />
      {beads.map((c, i) => (
        <Bead key={i} x={x0 + (i + 0.5) * BEAD.length} y={0} angle={0} color={c} />
      ))}
      <text x={-w / 2 + 2} y={9} font-size="3.4" fill="#9a8aa6">
        short tail
      </text>
      <text x={w / 2 - 22} y={9} font-size="3.4" fill="#9a8aa6">
        long end
      </text>
    </svg>
  );
}

/** Tie the ring into a circle; the long end keeps going. */
function TieRingHow() {
  const n = 14;
  return (
    <svg viewBox="-30 -27 60 52" role="img" aria-label="Tie the ring closed with a double knot">
      {Array.from({ length: n }, (_, i) => {
        const a = -Math.PI / 2 + ((i + 0.5) * 2 * Math.PI) / n;
        return <Bead key={i} x={18 * Math.cos(a)} y={18 * Math.sin(a)} angle={(a * 180) / Math.PI + 90} color={GREY} dim />;
      })}
      <circle cx="0" cy="-18" r="2.6" fill={PINK} />
      <path d="M 1.5 -19.5 C 8 -27, 18 -26, 26 -24" fill="none" stroke={PINK} stroke-width="1.2" />
      <text x="0" y="2" text-anchor="middle" font-size="4.2" fill="#7b6688" font-weight="700">
        double knot
      </text>
      <text x="13" y="-21" font-size="3.4" fill="#7b6688">
        long end
      </text>
    </svg>
  );
}

/**
 * The peyote move, seen from the side: raised beads alternate with gaps. Add a bead into the
 * gap, then go through the next raised bead.
 */
function PeyoteRoundHow({ beads, firstOfRound }: { beads: ColorId[]; firstOfRound: boolean }) {
  const L = BEAD.length;
  const H = BEAD.diameter / 2;
  // columns 0..6: raised beads (last round) at odd columns, low beads at even columns
  const cols = [0, 1, 2, 3, 4, 5, 6];
  const newColor = beads[0];
  const next = beads[1] ?? beads[0];
  return (
    <svg viewBox="-8 -24 66 38" role="img" aria-label="Add a bead into the gap, then go through the next raised bead">
      <defs>
        <Arrow id="ah-y" color={PINK} />
      </defs>
      {cols.map((c) => (
        <Bead key={c} x={c * L} y={c % 2 ? -H : 0} angle={0} color={GREY} dim={c % 2 === 0} />
      ))}
      {/* already added in this round */}
      {!firstOfRound && <Bead x={0} y={-2 * H} angle={0} color={next} dim />}
      {/* the new bead goes in the gap above column 2 */}
      <Bead x={2 * L} y={-2 * H} angle={0} color={newColor} glow />
      <path
        d={`M ${1 * L - 3} ${-H - 1} L ${1 * L + 2.6} ${-H - 1} C ${1 * L + 3.5} ${-H - 3}, ${2 * L - 4} ${-2 * H}, ${2 * L - 3} ${-2 * H} L ${2 * L + 3} ${-2 * H} C ${2 * L + 4} ${-2 * H}, ${3 * L - 3.5} ${-H - 3}, ${3 * L - 2.6} ${-H - 1} L ${3 * L + 6} ${-H - 1}`}
        fill="none"
        stroke={PINK}
        stroke-width="1"
        marker-end="url(#ah-y)"
      />
      <Label x={2 * L} y={-19.5} text="1 add" color={PINK} />
      <Label x={5.6 * L} y={-2 * H - 3} text="2 through" color="#7a5c99" />
      <text x={-6} y={8.5} font-size="3.2" fill="#9a8aa6">
        {firstOfRound ? 'ring: every other bead pops up' : 'gaps and raised beads'}
      </text>
    </svg>
  );
}

/** Step up: through the first bead of the round you just finished. */
function StepUpHow() {
  const L = BEAD.length;
  const H = BEAD.diameter / 2;
  return (
    <svg viewBox="-8 -22 58 32" role="img" aria-label="Step up through the first bead of the round">
      <defs>
        <Arrow id="ah-s" color="#7a5c99" />
      </defs>
      {[0, 1, 2, 3, 4, 5, 6].map((c) => (
        <Bead key={c} x={c * L} y={c % 2 ? -H : -2 * H} angle={0} color={c % 2 ? GREY : 's-pale-pink'} dim={c % 2 === 1} />
      ))}
      <circle cx={2 * L} cy={-2 * H - 6.5} r="3" fill="#ffc93c" stroke="#7a4a00" stroke-width="0.5" />
      <text x={2 * L} y={-2 * H - 5.3} text-anchor="middle" font-size="3.6" font-weight="700" fill="#3a2547">
        1
      </text>
      <path d={`M ${0.6 * L} ${-H} C ${1.2 * L} ${-H}, ${1.4 * L} ${-2 * H}, ${2 * L - 3} ${-2 * H} L ${2 * L + 6} ${-2 * H}`} fill="none" stroke="#7a5c99" stroke-width="1.1" marker-end="url(#ah-s)" />
      <text x={-6} y={6} font-size="3.2" fill="#9a8aa6">
        up through bead 1
      </text>
    </svg>
  );
}

export function HowTo({ step }: { step: Step }) {
  switch (step.t) {
    case 'row':
      return step.mode === 'center' ? <CenterRow beads={step.beads} /> : <CrossRow beads={step.beads} belly={step.belly} fromRing={step.row === 1} />;
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
    case 'ring':
      return <RingHow beads={step.beads} />;
    case 'tiering':
      return <TieRingHow />;
    case 'round':
      return <PeyoteRoundHow beads={step.beads} firstOfRound={step.from === 0} />;
    case 'stepup':
      return <StepUpHow />;
    default:
      return null;
  }
}
