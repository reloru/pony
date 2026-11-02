import { isColor } from '../core/colors';
import type { ColorId, Design, Leg, WeaveRow } from '../core/types';
import { validate } from '../core/validate';

export const BACKUP_APP = 'pony-bead-studio';
export const SCHEMA_VERSION = 1;

export interface Settings {
  sound: boolean;
  /** palette shows only beads she owns */
  mineOnly: boolean;
}

export const DEFAULT_SETTINGS: Settings = { sound: true, mineOnly: false };

export interface Backup {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: string;
  designs: Design[];
  owned: ColorId[];
  settings: Settings;
}

export function makeBackup(designs: Design[], owned: Iterable<ColorId>, settings: Settings, now = new Date()): Backup {
  return {
    app: BACKUP_APP,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    designs,
    owned: [...owned],
    settings,
  };
}

// ---------------------------------------------------------------------------
// Parsing untrusted files: copy only known fields, check every type, then validate.

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const str = (x: unknown, max = 200): string | null => (typeof x === 'string' && x.length <= max ? x : null);
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const colors = (x: unknown, max: number): ColorId[] | null =>
  Array.isArray(x) && x.length <= max && x.every(isColor) ? [...x] : null;

function parseLeg(x: unknown): Leg | undefined | null {
  if (x === undefined) return undefined;
  if (!isObj(x)) return null;
  const stem = colors(x.stem, 10);
  const toes = colors(x.toes, 10);
  return stem && toes ? { stem, toes } : null;
}

function parseRow(x: unknown): WeaveRow | null {
  if (!isObj(x)) return null;
  const beads = colors(x.beads, 20);
  const legL = parseLeg(x.legL);
  const legR = parseLeg(x.legR);
  if (!beads || legL === null || legR === null) return null;
  const r: WeaveRow = { beads };
  if (x.belly === true) r.belly = true;
  if (legL) r.legL = legL;
  if (legR) r.legR = legR;
  return r;
}

export function parseDesign(x: unknown): Design | null {
  if (!isObj(x)) return null;
  const id = str(x.id, 80);
  const name = str(x.name, 80) ?? 'My design';
  const createdAt = num(x.createdAt) ?? Date.now();
  const updatedAt = num(x.updatedAt) ?? createdAt;
  if (!id) return null;
  const meta: Record<string, unknown> = { id, name, createdAt, updatedAt };
  const baseId = str(x.baseId, 80);
  if (baseId) meta.baseId = baseId;
  const buildStep = num(x.buildStep);
  if (buildStep !== null && buildStep >= 0) meta.buildStep = Math.floor(buildStep);
  const madeAt = num(x.madeAt);
  if (madeAt !== null) meta.madeAt = madeAt;

  let d: Design | null = null;
  switch (x.kind) {
    case 'bracelet': {
      const beads = colors(x.beads, 100);
      if (beads) d = { ...(meta as object), kind: 'bracelet', beads } as Design;
      break;
    }
    case 'flat':
    case 'critter': {
      if (!Array.isArray(x.rows) || x.rows.length > 60) break;
      const rows = x.rows.map(parseRow);
      if (rows.some((r) => r === null)) break;
      d = { ...(meta as object), kind: x.kind, keyring: x.keyring === true, rows } as Design;
      break;
    }
    case 'cuff': {
      if (!Array.isArray(x.rows) || x.rows.length > 60) break;
      const rows = x.rows.map((r) => colors(r, 20));
      if (rows.some((r) => r === null)) break;
      d = { ...(meta as object), kind: 'cuff', rows } as Design;
      break;
    }
  }
  if (!d || validate(d).length) return null;
  return d;
}

export interface ParsedBackup {
  designs: Design[];
  skipped: number;
  owned: ColorId[];
  settings: Settings | null;
}

export function parseBackup(text: string): ParsedBackup {
  if (text.length > 20_000_000) throw new Error('That file is too big to be a bead backup.');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('That file is not a bead backup.');
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP) throw new Error('That file is not a bead backup.');
  const v = num(raw.schemaVersion);
  if (v === null || v > SCHEMA_VERSION) throw new Error('This backup was made by a newer version of the app.');
  const list = Array.isArray(raw.designs) ? raw.designs.slice(0, 5000) : [];
  const designs: Design[] = [];
  let skipped = 0;
  for (const item of list) {
    const d = parseDesign(item);
    if (d) designs.push(d);
    else skipped++;
  }
  const owned = Array.isArray(raw.owned) ? raw.owned.filter(isColor) : [];
  let settings: Settings | null = null;
  if (isObj(raw.settings)) {
    settings = {
      sound: raw.settings.sound !== false,
      mineOnly: raw.settings.mineOnly === true,
    };
  }
  return { designs, skipped, owned, settings };
}

/** Merge without losing anything: a design already on the device is replaced only by a newer copy. */
export function mergeDesigns(current: Design[], incoming: Design[]): { merged: Design[]; added: number; updated: number } {
  const byId = new Map(current.map((d) => [d.id, d]));
  let added = 0;
  let updated = 0;
  for (const d of incoming) {
    const have = byId.get(d.id);
    if (!have) {
      byId.set(d.id, d);
      added++;
    } else if (d.updatedAt > have.updatedAt) {
      byId.set(d.id, d);
      updated++;
    }
  }
  return { merged: [...byId.values()], added, updated };
}
