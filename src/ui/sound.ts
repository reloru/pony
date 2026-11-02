import { getState } from '../app/store';

/** Tiny synthesized sound effects (no audio files, no network). */
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (!getState().settings.sound) return null;
  try {
    if (!ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.14) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  o.frequency.exponentialRampToValueAtTime(freq * 1.5, t0 + dur * 0.6);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

let last = 0;
export function pop() {
  const now = performance.now();
  if (now - last < 45) return; // painting fast: don't machine-gun
  last = now;
  tone(520 + Math.random() * 260, 0, 0.09);
}

export function boop() {
  tone(220, 0, 0.12, 'triangle', 0.12);
}

export function chime() {
  tone(660, 0, 0.14);
  tone(990, 0.07, 0.18);
}

export function fanfare() {
  [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.11, 0.28, 'triangle', 0.13));
}
