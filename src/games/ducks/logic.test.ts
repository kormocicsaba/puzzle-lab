/**
 * Duckling Dash rules + level checks. Run: node src/games/ducks/logic.test.ts
 * - unit checks of the move rules (straight swim, bump, turners, families, sleepers)
 * - every level: parses, is solved by a DFS over states, has no dead ends or loops in
 *   any reachable state (BFS, capped), and prints the curve.
 */
// A tiny assert, so the file typechecks with the app's DOM-only tsconfig (no @types/node).
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const assert = {
  ok(v: unknown, msg = 'assertion failed'): void {
    if (!v) throw new Error(msg);
  },
  equal(a: unknown, b: unknown, msg?: string): void {
    if (a !== b) throw new Error(msg ?? `expected ${String(b)}, got ${String(a)}`);
  },
  deepEqual(a: unknown, b: unknown, msg?: string): void {
    if (!same(a, b)) throw new Error(msg ?? `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  },
  throws(fn: () => unknown): void {
    try {
      fn();
    } catch {
      return;
    }
    throw new Error('expected a throw');
  },
};
import {
  applyEscape,
  cloneState,
  freeDucks,
  initialState,
  parseLevel,
  resolve,
  trapDucks,
  type Level,
  type State,
} from './logic.ts';
import { LEVELS } from './levels.ts';

// ---------------------------------------------------------------- rule checks

function lv(map: string[]): Level {
  return parseLevel({ name: 't', map });
}
const at = (L: Level, x: number, y: number) => L.ducks.find((d) => d.cells[0] === y * L.cols + x)!.id;

{
  // Straight escape and a bump into another duck.
  const L = lv(['.. .. ..', '>. .. v.', '.. .. ..']);
  const s = initialState(L);
  const a = resolve(L, s, at(L, 0, 1));
  assert.equal(a.kind, 'bump');
  assert.equal(a.blocker, at(L, 2, 1));
  assert.deepEqual(a.path, [4]);
  const b = resolve(L, s, at(L, 2, 1));
  assert.equal(b.kind, 'escape');
  assert.equal(b.endDir, 2);
  applyEscape(L, s, at(L, 2, 1));
  assert.equal(resolve(L, s, at(L, 0, 1)).kind, 'escape');
}
{
  // Rocks block; immediate neighbour bump has an empty path.
  const L = lv(['^. ##', '.. ..']);
  const m = resolve(L, initialState(L), 0);
  assert.equal(m.kind, 'escape');
  const L2 = lv(['>. ##', '.. ..']);
  const m2 = resolve(L2, initialState(L2), 0);
  assert.equal(m2.kind, 'bump');
  assert.equal(m2.blocker, -1);
  assert.deepEqual(m2.path, []);
}
{
  // Turner: right onto a clockwise pad turns down.
  const L = lv(['>. +R ..', '.. .. ..', '.. .. ..']);
  const m = resolve(L, initialState(L), 0);
  assert.equal(m.kind, 'escape');
  assert.deepEqual(m.path, [1, 4, 7]);
  assert.equal(m.endDir, 2);
  // Counter-clockwise: right turns up.
  const L2 = lv(['.. .. ..', '>. +L ..']);
  const m2 = resolve(L2, initialState(L2), 0);
  assert.deepEqual(m2.path, [4, 1]);
  assert.equal(m2.endDir, 0);
}
{
  // Family: mother up with two ducklings behind; blocked mother means the whole family stays.
  const L = lv(['.. .. ..', '.. A^ ..', '.. a1 ..', '.. a2 ..']);
  const mom = L.ducks[0];
  assert.deepEqual(mom.cells, [4, 7, 10]);
  assert.equal(resolve(L, initialState(L), 0).kind, 'escape');
  const L2 = lv(['.. <. ..', '.. A^ ..', '.. a1 ..']);
  const s2 = initialState(L2);
  const mv = resolve(L2, s2, at(L2, 1, 1));
  assert.equal(mv.kind, 'bump');
  applyEscape(L2, s2, at(L2, 1, 0));
  const mv2 = resolve(L2, s2, at(L2, 1, 1));
  assert.equal(mv2.kind, 'escape');
  applyEscape(L2, s2, at(L2, 1, 1));
  assert.equal(s2.remaining, 0);
  assert.ok(s2.occ.every((o) => o === -1));
}
{
  // Family snake: the mother can follow her tail's freed cells around a loop of pads.
  // Mother right at (0,0) → pad (1,0) turns down → pad (1,1) turns left → (0,1) where her
  // duckling was: it has moved on (into her old cell), so the cell is free.
  const L = lv(['A> +R', 'a1 +R']);
  const m = resolve(L, initialState(L), 0);
  // (0,1)… the duckling moved to (0,0) as she stepped to (1,0); then to (1,0) as she went
  // to (1,1); so (0,1) is free and she continues left out of the pond.
  assert.equal(m.kind, 'escape');
  assert.deepEqual(m.path, [1, 3, 2]);
  // A longer family would still be sitting there: own-body bump.
  const L2 = lv(['a1 A> +R', 'a2 .. ..', 'a3 .. ..']);
  assert.equal(resolve(L2, initialState(L2), 0).kind, 'escape');
  const L3 = lv(['A> +R', 'a1 +R', 'a2 ..']);
  // path: (1,0) → (1,1) → (0,1): after 3 steps body is trail[3..4] = (0,0),(1,0), (0,1) free.
  assert.equal(resolve(L3, initialState(L3), 0).kind, 'escape');
  const L4 = lv(['a1 A> +R', 'a2 a3 +R']);
  // trail: a3(1,1) a2(0,1) a1(0,0) A(1,0) → (2,0) → (2,1) → (1,1): body after 2nd step
  // sits on (0,1),(0,0),(1,0)… (1,1) was a3's and is free by then? body after step 3 =
  // trail[3..5] = (1,0),(2,0),(2,1): (1,1) is free → escape continues to (0,1)? trail[4..6]
  // = (2,0),(2,1),(1,1): free → exits left.
  assert.equal(resolve(L4, initialState(L4), 0).kind, 'escape');
}
{
  // Sleepers can't move and wake when a neighbour leaves.
  const L = lv(['.. ^z ..', '.. ^. ..', '.. .. ..']);
  const s = initialState(L);
  const sleeper = at(L, 1, 0);
  assert.equal(resolve(L, s, sleeper).kind, 'asleep');
  assert.equal(resolve(L, s, at(L, 1, 1)).kind, 'bump');
  assert.deepEqual(freeDucks(L, s), []);
  const L2 = lv(['>. ^z', '.. ^.']);
  const s2 = initialState(L2);
  // The bottom duck is blocked by the sleeper; the left one is blocked too. Dead end.
  assert.deepEqual(freeDucks(L2, s2), []);
  const L3 = lv(['<. ^z', '.. ^.']);
  const s3 = initialState(L3);
  const woke = applyEscape(L3, s3, at(L3, 0, 0));
  assert.deepEqual(woke, [at(L3, 1, 0)]);
  assert.equal(resolve(L3, s3, at(L3, 1, 0)).kind, 'escape');
}
{
  // Parser rejects broken data.
  assert.throws(() => lv(['.. a1', '.. ..']));
  assert.throws(() => lv(['A^ ..', '.. a1']));
  assert.throws(() => lv(['.. ..', '..']));
  assert.throws(() => lv(['xx ..']));
}

// ---------------------------------------------------------------- level checks

const key = (s: State) => s.present.map((p) => (p ? '1' : '0')).join('');

/** DFS over states with a memo of dead states; returns a winning tap order. */
function solve(L: Level): number[] | null {
  const dead = new Set<string>();
  const order: number[] = [];
  const go = (s: State): boolean => {
    if (s.remaining === 0) return true;
    const k = key(s);
    if (dead.has(k)) return false;
    for (const id of freeDucks(L, s)) {
      const n = cloneState(s);
      applyEscape(L, n, id);
      order.push(id);
      if (go(n)) return true;
      order.pop();
    }
    dead.add(k);
    return false;
  };
  return go(initialState(L)) ? order : null;
}

/** BFS over reachable states (capped): counts them and checks for dead ends and loops. */
function explore(L: Level, cap: number): { states: number; capped: boolean; deadEnds: number; loops: number } {
  const seen = new Set<string>();
  const queue: State[] = [initialState(L)];
  seen.add(key(queue[0]));
  let deadEnds = 0;
  let loops = 0;
  for (let qi = 0; qi < queue.length; qi++) {
    const s = queue[qi];
    let any = false;
    for (let i = 0; i < L.ducks.length; i++) {
      const m = resolve(L, s, i);
      if (m.kind === 'bump' && m.blocker <= -2) loops++;
      if (m.kind !== 'escape') continue;
      any = true;
      if (seen.size >= cap) continue;
      const n = cloneState(s);
      applyEscape(L, n, i);
      const k = key(n);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push(n);
      }
    }
    if (!any && s.remaining > 0) deadEnds++;
    queue[qi] = undefined as unknown as State; // let it go
  }
  return { states: seen.size, capped: seen.size >= cap, deadEnds, loops };
}

/** Greedy "waves": each round sends every free duck. Waves = length of the longest dependency chain. */
function waves(L: Level): { waves: number; trapTaps: number; freeTaps: number } {
  let s = initialState(L);
  let w = 0;
  let trapTaps = 0;
  let freeTaps = 0;
  while (s.remaining > 0) {
    const f = freeDucks(L, s);
    assert.ok(f.length > 0, `${L.name}: stuck after ${w} waves`);
    trapTaps += trapDucks(L, s).length;
    freeTaps += f.length;
    s = cloneState(s);
    for (const id of f) applyEscape(L, s, id);
    w++;
  }
  return { waves: w, trapTaps, freeTaps };
}

const pad = (v: unknown, n: number) => String(v).padEnd(n);
console.log(
  [
    pad('#', 3),
    pad('level', 16),
    pad('size', 6),
    pad('ducks', 6),
    pad('fam', 4),
    pad('zz', 3),
    pad('pads', 5),
    pad('rock', 5),
    pad('free', 5),
    pad('trap', 5),
    pad('waves', 6),
    pad('trap%', 6),
    pad('states', 9),
    'solution',
  ].join(''),
);

let failures = 0;
LEVELS.forEach((data, i) => {
  const L = parseLevel(data);
  for (const d of L.ducks) for (const c of d.cells) assert.equal(L.turner[c], 0, `${L.name}: duck on a pad`);
  const s0 = initialState(L);
  const free0 = freeDucks(L, s0).length;
  const trap0 = trapDucks(L, s0).length;
  const sol = solve(L);
  if (!sol) {
    failures++;
    console.log(`${i + 1} ${L.name}: UNSOLVABLE`);
    return;
  }
  // Replay the solution through the same rules the game uses.
  const s = initialState(L);
  for (const id of sol) {
    assert.equal(resolve(L, s, id).kind, 'escape', `${L.name}: replay`);
    applyEscape(L, s, id);
  }
  assert.equal(s.remaining, 0);
  const ex = explore(L, 60000);
  assert.equal(ex.deadEnds, 0, `${L.name}: dead end reachable`);
  assert.equal(ex.loops, 0, `${L.name}: a family can bump itself or loop`);
  const w = waves(L);
  if (i === 0) {
    assert.ok(L.forgiving, 'level 1 must be forgiving');
    assert.ok(L.tapHand, 'level 1 needs the tutorial hand');
    const [hx, hy] = L.tapHand!;
    assert.ok(freeDucks(L, s0).includes(at(L, hx, hy)), 'tutorial hand must point at a free duck');
  } else assert.ok(!L.forgiving, `${L.name}: only level 1 is forgiving`);
  const fam = L.ducks.filter((d) => d.mother).length;
  const kids = L.ducks.reduce((n, d) => n + d.cells.length - 1, 0);
  console.log(
    [
      pad(i + 1, 3),
      pad(L.name, 16),
      pad(`${L.cols}x${L.rows}`, 6),
      pad(L.ducks.length + kids, 6),
      pad(fam ? `${fam}` : '-', 4),
      pad(L.ducks.filter((d) => d.asleep).length || '-', 3),
      pad(L.turner.filter((t) => t !== 0).length || '-', 5),
      pad(L.rock.filter(Boolean).length || '-', 5),
      pad(free0, 5),
      pad(trap0, 5),
      pad(w.waves, 6),
      pad(Math.round((100 * w.trapTaps) / (w.trapTaps + w.freeTaps)) + '%', 6),
      pad(ex.capped ? `>${ex.states}` : ex.states, 9),
      `${sol.length} taps`,
    ].join(''),
  );
});
console.log(
  '\nducks = birds incl. ducklings · fam = mother ducks · zz = sleepers · free/trap = taps that escape/bump at the start\n' +
    'waves = rounds when every free duck goes at once (longest dependency chain) · trap% = share of awake ducks that\n' +
    'would bump, averaged over those rounds · states = reachable board states (all checked: no dead ends, no loops)',
);
if (failures) {
  console.error(`\n${failures} level(s) unsolvable`);
  throw new Error('unsolvable levels');
}
console.log(`\nAll ${LEVELS.length} levels solvable. Rule checks passed.`);
