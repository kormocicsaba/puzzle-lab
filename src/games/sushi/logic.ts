/**
 * Sushi Loop rules. Pure and deterministic (no Pixi, no randomness), so the renderer
 * and the solver in logic.test.ts run exactly the same simulation.
 *
 * Model: the belt is a loop of SLOTS plate slots. Time advances in ticks; each tick the
 * belt moves one slot forward. Stations sit at fixed path positions (in slot units):
 * five stools on the top straight, the takeaway spot and the kitchen hatch on the
 * bottom straight. On every tick each station looks at the slot currently in front of it.
 *
 * Tick order: belt advances → seated diners grab → win check → kitchen places a plate
 * (or jams if the belt is full while a plate is ready).
 * Seating happens between ticks (the player's taps).
 */

export const SLOTS = 16;
export const MAX_STOOLS = 5;
/** Path positions (slot units, clockwise from the top-left end of the top straight). */
export const STOOL_POS: readonly number[] = [0, 1, 2, 3, 4];
export const BOX_POS = 9;
export const HATCH_POS = 10;
/** Belt is "nearly full" at this many plates (≥ 85 %). */
export const WARN_AT = Math.ceil(SLOTS * 0.85);

export type Dish = 'S' | 'T' | 'M' | 'O' | 'E';
export type Plate = Dish | 'G';
export const DISHES: readonly Dish[] = ['S', 'T', 'M', 'O', 'E'];

export interface OrderItem {
  dish: Dish;
  n: number;
}

export type DinerKind = 'normal' | 'vip' | 'box';

export interface DinerSpec {
  id: number;
  kind: DinerKind;
  order: OrderItem[];
  /** Cosmetic look index. */
  look: number;
}

export interface LevelSpec {
  name: string;
  /** Open stools (1..5); the rest show a "Reserved" sign. */
  stools: number;
  /** How many diners at the front of the queue may be picked. */
  choose: number;
  /** Ticks between two plates leaving the kitchen. */
  cook: number;
  kitchen: Plate[];
  diners: DinerSpec[];
  /** [max peak plates for 3 stars, max peak plates for 2 stars]. */
  stars: [number, number];
  /** Seconds for one full lap (cosmetic speed only). */
  lap: number;
  hint?: string;
  tutorial?: boolean;
}

export interface Seated {
  spec: DinerSpec;
  left: OrderItem[];
  eaten: number;
}

export type Status = 'play' | 'won' | 'lost';

export interface State {
  level: LevelSpec;
  tick: number;
  started: boolean;
  /** Indexed by slot id; slot id k sits at path position (k + tick) mod SLOTS. */
  slots: (Plate | null)[];
  /** Plates still to come, front first. */
  kitchen: Plate[];
  cookTimer: number;
  stools: (Seated | null)[];
  box: Seated | null;
  queue: DinerSpec[];
  served: number;
  onBelt: number;
  peak: number;
  status: Status;
}

export type Ev =
  | { t: 'grab'; where: 'stool' | 'box'; idx: number; slot: number; plate: Plate; dish: Dish; done: boolean; seated: Seated }
  | { t: 'place'; slot: number; plate: Plate }
  | { t: 'cancel'; dish: Dish; index: number }
  | { t: 'jam' }
  | { t: 'win' };

export function newState(level: LevelSpec): State {
  return {
    level,
    tick: 0,
    started: false,
    slots: new Array<Plate | null>(SLOTS).fill(null),
    kitchen: level.kitchen.slice(),
    cookTimer: 1,
    stools: new Array<Seated | null>(MAX_STOOLS).fill(null),
    box: null,
    queue: level.diners.slice(),
    served: 0,
    onBelt: 0,
    peak: 0,
    status: 'play',
  };
}

export function cloneState(s: State): State {
  const cs = (d: Seated | null): Seated | null => (d ? { spec: d.spec, left: d.left.map((o) => ({ dish: o.dish, n: o.n })), eaten: d.eaten } : null);
  return {
    level: s.level,
    tick: s.tick,
    started: s.started,
    slots: s.slots.slice(),
    kitchen: s.kitchen.slice(),
    cookTimer: s.cookTimer,
    stools: s.stools.map(cs),
    box: cs(s.box),
    queue: s.queue.slice(),
    served: s.served,
    onBelt: s.onBelt,
    peak: s.peak,
    status: s.status,
  };
}

/** Slot id currently at a path position. */
export function slotAt(s: State, pos: number): number {
  return (((pos - s.tick) % SLOTS) + SLOTS) % SLOTS;
}

/** Path position (0..SLOTS) of a slot id at a fractional phase (tick + fraction). */
export function slotPos(slot: number, phase: number): number {
  return (((slot + phase) % SLOTS) + SLOTS) % SLOTS;
}

export function remaining(d: Seated): number {
  let n = 0;
  for (const o of d.left) n += o.n;
  return n;
}

export function wants(d: Seated, p: Plate): boolean {
  if (p === 'G') return remaining(d) > 0;
  for (const o of d.left) if (o.dish === p && o.n > 0) return true;
  return false;
}

/** Does this diner (seated or not) have any use for this plate? */
export function specWants(spec: DinerSpec, p: Plate): boolean {
  return p === 'G' || spec.order.some((o) => o.dish === p);
}

export function totalDiners(level: LevelSpec): number {
  return level.diners.length;
}

export type SeatCheck = 'ok' | 'hidden' | 'noStool' | 'noBox' | 'over';

export function canSeat(s: State, qi: number): SeatCheck {
  if (s.status !== 'play') return 'over';
  if (qi < 0 || qi >= s.queue.length || qi >= s.level.choose) return 'hidden';
  const d = s.queue[qi];
  if (d.kind === 'box') return s.box ? 'noBox' : 'ok';
  return freeStool(s) < 0 ? 'noStool' : 'ok';
}

export function freeStool(s: State): number {
  for (let i = 0; i < s.level.stools; i++) if (!s.stools[i]) return i;
  return -1;
}

/** Seat the queue diner at index qi (0 = front). Returns where they went, or null. */
export function seat(s: State, qi: number): { where: 'stool' | 'box'; idx: number; seated: Seated } | null {
  if (canSeat(s, qi) !== 'ok') return null;
  const spec = s.queue[qi];
  s.queue.splice(qi, 1);
  const seated: Seated = { spec, left: spec.order.map((o) => ({ dish: o.dish, n: o.n })), eaten: 0 };
  s.started = true;
  if (spec.kind === 'box') {
    s.box = seated;
    return { where: 'box', idx: 0, seated };
  }
  const i = freeStool(s);
  s.stools[i] = seated;
  return { where: 'stool', idx: i, seated };
}

function take(d: Seated, p: Plate): Dish {
  let item: OrderItem | null = null;
  if (p === 'G') {
    for (const o of d.left) if (o.n > 0 && (!item || o.n > item.n)) item = o;
  } else {
    for (const o of d.left) if (o.dish === p && o.n > 0) { item = o; break; }
  }
  item!.n--;
  d.eaten++;
  return item!.dish;
}

/** Advance one tick. Appends what happened to `out`. */
export function step(s: State, out: Ev[]): void {
  if (s.status !== 'play') return;
  s.tick++;
  if (!s.started) return;

  // Grabs.
  for (let i = 0; i < MAX_STOOLS; i++) {
    const d = s.stools[i];
    if (d) grab(s, d, 'stool', i, STOOL_POS[i], out);
  }
  if (s.box) grab(s, s.box, 'box', 0, BOX_POS, out);

  if (s.served === s.level.diners.length) {
    s.status = 'won';
    out.push({ t: 'win' });
    return;
  }

  // Kitchen.
  if (s.kitchen.length > 0) {
    if (s.cookTimer > 0) s.cookTimer--;
    if (s.cookTimer <= 0) {
      const hs = slotAt(s, HATCH_POS);
      if (s.slots[hs] === null) {
        const p = s.kitchen.shift()!;
        s.slots[hs] = p;
        s.onBelt++;
        if (s.onBelt > s.peak) s.peak = s.onBelt;
        s.cookTimer = s.level.cook;
        out.push({ t: 'place', slot: hs, plate: p });
      } else if (s.onBelt >= SLOTS) {
        s.status = 'lost';
        out.push({ t: 'jam' });
      }
    }
  }
}

function grab(s: State, d: Seated, where: 'stool' | 'box', idx: number, pos: number, out: Ev[]): void {
  const slot = slotAt(s, pos);
  const p = s.slots[slot];
  if (!p || !wants(d, p)) return;
  s.slots[slot] = null;
  s.onBelt--;
  const dish = take(d, p);
  if (p === 'G') {
    // Chef's special: the kitchen skips the next plate of that dish (one less to send).
    const k = s.kitchen.indexOf(dish);
    if (k >= 0) {
      s.kitchen.splice(k, 1);
      out.push({ t: 'cancel', dish, index: k });
    }
  }
  const done = remaining(d) === 0;
  if (done) {
    s.served++;
    if (where === 'box') s.box = null;
    else s.stools[idx] = null;
  }
  out.push({ t: 'grab', where, idx, slot, plate: p, dish, done, seated: d });
}

/** Plates on the belt that no seated diner currently wants (the clog), as slot ids. */
export function unwantedSlots(s: State): number[] {
  const res: number[] = [];
  for (let k = 0; k < SLOTS; k++) {
    const p = s.slots[k];
    if (!p) continue;
    let ok = false;
    for (const d of s.stools) if (d && wants(d, p)) ok = true;
    if (s.box && wants(s.box, p)) ok = true;
    if (!ok) res.push(k);
  }
  return res;
}

/** Stars from the busiest the belt got. */
export function starsFor(level: LevelSpec, peak: number): number {
  if (peak <= level.stars[0]) return 3;
  if (peak <= level.stars[1]) return 2;
  return 1;
}
