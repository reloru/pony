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
    case 'ring': {
      const end = s.from + s.beads.length;
      return {
        title: `Start ring · ${s.from + 1}–${end}`,
        text: `String ${s.beads.length === 1 ? 'this bead' : 'these beads'} in order.${s.from === 0 ? ' Leave a short tail (a hand length) at the start.' : ''}`,
        tip: end === s.total ? `That's all ${s.total} ring beads. Don't tie yet. Next step!` : s.from === 0 ? 'Don’t tie anything yet.' : undefined,
      };
    }
    case 'tiering':
      return {
        title: 'Tie the ring',
        text: `Tie the two ends together into a ring with a **double knot**. Keep the **long end** for weaving; trim the short end.`,
        tip: `The ring has ${s.total} beads. After the next round, every other ring bead will stick up.`,
      };
    case 'round': {
      const end = s.from + s.beads.length;
      const part = s.perRound > s.beads.length ? ` · beads ${s.from + 1}–${end}` : '';
      if (s.round === 1 && s.from === 0)
        return {
          title: `Round 1${part}`,
          text: 'Start at the knot, going the same way you strung the ring. For each bead: **add it, skip the next ring bead, go through the one after**. Pull snug.',
          tip: 'The first bead sits right after the knot (marked 1 on the map).',
        };
      if (s.from === 0)
        return {
          title: `Round ${s.round}${part}`,
          text: 'For each bead: **add it into the next gap, then go through the next bead that sticks up**. Pull snug.',
          tip: 'The first bead goes in the gap right after the bead you just stepped up through (marked 1 on the map).',
        };
      return {
        title: `Round ${s.round}${part}`,
        text: 'Keep going: **add a bead into the next gap, go through the next bead that sticks up**.',
        tip: end === s.perRound ? `That's all ${s.perRound} beads of round ${s.round}!` : undefined,
      };
    }
    case 'stepup':
      return {
        title: 'Step up',
        text: `Go through the **first bead you added in round ${s.round}** (marked 1 on the map). Now you're ready for the next round.`,
        tip: 'This is the “step up”. Do it at the end of every round.',
      };
    case 'xring': {
      const units = s.beads.length / 3;
      const end = s.from + s.beads.length;
      return {
        title: `Start ring · ${s.from + 1}–${end}`,
        text: `String ${units === 1 ? 'this set' : `these ${units} sets`} in order: a **connector** bead, then **2 beads**.${s.from === 0 ? ' Leave a short tail (a hand length) at the start.' : ''}`,
        tip: end === s.total ? `That's all ${s.total} ring beads. Don't tie yet. Next step!` : s.from === 0 ? 'The connector is the first bead of every set (it has a dotted ring).' : undefined,
      };
    }
    case 'xtie':
      return {
        title: 'Tie the ring',
        text: 'Tie the two ends together into a ring with a **double knot**. Keep the **long end**; trim the short end.',
        tip: `Your ring has ${s.total / 3} connectors. The X's hang between them.`,
      };
    case 'xround': {
      const what = s.kind === 'pairs' ? 'pair' : 'group';
      const n = s.groups.length;
      const part = s.count > n ? ` · ${what}s ${s.from + 1}–${s.from + n}` : '';
      const last = s.kind === 'pairs' ? 'Last round' : `Round ${s.round}`;
      const each =
        s.kind === 'pairs'
          ? 'For each pair: **string the 2 beads, then go through the next middle bead**.'
          : `For each group: **string the 3 beads, then go through the next ${s.round === 1 ? 'connector' : 'middle bead'}**.`;
      if (s.from === 0) {
        const start =
          s.round === 1 ? 'Go through the **connector right after the knot** (marked 1 on the map). ' : 'You’re in the bead marked 1 on the map. ';
        return { title: `${last}${part}`, text: start + each, tip: s.kind === 'groups' ? 'Each group makes a little point. Pull snug.' : 'This makes the second edge.' };
      }
      const end = s.from + n === s.count;
      return {
        title: `${last}${part}`,
        text: `Keep going. ${each}`,
        tip: end ? `That's the whole round: you're back at the bead marked 1.` : undefined,
      };
    }
    case 'xup':
      return {
        title: 'Knot and step up',
        text: `Tie a small knot around the cord to lock round ${s.round}. Then go through the **next bead and the middle bead of the first group** (marked 1 on the map).`,
        tip: 'Now you’re ready for the next round. Don’t cut the cord!',
      };
    case 'tie':
      if (s.style === 'xbase')
        return {
          title: 'Tie it off',
          text: 'Tie a **double knot** around the cord between two beads. Push the end through a few beads, then trim it.',
          tip: 'It looks floppy until it’s done. That’s normal!',
        };
      if (s.style === 'peyote')
        return {
          title: 'Tie it off',
          text: 'Tie the long end in a **double knot** around the cord between two beads. Push the end through a few beads, then trim it.',
          tip: 'Put it on only once it’s finished, so the knots stay tight.',
        };
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

export function speech(t: StepText, beads: ColorId[], beadText?: string): string {
  const plain = (x: string) => x.replace(/\*\*/g, '');
  const parts = [plain(t.title) + '.', plain(t.text)];
  if (beadText) parts.push(beadText);
  else if (beads.length) parts.push(spokenBeads(beads) + '.');
  if (t.tip) parts.push(plain(t.tip));
  return parts.join(' ');
}

/** Read-aloud for an X-base round: group by group, so two neighbouring beads of one color never merge. */
export function spokenGroups(groups: ColorId[][], kind: 'groups' | 'pairs'): string {
  const through = kind === 'pairs' ? 'go through the next middle bead' : 'go through the next one';
  return groups.map((g) => `${g.map(longName).join(', ')}, then ${through}`).join('. ') + '.';
}
