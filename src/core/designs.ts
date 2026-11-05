import type { BraceletDesign, ColorId, CritterDesign, CuffDesign, Design, FlatDesign, Leg, PeyoteDesign, WeaveRow, XBaseDesign } from './types';

/**
 * Starter ideas, all original designs for this app. Shapes and critters are written as
 * rows of letters (one letter per bead, left to right). A row starting with "_" is a
 * belly row (critters only). Legs are added after the 1-based row they follow.
 */

type Key = Record<string, ColorId>;
type LegSpec = [string, string]; // [stem letters, toe letters]
type Legs = Record<number, { L?: LegSpec; R?: LegSpec; both?: LegSpec }>;

function leg(key: Key, [stem, toes]: LegSpec): Leg {
  return { stem: [...stem].map((ch) => need(key, ch)), toes: [...toes].map((ch) => need(key, ch)) };
}

function need(key: Key, ch: string): ColorId {
  const c = key[ch];
  if (!c) throw new Error(`no color for "${ch}"`);
  return c;
}

/** Mirror a leg spec for the right side so loop toes read the same on both sides. */
const flipToes = ([stem, toes]: LegSpec): LegSpec => [stem, [...toes].reverse().join('')];

function rows(key: Key, lines: string[], legs: Legs = {}): WeaveRow[] {
  return lines.map((line, i) => {
    const belly = line.startsWith('_');
    const r: WeaveRow = { beads: [...line.replace(/^_/, '')].map((ch) => need(key, ch)) };
    if (belly) r.belly = true;
    const l = legs[i + 1];
    if (l?.both) {
      r.legL = leg(key, l.both);
      r.legR = leg(key, flipToes(l.both));
    }
    if (l?.L) r.legL = leg(key, l.L);
    if (l?.R) r.legR = leg(key, l.R);
    return r;
  });
}

const T0 = Date.UTC(2026, 10, 1);
const base = (id: string, name: string) => ({ id, name, createdAt: T0, updatedAt: T0 });

function bracelet(id: string, name: string, key: Key, seq: string): BraceletDesign {
  return { ...base(id, name), kind: 'bracelet', beads: [...seq].map((ch) => need(key, ch)) };
}
function flat(id: string, name: string, key: Key, lines: string[], legs: Legs = {}, keyring = true): FlatDesign {
  return { ...base(id, name), kind: 'flat', keyring, rows: rows(key, lines, legs) };
}
function critter(id: string, name: string, key: Key, lines: string[], legs: Legs = {}, keyring = true): CritterDesign {
  return { ...base(id, name), kind: 'critter', keyring, rows: rows(key, lines, legs) };
}
function cuff(id: string, name: string, key: Key, lines: string[]): CuffDesign {
  return { ...base(id, name), kind: 'cuff', rows: lines.map((l) => [...l].map((ch) => need(key, ch))) };
}
const rep = (lines: string[], times: number) => Array.from({ length: times }, () => lines).flat();

/**
 * Peyote from a pixel picture: pixel (x, y) becomes the bead in column x of row 2y or 2y + 1
 * (whichever row that column belongs to). Every picture's first line is one solid color, so
 * the starting ring is a single color.
 */
function peyote(id: string, name: string, key: Key, pixels: string[]): PeyoteDesign {
  const w = pixels[0].length;
  if (w % 2 || pixels.some((l) => l.length !== w)) throw new Error(`${id}: bad picture width`);
  const rows: ColorId[][] = Array.from({ length: pixels.length * 2 }, (_, r) =>
    Array.from({ length: w / 2 }, (_, k) => need(key, pixels[r >> 1][2 * k + (r % 2)])),
  );
  return { ...base(id, name), kind: 'peyote', rows };
}
const tile = (unit: string, times: number) => unit.repeat(times);

/**
 * X-base from one repeating unit: ring = connector + pair (3 letters), one 3-letter group per
 * group row (side, middle, side), top pair (2 letters). Every unit is the same, so it doesn't
 * matter which connector a round starts from.
 */
function xbase(id: string, name: string, key: Key, unit: { ring: string; groups: string[]; top: string }, units = 10): XBaseDesign {
  const row = (letters: string) => [...letters.repeat(units)].map((ch) => need(key, ch));
  return { ...base(id, name), kind: 'xbase', rows: [row(unit.ring), ...unit.groups.map(row), row(unit.top)] };
}

// ---------------------------------------------------------------------------
// Bracelets: 28 beads (about 6½ in around), each repeat divides 28 so the pattern meets itself at the knot.

const bracelets: BraceletDesign[] = [
  bracelet('b-rainbow', 'Rainbow Pop', { r: 's-red', o: 's-orange', y: 's-yellow', g: 's-neon-green', b: 's-sky-blue', p: 's-orchid', w: 's-white' }, 'roygbpw'.repeat(4)),
  bracelet('b-mermaid', 'Mermaid Tide', { a: 's-turquoise', b: 'p-light-blue', c: 't-mint', d: 'p-white' }, 'abcd'.repeat(7)),
  bracelet('b-galaxy', 'Galaxy Night', { n: 's-navy', d: 't-deep-purple', i: 's-indigo', s: 'star-white' }, 'ndisidn'.repeat(4)),
  bracelet('b-strawberry', 'Strawberry Milk', { p: 'p-pink', w: 's-white', l: 's-light-pink', h: 's-hot-pink' }, 'pwlh'.repeat(7)),
  bracelet('b-bee', 'Busy Bee', { y: 's-yellow', k: 's-black', s: 'star-yellow' }, 'yykkyys'.repeat(4)),
  bracelet(
    'b-sunset',
    'Sunset Fade',
    { a: 's-golden-yellow', b: 's-light-orange', c: 's-orange', d: 's-red-orange', e: 's-raspberry', f: 's-medium-orchid', g: 's-plum' },
    'aabbccddeeffgg' + 'ggffeeddccbbaa',
  ),
  bracelet('b-candy', 'Candy Shop', { a: 's-hot-pink', b: 's-neon-yellow', c: 's-turquoise', d: 's-orchid', e: 's-neon-green', f: 's-light-orange', w: 's-white' }, 'awbwcwdwewfwaw'.repeat(2)),
  bracelet('b-fairy', 'Forest Fairy', { e: 's-emerald', p: 'p-light-green', t: 't-light-green', s: 'star-green' }, 'eptspte'.repeat(4)),
];

// ---------------------------------------------------------------------------
// Flat shapes (two-cord ladder weave)

const flats: FlatDesign[] = [
  flat('f-heart', 'Sweet Heart', { h: 's-hot-pink', r: 's-raspberry', w: 's-white', c: 't-clear' }, [
    'rhccchr',
    'rhwhchhhr',
    'rhwhhhhhr',
    'rhhhhhhhr',
    'rhhhhhr',
    'rhhhr',
    'rhr',
    'r',
  ]),
  flat('f-icecream', 'Ice Cream Day', { c: 's-red', p: 's-pink', l: 's-light-pink', a: 's-sky-blue', y: 's-neon-yellow', g: 's-neon-green', t: 's-tan', m: 's-mustard' }, [
    'c',
    'ppp',
    'papyp',
    'pgppap',
    'ppypgpp',
    'llllll',
    'tmtmt',
    'mtmt',
    'tmt',
    'mt',
    't',
  ]),
  flat('f-mushroom', 'Dotty Mushroom', { r: 's-red', w: 's-white', c: 's-cream', k: 's-black', p: 's-pink' }, [
    'rrr',
    'rwrrr',
    'rrrrwrr',
    'rwrrrrwr',
    'rrrwrrrr',
    'ccccc',
    'ckckc',
    'pcccp',
    'ccccc',
  ]),
  flat('f-strawberry', 'Berry Sweet', { g: 's-green', l: 's-neon-green', r: 's-red', y: 's-pastel-yellow' }, [
    'g',
    'lgl',
    'glglg',
    'rrrrrr',
    'ryrrryr',
    'rrryrrr',
    'ryrryr',
    'rryrr',
    'rrrr',
    'ryr',
    'rr',
    'r',
  ]),
  flat('f-gem', 'Ice Gem', { a: 't-ice-blue', b: 't-sky-blue', c: 't-blue', w: 't-clear', s: 's-white' }, [
    'aaa',
    'abwba',
    'abbwbba',
    'cbbsbbc',
    'cbbbbc',
    'cbbbc',
    'cbbc',
    'cbc',
    'cc',
    'c',
  ]),
  flat(
    'f-kitty',
    'Kitty Pal',
    { g: 's-gray', d: 's-dark-gray', e: 's-spring-green', p: 's-pink', w: 's-white' },
    ['ggdgg', 'gdgggdg', 'gegggeg', 'ggggggg', 'gggpggg', 'ggwwwgg', 'gwwwwg', 'ggggg'],
    { 1: { both: ['g', 'p'] }, 5: { both: ['w', 'w'] } },
  ),
  flat(
    'f-ghost',
    'Boo',
    { w: 'p-white', k: 's-black', p: 's-pink' },
    ['www', 'wwwww', 'wwwwwww', 'wkwwwkw', 'wpwwwpw', 'wwwkwww', 'wwwwwww', 'wwwwwww', 'wwwwwww'],
    { 5: { both: ['w', 'w'] }, 9: { both: ['w', 'w'] } },
  ),
  flat(
    'f-butterfly',
    'Flutter',
    { k: 's-black', o: 's-orchid', l: 's-pale-lavender', t: 't-lavender', p: 's-hot-pink', y: 's-yellow' },
    ['kk', 'oolkloo', 'otllkllto', 'ottpkptto', 'ootlkltoo', 'oolkloo', 'oko', 'ppykypp', 'pptktpp', 'ppkpp', 'pkp'],
    { 1: { both: ['kk', 'y'] } },
  ),
  flat('f-rocket', 'Zoom Rocket', { r: 's-red', w: 's-white', b: 's-sky-blue', o: 's-orange', y: 's-yellow' }, [
    'r',
    'rrr',
    'www',
    'wbw',
    'www',
    'www',
    'rwr',
    'rrwrr',
    'rrrrr',
    'ooo',
    'yoy',
    'y',
  ]),
  flat('f-watermelon', 'Melon Slice', { g: 's-green', l: 's-pale-green', r: 's-raspberry', k: 's-black' }, [
    'ggggggg',
    'lllllll',
    'rkrrrkr',
    'rrrkrr',
    'rkrrr',
    'rrrr',
    'rkr',
    'rr',
    'r',
  ]),
];

// ---------------------------------------------------------------------------
// Cuffs (ladder band closed into a ring). Each line is one rung across the band.

const heartMotif = ['phphp', 'hhhhh', 'hhhhh', 'phhhp', 'pphpp', 'ppppp'];
const zig = ['aqqqq', 'qaqqq', 'qqaqq', 'qqqaq', 'qqqqa', 'qqqbq', 'qqbqq', 'qbqqq'];

const cuffs: CuffDesign[] = [
  cuff('c-rainbow', 'Rainbow Rungs', { r: 's-red', o: 's-orange', y: 's-yellow', g: 's-neon-green', b: 's-blue', p: 's-purple' }, rep(['rrrrr', 'ooooo', 'yyyyy', 'ggggg', 'bbbbb', 'ppppp'], 3)),
  cuff('c-checkers', 'Pink Checkers', { h: 's-hot-pink', w: 's-white' }, rep(['hwhw', 'whwh'], 9)),
  cuff('c-hearts', 'Heart Train', { p: 's-pale-pink', h: 's-raspberry' }, rep(heartMotif, 3)),
  cuff('c-zigzag', 'Zig Zag', { a: 's-turquoise', b: 's-orchid', q: 's-navy' }, rep(zig, 2)),
  cuff(
    'c-galaxy',
    'Starry Sky',
    { n: 's-navy', k: 's-black', p: 't-deep-purple', w: 's-white', i: 's-indigo' },
    ['nnpnn', 'nwnnk', 'knnin', 'nnnpn', 'pnknn', 'nnnwn', 'inpnn', 'nknni', 'wnnnn', 'nnpkn', 'nnnnp', 'kinnn', 'nnwnn', 'pnnnk', 'nnkpn', 'nnnnn', 'nwnpn', 'nnink'],
  ),
  cuff('c-melon', 'Melon Band', { g: 's-green', l: 's-pale-green', r: 's-raspberry', k: 's-black' }, rep(['glrrrlg', 'glrkrlg', 'glrrrlg'], 6)),
];

// ---------------------------------------------------------------------------
// Peyote cuffs: 28 beads around (about 6½ in), every repeat divides 28.

const peyotes: PeyoteDesign[] = [
  peyote('y-hearts', 'Heart Ring', { p: 's-pale-pink', h: 's-raspberry', w: 's-white' }, [
    tile('p', 28),
    tile('.h.h...', 4),
    tile('hwhhh..', 4),
    tile('.hhh...', 4),
    tile('..h....', 4),
    tile('p', 28),
  ].map((l) => l.replace(/\./g, 'p'))),
  peyote('y-rainbow', 'Rainbow Wave', { r: 's-red', o: 's-orange', y: 's-yellow', g: 's-neon-green', b: 's-blue', v: 's-purple' }, [
    tile('r', 28),
    tile('o', 28),
    tile('y', 28),
    tile('g', 28),
    tile('b', 28),
    tile('v', 28),
  ]),
  peyote('y-checkers', 'Checker Pop', { k: 's-black', h: 's-hot-pink', w: 's-white' }, [
    tile('k', 28),
    tile('hhww', 7),
    tile('hhww', 7),
    tile('wwhh', 7),
    tile('wwhh', 7),
    tile('k', 28),
  ]),
  peyote('y-twist', 'Candy Twist', { t: 's-turquoise', o: 's-orchid', w: 's-white' }, [
    tile('w', 28),
    tile('ttoo', 7),
    tile('otto', 7),
    tile('oott', 7),
    tile('toot', 7),
    tile('w', 28),
  ]),
  peyote('y-stars', 'Starry Night', { n: 's-navy', d: 't-deep-purple', w: 's-white', y: 's-yellow' }, [
    tile('n', 28),
    tile('nnnwnnn', 4),
    tile('ndnnndn', 4),
    tile('nnynnnn', 4),
    tile('wnndnnw', 4),
    tile('n', 28),
  ]),
  peyote('y-melon', 'Melon Slice Cuff', { g: 's-green', l: 's-pale-green', r: 's-raspberry', k: 's-black' }, [
    tile('g', 28),
    tile('l', 28),
    tile('rrrkrrr', 4),
    tile('rkrrrkr', 4),
    tile('l', 28),
    tile('g', 28),
  ]),
];

// ---------------------------------------------------------------------------
// X-base cuffs: 10 units = a 30-bead base ring.

const xbases: XBaseDesign[] = [
  xbase('x-ocean', 'Ocean X', { w: 's-white', t: 's-turquoise', s: 's-sky-blue', n: 's-navy' }, { ring: 'wtt', groups: ['sns', 'sws'], top: 'tt' }),
  xbase('x-candy', 'Candy X', { w: 's-white', h: 's-hot-pink', l: 's-light-pink', y: 's-yellow' }, { ring: 'whh', groups: ['lyl', 'lwl'], top: 'hh' }),
  xbase(
    'x-rainbow',
    'Rainbow X',
    { r: 's-red', o: 's-orange', y: 's-yellow', g: 's-neon-green', b: 's-blue', v: 's-purple' },
    { ring: 'rrr', groups: ['oyo', 'yoy', 'gbg', 'bgb'], top: 'vv' },
  ),
  xbase(
    'x-galaxy',
    'Galaxy X',
    { k: 's-black', n: 's-navy', d: 't-deep-purple', w: 's-white' },
    { ring: 'knn', groups: ['dwd', 'dkd', 'dwd', 'dkd'], top: 'nn' },
  ),
  xbase('x-melon', 'Melon X', { g: 's-green', l: 's-pale-green', r: 's-raspberry', k: 's-black' }, { ring: 'lgg', groups: ['rkr', 'rlr'], top: 'gg' }),
  xbase('x-neon', 'Neon Glow X', { y: 's-neon-yellow', g: 's-neon-green', h: 's-hot-pink', k: 's-black' }, { ring: 'kgg', groups: ['hyh', 'hkh'], top: 'gg' }),
];

// ---------------------------------------------------------------------------
// 3D critters: a top row and a belly row tucked under it make the body puffy.

const critters: CritterDesign[] = [
  critter(
    'k-bee',
    'Bumble Bud',
    { k: 's-black', w: 's-white', y: 's-yellow', c: 't-clear', s: 'star-yellow', g: 's-golden-yellow' },
    ['kk', 'wkkw', 'yyyy', '_ggg', 'kkkkk', '_kkkk', 'yyyyy', '_gggg', 'kkkk', '_kkk', 'yyy', 'k'],
    { 1: { both: ['k', 's'] }, 3: { both: ['c', 'ccc'] } },
  ),
  critter(
    'k-penguin',
    'Pip the Penguin',
    { k: 's-black', w: 's-white', o: 's-orange', d: 's-dark-gray' },
    ['kkk', 'kwkwk', 'kkokk', 'kwwwk', '_ddd', 'kwwwwk', '_dddd', 'kwwwwk', '_dddd', 'kwwwk', '_ddd', 'kkk'],
    { 4: { both: ['kk', 'k'] }, 12: { both: ['o', 'ooo'] } },
  ),
  critter(
    'k-ladybug',
    'Dot the Ladybug',
    { k: 's-black', w: 's-white', r: 's-red', d: 's-dark-red' },
    ['kk', 'wkkw', 'kkkk', 'rrkrr', '_ddd', 'rkrkrkr', '_ddddd', 'rrrkrrr', '_ddddd', 'rkrkrkr', '_ddd', 'rrkrr', 'k'],
    { 1: { both: ['k', 'k'] }, 6: { both: ['kk', 'k'] }, 8: { both: ['kk', 'k'] }, 10: { both: ['kk', 'k'] } },
  ),
  critter(
    'k-dino',
    'Rexy',
    { g: 's-spring-green', e: 's-emerald', y: 's-pastel-yellow', k: 's-black', o: 's-orange' },
    ['ggg', 'gkgkg', 'ggggg', 'ggg', 'geeeg', '_yyy', 'geeeeg', '_yyyy', 'geeeeg', '_yyyy', 'geeeg', '_yyy', 'ggg', 'gg', 'g', 'e'],
    { 5: { both: ['gg', 'ooo'] }, 11: { both: ['gg', 'ooo'] } },
  ),
  critter(
    'k-axolotl',
    'Lotl',
    { p: 's-pink', l: 's-light-pink', h: 's-hot-pink', k: 's-black', r: 's-raspberry' },
    ['ppp', 'pkpkp', 'ppppp', 'lppl', '_lll', 'lpppl', '_llll', 'lpppl', '_lll', 'ppp', 'pp', 'p', 'l'],
    { 2: { both: ['h', 'rhr'] }, 3: { both: ['hh', 'r'] }, 6: { both: ['p', 'll'] }, 8: { both: ['p', 'll'] } },
  ),
  critter(
    'k-owl',
    'Hoot',
    { b: 's-brown', t: 's-tan', y: 's-yellow', k: 's-black', o: 's-light-orange', c: 's-cream' },
    ['bb', 'bbbb', 'ykoky', 'bbbbb', '_ttt', 'bcccb', '_tttt', 'bcccb', '_tttt', 'bcccb', '_ttt', 'bbb'],
    { 1: { both: ['b', 'b'] }, 4: { both: ['bbb', 't'] }, 12: { both: ['o', 'oo'] } },
  ),
];

export const STARTERS: Design[] = [...bracelets, ...flats, ...cuffs, ...peyotes, ...xbases, ...critters];

export function starter(id: string): Design | undefined {
  return STARTERS.find((d) => d.id === id);
}
