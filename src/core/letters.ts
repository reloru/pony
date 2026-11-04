import type { ColorId, FlatDesign, WeaveRow } from './types';

/**
 * Letters for name keychains, 5 beads wide × 5 rows. Keychain beads are 6 mm wide and 9 mm
 * tall, so each letter comes out about 30 × 45 mm: the proportions of an ordinary capital.
 * "♥" is a heart.
 */
export const GLYPHS: Record<string, string[]> = {
  A: ['.###.', '#...#', '#####', '#...#', '#...#'],
  B: ['####.', '#...#', '####.', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '####.', '#....', '#####'],
  F: ['#####', '#....', '####.', '#....', '#....'],
  G: ['.####', '#....', '#.###', '#...#', '.###.'],
  H: ['#...#', '#...#', '#####', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '###..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '####.', '#....', '#....'],
  Q: ['.###.', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '####.', '#..#.', '#...#'],
  S: ['.####', '#....', '.###.', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  Y: ['#...#', '.#.#.', '..#..', '..#..', '..#..'],
  Z: ['#####', '...#.', '..#..', '.#...', '#####'],
  '♥': ['.#.#.', '#####', '#####', '.###.', '..#..'],
};

export const MAX_LETTERS = 4;

/** Keep only the characters we have letters for, capitals, at most MAX_LETTERS. */
export function cleanName(text: string): string {
  return [...text.toUpperCase()]
    .filter((ch) => GLYPHS[ch])
    .slice(0, MAX_LETTERS)
    .join('');
}

/**
 * A name keychain: one letter under another on a 7-bead-wide ladder-weave panel, a row of
 * background between letters and around the edge, hanging from a key ring.
 */
export function nameKeychain(
  text: string,
  letter: ColorId,
  background: ColorId,
  meta: { id: string; createdAt: number; updatedAt: number },
): FlatDesign | null {
  const name = cleanName(text);
  if (!name) return null;
  const row = (pattern: string): WeaveRow => ({ beads: [...pattern].map((ch) => (ch === '#' ? letter : background)) });
  const blank = '.......';
  const rows: WeaveRow[] = [row(blank)];
  [...name].forEach((ch, i) => {
    if (i > 0) rows.push(row(blank));
    for (const line of GLYPHS[ch]) rows.push(row(`.${line}.`));
  });
  rows.push(row(blank));
  return { ...meta, name, kind: 'flat', keyring: true, rows };
}
