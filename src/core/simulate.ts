import type { Step } from './steps';
import type { ColorId, Design, Leg, WeaveRow } from './types';

export type Rebuilt =
  | { kind: 'bracelet'; beads: ColorId[] }
  | { kind: 'weave'; keyring: boolean; rows: WeaveRow[]; closed: boolean }
  | { kind: 'peyote'; rows: ColorId[][] };

/**
 * Follows the steps exactly as a person would and returns what ends up on the cord.
 * Throws if the steps are out of order or physically impossible (a leg before its row,
 * a centered row after the start, a band closed twice, beads after tying off...).
 */
export function rebuild(steps: Step[]): Rebuilt {
  if (steps[0]?.t !== 'cut') throw new Error('first step must be cutting the cord');
  if (steps.slice(1).some((s) => s.t === 'ring' || s.t === 'tiering' || s.t === 'round' || s.t === 'stepup')) return rebuildPeyote(steps);
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
    case 'peyote':
      return { kind: 'peyote', rows: d.rows.map((r) => [...r]) };
    default:
      return { kind: 'weave', keyring: d.keyring, rows: d.rows.map(normRow), closed: false };
  }
}

/**
 * Peyote, replayed physically: every column is a stack of beads. The cord sits in some column.
 * "Add a bead, skip one, go through the next" puts the new bead on top of the column just after
 * the cord, which must be a gap (lower than both neighbours), then the cord passes through the
 * raised bead after it. The step-up takes the cord through the first bead of the round.
 * Rows are read back from the stacks, so this does not reuse the step generator's arithmetic.
 */
function rebuildPeyote(steps: Step[]): Rebuilt {
  const ring: ColorId[] = [];
  let n = 0;
  let stacks: { row: number; color: ColorId }[][] = [];
  let cur = -1;
  let placed = 0; // beads added in the current round
  let round = 0;
  let firstCol = -1;
  let canStart = false; // ready to begin a new round
  let tied = false;

  const top = (c: number) => stacks[c][stacks[c].length - 1].row;

  for (const s of steps.slice(1)) {
    if (tied) throw new Error('step after tying off');
    switch (s.t) {
      case 'ring':
        if (n) throw new Error('ring beads after the ring was tied');
        if (s.from !== ring.length) throw new Error(`ring chunk starts at ${s.from}, expected ${ring.length}`);
        ring.push(...s.beads);
        break;
      case 'tiering':
        if (n) throw new Error('ring tied twice');
        if (ring.length < 4 || ring.length % 2) throw new Error('a peyote ring needs an even number of beads');
        if (s.total !== ring.length) throw new Error('ring size mismatch');
        n = ring.length;
        // Strung in order then tied: ring bead c sits in column c. Every other one will be pushed up.
        stacks = ring.map((color, c) => [{ row: c % 2, color }]);
        cur = n - 1; // the long end comes out of the last bead, by the knot
        canStart = true;
        break;
      case 'round': {
        if (!n) throw new Error('round before the ring is tied');
        if (s.from === 0) {
          if (!canStart || placed !== 0) throw new Error(`round ${s.round} started at the wrong time`);
          if (s.round !== round + 1) throw new Error(`round ${s.round} out of order`);
          round = s.round;
          canStart = false;
          firstCol = -1;
        } else if (s.round !== round || s.from !== placed) throw new Error(`round ${s.round} part out of order`);
        for (const color of s.beads) {
          const target = (cur + 1) % n;
          const left = cur;
          const right = (target + 1) % n;
          if (!(top(target) + 1 === top(left) && top(target) + 1 === top(right))) {
            throw new Error(`round ${s.round}: no gap for bead ${placed + 1}`);
          }
          stacks[target].push({ row: top(target) + 2, color });
          if (firstCol < 0) firstCol = target;
          cur = right; // through the raised bead after the gap
          placed++;
        }
        if (placed > n / 2) throw new Error(`round ${s.round} has too many beads`);
        if (placed === n / 2) placed = 0;
        break;
      }
      case 'stepup':
        if (placed !== 0 || canStart || s.round !== round) throw new Error('step up at the wrong time');
        cur = firstCol;
        canStart = true;
        break;
      case 'tie':
        if (s.style !== 'peyote' || !n || placed !== 0) throw new Error('peyote tied at the wrong time');
        tied = true;
        break;
      default:
        throw new Error(`unexpected step ${s.t} in a peyote cuff`);
    }
  }
  if (!tied) throw new Error('never tied off');
  const rowCount = Math.max(...stacks.map((st) => st[st.length - 1].row)) + 1;
  const rows: ColorId[][] = Array.from({ length: rowCount }, () => []);
  stacks.forEach((st, c) =>
    st.forEach((b) => {
      if (b.row % 2 !== c % 2) throw new Error('bead in the wrong column parity');
      rows[b.row][(c - (b.row % 2)) / 2] = b.color;
    }),
  );
  for (const r of rows) if (r.length !== n / 2 || r.some((x) => x === undefined)) throw new Error('a row has holes');
  return { kind: 'peyote', rows };
}
