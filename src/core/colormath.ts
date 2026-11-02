import { COLORS, color, type BeadColor } from './colors';

type Lab = [number, number, number];

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** OKLab (Björn Ottosson, 2020): perceptual color space where Euclidean distance tracks visible difference. */
export function hexToOklab(hex: string): Lab {
  const n = parseInt(hex.slice(1), 16);
  const r = srgbToLinear((n >> 16) & 255);
  const g = srgbToLinear((n >> 8) & 255);
  const b = srgbToLinear(n & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363282233 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969106 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const labCache = new Map<string, Lab>();
function lab(id: string): Lab {
  let v = labCache.get(id);
  if (!v) {
    v = hexToOklab(color(id).hex);
    labCache.set(id, v);
  }
  return v;
}

export function distance(a: string, b: string): number {
  const x = lab(a);
  const y = lab(b);
  // Prefer keeping the same finish (pearl stays pearl if possible) with a small penalty otherwise.
  const finishPenalty = color(a).finish === color(b).finish ? 0 : 0.04;
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) + finishPenalty;
}

export function nearest(id: string, candidates: string[]): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = distance(id, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** Relative luminance, for picking readable text/outline colors over a bead. */
export function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  const r = f((n >> 16) & 255),
    g = f((n >> 8) & 255),
    b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export const ALL_IDS = COLORS.map((c: BeadColor) => c.id);
