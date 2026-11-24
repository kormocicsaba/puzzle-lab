/**
 * Sushi Loop rules + level checks. Run: node src/games/sushi/logic.test.ts
 * - unit checks of the belt, grabs, seating, takeaway, golden plates and the jam
 * - every level: supply matches demand, a solver wins it, three stars are reachable,
 *   level 1 cannot be lost, pressure levels beat the naive "seat the front diner" habit,
 *   and a per-level summary is printed.
 */
// A tiny assert, so the file typechecks with the app's DOM-only tsconfig (no @types/node).
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const assert = {
  ok(v: unknown, msg = 'assertion failed'): void {
    if (!v) throw new Error(msg);
  },
  equal(a: unknown, b: unknown): void {
    if (a !== b) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  },
  deepEqual(a: unknown, b: unknown): void {
    if (!same(a, b)) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  },
};
import {
  BOX_POS,
  HATCH_POS,
  SLOTS,
  canSeat,
  newState,
  seat,
  slotAt,
  starsFor,
  step,
  unwantedSlots,
  type DinerSpec,
  type Dish,
  type Ev,
  type LevelSpec,
  type Plate,
} from './logic.ts';
import { LEVELS } from './levels.ts';
import { minPeak, naive, randomPlayer, run, smart, solve } from './solver.ts';

// ---------------------------------------------------------------- rule checks

function lv(diners: [Dish, number][][], kitchen: string, extra: Partial<LevelSpec> = {}): LevelSpec {
  const specs: DinerSpec[] = diners.map((order, id) => ({
    id,
    kind: order.length > 1 ? 'vip' : 'normal',
    order: order.map(([dish, n]) => ({ dish, n })),
    look: 0,
  }));
  return { name: 't', stools: 5, choose: 3, cook: 1, lap: 9, kitchen: kitchen.split('') as Plate[], diners: specs, stars: [16, 16], ...extra };
}

{
  // Nothing moves before the first diner sits down; the kitchen starts on the first seat.
  const s = newState(lv([[['S', 1]]], 'S'));
  const ev: Ev[] = [];
  step(s, ev);
  assert.equal(s.onBelt, 0);
  assert.equal(ev.length, 0);
  assert.ok(seat(s, 0));
  step(s, ev);
  assert.deepEqual(ev.map((e) => e.t), ['place']);
  assert.equal(s.slots[slotAt(s, HATCH_POS)], 'S');
}

{
  // A plate placed at the hatch rides round and is grabbed by the diner on stool 0.
  const s = newState(lv([[['S', 1]]], 'S'));
  const ev: Ev[] = [];
  seat(s, 0);
  let grabbedAt = -1;
  for (let i = 0; i < 40 && s.status === 'play'; i++) {
    step(s, ev);
    for (const e of ev) if (e.t === 'grab') grabbedAt = s.tick;
    ev.length = 0;
  }
  assert.equal(s.status, 'won');
  // Placed at tick 1 at position 10; stool 0 is 6 slots further on.
  assert.equal(grabbedAt, 1 + (SLOTS - HATCH_POS));
}

{
  // Seating fills the leftmost free stool; only the first `choose` diners are tappable.
  const s = newState(lv([[['S', 1]], [['T', 1]], [['M', 1]], [['O', 1]]], 'STMO', { stools: 2, choose: 3 }));
  assert.equal(canSeat(s, 3), 'hidden');
  assert.equal(seat(s, 1)!.idx, 0);
  assert.equal(seat(s, 0)!.idx, 1);
  assert.equal(canSeat(s, 0), 'noStool');
}

{
  // Takeaway boxes use the window, not a stool, and fill at BOX_POS.
  const L = lv([[['S', 1]]], 'TS', { stools: 1 });
  L.diners.push({ id: 1, kind: 'box', order: [{ dish: 'T', n: 1 }], look: 0 });
  const s = newState(L);
  assert.equal(seat(s, 1)!.where, 'box');
  assert.equal(canSeat(s, 0), 'ok');
  seat(s, 0);
  const ev: Ev[] = [];
  let boxGrab = -1;
  for (let i = 0; i < 60 && s.status === 'play'; i++) {
    step(s, ev);
    for (const e of ev) if (e.t === 'grab' && e.where === 'box') boxGrab = s.tick;
    ev.length = 0;
  }
  assert.equal(s.status, 'won');
  // T placed at tick 1 at position 10 needs a full lap minus one slot to reach BOX_POS.
  assert.equal(boxGrab, 1 + ((BOX_POS - HATCH_POS + SLOTS) % SLOTS));
}

{
  // Golden plate: any diner takes it, and the kitchen drops one plate of that dish.
  const s = newState(lv([[['S', 2]]], 'GSS', { cook: 4 }));
  seat(s, 0);
  const ev: Ev[] = [];
  const kinds: string[] = [];
  for (let i = 0; i < 60 && s.status === 'play'; i++) {
    step(s, ev);
    for (const e of ev) kinds.push(e.t);
    ev.length = 0;
  }
  assert.equal(s.status, 'won');
  assert.ok(kinds.includes('cancel'));
}

{
  // A belt full of plates nobody wants jams the kitchen, and the clog is reported.
  const kitchen = 'T'.repeat(SLOTS) + 'TS';
  const L = lv([[['S', 1]], [['T', SLOTS + 1]]], kitchen);
  const s = newState(L);
  seat(s, 0);
  const ev: Ev[] = [];
  let jam = false;
  for (let i = 0; i < 200 && s.status === 'play'; i++) {
    step(s, ev);
    if (ev.some((e) => e.t === 'jam')) jam = true;
    ev.length = 0;
  }
  assert.ok(jam);
  assert.equal(s.status, 'lost');
  assert.equal(s.onBelt, SLOTS);
  assert.equal(unwantedSlots(s).length, SLOTS);
}

{
  // Stars by peak.
  const L = lv([[['S', 1]]], 'S', { stars: [5, 8] });
  assert.equal(starsFor(L, 5), 3);
  assert.equal(starsFor(L, 6), 2);
  assert.equal(starsFor(L, 9), 1);
}

// ---------------------------------------------------------------- level checks

const pad = (v: unknown, n: number) => String(v).padEnd(n);
const RANDOM_RUNS = 40;
let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) {
    failures++;
    console.log('  FAIL: ' + msg);
  }
};

console.log(
  pad('#', 3) + pad('level', 24) + pad('st', 3) + pad('plates', 7) + pad('solved', 14) + pad('minPeak', 8) + pad('margin', 7) +
    pad('stars', 7) + pad('smart', 14) + pad('naive', 16) + pad('random', 8) + 'twist',
);

LEVELS.forEach((L, i) => {
  const n = i + 1;
  // Supply: non-golden plates match the orders exactly, dish by dish.
  const need = new Map<Plate, number>();
  for (const d of L.diners) for (const o of d.order) need.set(o.dish, (need.get(o.dish) ?? 0) + o.n);
  for (const p of L.kitchen) if (p !== 'G') need.set(p, (need.get(p) ?? 0) - 1);
  const off = [...need].filter(([, v]) => v !== 0);
  check(off.length === 0, `L${n} supply mismatch ${JSON.stringify(off)}`);
  check(L.stools >= 1 && L.stools <= 5, `L${n} stools`);

  const dfs = solve(L);
  check(dfs.win, `L${n} DFS found no winning line`);
  const mp = minPeak(L);
  check(mp > 0 && mp <= L.stars[0], `L${n} 3 stars unreachable (minPeak ${mp} > ${L.stars[0]})`);
  check(L.stars[0] <= L.stars[1], `L${n} star thresholds out of order`);

  const sm = run(L, smart(3));
  const nv = run(L, naive);
  let lost = 0;
  for (let k = 0; k < RANDOM_RUNS; k++) if (run(L, randomPlayer(1000 + k * 7)).status === 'lost') lost++;

  if (i === 0) {
    // The tutorial can't be lost: fewer plates than slots, so the belt can never fill.
    check(L.kitchen.length < SLOTS, 'L1 must have fewer plates than belt slots');
    check(lost === 0 && nv.status === 'won', 'L1 lost by someone');
    check(!!L.tutorial, 'L1 is the tutorial');
  }
  if (L.pressure) check(nv.status === 'lost', `L${n} is a pressure level but naive won`);
  check(sm.status !== 'stuck' && nv.status !== 'stuck', `L${n} a policy got stuck`);

  const twist = [
    L.tutorial ? 'tutorial' : '',
    L.diners.some((d) => d.order.some((o) => o.n >= 4)) ? 'big orders' : '',
    L.diners.some((d) => d.kind === 'vip') ? 'VIP' : '',
    L.diners.some((d) => d.kind === 'box') ? 'takeaway' : '',
    L.kitchen.includes('G') ? 'golden' : '',
    L.pressure ? 'PRESSURE' : '',
  ]
    .filter(Boolean)
    .join(', ');
  console.log(
    pad(n, 3) +
      pad(L.name, 24) +
      pad(L.stools, 3) +
      pad(L.kitchen.length, 7) +
      pad(dfs.win ? `yes pk${dfs.peak}` : 'NO', 14) +
      pad(mp, 8) +
      pad(SLOTS - mp, 7) +
      pad(L.stars.join('/'), 7) +
      pad(`${sm.status} pk${sm.peak}`, 14) +
      pad(nv.status === 'lost' ? `lost t${nv.ticks}` : `${nv.status} pk${nv.peak}`, 16) +
      pad(`${lost}/${RANDOM_RUNS}`, 8) +
      twist,
  );
});

console.log('\nminPeak = calmest winning line (fewest plates on the belt at once); margin = 16 - minPeak.');
console.log('random = losses of a player tapping random visible diners.');
if (failures) {
  console.log(`\n${failures} check(s) failed`);
  throw new Error(`${failures} sushi check(s) failed`);
} else console.log('\nall sushi checks passed');
