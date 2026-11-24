/**
 * Seating policies and a search solver over the pure rules in logic.ts.
 * Used by logic.test.ts to prove every level is winnable and has real pressure.
 */
import { canSeat, cloneState, newState, seat, step, type Ev, type LevelSpec, type Plate, type State } from './logic.ts';

/** A policy returns the queue index to seat before the next tick, or -1 to wait. */
export type Policy = (s: State) => number;

export interface RunResult {
  status: 'won' | 'lost' | 'stuck';
  peak: number;
  ticks: number;
  /** Ticks when each diner was seated (for replaying a solution). */
  plan: [number, number][];
}

export function run(level: LevelSpec, policy: Policy, maxTicks = 4000): RunResult {
  const s = newState(level);
  const ev: Ev[] = [];
  const plan: [number, number][] = [];
  while (s.status === 'play' && s.tick < maxTicks) {
    const q = policy(s);
    if (q >= 0 && seat(s, q)) plan.push([s.tick, q]);
    step(s, ev);
    ev.length = 0;
  }
  return { status: s.status === 'play' ? 'stuck' : s.status, peak: s.peak, ticks: s.tick, plan };
}

/** What a hurried player does: always seat whoever is at the front, as soon as possible. */
export const naive: Policy = (s) => (canSeat(s, 0) === 'ok' ? 0 : -1);

/**
 * A sensible human: looks at the belt and the visible "coming up" plates, seats the
 * visible diner who can eat the most of that right away; waits if nobody can eat anything
 * (unless the counter is empty).
 */
export function smart(lookahead = 3, every = 1): Policy {
  return (s) => {
    if (s.tick % every !== 0) return -1;
    const free = supply(s, lookahead);
    let best = -1;
    let bestScore = 0;
    let firstOk = -1;
    for (let q = 0; q < Math.min(s.level.choose, s.queue.length); q++) {
      if (canSeat(s, q) !== 'ok') continue;
      if (firstOk < 0) firstOk = q;
      let score = 0;
      for (const o of s.queue[q].order) score += Math.min(o.n, (free.get(o.dish) ?? 0) + (free.get('G') ?? 0));
      if (score > bestScore) {
        bestScore = score;
        best = q;
      }
    }
    if (best >= 0) return best;
    const idle = !s.box && s.stools.every((d) => !d);
    return idle ? firstOk : -1;
  };
}

function supply(s: State, lookahead: number): Map<Plate, number> {
  const m = new Map<Plate, number>();
  const add = (p: Plate, k: number) => m.set(p, (m.get(p) ?? 0) + k);
  for (const p of s.slots) if (p) add(p, 1);
  for (let i = 0; i < Math.min(lookahead, s.kitchen.length); i++) add(s.kitchen[i], 1);
  const seated = [...s.stools, s.box];
  for (const d of seated) if (d) for (const o of d.left) add(o.dish, -o.n);
  return m;
}

/** Deterministic PRNG for the random-player check. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A player who taps a random visible diner now and then. */
export function randomPlayer(seed: number, tapChance = 0.35): Policy {
  const r = rng(seed);
  return (s) => {
    if (r() > tapChance) return -1;
    const ok: number[] = [];
    for (let q = 0; q < Math.min(s.level.choose, s.queue.length); q++) if (canSeat(s, q) === 'ok') ok.push(q);
    return ok.length ? ok[Math.floor(r() * ok.length)] : -1;
  };
}

function key(s: State): string {
  const d = (x: State['box']) => (x ? x.spec.id + ':' + x.left.map((o) => o.n).join('.') : '-');
  return [
    s.started ? s.tick % 16 : 'w',
    s.slots.map((p) => p ?? '_').join(''),
    s.kitchen.join(''),
    s.cookTimer,
    s.stools.map(d).join(','),
    d(s.box),
    s.queue.map((q) => q.id).join(','),
  ].join('|');
}

export interface SolveResult {
  win: boolean;
  nodes: number;
  peak: number;
  plan: [number, number][];
}

/**
 * Depth-first search over "seat one of the visible diners, or wait" each tick, with a
 * visited set. At most one seat per tick (a human pace). `peakCap` prunes any line where
 * the belt holds more plates than that, so the solver can also find the calmest line.
 */
export function solve(level: LevelSpec, opts: { peakCap?: number; maxNodes?: number } = {}): SolveResult {
  const cap = opts.peakCap ?? Infinity;
  const maxNodes = opts.maxNodes ?? 400000;
  const seen = new Set<string>();
  const hint = smart(3);
  let nodes = 0;
  const plan: [number, number][] = [];
  const ev: Ev[] = [];

  const dfs = (s: State): State | null => {
    if (nodes++ > maxNodes) return null;
    const k = key(s);
    if (seen.has(k)) return null;
    seen.add(k);
    const options: number[] = [];
    const h = hint(s);
    if (h >= 0) options.push(h);
    for (let q = 0; q < Math.min(s.level.choose, s.queue.length); q++) if (q !== h && canSeat(s, q) === 'ok') options.push(q);
    if (h >= 0) options.push(-1);
    else options.unshift(-1);
    for (const q of options) {
      const n = cloneState(s);
      if (q >= 0) seat(n, q);
      step(n, ev);
      ev.length = 0;
      if (n.peak > cap || n.status === 'lost') continue;
      if (q >= 0) plan.push([s.tick, q]);
      if (n.status === 'won') return n;
      if (n.tick < 4000) {
        const r = dfs(n);
        if (r) return r;
      }
      if (q >= 0) plan.pop();
    }
    return null;
  };
  const end = dfs(newState(level));
  return { win: !!end, nodes, peak: end ? end.peak : -1, plan: end ? plan.slice() : [] };
}

/** Smallest peak any (one-seat-per-tick) line can win with. */
export function minPeak(level: LevelSpec, maxNodes = 150000): number {
  const total = level.kitchen.length;
  for (let cap = 1; cap <= Math.min(16, total); cap++) {
    if (solve(level, { peakCap: cap, maxNodes }).win) return cap;
  }
  return -1;
}
