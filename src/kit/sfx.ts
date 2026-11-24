/**
 * Tiny Web Audio synth: every sound is generated, no audio files. Sounds are short,
 * soft and pitched (pentatonic) so a fast chain of taps sounds musical, not noisy.
 */
import { load, save } from './save';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = load<boolean>('muted', false);

export function unlockAudio(): void {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

export function isMuted(): boolean {
  return muted;
}
export function setMuted(m: boolean): void {
  muted = m;
  save('muted', m);
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.02);
}

type Wave = OscillatorType;

interface ToneOpts {
  freq: number;
  to?: number; // slide target frequency
  dur?: number;
  type?: Wave;
  vol?: number;
  attack?: number;
  delay?: number;
  detune?: number;
}

export function tone(o: ToneOpts): void {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + (o.delay ?? 0);
  const dur = o.dur ?? 0.12;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
  if (o.detune) osc.detune.value = o.detune;
  const vol = o.vol ?? 0.3;
  const a = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export function noise(o: { dur?: number; vol?: number; delay?: number; freq?: number; q?: number }): void {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + (o.delay ?? 0);
  const dur = o.dur ?? 0.15;
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = o.freq ?? 1200;
  f.Q.value = o.q ?? 0.8;
  const g = ctx.createGain();
  g.gain.value = o.vol ?? 0.2;
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

// C major pentatonic across ~2.5 octaves: any step sequence sounds pleasant.
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093];
export function penta(step: number): number {
  const i = Math.max(0, Math.min(PENTA.length - 1, step));
  return PENTA[i];
}

/** Ready-made sounds every game shares. */
export const sfx = {
  tap() {
    tone({ freq: 720, to: 540, dur: 0.06, type: 'triangle', vol: 0.18 });
  },
  pop(step = 0) {
    const f = penta(step);
    tone({ freq: f * 0.8, to: f * 1.25, dur: 0.09, type: 'sine', vol: 0.32 });
    tone({ freq: f * 2, dur: 0.05, type: 'triangle', vol: 0.06, delay: 0.01 });
  },
  pluck(step = 0) {
    const f = penta(step);
    tone({ freq: f, dur: 0.18, type: 'triangle', vol: 0.22 });
    tone({ freq: f * 2, dur: 0.1, type: 'sine', vol: 0.05 });
  },
  whoosh() {
    noise({ dur: 0.22, vol: 0.12, freq: 900, q: 0.6 });
  },
  thud() {
    tone({ freq: 160, to: 70, dur: 0.16, type: 'sine', vol: 0.45 });
    noise({ dur: 0.08, vol: 0.12, freq: 400 });
  },
  bump() {
    tone({ freq: 220, to: 130, dur: 0.14, type: 'square', vol: 0.08 });
    tone({ freq: 180, to: 90, dur: 0.18, type: 'sine', vol: 0.35 });
  },
  error() {
    tone({ freq: 300, to: 200, dur: 0.12, type: 'sawtooth', vol: 0.06 });
    tone({ freq: 240, to: 160, dur: 0.16, type: 'sawtooth', vol: 0.06, delay: 0.09 });
  },
  coin(step = 4) {
    const f = penta(step);
    tone({ freq: f, dur: 0.07, type: 'square', vol: 0.06 });
    tone({ freq: f * 1.5, dur: 0.18, type: 'square', vol: 0.06, delay: 0.06 });
  },
  sparkle() {
    for (let i = 0; i < 4; i++) tone({ freq: penta(6 + i), dur: 0.12, type: 'sine', vol: 0.1, delay: i * 0.04 });
  },
  win() {
    const seq = [0, 2, 4, 5, 7, 9];
    seq.forEach((s, i) => tone({ freq: penta(s), dur: 0.22, type: 'triangle', vol: 0.22, delay: i * 0.075 }));
    tone({ freq: penta(5) / 2, dur: 0.6, type: 'sine', vol: 0.2, delay: 0.42 });
    tone({ freq: penta(9), dur: 0.5, type: 'sine', vol: 0.12, delay: 0.45 });
  },
  lose() {
    [4, 3, 1, 0].forEach((s, i) =>
      tone({ freq: penta(s) / 2, dur: 0.26, type: 'triangle', vol: 0.2, delay: i * 0.13 }),
    );
  },
  star(i: number) {
    tone({ freq: penta(4 + i * 2), dur: 0.25, type: 'triangle', vol: 0.24 });
    tone({ freq: penta(6 + i * 2), dur: 0.3, type: 'sine', vol: 0.1, delay: 0.03 });
  },
  warn() {
    tone({ freq: 880, dur: 0.08, type: 'square', vol: 0.05 });
    tone({ freq: 880, dur: 0.08, type: 'square', vol: 0.05, delay: 0.14 });
  },
};
