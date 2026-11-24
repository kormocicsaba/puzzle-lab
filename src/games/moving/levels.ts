/**
 * Moving Day: item kinds and the handcrafted rooms. Pure data (no Pixi), shared by the game
 * and by logic.test.ts, which solves every room and checks the stored solutions.
 */
import { orient, parseShape, type Piece, type Placement, type Puzzle } from './logic.ts';

export interface KindDef {
  /** Rows of '#' (cell) and '.' (gap), top to bottom, in the item's natural orientation. */
  shape: string[];
  label: string;
  fragile?: boolean;
  heavy?: boolean;
}

export const KINDS = {
  // 1×1
  mug: { shape: ['#'], label: 'Mug' },
  jar: { shape: ['#'], label: 'Honey jar' },
  clock: { shape: ['#'], label: 'Alarm clock' },
  duck: { shape: ['#'], label: 'Rubber duck' },
  ball: { shape: ['#'], label: 'Ball' },
  glass: { shape: ['#'], label: 'Wine glass', fragile: true },
  globe: { shape: ['#'], label: 'Snow globe', fragile: true },
  teapot: { shape: ['#'], label: 'Teapot', fragile: true },
  paint: { shape: ['#'], label: 'Paint tin', heavy: true },
  // 1×2 standing
  book: { shape: ['#', '#'], label: 'Book' },
  bottle: { shape: ['#', '#'], label: 'Bottle' },
  vase: { shape: ['#', '#'], label: 'Vase', fragile: true },
  // 2×1 lying
  shoes: { shape: ['##'], label: 'Shoes' },
  plates: { shape: ['##'], label: 'Plates' },
  toaster: { shape: ['##'], label: 'Toaster' },
  laptop: { shape: ['##'], label: 'Laptop' },
  towels: { shape: ['##'], label: 'Towels' },
  radio: { shape: ['##'], label: 'Radio' },
  eggs: { shape: ['##'], label: 'Eggs', fragile: true },
  books: { shape: ['##'], label: 'Book stack', heavy: true },
  toolbox: { shape: ['##'], label: 'Toolbox', heavy: true },
  pot: { shape: ['##'], label: 'Cast-iron pot', heavy: true },
  flour: { shape: ['#', '#'], label: 'Flour sack', heavy: true },
  // 3×1, 1×3
  pan: { shape: ['###'], label: 'Frying pan' },
  train: { shape: ['###'], label: 'Toy train' },
  umbrella: { shape: ['#', '#', '#'], label: 'Umbrella' },
  // 4×1, 1×4
  rug: { shape: ['####'], label: 'Rolled rug' },
  skateboard: { shape: ['####'], label: 'Skateboard' },
  guitar: { shape: ['#', '#', '#', '#'], label: 'Guitar' },
  // 2×2, 3×2
  teddy: { shape: ['##', '##'], label: 'Teddy bear' },
  backpack: { shape: ['##', '##'], label: 'Backpack' },
  microwave: { shape: ['##', '##'], label: 'Microwave' },
  mirror: { shape: ['##', '##'], label: 'Mirror', fragile: true },
  crate: { shape: ['##', '##'], label: 'Record crate', heavy: true },
  tire: { shape: ['##', '##'], label: 'Spare tyre', heavy: true },
  tv: { shape: ['###', '###'], label: 'TV', fragile: true },
  // odd shapes
  lamp: { shape: ['##', '#.', '#.'], label: 'Desk lamp' },
  hairdryer: { shape: ['##', '#.'], label: 'Hair dryer' },
  blocks: { shape: ['#.', '##'], label: 'Toy blocks' },
  hockey: { shape: ['#.', '#.', '##'], label: 'Hockey stick' },
  plant: { shape: ['###', '.#.'], label: 'Plant' },
  chair: { shape: ['#.', '##', '##'], label: 'Chair' },
  castle: { shape: ['#.#', '###'], label: 'Toy castle' },
  horse: { shape: ['..#', '###'], label: 'Rocking horse' },
  table: { shape: ['###', '#.#'], label: 'Side table' },
  sofa: { shape: ['#..#', '####'], label: 'Sofa' },
} satisfies Record<string, KindDef>;

export type Kind = keyof typeof KINDS;

export type ThemeKey =
  | 'hallway'
  | 'kitchen'
  | 'bathroom'
  | 'kids'
  | 'study'
  | 'bedroom'
  | 'dining'
  | 'cupboards'
  | 'closet'
  | 'garage'
  | 'workshop'
  | 'pantry'
  | 'den'
  | 'music'
  | 'nursery'
  | 'attic'
  | 'living';

export interface LevelDef {
  room: string;
  theme: ThemeKey;
  cols: number;
  rows: number;
  rotate?: boolean;
  /** Item kinds; `kind@r` starts the item turned r quarter turns clockwise. */
  items: string[];
  /** One short line shown when the room opens (introduces a new idea). */
  intro?: string;
  /** One verified arrangement [x, y, r] per item (checked by logic.test.ts, used by the hint). */
  solution: [number, number, number][];
}

export const LEVELS: LevelDef[] = [
  {
    room: 'Hallway',
    theme: 'hallway',
    cols: 4,
    rows: 3,
    items: ['rug', 'backpack', 'shoes', 'shoes'],
    intro: 'Drop everything into the box',
    solution: [[0,2,0],[0,0,0],[2,0,0],[2,1,0]],
  },
  {
    room: 'Kitchen',
    theme: 'kitchen',
    cols: 4,
    rows: 4,
    items: ['microwave', 'pan', 'toaster', 'bottle', 'plates', 'mug', 'bottle'],
    solution: [[0,2,0],[0,0,0],[2,3,0],[3,1,0],[0,1,0],[3,0,0],[2,1,0]],
  },
  {
    room: 'Bathroom',
    theme: 'bathroom',
    cols: 5,
    rows: 4,
    items: ['plant', 'hairdryer', 'towels', 'bottle', 'duck', 'hairdryer', 'towels', 'bottle', 'duck'],
    solution: [[2,2,0],[0,0,0],[1,1,0],[4,0,0],[2,0,0],[0,2,0],[1,3,0],[3,0,0],[4,3,0]],
  },
  {
    room: "Kids' room",
    theme: 'kids',
    cols: 5,
    rows: 4,
    items: ['castle', 'teddy', 'skateboard', 'blocks', 'train', 'duck'],
    solution: [[0,2,0],[3,2,0],[1,0,0],[0,0,0],[2,1,0],[1,2,0]],
  },
  {
    room: 'Study',
    theme: 'study',
    cols: 3,
    rows: 5,
    rotate: true,
    items: ['guitar@1', 'lamp@1', 'umbrella@1', 'laptop', 'book'],
    intro: 'Tap an item to turn it',
    solution: [[0,1,1],[1,2,1],[1,1,1],[2,0,1],[0,0,1]],
  },
  {
    room: 'Bedroom',
    theme: 'bedroom',
    cols: 5,
    rows: 5,
    rotate: true,
    items: ['chair@3', 'guitar@1', 'teddy', 'lamp@2', 'backpack', 'lamp@1'],
    solution: [[0,3,0],[0,0,1],[3,3,0],[2,1,1],[3,0,0],[1,0,3]],
  },
  {
    room: 'Dining room',
    theme: 'dining',
    cols: 4,
    rows: 4,
    items: ['plates', 'vase', 'pan', 'glass', 'bottle', 'teapot', 'plates', 'glass', 'bottle'],
    intro: 'Fragile! Nothing can go above glass',
    solution: [[0,2,0],[0,0,0],[1,1,0],[2,0,0],[3,2,0],[3,0,0],[0,3,0],[1,0,0],[2,2,0]],
  },
  {
    room: 'Cupboards',
    theme: 'cupboards',
    cols: 5,
    rows: 5,
    rotate: true,
    items: ['table@2', 'eggs@1', 'microwave', 'plant@2', 'vase@1', 'pan@1', 'glass', 'plant@1'],
    solution: [[0,3,0],[0,0,0],[3,3,0],[2,0,0],[1,0,0],[2,2,1],[4,0,0],[0,1,0]],
  },
  {
    room: 'Hall closet',
    theme: 'closet',
    cols: 5,
    rows: 4,
    items: ['backpack', 'umbrella', 'towels', 'shoes', 'hairdryer', 'bottle', 'towels', 'shoes'],
    solution: [[0,2,0],[2,1,0],[3,2,0],[3,0,0],[1,0,0],[0,0,0],[3,3,0],[3,1,0]],
  },
  {
    room: 'Garage',
    theme: 'garage',
    cols: 4,
    rows: 4,
    items: ['tire', 'hockey', 'toolbox', 'umbrella', 'paint', 'ball', 'paint'],
    intro: 'Heavy things go on the floor or on heavy things',
    solution: [[0,2,0],[2,1,0],[0,1,0],[3,0,0],[1,0,0],[2,0,0],[0,0,0]],
  },
  {
    room: 'Workshop',
    theme: 'workshop',
    cols: 5,
    rows: 5,
    rotate: true,
    items: ['table@1', 'tire', 'chair@3', 'toolbox@1', 'lamp@2', 'paint', 'hockey@1'],
    solution: [[0,3,1],[3,3,0],[1,0,0],[4,1,0],[0,0,2],[4,0,0],[1,2,0]],
  },
  {
    room: 'Pantry',
    theme: 'pantry',
    cols: 5,
    rows: 5,
    items: ['microwave', 'plant', 'pot', 'eggs', 'pan', 'flour', 'teapot', 'bottle', 'plant', 'jar'],
    solution: [[3,0,0],[0,1,0],[0,4,0],[0,0,0],[2,2,0],[4,3,0],[2,0,0],[0,2,0],[1,3,0],[3,4,0]],
  },
  {
    room: 'Den',
    theme: 'den',
    cols: 6,
    rows: 5,
    rotate: true,
    items: ['sofa@2', 'tv@1', 'table@1', 'plant@3', 'lamp@1', 'books@1', 'vase@1', 'clock'],
    solution: [[0,3,0],[0,0,0],[2,0,2],[4,2,0],[3,1,0],[1,4,1],[4,0,0],[5,4,0]],
  },
  {
    room: 'Music room',
    theme: 'music',
    cols: 5,
    rows: 6,
    items: ['guitar', 'crate', 'chair', 'lamp', 'radio', 'vase', 'guitar', 'lamp', 'glass'],
    solution: [[4,2,0],[2,4,0],[1,0,0],[3,1,0],[2,0,0],[0,0,0],[0,2,0],[1,3,0],[4,0,0]],
  },
  {
    room: 'Nursery',
    theme: 'nursery',
    cols: 6,
    rows: 5,
    rotate: true,
    items: ['horse@3', 'castle@2', 'teddy', 'mirror', 'chair@1', 'books@1', 'globe', 'teddy', 'globe'],
    solution: [[0,3,1],[4,0,1],[0,2,0],[0,0,0],[2,1,0],[5,3,0],[3,0,0],[3,3,0],[2,0,0]],
  },
  {
    room: 'Attic',
    theme: 'attic',
    cols: 5,
    rows: 7,
    rotate: true,
    items: ['rug@1', 'horse@1', 'crate', 'castle@1', 'table@2', 'mirror', 'chair@2', 'lamp@3'],
    solution: [[1,4,1],[0,5,3],[3,5,0],[0,3,0],[2,0,2],[0,0,0],[3,1,2],[0,2,2]],
  },
  {
    room: 'Living room',
    theme: 'living',
    cols: 6,
    rows: 6,
    rotate: true,
    items: ['sofa@2', 'tv@1', 'crate', 'guitar@1', 'plant@1', 'chair@1', 'lamp@2', 'vase@1', 'glass'],
    solution: [[0,4,2],[1,0,1],[4,4,0],[5,0,1],[0,1,2],[1,3,0],[2,2,3],[4,0,1],[0,0,0]],
  },
];

export function kindOf(item: string): { kind: Kind; r: number } {
  const [k, r] = item.split('@');
  if (!(k in KINDS)) throw new Error(`Unknown item kind "${k}"`);
  return { kind: k as Kind, r: r ? Number(r) : 0 };
}

export function puzzleOf(level: LevelDef): Puzzle {
  const pieces: Piece[] = level.items.map((item) => {
    const { kind, r } = kindOf(item);
    const def: KindDef = KINDS[kind];
    const cells = orient(parseShape(def.shape), r);
    return { kind, cells, fragile: !!def.fragile, heavy: !!def.heavy };
  });
  const area = pieces.reduce((n, p) => n + p.cells.length, 0);
  const spare = level.cols * level.rows - area;
  if (spare < 0) throw new Error(`${level.room}: items need ${area} cells, box has ${level.cols * level.rows}`);
  return { cols: level.cols, rows: level.rows, rotate: !!level.rotate, spare, pieces };
}

export function solutionOf(level: LevelDef): Placement[] {
  return level.solution.map(([x, y, r]) => ({ x, y, r }));
}
