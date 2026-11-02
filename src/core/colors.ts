export type Finish = 'solid' | 'clear' | 'pearl' | 'star';

export interface BeadColor {
  id: string;
  name: string;
  hex: string;
  finish: Finish;
}

const SOLID: [string, string][] = [
  ['White', '#DDDDDD'],
  ['Cream', '#EDCC97'],
  ['Pastel Yellow', '#EDED8A'],
  ['Neon Yellow', '#EDF666'],
  ['Yellow', '#F9E44D'],
  ['Golden Yellow', '#F8D158'],
  ['Mustard', '#BB8F46'],
  ['Light Orange', '#EFAB50'],
  ['Peach', '#F09E6F'],
  ['Tan', '#DE9861'],
  ['Orange', '#EB8635'],
  ['Red Orange', '#DB523C'],
  ['Red', '#AE2B20'],
  ['Dark Red', '#922925'],
  ['Maroon', '#492523'],
  ['Raspberry', '#DE3860'],
  ['Hot Pink', '#EA5584'],
  ['Pink', '#EB879C'],
  ['Light Pink', '#F0AED2'],
  ['Pale Pink', '#F6D4EA'],
  ['Pastel Peach', '#F4D4D1'],
  ['Orchid', '#C681D1'],
  ['Medium Orchid', '#AD56A2'],
  ['Plum', '#6B3776'],
  ['Pale Lavender', '#C1B7EE'],
  ['Lavender', '#9C90E6'],
  ['Purple', '#60479A'],
  ['Indigo', '#43329B'],
  ['Royal Blue', '#13298C'],
  ['Navy', '#1F2458'],
  ['Blue', '#326FB8'],
  ['Cerulean', '#4193BB'],
  ['Sky Blue', '#60BFE6'],
  ['Baby Blue', '#85BDF4'],
  ['Pale Blue', '#BCD8E1'],
  ['Turquoise', '#6DC7C8'],
  ['Mint', '#9AD4CD'],
  ['Pale Green', '#A0E1A0'],
  ['Neon Green', '#69D459'],
  ['Spring Green', '#5FC47A'],
  ['Green', '#46935D'],
  ['Emerald', '#2F684C'],
  ['Hunter Green', '#224D44'],
  ['Olive', '#5F744C'],
  ['Brown', '#705149'],
  ['Dark Brown', '#423534'],
  ['Gray', '#8F8F8F'],
  ['Dark Gray', '#616161'],
  ['Black', '#1A1A1A'],
];

const CLEAR: [string, string][] = [
  ['Clear', '#E0E2E9'],
  ['Lemon Yellow', '#E8E06C'],
  ['Golden Yellow', '#E6BA49'],
  ['Peach', '#EBA964'],
  ['Orange', '#E5703B'],
  ['Red', '#D84A3D'],
  ['Light Pink', '#E9BED3'],
  ['Pink', '#E796C6'],
  ['Hot Pink', '#DC6493'],
  ['Magenta', '#C03DAD'],
  ['Lavender', '#C99CEC'],
  ['Purple', '#9071C0'],
  ['Deep Purple', '#6235C4'],
  ['Ice Blue', '#AFCCE2'],
  ['Sky Blue', '#83B9E5'],
  ['Blue', '#4291DE'],
  ['Mint', '#67DEBD'],
  ['Light Green', '#95DD82'],
  ['Green', '#4FA967'],
  ['Smoky Brown', '#7A5E52'],
];

const PEARL: [string, string][] = [
  ['White', '#F5F6F8'],
  ['Pink', '#EAAEC8'],
  ['Peach', '#EAA598'],
  ['Coral', '#DD6061'],
  ['Hot Pink', '#D9478A'],
  ['Lavender', '#A29DC8'],
  ['Light Blue', '#6ABBDA'],
  ['Steel Blue', '#5787A4'],
  ['Light Green', '#90C791'],
  ['Green', '#418860'],
];

/** Star beads have no listed hex; each shares the hex of the solid color with the same name. */
const STAR_NAMES = [
  'White',
  'Yellow',
  'Orange',
  'Red',
  'Light Pink',
  'Lavender',
  'Royal Blue',
  'Baby Blue',
  'Green',
  'Black',
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const PREFIX: Record<Finish, string> = { solid: 's', clear: 't', pearl: 'p', star: 'star' };

function make(finish: Finish, list: [string, string][]): BeadColor[] {
  return list.map(([name, hex]) => ({ id: `${PREFIX[finish]}-${slug(name)}`, name, hex, finish }));
}

const solidHex = new Map(SOLID.map(([n, h]) => [n, h]));

export const COLORS: BeadColor[] = [
  ...make('solid', SOLID),
  ...make('clear', CLEAR),
  ...make('pearl', PEARL),
  ...make(
    'star',
    STAR_NAMES.map((n) => {
      const hex = solidHex.get(n);
      if (!hex) throw new Error(`star color without solid match: ${n}`);
      return [n, hex] as [string, string];
    }),
  ),
];

export const COLOR_BY_ID: ReadonlyMap<string, BeadColor> = new Map(COLORS.map((c) => [c.id, c]));

export const FINISH_LABEL: Record<Finish, string> = {
  solid: 'Solid',
  clear: 'See-through',
  pearl: 'Pearl',
  star: 'Star',
};

export function color(id: string): BeadColor {
  const c = COLOR_BY_ID.get(id);
  if (!c) throw new Error(`unknown bead color: ${id}`);
  return c;
}

export function isColor(id: unknown): id is string {
  return typeof id === 'string' && COLOR_BY_ID.has(id);
}

export function isStar(id: string): boolean {
  return COLOR_BY_ID.get(id)?.finish === 'star';
}

/** Spoken/visible name that distinguishes finishes, e.g. "see-through Pink". */
export function longName(id: string): string {
  const c = color(id);
  switch (c.finish) {
    case 'solid':
      return c.name;
    case 'clear':
      return c.name === 'Clear' ? 'Clear' : `see-through ${c.name}`;
    case 'pearl':
      return `pearl ${c.name}`;
    case 'star':
      return `${c.name} star`;
  }
}
