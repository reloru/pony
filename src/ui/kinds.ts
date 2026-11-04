import { clone, newId } from '../core/edit';
import type { Design, Kind } from '../core/types';

export const KIND_INFO: Record<Kind, { label: string; one: string; color: string; ink: string; cord: string; is3d: boolean }> = {
  bracelet: { label: 'Bracelets', one: 'Bracelet', color: '#ff8fc4', ink: '#7a1d4f', cord: 'stretchy cord', is3d: false },
  flat: { label: 'Keychains', one: 'Keychain', color: '#ffc061', ink: '#7a4a00', cord: 'plastic lace', is3d: false },
  cuff: { label: 'Ladder Cuffs', one: 'Ladder cuff', color: '#6fd3f5', ink: '#0b4f66', cord: 'stretchy cord', is3d: true },
  peyote: { label: 'Peyote Cuffs', one: 'Peyote cuff', color: '#c9b2ff', ink: '#41237a', cord: 'stretchy cord', is3d: true },
  critter: { label: 'Critters', one: 'Critter', color: '#8fe08a', ink: '#1f5c1c', cord: 'plastic lace', is3d: true },
};

export const KINDS: Kind[] = ['bracelet', 'flat', 'cuff', 'peyote', 'critter'];

const W = 's-white';

export function blankDesign(kind: Kind): Design {
  const now = Date.now();
  const meta = { id: newId(), name: `My ${KIND_INFO[kind].one}`, createdAt: now, updatedAt: now };
  switch (kind) {
    case 'bracelet':
      return { ...meta, kind, beads: Array(28).fill(W) };
    case 'flat':
      return { ...meta, kind, keyring: true, rows: Array.from({ length: 5 }, () => ({ beads: Array(5).fill(W) })) };
    case 'cuff':
      return { ...meta, kind, rows: Array.from({ length: 18 }, () => Array(5).fill(W)) };
    case 'peyote':
      return { ...meta, kind, rows: Array.from({ length: 8 }, () => Array(14).fill(W)) };
    case 'critter':
      return {
        ...meta,
        kind,
        keyring: true,
        rows: [
          { beads: Array(3).fill(W) },
          { beads: Array(4).fill(W) },
          { beads: Array(5).fill(W) },
          { beads: Array(4).fill(W), belly: true },
          { beads: Array(5).fill(W) },
          { beads: Array(4).fill(W), belly: true },
          { beads: Array(3).fill(W) },
          { beads: Array(1).fill(W) },
        ],
      };
  }
}

export function copyOf(d: Design, name?: string): Design {
  const now = Date.now();
  const c = clone(d);
  c.id = newId();
  c.name = name ?? d.name;
  c.createdAt = now;
  c.updatedAt = now;
  c.baseId = d.baseId ?? d.id;
  delete c.buildStep;
  delete c.madeAt;
  return c;
}
