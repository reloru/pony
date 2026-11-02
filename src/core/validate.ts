import { isColor, isStar } from './colors';
import { LIMITS, type Design, type Leg, type WeaveRow } from './types';

/**
 * Returns a list of problems; an empty list means the design can be built with the
 * steps this app generates. Star beads are only allowed where the cord passes through
 * a bead once (bracelet strands and leg toes), because their hole size is not known.
 */
export function validate(d: Design): string[] {
  const p: string[] = [];
  const checkColor = (c: unknown, where: string, starOk: boolean) => {
    if (!isColor(c)) p.push(`${where}: unknown color ${String(c)}`);
    else if (!starOk && isStar(c)) p.push(`${where}: star beads only go on bracelets or leg tips`);
  };

  switch (d.kind) {
    case 'bracelet': {
      const n = d.beads.length;
      if (n < LIMITS.bracelet.min || n > LIMITS.bracelet.max) p.push(`bracelet: ${n} beads is out of range`);
      d.beads.forEach((c, i) => checkColor(c, `bead ${i + 1}`, true));
      break;
    }
    case 'flat':
    case 'critter': {
      validateWeave(d.rows, d.kind === 'critter', p, checkColor);
      break;
    }
    case 'cuff': {
      const L = LIMITS.cuff;
      if (d.rows.length < L.minRows || d.rows.length > L.maxRows) p.push(`cuff: ${d.rows.length} rows is out of range`);
      const w = d.rows[0]?.length ?? 0;
      if (w < L.minWidth || w > L.maxWidth) p.push(`cuff: width ${w} is out of range`);
      d.rows.forEach((r, i) => {
        if (r.length !== w) p.push(`cuff row ${i + 1}: width ${r.length} differs from ${w}`);
        r.forEach((c, j) => checkColor(c, `row ${i + 1} bead ${j + 1}`, false));
      });
      break;
    }
    default:
      p.push('unknown design kind');
  }
  return p;
}

function validateWeave(
  rows: WeaveRow[],
  bellyAllowed: boolean,
  p: string[],
  checkColor: (c: unknown, where: string, starOk: boolean) => void,
) {
  const L = LIMITS.weave;
  if (rows.length < 1 || rows.length > L.maxRows) p.push(`${rows.length} rows is out of range`);
  rows.forEach((r, i) => {
    const where = `row ${i + 1}`;
    if (r.beads.length < 1 || r.beads.length > L.maxWidth) p.push(`${where}: width ${r.beads.length} is out of range`);
    r.beads.forEach((c, j) => checkColor(c, `${where} bead ${j + 1}`, false));
    if (r.belly && !bellyAllowed) p.push(`${where}: belly rows are only for critters`);
    if (r.belly && i === 0) p.push('row 1 cannot be a belly row');
    for (const [side, leg] of [
      ['left', r.legL],
      ['right', r.legR],
    ] as [string, Leg | undefined][]) {
      if (!leg) continue;
      if (leg.stem.length < 1 || leg.stem.length > L.maxStem) p.push(`${where} ${side} leg: stem length out of range`);
      if (leg.toes.length < 1 || leg.toes.length > L.maxToes) p.push(`${where} ${side} leg: toe count out of range`);
      leg.stem.forEach((c, j) => checkColor(c, `${where} ${side} leg bead ${j + 1}`, false));
      leg.toes.forEach((c, j) => checkColor(c, `${where} ${side} leg tip ${j + 1}`, true));
    }
  });
}
