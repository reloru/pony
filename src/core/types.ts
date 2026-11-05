export type ColorId = string;

export type Kind = 'bracelet' | 'flat' | 'cuff' | 'peyote' | 'xbase' | 'critter';
export type Side = 'L' | 'R';

/**
 * A leg, ear, arm, antenna or tail hanging off one cord between two rows.
 * Made by stringing `stem` then `toes` on that side's cord, then pushing the same
 * cord back through the stem beads only. One toe acts as a stopper bead; two or
 * more toes form a little loop (a foot).
 */
export interface Leg {
  stem: ColorId[];
  toes: ColorId[];
}

/** One row of the two-cord ladder weave. Legs are made after the row, before the next one. */
export interface WeaveRow {
  beads: ColorId[];
  /** Critters only: this row is tucked under the row before it, forming the belly layer. */
  belly?: boolean;
  legL?: Leg;
  legR?: Leg;
}

interface DesignBase {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** id of the starter idea this was copied from, if any */
  baseId?: string;
  /** current step while making it */
  buildStep?: number;
  /** when she finished making it */
  madeAt?: number;
}

export interface BraceletDesign extends DesignBase {
  kind: 'bracelet';
  beads: ColorId[];
}

export interface FlatDesign extends DesignBase {
  kind: 'flat';
  keyring: boolean;
  rows: WeaveRow[];
}

export interface CritterDesign extends DesignBase {
  kind: 'critter';
  keyring: boolean;
  rows: WeaveRow[];
}

export interface CuffDesign extends DesignBase {
  kind: 'cuff';
  /** rows[i] is one rung across the band; every row has the same width */
  rows: ColorId[][];
}

/**
 * Even-count tubular peyote (kandi "peyote" / "multi" cuff). The tube has `around` columns
 * (always even). Row r has a bead in every other column: columns c with c % 2 === r % 2, so
 * rows[r][k] sits in column 2k + (r % 2). Rows 0 and 1 together are the starting ring.
 */
export interface PeyoteDesign extends DesignBase {
  kind: 'peyote';
  rows: ColorId[][];
}

/**
 * Kandi X-base cuff. rows[0]: base ring (connector, pair, pair) × n; rows[1..2h]: group rows of
 * n groups (side, middle, side); last row: n top pairs. See src/core/xbase.ts.
 */
export interface XBaseDesign extends DesignBase {
  kind: 'xbase';
  rows: ColorId[][];
}

export type Design = BraceletDesign | FlatDesign | CritterDesign | CuffDesign | PeyoteDesign | XBaseDesign;
export type WeaveDesign = FlatDesign | CritterDesign;

export const LIMITS = {
  bracelet: { min: 12, max: 48 },
  weave: { maxWidth: 11, maxRows: 30, maxStem: 6, maxToes: 5 },
  cuff: { minWidth: 2, maxWidth: 7, minRows: 10, maxRows: 30 },
  /** beads around (always even) and rows, counting the two rows of the starting ring */
  peyote: { minAround: 12, maxAround: 40, minRows: 3, maxRows: 20 },
  /** units round the cuff (connector + pair = 3 base beads each) and X's high */
  xbase: { minUnits: 6, maxUnits: 16, minHigh: 1, maxHigh: 4 },
} as const;

/** Physical bead size in mm: 9 across, 6 along the hole. */
export const BEAD = { diameter: 9, length: 6, hole: 4 } as const;
