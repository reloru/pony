import { describe, expect, it } from 'vitest';
import { STARTERS } from '../src/core/designs';
import { progressAfterEdit, steps } from '../src/core/steps';
import type { BraceletDesign, FlatDesign } from '../src/core/types';

const kitty = STARTERS.find((d) => d.id === 'f-kitty') as FlatDesign;
const bracelet = STARTERS.find((d) => d.id === 'b-rainbow') as BraceletDesign;

/** page number (1-based) of the step that builds row `row` (1-based) */
const pageOfRow = (d: FlatDesign, row: number) => steps(d).findIndex((s) => s.t === 'row' && s.row === row) + 1;

describe('build progress after an edit', () => {
  it('keeps her place when only the name changes', () => {
    expect(progressAfterEdit(kitty, { ...kitty, name: 'Mittens' }, 9)).toBe(9);
  });

  it('keeps her place when the change is in a step she has not reached', () => {
    const edited = structuredClone(kitty);
    edited.rows[7].beads[0] = 's-red';
    const page = pageOfRow(kitty, 4);
    expect(progressAfterEdit(kitty, edited, page)).toBe(page);
  });

  it('sends her back to the first step that changed if she already passed it', () => {
    const edited = structuredClone(kitty);
    edited.rows[1].beads[0] = 's-red';
    const at = pageOfRow(kitty, 7);
    expect(progressAfterEdit(kitty, edited, at)).toBe(pageOfRow(kitty, 2));
  });

  it('a different cord length alone does not send her back to cutting', () => {
    const edited = structuredClone(kitty);
    edited.rows.push({ beads: ['s-gray', 's-gray'] });
    const at = pageOfRow(kitty, 5);
    expect(progressAfterEdit(kitty, edited, at)).toBe(at);
  });

  it('bracelets go back to the chunk that changed', () => {
    const edited = structuredClone(bracelet);
    edited.beads[0] = 's-black';
    expect(progressAfterEdit(bracelet, edited, 6)).toBe(3); // page 1 cut, 2 tape, 3 first beads
    expect(progressAfterEdit(bracelet, edited, 0)).toBe(0);
  });
});
