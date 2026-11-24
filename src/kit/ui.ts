import { Container, Graphics, Sprite, Text, TextStyle, Texture, type TextStyleOptions } from 'pixi.js';
import { gsap } from 'gsap';
import { shade, svgTexture } from './art';
import { haptic } from './haptics';
import { isMuted, setMuted, sfx } from './sfx';

export const FONT = 'Fredoka, system-ui, sans-serif';

/** Text in the shared font, rendered sharp on high-DPI phones and scaled desktops. */
export function text(
  str: string,
  size: number,
  color = 0xffffff,
  weight: 400 | 600 | 700 = 600,
  extra: { stroke?: number; strokeAlpha?: number; strokeWidth?: number; align?: 'left' | 'center' | 'right'; wrap?: number; style?: TextStyleOptions } = {},
): Text {
  const style: TextStyleOptions = {
    fontFamily: FONT,
    fontSize: size,
    fontWeight: String(weight) as TextStyleOptions['fontWeight'],
    fill: color,
    align: extra.align ?? 'center',
    lineHeight: size * 1.2,
    ...(extra.wrap ? { wordWrap: true, wordWrapWidth: extra.wrap } : {}),
    ...(extra.stroke !== undefined
      ? { stroke: { color: extra.stroke, width: extra.strokeWidth ?? Math.max(3, size * 0.16), join: 'round', alpha: extra.strokeAlpha ?? 1 } }
      : {}),
    ...extra.style,
  };
  const t = new Text({ text: str, style: new TextStyle(style) });
  t.resolution = Math.min(3, (window.devicePixelRatio || 1) * 1.5);
  return t;
}

/** Make any container respond to taps with a soft press animation. */
export function pressable(target: Container, onTap: () => void, opts: { sound?: boolean; scale?: number } = {}): void {
  target.eventMode = 'static';
  target.cursor = 'pointer';
  const base = { x: target.scale.x, y: target.scale.y };
  const down = opts.scale ?? 0.93;
  target.on('pointerdown', () => {
    gsap.to(target.scale, { x: base.x * down, y: base.y * down, duration: 0.08, ease: 'power2.out' });
  });
  const up = () => gsap.to(target.scale, { x: base.x, y: base.y, duration: 0.35, ease: 'elastic.out(1.2, 0.5)' });
  target.on('pointerupoutside', up);
  target.on('pointerup', () => {
    up();
    if (opts.sound !== false) sfx.tap();
    haptic.light();
    onTap();
  });
}

/** Chunky "candy" button with a darker lip underneath. */
export class Button extends Container {
  private face = new Graphics();
  private lip = new Graphics();
  caption: Text;
  constructor(
    str: string,
    public onTap: () => void,
    opts: { width?: number; height?: number; color?: number; textColor?: number; size?: number } = {},
  ) {
    super();
    const w = opts.width ?? 200;
    const h = opts.height ?? 56;
    const c = opts.color ?? 0x2ec4b6;
    const lipH = 6;
    this.lip.roundRect(-w / 2, -h / 2 + lipH, w, h, h / 2).fill(shade(c, -0.28));
    this.face.roundRect(-w / 2, -h / 2, w, h, h / 2).fill(c);
    this.face.roundRect(-w / 2 + 10, -h / 2 + 6, w - 20, h * 0.32, h * 0.16).fill({ color: 0xffffff, alpha: 0.22 });
    this.caption = text(str, opts.size ?? 22, opts.textColor ?? 0xffffff, 700);
    this.caption.anchor.set(0.5);
    this.caption.y = -1;
    this.addChild(this.lip, this.face, this.caption);
    const faceGroup = [this.face, this.caption];
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerdown', () => faceGroup.forEach((o) => gsap.to(o, { y: (o === this.caption ? -1 : 0) + lipH - 1, duration: 0.06 })));
    const release = () => faceGroup.forEach((o) => gsap.to(o, { y: o === this.caption ? -1 : 0, duration: 0.25, ease: 'back.out(3)' }));
    this.on('pointerupoutside', release);
    this.on('pointerup', () => {
      release();
      sfx.tap();
      haptic.light();
      this.onTap();
    });
  }
}

export type IconName = 'restart' | 'home' | 'sound' | 'mute' | 'next' | 'undo' | 'hint' | 'play';

function drawIcon(g: Graphics, name: IconName, color: number): void {
  const s = { width: 3.2, color, cap: 'round' as const, join: 'round' as const };
  switch (name) {
    case 'restart':
      g.arc(0, 0, 8, -Math.PI * 0.35, Math.PI * 1.45).stroke(s);
      g.poly([4.5, -11.5, 9.5, -6.5, 2.5, -4.5]).fill(color);
      break;
    case 'home':
      g.poly([-9, -1, 0, -9, 9, -1]).stroke(s);
      g.roundRect(-6, -2, 12, 10, 2).stroke(s);
      break;
    case 'sound':
    case 'mute':
      g.poly([-9, -4, -4, -4, 2, -9, 2, 9, -4, 4, -9, 4]).fill(color);
      if (name === 'sound') {
        g.arc(3, 0, 5, -0.9, 0.9).stroke(s);
        g.arc(3, 0, 9, -0.9, 0.9).stroke(s);
      } else {
        g.moveTo(5, -4).lineTo(11, 4).stroke(s);
        g.moveTo(11, -4).lineTo(5, 4).stroke(s);
      }
      break;
    case 'next':
    case 'play':
      g.poly([-5, -8, 8, 0, -5, 8]).fill(color);
      break;
    case 'undo':
      g.arc(1, 2, 7, Math.PI * 1.1, Math.PI * 2.4).stroke(s);
      g.poly([-10, -2, -4, -8, -3, 1]).fill(color);
      break;
    case 'hint':
      g.circle(0, -2, 6.5).stroke(s);
      g.moveTo(-3, 7).lineTo(3, 7).stroke(s);
      break;
  }
}

/** Round icon button (restart, home, sound…). */
export class IconButton extends Container {
  private icon = new Graphics();
  constructor(
    public name: IconName,
    onTap: () => void,
    opts: { bg?: number; fg?: number; size?: number } = {},
  ) {
    super();
    const r = (opts.size ?? 44) / 2;
    const bg = opts.bg ?? 0xffffff;
    const bgG = new Graphics();
    bgG.circle(0, 3, r).fill({ color: 0x000000, alpha: 0.12 });
    bgG.circle(0, 0, r).fill({ color: bg, alpha: 0.92 });
    this.addChild(bgG, this.icon);
    this.fg = opts.fg ?? 0x3d3a50;
    this.setIcon(name);
    pressable(this, onTap);
  }
  private fg: number;
  setIcon(name: IconName): void {
    this.name = name;
    this.icon.clear();
    drawIcon(this.icon, name, this.fg);
  }
}

/** Standard top bar: home (to the hub), title, restart, sound. */
export class TopBar extends Container {
  title: Text;
  sub: Text;
  constructor(opts: { onRestart: () => void; fg?: number; bg?: number; textColor?: number }) {
    super();
    const home = new IconButton('home', () => (window.location.href = './index.html'), { fg: opts.fg, bg: opts.bg });
    home.position.set(32, 34);
    const restart = new IconButton('restart', opts.onRestart, { fg: opts.fg, bg: opts.bg });
    restart.position.set(390 - 84, 34);
    const sound = new IconButton(isMuted() ? 'mute' : 'sound', () => {
      setMuted(!isMuted());
      sound.setIcon(isMuted() ? 'mute' : 'sound');
    }, { fg: opts.fg, bg: opts.bg });
    sound.position.set(390 - 32, 34);
    this.title = text('', 22, opts.textColor ?? 0xffffff, 700);
    this.title.anchor.set(0.5);
    this.title.position.set(195 - 26, 26);
    this.sub = text('', 13, opts.textColor ?? 0xffffff, 600);
    this.sub.alpha = 0.75;
    this.sub.anchor.set(0.5);
    this.sub.position.set(195 - 26, 48);
    this.addChild(home, restart, sound, this.title, this.sub);
  }
  set(title: string, sub = ''): void {
    this.title.text = title;
    this.sub.text = sub;
  }
}

export interface ResultOpts {
  win: boolean;
  title: string;
  body?: string;
  stars?: number; // 0..3, only shown on a win
  primary: { label: string; onTap: () => void };
  secondary?: { label: string; onTap: () => void };
  accent?: number;
}

/**
 * Win / fail card. Dims the screen, pops the card in, counts stars in one by one.
 * Returns the overlay so the caller can remove it (it also removes itself on a button tap).
 */
export function showResult(parent: Container, width: number, height: number, o: ResultOpts): Container {
  const layer = new Container();
  // Overscan the dim so it also covers the letterbox on wide or short windows.
  const dim = new Graphics().rect(-1000, -1000, width + 2000, height + 2000).fill({ color: 0x1b1530, alpha: 0.55 });
  dim.eventMode = 'static';
  dim.alpha = 0;
  layer.addChild(dim);
  gsap.to(dim, { alpha: 1, duration: 0.25 });

  // Flow layout from the top of the card (y = 0), then the background is drawn to fit.
  const card = new Container();
  const content = new Container();
  const cw = 316;
  const accent = o.accent ?? (o.win ? 0xffb703 : 0xef476f);
  const title = text(o.title, 30, 0xffffff, 700, { stroke: shade(accent, -0.35), strokeWidth: 5 });
  title.anchor.set(0.5);
  title.y = 43;
  // Long titles shrink to fit inside the card's title strip.
  const maxTitle = 316 - 36;
  if (title.width > maxTitle) title.scale.set(maxTitle / title.width);
  content.addChild(title);

  let y = 110;
  if (o.win) {
    const stars = o.stars ?? 3;
    for (let i = 0; i < 3; i++) {
      const sx = (i - 1) * 74;
      const sy = y + 34 + (i === 1 ? -10 : 0);
      const empty = new Graphics();
      starShape(empty, i === 1 ? 32 : 26).fill(0xe9e1d3);
      empty.position.set(sx, sy);
      content.addChild(empty);
      if (i < stars) {
        const full = new Graphics();
        starShape(full, i === 1 ? 32 : 26).fill(0xffc233).stroke({ width: 3, color: 0xf08c00, join: 'round' });
        full.position.set(sx, sy);
        full.scale.set(0);
        content.addChild(full);
        gsap.to(full.scale, {
          x: 1,
          y: 1,
          duration: 0.45,
          delay: 0.45 + i * 0.28,
          ease: 'back.out(3)',
          onStart: () => {
            sfx.star(i);
            haptic.light();
          },
        });
      }
    }
    y += 84;
  }
  if (o.body) {
    const body = text(o.body, 17, 0x5c5470, 600, { wrap: cw - 48 });
    body.anchor.set(0.5, 0);
    body.y = y;
    content.addChild(body);
    y += body.height + 22;
  } else {
    y += 6;
  }
  const close = (fn: () => void) => () => {
    gsap.to(card.scale, { x: 0.8, y: 0.8, duration: 0.15, ease: 'power2.in' });
    gsap.to(layer, { alpha: 0, duration: 0.18, onComplete: () => layer.destroy({ children: true }) });
    fn();
  };
  const primary = new Button(o.primary.label, close(o.primary.onTap), { width: 220, color: o.win ? 0x06d6a0 : 0x4361ee });
  primary.y = y + 28;
  content.addChild(primary);
  y += 66;
  if (o.secondary) {
    const sec = text(o.secondary.label, 17, 0x8a82a0, 700);
    sec.anchor.set(0.5);
    sec.y = y + 14;
    pressable(sec, close(o.secondary.onTap));
    content.addChild(sec);
    y += 34;
  }
  const ch = y + 18;
  const bg = new Graphics();
  bg.roundRect(-cw / 2, 8, cw, ch, 32).fill({ color: 0x000000, alpha: 0.18 });
  bg.roundRect(-cw / 2, 0, cw, ch, 32).fill(0xfffaf2);
  bg.roundRect(-cw / 2, 0, cw, 86, 32).fill(accent);
  bg.rect(-cw / 2, 54, cw, 32).fill(accent);
  content.y = -ch / 2;
  bg.y = -ch / 2;
  card.addChild(bg, content);

  card.position.set(width / 2, height / 2);
  card.scale.set(0.6);
  card.alpha = 0;
  layer.addChild(card);
  gsap.to(card, { alpha: 1, duration: 0.2, delay: 0.1 });
  gsap.to(card.scale, { x: 1, y: 1, duration: 0.5, delay: 0.1, ease: 'back.out(1.8)' });
  parent.addChild(layer);
  return layer;
}

export function starShape(g: Graphics, r: number): Graphics {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.5;
    pts.push(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return g.poly(pts);
}

/** A pill-shaped hint banner (tutorial lines, rule intros). Fades itself out on hide(). */
export class Hint extends Container {
  private bg = new Graphics();
  private t: Text;
  constructor(str: string, opts: { color?: number; textColor?: number; width?: number } = {}) {
    super();
    this.t = text(str, 16, opts.textColor ?? 0x3d3a50, 600, { wrap: (opts.width ?? 320) - 36 });
    this.t.anchor.set(0.5);
    const w = Math.min(opts.width ?? 320, this.t.width + 40);
    const h = this.t.height + 22;
    this.bg.roundRect(-w / 2, -h / 2 + 4, w, h, h / 2).fill({ color: 0x000000, alpha: 0.12 });
    this.bg.roundRect(-w / 2, -h / 2, w, h, Math.min(24, h / 2)).fill(opts.color ?? 0xffffff);
    this.addChild(this.bg, this.t);
    this.scale.set(0.7);
    this.alpha = 0;
    gsap.to(this, { alpha: 1, duration: 0.25 });
    gsap.to(this.scale, { x: 1, y: 1, duration: 0.45, ease: 'back.out(2)' });
  }
  hide(): void {
    gsap.to(this, { alpha: 0, duration: 0.2, onComplete: () => this.destroy({ children: true }) });
  }
}

/** Animated tapping finger used to teach the first move. Call .destroy() to remove. */
const HAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 78">
<g stroke="#3d3a50" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
<path d="M15 9 a7 7 0 0 1 14 0 V36 c2-3 11-3 12 2 c2-3 10-2 11 3 c3-2 8 0 8 5 V58 c0 11-9 18-20 18 H28 c-8 0-12-4-16-10 L3 50 c-3-4 1-10 6-7 l6 5 Z" fill="#ffffff"/>
<path d="M29 37 V46 M41 39 V47 M52 44 V50" fill="none" stroke-width="2.4" opacity=".55"/>
</g>
<path d="M18 10 a4 4 0 0 1 8 0" fill="none" stroke="#e9e4f3" stroke-width="3" stroke-linecap="round"/>
<ellipse cx="44" cy="64" rx="9" ry="6" fill="#efeaf7"/>
</svg>`;

export class TapHand extends Container {
  private tl: gsap.core.Timeline;
  constructor(x: number, y: number) {
    super();
    const ripple = new Graphics().circle(0, 0, 18).stroke({ width: 3, color: 0xffffff, alpha: 0.9 });
    // Cartoon pointing hand (SVG). The fingertip sits at the sprite's anchor so the
    // hand's position is exactly where it taps.
    const hand = new Sprite(Texture.EMPTY);
    hand.anchor.set(22 / 60, 5 / 78);
    void svgTexture('kit:taphand', HAND_SVG, 60, 78).then((t) => {
      if (!hand.destroyed) hand.texture = t;
    });
    hand.position.set(0, 2);
    this.addChild(ripple, hand);
    this.position.set(x, y);
    this.eventMode = 'none';
    ripple.alpha = 0;
    this.tl = gsap.timeline({ repeat: -1, repeatDelay: 0.4 });
    this.tl
      .fromTo(hand, { x: 14, y: 24 }, { x: 0, y: 2, duration: 0.45, ease: 'power2.out' })
      .to(hand.scale, { x: 0.9, y: 0.9, duration: 0.1 })
      .fromTo(ripple.scale, { x: 0.4, y: 0.4 }, { x: 1.4, y: 1.4, duration: 0.45 }, '<')
      .fromTo(ripple, { alpha: 1 }, { alpha: 0, duration: 0.45 }, '<')
      .to(hand.scale, { x: 1, y: 1, duration: 0.15 }, '<0.1');
  }
  override destroy(): void {
    this.tl.kill();
    super.destroy({ children: true });
  }
}
