/**
 * Moving Day: pure rules. No Pixi here, so Node can run the solver in logic.test.ts.
 *
 * The box is a grid seen from the front: x grows to the right, y grows DOWN the screen,
 * row `rows - 1` stands on the box floor. Gravity points down, so "above" means a smaller y.
 *
 * Rules (checked when an item is dropped, and again for the final state):
 * - every cell inside the box, no overlap;
 * - fragile: no other item anywhere above a fragile item in the same column;
 * - heavy: every bottom cell of a heavy item rests on the floor or on another heavy item.
 */

export type Cell = readonly [x: number, y: number];

export interface Piece {
  kind: string;
  /** Cells in the orientation the item starts in (rotation 0). */
  cells: Cell[];
  fragile: boolean;
  heavy: boolean;
}

export interface Puzzle {
  cols: number;
  rows: number;
  /** May the player turn items? */
  rotate: boolean;
  /** Cells allowed to stay empty (0 = the items must fill the box exactly). */
  spare: number;
  pieces: Piece[];
}

/** Top-left of the item's bounding box in grid cells, plus quarter turns clockwise. */
export interface Placement {
  x: number;
  y: number;
  r: number;
}

export type Reason = 'bounds' | 'overlap' | 'fragile' | 'heavy';

export type Check =
  | { ok: true }
  | {
      ok: false;
      reason: Reason;
      /** Other items that cause the problem (the fragile item underneath, the light item below a heavy one). */
      culprits: number[];
      /** Box cells to mark (the missing support, the cells above glass). */
      cells: Cell[];
    };

// ---------------------------------------------------------------------------------------------
// Shapes

export function parseShape(rows: readonly string[]): Cell[] {
  const out: Cell[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === '#') out.push([x, y]);
  });
  return normalize(out);
}

export function dims(cells: readonly Cell[]): { w: number; h: number } {
  let w = 0;
  let h = 0;
  for (const [x, y] of cells) {
    if (x + 1 > w) w = x + 1;
    if (y + 1 > h) h = y + 1;
  }
  return { w, h };
}

function normalize(cells: readonly Cell[]): Cell[] {
  let mx = Infinity;
  let my = Infinity;
  for (const [x, y] of cells) {
    mx = Math.min(mx, x);
    my = Math.min(my, y);
  }
  return cells
    .map(([x, y]) => [x - mx, y - my] as Cell)
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/** One quarter turn clockwise on screen (y down): the left end of a bar swings up. */
export function rotateCW(cells: readonly Cell[]): Cell[] {
  const { h } = dims(cells);
  return normalize(cells.map(([x, y]) => [h - 1 - y, x] as Cell));
}

export function orient(cells: readonly Cell[], r: number): Cell[] {
  let c = normalize(cells);
  for (let i = 0; i < ((r % 4) + 4) % 4; i++) c = rotateCW(c);
  return c;
}

export function shapeKey(cells: readonly Cell[]): string {
  return cells.map(([x, y]) => `${x},${y}`).join(';');
}

/** Distinct orientations of a shape, each with the smallest r that produces it. */
export function orientations(cells: readonly Cell[]): { r: number; cells: Cell[] }[] {
  const seen = new Set<string>();
  const out: { r: number; cells: Cell[] }[] = [];
  for (let r = 0; r < 4; r++) {
    const c = orient(cells, r);
    const k = shapeKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ r, cells: c });
  }
  return out;
}

export function cellsAt(piece: Piece, p: Placement): Cell[] {
  return orient(piece.cells, p.r).map(([x, y]) => [x + p.x, y + p.y] as Cell);
}

// ---------------------------------------------------------------------------------------------
// Board

/** Grid of item indexes (-1 = empty). `skip` leaves one item out (the one being dragged). */
export function buildGrid(puz: Puzzle, placements: readonly (Placement | null)[], skip = -1): Int16Array {
  const g = new Int16Array(puz.cols * puz.rows).fill(-1);
  placements.forEach((p, i) => {
    if (!p || i === skip) return;
    for (const [x, y] of cellsAt(puz.pieces[i], p)) {
      if (x >= 0 && y >= 0 && x < puz.cols && y < puz.rows) g[y * puz.cols + x] = i;
    }
  });
  return g;
}

/** Can item `idx` go at `p`, given everything else that is placed? */
export function canPlace(puz: Puzzle, placements: readonly (Placement | null)[], idx: number, p: Placement): Check {
  const { cols, rows, pieces } = puz;
  const piece = pieces[idx];
  const cells = cellsAt(piece, p);
  for (const [x, y] of cells) {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return { ok: false, reason: 'bounds', culprits: [], cells: [] };
  }
  const g = buildGrid(puz, placements, idx);
  const overlap = new Set<number>();
  for (const [x, y] of cells) {
    const o = g[y * cols + x];
    if (o >= 0) overlap.add(o);
  }
  if (overlap.size) return { ok: false, reason: 'overlap', culprits: [...overlap], cells: [] };

  const own = new Set(cells.map(([x, y]) => y * cols + x));

  // Fragile: nothing above glass. Either this item lands above a fragile one, or this
  // fragile item lands under something.
  const fragCulprits = new Set<number>();
  const fragCells: Cell[] = [];
  for (const [x, y] of cells) {
    for (let yy = y + 1; yy < rows; yy++) {
      const o = g[yy * cols + x];
      if (o >= 0 && pieces[o].fragile) {
        fragCulprits.add(o);
        fragCells.push([x, y]);
      }
    }
    if (piece.fragile) {
      for (let yy = y - 1; yy >= 0; yy--) {
        if (own.has(yy * cols + x)) continue;
        const o = g[yy * cols + x];
        if (o >= 0) {
          fragCulprits.add(o);
          fragCells.push([x, yy]);
        }
      }
    }
  }
  if (fragCulprits.size) return { ok: false, reason: 'fragile', culprits: [...fragCulprits], cells: fragCells };

  // Heavy: a heavy item needs the floor or heavy items under every bottom cell, and a light
  // item can't slide in under a heavy one.
  const heavyCulprits = new Set<number>();
  const heavyCells: Cell[] = [];
  for (const [x, y] of cells) {
    if (piece.heavy) {
      if (own.has((y + 1) * cols + x) || y + 1 >= rows) continue;
      const o = g[(y + 1) * cols + x];
      if (o < 0 || !pieces[o].heavy) {
        heavyCells.push([x, y + 1]);
        if (o >= 0) heavyCulprits.add(o);
      }
    } else if (y > 0) {
      const o = g[(y - 1) * cols + x];
      if (o >= 0 && pieces[o].heavy) {
        heavyCulprits.add(o);
        heavyCells.push([x, y]);
      }
    }
  }
  if (heavyCells.length) return { ok: false, reason: 'heavy', culprits: [...heavyCulprits], cells: heavyCells };
  return { ok: true };
}

export interface Violation {
  idx: number;
  reason: 'fragile' | 'heavy';
  cells: Cell[];
}

/** Rule breaks in a whole state (e.g. a heavy item left hanging after its support was taken out). */
export function violations(puz: Puzzle, placements: readonly (Placement | null)[]): Violation[] {
  const { cols, rows, pieces } = puz;
  const g = buildGrid(puz, placements);
  const out: Violation[] = [];
  placements.forEach((p, i) => {
    if (!p) return;
    const piece = pieces[i];
    const cells = cellsAt(piece, p);
    const own = new Set(cells.map(([x, y]) => y * cols + x));
    if (piece.fragile) {
      const bad: Cell[] = [];
      for (const [x, y] of cells) {
        for (let yy = y - 1; yy >= 0; yy--) {
          const k = yy * cols + x;
          if (!own.has(k) && g[k] >= 0) bad.push([x, yy]);
        }
      }
      if (bad.length) out.push({ idx: i, reason: 'fragile', cells: bad });
    }
    if (piece.heavy) {
      const bad: Cell[] = [];
      for (const [x, y] of cells) {
        if (y + 1 >= rows || own.has((y + 1) * cols + x)) continue;
        const o = g[(y + 1) * cols + x];
        if (o < 0 || !pieces[o].heavy) bad.push([x, y + 1]);
      }
      if (bad.length) out.push({ idx: i, reason: 'heavy', cells: bad });
    }
  });
  return out;
}

export function isSolved(puz: Puzzle, placements: readonly (Placement | null)[]): boolean {
  return placements.every((p) => p !== null) && violations(puz, placements).length === 0;
}

export function filledCells(puz: Puzzle, placements: readonly (Placement | null)[]): number {
  let n = 0;
  placements.forEach((p, i) => {
    if (p) n += puz.pieces[i].cells.length;
  });
  return n;
}

/**
 * An order to drop a finished arrangement in that passes canPlace at every step: lowest items
 * first (a heavy item's support always reaches lower than the item itself).
 */
export function dropOrder(puz: Puzzle, solution: readonly Placement[]): number[] {
  const bottom = solution.map((p, i) => Math.max(...cellsAt(puz.pieces[i], p).map((c) => c[1])));
  return solution.map((_, i) => i).sort((a, b) => bottom[b] - bottom[a] || a - b);
}

// ---------------------------------------------------------------------------------------------
// Solver

export interface SolveResult {
  /** Distinct arrangements found (identical items swapped count once), capped at `limit`. */
  count: number;
  first: Placement[] | null;
  /** False when the search hit the node budget, so `count` may be low. */
  complete: boolean;
  nodes: number;
}

interface Orient {
  r: number;
  /** Offsets from the anchor cell (lowest row, leftmost in that row). */
  offs: Cell[];
  /** Anchor position inside the bounding box, to convert back to a top-left placement. */
  ax: number;
  ay: number;
}

/**
 * Backtracking exact cover, scanning cells bottom-up, left to right. Every rule is checked
 * incrementally against whatever is already decided, which makes the final state valid.
 */
export function solve(
  puz: Puzzle,
  opts: { limit?: number; nodeLimit?: number; fixed?: readonly (Placement | null)[]; rotate?: boolean } = {},
): SolveResult {
  const { cols, rows, pieces } = puz;
  const rotate = opts.rotate ?? puz.rotate;
  const limit = opts.limit ?? 1;
  const nodeLimit = opts.nodeLimit ?? 5_000_000;
  const N = cols * rows;
  const EMPTY = -1;
  const SPARE = -2;
  const grid = new Int16Array(N).fill(EMPTY);
  const result: (Placement | null)[] = pieces.map(() => null);

  const orients: Orient[][] = pieces.map((p) => {
    const list = rotate ? orientations(p.cells) : [{ r: 0, cells: normalize(p.cells) }];
    return list.map(({ r, cells }) => {
      let ax = 0;
      let ay = -1;
      for (const [x, y] of cells) {
        if (y > ay || (y === ay && x < ax)) {
          ay = y;
          ax = x;
        }
      }
      return { r, offs: cells.map(([x, y]) => [x - ax, y - ay] as Cell), ax, ay };
    });
  });

  // Fixed items (the player's current placements, for the hint) go in first.
  const used = pieces.map(() => false);
  if (opts.fixed) {
    for (let i = 0; i < pieces.length; i++) {
      const p = opts.fixed[i];
      if (!p) continue;
      for (const [x, y] of cellsAt(pieces[i], p)) {
        if (x < 0 || y < 0 || x >= cols || y >= rows || grid[y * cols + x] !== EMPTY) {
          return { count: 0, first: null, complete: true, nodes: 0 };
        }
        grid[y * cols + x] = i;
      }
      result[i] = p;
      used[i] = true;
    }
  }

  // Identical items are interchangeable: group them so swaps are not counted twice.
  const groups = new Map<string, number[]>();
  pieces.forEach((p, i) => {
    if (used[i]) return;
    const key = `${p.kind}|${p.fragile}|${p.heavy}|${rotate ? '' : shapeKey(normalize(p.cells))}`;
    const g = groups.get(key);
    if (g) g.push(i);
    else groups.set(key, [i]);
  });
  const stacks = [...groups.values()];

  const order: number[] = [];
  for (let y = rows - 1; y >= 0; y--) for (let x = 0; x < cols; x++) order.push(y * cols + x);

  let remaining = pieces.length - used.filter(Boolean).length;
  // Every free cell ends up either under an item or spare.
  let free = 0;
  for (let k = 0; k < N; k++) if (grid[k] === EMPTY) free++;
  let need = 0;
  pieces.forEach((p, i) => {
    if (!used[i]) need += p.cells.length;
  });
  if (need > free || free - need > puz.spare) return { count: 0, first: null, complete: true, nodes: 0 };
  let spareLeft = free - need;

  let count = 0;
  let first: Placement[] | null = null;
  let nodes = 0;
  let aborted = false;

  const isHeavy = (o: number) => o >= 0 && pieces[o].heavy;
  const isFragile = (o: number) => o >= 0 && pieces[o].fragile;

  const fits = (i: number, o: Orient, ax: number, ay: number): boolean => {
    for (const [dx, dy] of o.offs) {
      const x = ax + dx;
      const y = ay + dy;
      if (x < 0 || y < 0 || x >= cols || y >= rows || grid[y * cols + x] !== EMPTY) return false;
    }
    const piece = pieces[i];
    for (const [dx, dy] of o.offs) {
      const x = ax + dx;
      const y = ay + dy;
      // Something fragile below in this column?
      for (let yy = y + 1; yy < rows; yy++) if (isFragile(grid[yy * cols + x])) return false;
      if (piece.fragile) {
        for (let yy = y - 1; yy >= 0; yy--) {
          const g = grid[yy * cols + x];
          if (g >= 0) return false;
        }
      }
      if (piece.heavy) {
        if (y + 1 < rows) {
          const below = grid[(y + 1) * cols + x];
          const ownBelow = o.offs.some(([ox, oy]) => ax + ox === x && ay + oy === y + 1);
          if (!ownBelow && (below === SPARE || (below >= 0 && !pieces[below].heavy))) return false;
        }
      } else if (y > 0 && isHeavy(grid[(y - 1) * cols + x])) return false;
    }
    return true;
  };

  const search = (pos: number): void => {
    if (aborted) return;
    if (++nodes > nodeLimit) {
      aborted = true;
      return;
    }
    while (pos < N && grid[order[pos]] !== EMPTY) pos++;
    if (remaining === 0) {
      // Everything placed: the rest must be spare (counts were checked up front).
      const final = result as Placement[];
      if (violations(puz, final).length === 0) {
        count++;
        if (!first) first = final.map((p) => ({ ...p }));
        if (count >= limit) aborted = true;
      }
      return;
    }
    if (pos >= N) return;
    const cell = order[pos];
    const cx = cell % cols;
    const cy = (cell / cols) | 0;
    for (const stack of stacks) {
      if (!stack.length) continue;
      const i = stack.pop()!;
      for (const o of orients[i]) {
        if (!fits(i, o, cx, cy)) continue;
        for (const [dx, dy] of o.offs) grid[(cy + dy) * cols + cx + dx] = i;
        result[i] = { x: cx - o.ax, y: cy - o.ay, r: o.r };
        remaining--;
        search(pos + 1);
        remaining++;
        result[i] = null;
        for (const [dx, dy] of o.offs) grid[(cy + dy) * cols + cx + dx] = EMPTY;
        if (aborted) break;
      }
      stack.push(i);
      if (aborted) return;
    }
    // Or leave this cell empty, if the level has spare room and nothing heavy sits on it.
    if (spareLeft > 0 && !(cy > 0 && isHeavy(grid[(cy - 1) * cols + cx]))) {
      grid[cell] = SPARE;
      spareLeft--;
      search(pos + 1);
      spareLeft++;
      grid[cell] = EMPTY;
    }
  };

  search(0);
  return { count, first, complete: !aborted || count >= limit, nodes };
}
