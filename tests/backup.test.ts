import { describe, expect, it } from 'vitest';
import { makeBackup, mergeDesigns, parseBackup, parseDesign, DEFAULT_SETTINGS } from '../src/app/backup';
import { STARTERS } from '../src/core/designs';
import type { Design } from '../src/core/types';

describe('backup', () => {
  it('round-trips every starter design, owned colors and settings', () => {
    const b = makeBackup(STARTERS, ['s-red', 'p-white'], { sound: false, mineOnly: true });
    const parsed = parseBackup(JSON.stringify(b));
    expect(parsed.designs).toEqual(STARTERS);
    expect(parsed.skipped).toBe(0);
    expect(parsed.owned).toEqual(['s-red', 'p-white']);
    expect(parsed.settings).toEqual({ sound: false, mineOnly: true });
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('not json')).toThrow(/not a bead backup/);
    expect(() => parseBackup('{"hello":1}')).toThrow(/not a bead backup/);
    expect(() => parseBackup(JSON.stringify({ ...makeBackup([], [], DEFAULT_SETTINGS), schemaVersion: 99 }))).toThrow(/newer version/);
  });

  it('skips broken or unbuildable designs and drops unknown fields', () => {
    const good = structuredClone(STARTERS[0]) as Design & { evil?: string };
    good.evil = '<script>';
    const badColor = { ...structuredClone(STARTERS[0]), id: 'x1', beads: ['nope'] };
    const starInRow = structuredClone(STARTERS.find((d) => d.kind === 'flat')!) as Design & { rows: { beads: string[] }[] };
    starInRow.id = 'x2';
    starInRow.rows[0].beads[0] = 'star-red';
    const raw = { ...makeBackup([], [], DEFAULT_SETTINGS), designs: [good, badColor, starInRow, null, 42, { kind: 'bracelet' }] };
    const parsed = parseBackup(JSON.stringify(raw));
    expect(parsed.designs).toHaveLength(1);
    expect(parsed.skipped).toBe(5);
    expect('evil' in parsed.designs[0]).toBe(false);
  });

  it('parseDesign keeps build progress', () => {
    const d = { ...structuredClone(STARTERS[1]), buildStep: 3, madeAt: 123 };
    expect(parseDesign(d)).toMatchObject({ buildStep: 3, madeAt: 123 });
  });

  it('merging never deletes and keeps the newer copy', () => {
    const a = { ...structuredClone(STARTERS[0]), updatedAt: 10, name: 'old' };
    const a2 = { ...a, updatedAt: 20, name: 'new' };
    const b = { ...structuredClone(STARTERS[1]), updatedAt: 5 };
    const c = { ...structuredClone(STARTERS[2]), updatedAt: 5 };
    const r = mergeDesigns([a, b], [a2, c]);
    expect(r.added).toBe(1);
    expect(r.updated).toBe(1);
    expect(r.merged.map((d) => d.name).sort()).toEqual([b.name, c.name, 'new'].sort());
    const r2 = mergeDesigns([a2], [a]);
    expect(r2.updated).toBe(0);
    expect(r2.merged[0].name).toBe('new');
  });
});
