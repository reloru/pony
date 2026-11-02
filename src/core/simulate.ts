import type { Step } from './steps';
import type { ColorId, Design, Leg, WeaveRow } from './types';

export type Rebuilt =
  | { kind: 'bracelet'; beads: ColorId[] }
  | { kind: 'weave'; keyring: boolean; rows: WeaveRow[]; closed: boolean };

/**
 * Follows the steps exactly as a person would and returns what ends up on the cord.
 * Throws if the steps are out of order or physically impossible (a leg before its row,
 * a centered row after the start, a band closed twice, beads after tying off...).
 */
export function rebuild(steps: Step[]): Rebuilt {
  if (steps[0]?.t !== 'cut') throw new Error('first step must be cutting the cord');
  const strand: ColorId[] = [];
  const rows: WeaveRow[] = [];
  let keyring = false;
  let taped = false;
  let closed = false;
  let tied = false;
  let isBracelet: boolean | null = null;

  for (const s of steps.slice(1)) {
    if (tied) throw new Error('step after tying off');
    switch (s.t) {
      case 'cut':
        throw new Error('cord cut twice');
      case 'tape':
        if (isBracelet === false || taped) throw new Error('tape out of place');
        isBracelet = true;
        taped = true;
        break;
      case 'string':
        if (!taped) throw new Error('stringing before taping the end');
        if (s.from !== strand.length) throw new Error(`bracelet chunk starts at ${s.from}, expected ${strand.length}`);
        strand.push(...s.beads);
        break;
      case 'keyring':
        if (isBracelet !== null || keyring) throw new Error('key ring must come first');
        isBracelet = false;
        keyring = true;
        break;
      case 'row': {
        if (isBracelet) throw new Error('row on a bracelet');
        isBracelet = false;
        if (closed) throw new Error('row after closing the band');
        if (s.row !== rows.length + 1) throw new Error(`row ${s.row} out of order`);
        const first = rows.length === 0;
        const expectMode = first && !keyring ? 'center' : 'cross';
        if (s.mode !== expectMode) throw new Error(`row ${s.row} should be ${expectMode}`);
        if (s.beads.length === 0) throw new Error('empty row');
        if (first && s.belly) throw new Error('first row cannot be tucked under');
        rows.push({ beads: [...s.beads], ...(s.belly ? { belly: true } : {}) });
        break;
      }
      case 'leg': {
        const r = rows[rows.length - 1];
        if (!r || s.row !== rows.length) throw new Error(`leg for row ${s.row} made at the wrong time`);
        if (s.stem.length < 1 || s.toes.length < 1) throw new Error('leg needs a stem and a tip');
        const key = s.side === 'L' ? 'legL' : 'legR';
        if (r[key]) throw new Error(`two ${s.side} legs after row ${s.row}`);
        if (s.side === 'L' && r.legR) throw new Error('left leg is made before the right leg');
        const leg: Leg = { stem: [...s.stem], toes: [...s.toes] };
        r[key] = leg;
        break;
      }
      case 'close':
        if (closed || rows.length < 2 || s.rows !== rows.length) throw new Error('band closed at the wrong time');
        closed = true;
        break;
      case 'tie':
        if (s.style === 'bracelet' && !isBracelet) throw new Error('bracelet tie on a weave');
        if (s.style === 'cuff' && !closed) throw new Error('cuff tied before closing');
        if (s.style === 'weave' && (isBracelet || closed)) throw new Error('wrong tie');
        tied = true;
        break;
    }
  }
  if (!tied) throw new Error('never tied off');
  return isBracelet ? { kind: 'bracelet', beads: strand } : { kind: 'weave', keyring, rows, closed };
}

function normRow(r: WeaveRow): WeaveRow {
  const o: WeaveRow = { beads: [...r.beads] };
  if (r.belly) o.belly = true;
  if (r.legL) o.legL = { stem: [...r.legL.stem], toes: [...r.legL.toes] };
  if (r.legR) o.legR = { stem: [...r.legR.stem], toes: [...r.legR.toes] };
  return o;
}

/** What the design says should be built, in the same shape `rebuild` returns. */
export function expected(d: Design): Rebuilt {
  switch (d.kind) {
    case 'bracelet':
      return { kind: 'bracelet', beads: [...d.beads] };
    case 'cuff':
      return { kind: 'weave', keyring: false, rows: d.rows.map((b) => ({ beads: [...b] })), closed: true };
    default:
      return { kind: 'weave', keyring: d.keyring, rows: d.rows.map(normRow), closed: false };
  }
}
