/**
 * Moving Day: pack every room into one cardboard box.
 *
 * Drag items from the rug into the box (seen front-on as a grid). The ghost preview snaps to the
 * grid, green when the drop is allowed and red when not. Fragile items (red sticker) can't have
 * anything above them; heavy items (weight badge) need the floor or other heavy items below.
 * In rotation rooms a tap turns an item. A full box closes, gets taped and stamped.
 */
import { Container, Graphics, Sprite, type FederatedPointerEvent, type Text, type Texture } from 'pixi.js';
import {
  burst,
  confetti,
  createGame,
  floatText,
  gsap,
  haptic,
  Hint,
  IconButton,
  load,
  noise,
  punch,
  save,
  sfx,
  shade,
  shake,
  showResult,
  svgTexture,
  TapHand,
  text,
  tone,
  TopBar,
  W,
  wait,
} from '../../kit';
import { LEVELS, kindOf, puzzleOf, solutionOf, type Kind, type LevelDef } from './levels.ts';
import {
  buildGrid,
  canPlace,
  cellsAt,
  dims,
  dropFrom,
  isSupported,
  orient,
  settle,
  solve,
  violations,
  type Cell,
  type Placement,
  type Puzzle,
} from './logic.ts';
import { CELL, FRAGILE_SVG, HEAVY_SVG, THEMES, itemArt, type Theme } from './art.ts';

// ------------------------------------------------------------------------------------------------
// Constants

const BOX_TOP = 134; // inner top of the box (before tall-screen centring)
const WALL = 12; // cardboard wall thickness
const TRAY_W = 362;
const CTRL_H = 78;
const FLAP_OPEN = -0.17;
const TEX_RES = 2.5;
const LIFT_TOUCH = 46; // touch: carry the item this far above the finger

const CARD = 0xdcae73;
const CARD_DARK = 0xb98550;
const CARD_INSIDE = 0xc4935a;
const CARD_LINE = 0x7a4f27;
const OK_FILL = 0x52b788;
const OK_LINE = 0x2d6a4f;
const BAD_FILL = 0xef476f;
const BAD_LINE = 0xc1121f;

// ------------------------------------------------------------------------------------------------
// Scene

const game = await createGame({ background: '#fdf0d5' });
const { app, root } = game;
let H = game.H;

const roomLayer = new Container();
const boxC = new Container();
const beamLayer = new Container();
const trayC = new Container();
const uiLayer = new Container();
const dragLayer = new Container();
const fxLayer = new Container();
const overlay = new Container();
root.addChild(roomLayer, boxC, trayC, beamLayer, uiLayer, dragLayer, fxLayer, overlay);
beamLayer.eventMode = 'none';
fxLayer.eventMode = 'none';
roomLayer.eventMode = 'none';

const boxShadow = new Graphics();
const boxBack = new Graphics();
const gridG = new Graphics();
const ghostG = new Graphics();
const placedLayer = new Container();
const frameG = new Graphics();
const warnG = new Graphics();
const flapL = new Container();
const flapR = new Container();
const tapeG = new Graphics();
const stampC = new Container();
boxC.addChild(boxShadow, boxBack, gridG, ghostG, placedLayer, frameG, warnG, flapL, flapR, tapeG, stampC);
for (const o of [boxShadow, boxBack, gridG, ghostG, frameG, warnG, flapL, flapR, tapeG, stampC]) o.eventMode = 'none';

const rugG = new Graphics();
const trayItems = new Container();
trayC.addChild(rugG, trayItems);

// Sunbeam with dust motes, over the room (under the UI).
const beamG = new Graphics();
beamG.blendMode = 'add';
beamLayer.addChild(beamG);
const motes: Graphics[] = [];
for (let i = 0; i < 16; i++) {
  const m = new Graphics().circle(0, 0, 1 + Math.random() * 1.4).fill({ color: 0xffffff, alpha: 0.55 });
  motes.push(m);
  beamLayer.addChild(m);
}

const bar = new TopBar({ onRestart: () => restartRoom(), fg: 0x5a3d2b, textColor: 0x5a3d2b });
uiLayer.addChild(bar);

const undoBtn = new IconButton('undo', () => undo(), { fg: 0x5a3d2b, size: 52 });
const hintBtn = new IconButton('hint', () => useHint(), { fg: 0x5a3d2b, size: 52 });
const meter = new Container();
const meterBg = new Graphics();
const meterFill = new Graphics();
const meterLabel: Text = text('', 13, 0x6b5a4a, 600);
meterLabel.anchor.set(0.5);
meterLabel.y = 11;
meter.addChild(meterBg, meterFill, meterLabel);
const hintCost = text('−★', 11, 0xffffff, 700);
hintCost.anchor.set(0.5);
const hintCostBg = new Graphics().roundRect(-15, -9, 30, 18, 9).fill(0xffffff);
const hintTag = new Container();
hintTag.addChild(hintCostBg, hintCost);
hintTag.position.set(20, -20);
hintBtn.addChild(hintTag);
uiLayer.addChild(undoBtn, hintBtn, meter);

// ------------------------------------------------------------------------------------------------
// Textures (created once per kind, cached by the kit)

const textures = new Map<Kind, Texture>();
let fragileTex: Texture | null = null;
let heavyTex: Texture | null = null;

async function loadTextures(lv: LevelDef): Promise<void> {
  const kinds = [...new Set(lv.items.map((s) => kindOf(s).kind))];
  await Promise.all([
    ...kinds.map(async (k) => {
      const a = itemArt(k);
      textures.set(k, await svgTexture(`moving:${k}`, a.svg, a.w, a.h, TEX_RES));
    }),
    svgTexture('moving:fragile', FRAGILE_SVG, 40, 40, TEX_RES).then((t) => void (fragileTex = t)),
    svgTexture('moving:heavy', HEAVY_SVG, 40, 40, TEX_RES).then((t) => void (heavyTex = t)),
  ]);
}

// ------------------------------------------------------------------------------------------------
// State

interface Item {
  idx: number;
  kind: Kind;
  fragile: boolean;
  heavy: boolean;
  /** Quarter turns the art starts with (from `kind@r`). */
  base: number;
  /** Displayed body rotation in quarter turns (only grows, so turns always go clockwise). */
  turn: number;
  view: Container;
  wig: Container;
  body: Container;
  sprite: Sprite;
  shadow: Graphics;
  outline: Graphics;
  badge: Sprite | null;
}

interface Snap {
  placements: (Placement | null)[];
  rot: number[];
  moves: number;
}

let li = 0;
let level: LevelDef = LEVELS[0];
let puz: Puzzle = puzzleOf(level);
let theme: Theme = THEMES[level.theme];
let items: Item[] = [];
let placements: (Placement | null)[] = [];
let rot: number[] = [];
let undoStack: Snap[] = [];
let moves = 0;
let hints = 0;
let busy = true;
let ready = false;

// Layout
let c = 56; // box cell
let tc = 32; // tray cell
let bx = 0; // box inner left
let by = BOX_TOP; // box inner top
let floorY = 0;
let trayTop = 0;
let trayH = 0;
let trayOffY = 0;
let pillY = 96;
let ctrlY = 0;

const shapeOf = (i: number): Cell[] => orient(puz.pieces[i].cells, rot[i]);
const totalCells = () => puz.pieces.reduce((n, p) => n + p.cells.length, 0);
const filledNow = () => placements.reduce((n, p, i) => n + (p ? puz.pieces[i].cells.length : 0), 0);
const par = () => puz.pieces.length + Math.max(2, Math.round(puz.pieces.length / 3));

// ------------------------------------------------------------------------------------------------
// Small helpers

function reparent(o: Container, parent: Container): void {
  if (o.parent === parent) return;
  const g = o.getGlobalPosition();
  parent.addChild(o);
  o.position.copyFrom(parent.toLocal(g));
}

function toFx(from: Container, x: number, y: number): { x: number; y: number } {
  const p = fxLayer.toLocal(from.toGlobal({ x, y }));
  return { x: p.x, y: p.y };
}

function rand(seed: number): () => number {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function rowFull(g: Int16Array, row: number): boolean {
  for (let x = 0; x < level.cols; x++) if (g[row * level.cols + x] < 0) return false;
  return true;
}

const snd = {
  pick() {
    tone({ freq: 420, to: 660, dur: 0.08, type: 'sine', vol: 0.14 });
  },
  turn() {
    tone({ freq: 540, to: 820, dur: 0.07, type: 'triangle', vol: 0.12 });
    noise({ dur: 0.06, vol: 0.05, freq: 2400, q: 1 });
  },
  tick() {
    tone({ freq: 1250, dur: 0.025, type: 'triangle', vol: 0.035 });
  },
  land() {
    tone({ freq: 150, to: 80, dur: 0.1, type: 'sine', vol: 0.28 });
    noise({ dur: 0.05, vol: 0.05, freq: 600 });
  },
  tinkle() {
    tone({ freq: 2637, dur: 0.12, type: 'sine', vol: 0.08 });
    tone({ freq: 3520, dur: 0.1, type: 'sine', vol: 0.06, delay: 0.05 });
    tone({ freq: 3136, dur: 0.16, type: 'sine', vol: 0.05, delay: 0.1 });
  },
  rip() {
    for (let i = 0; i < 6; i++) noise({ dur: 0.08, vol: 0.12, freq: 2200 + i * 350, q: 0.6, delay: i * 0.06 });
  },
  stamp() {
    tone({ freq: 120, to: 60, dur: 0.2, type: 'sine', vol: 0.5 });
    noise({ dur: 0.12, vol: 0.2, freq: 700, q: 0.7 });
  },
};

// ------------------------------------------------------------------------------------------------
// Pill (intro lines and rule explanations)

let pill: Hint | null = null;
let pillMsg = '';
let pillTimer: gsap.core.Tween | null = null;
let intro: string | null = null;

function showPill(msg: string, warn = false, ttl = 2.4): void {
  if (pill && pillMsg === msg) {
    pillTimer?.kill();
    pillTimer = ttl > 0 ? gsap.delayedCall(ttl, pillExpired) : null;
    return;
  }
  hidePill();
  pill = new Hint(msg, warn ? { color: 0xffe3e0, textColor: 0x9d0208, width: 360 } : { width: 360 });
  pill.position.set(W / 2, pillY);
  uiLayer.addChild(pill);
  pillMsg = msg;
  pillTimer = ttl > 0 ? gsap.delayedCall(ttl, pillExpired) : null;
}

function pillExpired(): void {
  hidePill();
  if (intro && !busy) showPill(intro, false, 0);
}

function hidePill(): void {
  pillTimer?.kill();
  pillTimer = null;
  if (pill && !pill.destroyed) pill.hide();
  pill = null;
  pillMsg = '';
}

function dismissIntro(): void {
  if (!intro) return;
  const was = intro;
  intro = null;
  if (pillMsg === was) hidePill();
}

// ------------------------------------------------------------------------------------------------
// Room, box and rug drawing

function drawRoom(g: Graphics, t: Theme): void {
  const r = rand(li + 7);
  g.rect(0, 0, W, floorY).fill(t.wall);
  switch (t.pattern) {
    case 'stripes':
      for (let x = 10; x < W; x += 40) g.rect(x, 0, 18, floorY).fill({ color: t.wall2, alpha: 0.7 });
      break;
    case 'dots':
      for (let y = 18, row = 0; y < floorY; y += 26, row++)
        for (let x = row % 2 ? 26 : 12; x < W; x += 28) g.circle(x, y, 3.2).fill(t.wall2);
      break;
    case 'tiles':
      for (let y = floorY - 12, row = 0; y > -26; y -= 26, row++) {
        g.rect(0, y - 2, W, 2).fill({ color: t.wall2, alpha: 0.9 });
        for (let x = row % 2 ? 13 : 0; x < W; x += 26) g.rect(x, y - 26, 2, 26).fill({ color: t.wall2, alpha: 0.9 });
      }
      break;
    case 'brick':
      for (let y = floorY - 12, row = 0; y > -18; y -= 18, row++) {
        g.rect(0, y - 2, W, 2).fill({ color: t.wall2 });
        for (let x = row % 2 ? 0 : 22; x < W; x += 44) g.rect(x, y - 18, 2, 16).fill({ color: t.wall2 });
      }
      break;
    case 'panel':
      for (let x = 0; x < W; x += 30) g.rect(x, 0, 2, floorY).fill({ color: t.wall2 });
      g.rect(0, floorY - 150, W, 6).fill({ color: shade(t.wall, -0.12) });
      break;
    case 'diamonds':
      for (let x = -floorY; x < W + floorY; x += 34) {
        g.moveTo(x, 0).lineTo(x + floorY, floorY).stroke({ width: 2, color: t.wall2 });
        g.moveTo(x, 0).lineTo(x - floorY, floorY).stroke({ width: 2, color: t.wall2 });
      }
      break;
    case 'flowers':
      for (let y = 26, row = 0; y < floorY; y += 40, row++)
        for (let x = row % 2 ? 40 : 18; x < W; x += 44) {
          for (let k = 0; k < 4; k++)
            g.circle(x + Math.cos((k * Math.PI) / 2) * 4, y + Math.sin((k * Math.PI) / 2) * 4, 3.4).fill(t.wall2);
          g.circle(x, y, 2.4).fill({ color: 0xffffff, alpha: 0.7 });
        }
      break;
    case 'plain':
      break;
  }
  // Lighter patches where pictures used to hang, each with its nail.
  const marks = [
    [14 + r() * 10, 84 + r() * 20, 40, 54],
    [W - 60 - r() * 10, 120 + r() * 30, 42, 32],
    [W - 54, floorY - 120 - r() * 30, 30, 40],
  ];
  for (const [x, y, w, h] of marks) {
    g.roundRect(x, y, w, h, 3).fill({ color: 0xffffff, alpha: 0.16 });
    g.circle(x + w / 2, y - 6, 1.8).fill({ color: 0x000000, alpha: 0.35 });
  }
  // Light switch and a socket.
  g.roundRect(8, floorY - 92, 18, 26, 4).fill(0xfdf8ee).stroke({ width: 1.5, color: shade(t.wall, -0.3) });
  g.roundRect(13, floorY - 85, 8, 12, 2).fill(0xe9e1d3);
  g.roundRect(W - 30, floorY - 40, 18, 16, 4).fill(0xfdf8ee).stroke({ width: 1.5, color: shade(t.wall, -0.3) });
  g.circle(W - 24, floorY - 32, 1.5).fill(0x8a8a8a);
  g.circle(W - 18, floorY - 32, 1.5).fill(0x8a8a8a);
  // Skirting board.
  g.rect(0, floorY - 14, W, 14).fill(shade(t.wall, -0.2));
  g.rect(0, floorY - 14, W, 3).fill({ color: 0xffffff, alpha: 0.35 });
  // Floor.
  const fh = H - floorY;
  g.rect(0, floorY, W, fh).fill(t.floor);
  switch (t.floorKind) {
    case 'wood':
      for (let y = floorY + 18, row = 0; y < H; y += 22, row++) {
        g.rect(0, y, W, 2).fill({ color: t.floor2, alpha: 0.8 });
        for (let x = (row * 67) % 130; x < W; x += 130) g.rect(x, y - 20, 2, 20).fill({ color: t.floor2, alpha: 0.6 });
      }
      break;
    case 'tiles':
      for (let y = floorY, row = 0; y < H; y += 34, row++)
        for (let x = row % 2 ? 0 : -34, k = 0; x < W; x += 34, k++)
          if (k % 2 === 0) g.rect(x, y, 34, 34).fill({ color: t.floor2, alpha: 0.55 });
      break;
    case 'concrete':
      for (let i = 0; i < 140; i++)
        g.circle(r() * W, floorY + r() * fh, 0.8 + r() * 1.4).fill({ color: t.floor2, alpha: 0.7 });
      for (let x = 97; x < W; x += 130) g.rect(x, floorY, 2, fh).fill({ color: t.floor2 });
      break;
    case 'carpet':
      for (let i = 0; i < 260; i++) g.circle(r() * W, floorY + r() * fh, 1.2).fill({ color: t.floor2, alpha: 0.6 });
      break;
  }
  g.rect(0, floorY, W, 10).fill({ color: 0x000000, alpha: 0.08 });
}

let roomG: Graphics | null = null;

function paintRoom(fade: boolean): void {
  const g = new Graphics();
  drawRoom(g, theme);
  roomLayer.addChild(g);
  const old = roomG;
  roomG = g;
  if (old) {
    if (fade) {
      g.alpha = 0;
      gsap.to(g, { alpha: 1, duration: 0.45, onComplete: () => old.destroy() });
    } else old.destroy();
  }
  // Sunbeam from a window off-screen, top left.
  beamG.clear();
  beamG.poly([40, 0, 150, 0, W + 40, H, W * 0.45, H]).fill({ color: 0xfff3c4, alpha: 0.075 });
  beamG.poly([95, 0, 125, 0, W * 0.9, H, W * 0.72, H]).fill({ color: 0xffffff, alpha: 0.04 });
}

function startMotes(): void {
  motes.forEach((m) => {
    gsap.killTweensOf(m);
    const t = Math.random();
    m.position.set(90 + t * (W * 0.62) + (Math.random() - 0.5) * 70, t * H);
    m.alpha = 0.3 + Math.random() * 0.5;
    gsap.to(m, {
      x: m.x + (Math.random() - 0.5) * 40,
      y: m.y - 20 - Math.random() * 40,
      alpha: 0.15,
      duration: 4 + Math.random() * 5,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });
  });
}

function drawBox(): void {
  const { cols, rows } = level;
  const iw = cols * c;
  const ih = rows * c;
  const ox = bx - WALL;
  const oy = by - WALL;
  const ow = iw + WALL * 2;
  const oh = ih + WALL * 2;

  boxShadow.clear().ellipse(W / 2, oy + oh, ow / 2 + 16, 12).fill({ color: 0x2b1a0e, alpha: 0.2 });

  boxBack.clear();
  boxBack.roundRect(ox, oy, ow, oh, 7).fill(CARD_DARK);
  boxBack.rect(bx, by, iw, ih).fill(CARD_INSIDE);
  boxBack.rect(bx, by, iw, Math.min(14, c * 0.25)).fill({ color: 0x000000, alpha: 0.1 });
  boxBack.rect(bx, by, 9, ih).fill({ color: 0x000000, alpha: 0.06 });
  boxBack.rect(bx + iw - 6, by, 6, ih).fill({ color: 0xffffff, alpha: 0.05 });

  gridG.clear();
  for (let x = 1; x < cols; x++) gridG.rect(bx + x * c - 0.75, by + 3, 1.5, ih - 6).fill({ color: CARD_LINE, alpha: 0.16 });
  for (let y = 1; y < rows; y++) gridG.rect(bx + 3, by + y * c - 0.75, iw - 6, 1.5).fill({ color: CARD_LINE, alpha: 0.16 });
  for (let x = 1; x < cols; x++)
    for (let y = 1; y < rows; y++) gridG.circle(bx + x * c, by + y * c, 2.2).fill({ color: CARD_LINE, alpha: 0.22 });

  frameG.clear();
  // Walls of the box around the opening.
  frameG.rect(ox, oy, ow, WALL).fill(CARD);
  frameG.rect(ox, oy + oh - WALL, ow, WALL).fill(shade(CARD, -0.06));
  frameG.rect(ox, by, WALL, ih).fill(shade(CARD, -0.03));
  frameG.rect(ox + ow - WALL, by, WALL, ih).fill(shade(CARD, -0.03));
  frameG.roundRect(ox, oy, ow, oh, 7).stroke({ width: 2.5, color: CARD_LINE });
  frameG.rect(bx, by, iw, ih).stroke({ width: 2, color: CARD_LINE, alpha: 0.8 });
  frameG.rect(ox + 6, oy + 3, ow - 12, 2).fill({ color: 0xffffff, alpha: 0.35 });
  for (let x = ox + 8; x < ox + ow - 8; x += 7) frameG.rect(x, oy + 7, 1.5, 3).fill({ color: CARD_LINE, alpha: 0.25 });
  // Bits of old tape on two corners.
  frameG.poly([ox - 4, oy + 18, ox + 18, oy - 4, ox + 30, oy + 8, ox + 8, oy + 30]).fill({ color: 0xe8cf9a, alpha: 0.9 });
  const rx = ox + ow;
  const ry = oy + oh;
  frameG.poly([rx + 4, ry - 18, rx - 18, ry + 4, rx - 30, ry - 8, rx - 8, ry - 30]).fill({ color: 0xe8cf9a, alpha: 0.9 });

  drawFlaps(ox, oy, ow, oh);
}

function drawFlaps(ox: number, oy: number, ow: number, oh: number): void {
  const fw = ow / 2;
  for (const [flap, side] of [
    [flapL, 1],
    [flapR, -1],
  ] as const) {
    flap.removeChildren().forEach((ch) => ch.destroy({ children: true }));
    const x0 = side === 1 ? 0 : -fw;
    const outside = new Graphics();
    outside.roundRect(x0, 0, fw, oh, 6).fill(CARD).stroke({ width: 2.5, color: CARD_LINE });
    outside.rect(x0 + 6, 4, fw - 12, 2).fill({ color: 0xffffff, alpha: 0.3 });
    for (let y = 14; y < oh - 8; y += 9) outside.rect(x0 + 6, y, fw - 12, 1).fill({ color: CARD_LINE, alpha: 0.06 });
    const print = new Container();
    if (side === 1) {
      // "This side up" arrows.
      const a = new Graphics();
      for (const dx of [-11, 11]) {
        a.moveTo(dx, 14).lineTo(dx, -10).stroke({ width: 4, color: 0x6b4423, alpha: 0.7, cap: 'round' });
        a.poly([dx - 8, -6, dx, -16, dx + 8, -6]).fill({ color: 0x6b4423, alpha: 0.7 });
      }
      a.rect(-22, 20, 44, 3).fill({ color: 0x6b4423, alpha: 0.7 });
      a.position.set(fw / 2, Math.min(oh * 0.3, 70));
      print.addChild(a);
    } else {
      // Keep the name clear of the tape strip that later runs down the middle of the box.
      const tapeHalf = Math.max(26, Math.min(40, ow * 0.13)) / 2 + 4;
      const name = text(level.room.toUpperCase(), Math.max(14, Math.min(22, fw / 7)), 0x6b4423, 700, {
        wrap: fw - 20 - tapeHalf,
        align: 'center',
      });
      name.alpha = 0.75;
      name.anchor.set(0.5);
      name.rotation = -0.06;
      name.position.set(-(fw - tapeHalf) / 2, Math.min(oh * 0.3, 70));
      print.addChild(name);
    }
    const inside = new Graphics();
    inside.roundRect(x0, 0, fw, oh, 6).fill(shade(CARD_INSIDE, -0.08)).stroke({ width: 2.5, color: CARD_LINE });
    inside.rect(side === 1 ? x0 : -12, 0, 12, oh).fill({ color: 0x000000, alpha: 0.12 });
    outside.addChild(print);
    flap.addChild(inside, outside);
    flap.position.set(side === 1 ? ox : ox + ow, oy);
  }
  setFlap(flapL, FLAP_OPEN);
  setFlap(flapR, FLAP_OPEN);
}

function setFlap(flap: Container, sx: number): void {
  flap.scale.x = sx;
  const [inside, outside] = flap.children;
  if (outside) outside.visible = sx > 0;
  if (inside) inside.visible = sx <= 0;
}

function drawRug(): void {
  const x = (W - TRAY_W) / 2;
  const h = trayH - 6;
  rugG.clear();
  rugG.roundRect(x + 2, 6, TRAY_W, h, 18).fill({ color: 0x000000, alpha: 0.12 });
  rugG.roundRect(x, 0, TRAY_W, h, 18).fill(theme.rug);
  rugG.roundRect(x + 9, 9, TRAY_W - 18, h - 18, 12).stroke({ width: 4, color: theme.rug2, alpha: 0.85 });
  rugG.roundRect(x + 17, 17, TRAY_W - 34, h - 34, 8).stroke({ width: 1.5, color: theme.rug2, alpha: 0.5 });
  for (let y = 12; y < h - 10; y += 7) {
    rugG.rect(x - 7, y, 7, 2).fill({ color: theme.rug2, alpha: 0.8 });
    rugG.rect(x + TRAY_W, y, 7, 2).fill({ color: theme.rug2, alpha: 0.8 });
  }
}

// ------------------------------------------------------------------------------------------------
// Layout

interface Pack {
  pos: Map<number, { x: number; y: number }>;
  height: number;
}

/** Shelf packing for the rug: tallest first, rows centred, items bottom-aligned in each row. */
function packTray(ids: number[], t: number): Pack {
  const maxW = TRAY_W - 36;
  const gap = Math.max(12, t * 0.45);
  const info = ids.map((i) => ({ i, ...dims(shapeOf(i)) }));
  info.sort((a, b) => b.h - a.h || b.w - a.w || a.i - b.i);
  const rows: { list: typeof info; width: number; height: number }[] = [];
  for (const it of info) {
    const w = it.w * t;
    let row = rows[rows.length - 1];
    if (!row || (row.list.length && row.width + gap + w > maxW)) {
      row = { list: [], width: 0, height: 0 };
      rows.push(row);
    }
    row.width += (row.list.length ? gap : 0) + w;
    row.height = Math.max(row.height, it.h * t);
    row.list.push(it);
  }
  const pos = new Map<number, { x: number; y: number }>();
  let y = 0;
  const rowGap = Math.max(10, t * 0.35);
  rows.forEach((row, k) => {
    if (k) y += rowGap;
    let x = (W - row.width) / 2;
    for (const it of row.list) {
      const w = it.w * t;
      const h = it.h * t;
      pos.set(it.i, { x: x + w / 2, y: y + row.height - h / 2 });
      x += w + gap;
    }
    y += row.height;
  });
  return { pos, height: y };
}

function computeLayout(): void {
  const { cols, rows } = level;
  const all = puz.pieces.map((_, i) => i);
  const avail = H - BOX_TOP - WALL - 16 - CTRL_H;
  let found = false;
  for (let cc = Math.min(64, Math.floor(300 / cols)); cc >= 28 && !found; cc--) {
    const trayAvail = avail - rows * cc;
    for (let t = Math.min(40, Math.round(cc * 0.78)); t >= Math.max(18, Math.round(cc * 0.45)); t--) {
      if (packTray(all, t).height + 34 <= trayAvail) {
        c = cc;
        tc = t;
        found = true;
        break;
      }
    }
  }
  if (!found) {
    c = 28;
    tc = 18;
  }
  const packH = packTray(all, tc).height;
  const spareH = avail - rows * c - (packH + 34);
  by = BOX_TOP + Math.round(Math.max(0, Math.min(56, spareH * 0.35)));
  bx = Math.round((W - cols * c) / 2);
  const boxBottom = by + rows * c + WALL;
  floorY = boxBottom - Math.round(Math.min(34, rows * c * 0.16));
  trayTop = boxBottom + 16;
  trayH = H - CTRL_H - trayTop;
  trayOffY = Math.max(0, Math.round((trayH - 6 - packH) / 2));
  pillY = Math.max(94, Math.round((70 + by - WALL) / 2));
  ctrlY = H - CTRL_H / 2 - 2;
}

function layoutControls(): void {
  undoBtn.position.set(46, ctrlY);
  hintBtn.position.set(W - 46, ctrlY);
  meter.position.set(W / 2, ctrlY);
  meterBg.clear();
  meterBg.roundRect(-104, -22, 208, 50, 18).fill({ color: 0x000000, alpha: 0.12 });
  meterBg.roundRect(-104, -26, 208, 50, 18).fill({ color: 0xfffaf2, alpha: 0.95 });
  meterBg.roundRect(-88, -16, 176, 14, 7).fill(0xeadfcd);
  bar.title.style.fill = theme.ink;
  bar.sub.style.fill = theme.ink;
  hintCostBg.tint = theme.accent;
}

let meterV = 0;
const meterAnim = { v: 0 };

function drawMeter(v: number): void {
  meterFill.clear();
  if (v <= 0.001) return;
  meterFill.roundRect(-88, -16, Math.max(14, 176 * v), 14, 7).fill(theme.accent);
  meterFill.roundRect(-84, -14, Math.max(6, 176 * v - 8), 3, 1.5).fill({ color: 0xffffff, alpha: 0.35 });
}

function updateMeter(animate = true): void {
  const total = totalCells();
  const f = total ? filledNow() / total : 0;
  if (f !== meterV || !animate) {
    meterV = f;
    gsap.killTweensOf(meterAnim);
    if (animate) gsap.to(meterAnim, { v: f, duration: 0.35, ease: 'power2.out', onUpdate: () => drawMeter(meterAnim.v) });
    else {
      meterAnim.v = f;
      drawMeter(f);
    }
  }
  meterLabel.text = `${moves} ${moves === 1 ? 'move' : 'moves'} · par ${par()}`;
  meterLabel.style.fill = moves > par() ? 0xc1121f : 0x6b5a4a;
  undoBtn.alpha = undoStack.length && !busy ? 1 : 0.45;
  hintBtn.alpha = busy ? 0.45 : 1;
  hintTag.visible = hints < 2;
}

// ------------------------------------------------------------------------------------------------
// Items

function makeItem(idx: number): Item {
  const { kind, r } = kindOf(level.items[idx]);
  const piece = puz.pieces[idx];
  const view = new Container();
  const shadow = new Graphics();
  const outline = new Graphics();
  const wig = new Container();
  const body = new Container();
  const sprite = new Sprite(textures.get(kind)!);
  sprite.anchor.set(0.5);
  body.addChild(sprite);
  wig.addChild(body);
  let badge: Sprite | null = null;
  if (piece.fragile && fragileTex) badge = new Sprite(fragileTex);
  else if (piece.heavy && heavyTex) badge = new Sprite(heavyTex);
  if (badge) {
    badge.anchor.set(0.5);
    wig.addChild(badge);
  }
  outline.visible = false;
  view.addChild(shadow, outline, wig);
  body.rotation = (r * Math.PI) / 2;
  const it: Item = {
    idx,
    kind,
    fragile: piece.fragile,
    heavy: piece.heavy,
    base: r,
    turn: r,
    view,
    wig,
    body,
    sprite,
    shadow,
    outline,
    badge,
  };
  view.eventMode = 'static';
  view.cursor = 'grab';
  view.hitArea = { contains: (x: number, y: number) => hitTest(it, x, y) };
  view.on('pointerdown', (e: FederatedPointerEvent) => onItemDown(it, e));
  drawItem(it);
  return it;
}

function hitTest(it: Item, x: number, y: number): boolean {
  const cells = shapeOf(it.idx);
  const { w, h } = dims(cells);
  const u = (x + (w * c) / 2) / c;
  const v = (y + (h * c) / 2) / c;
  // A little slack around small items in the tray makes them easier to grab.
  // In the tray, aim for a ~44 pt touch target even when the tray has shrunk the item.
  const t = c * trayScaleNow;
  const s = placements[it.idx] ? 0.04 : Math.max(0.18, Math.min(0.6, (22 - t / 2) / t));
  return cells.some(([cx, cy]) => u >= cx - s && u <= cx + 1 + s && v >= cy - s && v <= cy + 1 + s);
}

function drawItem(it: Item): void {
  const cells = shapeOf(it.idx);
  const { w, h } = dims(cells);
  const hw = (w * c) / 2;
  const hh = (h * c) / 2;
  it.sprite.scale.set(c / CELL);
  it.wig.pivot.set(0, hh);
  it.wig.position.set(0, hh);
  it.shadow.clear();
  it.outline.clear();
  const ins = Math.max(3, c * 0.07);
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  const has = (x: number, y: number) => set.has(`${x},${y}`);
  // One soft blob under the whole shape (cells merged), so it reads as a single object.
  for (const [x, y] of cells) {
    const px = x * c - hw;
    const py = y * c - hh;
    it.shadow.rect(px + ins, py + ins, c - ins * 2, c - ins * 2);
    if (has(x + 1, y)) it.shadow.rect(px + c - ins, py + ins, ins * 2, c - ins * 2);
    if (has(x, y + 1)) it.shadow.rect(px + ins, py + c - ins, c - ins * 2, ins * 2);
    if (has(x + 1, y) && has(x, y + 1) && has(x + 1, y + 1)) it.shadow.rect(px + c - ins, py + c - ins, ins * 2, ins * 2);
  }
  it.shadow.fill({ color: 0x3b2414, alpha: 0.2 });
  for (const [x, y] of cells) {
    it.outline
      .roundRect(x * c - hw + 2, y * c - hh + 2, c - 4, c - 4, c * 0.16)
      .fill({ color: 0xffffff, alpha: 0.2 })
      .stroke({ width: 2.5, color: 0xffffff, alpha: 0.95 });
  }
  if (it.badge) {
    // Top row, rightmost cell: the sticker stays upright whichever way the item faces.
    let best = cells[0];
    for (const cell of cells) if (cell[1] < best[1] || (cell[1] === best[1] && cell[0] > best[0])) best = cell;
    const size = Math.max(17, Math.min(26, c * 0.4));
    it.badge.scale.set(size / 40);
    it.badge.position.set((best[0] + 1) * c - hw - size * 0.42, best[1] * c - hh + size * 0.42);
  }
}

function shadowMode(it: Item, mode: 'tray' | 'lift' | 'box'): void {
  const [dx, dy, a] = mode === 'lift' ? [7, 12, 0.9] : mode === 'box' ? [2, 3, 0.55] : [2, 4, 1];
  gsap.to(it.shadow, { x: dx, y: dy, alpha: a, duration: 0.15 });
}

function boxCentre(i: number, p: Placement): { x: number; y: number } {
  const { w, h } = dims(orient(puz.pieces[i].cells, p.r));
  return { x: bx + (p.x + w / 2) * c, y: by + (p.y + h / 2) * c };
}

/** Turn the art to match rot[i] (always clockwise) and redraw the cell geometry. */
function syncTurn(it: Item, animate: boolean): void {
  const target = it.base + rot[it.idx];
  if ((((it.turn - target) % 4) + 4) % 4 !== 0) {
    while ((((it.turn - target) % 4) + 4) % 4 !== 0) it.turn++;
    gsap.killTweensOf(it.body);
    if (animate) {
      gsap.to(it.body, { rotation: (it.turn * Math.PI) / 2, duration: 0.22, ease: 'back.out(2.2)' });
      it.shadow.alpha = 0;
      gsap.to(it.shadow, { alpha: placements[it.idx] ? 0.55 : 1, duration: 0.25, delay: 0.1 });
    } else it.body.rotation = (it.turn * Math.PI) / 2;
  }
  drawItem(it);
}

function wobble(it: Item, strength = 0.14): void {
  gsap.killTweensOf(it.wig, 'rotation');
  gsap
    .timeline()
    .to(it.wig, { rotation: strength, duration: 0.06 })
    .to(it.wig, { rotation: -strength * 0.8, duration: 0.08 })
    .to(it.wig, { rotation: strength * 0.5, duration: 0.08 })
    .to(it.wig, { rotation: 0, duration: 0.1 });
}

function hop(it: Item, height = 8): void {
  const y0 = it.wig.position.y;
  gsap.killTweensOf(it.wig, 'y');
  gsap
    .timeline()
    .to(it.wig, { y: y0 - height, duration: 0.1, ease: 'power2.out' })
    .to(it.wig, { y: y0, duration: 0.3, ease: 'bounce.out' });
}

function squash(it: Item, amount = 0.14): void {
  gsap.killTweensOf(it.wig.scale);
  gsap.fromTo(it.wig.scale, { x: 1 + amount, y: 1 - amount }, { x: 1, y: 1, duration: 0.45, ease: 'elastic.out(1.1, 0.4)' });
}

function killItemTweens(it: Item): void {
  gsap.killTweensOf([it.view, it.view.scale, it.wig, it.wig.scale, it.body, it.shadow, it.outline]);
}

// ------------------------------------------------------------------------------------------------
// Tray

let trayScaleNow = 1;

function layoutTray(animate: boolean): void {
  const ids = items.filter((it) => !placements[it.idx] && it.view.parent !== dragLayer).map((it) => it.idx);
  let t = tc;
  let pack = packTray(ids, t);
  while (pack.height > trayH - 22 && t > 14) {
    t--;
    pack = packTray(ids, t);
  }
  trayScaleNow = t / c;
  const offY = Math.min(trayOffY, Math.max(0, (trayH - 6 - pack.height) / 2));
  for (const i of ids) {
    const it = items[i];
    const p = pack.pos.get(i)!;
    reparent(it.view, trayItems);
    const x = p.x;
    const y = p.y + offY;
    gsap.killTweensOf(it.view);
    gsap.killTweensOf(it.view.scale);
    if (animate) {
      gsap.to(it.view, { x, y, duration: 0.35, ease: 'power3.out' });
      gsap.to(it.view.scale, { x: trayScaleNow, y: trayScaleNow, duration: 0.3, ease: 'power2.out' });
    } else {
      it.view.position.set(x, y);
      it.view.scale.set(trayScaleNow);
    }
    shadowMode(it, 'tray');
  }
}

/** Put every view where the state says (box spot or rug), e.g. after undo or a resize. */
function syncViews(animate: boolean): void {
  for (const it of items) {
    syncTurn(it, animate);
    const p = placements[it.idx];
    if (!p) continue;
    reparent(it.view, placedLayer);
    const { x, y } = boxCentre(it.idx, p);
    gsap.killTweensOf(it.view);
    gsap.killTweensOf(it.view.scale);
    if (animate) {
      gsap.to(it.view, { x, y, duration: 0.32, ease: 'power3.out' });
      gsap.to(it.view.scale, { x: 1, y: 1, duration: 0.3 });
    } else {
      it.view.position.set(x, y);
      it.view.scale.set(1);
    }
    shadowMode(it, 'box');
  }
  layoutTray(animate);
  drawWarnings();
  updateMeter(animate);
}

// Idle nudge: now and then one waiting item hops ("pick me").
let idleCall: gsap.core.Tween | null = null;
function bumpIdle(): void {
  idleCall?.kill();
  idleCall = gsap.delayedCall(6 + Math.random() * 3, () => {
    const waiting = items.filter((it) => !placements[it.idx] && it.view.parent === trayItems);
    if (!busy && !drag && waiting.length) {
      const it = waiting[Math.floor(Math.random() * waiting.length)];
      hop(it, 6);
      wobble(it, 0.08);
    }
    bumpIdle();
  });
}

// ------------------------------------------------------------------------------------------------
// Ghost preview and rule feedback

interface Cand {
  /** Where the item comes to rest. */
  p: Placement;
  /** Where it was let go (it falls from here to `p`). */
  release: Placement;
  ok: boolean;
  key: string;
}

let lastCandKey = '';

function candidateFor(it: Item): Cand | null {
  const g = boxC.toLocal(it.view.getGlobalPosition());
  const { cols, rows } = level;
  const m = c * 0.55;
  // Above the box counts too: let go over a column and the item drops in.
  const above = c * 3.2;
  if (g.x < bx - m || g.x > bx + cols * c + m || g.y < by - above || g.y > by + rows * c + m) return null;
  const { w, h } = dims(shapeOf(it.idx));
  const x = Math.max(0, Math.min(cols - w, Math.round((g.x - bx) / c - w / 2)));
  const y = Math.max(-h, Math.min(rows - h, Math.round((g.y - by) / c - h / 2)));
  const release = { x, y, r: rot[it.idx] };
  const p = dropFrom(puz, placements, it.idx, release);
  if (!p) return null;
  return { p, release, ok: canPlace(puz, placements, it.idx, p).ok, key: `${p.x},${p.y},${p.r}` };
}

/** Seconds to fall `px` points: a short drop is quick, a long one picks up speed. */
function fallTime(px: number): number {
  return Math.min(0.48, Math.max(0.09, Math.sqrt(Math.max(0, px) / (c * 36))));
}

/** Is placed item j directly or further below the candidate cells (same column)? */
function isBelow(j: number, p: Placement, idx: number): boolean {
  const pj = placements[j];
  if (!pj) return false;
  const mine = cellsAt(puz.pieces[idx], p);
  const theirs = cellsAt(puz.pieces[j], pj);
  return theirs.some(([x, y]) => mine.some(([mx, my]) => mx === x && my < y));
}

function drawGhost(it: Item, cand: Cand | null): void {
  ghostG.clear();
  if (!cand) {
    lastCandKey = '';
    return;
  }
  const chk = canPlace(puz, placements, it.idx, cand.p);
  const fill = chk.ok ? OK_FILL : BAD_FILL;
  const line = chk.ok ? OK_LINE : BAD_LINE;
  const landing = cellsAt(puz.pieces[it.idx], cand.p);
  // Drop guide: a soft strip in each column from where it's let go down to where it lands.
  const fall = cand.p.y - cand.release.y;
  if (fall > 0) {
    const tops = new Map<number, number>();
    for (const [x, y] of landing) tops.set(x, Math.min(tops.get(x) ?? Infinity, y));
    for (const [x, y] of tops) {
      const y0 = Math.max(by, by + (y - fall) * c);
      const y1 = by + y * c;
      if (y1 - y0 > 4) ghostG.roundRect(bx + x * c + c * 0.3, y0, c * 0.4, y1 - y0, c * 0.2).fill({ color: 0xffffff, alpha: 0.22 });
    }
  }
  for (const [x, y] of landing) {
    ghostG
      .roundRect(bx + x * c + 3, by + y * c + 3, c - 6, c - 6, c * 0.16)
      .fill({ color: fill, alpha: 0.38 })
      .stroke({ width: 2.5, color: line, alpha: 0.85 });
  }
  if (!chk.ok) {
    // Mark the cells that break the rule (the space above glass, the missing heavy support).
    for (const [x, y] of chk.cells) {
      const px = bx + x * c + c / 2;
      const py = by + y * c + c / 2;
      const s = c * 0.16;
      ghostG.circle(px, py, s * 1.5).fill({ color: BAD_LINE, alpha: 0.85 });
      ghostG
        .moveTo(px - s * 0.6, py - s * 0.6)
        .lineTo(px + s * 0.6, py + s * 0.6)
        .stroke({ width: 3, color: 0xffffff, cap: 'round' });
      ghostG
        .moveTo(px + s * 0.6, py - s * 0.6)
        .lineTo(px - s * 0.6, py + s * 0.6)
        .stroke({ width: 3, color: 0xffffff, cap: 'round' });
    }
  }
  if (cand.key === lastCandKey) return;
  lastCandKey = cand.key;
  if (chk.ok) {
    snd.tick();
    if (pillMsg && pillMsg !== intro) hidePill();
    return;
  }
  if (chk.reason === 'bounds') {
    sfx.bump();
    haptic.light();
    showPill('Too tall for that spot, it sticks out of the box', true);
  } else if (chk.reason === 'fragile') {
    const onGlass = chk.culprits.some((j) => items[j].fragile && isBelow(j, cand.p, it.idx));
    for (const j of chk.culprits) wobble(items[j], 0.16);
    if (!onGlass) wobble(it, 0.16);
    snd.tinkle();
    haptic.light();
    showPill(onGlass ? 'Nothing can go on top of glass' : 'Glass can’t have anything on top of it', true);
  } else if (chk.reason === 'heavy') {
    for (const j of chk.culprits) wobble(items[j], 0.1);
    sfx.bump();
    haptic.light();
    showPill(it.heavy ? 'Heavy things need the floor or heavy things under them' : 'Only heavy things can hold up something heavy', true);
  }
}

/** Heavy items left without support (only reachable through the hint fallback; a safety net). */
function drawWarnings(): void {
  warnG.clear();
  for (const v of violations(puz, placements)) {
    for (const [x, y] of v.cells) {
      warnG.roundRect(bx + x * c + 4, by + y * c + 4, c - 8, c - 8, c * 0.16).stroke({ width: 3, color: BAD_LINE, alpha: 0.8 });
    }
  }
}

/** Heavy items resting on item `idx`: you can't pull the box out from under the toolbox. */
function heavyOnTop(idx: number): number[] {
  const g = buildGrid(puz, placements);
  const { cols } = level;
  const out = new Set<number>();
  placements.forEach((p, j) => {
    if (!p || j === idx || !puz.pieces[j].heavy) return;
    for (const [x, y] of cellsAt(puz.pieces[j], p)) if (g[(y + 1) * cols + x] === idx) out.add(j);
  });
  return [...out];
}

function blockedByHeavy(it: Item): boolean {
  const blockers = heavyOnTop(it.idx);
  if (!blockers.length) return false;
  for (const j of blockers) wobble(items[j], 0.12);
  wobble(it, 0.08);
  sfx.bump();
  haptic.fail();
  showPill('Lift the heavy thing off first', true);
  return true;
}

// ------------------------------------------------------------------------------------------------
// Drag and drop

interface Drag {
  it: Item;
  pid: number;
  sx: number;
  sy: number;
  lx: number;
  ly: number;
  started: boolean;
  from: Placement | null;
  snap: Snap;
  offX: number;
  offY: number;
  lift: { v: number };
  vx: number;
  /** Did lifting this item let other things fall? */
  fell: boolean;
}

let drag: Drag | null = null;

app.stage.eventMode = 'static';
app.stage.hitArea = app.screen;

function rootPoint(e: FederatedPointerEvent): { x: number; y: number } {
  const p = root.toLocal(e.global);
  return { x: p.x, y: p.y };
}

function onItemDown(it: Item, e: FederatedPointerEvent): void {
  if (busy || !ready || drag) return; // a second finger is handled by the stage (turns the dragged item)
  if (e.button === 2) return;
  const p = rootPoint(e);
  drag = {
    it,
    pid: e.pointerId,
    sx: p.x,
    sy: p.y,
    lx: p.x,
    ly: p.y,
    started: false,
    from: placements[it.idx],
    snap: snapshot(),
    offX: 0,
    offY: 0,
    lift: { v: 0 },
    vx: 0,
    fell: false,
  };
  gsap.to(it.wig.scale, { x: 0.94, y: 0.94, duration: 0.08 });
  bumpIdle();
}

function beginDrag(d: Drag, e: FederatedPointerEvent): void {
  const it = d.it;
  if (d.from && blockedByHeavy(it)) {
    gsap.to(it.wig.scale, { x: 1, y: 1, duration: 0.3, ease: 'back.out(3)' });
    drag = null;
    return;
  }
  d.started = true;
  stopDemo();
  placements[it.idx] = null;
  reparent(it.view, dragLayer);
  // Whatever rested on it drops down into the gap.
  if (d.from) d.fell = applySettle() > 0;
  const s0 = it.view.scale.x;
  const s1 = 1.06;
  d.offX = ((it.view.x - d.lx) * s1) / s0;
  d.offY = ((it.view.y - d.ly) * s1) / s0;
  // Re-centre the grab a bit so big items don't hang off the finger.
  gsap.to(d, { offX: d.offX * 0.5, offY: d.offY * 0.5, duration: 0.2 });
  if (e.pointerType === 'touch') gsap.to(d.lift, { v: LIFT_TOUCH, duration: 0.18, ease: 'power2.out' });
  gsap.killTweensOf(it.view);
  gsap.killTweensOf(it.view.scale);
  gsap.to(it.view.scale, { x: s1, y: s1, duration: 0.16, ease: 'back.out(2)' });
  gsap.to(it.wig.scale, { x: 1, y: 1, duration: 0.15 });
  it.outline.visible = true;
  it.outline.alpha = 0;
  gsap.to(it.outline, { alpha: 1, duration: 0.15 });
  shadowMode(it, 'lift');
  it.view.cursor = 'grabbing';
  snd.pick();
  haptic.light();
  if (!d.from) layoutTray(true);
  else refreshFullRows(); // so finishing that row again earns another "Snug!"
  drawWarnings();
  updateMeter();
}

function moveDrag(d: Drag): void {
  const it = d.it;
  const nx = d.lx + d.offX;
  const ny = d.ly + d.offY - d.lift.v;
  d.vx = d.vx * 0.7 + (nx - it.view.x) * 0.3;
  it.view.position.set(nx, ny);
  it.wig.rotation = Math.max(-0.22, Math.min(0.22, d.vx * 0.012));
  drawGhost(it, candidateFor(it));
}

/** Keep the ghost and tilt alive while the finger rests (the lift and re-centre tweens still move it). */
app.ticker.add(() => {
  if (drag?.started) moveDrag(drag);
});

function endDrag(d: Drag): void {
  drag = null;
  const it = d.it;
  if (!d.started) {
    gsap.to(it.wig.scale, { x: 1, y: 1, duration: 0.35, ease: 'elastic.out(1.2, 0.5)' });
    onTap(it);
    return;
  }
  gsap.killTweensOf(d);
  gsap.killTweensOf(d.lift);
  it.view.cursor = 'grab';
  gsap.to(it.wig, { rotation: 0, duration: 0.25 });
  gsap.to(it.outline, { alpha: 0, duration: 0.15, onComplete: () => void (it.outline.visible = false) });
  const cand = candidateFor(it);
  ghostG.clear();
  lastCandKey = '';
  if (cand && cand.ok) {
    const same = !d.fell && d.from && d.from.x === cand.p.x && d.from.y === cand.p.y && d.from.r === cand.p.r;
    if (!same) {
      pushUndo(d.snap);
      moves++;
      dismissIntro();
    }
    placements[it.idx] = cand.p;
    flyIntoBox(it, cand.p, !same);
    return;
  }
  const home = d.from;
  if (cand && home && canPlace(puz, placements, it.idx, home).ok && dropFrom(puz, placements, it.idx, home)?.y === home.y) {
    // Not allowed here: hop back to its old spot in the box (if nothing fell into it), facing the way it was.
    if (d.fell) {
      // Things fell while it was out, so the box did change: keep that undoable.
      pushUndo(d.snap);
      moves++;
    }
    placements[it.idx] = home;
    rot[it.idx] = home.r;
    syncTurn(it, true);
    reparent(it.view, placedLayer);
    const { x, y } = boxCentre(it.idx, home);
    gsap.to(it.view, { x, y, duration: 0.3, ease: 'back.out(1.6)' });
    gsap.to(it.view.scale, { x: 1, y: 1, duration: 0.25 });
    shadowMode(it, 'box');
    sfx.error();
    haptic.fail();
    updateMeter();
    drawWarnings();
    return;
  }
  // Back to the rug: dropped outside the box, or on a spot that breaks a rule.
  if (cand) {
    sfx.error();
    haptic.fail();
  }
  sfx.whoosh();
  if (d.from) {
    pushUndo(d.snap);
    moves++;
  }
  layoutTray(true);
  updateMeter();
  drawWarnings();
}

function rotateDragged(): void {
  if (!drag || !drag.started || !level.rotate) return;
  const it = drag.it;
  rot[it.idx] = (rot[it.idx] + 1) % 4;
  syncTurn(it, true);
  snd.turn();
  haptic.light();
  lastCandKey = '';
  drawGhost(it, candidateFor(it));
  dismissTurnDemo();
}

app.stage.on('pointerdown', (e: FederatedPointerEvent) => {
  if (drag && drag.started && e.pointerId !== drag.pid) rotateDragged();
});
app.stage.on('globalpointermove', (e: FederatedPointerEvent) => {
  const d = drag;
  if (!d || e.pointerId !== d.pid) return;
  const p = rootPoint(e);
  d.lx = p.x;
  d.ly = p.y;
  if (!d.started && Math.hypot(p.x - d.sx, p.y - d.sy) > 6) beginDrag(d, e);
  if (drag === d && d.started) moveDrag(d);
});
const onUp = (e: FederatedPointerEvent) => {
  const d = drag;
  if (!d || e.pointerId !== d.pid) return;
  endDrag(d);
};
app.stage.on('pointerup', onUp);
app.stage.on('pointerupoutside', onUp);
app.stage.on('pointercancel', onUp);
// Fallback: a release the stage never sees (pointer left the window, OS gesture) still drops.
window.addEventListener('pointerup', (e) => {
  const d = drag;
  if (!d || e.pointerId !== d.pid) return;
  requestAnimationFrame(() => {
    if (drag === d) endDrag(d);
  });
});
window.addEventListener('blur', () => {
  if (drag) endDrag(drag);
});
let lastWheel = 0;
window.addEventListener('wheel', () => {
  if (performance.now() - lastWheel < 180) return;
  lastWheel = performance.now();
  rotateDragged();
});
window.addEventListener('keydown', (e) => {
  if ((e.key === 'r' || e.key === 'R' || e.key === ' ') && drag?.started) {
    e.preventDefault();
    rotateDragged();
  } else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    undo();
  }
});

// ------------------------------------------------------------------------------------------------
// Landing in the box

function flyIntoBox(it: Item, p: Placement, counted: boolean, fromHint = false): void {
  reparent(it.view, placedLayer);
  const { x, y } = boxCentre(it.idx, p);
  gsap.killTweensOf(it.view);
  gsap.killTweensOf(it.view.scale);
  const done = () => land(it, counted || fromHint);
  if (fromHint) {
    // Glide over its column, hang there a beat, then let go.
    const { h } = dims(shapeOf(it.idx));
    const top = Math.min(it.view.y, by - (h * c) / 2 - c * 0.35);
    gsap.to(it.view.scale, { x: 1, y: 1, duration: 0.45, ease: 'power2.out' });
    gsap
      .timeline()
      .to(it.view, { x, y: top, duration: 0.45, ease: 'power3.inOut' })
      .to(it.view, { y, duration: fallTime(y - top), ease: 'power2.in', onComplete: done }, '+=0.08');
  } else {
    // Snap over the column, then fall: the longer the drop, the faster it lands.
    const dy = y - it.view.y;
    gsap.to(it.view.scale, { x: 1, y: 1, duration: 0.12, ease: 'power2.out' });
    gsap.to(it.view, { x, duration: 0.09, ease: 'power2.out' });
    gsap.to(it.view, { y, duration: dy > 0 ? fallTime(dy) : 0.12, ease: dy > 0 ? 'power2.in' : 'power2.out', onComplete: done });
  }
  shadowMode(it, 'box');
  drawWarnings();
  updateMeter();
  checkWin();
}

const rowWasFull = new Set<number>();

function land(it: Item, counted: boolean): void {
  if (it.view.destroyed) return;
  const p = placements[it.idx];
  if (!p) return;
  squash(it, it.heavy ? 0.2 : 0.13);
  const { w, h } = dims(shapeOf(it.idx));
  const bottom = it.view.y + (h * c) / 2;
  for (const side of [-1, 1]) {
    const pt = toFx(placedLayer, it.view.x + side * (w * c) * 0.42, bottom - 3);
    burst(fxLayer, pt.x, pt.y, { colors: [0xf6ecd9, 0xe3d0ae, 0xffffff], count: 5, speed: 20 + w * 4, size: 3.5, duration: 0.45 });
  }
  if (it.heavy) {
    sfx.thud();
    shake(boxC, 3.5, 0.22);
    haptic.heavy();
  } else {
    snd.land();
    haptic.medium();
  }
  if (it.fragile) snd.tinkle();
  if (!counted) return;
  const total = totalCells();
  const filled = filledNow();
  // Pentatonic pop that climbs as the box fills.
  sfx.pop(Math.round((filled / total) * 9));
  punch(meter, 0.08, 0.3);
  // "Snug!" for each row this item completed.
  const g = buildGrid(puz, placements);
  const rows = new Set(cellsAt(puz.pieces[it.idx], p).map(([, y]) => y));
  let k = 0;
  for (const row of [...rows].sort((a, b) => b - a)) {
    if (!rowFull(g, row) || rowWasFull.has(row)) continue;
    rowWasFull.add(row);
    if (filled === total) continue; // the win sequence has its own fanfare
    const flash = new Graphics()
      .roundRect(bx + 2, by + row * c + 2, level.cols * c - 4, c - 4, 8)
      .fill({ color: 0xffffff, alpha: 0.55 });
    flash.blendMode = 'add';
    flash.eventMode = 'none';
    boxC.addChild(flash);
    gsap.to(flash, { alpha: 0, duration: 0.5, delay: k * 0.1, onComplete: () => flash.destroy() });
    const pt = toFx(boxC, bx + level.cols * c - c * 0.6, by + row * c + c * 0.3);
    floatText(fxLayer, pt.x, pt.y, 'Snug!', 0xffffff, 20);
    sfx.pluck(6 + k);
    k++;
  }
  refreshFullRows();
}

/** Let whatever lost its support fall, each landing with its own thud. Returns how many fell. */
function applySettle(): number {
  const { placements: next, falls } = settle(puz, placements);
  if (!falls.length) return 0;
  placements = next;
  falls
    .sort((a, b) => b.to.y - a.to.y)
    .forEach((f, k) => {
      const it = items[f.idx];
      const { x, y } = boxCentre(f.idx, f.to);
      gsap.killTweensOf(it.view);
      gsap.to(it.view, {
        x,
        y,
        duration: fallTime(y - it.view.y),
        delay: 0.03 + k * 0.04,
        ease: 'power2.in',
        onComplete: () => land(it, false),
      });
    });
  refreshFullRows();
  drawWarnings();
  updateMeter();
  const bad = violations(puz, placements);
  if (bad.length) {
    for (const v of bad) gsap.delayedCall(0.3, () => wobble(items[v.idx], 0.16));
    const glass = bad.some((v) => v.reason === 'fragile');
    gsap.delayedCall(0.25, () => {
      if (glass) snd.tinkle();
      showPill(glass ? 'Uh-oh, something fell onto the glass' : 'Something heavy fell onto a light thing', true);
    });
  }
  return falls.length;
}

function refreshFullRows(): void {
  rowWasFull.clear();
  const g = buildGrid(puz, placements);
  for (let y = 0; y < level.rows; y++) if (rowFull(g, y)) rowWasFull.add(y);
}

// ------------------------------------------------------------------------------------------------
// Tap: turn (rotation rooms) or a friendly hop

function onTap(it: Item): void {
  const p = placements[it.idx];
  if (!level.rotate) {
    hop(it);
    sfx.tap();
    if (!p) showPill('Drag it into the box', false, 1.8);
    return;
  }
  if (!p) {
    rot[it.idx] = (rot[it.idx] + 1) % 4;
    syncTurn(it, true);
    it.wig.scale.set(1);
    punch(it.wig, 0.08, 0.3);
    snd.turn();
    haptic.light();
    layoutTray(true);
    dismissTurnDemo();
    return;
  }
  // In the box: turn around its centre if there's room.
  if (blockedByHeavy(it)) return;
  const nr = (p.r + 1) % 4;
  const old = dims(orient(puz.pieces[it.idx].cells, p.r));
  const nd = dims(orient(puz.pieces[it.idx].cells, nr));
  const x0 = Math.round(p.x + old.w / 2 - nd.w / 2);
  const y0 = Math.round(p.y + old.h / 2 - nd.h / 2);
  placements[it.idx] = null;
  let found: Placement | null = null;
  for (const [dx, dy] of [
    [0, 0],
    [0, 1],
    [-1, 0],
    [1, 0],
    [0, -1],
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ]) {
    const q = { x: x0 + dx, y: y0 + dy, r: nr };
    const raw = canPlace(puz, placements, it.idx, q);
    if (!raw.ok && (raw.reason === 'overlap' || raw.reason === 'bounds')) continue;
    // Turned, it may drop a little to rest on what's below.
    const to = dropFrom(puz, placements, it.idx, q);
    if (to && canPlace(puz, placements, it.idx, to).ok) {
      found = to;
      break;
    }
  }
  if (!found) {
    placements[it.idx] = p;
    wobble(it, 0.12);
    sfx.error();
    haptic.fail();
    showPill('No room to turn it here', true, 1.8);
    return;
  }
  const snap = snapshot();
  snap.placements[it.idx] = p;
  pushUndo(snap);
  moves++;
  placements[it.idx] = found;
  rot[it.idx] = nr;
  syncTurn(it, true);
  snd.turn();
  haptic.light();
  const { x, y } = boxCentre(it.idx, found);
  gsap.to(it.view, { x, y, duration: 0.22, ease: 'back.out(1.6)' });
  dismissTurnDemo();
  applySettle();
  drawWarnings();
  refreshFullRows();
  updateMeter();
  checkWin();
}

// ------------------------------------------------------------------------------------------------
// Undo, restart, hint

function snapshot(): Snap {
  return { placements: placements.map((p) => (p ? { ...p } : null)), rot: rot.slice(), moves };
}

function pushUndo(s: Snap): void {
  undoStack.push(s);
  if (undoStack.length > 80) undoStack.shift();
}

function undo(): void {
  if (busy || drag || !ready) return;
  const s = undoStack.pop();
  if (!s) {
    sfx.bump();
    punch(undoBtn, 0.1, 0.3);
    return;
  }
  placements = s.placements;
  rot = s.rot;
  // Undo gives the move back too, so trying things never costs a star.
  moves = s.moves;
  sfx.whoosh();
  haptic.light();
  syncViews(true);
  refreshFullRows();
}

function restartRoom(): void {
  if (busy || !ready) return;
  if (drag) endDrag(drag);
  placements = placements.map(() => null);
  rot = rot.map(() => 0);
  undoStack = [];
  moves = 0;
  hints = 0;
  rowWasFull.clear();
  sfx.whoosh();
  syncViews(true);
}

function bottomRow(i: number, p: Placement): number {
  return Math.max(...cellsAt(puz.pieces[i], p).map((q) => q[1]));
}

function useHint(): void {
  if (busy || drag || !ready) return;
  const missing = () => items.filter((it) => !placements[it.idx]).map((it) => it.idx);
  // Lowest first, the way a person packs: whatever goes on the floor of the box.
  const pick = (target: Placement[]): number => {
    const order = missing().sort((a, b) => bottomRow(b, target[b]) - bottomRow(a, target[a]) || a - b);
    return (
      order.find((i) => canPlace(puz, placements, i, target[i]).ok && dropFrom(puz, placements, i, target[i])?.y === target[i].y) ??
      -1
    );
  };
  const before = snapshot();
  // 1. Keep the player's arrangement if it can still be finished.
  const res = solve(puz, { fixed: placements, limit: 1, nodeLimit: 200_000 });
  let target: Placement[] = res.first ?? solutionOf(level);
  let idx = res.first ? pick(target) : -1;
  let cleared = false;
  if (idx < 0) {
    // 2. Otherwise follow the stored solution: take out what doesn't belong there.
    target = solutionOf(level);
    const sol = target;
    placements = placements.map((p, i) => (p && p.x === sol[i].x && p.y === sol[i].y && p.r === sol[i].r ? p : null));
    for (let guard = 0; guard < 20; guard++) {
      // Out with rule breakers and with anything that would be left hanging in the air.
      const bad = violations(puz, placements).map((v) => v.idx);
      const loose = placements.map((q, i) => (q && !isSupported(puz, placements, i) ? i : -1)).filter((i) => i >= 0);
      if (!bad.length && !loose.length) break;
      for (const i of [...bad, ...loose]) placements[i] = null;
    }
    cleared = placements.some((p, i) => !p && before.placements[i]);
    idx = pick(target);
    if (idx < 0) {
      placements = placements.map(() => null);
      cleared = true;
      idx = pick(target);
    }
  }
  if (idx < 0) {
    placements = before.placements;
    return;
  }
  pushUndo(before);
  hints++;
  dismissIntro();
  stopDemo();
  dismissTurnDemo();
  const p = target[idx];
  rot = rot.map((r, i) => placements[i]?.r ?? r);
  rot[idx] = p.r;
  placements[idx] = p;
  if (cleared) {
    showPill('Some things had to come out again', false, 2.2);
    syncViews(true);
  }
  const it = items[idx];
  syncTurn(it, true);
  sfx.sparkle();
  haptic.medium();
  const pt = fxLayer.toLocal(it.view.getGlobalPosition());
  burst(fxLayer, pt.x, pt.y, { shape: 'star', colors: [0xffd166, 0xffffff, 0xffe8a3], count: 10, speed: 50, size: 5 });
  flyIntoBox(it, p, false, true);
  gsap.delayedCall(0.46, () => {
    if (it.view.destroyed) return;
    const q = boxCentre(idx, p);
    const t = toFx(placedLayer, q.x, q.y);
    burst(fxLayer, t.x, t.y, { shape: 'star', colors: [0xffd166, 0xffffff, 0xffe8a3], count: 14, speed: 70, size: 5 });
  });
  layoutTray(true);
  if (hints <= 2) floatText(uiLayer, hintBtn.x, hintBtn.y - 44, '−★', 0xffd166, 22);
  refreshFullRows();
  updateMeter();
}

// ------------------------------------------------------------------------------------------------
// Tutorials

let demo: { hand: TapHand; ghost: Container; tl: gsap.core.Timeline } | null = null;
let turnHand: TapHand | null = null;

/** Room 1: a ghost of the first item glides from the rug into its spot, with the hand pushing it. */
function startDragDemo(): void {
  const sol = solutionOf(level);
  const idx = items
    .map((it) => it.idx)
    .sort((a, b) => bottomRow(b, sol[b]) - bottomRow(a, sol[a]) || puz.pieces[b].cells.length - puz.pieces[a].cells.length)[0];
  const it = items[idx];
  const ghost = new Container();
  const spr = new Sprite(it.sprite.texture);
  spr.anchor.set(0.5);
  spr.scale.set(c / CELL);
  spr.rotation = it.body.rotation;
  ghost.addChild(spr);
  ghost.alpha = 0;
  const from = fxLayer.toLocal(it.view.getGlobalPosition());
  const toBox = boxCentre(idx, sol[idx]);
  const to = toFx(boxC, toBox.x, toBox.y);
  const { h } = dims(orient(puz.pieces[idx].cells, sol[idx].r));
  const over = toFx(boxC, toBox.x, by - (h * c) / 2 - c * 0.5);
  const hand = new TapHand(from.x, from.y);
  hand.alpha = 0;
  fxLayer.addChild(ghost, hand);
  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6, delay: 0.6 });
  tl.set([ghost, hand], { x: from.x, y: from.y })
    .set(ghost.scale, { x: trayScaleNow, y: trayScaleNow })
    .to(hand, { alpha: 1, duration: 0.25 })
    .to(ghost, { alpha: 0.6, duration: 0.2 }, '+=0.45')
    .to([ghost, hand], { x: over.x, y: over.y, duration: 1.0, ease: 'power2.inOut' })
    .to(ghost.scale, { x: 1, y: 1, duration: 1.0, ease: 'power2.inOut' }, '<')
    // Let go: the hand stays, the item drops into the box.
    .to(hand, { y: over.y - 10, duration: 0.18, ease: 'power2.out' }, '+=0.2')
    .to(ghost, { y: to.y, duration: 0.34, ease: 'power2.in' }, '<')
    .to(ghost.scale, { x: 1.12, y: 0.88, duration: 0.06 })
    .to(ghost.scale, { x: 1, y: 1, duration: 0.3, ease: 'elastic.out(1.1, 0.4)' })
    .to([ghost, hand], { alpha: 0, duration: 0.3 }, '+=0.4');
  demo = { hand, ghost, tl };
}

function stopDemo(): void {
  if (!demo) return;
  demo.tl.kill();
  demo.hand.destroy();
  demo.ghost.destroy({ children: true });
  demo = null;
}

function startTurnDemo(): void {
  const it = items.find((x) => !placements[x.idx]);
  if (!it) return;
  const g = fxLayer.toLocal(it.view.getGlobalPosition());
  turnHand = new TapHand(g.x + 6, g.y + 4);
  fxLayer.addChild(turnHand);
}

function dismissTurnDemo(): void {
  if (!turnHand) return;
  turnHand.destroy();
  turnHand = null;
  dismissIntro();
}

// ------------------------------------------------------------------------------------------------
// Level flow

async function startLevel(i: number, slide: boolean): Promise<void> {
  busy = true;
  ready = false;
  li = Math.max(0, Math.min(LEVELS.length - 1, Math.floor(i)));
  level = LEVELS[li];
  puz = puzzleOf(level);
  theme = THEMES[level.theme];
  save('moving:level', li);
  await loadTextures(level);

  stopDemo();
  if (turnHand) {
    turnHand.destroy();
    turnHand = null;
  }
  hidePill();
  intro = null;
  for (const it of items) {
    killItemTweens(it);
    it.view.destroy({ children: true });
  }
  items = [];
  stampC.removeChildren().forEach((ch) => ch.destroy({ children: true }));
  tapeG.clear();
  ghostG.clear();
  warnG.clear();
  gsap.killTweensOf(boxC);
  gsap.killTweensOf(boxC.pivot);
  boxC.pivot.set(0, 0);

  placements = puz.pieces.map(() => null);
  rot = puz.pieces.map(() => 0);
  undoStack = [];
  moves = 0;
  hints = 0;
  rowWasFull.clear();

  computeLayout();
  paintRoom(slide);
  drawBox();
  trayC.y = trayTop;
  drawRug();
  layoutControls();
  bar.set(level.room, `Room ${li + 1} of ${LEVELS.length}`);

  items = puz.pieces.map((_, k) => makeItem(k));
  for (const it of items) trayItems.addChild(it.view);
  layoutTray(false);
  updateMeter(false);

  // Box slides in, items pop onto the rug one by one.
  if (slide) {
    boxC.x = W;
    gsap.to(boxC, { x: 0, duration: 0.55, ease: 'power3.out' });
    sfx.whoosh();
  } else boxC.x = 0;
  items.forEach((it, k) => {
    const s = it.view.scale.x;
    it.view.scale.set(0);
    gsap.to(it.view.scale, {
      x: s,
      y: s,
      duration: 0.4,
      delay: 0.25 + k * 0.06,
      ease: 'back.out(2.2)',
      onStart: () => sfx.pop(Math.min(9, k)),
    });
  });
  await wait(0.35 + items.length * 0.06);

  busy = false;
  ready = true;
  updateMeter(false);
  if (level.intro) {
    intro = level.intro;
    showPill(intro, false, 0);
  }
  if (li === 0) startDragDemo();
  if (level.rotate && level.intro?.includes('turn')) startTurnDemo();
  // Introduce the stickers with a little performance.
  if (level.intro) {
    items.forEach((it, k) => {
      if (it.fragile)
        gsap.delayedCall(0.2 + k * 0.08, () => {
          if (it.view.destroyed) return;
          wobble(it, 0.16);
          snd.tinkle();
        });
      if (it.heavy)
        gsap.delayedCall(0.2 + k * 0.08, () => {
          if (it.view.destroyed) return;
          const y0 = it.wig.position.y;
          gsap
            .timeline()
            .to(it.wig, { y: y0 - 10, duration: 0.14, ease: 'power2.out' })
            .to(it.wig, {
              y: y0,
              duration: 0.12,
              ease: 'power2.in',
              onComplete: () => {
                squash(it, 0.2);
                sfx.thud();
              },
            });
        });
    });
  }
  bumpIdle();
}

function checkWin(): void {
  if (busy || !placements.every((p) => p) || violations(puz, placements).length) return;
  busy = true;
  void winSequence();
}

function starsNow(): number {
  return Math.max(1, 3 - Math.min(hints, 2) - (moves > par() ? 1 : 0));
}

async function winSequence(): Promise<void> {
  hidePill();
  intro = null;
  stopDemo();
  dismissTurnDemo();
  idleCall?.kill();
  updateMeter();
  await wait(0.4);

  // A little hop wave across the packed items.
  const packed = [...items].sort((a, b) => a.view.x - b.view.x);
  packed.forEach((it, k) => {
    gsap.delayedCall(k * 0.05, () => {
      hop(it, 7);
      sfx.pluck(Math.min(10, k));
    });
  });
  await wait(0.35 + packed.length * 0.05);

  // Flaps swing shut.
  sfx.whoosh();
  for (const [flap, delay] of [
    [flapL, 0],
    [flapR, 0.07],
  ] as const) {
    const s = { v: flap.scale.x };
    gsap.to(s, { v: 1, duration: 0.5, delay, ease: 'back.out(1.7)', onUpdate: () => setFlap(flap, s.v) });
  }
  await wait(0.42);
  sfx.thud();
  haptic.medium();
  shake(boxC, 3, 0.2);
  await wait(0.2);

  // Tape runs down the seam.
  const oy = by - WALL;
  const ow = level.cols * c + WALL * 2;
  const oh = level.rows * c + WALL * 2;
  const tw = Math.max(26, Math.min(40, ow * 0.13));
  const tx = bx - WALL + ow / 2;
  const len = oh + 16;
  const pts = [-tw / 2, 0, tw / 2, 0];
  for (let k = 6; k >= 0; k--) pts.push(-tw / 2 + (tw * k) / 6, len + (k % 2 ? 5 : 0));
  tapeG.clear();
  tapeG.position.set(tx, oy - 8);
  tapeG.poly(pts).fill({ color: 0xe0bb7d, alpha: 0.95 });
  tapeG.rect(-tw / 2 + 4, 0, 3, len).fill({ color: 0xffffff, alpha: 0.35 });
  tapeG.rect(tw / 2 - 6, 0, 2, len).fill({ color: 0x000000, alpha: 0.08 });
  tapeG.scale.y = 0;
  snd.rip();
  await new Promise<void>((done) => gsap.to(tapeG.scale, { y: 1, duration: 0.42, ease: 'power2.out', onComplete: done }));

  // Stamp.
  const stamp = new Container();
  const label = text('ROOM', 30, 0xd62828, 700);
  label.anchor.set(0, 0.5);
  const check = new Graphics()
    .moveTo(0, 0)
    .lineTo(9, 10)
    .lineTo(26, -12)
    .stroke({ width: 7, color: 0xd62828, cap: 'round', join: 'round' });
  const sw = label.width + 46;
  label.x = -sw / 2 + 4;
  check.position.set(sw / 2 - 30, 0);
  const frame = new Graphics()
    .roundRect(-sw / 2 - 8, -30, sw + 16, 60, 12)
    .stroke({ width: 4, color: 0xd62828 })
    .roundRect(-sw / 2 - 2, -24, sw + 4, 48, 8)
    .stroke({ width: 2, color: 0xd62828 });
  stamp.addChild(frame, label, check);
  stamp.rotation = -0.2;
  stamp.position.set(tx, oy + Math.min(oh * 0.62, oh - 50));
  stamp.scale.set(2.4);
  stamp.alpha = 0;
  stampC.addChild(stamp);
  gsap.to(stamp, { alpha: 0.92, duration: 0.12 });
  await new Promise<void>((done) =>
    gsap.to(stamp.scale, { x: 1, y: 1, duration: 0.2, ease: 'power3.in', onComplete: done }),
  );
  snd.stamp();
  haptic.heavy();
  shake(boxC, 5, 0.25);
  const sp = toFx(boxC, stamp.x, stamp.y);
  burst(fxLayer, sp.x, sp.y, { colors: [0xd62828, 0xef476f], count: 10, speed: 70, size: 3 });

  confetti(fxLayer, W, H, 80);
  sfx.win();
  haptic.success();

  const stars = starsNow();
  const best = load<number[]>('moving:stars', []);
  best[li] = Math.max(best[li] ?? 0, stars);
  save('moving:stars', best);
  await wait(0.75);

  const last = li === LEVELS.length - 1;
  showResult(overlay, W, H, {
    win: true,
    title: `${level.room} packed!`,
    stars,
    body: resultBody(stars),
    accent: theme.accent,
    primary: { label: last ? 'Finish' : 'Next room', onTap: () => (last ? showFinal() : void leaveRoom(li + 1)) },
    secondary: { label: 'Replay room', onTap: () => void leaveRoom(li) },
  });
}

function resultBody(stars: number): string {
  const p = par();
  if (stars === 3) return `${moves} moves (par ${p}), no hints.\nPerfectly packed!`;
  const why: string[] = [];
  why.push(moves > p ? `${moves} moves, over par ${p}: −1 star.` : `${moves} moves, within par ${p}.`);
  if (hints > 0) why.push(`${hints} ${hints === 1 ? 'hint' : 'hints'}: −${Math.min(hints, 2)} ${hints === 1 ? 'star' : 'stars'}.`);
  return why.join('\n');
}

async function leaveRoom(next: number): Promise<void> {
  busy = true;
  sfx.whoosh();
  await new Promise<void>((done) => gsap.to(boxC, { x: -W, duration: 0.45, ease: 'power3.in', onComplete: done }));
  await startLevel(next, true);
}

function showFinal(): void {
  const best = load<number[]>('moving:stars', []);
  const total = LEVELS.reduce((n, _, k) => n + (best[k] ?? 0), 0);
  const max = LEVELS.length * 3;
  confetti(fxLayer, W, H, 60);
  sfx.win();
  showResult(overlay, W, H, {
    win: true,
    title: 'You finished the demo!',
    stars: total >= max ? 3 : total >= max * 0.7 ? 2 : 1,
    body: `All ${LEVELS.length} rooms packed, ${total} of ${max} stars.\nThanks for helping with the move!`,
    accent: 0xe07a5f,
    primary: { label: 'Replay from room 1', onTap: () => void leaveRoom(0) },
  });
}

// ------------------------------------------------------------------------------------------------
// Resize and boot

game.onResize((h) => {
  H = h;
  if (!ready || !items.length) return;
  if (drag) endDrag(drag);
  computeLayout();
  paintRoom(false);
  drawBox();
  trayC.y = trayTop;
  drawRug();
  layoutControls();
  for (const it of items) drawItem(it);
  syncViews(false);
});

startMotes();
const saved = load<number>('moving:level', 0);
await startLevel(Number.isFinite(saved) ? saved : 0, true);
