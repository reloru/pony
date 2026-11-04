import { COLORS, isStar } from './colors';
import { nearest } from './colormath';
import { changeAround, changeRows, peyoteMirror, peyoteNeighbours } from './peyote';
import { rowBeadX, type BeadRef as BeadRefLike } from './geometry';
import {
  BEAD,
  LIMITS,
  type BraceletDesign,
  type ColorId,
  type CuffDesign,
  type Design,
  type PeyoteDesign,
  type Leg,
  type Side,
  type WeaveDesign,
  type WeaveRow,
} from './types';

/** Designs are plain JSON. (structuredClone would need iOS 15.4+.) */
export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export function newId(): string {
  const c = globalThis.crypto;
  if (c && 'randomUUID' in c) return c.randomUUID();
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Star beads can only go where the cord passes through once. */
export function starAllowed(d: Design, ref: BeadRefLike): boolean {
  if (d.kind === 'bracelet') return true;
  return ref.t === 'leg' && ref.part === 'toes';
}

const otherSide = (s: Side): Side => (s === 'L' ? 'R' : 'L');
const legKey = (s: Side) => (s === 'L' ? 'legL' : 'legR');

function getLeg(r: WeaveRow, s: Side): Leg | undefined {
  return s === 'L' ? r.legL : r.legR;
}
function setLeg(r: WeaveRow, s: Side, leg: Leg | undefined) {
  if (leg) r[legKey(s)] = leg;
  else delete r[legKey(s)];
}

export function colorAt(d: Design, ref: BeadRefLike): ColorId | undefined {
  switch (ref.t) {
    case 'ring':
      return d.kind === 'bracelet' ? d.beads[ref.i] : undefined;
    case 'row':
      if (d.kind === 'cuff' || d.kind === 'peyote') return d.rows[ref.row]?.[ref.i];
      if (d.kind === 'flat' || d.kind === 'critter') return d.rows[ref.row]?.beads[ref.i];
      return undefined;
    case 'leg': {
      if (d.kind !== 'flat' && d.kind !== 'critter') return undefined;
      const leg = d.rows[ref.row] && getLeg(d.rows[ref.row], ref.side);
      return leg?.[ref.part][ref.i];
    }
  }
}

function setAt(d: Design, ref: BeadRefLike, c: ColorId): boolean {
  if (isStar(c) && !starAllowed(d, ref)) return false;
  switch (ref.t) {
    case 'ring':
      if (d.kind !== 'bracelet' || ref.i >= d.beads.length) return false;
      d.beads[ref.i] = c;
      return true;
    case 'row':
      if (d.kind === 'cuff' || d.kind === 'peyote') {
        if (!d.rows[ref.row] || ref.i >= d.rows[ref.row].length) return false;
        d.rows[ref.row][ref.i] = c;
        return true;
      }
      if (d.kind === 'flat' || d.kind === 'critter') {
        const r = d.rows[ref.row];
        if (!r || ref.i >= r.beads.length) return false;
        r.beads[ref.i] = c;
        return true;
      }
      return false;
    case 'leg': {
      if (d.kind !== 'flat' && d.kind !== 'critter') return false;
      const leg = d.rows[ref.row] && getLeg(d.rows[ref.row], ref.side);
      if (!leg || ref.i >= leg[ref.part].length) return false;
      leg[ref.part][ref.i] = c;
      return true;
    }
  }
}

/** The mirror-image position across the vertical center line, if there is one. */
export function mirrorRef(d: Design, ref: BeadRefLike): BeadRefLike | null {
  switch (ref.t) {
    case 'ring':
      return d.kind === 'bracelet' ? { t: 'ring', i: (d.beads.length - ref.i) % d.beads.length } : null;
    case 'row': {
      if (d.kind === 'peyote') return d.rows[ref.row] ? { t: 'row', ...peyoteMirror(d, ref.row, ref.i) } : null;
      const w = d.kind === 'cuff' ? d.rows[ref.row]?.length : d.kind === 'bracelet' ? 0 : d.rows[ref.row]?.beads.length;
      return w ? { t: 'row', row: ref.row, i: w - 1 - ref.i } : null;
    }
    case 'leg':
      return { ...ref, side: otherSide(ref.side) };
  }
}

export function paint<T extends Design>(d: T, ref: BeadRefLike, c: ColorId, mirror: boolean): T {
  const n = clone(d);
  setAt(n, ref, c);
  if (mirror) {
    const m = mirrorRef(n, ref);
    if (m) setAt(n, m, c);
  }
  return n;
}

// ---------------------------------------------------------------------------
// Whole-design color changes

function forEachRef(d: Design, fn: (ref: BeadRefLike) => void) {
  if (d.kind === 'bracelet') d.beads.forEach((_, i) => fn({ t: 'ring', i }));
  else if (d.kind === 'cuff' || d.kind === 'peyote') d.rows.forEach((r, row) => r.forEach((_, i) => fn({ t: 'row', row, i })));
  else
    d.rows.forEach((r, row) => {
      r.beads.forEach((_, i) => fn({ t: 'row', row, i }));
      for (const side of ['L', 'R'] as Side[]) {
        const leg = getLeg(r, side);
        if (!leg) continue;
        leg.stem.forEach((_, i) => fn({ t: 'leg', row, side, part: 'stem', i }));
        leg.toes.forEach((_, i) => fn({ t: 'leg', row, side, part: 'toes', i }));
      }
    });
}

export function usedColors(d: Design): ColorId[] {
  const s = new Set<ColorId>();
  forEachRef(d, (ref) => {
    const c = colorAt(d, ref);
    if (c) s.add(c);
  });
  return [...s];
}

/** Every bead of color `from` becomes `to` (skipping spots where a star can't go). */
export function swapColor<T extends Design>(d: T, from: ColorId, to: ColorId): T {
  const n = clone(d);
  forEachRef(n, (ref) => {
    if (colorAt(n, ref) === from) setAt(n, ref, to);
  });
  return n;
}

/** Recolor every bead she doesn't own to the closest color she does own. */
export function useMyBeads<T extends Design>(d: T, owned: ReadonlySet<ColorId>): T {
  const ownedList = [...owned];
  const ownedNoStar = ownedList.filter((c) => !isStar(c));
  const n = clone(d);
  if (!ownedNoStar.length && !ownedList.length) return n;
  forEachRef(n, (ref) => {
    const c = colorAt(n, ref)!;
    if (owned.has(c)) return;
    const pool = starAllowed(n, ref) ? ownedList : ownedNoStar;
    // A star stays a star if she owns any star beads.
    const starPool = isStar(c) ? pool.filter(isStar) : [];
    const pick = nearest(c, starPool.length ? starPool : pool.filter((x) => !isStar(x)).length ? pool.filter((x) => !isStar(x)) : pool);
    if (pick) setAt(n, ref, pick);
  });
  return n;
}

/** Give each color in the design a new random color: a fun "surprise me". */
export function surprise<T extends Design>(d: T, pool: ColorId[], rnd: () => number = Math.random): T {
  const used = usedColors(d);
  const nonStar = pool.filter((c) => !isStar(c));
  const choices = nonStar.length >= used.length ? nonStar : COLORS.filter((c) => c.finish !== 'star').map((c) => c.id);
  const shuffled = [...choices];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const map = new Map<ColorId, ColorId>();
  used.forEach((c, i) => {
    // stars keep being stars, just a different star color when possible
    if (isStar(c)) {
      const stars = pool.filter(isStar);
      const s = stars.length ? stars : COLORS.filter((x) => x.finish === 'star').map((x) => x.id);
      map.set(c, s[Math.floor(rnd() * s.length)]);
    } else map.set(c, shuffled[i % shuffled.length]);
  });
  const n = clone(d);
  forEachRef(n, (ref) => setAt(n, ref, map.get(colorAt(n, ref)!)!));
  return n;
}

// ---------------------------------------------------------------------------
// Flood fill: connected beads of the same color

function neighbors(d: Design, ref: BeadRefLike): BeadRefLike[] {
  const out: BeadRefLike[] = [];
  if (ref.t === 'ring' && d.kind === 'bracelet') {
    const n = d.beads.length;
    out.push({ t: 'ring', i: (ref.i + 1) % n }, { t: 'ring', i: (ref.i + n - 1) % n });
  } else if (ref.t === 'row' && d.kind === 'peyote') {
    for (const nb of peyoteNeighbours(d, ref.row, ref.i)) out.push({ t: 'row', ...nb });
  } else if (ref.t === 'row' && d.kind === 'cuff') {
    const w = d.rows[0].length;
    if (ref.i > 0) out.push({ t: 'row', row: ref.row, i: ref.i - 1 });
    if (ref.i < w - 1) out.push({ t: 'row', row: ref.row, i: ref.i + 1 });
    if (ref.row > 0) out.push({ t: 'row', row: ref.row - 1, i: ref.i });
    if (ref.row < d.rows.length - 1) out.push({ t: 'row', row: ref.row + 1, i: ref.i });
  } else if (ref.t === 'row' && (d.kind === 'flat' || d.kind === 'critter')) {
    const w = d.rows[ref.row].beads.length;
    if (ref.i > 0) out.push({ t: 'row', row: ref.row, i: ref.i - 1 });
    if (ref.i < w - 1) out.push({ t: 'row', row: ref.row, i: ref.i + 1 });
    const x = rowBeadX(w, ref.i);
    for (const rr of [ref.row - 1, ref.row + 1]) {
      const r = d.rows[rr];
      if (!r) continue;
      r.beads.forEach((_, j) => {
        if (Math.abs(rowBeadX(r.beads.length, j) - x) < BEAD.length - 0.1) out.push({ t: 'row', row: rr, i: j });
      });
    }
  } else if (ref.t === 'leg' && (d.kind === 'flat' || d.kind === 'critter')) {
    const leg = getLeg(d.rows[ref.row], ref.side)!;
    const seq: BeadRefLike[] = [
      ...leg.stem.map((_, i) => ({ t: 'leg' as const, row: ref.row, side: ref.side, part: 'stem' as const, i })),
      ...leg.toes.map((_, i) => ({ t: 'leg' as const, row: ref.row, side: ref.side, part: 'toes' as const, i })),
    ];
    const k = seq.findIndex((s) => s.t === 'leg' && s.part === ref.part && s.i === ref.i);
    if (k > 0) out.push(seq[k - 1]);
    if (k < seq.length - 1) out.push(seq[k + 1]);
  }
  return out;
}

const refKey = (r: BeadRefLike) => (r.t === 'leg' ? `l${r.row}${r.side}${r.part}${r.i}` : r.t === 'row' ? `r${r.row}-${r.i}` : `b${r.i}`);

export function floodFill<T extends Design>(d: T, start: BeadRefLike, c: ColorId, mirror: boolean): T {
  const target = colorAt(d, start);
  if (target === undefined || target === c) return d;
  const n = clone(d);
  const seen = new Set<string>();
  const fillFrom = (s: BeadRefLike) => {
    const tgt = colorAt(n, s);
    if (tgt === undefined || tgt === c) return;
    const stack = [s];
    while (stack.length) {
      const r = stack.pop()!;
      const k = refKey(r);
      if (seen.has(k)) continue;
      seen.add(k);
      if (colorAt(n, r) !== tgt) continue;
      setAt(n, r, c);
      stack.push(...neighbors(n, r));
    }
  };
  fillFrom(start);
  if (mirror) {
    const m = mirrorRef(n, start);
    if (m) fillFrom(m);
  }
  return n;
}

// ---------------------------------------------------------------------------
// Ladder-weave shape editing (shapes and critters). Rows always stay centered and unbroken.

const W = LIMITS.weave;

export function addEnd(d: WeaveDesign, row: number, side: Side, c: ColorId, mirror: boolean): WeaveDesign {
  if (isStar(c)) return d;
  const n = clone(d);
  const r = n.rows[row];
  if (!r) return d;
  const sides: Side[] = mirror ? ['L', 'R'] : [side];
  if (r.beads.length + sides.length > W.maxWidth) return d;
  for (const s of sides) {
    if (s === 'L') r.beads.unshift(c);
    else r.beads.push(c);
  }
  return n;
}

/** Only the beads at the ends of a row can be taken off; middle beads would leave a hole. */
export function canErase(d: Design, ref: BeadRefLike): boolean {
  if (d.kind !== 'flat' && d.kind !== 'critter') return false;
  if (ref.t === 'leg') return true;
  if (ref.t !== 'row') return false;
  const w = d.rows[ref.row]?.beads.length ?? 0;
  return ref.i === 0 || ref.i === w - 1;
}

export function erase(d: WeaveDesign, ref: BeadRefLike, mirror: boolean): WeaveDesign {
  if (!canErase(d, ref)) return d;
  const n = clone(d);
  if (ref.t === 'leg') {
    setLeg(n.rows[ref.row], ref.side, undefined);
    if (mirror) setLeg(n.rows[ref.row], otherSide(ref.side), undefined);
    return n;
  }
  if (ref.t !== 'row') return d;
  const r = n.rows[ref.row];
  const w = r.beads.length;
  const both = mirror && w >= 2;
  if (both) {
    r.beads.shift();
    r.beads.pop();
  } else if (ref.i === 0) r.beads.shift();
  else r.beads.pop();
  if (r.beads.length === 0) {
    if (n.rows.length === 1) return d;
    n.rows.splice(ref.row, 1);
    if (n.rows[0]?.belly) delete n.rows[0].belly;
  }
  return n;
}

export function addRow(d: WeaveDesign, at: 'top' | 'bottom'): WeaveDesign {
  if (d.rows.length >= W.maxRows) return d;
  const n = clone(d);
  const src = at === 'top' ? n.rows[0] : n.rows[n.rows.length - 1];
  const row: WeaveRow = { beads: [...src.beads] };
  if (at === 'top') n.rows.unshift(row);
  else {
    if (src.belly) row.belly = true;
    n.rows.push(row);
  }
  return n;
}

export function removeRow(d: WeaveDesign, row: number): WeaveDesign {
  if (d.rows.length <= 1) return d;
  const n = clone(d);
  n.rows.splice(row, 1);
  if (n.rows[0]?.belly) delete n.rows[0].belly;
  return n;
}

export function toggleBelly(d: WeaveDesign, row: number): WeaveDesign {
  if (d.kind !== 'critter' || row === 0 || !d.rows[row]) return d;
  const n = clone(d);
  const r = n.rows[row];
  if (r.belly) delete r.belly;
  else r.belly = true;
  return n;
}

/** Leg styles she can cycle through by tapping beside a row. */
export const LEG_STYLES: { stem: number; toes: number }[] = [
  { stem: 2, toes: 1 },
  { stem: 2, toes: 3 },
  { stem: 4, toes: 1 },
  { stem: 1, toes: 1 },
];

export function legStyleIndex(leg: Leg | undefined): number {
  if (!leg) return -1;
  return LEG_STYLES.findIndex((s) => s.stem === leg.stem.length && s.toes === leg.toes.length);
}

export function cycleLeg(d: WeaveDesign, row: number, side: Side, c: ColorId, mirror: boolean): WeaveDesign {
  const n = clone(d);
  const r = n.rows[row];
  if (!r) return d;
  const cur = getLeg(r, side);
  const idx = legStyleIndex(cur);
  const next = idx === -1 && cur ? 0 : idx + 1;
  const style = LEG_STYLES[next];
  const stemColor = isStar(c) ? (cur?.stem[0] ?? r.beads[side === 'L' ? 0 : r.beads.length - 1]) : c;
  const make = (old: Leg | undefined): Leg | undefined => {
    if (!style) return undefined;
    const keep = (arr: ColorId[] | undefined, len: number, fallback: ColorId) =>
      Array.from({ length: len }, (_, i) => arr?.[i] ?? arr?.[arr.length - 1] ?? fallback);
    return { stem: keep(old?.stem, style.stem, stemColor), toes: keep(old?.toes, style.toes, c) };
  };
  setLeg(r, side, make(cur));
  if (mirror) {
    const leg = getLeg(r, side);
    setLeg(r, otherSide(side), leg ? clone(leg) : undefined);
  }
  return n;
}

export function setKeyring(d: WeaveDesign, on: boolean): WeaveDesign {
  return { ...clone(d), keyring: on };
}

// ---------------------------------------------------------------------------
// Cuffs

const C = LIMITS.cuff;

/** Grow or shrink the band width one bead at a time, alternating sides so designs stay centered. */
export function cuffWidth(d: CuffDesign, delta: 1 | -1): CuffDesign {
  const w = d.rows[0].length;
  const nw = w + delta;
  if (nw < C.minWidth || nw > C.maxWidth) return d;
  const n = clone(d);
  for (const r of n.rows) {
    if (delta === 1) {
      if (w % 2 === 1) r.push(r[w - 1]);
      else r.unshift(r[0]);
    } else if (w % 2 === 0) r.pop();
    else r.shift();
  }
  return n;
}

/** Smallest repeat length of a sequence (compared by JSON so it works for rows too). */
export function period<T>(seq: T[]): number {
  const k = seq.map((x) => JSON.stringify(x));
  for (let p = 1; p <= k.length; p++) {
    let ok = true;
    for (let i = p; i < k.length && ok; i++) if (k[i] !== k[i - p]) ok = false;
    if (ok) return p;
  }
  return Math.max(1, k.length);
}

export function cuffLength(d: CuffDesign, rows: number): CuffDesign {
  const target = Math.max(C.minRows, Math.min(C.maxRows, rows));
  const n = clone(d);
  while (n.rows.length > target) n.rows.pop();
  while (n.rows.length < target) {
    const p = period(n.rows);
    n.rows.push([...n.rows[n.rows.length - p]]);
  }
  return n;
}

// ---------------------------------------------------------------------------
// Bracelets

export function braceletSize(d: BraceletDesign, count: number): BraceletDesign {
  const target = Math.max(LIMITS.bracelet.min, Math.min(LIMITS.bracelet.max, count));
  const n = clone(d);
  while (n.beads.length > target) n.beads.pop();
  while (n.beads.length < target) {
    const p = period(n.beads);
    n.beads.push(n.beads[n.beads.length - p]);
  }
  return n;
}

export const RHYTHMS = ['AB', 'AAB', 'ABB', 'AABB', 'ABC', 'ABCB', 'ABCD', 'AAABBB'] as const;

/** Fill the whole bracelet with a repeating rhythm of the chosen colors (A = first color...). */
export function applyRhythm(d: BraceletDesign, colors: ColorId[], rhythm: string): BraceletDesign {
  const letters = [...new Set(rhythm.split(''))].sort();
  if (!colors.length) return d;
  const map = new Map(letters.map((l, i) => [l, colors[i % colors.length]]));
  const n = clone(d);
  n.beads = n.beads.map((_, i) => map.get(rhythm[i % rhythm.length])!);
  return n;
}

export function rotateBracelet(d: BraceletDesign, by: number): BraceletDesign {
  const n = clone(d);
  const k = ((by % n.beads.length) + n.beads.length) % n.beads.length;
  n.beads = [...n.beads.slice(k), ...n.beads.slice(0, k)];
  return n;
}

// ---------------------------------------------------------------------------
// Peyote cuffs

/** Two beads more or fewer around the cuff. */
export function peyoteAround(d: PeyoteDesign, delta: 1 | -1): PeyoteDesign {
  return changeAround(clone(d), delta);
}

export function peyoteRows(d: PeyoteDesign, rows: number): PeyoteDesign {
  return changeRows(clone(d), rows);
}
