/**
 * Duckling Dash rules. Pure TypeScript, no Pixi: the game view and the solver test
 * both use this file, so what the test proves is what the player plays.
 *
 * Board: a cols×rows grid of cells, indexed `y * cols + x`.
 * - Ducks sit in one cell and face a direction. Tapped, a duck swims straight ahead
 *   until it leaves the pond (escape) or meets a rock or another duck (bump).
 * - A mother duck leads a chain of ducklings in the cells behind her. The family
 *   moves like a snake: the ducklings follow her exact path, freeing cells as they go.
 * - A lily pad turner rotates a duck that swims onto it by 90° (cw or ccw).
 * - A sleeping duck blocks like any duck but can't be tapped; it wakes up as soon as a
 *   duck in an orthogonally neighbouring cell swims away.
 *
 * Removing a duck only ever frees cells and wakes ducks, so the game is monotone: a
 * duck that can escape keeps being able to. A level is solvable iff repeatedly sending
 * any free duck clears it, and there are no dead ends; only bumps (hearts) are at stake.
 */

/** 0 up, 1 right, 2 down, 3 left (clockwise). */
export type Dir = 0 | 1 | 2 | 3;
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;

export function turn(d: Dir, by: 1 | -1): Dir {
  return ((d + by + 4) % 4) as Dir;
}

export interface DuckDef {
  id: number;
  /** Cells of the family, head (the duck you tap) first. A single duck has one cell. */
  cells: number[];
  dir: Dir;
  mother: boolean;
  asleep: boolean;
}

export interface LevelData {
  name: string;
  /** One-line hint shown at the start of the level (introduces a new idea). */
  hint?: string;
  /** Bumps don't cost hearts (the tutorial). */
  forgiving?: boolean;
  /** Cell [x, y] of the duck the tutorial hand points at. */
  tapHand?: [number, number];
  /**
   * Rows of 2-character tokens separated by single spaces:
   *  `..` water · `##` rock · `+R` / `+L` lily pad turning cw / ccw
   *  `^.` `>.` `v.` `<.` duck facing up/right/down/left · `^z` (etc.) a sleeping duck
   *  `A^` mother A facing up · `a1` `a2` … her ducklings, 1 right behind her
   */
  map: string[];
}

export interface Level {
  name: string;
  hint?: string;
  forgiving: boolean;
  tapHand?: [number, number];
  cols: number;
  rows: number;
  rock: boolean[];
  /** Per cell: 0 none, 1 turns clockwise, -1 counter-clockwise. */
  turner: number[];
  ducks: DuckDef[];
}

const DIR_CHAR: Record<string, Dir> = { '^': 0, '>': 1, v: 2, '<': 3 };

export function parseLevel(d: LevelData): Level {
  const rows = d.map.length;
  const grid = d.map.map((r) => r.trim().split(/\s+/));
  const cols = grid[0].length;
  for (const r of grid) if (r.length !== cols) throw new Error(`${d.name}: ragged row "${r.join(' ')}"`);
  const n = cols * rows;
  const rock = new Array<boolean>(n).fill(false);
  const turner = new Array<number>(n).fill(0);
  const ducks: DuckDef[] = [];
  const mothers = new Map<string, DuckDef>();
  const kids = new Map<string, { order: number; cell: number }[]>();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const t = grid[y][x];
      const c = y * cols + x;
      if (t.length !== 2) throw new Error(`${d.name}: bad token "${t}"`);
      const a = t[0];
      const b = t[1];
      if (t === '..') continue;
      if (t === '##') rock[c] = true;
      else if (a === '+' && (b === 'R' || b === 'L')) turner[c] = b === 'R' ? 1 : -1;
      else if (a in DIR_CHAR && (b === '.' || b === 'z')) {
        ducks.push({ id: ducks.length, cells: [c], dir: DIR_CHAR[a], mother: false, asleep: b === 'z' });
      } else if (a >= 'A' && a <= 'Z' && b in DIR_CHAR) {
        const m: DuckDef = { id: ducks.length, cells: [c], dir: DIR_CHAR[b], mother: true, asleep: false };
        ducks.push(m);
        mothers.set(a.toLowerCase(), m);
      } else if (a >= 'a' && a <= 'z' && b >= '1' && b <= '9') {
        const list = kids.get(a) ?? [];
        list.push({ order: Number(b), cell: c });
        kids.set(a, list);
      } else throw new Error(`${d.name}: unknown token "${t}"`);
    }
  }
  for (const [k, list] of kids) {
    const m = mothers.get(k);
    if (!m) throw new Error(`${d.name}: ducklings "${k}" without a mother`);
    list.sort((p, q) => p.order - q.order);
    list.forEach((l, i) => {
      if (l.order !== i + 1) throw new Error(`${d.name}: duckling ${k}${i + 1} missing`);
      m.cells.push(l.cell);
    });
  }
  for (const m of ducks) {
    for (let i = 1; i < m.cells.length; i++) {
      const p = m.cells[i - 1];
      const q = m.cells[i];
      const dx = Math.abs((p % cols) - (q % cols));
      const dy = Math.abs(Math.floor(p / cols) - Math.floor(q / cols));
      if (dx + dy !== 1) throw new Error(`${d.name}: family of duck ${m.id} is not connected`);
    }
  }
  return { name: d.name, hint: d.hint, forgiving: !!d.forgiving, tapHand: d.tapHand, cols, rows, rock, turner, ducks };
}

export interface State {
  present: boolean[];
  asleep: boolean[];
  /** cell → duck id, or -1. */
  occ: number[];
  remaining: number;
}

export function initialState(level: Level): State {
  const occ = new Array<number>(level.cols * level.rows).fill(-1);
  for (const d of level.ducks) for (const c of d.cells) occ[c] = d.id;
  return {
    present: level.ducks.map(() => true),
    asleep: level.ducks.map((d) => d.asleep),
    occ,
    remaining: level.ducks.length,
  };
}

export function cloneState(s: State): State {
  return { present: s.present.slice(), asleep: s.asleep.slice(), occ: s.occ.slice(), remaining: s.remaining };
}

export type MoveKind = 'escape' | 'bump' | 'asleep' | 'gone';

export interface Move {
  kind: MoveKind;
  duck: number;
  /** Cells the head swims into, in order (not including where it starts). */
  path: number[];
  /** Direction the head is facing after the last cell of `path` (for an escape: the way out). */
  endDir: Dir;
  /** For a bump: the cell it hits, and what is there. */
  blockCell: number;
  /** Duck id that blocks, or -1 for a rock, -2 for the family's own ducklings, -3 for a loop. */
  blocker: number;
}

/** What happens if `duck` is tapped now. Pure: doesn't change the state. */
export function resolve(level: Level, s: State, duck: number): Move {
  const def = level.ducks[duck];
  const out: Move = { kind: 'escape', duck, path: [], endDir: def.dir, blockCell: -1, blocker: -1 };
  if (!s.present[duck]) {
    out.kind = 'gone';
    return out;
  }
  if (s.asleep[duck]) {
    out.kind = 'asleep';
    return out;
  }
  const { cols, rows } = level;
  const L = def.cells.length;
  // Trail of the family: tail … head, then every cell the head enters.
  const trail: number[] = [];
  for (let i = L - 1; i >= 0; i--) trail.push(def.cells[i]);
  let cell = def.cells[0];
  let dir = def.dir;
  const seen = new Set<number>();
  for (;;) {
    const key = cell * 4 + dir;
    if (seen.has(key)) {
      out.kind = 'bump';
      out.blocker = -3;
      out.blockCell = cell;
      out.endDir = dir;
      return out;
    }
    seen.add(key);
    const x = (cell % cols) + DX[dir];
    const y = Math.floor(cell / cols) + DY[dir];
    if (x < 0 || y < 0 || x >= cols || y >= rows) {
      out.endDir = dir;
      return out;
    }
    const next = y * cols + x;
    const k = out.path.length; // head has moved k cells so far
    let blocker = -99;
    if (level.rock[next]) blocker = -1;
    else {
      const o = s.occ[next];
      if (o >= 0 && o !== duck) blocker = o;
      else {
        // Own ducklings: after this step the body sits on trail[k+1 .. k+L-1].
        for (let j = k + 1; j <= k + L - 1; j++) if (trail[j] === next) blocker = -2;
      }
    }
    if (blocker !== -99) {
      out.kind = 'bump';
      out.blocker = blocker;
      out.blockCell = next;
      out.endDir = dir;
      return out;
    }
    out.path.push(next);
    trail.push(next);
    cell = next;
    if (level.turner[next] !== 0) dir = turn(dir, level.turner[next] as 1 | -1);
  }
}

/**
 * Apply an escape to the state (mutates it). Returns the ids of sleeping ducks it woke:
 * any sleeper orthogonally next to a cell the family left.
 */
export function applyEscape(level: Level, s: State, duck: number): number[] {
  const def = level.ducks[duck];
  s.present[duck] = false;
  s.remaining--;
  for (const c of def.cells) s.occ[c] = -1;
  const woke: number[] = [];
  const { cols, rows } = level;
  for (const c of def.cells) {
    const cx = c % cols;
    const cy = Math.floor(c / cols);
    for (let d = 0; d < 4; d++) {
      const x = cx + DX[d];
      const y = cy + DY[d];
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      const o = s.occ[y * cols + x];
      if (o >= 0 && s.asleep[o] && !woke.includes(o)) {
        s.asleep[o] = false;
        woke.push(o);
      }
    }
  }
  return woke;
}

/** Ducks that would escape if tapped now. */
export function freeDucks(level: Level, s: State): number[] {
  const out: number[] = [];
  for (let i = 0; i < level.ducks.length; i++) {
    if (s.present[i] && !s.asleep[i] && resolve(level, s, i).kind === 'escape') out.push(i);
  }
  return out;
}

/** Awake ducks that would bump if tapped now (the tempting wrong taps). */
export function trapDucks(level: Level, s: State): number[] {
  const out: number[] = [];
  for (let i = 0; i < level.ducks.length; i++) {
    if (s.present[i] && !s.asleep[i] && resolve(level, s, i).kind === 'bump') out.push(i);
  }
  return out;
}

export function starsFor(bumps: number): number {
  return bumps === 0 ? 3 : bumps === 1 ? 2 : 1;
}

export const HEARTS = 3;
