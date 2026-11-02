import { longName } from '../core/colors';
import type { Step } from '../core/steps';
import type { ColorId } from '../core/types';

export interface Run {
  color: ColorId;
  count: number;
}

/** Consecutive beads of the same color, in stringing order. */
export function runs(beads: ColorId[]): Run[] {
  const out: Run[] = [];
  for (const c of beads) {
    const last = out[out.length - 1];
    if (last && last.color === c) last.count++;
    else out.push({ color: c, count: 1 });
  }
  return out;
}

export function spokenBeads(beads: ColorId[]): string {
  return runs(beads)
    .map((r) => `${r.count} ${longName(r.color)}`)
    .join(', then ');
}

const CORD_NAME = { lace: 'plastic lace', stretch: 'stretchy cord' } as const;

export interface StepText {
  title: string;
  /** may contain **bold** markers */
  text: string;
  tip?: string;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function describe(s: Step, opts: { firstCrossRow: boolean; keyring: boolean }): StepText {
  switch (s.t) {
    case 'cut':
      return {
        title: 'Cut your cord',
        text: `Cut **${s.cord.inches} inches** (${s.cord.cm} cm) of **${CORD_NAME[s.cord.kind]}**.`,
        tip:
          s.cord.kind === 'lace'
            ? 'Wrap a little tape around each end to make a pointy tip. It pokes through beads easily.'
            : 'Stretch the cord a few times before you start, so your bracelet stays snug later.',
      };
    case 'tape':
      return { title: 'Tape one end', text: 'Put a piece of tape on **one end** of the cord so beads can’t slide off.' };
    case 'keyring':
      return {
        title: 'Key ring',
        text: 'Fold the cord in **half**. Push the fold through the key ring, then pull both ends **through the fold loop**. Pull snug.',
        tip: 'Now you have two cord ends: one on the left, one on the right.',
      };
    case 'row': {
      const n = s.beads.length;
      if (s.mode === 'center')
        return {
          title: 'Row 1',
          text: `String ${plural(n, 'bead')} and slide ${n === 1 ? 'it' : 'them'} to the **middle** of the cord.`,
          tip: 'Now you have two cord ends: one on the left, one on the right.',
        };
      const belly = s.belly ? ' Pull tight and **tuck this row under** the row before it. It’s the belly!' : ' Pull both ends tight.';
      return {
        title: s.belly ? `Row ${s.row} · belly` : `Row ${s.row}`,
        text: `String ${n === 1 ? 'this bead' : `these ${n} beads`} on the **left** cord. Push the **right** cord through ${n === 1 ? 'it' : 'them'} the other way.${belly}`,
        tip: opts.firstCrossRow ? (opts.keyring ? 'Hold it with the key ring at the top.' : 'Hold it with Row 1 at the top.') + ' The cords swap sides every row. That’s right!' : undefined,
      };
    }
    case 'leg': {
      const side = s.side === 'L' ? 'left' : 'right';
      const k = s.stem.length;
      const back =
        s.toes.length === 1
          ? k === 1
            ? 'Skip the last bead and push the same cord **back through the first bead**.'
            : `Skip the last bead and push the same cord **back through the other ${k} beads**.`
          : `Push the same cord **back through the first ${plural(k, 'bead')}** only. The last ${s.toes.length} make a little loop.`;
      return {
        title: `${s.side === 'L' ? 'Left' : 'Right'} leg`,
        text: `On the **${side}** cord, string these beads. ${back} Pull tight.`,
      };
    }
    case 'string':
      return {
        title: `Beads ${s.from + 1}–${s.from + s.beads.length}`,
        text: `String ${s.beads.length === 1 ? 'this bead' : 'these beads'} in order.`,
        tip: s.from + s.beads.length === s.total ? `That’s all ${s.total} beads!` : undefined,
      };
    case 'close':
      return {
        title: 'Close the band',
        text: 'Bend the band into a circle so Row 1 meets the last row. Push the **left** cord through **Row 1**, left to right. Pull until the band closes.',
        tip: 'Now both cords are on the same side.',
      };
    case 'tie':
      if (s.style === 'bracelet')
        return {
          title: 'Tie it',
          text: 'Take off the tape. Tie the two ends together in a **double knot** (a knot, then another knot on top). Pull hard, then trim the ends.',
        };
      return {
        title: 'Tie it off',
        text: 'Tie the two cords together in a **double knot** (a knot, then another knot on top). Pull hard, then trim, leaving short tails.',
        tip: s.style === 'cuff' ? 'Tuck the tails into the beads if you can.' : undefined,
      };
  }
}

export function speech(t: StepText, beads: ColorId[]): string {
  const plain = (x: string) => x.replace(/\*\*/g, '');
  const parts = [plain(t.title) + '.', plain(t.text)];
  if (beads.length) parts.push(spokenBeads(beads) + '.');
  if (t.tip) parts.push(plain(t.tip));
  return parts.join(' ');
}
