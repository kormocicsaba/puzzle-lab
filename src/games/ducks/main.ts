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
  noise,
  ring,
  save,
  sfx,
  shake,
  showResult,
  TapHand,
  text,
  tone,
  TopBar,
  wait,
} from '../../kit';
import { LEVELS } from './levels.ts';
import { applyEscape, DX, DY, HEARTS, initialState, parseLevel, resolve, starsFor, type Level, type Move, type State } from './logic.ts';
import { loadArt, POND_BORDER, pondTexture, SHAPES } from './sprites.ts';

/**
 * Duckling Dash. Tap a duck and it swims straight ahead until it leaves the pond.
 * Rules live in logic.ts (shared with the solver test); this file is only the view:
 * it asks `resolve` what a tap does, applies it to the state at once, then animates.
 */

const W = 390;
const TOP = 106; // pond starts below the top bar and the hearts
const BOTTOM = 88; // room for the hint pill
const SIDE = 14; // screen edge to water
const PAD = 9; // water between the rim and the grid
const INK = 0x2f5d3a;

const game = await createGame({ background: '#bfe3a5' });
const ART = await loadArt();
const LV: Level[] = LEVELS.map(parseLevel);

type Kind = 'single' | 'mother' | 'kid';
type Anim = gsap.core.Animation;

/** One bird on screen. A family is a mother member followed by duckling members. */
interface Member {
  kind: Kind;
  root: Container; // at the cell centre, rotated to face where it swims
  bob: Container; // idle breathing / hop / take-off scale
  body: Container; // squash and stretch (scale = k)
  head: Container;
  headSpr: Sprite;
  wingL: Sprite;
  wingR: Sprite;
  shadow: Sprite;
  k: number;
}

interface View {
  id: number;
  members: Member[];
  chevron: Sprite | null;
  chevLoop: Anim | null;
  band: Graphics | null;
  zzz: Text | null;
  zzzLoop: Anim | null;
  breath: Anim[];
  idle: Anim | null;
  mode: 'idle' | 'bump' | 'gone';
}

interface HeartSlot {
  full: Sprite;
  empty: Sprite;
  l: Sprite;
  r: Sprite;
}

interface Scene {
  c: Container;
  board: Container; // the pond and everything on it (shaken on a bump)
  ripples: Container;
  pads: Container;
  bands: Container;
  ducks: Container;
  chevs: Container;
  reedLayer: Container;
  fly: Container;
  fx: Container;
  hud: Container;
  cell: number;
  gx: number;
  gy: number;
  px: number;
  py: number;
  pw: number;
  ph: number;
  views: (View | null)[];
  rocks: Map<number, Sprite>;
  rockK: number;
  turners: Map<number, Container>;
  reeds: Sprite[];
  loops: Anim[];
  wakePool: Sprite[];
  hearts: HeartSlot[];
  heartBeat: Anim | null;
  counter: Container;
  counterText: Text;
  hint: Hint | null;
  hand: TapHand | null;
  alive: boolean;
}

// ---------------------------------------------------------------- game state

const clampLevel = (n: number) => Math.max(0, Math.min(LV.length - 1, Math.floor(Number(n) || 0)));
let levelIndex = clampLevel(load('ducks:level', 0));
let level: Level = LV[levelIndex];
let state: State = initialState(level);
let hearts = HEARTS;
let bumps = 0;
let combo = 0;
let lastEscapeAt = -1e9;
let taps = 0;
let ended = false;
let runId = 0;
let S!: Scene;
let hasScene = false;
let card: Container | null = null;

const sceneHost = new Container();
const bar = new TopBar({ onRestart: () => startLevel(levelIndex), fg: INK, bg: 0xffffff, textColor: INK });
const confettiHost = new Container();
confettiHost.x = -200; // confetti covers the sides on wide screens too
const resultHost = new Container();
resultHost.x = -500; // showResult centres on width / 2: a wide dim, the card still at x = 195
game.root.addChild(sceneHost, bar, confettiHost, resultHost);

// ---------------------------------------------------------------- helpers

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cx = (c: number) => S.gx + ((c % level.cols) + 0.5) * S.cell;
const cy = (c: number) => S.gy + (Math.floor(c / level.cols) + 0.5) * S.cell;
const dirRot = (d: number) => (d * Math.PI) / 2;

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Squash and stretch around a known base scale (the kit's punch reads the current scale). */
function jelly(o: Container, base: number, amt = 0.2, dur = 0.45): void {
  gsap.killTweensOf(o.scale);
  gsap.fromTo(o.scale, { x: base * (1 + amt), y: base * (1 - amt * 0.7) }, { x: base, y: base, duration: dur, ease: 'elastic.out(1.1, 0.45)' });
}

function quack(step: number): void {
  const f = 470 + Math.min(step, 10) * 22;
  tone({ freq: f, to: f * 0.72, dur: 0.1, type: 'sawtooth', vol: 0.035 });
  tone({ freq: f * 2.01, to: f * 1.3, dur: 0.07, type: 'square', vol: 0.012, delay: 0.005 });
}

function splashSound(): void {
  noise({ dur: 0.22, vol: 0.09, freq: 1700, q: 0.7 });
}

function layoutFor(lv: Level, H: number) {
  const cell = Math.floor(Math.min(54, (W - 2 * SIDE - 2 * PAD) / lv.cols, (H - TOP - BOTTOM - 2 * PAD) / lv.rows));
  const pw = lv.cols * cell + 2 * PAD;
  const ph = lv.rows * cell + 2 * PAD;
  const px = Math.round((W - pw) / 2);
  const py = Math.round(TOP + (H - TOP - BOTTOM - ph) / 2);
  return { cell, pw, ph, px, py, gx: px + PAD, gy: py + PAD, radius: Math.min(26, Math.round(cell * 0.55)) };
}

function birdsLeft(): number {
  let n = 0;
  for (const d of level.ducks) if (state.present[d.id]) n += d.cells.length;
  return n;
}

// ---------------------------------------------------------------- ducks

function makeMember(kind: Kind, asleep: boolean, cell: number): Member {
  const s = SHAPES[kind];
  const k = (S.cell / 64) * (kind === 'mother' ? 1.12 : kind === 'kid' ? 0.8 : 1.04);
  const root = new Container();
  const shadow = new Sprite(ART.shadow);
  shadow.anchor.set(0.5);
  shadow.scale.set(k * (kind === 'kid' ? 0.85 : 1));
  const bob = new Container();
  const body = new Container();
  body.scale.set(k);
  const bodySpr = new Sprite(ART.body[kind]);
  bodySpr.anchor.set(0.5);
  const wingL = new Sprite(ART.wing[kind]);
  wingL.anchor.set(s.sx / 64, s.sy / 64);
  wingL.position.set(s.sx - 32, s.sy - 32);
  const wingR = new Sprite(ART.wing[kind]);
  wingR.anchor.set(s.sx / 64, s.sy / 64);
  wingR.position.set(32 - s.sx, s.sy - 32);
  wingR.scale.x = -1;
  const head = new Container();
  head.position.set(0, s.hy - 32);
  const headSpr = new Sprite(asleep ? ART.sleepHead : ART.head[kind]);
  headSpr.anchor.set(0.5, s.hy / 64);
  head.addChild(headSpr);
  if (asleep) head.rotation = 0.3;
  body.addChild(bodySpr, wingL, wingR, head);
  bob.addChild(body);
  root.addChild(shadow, bob);
  root.position.set(cx(cell), cy(cell));
  return { kind, root, bob, body, head, headSpr, wingL, wingR, shadow, k };
}

/** Rotate a member; its shadow keeps falling down-right whatever way it faces. */
function setRot(m: Member, r: number): void {
  m.root.rotation = r;
  const ox = S.cell * 0.035;
  const oy = S.cell * 0.075;
  const c = Math.cos(r);
  const s = Math.sin(r);
  m.shadow.position.set(ox * c + oy * s, -ox * s + oy * c);
}

/** Facing of a member at rest: the head looks where it swims, ducklings at the one in front. */
function restRot(id: number, i: number): number {
  const def = level.ducks[id];
  if (i === 0) return dirRot(def.dir);
  const a = def.cells[i - 1];
  const b = def.cells[i];
  return Math.atan2(cy(a) - cy(b), cx(a) - cx(b)) + Math.PI / 2;
}

function startBreath(sc: Scene, v: View, sleepy: boolean): void {
  for (const b of v.breath) b.kill();
  v.breath.length = 0;
  for (const m of v.members) {
    m.bob.scale.set(1);
    const t = gsap.to(m.bob.scale, {
      x: sleepy ? 1.05 : 1.035,
      y: sleepy ? 0.96 : 0.975,
      duration: (sleepy ? 1.5 : 0.85) + Math.random() * 0.5,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
      delay: Math.random() * 0.8,
    });
    v.breath.push(t);
    sc.loops.push(t);
  }
}

function chevronHome(sc: Scene, id: number): [number, number] {
  const def = level.ducks[id];
  const off = sc.cell * 0.5 + 4;
  return [cx(def.cells[0]) + DX[def.dir] * off, cy(def.cells[0]) + DY[def.dir] * off];
}

function startChevron(sc: Scene, v: View): void {
  const ch = v.chevron;
  if (!ch) return;
  v.chevLoop?.kill();
  gsap.killTweensOf(ch);
  const d = level.ducks[v.id].dir;
  const [x0, y0] = chevronHome(sc, v.id);
  ch.position.set(x0, y0);
  ch.alpha = 1;
  v.chevLoop = gsap.to(ch, { x: x0 + DX[d] * 2.5, y: y0 + DY[d] * 2.5, alpha: 0.6, duration: 0.65, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: Math.random() * 0.6 });
  sc.loops.push(v.chevLoop);
}

function startZzz(sc: Scene, v: View): void {
  const c = level.ducks[v.id].cells[0];
  const z = text('z', Math.round(sc.cell * 0.36), 0xffffff, 700, { stroke: 0x2f6f96, strokeAlpha: 0.55, strokeWidth: 3 });
  z.anchor.set(0.5);
  sc.fx.addChild(z);
  const x0 = cx(c) + sc.cell * 0.22;
  const y0 = cy(c) - sc.cell * 0.2;
  z.alpha = 0;
  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.5, delay: Math.random() });
  tl.fromTo(z, { x: x0, y: y0, alpha: 0 }, { x: x0 + 5, y: y0 - 9, alpha: 1, duration: 0.55, ease: 'sine.out' })
    .to(z, { x: x0 + 11, y: y0 - 20, alpha: 0, duration: 0.75, ease: 'sine.in' })
    .fromTo(z.scale, { x: 0.5, y: 0.5 }, { x: 1.1, y: 1.1, duration: 1.3 }, 0);
  v.zzz = z;
  v.zzzLoop = tl;
  sc.loops.push(tl);
}

function scheduleIdle(sc: Scene, v: View): void {
  v.idle = gsap.delayedCall(2.5 + Math.random() * 4.5, () => {
    if (!sc.alive || v.mode === 'gone') return;
    if (v.mode === 'idle' && !state.asleep[v.id]) idleMove(sc, v);
    scheduleIdle(sc, v);
  });
}

function idleMove(sc: Scene, v: View): void {
  const m = v.members[Math.floor(Math.random() * v.members.length)];
  const r = Math.random();
  if (r < 0.55) {
    // look around
    const a = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.3);
    gsap
      .timeline()
      .to(m.head, { rotation: a, duration: 0.22, ease: 'power2.out' })
      .to(m.head, { rotation: 0, duration: 0.3, ease: 'power2.inOut' }, `+=${0.45 + Math.random() * 0.6}`);
  } else if (r < 0.85) {
    // flap
    gsap.to(m.wingL, { rotation: 0.75, duration: 0.08, yoyo: true, repeat: 3, ease: 'sine.inOut' });
    gsap.to(m.wingR, { rotation: -0.75, duration: 0.08, yoyo: true, repeat: 3, ease: 'sine.inOut' });
  } else {
    // head shake with a little ripple
    gsap.fromTo(m.head, { rotation: -0.28 }, { rotation: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
    ring(sc.ripples, m.root.x, m.root.y, 0xffffff, sc.cell * 0.45, 2);
  }
}

function stopIdle(v: View): void {
  v.idle?.kill();
  v.idle = null;
  for (const b of v.breath) b.kill();
  v.breath.length = 0;
  for (const m of v.members) {
    gsap.killTweensOf(m.head);
    gsap.killTweensOf(m.wingL);
    gsap.killTweensOf(m.wingR);
    m.head.rotation = 0;
    m.wingL.rotation = 0;
    m.wingR.rotation = 0;
    m.bob.scale.set(1);
  }
}

function buildDuck(sc: Scene, id: number): View {
  const def = level.ducks[id];
  const asleep = state.asleep[id];
  const v: View = { id, members: [], chevron: null, chevLoop: null, band: null, zzz: null, zzzLoop: null, breath: [], idle: null, mode: 'idle' };
  if (def.cells.length > 1) {
    // A soft band under a family so it reads as one unit.
    const g = new Graphics();
    g.moveTo(cx(def.cells[0]), cy(def.cells[0]));
    for (let i = 1; i < def.cells.length; i++) g.lineTo(cx(def.cells[i]), cy(def.cells[i]));
    g.stroke({ width: sc.cell * 0.56, color: 0xffffff, alpha: 0.3, cap: 'round', join: 'round' });
    sc.bands.addChild(g);
    v.band = g;
  }
  // Ducklings first so the mother draws on top of the one right behind her.
  for (let i = def.cells.length - 1; i >= 0; i--) {
    const kind: Kind = i > 0 ? 'kid' : def.mother ? 'mother' : 'single';
    const m = makeMember(kind, asleep && i === 0, def.cells[i]);
    setRot(m, restRot(id, i));
    m.root.eventMode = 'static';
    m.root.cursor = 'pointer';
    m.root.hitArea = new Rectangle(-sc.cell / 2, -sc.cell / 2, sc.cell, sc.cell);
    m.root.on('pointerdown', () => tapDuck(id));
    sc.ducks.addChild(m.root);
    v.members[i] = m;
  }
  const ch = new Sprite(ART.chevron);
  ch.anchor.set(0.5);
  ch.rotation = dirRot(def.dir);
  ch.scale.set((sc.cell / 42) * 0.82);
  sc.chevs.addChild(ch);
  v.chevron = ch;
  if (asleep) {
    const [x0, y0] = chevronHome(sc, id);
    ch.position.set(x0, y0);
    ch.alpha = 0.35;
    startZzz(sc, v);
  } else startChevron(sc, v);
  startBreath(sc, v, asleep);
  scheduleIdle(sc, v);
  return v;
}

// ---------------------------------------------------------------- scene

function teardown(sc: Scene): void {
  sc.alive = false;
  for (const l of sc.loops) l.kill();
  for (const v of sc.views) v?.idle?.kill();
  sc.hand?.destroy();
  sc.hand = null;
  sc.c.visible = false;
  sc.c.eventMode = 'none';
  // Short one-off tweens (bursts, swims) may still be running on it: let them finish first.
  gsap.delayedCall(3, () => sc.c.destroy({ children: true }));
}

function build(intro: boolean): void {
  if (hasScene) teardown(S);
  const H = game.H;
  const L = layoutFor(level, H);
  const rand = rng(1234 + levelIndex * 97);
  const c = new Container();
  sceneHost.addChild(c);
  const layer = () => new Container();
  const sc: Scene = {
    c,
    board: layer(),
    ripples: layer(),
    pads: layer(),
    bands: layer(),
    ducks: layer(),
    chevs: layer(),
    reedLayer: layer(),
    fly: layer(),
    fx: layer(),
    hud: layer(),
    cell: L.cell,
    gx: L.gx,
    gy: L.gy,
    px: L.px,
    py: L.py,
    pw: L.pw,
    ph: L.ph,
    views: [],
    rocks: new Map(),
    rockK: (L.cell / 64) * 1.04,
    turners: new Map(),
    reeds: [],
    loops: [],
    wakePool: [],
    hearts: [],
    heartBeat: null,
    counter: layer(),
    counterText: text('', 20, INK, 700),
    hint: null,
    hand: null,
    alive: true,
  };
  S = sc;
  hasScene = true;

  drawMeadow(sc, H, rand);

  // Pond
  const pond = new Sprite(Texture.EMPTY);
  pond.position.set(L.px - POND_BORDER, L.py - POND_BORDER);
  void pondTexture(L.pw, L.ph, L.radius).then((t) => {
    if (!pond.destroyed) pond.texture = t;
  });
  const tiles = new Graphics();
  for (let y = 0; y < level.rows; y++) {
    for (let x = 0; x < level.cols; x++) {
      if (level.rock[y * level.cols + x]) continue;
      tiles
        .roundRect(L.gx + x * L.cell + 2, L.gy + y * L.cell + 2, L.cell - 4, L.cell - 4, L.cell * 0.24)
        .fill({ color: 0xffffff, alpha: (x + y) % 2 ? 0.07 : 0.12 });
    }
  }
  c.addChild(sc.board);
  sc.board.addChild(pond, tiles, sc.ripples, sc.pads, sc.bands, sc.ducks, sc.chevs, sc.reedLayer, sc.fly, sc.fx);
  c.addChild(sc.hud);

  // Ambient ripples drifting over the water.
  for (let i = 0; i < 5; i++) {
    const sp = new Sprite(ART.ripple);
    sp.anchor.set(0.5);
    sp.alpha = 0;
    sc.ripples.addChild(sp);
    const place = () => sp.position.set(L.px + 20 + Math.random() * (L.pw - 40), L.py + 20 + Math.random() * (L.ph - 40));
    place();
    const s = (L.cell / 80) * (1.1 + Math.random() * 0.6);
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6 + Math.random() * 1.6, delay: Math.random() * 3, onRepeat: place });
    tl.fromTo(sp.scale, { x: s * 0.25, y: s * 0.25 }, { x: s, y: s, duration: 2.4, ease: 'sine.out' }, 0).fromTo(
      sp,
      { alpha: 0.5 },
      { alpha: 0, duration: 2.4, ease: 'sine.in' },
      0,
    );
    sc.loops.push(tl);
  }

  // Rocks and lily pad turners
  for (let i = 0; i < level.cols * level.rows; i++) {
    if (level.rock[i]) {
      const r = new Sprite(ART.rock[Math.floor(rand() * 2)]);
      r.anchor.set(0.5);
      r.scale.set(sc.rockK);
      r.rotation = (rand() - 0.5) * 0.5;
      r.position.set(cx(i), cy(i));
      sc.pads.addChild(r);
      sc.rocks.set(i, r);
    } else if (level.turner[i] !== 0) {
      const t = new Container();
      t.position.set(cx(i), cy(i));
      const pad = new Sprite(ART.turnPad);
      pad.anchor.set(0.5);
      pad.scale.set((L.cell / 64) * 1.02);
      pad.rotation = rand() * Math.PI * 2;
      const arrow = new Sprite(ART.arrow);
      arrow.anchor.set(0.5);
      const cw = level.turner[i] > 0;
      arrow.scale.set((L.cell / 64) * 0.82 * (cw ? 1 : -1), (L.cell / 64) * 0.82);
      arrow.rotation = rand() * Math.PI * 2;
      t.addChild(pad, arrow);
      sc.pads.addChild(t);
      sc.turners.set(i, t);
      sc.loops.push(gsap.to(arrow, { rotation: arrow.rotation + (cw ? 1 : -1) * Math.PI * 2, duration: 6, repeat: -1, ease: 'none' }));
    }
  }

  // Ducks
  for (const d of level.ducks) sc.views[d.id] = state.present[d.id] ? buildDuck(sc, d.id) : null;

  drawReeds(sc, rand);
  drawHud(sc, H);

  if (intro) {
    let i = 0;
    for (const d of level.ducks) {
      const v = sc.views[d.id];
      if (!v) continue;
      for (let j = v.members.length - 1; j >= 0; j--) {
        const m = v.members[j];
        m.root.scale.set(0);
        gsap.to(m.root.scale, { x: 1, y: 1, duration: 0.45, delay: 0.12 + i * 0.022, ease: 'back.out(2.4)' });
        i++;
      }
    }
    sc.chevs.alpha = 0;
    gsap.to(sc.chevs, { alpha: 1, duration: 0.35, delay: 0.25 + i * 0.022 });
    sc.board.alpha = 0;
    gsap.to(sc.board, { alpha: 1, duration: 0.25 });
    sfx.whoosh();
  }
}

function drawMeadow(sc: Scene, H: number, rand: () => number): void {
  const g = new Graphics();
  g.rect(-700, -300, W + 1400, H + 600).fill(0xbfe3a5);
  for (let i = 0; i < 16; i++) {
    g.ellipse(-260 + rand() * (W + 520), rand() * H, 40 + rand() * 70, 16 + rand() * 26).fill({ color: rand() < 0.5 ? 0xcdeab6 : 0xb0d994, alpha: 0.55 });
  }
  sc.c.addChild(g);
  const m = 16;
  for (let i = 0; i < 80; i++) {
    const x = -260 + rand() * (W + 520);
    const y = 72 + rand() * (H - 64);
    const flower = rand() < 0.3;
    const pick = rand();
    const sz = rand();
    const flip = rand() < 0.5;
    if (x > sc.px - m && x < sc.px + sc.pw + m && y > sc.py - m && y < sc.py + sc.ph + m + 12) continue;
    if (y < 106 && x > 120 && x < 270) continue; // keep the hearts row clean
    if (y > H - 76 && x > 20 && x < W - 20) continue; // and the hint pill
    const s = new Sprite(flower ? ART.flowers[Math.floor(pick * 3)] : ART.tuft);
    s.anchor.set(0.5, flower ? 0.5 : 1);
    s.position.set(x, y);
    s.scale.set(flower ? 0.7 + sz * 0.4 : 0.7 + sz * 0.6);
    if (flip) s.scale.x *= -1;
    sc.c.addChild(s);
  }
}

function drawReeds(sc: Scene, rand: () => number): void {
  const spots: [number, number][] = [
    [sc.px - 9, sc.py + sc.ph * 0.32],
    [sc.px - 5, sc.py + sc.ph + 10],
    [sc.px + sc.pw + 8, sc.py + sc.ph * 0.14],
    [sc.px + sc.pw + 5, sc.py + sc.ph * 0.74],
  ];
  for (const [x, y] of spots) {
    for (let j = 0; j < 2; j++) {
      const r = new Sprite(ART.reed[(j + Math.floor(rand() * 2)) % 2]);
      r.anchor.set(0.5, 1);
      const s = 0.46 + rand() * 0.16;
      r.scale.set(rand() < 0.5 ? -s : s, s);
      r.position.set(x + (j ? 7 : -4), y + (j ? 6 : 0));
      sc.reedLayer.addChild(r);
      sc.reeds.push(r);
      sc.loops.push(gsap.to(r.skew, { x: (rand() < 0.5 ? -1 : 1) * 0.07, duration: 1.4 + rand() * 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: rand() }));
    }
  }
}

function drawHud(sc: Scene, H: number): void {
  const y = 86;
  if (level.forgiving) {
    const t = text('Practice pond: bumps are free', 15, INK, 600);
    t.anchor.set(0.5);
    t.alpha = 0.8;
    t.position.set(W / 2, y);
    sc.hud.addChild(t);
  } else {
    for (let i = 0; i < HEARTS; i++) {
      const x = W / 2 + (i - 1) * 38;
      const mk = (tex: Texture) => {
        const s = new Sprite(tex);
        s.anchor.set(0.5);
        s.scale.set(0.82);
        s.position.set(x, y);
        sc.hud.addChild(s);
        return s;
      };
      const slot: HeartSlot = { empty: mk(ART.heart.empty), full: mk(ART.heart.full), l: mk(ART.heart.left), r: mk(ART.heart.right) };
      slot.full.visible = i < hearts;
      slot.l.visible = false;
      slot.r.visible = false;
      sc.hearts.push(slot);
    }
    if (hearts === 1) startHeartBeat(sc);
  }
  // Birds still on the pond
  const icon = new Sprite(ART.head.single);
  icon.anchor.set(0.5, SHAPES.single.hy / 64);
  icon.scale.set(0.85);
  icon.x = -13;
  sc.counterText.anchor.set(0, 0.5);
  sc.counterText.x = 0;
  sc.counterText.text = String(birdsLeft());
  sc.counter.addChild(icon, sc.counterText);
  sc.counter.position.set(W - 48, y);
  sc.hud.addChild(sc.counter);

  if (level.hint && taps < 3) {
    const h = new Hint(level.hint, { width: 340, textColor: INK });
    h.position.set(W / 2, H - 46);
    sc.hud.addChild(h);
    sc.hint = h;
  }
  if (level.tapHand && taps === 0) {
    const [tx, ty] = level.tapHand;
    const c = ty * level.cols + tx;
    sc.hand = new TapHand(cx(c) + 2, cy(c) + 4);
    sc.hud.addChild(sc.hand);
  }
}

function startHeartBeat(sc: Scene): void {
  const h = sc.hearts[0];
  if (!h || sc.heartBeat) return;
  sc.heartBeat = gsap.to(h.full.scale, { x: 0.95, y: 0.95, duration: 0.32, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  sc.loops.push(sc.heartBeat);
}

// ---------------------------------------------------------------- swimming

interface Path {
  xs: number[];
  ys: number[];
  /** Facing (rotation) of the segment from point i to i + 1. */
  seg: number[];
}

/** Polyline through cell centres, continued `extN` cells in `extDir` past the last one. */
function makePath(cells: number[], extDir: number, extN: number): Path {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const c of cells) {
    xs.push(cx(c));
    ys.push(cy(c));
  }
  const lx = xs[xs.length - 1];
  const ly = ys[ys.length - 1];
  for (let j = 1; j <= extN; j++) {
    xs.push(lx + DX[extDir] * S.cell * j);
    ys.push(ly + DY[extDir] * S.cell * j);
  }
  const seg: number[] = [];
  for (let i = 0; i < xs.length - 1; i++) seg.push(Math.atan2(ys[i + 1] - ys[i], xs[i + 1] - xs[i]) + Math.PI / 2);
  seg.push(seg[seg.length - 1] ?? 0);
  return { xs, ys, seg };
}

function placeOn(p: Path, t: number, m: Member): void {
  const n = p.xs.length;
  let i = Math.floor(t);
  if (i < 0) i = 0;
  if (i > n - 2) i = n - 2;
  const f = t - i;
  m.root.position.set(p.xs[i] + (p.xs[i + 1] - p.xs[i]) * f, p.ys[i] + (p.ys[i + 1] - p.ys[i]) * f);
}

/** Ease the facing toward the segment just ahead, so corners on lily pads turn smoothly. */
function steer(p: Path, t: number, minIdx: number, m: Member, look: number, fac: number): void {
  let i = Math.floor(t + look);
  if (i < minIdx) i = minIdx;
  if (i > p.seg.length - 1) i = p.seg.length - 1;
  const r = m.root.rotation;
  setRot(m, r + wrapAngle(p.seg[i] - r) * fac);
}

function emitWake(sc: Scene, m: Member): void {
  const sp = sc.wakePool.pop() ?? new Sprite(ART.wake);
  if (!sp.parent) {
    sp.anchor.set(0.5);
    sc.ripples.addChild(sp);
  }
  const r = m.root.rotation;
  const back = sc.cell * 0.32;
  sp.visible = true;
  sp.rotation = r;
  sp.position.set(m.root.x - Math.sin(r) * back, m.root.y + Math.cos(r) * back);
  sp.alpha = 0.75;
  const k = sc.cell / 42;
  sp.scale.set(k * 0.7);
  gsap.to(sp.scale, { x: k * 1.35, y: k * 1.1, duration: 0.6, ease: 'sine.out' });
  gsap.to(sp, {
    alpha: 0,
    duration: 0.6,
    ease: 'sine.in',
    onComplete: () => {
      if (sp.destroyed) return;
      sp.visible = false;
      sc.wakePool.push(sp);
    },
  });
}

function padPass(sc: Scene, cell: number, step: number): void {
  const t = sc.turners.get(cell);
  if (!t) return;
  jelly(t, 1, 0.22, 0.5);
  ring(sc.fx, t.x, t.y, 0xc8f0a0, sc.cell * 0.55, 3);
  sfx.pluck(4 + step);
}

function splashAt(sc: Scene, x: number, y: number): void {
  ring(sc.fx, x, y, 0xffffff, sc.cell * 0.62, 3);
  burst(sc.fx, x, y, { colors: [0xffffff, 0xd8f3ff, 0x9bd7f5], count: 9, speed: sc.cell * 0.85, size: 3, duration: 0.45 });
  splashSound();
}

function hideChevron(v: View, destroy: boolean): void {
  const ch = v.chevron;
  if (!ch) return;
  v.chevLoop?.kill();
  v.chevLoop = null;
  gsap.killTweensOf(ch);
  gsap.to(ch, {
    alpha: 0,
    duration: 0.12,
    onComplete: () => {
      if (destroy && !ch.destroyed) ch.destroy();
    },
  });
  if (destroy) v.chevron = null;
}

// ---------------------------------------------------------------- taps

function tapDuck(id: number): void {
  if (ended || !hasScene || !S.alive) return;
  const sc = S;
  const v = sc.views[id];
  if (!v || v.mode !== 'idle') return;
  const mv = resolve(level, state, id);
  if (mv.kind === 'gone') return;
  taps++;
  if (sc.hand) {
    sc.hand.destroy();
    sc.hand = null;
  }
  if (sc.hint && taps >= 3) {
    sc.hint.hide();
    sc.hint = null;
  }
  if (mv.kind === 'asleep') return snore(sc, v);
  const head = v.members[0];
  jelly(head.body, head.k, 0.16, 0.3);
  if (mv.kind === 'escape') escape(sc, v, mv);
  else bump(sc, v, mv);
}

function snore(sc: Scene, v: View): void {
  const m = v.members[0];
  gsap.fromTo(m.bob, { rotation: -0.16 }, { rotation: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
  tone({ freq: 150, to: 115, dur: 0.38, type: 'triangle', vol: 0.14 });
  haptic.light();
  floatText(sc.fx, m.root.x, m.root.y - sc.cell * 0.45, 'Zzz…', 0xe4f4ff, 16);
}

function escape(sc: Scene, v: View, mv: Move): void {
  const def = level.ducks[v.id];
  const L = def.cells.length;
  const woke = applyEscape(level, state, v.id);
  v.mode = 'gone';
  stopIdle(v);
  hideChevron(v, true);
  if (v.band) {
    const b = v.band;
    v.band = null;
    gsap.to(b, { alpha: 0, duration: 0.15, onComplete: () => b.destroy() });
  }
  sc.views[v.id] = null;

  // Sound, combo, counter
  const now = performance.now();
  combo = now - lastEscapeAt < 2300 ? combo + 1 : 1;
  lastEscapeAt = now;
  quack(combo - 1);
  sfx.pop(Math.min(combo - 1, 10));
  haptic.light();
  const head = v.members[0];
  if (combo >= 3) {
    const label = combo === 3 ? 'Nice!' : combo === 5 ? 'Great!' : combo === 8 ? 'Amazing!' : `Combo x${combo}`;
    floatText(sc.fx, head.root.x, head.root.y - sc.cell * 0.55, label, combo >= 5 ? 0xffe066 : 0xffffff, 17 + Math.min(combo, 9));
  }
  sc.counterText.text = String(birdsLeft());
  jelly(sc.counter, 1, 0.25, 0.4);
  ring(sc.ripples, head.root.x, head.root.y, 0xffffff, sc.cell * 0.5, 2.5);

  // Swim along tail…head + path, then past the edge.
  const trail: number[] = [];
  for (let i = L - 1; i >= 0; i--) trail.push(def.cells[i]);
  for (const c of mv.path) trail.push(c);
  const p = makePath(trail, mv.endDir, L + 2);
  const lastGrid = L - 1 + mv.path.length;
  const single = L === 1;
  const sEnd = single ? mv.path.length + 0.5 : mv.path.length + L + 0.8;
  const dur = Math.min(1.15, 0.16 + 0.06 * sEnd);
  const crossed = v.members.map(() => false);
  const turns: number[] = [];
  const turnCells: number[] = [];
  mv.path.forEach((c, k) => {
    if (level.turner[c] !== 0) {
      turns.push(L + k);
      turnCells.push(c);
    }
  });
  let nextTurn = 0;
  let lastWake = 0;
  const o = { s: 0 };
  const cross = (i: number) => {
    crossed[i] = true;
    if (!sc.alive) return;
    const m = v.members[i];
    sc.fly.addChild(m.root);
    splashAt(sc, m.root.x, m.root.y);
    if (!single) {
      // Ducklings hop out over the bank one by one.
      gsap.to(m.bob.scale, { x: 1.14, y: 1.14, duration: 0.08, yoyo: true, repeat: 5 });
      gsap.to(m.root, { alpha: 0, duration: 0.3, delay: 0.12, onComplete: () => m.root.destroy({ children: true }) });
    }
  };
  const update = () => {
    const fac = 1 - Math.pow(0.6, gsap.ticker.deltaRatio(60));
    for (let i = 0; i < L; i++) {
      const m = v.members[i];
      if (m.root.destroyed) continue;
      const t = L - 1 - i + o.s;
      placeOn(p, t, m);
      steer(p, t, L - 1 - i, m, 0.3, fac);
      if (!crossed[i] && t >= lastGrid + 0.5 - 1e-6) cross(i);
    }
    if (!sc.alive) return;
    const th = L - 1 + o.s;
    while (nextTurn < turns.length && th >= turns[nextTurn] - 0.05) {
      padPass(sc, turnCells[nextTurn], nextTurn);
      nextTurn++;
    }
    if (o.s - lastWake >= 0.42 && th < lastGrid + 0.3) {
      lastWake = o.s;
      emitWake(sc, head);
    }
  };
  gsap.to(o, {
    s: sEnd,
    duration: dur,
    delay: 0.04,
    ease: 'power1.in',
    onUpdate: update,
    onComplete: () => {
      if (single) {
        if (head.root.destroyed) return;
        if (!crossed[0]) cross(0);
        fly(head, mv.endDir);
      } else {
        for (const m of v.members) {
          if (m.root.destroyed) continue;
          gsap.to(m.root, { x: m.root.x + DX[mv.endDir] * sc.cell, y: m.root.y + DY[mv.endDir] * sc.cell, duration: 0.3, ease: 'power1.out' });
        }
      }
    },
  });

  if (woke.length) {
    gsap.delayedCall(0.3, () => {
      if (!sc.alive) return;
      sfx.sparkle();
      for (const w of woke) wake(sc, w);
    });
  }
  if (state.remaining === 0) void win(runId);
}

/** A single duck takes off once it is past the bank. */
function fly(m: Member, dir: number): void {
  const x0 = m.root.x;
  const y0 = m.root.y;
  const dist = 240;
  sfx.whoosh();
  gsap.to(m.wingL, { rotation: 1.25, duration: 0.07, yoyo: true, repeat: 11, ease: 'sine.inOut' });
  gsap.to(m.wingR, { rotation: -1.25, duration: 0.07, yoyo: true, repeat: 11, ease: 'sine.inOut' });
  gsap.to(m.bob.scale, { x: 1.4, y: 1.4, duration: 0.6, ease: 'power1.out' });
  gsap.to(m.bob, { rotation: Math.random() < 0.5 ? 0.18 : -0.18, duration: 0.2, yoyo: true, repeat: 3, ease: 'sine.inOut' });
  gsap.to(m.shadow, { alpha: 0, duration: 0.35 });
  gsap.to(m.shadow.scale, { x: m.k * 0.6, y: m.k * 0.6, duration: 0.35 });
  gsap.to(m.root, { x: x0 + DX[dir] * dist, y: y0 + DY[dir] * dist, duration: 0.8, ease: 'power1.out' });
  gsap.to(m.root, { alpha: 0, duration: 0.3, delay: 0.5, onComplete: () => m.root.destroy({ children: true }) });
}

function wake(sc: Scene, id: number): void {
  const v = sc.views[id];
  if (!v || v.mode === 'gone') return;
  const m = v.members[0];
  m.headSpr.texture = ART.head.single;
  gsap.killTweensOf(m.head);
  gsap.to(m.head, { rotation: 0, duration: 0.35, ease: 'back.out(3)' });
  jelly(m.head, 1, 0.35, 0.5);
  jelly(m.body, m.k, 0.12, 0.4);
  burst(sc.fx, m.root.x, m.root.y - sc.cell * 0.15, { shape: 'star', colors: [0xffe066, 0xffffff], count: 6, speed: sc.cell * 0.65, size: 3, duration: 0.5 });
  floatText(sc.fx, m.root.x, m.root.y - sc.cell * 0.5, 'Awake!', 0xffffff, 15);
  v.zzzLoop?.kill();
  v.zzzLoop = null;
  if (v.zzz) {
    const z = v.zzz;
    v.zzz = null;
    gsap.killTweensOf(z);
    gsap.killTweensOf(z.scale);
    gsap.to(z, { alpha: 0, duration: 0.15, onComplete: () => z.destroy() });
  }
  startChevron(sc, v);
  if (v.chevron) {
    gsap.fromTo(v.chevron.scale, { x: 0, y: 0 }, { x: v.chevron.scale.x, y: v.chevron.scale.y, duration: 0.4, ease: 'back.out(3)' });
  }
  startBreath(sc, v, false);
}

function bump(sc: Scene, v: View, mv: Move): void {
  const def = level.ducks[v.id];
  const L = def.cells.length;
  const n = mv.path.length;
  v.mode = 'bump';
  combo = 0;
  stopIdle(v);
  hideChevron(v, false);
  if (v.band) gsap.to(v.band, { alpha: 0, duration: 0.12 });
  const trail: number[] = [];
  for (let i = L - 1; i >= 0; i--) trail.push(def.cells[i]);
  for (const c of mv.path) trail.push(c);
  const blockCell = mv.blockCell >= 0 && mv.blockCell !== trail[trail.length - 1] ? mv.blockCell : -1;
  if (blockCell >= 0) trail.push(blockCell);
  const p = makePath(trail, mv.endDir, blockCell >= 0 ? 0 : 1);
  const sHit = n + 0.16;
  const o = { s: 0 };
  const run = runId;
  const update = (look: number) => () => {
    const fac = 1 - Math.pow(0.6, gsap.ticker.deltaRatio(60));
    for (let i = 0; i < L; i++) {
      const m = v.members[i];
      if (m.root.destroyed) continue;
      const t = L - 1 - i + o.s;
      placeOn(p, t, m);
      steer(p, t, L - 1 - i, m, look, fac);
    }
  };
  const impact = () => {
    if (!sc.alive) return;
    const head = v.members[0];
    jelly(head.body, head.k, 0.28, 0.5);
    sfx.bump();
    haptic.medium();
    shake(sc.board, 5, 0.28);
    const i0 = L - 1 + n;
    const hx = (p.xs[i0] + p.xs[i0 + 1]) / 2;
    const hy = (p.ys[i0] + p.ys[i0 + 1]) / 2;
    burst(sc.fx, hx, hy, { shape: 'star', colors: [0xffe066, 0xffffff, 0xffb4c2], count: 7, speed: sc.cell * 0.7, size: 3.5, duration: 0.5 });
    floatText(sc.fx, hx, hy - sc.cell * 0.35, 'Bonk!', 0xffe066, 18);
    bumps++;
    let dead = false;
    // hearts > 0: two quick bumps in flight must not both end the level.
    if (!level.forgiving && hearts > 0) {
      loseHeart(sc);
      dead = hearts <= 0;
      if (dead) ended = true;
    }
    // The blocker reacts and says why.
    if (mv.blocker >= 0) {
      const bv = sc.views[mv.blocker];
      const mi = level.ducks[mv.blocker].cells.indexOf(mv.blockCell);
      const bm = bv && mi >= 0 ? bv.members[mi] : null;
      if (bm) jelly(bm.body, bm.k, 0.22, 0.5);
    } else if (mv.blocker === -1) {
      const r = sc.rocks.get(mv.blockCell);
      if (r) jelly(r, sc.rockK, 0.12, 0.45);
    }
    if (blockCell >= 0) alertAt(sc, cx(blockCell), cy(blockCell) - sc.cell * 0.58, dead);
    gsap.to(o, {
      s: 0,
      duration: 0.2 + 0.05 * (n + 1),
      delay: 0.14,
      ease: 'power2.inOut',
      onUpdate: update(-0.3),
      onComplete: () => {
        if (!sc.alive) {
          if (dead) void fail(run);
          return;
        }
        // Snap back exactly onto the cells.
        for (let i = 0; i < L; i++) {
          const m = v.members[i];
          m.root.position.set(cx(def.cells[i]), cy(def.cells[i]));
          setRot(m, restRot(v.id, i));
        }
        if (v.band) gsap.to(v.band, { alpha: 1, duration: 0.2 });
        if (dead) {
          void fail(run);
          return;
        }
        v.mode = 'idle';
        startChevron(sc, v);
        startBreath(sc, v, false);
        scheduleIdle(sc, v);
      },
    });
  };
  gsap.to(o, { s: sHit, duration: 0.1 + 0.055 * (n + 1), delay: 0.03, ease: 'power1.in', onUpdate: update(0.3), onComplete: impact });
}

/** Red "!" bubble over whatever was in the way. Stays up when the bump ended the level. */
function alertAt(sc: Scene, x: number, y: number, keep: boolean): void {
  const c = new Container();
  const g = new Graphics();
  const r = Math.max(10, sc.cell * 0.27);
  g.circle(0, 2, r).fill({ color: 0x000000, alpha: 0.15 });
  g.circle(0, 0, r).fill(0xff4d6d).stroke({ width: 2.5, color: 0xffffff });
  const t = text('!', Math.round(r * 1.5), 0xffffff, 700);
  t.anchor.set(0.5);
  t.y = -1;
  c.addChild(g, t);
  c.position.set(x, y);
  c.scale.set(0);
  sc.fx.addChild(c);
  const tl = gsap.timeline();
  tl.to(c.scale, { x: 1, y: 1, duration: 0.35, ease: 'back.out(3)' });
  if (!keep) tl.to(c.scale, { x: 0, y: 0, duration: 0.18, ease: 'back.in(2)', delay: 0.75, onComplete: () => c.destroy({ children: true }) });
}

function loseHeart(sc: Scene): void {
  hearts--;
  const h = sc.hearts[hearts];
  if (!h) return;
  if (sc.heartBeat) {
    sc.heartBeat.kill();
    sc.heartBeat = null;
  }
  gsap.killTweensOf(h.full.scale);
  h.full.visible = false;
  const { x, y } = h.full;
  for (const [half, side] of [
    [h.l, -1],
    [h.r, 1],
  ] as const) {
    half.visible = true;
    half.position.set(x, y);
    half.alpha = 1;
    half.rotation = 0;
    gsap.to(half, { x: x + side * 11, rotation: side * 0.55, duration: 0.7, ease: 'power1.out' });
    gsap.to(half, { y: y + 38, alpha: 0, duration: 0.7, ease: 'power2.in' });
  }
  jelly(h.empty, 0.82, 0.3, 0.5);
  tone({ freq: 1000, to: 320, dur: 0.14, type: 'square', vol: 0.035, delay: 0.02 });
  if (hearts === 1) startHeartBeat(sc);
}

// ---------------------------------------------------------------- level flow

/** Remove a result card that is still up (its own buttons close it themselves). */
function closeCard(): void {
  if (card && !card.destroyed) {
    const c = card;
    c.visible = false;
    c.eventMode = 'none';
    gsap.delayedCall(2.5, () => {
      if (!c.destroyed) c.destroy({ children: true });
    });
  }
  card = null;
}

/** A result-card button: the card closes itself, so forget it before acting. */
const cardAction = (fn: () => void) => () => {
  card = null;
  fn();
};

function startLevel(i: number): void {
  runId++;
  levelIndex = clampLevel(i);
  level = LV[levelIndex];
  state = initialState(level);
  hearts = HEARTS;
  bumps = 0;
  combo = 0;
  lastEscapeAt = -1e9;
  taps = 0;
  ended = false;
  bar.set(`Level ${levelIndex + 1}`, level.name);
  closeCard();
  build(true);
}

async function win(run: number): Promise<void> {
  ended = true;
  const stars = starsFor(bumps);
  const done = levelIndex;
  const last = done === LV.length - 1;
  // Save straight away so a reload during the celebration still counts.
  const best = load<number[]>('ducks:stars', []).slice();
  best[done] = Math.max(best[done] ?? 0, stars);
  save('ducks:stars', best);
  save('ducks:level', last ? done : done + 1);

  await wait(0.9);
  if (run !== runId) return;
  const sc = S;
  sfx.win();
  haptic.success();
  confetti(confettiHost, W + 400, game.H, 90);
  for (let i = 0; i < sc.reeds.length; i++) {
    gsap.to(sc.reeds[i], { rotation: (i % 2 ? 1 : -1) * 0.2, duration: 0.2, yoyo: true, repeat: 5, ease: 'sine.inOut', delay: i * 0.03 });
  }
  const mx = sc.px + sc.pw / 2;
  const my = sc.py + sc.ph / 2;
  for (let i = 0; i < 3; i++) {
    gsap.delayedCall(i * 0.18, () => {
      if (sc.alive) ring(sc.fx, mx, my, 0xffffff, Math.min(sc.pw, sc.ph) * (0.3 + i * 0.12), 3);
    });
  }

  await wait(1.0);
  if (run !== runId) return;
  if (last) {
    let total = 0;
    for (let i = 0; i < LV.length; i++) total += best[i] ?? 0;
    card = showResult(resultHost, W + 1000, game.H, {
      win: true,
      title: 'Demo complete!',
      body: `You finished the demo! ${total} of ${LV.length * 3} stars collected.`,
      stars,
      primary: {
        label: 'Play from level 1',
        onTap: cardAction(() => {
          save('ducks:level', 0);
          startLevel(0);
        }),
      },
      secondary: { label: 'Replay this level', onTap: cardAction(() => startLevel(done)) },
    });
  } else {
    const bumpLine = bumps === 0 ? 'No bumps at all. Every duck got home!' : bumps === 1 ? 'Just one bump. So close to perfect!' : `${bumps} bumps. Try it with fewer!`;
    card = showResult(resultHost, W + 1000, game.H, {
      win: true,
      title: stars === 3 ? 'Perfect paddle!' : stars === 2 ? 'All home!' : 'Phew, all home!',
      body: bumpLine,
      stars,
      primary: { label: 'Next level', onTap: cardAction(() => startLevel(done + 1)) },
      secondary: { label: 'Replay', onTap: cardAction(() => startLevel(done)) },
    });
  }
}

async function fail(run: number): Promise<void> {
  if (run !== runId) return;
  sfx.lose();
  haptic.fail();
  await wait(0.5);
  if (run !== runId) return;
  card = showResult(resultHost, W + 1000, game.H, {
    win: false,
    title: 'Out of hearts',
    body: 'Check which way each duck is looking before you tap it.',
    primary: { label: 'Try again', onTap: cardAction(() => startLevel(levelIndex)) },
  });
}

/** Warm the pond textures for every level at this height so a new level never flashes. */
function warmPonds(): void {
  for (const lv of LV) {
    const L = layoutFor(lv, game.H);
    void pondTexture(L.pw, L.ph, L.radius);
  }
}

let ready = false;
game.onResize(() => {
  if (!ready) return;
  // Rebuild from the current state (no intro); animations in flight are dropped.
  build(false);
  warmPonds();
});
bar.set(`Level ${levelIndex + 1}`, level.name);
build(true);
ready = true;
warmPonds();
