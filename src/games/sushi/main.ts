/**
 * Sushi Loop renderer. Drives the pure rules in logic.ts tick by tick (the same
 * simulation the solver in logic.test.ts proves) and dresses every event up:
 * seat hops, grabs, coins, the belt meter, the kitchen strip, the takeaway window.
 */
import { Container, Graphics, Rectangle, Sprite, Texture, type Text } from 'pixi.js';
import {
  burst,
  confetti,
  createGame,
  floatText,
  gsap,
  haptic,
  Hint,
  load,
  ring,
  save,
  sfx,
  shade,
  shake,
  showResult,
  starShape,
  TapHand,
  text,
  TopBar,
  W,
} from '../../kit';
import {
  BOX_POS,
  canSeat,
  HATCH_POS,
  newState,
  seat,
  SLOTS,
  slotAt,
  slotPos,
  starsFor,
  step,
  STOOL_POS,
  unwantedSlots,
  wants,
  WARN_AT,
  type DinerSpec,
  type Dish,
  type Ev,
  type OrderItem,
  type Plate,
  type State,
} from './logic.ts';
import { LEVELS } from './levels.ts';
import { DISH_NAME, loadArt, RIM, type Art } from './sprites.ts';

// ---------------------------------------------------------------- layout

/** The board is laid out for a 720-tall screen with the belt's top straight at B0. */
const B0 = 282;
const H0 = 720;
const BELT_X0 = 35;
const BELT_X1 = 355;
const BELT_H = 194.4;
const BELT_R = 40;
const TRACK = 44;
const STRAIGHT = BELT_X1 - BELT_X0 - 2 * BELT_R;
const SIDE = BELT_H - 2 * BELT_R;
const ARC = (Math.PI / 2) * BELT_R;
const PERIM = 2 * STRAIGHT + 2 * SIDE + 4 * ARC;
const SLOT_LEN = PERIM / SLOTS;
const SEAT_Y = B0 - 28; // seated diner's feet (behind the counter)
const SEAT_SCALE = 0.88;
const QY = 698; // queue feet, queue-layer coords
const QX = [52, 132, 212];
const Q4X = 296;
const BENTO = { x: 272, y: B0 + 262 };
const COURIER = { x: 338, y: B0 + 294 };
const PILL = { x: 64, y: B0 + 262 };
const METER = { x: 76, y: B0 + 52, w: 238, h: 12 };
const STRIP_X = [144, 117, 90];
const STRIP_Y = B0 + 110;
const CHEF = { x: 198, y: B0 + 166 };
const CHEF_SCALE = 0.86;
const POT = { x: 290, y: B0 + 150 };

const C = {
  bg: 0xffe8d6,
  ink: 0x5a3a2a,
  wood: 0xc98a55,
  woodLight: 0xdda36d,
  woodDark: 0xa8693b,
  track: 0x6f7d8c,
  trackEdge: 0x56626f,
  island: 0xf6d6ab,
  lip: 0xe0b07a,
  shoji: 0xfff7ec,
  shojiLine: 0xe9cfb2,
  floor: 0xf3caa6,
  floorLine: 0xe8b88f,
  green: 0x4cb35a,
  amber: 0xffa62b,
  red: 0xef4b4b,
  orange: 0xff7a45,
};

interface Pt {
  x: number;
  y: number;
  a: number;
}

/** Point on the belt centreline at distance d (clockwise from the top-left end of the top straight). */
function pathAt(d: number): Pt {
  d = ((d % PERIM) + PERIM) % PERIM;
  const L = BELT_X0 + BELT_R;
  const R = BELT_X1 - BELT_R;
  const T = B0;
  const Bt = B0 + BELT_H;
  const arc = (cx: number, cy: number, a0: number, t: number): Pt => {
    const a = a0 + t / BELT_R;
    return { x: cx + Math.cos(a) * BELT_R, y: cy + Math.sin(a) * BELT_R, a: a + Math.PI / 2 };
  };
  if (d < STRAIGHT) return { x: L + d, y: T, a: 0 };
  d -= STRAIGHT;
  if (d < ARC) return arc(R, T + BELT_R, -Math.PI / 2, d);
  d -= ARC;
  if (d < SIDE) return { x: BELT_X1, y: T + BELT_R + d, a: Math.PI / 2 };
  d -= SIDE;
  if (d < ARC) return arc(R, Bt - BELT_R, 0, d);
  d -= ARC;
  if (d < STRAIGHT) return { x: R - d, y: Bt, a: Math.PI };
  d -= STRAIGHT;
  if (d < ARC) return arc(L, Bt - BELT_R, Math.PI / 2, d);
  d -= ARC;
  if (d < SIDE) return { x: BELT_X0, y: Bt - BELT_R - d, a: -Math.PI / 2 };
  d -= SIDE;
  return arc(L, T + BELT_R, Math.PI, d);
}
const posXY = (pos: number) => pathAt(pos * SLOT_LEN);
const STOOL_X = STOOL_POS.map((p) => posXY(p).x);

/** Squash-and-stretch around a fixed base scale (safe to call repeatedly). */
function pop(t: Container, base = 1, amt = 0.18, dur = 0.35): void {
  gsap.killTweensOf(t.scale);
  gsap.fromTo(t.scale, { x: base * (1 + amt), y: base * (1 - amt * 0.7) }, { x: base, y: base, duration: dur, ease: 'elastic.out(1.1,0.45)' });
}

// ---------------------------------------------------------------- game + layers

const game = await createGame({ background: '#ffe8d6' });
const art: Art = await loadArt();

const bg = new Graphics();
const top = new Container();
const board = new Container();
const queueLayer = new Container();
const flyLayer = new Container();
const fxLayer = new Container();
const uiLayer = new Container();
game.root.addChild(bg, top, board, queueLayer, flyLayer, fxLayer, uiLayer);

const seatLayer = new Container();
const counterG = new Graphics();
const trackG = new Graphics();
const slatLayer = new Container();
const islandG = new Graphics();
const islandLayer = new Container();
const lipG = new Graphics();
const plateLayer = new Container();
const stackLayer = new Container();
const eatLayer = new Container();
const boothLayer = new Container();
const pillLayer = new Container();
board.addChild(seatLayer, counterG, trackG, slatLayer, islandG, islandLayer, lipG, plateLayer, stackLayer, eatLayer, boothLayer, pillLayer);

// ---------------------------------------------------------------- scenery

function drawBackground(H: number, B: number): void {
  bg.clear();
  bg.rect(0, 0, W, H).fill(C.bg);
  // Shoji screen behind the diners.
  const sy = 118;
  const sh = B - 40 - sy;
  bg.rect(0, sy - 6, W, sh + 6).fill(C.woodDark);
  bg.rect(0, sy, W, sh).fill(C.shoji);
  for (let x = 0; x <= W; x += 39) bg.rect(x - 1, sy, 2, sh).fill(C.shojiLine);
  for (let y = sy + 26; y < sy + sh; y += 26) bg.rect(0, y - 1, W, 2).fill(C.shojiLine);
  for (let x = 0; x <= W; x += 130) bg.rect(x - 3, sy, 6, sh).fill(C.woodLight);
  // Warm plank floor under the counter and the queue.
  const fy = B + 150;
  bg.rect(0, fy, W, H - fy).fill(C.floor);
  for (let y = fy + 34; y < H; y += 34) bg.rect(0, y, W, 2).fill(C.floorLine);
  for (let y = fy, row = 0; y < H; y += 34, row++) {
    for (let x = (row % 2) * 70 + 40; x < W; x += 140) bg.rect(x, y, 2, 34).fill(C.floorLine);
  }
}

// Lantern garland.
const lanterns: Sprite[] = [];
{
  const g = new Graphics();
  g.moveTo(-10, 64).quadraticCurveTo(195, 96, 400, 64).stroke({ width: 2, color: 0x7a4b33 });
  top.addChild(g);
  for (const x of [44, 120, 195, 270, 346]) {
    const t = (x + 10) / 410;
    const y = (1 - t) * (1 - t) * 64 + 2 * (1 - t) * t * 96 + t * t * 64;
    const l = new Sprite(art.lantern);
    l.anchor.set(0.5, 0);
    l.position.set(x, y - 2);
    l.scale.set(0.95);
    top.addChild(l);
    lanterns.push(l);
  }
}

// Counter, belt track, island.
{
  const ox = BELT_X0 - TRACK / 2 - 10;
  const oy = B0 - 40;
  const ow = BELT_X1 - BELT_X0 + TRACK + 20;
  const oh = BELT_H + TRACK / 2 + 40 + 12;
  counterG.roundRect(ox, oy + 8, ow, oh + 8, 72).fill(C.woodDark);
  counterG.roundRect(ox, oy, ow, oh, 72).fill(C.wood);
  counterG.roundRect(ox + 3, oy + 3, ow - 6, oh - 8, 69).fill(C.woodLight);
  counterG.roundRect(ox + 40, oy + 4, ow - 80, 3, 1.5).fill({ color: 0xffffff, alpha: 0.35 });

  const tx = BELT_X0 - TRACK / 2;
  const ty = B0 - TRACK / 2;
  trackG.roundRect(tx - 2, ty - 2, BELT_X1 - BELT_X0 + TRACK + 4, BELT_H + TRACK + 4, BELT_R + TRACK / 2 + 2).fill(C.trackEdge);
  trackG.roundRect(tx, ty, BELT_X1 - BELT_X0 + TRACK, BELT_H + TRACK, BELT_R + TRACK / 2).fill(C.track);

  const ix = BELT_X0 + TRACK / 2;
  const iy = B0 + TRACK / 2;
  const iw = BELT_X1 - BELT_X0 - TRACK;
  const ih = BELT_H - TRACK;
  islandG.roundRect(ix - 2, iy - 2, iw + 4, ih + 4, BELT_R - TRACK / 2 + 2).fill(C.trackEdge);
  islandG.roundRect(ix, iy, iw, ih, BELT_R - TRACK / 2).fill(C.island);
  for (let y = iy + 14; y < iy + ih - 24; y += 16) islandG.rect(ix + 10, y, iw - 20, 1.5).fill({ color: C.lip, alpha: 0.35 });

  // Front lip of the kitchen island: hides the chef's legs.
  lipG.roundRect(ix, B0 + 148, iw, iy + ih - (B0 + 148), 10).fill(C.lip);
  lipG.rect(ix + 8, B0 + 148, iw - 16, 4).fill(shade(C.lip, 0.25));
  // The hatch: a little ramp where the chef slides plates onto the belt.
  const hx = posXY(HATCH_POS).x;
  lipG.roundRect(hx - 22, B0 + 157, 44, 15, 6).fill(shade(C.lip, -0.18));
  lipG.roundRect(hx - 18, B0 + 159, 36, 4, 2).fill({ color: 0xffffff, alpha: 0.25 });
}

// Belt slats: reused sprites moved along the path every frame.
const SLAT_N = 48;
const slats: Sprite[] = [];
for (let i = 0; i < SLAT_N; i++) {
  const s = new Sprite(Texture.WHITE);
  s.anchor.set(0.5);
  s.width = 3;
  s.height = TRACK - 6;
  s.tint = 0xa9b6c3;
  s.alpha = 0.55;
  slatLayer.addChild(s);
  slats.push(s);
}

// Island: belt meter.
const meter = new Container();
const meterFill = new Graphics();
const meterMarks = new Graphics();
const meterCount = text('0 / 16', 13, C.ink, 700);
const peakMark = new Graphics();
{
  const bgG = new Graphics();
  bgG.roundRect(METER.x - 2, METER.y - METER.h / 2 - 2, METER.w + 4, METER.h + 4, METER.h).fill({ color: C.ink, alpha: 0.18 });
  bgG.roundRect(METER.x, METER.y - METER.h / 2, METER.w, METER.h, METER.h / 2).fill(0xfff4e6);
  const label = text('Belt', 12, C.ink, 700);
  label.anchor.set(0, 0.5);
  label.position.set(METER.x, METER.y - 16);
  meterCount.anchor.set(1, 0.5);
  meterCount.position.set(METER.x + METER.w, METER.y - 16);
  peakMark.poly([-4.5, -6, 4.5, -6, 0, 0]).fill(C.ink);
  peakMark.alpha = 0.6;
  meter.addChild(bgG, meterFill, meterMarks, peakMark, label, meterCount);
  meter.pivot.set(METER.x + METER.w / 2, METER.y);
  meter.position.copyFrom(meter.pivot);
  islandLayer.addChild(meter);
}

// Island: coming-up strip.
const strip = new Container();
const stripLabel = text('Coming up', 12, C.ink, 700);
const stripMinis = STRIP_X.map((x) => {
  const sp = new Sprite(art.plate.S);
  sp.anchor.set(0.5);
  sp.position.set(x, STRIP_Y);
  sp.scale.set(26 / 40);
  return sp;
});
const stripMore = text('', 12, C.ink, 700);
{
  stripLabel.anchor.set(0.5);
  stripLabel.position.set(STRIP_X[1], STRIP_Y - 25);
  stripMore.anchor.set(0.5);
  stripMore.position.set(STRIP_X[2] - 22, STRIP_Y);
  stripMore.alpha = 0.7;
  // An arrow pointing at the chef: plates come out in this order.
  const arrow = new Graphics();
  arrow.poly([0, -4, 5, 0, 0, 4]).fill({ color: C.ink, alpha: 0.35 });
  arrow.position.set(STRIP_X[0] + 16, STRIP_Y);
  strip.addChild(stripLabel, arrow, ...stripMinis, stripMore);
  strip.pivot.set(STRIP_X[1], STRIP_Y);
  strip.position.copyFrom(strip.pivot);
  islandLayer.addChild(strip);
}

// Island: chef and stock pot.
const chef = new Sprite(art.chef);
chef.anchor.set(0.5, 1);
chef.position.set(CHEF.x, CHEF.y);
chef.scale.set(CHEF_SCALE);
const sweat = new Graphics();
sweat.moveTo(0, -7).quadraticCurveTo(5, 0, 0, 4).quadraticCurveTo(-5, 0, 0, -7).fill(0x7cc6ff);
sweat.position.set(CHEF.x + 20, CHEF.y - 52);
sweat.visible = false;
const pot = new Sprite(art.pot);
pot.anchor.set(0.5, 1);
pot.position.set(POT.x, POT.y + 4);
const steam: Graphics[] = [];
for (let i = 0; i < 4; i++) steam.push(new Graphics().circle(0, 0, 6).fill(0xffffff));
islandLayer.addChild(chef, sweat, pot, ...steam);

// Coin pill.
const pill = new Container();
const pillCoin = new Sprite(art.coin);
const pillText = text('0', 17, C.ink, 700);
{
  const g = new Graphics();
  g.roundRect(-40, -12, 80, 30, 15).fill({ color: 0x000000, alpha: 0.1 });
  g.roundRect(-40, -15, 80, 30, 15).fill(0xfffaf2);
  pillCoin.anchor.set(0.5);
  pillCoin.position.set(-22, 0);
  pillText.anchor.set(0, 0.5);
  pillText.position.set(-8, 0);
  pill.addChild(g, pillCoin, pillText);
  pill.position.set(PILL.x, PILL.y);
  pillLayer.addChild(pill);
}

// Takeaway shelf (only on levels with boxes).
const shelf = new Container();
{
  const g = new Graphics();
  g.roundRect(BENTO.x - 46, BENTO.y + 22, 92, 10, 4).fill(C.woodDark);
  g.roundRect(BENTO.x - 46, BENTO.y + 20, 92, 6, 3).fill(C.wood);
  g.roundRect(BENTO.x - 35, BENTO.y - 26, 70, 48, 10).stroke({ width: 2, color: C.ink, alpha: 0.2 });
  const t = text('To go', 11, C.ink, 700);
  t.anchor.set(0.5);
  t.alpha = 0.6;
  t.position.set(BENTO.x, BENTO.y + 42);
  shelf.addChild(g, t);
}
boothLayer.addChild(shelf);

// ---------------------------------------------------------------- views

type Eyes = 'open' | 'closed' | 'happy' | 'wide';
type Mouth = 'smile' | 'open' | 'chew' | 'o';

class DinerView {
  root = new Container();
  hop = new Container();
  breathe = new Container();
  face = new Graphics();
  bubble: Bubble;
  stack: Graphics | null = null;
  stackN = 0;
  excited = false;
  private eyes: Eyes = 'open';
  private mouth: Mouth = 'smile';
  private drawn = '';
  private t = Math.random() * 10;
  private blink = 1 + Math.random() * 3;
  private chew = 0;
  private mood = 0;

  constructor(public spec: DinerSpec) {
    const body = new Sprite(spec.kind === 'box' ? art.courier : art.diner[spec.look % art.diner.length]);
    body.anchor.set(0.5, 1);
    this.breathe.addChild(body, this.face);
    if (spec.kind === 'vip') {
      const crown = new Sprite(art.crown);
      crown.anchor.set(0.5, 1);
      crown.position.set(3, -61);
      crown.rotation = 0.12;
      this.breathe.addChild(crown);
    }
    this.hop.addChild(this.breathe);
    this.root.addChild(this.hop);
    this.bubble = new Bubble(spec);
    this.bubble.position.set(0, spec.kind === 'vip' ? -86 : -80);
    this.root.addChild(this.bubble);
    this.redraw();
  }

  nom(): void {
    this.chew = 0.5;
  }
  happy(sec: number): void {
    this.mood = sec;
  }

  update(dt: number): void {
    this.t += dt;
    this.breathe.scale.y = 1 + Math.sin(this.t * 2.4) * 0.018;
    this.blink -= dt;
    if (this.blink < -0.12) this.blink = 2 + Math.random() * 3.5;
    if (this.chew > 0) this.chew -= dt;
    if (this.mood > 0) this.mood -= dt;
    const flip = Math.floor(this.chew * 12) % 2 === 1;
    if (this.mood > 0) {
      this.eyes = 'happy';
      this.mouth = this.chew > 0 ? (flip ? 'chew' : 'smile') : 'open';
    } else if (this.chew > 0) {
      this.eyes = 'happy';
      this.mouth = this.chew > 0.38 ? 'open' : flip ? 'chew' : 'smile';
    } else {
      this.eyes = this.blink < 0 ? 'closed' : this.excited ? 'wide' : 'open';
      this.mouth = this.excited ? 'o' : 'smile';
    }
    this.redraw();
  }

  private redraw(): void {
    const k = this.eyes + this.mouth;
    if (k === this.drawn) return;
    this.drawn = k;
    const g = this.face;
    const ink = 0x3d3a50;
    g.clear();
    g.ellipse(-11.5, -39, 3.6, 2.1).fill({ color: 0xff8a8a, alpha: 0.45 });
    g.ellipse(11.5, -39, 3.6, 2.1).fill({ color: 0xff8a8a, alpha: 0.45 });
    for (const ex of [-6, 6]) {
      if (this.eyes === 'open' || this.eyes === 'wide') {
        const r = this.eyes === 'wide' ? 3 : 2.4;
        g.circle(ex, -45, r).fill(ink);
        g.circle(ex + 0.9, -45.9, r * 0.38).fill(0xffffff);
      } else if (this.eyes === 'closed') {
        g.moveTo(ex - 2.6, -45).lineTo(ex + 2.6, -45).stroke({ width: 2, color: ink, cap: 'round' });
      } else {
        g.moveTo(ex - 2.8, -44).quadraticCurveTo(ex, -48, ex + 2.8, -44).stroke({ width: 2, color: ink, cap: 'round' });
      }
    }
    if (this.mouth === 'smile') {
      g.moveTo(-3.6, -38.6).quadraticCurveTo(0, -35.2, 3.6, -38.6).stroke({ width: 2, color: ink, cap: 'round' });
    } else if (this.mouth === 'open') {
      g.ellipse(0, -37.2, 3.4, 3.6).fill(0x8a3442);
      g.ellipse(0, -35.6, 2, 1.3).fill(0xff8a9b);
    } else if (this.mouth === 'chew') {
      g.ellipse(0, -37.6, 3.4, 1.5).fill(0x8a3442);
    } else {
      g.circle(0, -37.4, 2.1).fill(0x8a3442);
    }
  }

  destroy(): void {
    actors.delete(this);
    if (this.stack && !this.stack.destroyed) {
      gsap.killTweensOf(this.stack);
      gsap.killTweensOf(this.stack.scale);
      this.stack.destroy();
    }
    if (this.root.destroyed) return;
    killTree(this.root);
    this.root.destroy({ children: true });
  }
}

/** Order bubble: one row per dish (icon + plates still wanted), or a 2×2 bento for takeaway. */
class Bubble extends Container {
  private rows: { dish: Dish; icon: Sprite; label: Text; check: Graphics }[] = [];
  constructor(spec: DinerSpec) {
    super();
    const g = new Graphics();
    this.addChild(g);
    if (spec.kind === 'box') {
      const h = 50;
      drawBubble(g, 50, h);
      expand(spec.order)
        .slice(0, 4)
        .forEach((d, i) => {
          const sp = new Sprite(art.plate[d]);
          sp.anchor.set(0.5);
          sp.scale.set(20 / 40);
          sp.position.set((i % 2 ? 1 : -1) * 11, -6 - h + 14 + Math.floor(i / 2) * 22);
          this.addChild(sp);
        });
      return;
    }
    const rowH = 26;
    const h = spec.order.length * rowH + 6;
    drawBubble(g, 54, h);
    spec.order.forEach((o, i) => {
      const y = -6 - h + 3 + rowH / 2 + i * rowH;
      const icon = new Sprite(art.plate[o.dish]);
      icon.anchor.set(0.5);
      icon.scale.set(23 / 40);
      icon.position.set(-11, y);
      const label = text(String(o.n), 18, C.ink, 700);
      label.anchor.set(0.5);
      label.position.set(13, y);
      const check = new Graphics();
      check.moveTo(-5, 0).lineTo(-1.5, 4).lineTo(6, -5).stroke({ width: 3.4, color: C.green, cap: 'round', join: 'round' });
      check.position.set(13, y);
      check.visible = false;
      this.addChild(icon, label, check);
      this.rows.push({ dish: o.dish, icon, label, check });
    });
  }
  /** Show what is left; punch the row that just changed. */
  set(left: OrderItem[], changed: Dish): void {
    for (const r of this.rows) {
      const n = left.find((o) => o.dish === r.dish)?.n ?? 0;
      if (r.label.text === String(n)) continue;
      r.label.text = String(n);
      if (n === 0) {
        r.label.visible = false;
        r.check.visible = true;
        r.icon.alpha = 0.45;
        pop(r.check, 1, 0.4);
      } else if (r.dish === changed) pop(r.label, 1, 0.35);
    }
  }
}

function drawBubble(g: Graphics, w: number, h: number): void {
  g.roundRect(-w / 2, -6 - h + 2.5, w, h, 13).fill({ color: 0x000000, alpha: 0.12 });
  g.roundRect(-w / 2, -6 - h, w, h, 13).fill(0xffffff);
  g.poly([-6, -7, 6, -7, 0, 0]).fill(0xffffff);
}

function expand(order: OrderItem[]): Dish[] {
  const out: Dish[] = [];
  for (const o of order) for (let i = 0; i < o.n; i++) out.push(o.dish);
  return out;
}

/** One reusable view per belt slot. */
class PlateView extends Container {
  sp = new Sprite(art.plate.S);
  shadow = new Graphics();
  alarm = new Graphics();
  spark = new Graphics();
  plate: Plate | null = null;
  constructor() {
    super();
    this.sp.anchor.set(0.5);
    this.shadow.ellipse(0, 3, 18, 15).fill({ color: 0x000000, alpha: 0.18 });
    this.alarm.circle(0, 0, 23).stroke({ width: 4, color: C.red });
    this.alarm.visible = false;
    starShape(this.spark, 6).fill(0xffffff);
    this.spark.position.set(10, -10);
    this.spark.visible = false;
    this.addChild(this.alarm, this.shadow, this.sp, this.spark);
    this.visible = false;
  }
  setPlate(p: Plate | null): void {
    this.plate = p;
    this.visible = !!p;
    this.alarm.visible = false;
    this.rotation = 0;
    this.sp.rotation = 0;
    if (p) this.sp.texture = art.plate[p];
    this.spark.visible = p === 'G';
  }
}

const plates: PlateView[] = [];
for (let i = 0; i < SLOTS; i++) {
  const v = new PlateView();
  plates.push(v);
  plateLayer.addChild(v);
}

/** A takeaway order being packed: bento with ghost dishes, plus its courier. */
interface BoxOrder {
  view: DinerView;
  bento: Container;
  comps: { dish: Dish; sp: Sprite; full: boolean }[];
}
const COMP: [number, number][] = [
  [-14.5, -9.5],
  [14.5, -9.5],
  [-14.5, 9],
  [14.5, 9],
];

// ---------------------------------------------------------------- level state

let s: State;
let levelNo = 1;
let gen = 0;
let acc = 0;
let time = 0;
let chain = 0;
let lastGrab = -10;
let shownCoins = 0;
let warned = false;
let meterShown = 0;
let meterKey = '';
let tickDur = 0.6;
let queue: DinerView[] = [];
let seats: (DinerView | null)[] = [];
let box: BoxOrder | null = null;
const actors = new Set<DinerView>();
let hint: Hint | null = null;
let hand: TapHand | null = null;
let result: Container | null = null;
let tutorialStep = 0;
const ev: Ev[] = [];

const bar = new TopBar({ onRestart: () => startLevel(levelNo), fg: C.ink, bg: 0xffffff, textColor: C.ink });
uiLayer.addChild(bar);

const plusBadge = new Container();
const plusText = text('+0', 15, C.ink, 700);
{
  const g = new Graphics();
  g.circle(0, 2, 17).fill({ color: 0x000000, alpha: 0.12 });
  g.circle(0, 0, 17).fill(0xfffaf2);
  g.circle(0, 0, 17).stroke({ width: 2, color: C.ink, alpha: 0.2 });
  plusText.anchor.set(0.5);
  plusBadge.addChild(g, plusText);
  plusBadge.position.set(352, QY - 40);
  queueLayer.addChild(plusBadge);
}

/** Stop every tween on an object tree (before destroying or resetting it). */
function killTree(o: Container): void {
  gsap.killTweensOf(o);
  gsap.killTweensOf(o.scale);
  gsap.killTweensOf(o.position);
  gsap.killTweensOf(o.pivot);
  for (const c of o.children) killTree(c as Container);
}

function clearLayer(layer: Container, keep: Container[] = []): void {
  for (const c of layer.children.slice()) {
    if (keep.includes(c as Container)) continue;
    killTree(c as Container);
    c.destroy({ children: true });
  }
}

/** Delayed call that is dropped if the level restarted meanwhile. */
function later(sec: number, fn: () => void): void {
  const g = gen;
  gsap.delayedCall(sec, () => {
    if (g === gen) fn();
  });
}

function convert(from: Container, x: number, y: number, to: Container): { x: number; y: number } {
  const p = to.toLocal(from.toGlobal({ x, y }));
  return { x: p.x, y: p.y };
}

function dropHint(): void {
  if (hint && !hint.destroyed) hint.hide();
  hint = null;
}

function showHint(str: string, hideAfter: number): void {
  dropHint();
  const h = new Hint(str, { textColor: C.ink });
  hint = h;
  placeHint();
  uiLayer.addChild(h);
  if (hideAfter > 0)
    later(hideAfter, () => {
      if (hint === h) dropHint();
    });
}

// ---------------------------------------------------------------- level setup

function startLevel(n: number): void {
  gen++;
  levelNo = Math.max(1, Math.min(LEVELS.length, Math.floor(n) || 1));
  const L = LEVELS[levelNo - 1];
  s = newState(L);
  acc = 0;
  chain = 0;
  lastGrab = -10;
  shownCoins = 0;
  warned = false;
  meterShown = 0;
  meterKey = '';
  tickDur = L.lap / SLOTS;
  tutorialStep = L.tutorial ? 1 : 0;

  if (result && !result.destroyed) {
    killTree(result);
    result.destroy({ children: true });
  }
  result = null;
  if (hint && !hint.destroyed) {
    killTree(hint);
    hint.destroy({ children: true });
  }
  hint = null;
  hand?.destroy();
  hand = null;

  for (const a of [...actors]) a.destroy();
  actors.clear();
  box = null;
  clearLayer(seatLayer);
  clearLayer(stackLayer);
  clearLayer(eatLayer);
  clearLayer(flyLayer);
  clearLayer(fxLayer);
  clearLayer(queueLayer, [plusBadge]);
  clearLayer(boothLayer, [shelf]);

  for (const p of plates) {
    killTree(p);
    p.scale.set(1);
    p.alarm.alpha = 1;
    p.setPlate(null);
  }
  killTree(chef);
  chef.scale.set(CHEF_SCALE);
  chef.rotation = 0;
  killTree(board);
  board.pivot.set(0, 0);
  killTree(islandLayer);
  meter.scale.set(1);
  strip.scale.set(1);
  pillCoin.scale.set(1);

  // Stools: open ones get a cushion, closed ones a "Reserved" card.
  seats = new Array<DinerView | null>(5).fill(null);
  STOOL_X.forEach((x, i) => {
    if (i < L.stools) {
      const c = new Graphics();
      c.roundRect(-20, -4, 40, 16, 8).fill(0xb2463e);
      c.roundRect(-18, -6, 36, 12, 6).fill(0xdc5d50);
      c.roundRect(-12, -5, 16, 3, 1.5).fill({ color: 0xffffff, alpha: 0.3 });
      c.position.set(x, B0 - 46);
      seatLayer.addChild(c);
    } else {
      const sign = new Container();
      const g = new Graphics();
      g.poly([-26, 2, 26, 2, 22, -17, -22, -17]).fill(0xffffff).stroke({ width: 1.5, color: 0xd9c3a8 });
      const t = text('Reserved', 10, 0xb2463e, 700);
      t.anchor.set(0.5);
      t.y = -7.5;
      sign.addChild(g, t);
      sign.position.set(x, B0 - 27);
      stackLayer.addChild(sign);
    }
  });

  queue = L.diners.map((d) => {
    const v = new DinerView(d);
    actors.add(v);
    queueLayer.addChild(v.root);
    makeTappable(v);
    return v;
  });
  layoutQueue(false);
  queueLayer.addChild(plusBadge);

  shelf.visible = L.diners.some((d) => d.kind === 'box');
  drawMeterMarks();
  refreshStrip(false);
  updateMeter();
  meterShown = 0;
  pillText.text = '0';
  bar.set(`Level ${levelNo}`, subLine());

  if (L.hint) showHint(L.hint, L.tutorial ? 0 : 7);
  if (L.tutorial) {
    hand = new TapHand(0, 0);
    placeHand();
    uiLayer.addChild(hand);
  }
  if (levelNo === 2) pulseStrip(3);
}

function subLine(): string {
  return `${s.level.name} \u00b7 ${s.served}/${s.level.diners.length}`;
}

function placeHint(): void {
  if (!hint) return;
  const B = B0 + board.y;
  hint.position.set(W / 2, Math.max(104, (60 + B - 140) / 2 + 6));
}

function placeHand(): void {
  if (!hand || !queue[0]) return;
  const p = convert(queueLayer, QX[0] + 4, QY - 36, uiLayer);
  hand.position.set(p.x, p.y);
}

function pulseStrip(times: number): void {
  for (let i = 0; i < times; i++) {
    later(0.6 + i * 0.75, () => {
      const p = convert(islandLayer, STRIP_X[1], STRIP_Y, fxLayer);
      ring(fxLayer, p.x, p.y, 0xffb703, 54, 4);
      pop(strip, 1, 0.08);
      sfx.tap();
    });
  }
}

function makeTappable(v: DinerView): void {
  v.root.hitArea = new Rectangle(-34, -150, 68, 154);
  v.root.on('pointerdown', () => {
    gsap.killTweensOf(v.hop.scale);
    gsap.to(v.hop.scale, { x: 1.06, y: 0.9, duration: 0.08 });
  });
  const release = () => gsap.to(v.hop.scale, { x: 1, y: 1, duration: 0.3, ease: 'elastic.out(1.2,0.5)' });
  v.root.on('pointerupoutside', release);
  v.root.on('pointerup', () => {
    release();
    const qi = queue.indexOf(v);
    if (qi >= 0) tapDiner(qi);
  });
}

function layoutQueue(animate: boolean): void {
  queue.forEach((v, i) => {
    let x = Q4X + 44;
    let sc = 0.8;
    let alpha = 0;
    if (i < 3) {
      x = QX[i];
      sc = 1;
      alpha = 1;
    } else if (i === 3) {
      x = Q4X;
      alpha = 0.5;
    }
    const tappable = i < s.level.choose && s.status === 'play';
    v.root.eventMode = tappable ? 'static' : 'none';
    v.root.cursor = tappable ? 'pointer' : 'default';
    if (animate) {
      const moving = Math.abs(v.root.x - x) > 1;
      gsap.to(v.root.position, { x, y: QY, duration: 0.38, ease: 'power2.out' });
      gsap.to(v.root.scale, { x: sc, y: sc, duration: 0.38, ease: 'power2.out' });
      gsap.to(v.root, { alpha, duration: 0.3 });
      if (moving && alpha > 0) gsap.fromTo(v.hop, { y: 0 }, { y: -7, duration: 0.12, yoyo: true, repeat: 1, ease: 'power1.out', delay: i * 0.04 });
    } else {
      v.root.position.set(x, QY);
      v.root.scale.set(sc);
      v.root.alpha = alpha;
    }
  });
  const more = queue.length - 4;
  plusBadge.visible = more > 0;
  plusText.text = '+' + more;
}

// ---------------------------------------------------------------- player action

function tapDiner(qi: number): void {
  if (s.status !== 'play') return;
  const v = queue[qi];
  const chk = canSeat(s, qi);
  if (chk === 'noStool' || chk === 'noBox') {
    sfx.bump();
    haptic.medium();
    gsap.fromTo(v.hop, { x: -6 }, { x: 0, duration: 0.45, ease: 'elastic.out(1.4,0.3)' });
    const p = convert(queueLayer, v.root.x, QY - 160, fxLayer);
    floatText(fxLayer, p.x, p.y, chk === 'noStool' ? 'No free seat' : 'Window busy', C.red, 17);
    if (chk === 'noStool') {
      for (const d of seats) if (d) pop(d.hop, 1, 0.1);
    } else if (box) pop(box.bento, 1, 0.12);
    return;
  }
  if (chk !== 'ok') return;
  const r = seat(s, qi);
  if (!r) return;
  queue.splice(qi, 1);
  layoutQueue(true);
  haptic.light();
  sfx.whoosh();

  // Hop: queue → arc above the target → drop into place with a squash.
  const from = convert(queueLayer, v.root.x, v.root.y, flyLayer);
  killTree(v.root);
  flyLayer.addChild(v.root);
  v.root.position.set(from.x, from.y);
  v.root.eventMode = 'none';
  v.root.alpha = 1;
  v.hop.position.set(0, 0);
  const isBox = r.where === 'box';
  const target = isBox ? { x: COURIER.x, y: COURIER.y } : { x: STOOL_X[r.idx], y: SEAT_Y };
  const sc = isBox ? 0.78 : SEAT_SCALE;
  const above = convert(board, target.x, target.y - 46, flyLayer);
  const g = gen;
  gsap.fromTo(v.hop.scale, { x: 0.86, y: 1.16 }, { x: 1, y: 1, duration: 0.3, ease: 'power2.out' });
  gsap.to(v.root.scale, { x: sc, y: sc, duration: 0.34 });
  gsap.to(v.root.position, { x: above.x, duration: 0.34, ease: 'power1.inOut' });
  const peakY = Math.min(from.y, above.y) - 46;
  const tl = gsap.timeline();
  tl.to(v.root.position, { y: peakY, duration: 0.2, ease: 'power2.out' });
  tl.to(v.root.position, { y: above.y, duration: 0.14, ease: 'power2.in' });
  tl.call(() => {
    if (g !== gen || v.root.destroyed) return;
    (isBox ? boothLayer : seatLayer).addChild(v.root);
    v.root.position.set(target.x, target.y - 46);
    gsap.to(v.root.position, {
      y: target.y,
      duration: 0.12,
      ease: 'power2.in',
      onComplete: () => {
        if (g !== gen || v.root.destroyed) return;
        sfx.pluck(2);
        gsap.fromTo(v.hop.scale, { x: 1.18, y: 0.84 }, { x: 1, y: 1, duration: 0.45, ease: 'elastic.out(1.2,0.45)' });
      },
    });
  });

  if (isBox) {
    v.bubble.visible = false;
    const b: BoxOrder = { view: v, bento: new Container(), comps: [] };
    const bentoSp = new Sprite(art.bento);
    bentoSp.anchor.set(0.5);
    b.bento.addChild(bentoSp);
    expand(v.spec.order)
      .slice(0, 4)
      .forEach((d, i) => {
        const sp = new Sprite(art.plate[d]);
        sp.anchor.set(0.5);
        sp.scale.set(17 / 40);
        sp.position.set(COMP[i][0], COMP[i][1]);
        sp.alpha = 0.3;
        b.bento.addChild(sp);
        b.comps.push({ dish: d, sp, full: false });
      });
    b.bento.position.set(BENTO.x, BENTO.y);
    boothLayer.addChildAt(b.bento, boothLayer.getChildIndex(shelf) + 1);
    gsap.fromTo(b.bento.scale, { x: 0, y: 0 }, { x: 1, y: 1, duration: 0.4, ease: 'back.out(2.4)', delay: 0.2 });
    box = b;
  } else {
    seats[r.idx] = v;
    v.stack = new Graphics();
    v.stack.position.set(STOOL_X[r.idx] + 22, B0 - 30);
    stackLayer.addChild(v.stack);
  }

  if (tutorialStep === 1) {
    tutorialStep = 2;
    hand?.destroy();
    hand = null;
    showHint('They grab their dish as it rides past', 4.5);
  }
}

// ---------------------------------------------------------------- ticks

function doTick(): void {
  ev.length = 0;
  step(s, ev);
  for (const e of ev) {
    if (e.t === 'grab') onGrab(e);
    else if (e.t === 'place') onPlace(e.slot, e.plate);
    else if (e.t === 'cancel') onCancel(e.index);
    else if (e.t === 'jam') onJam();
    else onWin();
  }
  updateMeter();
  // Diners light up when a plate they want is one or two slots away.
  const near = (pos: number, d: NonNullable<State['box']>) => {
    for (let k = 1; k <= 2; k++) {
      const p = s.slots[slotAt(s, (pos - k + SLOTS) % SLOTS)];
      if (p && wants(d, p)) return true;
    }
    return false;
  };
  seats.forEach((v, i) => {
    const st = s.stools[i];
    if (v) v.excited = !!st && s.status === 'play' && near(STOOL_POS[i], st);
  });
  if (box) box.view.excited = !!s.box && s.status === 'play' && near(BOX_POS, s.box);
}

type GrabEv = Extract<Ev, { t: 'grab' }>;

function onGrab(e: GrabEv): void {
  const pv = plates[e.slot];
  const at = { x: pv.x, y: pv.y };
  killTree(pv);
  pv.scale.set(1);
  pv.setPlate(null);
  chain = time - lastGrab < 1.6 ? Math.min(chain + 1, 8) : 0;
  lastGrab = time;
  const note = chain;
  sfx.pop(note);
  if (e.plate === 'G') sfx.sparkle();
  const left = e.seated.left.map((o) => ({ dish: o.dish, n: o.n }));

  const fly = new Sprite(art.plate[e.plate]);
  fly.anchor.set(0.5);
  fly.position.set(at.x, at.y);
  eatLayer.addChild(fly);
  const g = gen;

  if (e.where === 'stool') {
    const d = seats[e.idx];
    const mouth = { x: STOOL_X[e.idx], y: SEAT_Y - 37 * SEAT_SCALE };
    if (d) {
      d.excited = false;
      d.nom();
    }
    gsap.to(fly, { x: mouth.x, y: mouth.y + 4, duration: 0.2, ease: 'power2.out' });
    gsap.to(fly.scale, {
      x: 0.7,
      y: 0.7,
      duration: 0.2,
      onComplete: () => {
        if (g !== gen) return;
        gsap.to(fly.scale, { x: 0.15, y: 0.15, duration: 0.12, ease: 'power2.in' });
        gsap.to(fly, { alpha: 0, duration: 0.12, onComplete: () => fly.destroy() });
        burst(eatLayer, mouth.x, mouth.y, { colors: [RIM[e.plate], 0xffffff], count: 6, speed: 22, size: 2.4, gravity: 10, duration: 0.4 });
        if (d && !d.root.destroyed) {
          d.nom();
          pop(d.hop, 1, 0.12);
          d.bubble.set(left, e.dish);
          addStackPlate(d, e.plate);
        }
        flyCoin(mouth.x, mouth.y);
      },
    });
    if (d && e.done) {
      seats[e.idx] = null;
      later(0.35, () => dinerDone(d, note));
    }
  } else if (box) {
    const b = box;
    const comp = b.comps.find((c) => !c.full && c.dish === e.dish) ?? b.comps.find((c) => !c.full);
    if (comp) comp.full = true;
    const target = comp ? { x: BENTO.x + comp.sp.x, y: BENTO.y + comp.sp.y } : { x: BENTO.x, y: BENTO.y };
    b.view.nom();
    b.view.excited = false;
    gsap.to(fly, { x: target.x, duration: 0.3, ease: 'power1.inOut' });
    const tl = gsap.timeline();
    tl.to(fly, { y: Math.min(at.y, target.y) - 26, duration: 0.14, ease: 'power2.out' });
    tl.to(fly, { y: target.y, duration: 0.16, ease: 'power2.in' });
    gsap.to(fly.scale, {
      x: 0.45,
      y: 0.45,
      duration: 0.3,
      onComplete: () => {
        fly.destroy();
        if (g !== gen) return;
        if (comp) {
          comp.sp.texture = art.plate[e.dish];
          comp.sp.alpha = 1;
          pop(comp.sp, 17 / 40, 0.5);
        }
        if (!b.bento.destroyed) pop(b.bento, 1, 0.12);
        burst(boothLayer, target.x, target.y, { colors: [RIM[e.plate], 0xffffff], count: 6, speed: 20, size: 2.4, duration: 0.4 });
        flyCoin(target.x, target.y);
      },
    });
    if (e.done) {
      box = null;
      later(0.4, () => boxDone(b, note));
    }
  }
  bar.set(`Level ${levelNo}`, subLine());
}

function addStackPlate(d: DinerView, p: Plate): void {
  if (!d.stack || d.stack.destroyed) return;
  const y = -d.stackN * 3.4;
  d.stack.ellipse(0, y + 1.4, 10, 3.8).fill(shade(RIM[p], -0.25));
  d.stack.ellipse(0, y, 10, 3.8).fill(RIM[p]);
  d.stack.ellipse(0, y - 0.4, 6.5, 2.2).fill(0xfffaf2);
  d.stackN++;
  pop(d.stack, 1, 0.2);
}

function flyCoin(x: number, y: number): void {
  const c = new Sprite(art.coin);
  c.anchor.set(0.5);
  c.position.set(x, y);
  c.scale.set(0.9);
  eatLayer.addChild(c);
  const g = gen;
  const tl = gsap.timeline({
    onComplete: () => {
      c.destroy();
      if (g !== gen) return;
      shownCoins++;
      pillText.text = String(shownCoins);
      pop(pillCoin, 1, 0.4);
      pop(pillText, 1, 0.2);
    },
  });
  tl.to(c, { y: y - 24, duration: 0.18, ease: 'power2.out' });
  tl.to(c, { x: PILL.x - 22, duration: 0.5, ease: 'power1.in' });
  tl.to(c, { y: PILL.y, duration: 0.5, ease: 'power2.in' }, '<');
  tl.to(c.scale, { x: 0.7, y: 0.7, duration: 0.5 }, '<');
}

function dinerDone(d: DinerView, note: number): void {
  if (d.root.destroyed) return;
  sfx.coin(Math.min(note + 3, 10));
  d.happy(1);
  const p = convert(seatLayer, d.root.x, d.root.y - 70, fxLayer);
  burst(fxLayer, p.x, p.y, { colors: [0xff7aa2, 0xffd166, 0xffffff], count: 12, speed: 46, size: 4, shape: 'star' });
  floatText(fxLayer, p.x, p.y - 30, ['Yum!', 'Oishii!', 'Thanks!', 'Delish!'][d.spec.id % 4], C.orange, 19);
  gsap.to(d.bubble.scale, { x: 0, y: 0, duration: 0.25, ease: 'back.in(2)' });
  later(0.55, () => {
    gsap.to(d.hop, { y: -16, duration: 0.18, ease: 'power2.out' });
    gsap.to(d.root, { alpha: 0, duration: 0.3, delay: 0.12 });
    if (d.stack) gsap.to(d.stack, { alpha: 0, duration: 0.3, delay: 0.25 });
    later(0.6, () => d.destroy());
  });
}

function boxDone(b: BoxOrder, note: number): void {
  if (b.bento.destroyed) return;
  sfx.coin(Math.min(note + 3, 10));
  b.view.happy(1.2);
  const lid = new Sprite(art.lid);
  lid.anchor.set(0.5);
  lid.position.set(0, -34);
  lid.alpha = 0;
  b.bento.addChild(lid);
  gsap.to(lid, { y: 0, alpha: 1, duration: 0.22, ease: 'power2.in', onComplete: () => pop(b.bento, 1, 0.15) });
  burst(boothLayer, BENTO.x, BENTO.y, { colors: [0xffd166, 0xff7aa2, 0xffffff], count: 12, speed: 44, size: 4, shape: 'star' });
  const p = convert(boothLayer, COURIER.x, COURIER.y - 75, fxLayer);
  floatText(fxLayer, p.x - 20, p.y, 'To go!', C.orange, 19);
  later(0.55, () => {
    // The courier takes the bento and dashes off.
    sfx.whoosh();
    const v = b.view;
    gsap.to(b.bento, { x: COURIER.x - 4, y: COURIER.y - 24, duration: 0.22, ease: 'power2.out' });
    gsap.to(b.bento.scale, { x: 0.55, y: 0.55, duration: 0.22 });
    later(0.25, () => {
      gsap.to([v.root, b.bento], { x: '+=110', duration: 0.5, ease: 'power2.in' });
      gsap.to([v.root, b.bento], { alpha: 0, duration: 0.2, delay: 0.32 });
      later(0.6, () => {
        v.destroy();
        killTree(b.bento);
        b.bento.destroy({ children: true });
      });
    });
  });
}

function onPlace(slot: number, plate: Plate): void {
  const pv = plates[slot];
  killTree(pv);
  pv.setPlate(plate);
  gsap.fromTo(pv.scale, { x: 0.3, y: 0.3 }, { x: 1, y: 1, duration: 0.35, ease: 'back.out(2.5)' });
  pop(chef, CHEF_SCALE, 0.06, 0.3);
  refreshStrip(true);
}

function onCancel(index: number): void {
  const x = index < 3 ? STRIP_X[index] : STRIP_X[2] - 26;
  const p = convert(islandLayer, x, STRIP_Y, fxLayer);
  burst(fxLayer, p.x, p.y, { colors: [0xffd23f, 0xffffff], count: 10, speed: 30, size: 3, shape: 'star' });
  floatText(fxLayer, p.x, p.y - 16, 'One less!', 0xf29e00, 15);
  refreshStrip(false);
}

function refreshStrip(shift: boolean): void {
  const k = s.kitchen;
  stripMinis.forEach((m, i) => {
    const p = k[i];
    gsap.killTweensOf(m);
    gsap.killTweensOf(m.position);
    m.visible = !!p;
    m.x = STRIP_X[i];
    m.alpha = 1;
    if (!p) return;
    m.texture = art.plate[p];
    if (shift) {
      gsap.fromTo(m.position, { x: STRIP_X[i] - 28 }, { x: STRIP_X[i], duration: 0.24, ease: 'power2.out' });
      if (i === 2) gsap.fromTo(m, { alpha: 0 }, { alpha: 1, duration: 0.24 });
    }
  });
  stripMore.text = k.length > 3 ? '+' + (k.length - 3) : '';
  stripLabel.text = k.length ? 'Coming up' : 'All cooked!';
}

function drawMeterMarks(): void {
  const g = meterMarks;
  g.clear();
  const [a, b] = s.level.stars;
  // Star clusters under the bar: 3 stars up to a, 2 stars up to b.
  const cluster = (v: number, n: number) => {
    if (v >= SLOTS) return;
    const x = METER.x + (METER.w * v) / SLOTS;
    g.rect(x - 1, METER.y - METER.h / 2, 2, METER.h).fill({ color: C.ink, alpha: 0.3 });
    for (let i = 0; i < n; i++) starAt(g, x + (i - (n - 1) / 2) * 8.5, METER.y + 15, 4.2);
  };
  cluster(a, 3);
  if (b !== a) cluster(b, 2);
}

function starAt(g: Graphics, x: number, y: number, r: number): void {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const an = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.48;
    pts.push(x + Math.cos(an) * rr, y + Math.sin(an) * rr);
  }
  g.poly(pts).fill(0xffc233).stroke({ width: 1, color: 0xd98a00, join: 'round' });
}

function updateMeter(): void {
  const n = s.onBelt;
  meterCount.text = `${n} / ${SLOTS}`;
  peakMark.position.set(METER.x + (METER.w * s.peak) / SLOTS, METER.y - METER.h / 2 - 1);
  peakMark.visible = s.peak > 0;
  if (n >= WARN_AT && !warned && s.status === 'play') {
    warned = true;
    sfx.warn();
    haptic.medium();
    pop(meter, 1, 0.06);
  } else if (n < WARN_AT - 1) warned = false;
  sweat.visible = n >= WARN_AT && s.status === 'play';
}

function drawMeterFill(): void {
  const n = s.onBelt;
  const col = n >= WARN_AT ? C.red : n >= SLOTS * 0.6 ? C.amber : C.green;
  const w = Math.round(METER.w * (meterShown / SLOTS) * 2) / 2;
  const key = w + ':' + col;
  if (key !== meterKey) {
    meterKey = key;
    meterFill.clear();
    if (w > 0.5) {
      const ww = Math.max(METER.h, w);
      meterFill.roundRect(METER.x, METER.y - METER.h / 2, ww, METER.h, METER.h / 2).fill(col);
      meterFill.roundRect(METER.x + 3, METER.y - METER.h / 2 + 2, Math.max(0, ww - 6), 3, 1.5).fill({ color: 0xffffff, alpha: 0.35 });
    }
  }
  meterFill.alpha = n >= WARN_AT && s.status === 'play' ? 0.72 + Math.sin(time * 12) * 0.28 : 1;
}

// ---------------------------------------------------------------- end states

function onJam(): void {
  const g = gen;
  sfx.thud();
  haptic.fail();
  shake(board, 7, 0.4);
  let clog = unwantedSlots(s);
  if (clog.length === 0) clog = s.slots.map((p, k) => (p ? k : -1)).filter((k) => k >= 0);
  for (const k of clog) {
    const pv = plates[k];
    pv.alarm.visible = true;
    gsap.fromTo(pv.alarm, { alpha: 0.35 }, { alpha: 1, duration: 0.35, yoyo: true, repeat: -1 });
    gsap.fromTo(pv.sp, { rotation: -0.14 }, { rotation: 0.14, duration: 0.16, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }
  // The plate that could not go out.
  const m = stripMinis[0];
  if (m.visible) gsap.fromTo(m, { rotation: -0.2 }, { rotation: 0.2, duration: 0.12, yoyo: true, repeat: 9, onComplete: () => void (m.rotation = 0) });
  const p = convert(islandLayer, CHEF.x, CHEF.y - 92, fxLayer);
  floatText(fxLayer, p.x, p.y, 'Kitchen jammed!', C.red, 22);
  gsap.fromTo(chef, { rotation: -0.06 }, { rotation: 0.06, duration: 0.08, yoyo: true, repeat: 7, onComplete: () => void (chef.rotation = 0) });
  for (const v of queue) v.root.eventMode = 'none';
  for (const v of actors) v.excited = false;
  dropHint();
  const body = jamReason(clog);
  later(0.4, () => sfx.lose());
  later(1.8, () => {
    if (g !== gen) return;
    result = showResult(uiLayer, W, game.H, {
      win: false,
      title: 'Kitchen jammed',
      body,
      primary: { label: 'Try again', onTap: () => restartFromResult(levelNo) },
    });
  });
}

function jamReason(clog: number[]): string {
  const count = new Map<Plate, number>();
  for (const k of clog) {
    const p = s.slots[k];
    if (p) count.set(p, (count.get(p) ?? 0) + 1);
  }
  const names = [...count]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([p]) => DISH_NAME[p]);
  if (unwantedSlots(s).length === 0) return 'All 16 spots filled before anyone could eat. Seat diners who want what’s coming up.';
  const what = names.length === 2 ? `${names[0]} and ${names[1]}` : names[0];
  return `The belt filled up with ${what} nobody at the counter wanted. Seat diners who want what’s coming up.`;
}

function restartFromResult(n: number): void {
  // The result card removes itself; don't destroy it from inside its own tap.
  result = null;
  startLevel(n);
}

function onWin(): void {
  const g = gen;
  const L = s.level;
  const stars = starsFor(L, s.peak);
  const last = levelNo >= LEVELS.length;
  save('sushi:level', last ? levelNo : levelNo + 1);
  for (const v of queue) v.root.eventMode = 'none';
  dropHint();
  later(0.7, () => {
    sfx.win();
    haptic.success();
    confetti(fxLayer, W, game.H);
  });
  const [a, b] = L.stars;
  const starsLine = a === b ? `3 stars up to ${a}.` : `3 stars up to ${a}, 2 stars up to ${b}.`;
  const body = `Busiest belt: ${s.peak} of ${SLOTS} plates.\n${starsLine}`;
  later(1.7, () => {
    if (g !== gen) return;
    result = showResult(
      uiLayer,
      W,
      game.H,
      last
        ? {
            win: true,
            title: 'You finished the demo!',
            body: body + '\nThanks for playing Sushi Loop.',
            stars,
            primary: {
              label: 'Replay from level 1',
              onTap: () => {
                save('sushi:level', 1);
                restartFromResult(1);
              },
            },
            secondary: { label: 'Replay this level', onTap: () => restartFromResult(levelNo) },
          }
        : {
            win: true,
            title: 'All served!',
            body,
            stars,
            primary: { label: 'Next level', onTap: () => restartFromResult(levelNo + 1) },
            secondary: { label: 'Replay', onTap: () => restartFromResult(levelNo) },
          },
    );
  });
}

// ---------------------------------------------------------------- frame loop

function update(dt: number): void {
  time += dt;
  if (s.status === 'play') {
    acc += dt;
    while (acc >= tickDur && s.status === 'play') {
      acc -= tickDur;
      doTick();
    }
  }
  const phase = s.tick + Math.min(acc / tickDur, 1);

  for (let i = 0; i < SLAT_N; i++) {
    const p = pathAt((i / SLAT_N) * PERIM + phase * SLOT_LEN);
    const sl = slats[i];
    sl.position.set(p.x, p.y);
    sl.rotation = p.a;
  }
  for (let k = 0; k < SLOTS; k++) {
    const pv = plates[k];
    if (!pv.plate) continue;
    const p = pathAt(slotPos(k, phase) * SLOT_LEN);
    pv.position.set(p.x, p.y);
    pv.sp.y = Math.sin(time * 4 + k * 1.3) * 1.2;
    if (pv.plate === 'G') {
      pv.spark.rotation = time * 2;
      pv.spark.scale.set(0.6 + Math.abs(Math.sin(time * 3 + k)) * 0.6);
    }
  }
  for (const a of actors) a.update(dt);

  meterShown += (s.onBelt - meterShown) * Math.min(1, dt * 10);
  drawMeterFill();

  lanterns.forEach((l, i) => (l.rotation = Math.sin(time * 1.3 + i * 1.7) * 0.07));
  steam.forEach((g, i) => {
    const t = (time * 0.55 + i / steam.length) % 1;
    g.position.set(POT.x - 6 + Math.sin(t * 6 + i) * 5 + i * 4, POT.y - 36 - t * 30);
    g.alpha = Math.sin(t * Math.PI) * 0.55;
    g.scale.set(0.5 + t * 0.9);
  });
  sweat.y = CHEF.y - 52 + Math.abs(Math.sin(time * 5)) * 3;
  if (hand) placeHand();
}

// ---------------------------------------------------------------- boot

game.onResize((H) => {
  const B = B0 + (H - H0) * 0.45;
  board.y = B - B0;
  queueLayer.y = H - H0;
  drawBackground(H, B);
  placeHint();
});

const fromUrl = Number(new URLSearchParams(location.search).get('level'));
startLevel(fromUrl >= 1 ? fromUrl : load('sushi:level', 1));
game.app.ticker.add((t) => update(Math.min(t.deltaMS / 1000, 0.1)));
