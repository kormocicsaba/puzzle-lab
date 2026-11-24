import { Container, Graphics, Text } from 'pixi.js';
import { gsap } from 'gsap';
import { text } from './ui';

/**
 * Juice helpers. Medium juice beats none and beats extreme (Kao), so these default
 * to short and soft. Every helper cleans up after itself.
 */

export interface BurstOpts {
  colors?: number[];
  count?: number;
  speed?: number; // px travelled
  size?: number;
  shape?: 'dot' | 'confetti' | 'star';
  gravity?: number; // px of extra fall
  duration?: number;
}

function starPath(g: Graphics, r: number): Graphics {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return g.poly(pts);
}

export function burst(parent: Container, x: number, y: number, o: BurstOpts = {}): void {
  const colors = o.colors ?? [0xffd166, 0xff7aa2, 0x7bdff2, 0xb2f7ef];
  const count = o.count ?? 12;
  const speed = o.speed ?? 70;
  const size = o.size ?? 5;
  const dur = o.duration ?? 0.6;
  for (let i = 0; i < count; i++) {
    const g = new Graphics();
    const c = colors[i % colors.length];
    const s = size * (0.6 + Math.random() * 0.8);
    if (o.shape === 'confetti') g.roundRect(-s, -s * 0.45, s * 2, s * 0.9, 1.5).fill(c);
    else if (o.shape === 'star') starPath(g, s * 1.3).fill(c);
    else g.circle(0, 0, s).fill(c);
    g.position.set(x, y);
    g.rotation = Math.random() * Math.PI;
    parent.addChild(g);
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const d = speed * (0.55 + Math.random() * 0.6);
    const tl = gsap.timeline({ onComplete: () => g.destroy() });
    tl.to(g, { x: x + Math.cos(a) * d, duration: dur, ease: 'power2.out' }, 0);
    tl.to(g, { y: y + Math.sin(a) * d + (o.gravity ?? 0), duration: dur, ease: o.gravity ? 'power1.in' : 'power2.out' }, 0);
    tl.to(g, { rotation: g.rotation + (Math.random() - 0.5) * 6, duration: dur }, 0);
    tl.to(g.scale, { x: 0, y: 0, duration: dur * 0.45, ease: 'power2.in' }, dur * 0.55);
  }
}

/** Big celebratory confetti rain over the whole screen. */
export function confetti(parent: Container, width: number, height: number, count = 70): void {
  const colors = [0xff6b6b, 0xffd166, 0x06d6a0, 0x4cc9f0, 0xb388ff, 0xff9ecd];
  for (let i = 0; i < count; i++) {
    const g = new Graphics();
    const s = 4 + Math.random() * 4;
    g.roundRect(-s, -s * 0.4, s * 2, s * 0.8, 1.5).fill(colors[i % colors.length]);
    g.position.set(Math.random() * width, -20 - Math.random() * 200);
    g.rotation = Math.random() * Math.PI;
    parent.addChild(g);
    const dur = 1.6 + Math.random() * 1.2;
    gsap.to(g, { y: height + 30, duration: dur, ease: 'power1.in', onComplete: () => g.destroy() });
    gsap.to(g, { x: g.x + (Math.random() - 0.5) * 120, rotation: g.rotation + (Math.random() - 0.5) * 12, duration: dur });
    gsap.to(g.scale, { x: 0.3 + Math.random(), duration: 0.25, yoyo: true, repeat: Math.ceil(dur / 0.25) });
  }
}

/** Expanding ring, good for "landed" or "matched" feedback. */
export function ring(parent: Container, x: number, y: number, color = 0xffffff, radius = 30, width = 4): void {
  const g = new Graphics().circle(0, 0, radius).stroke({ width, color });
  g.position.set(x, y);
  g.scale.set(0.3);
  parent.addChild(g);
  gsap.to(g.scale, { x: 1, y: 1, duration: 0.35, ease: 'power2.out' });
  gsap.to(g, { alpha: 0, duration: 0.35, ease: 'power1.in', onComplete: () => g.destroy() });
}

/** Screen shake: shakes a container through its pivot so its position is untouched. */
export function shake(target: Container, intensity = 6, duration = 0.3): void {
  gsap.killTweensOf(target.pivot);
  const tl = gsap.timeline({ onComplete: () => target.pivot.set(0, 0) });
  const steps = Math.max(3, Math.round(duration / 0.04));
  for (let i = 0; i < steps; i++) {
    const k = 1 - i / steps;
    tl.to(target.pivot, {
      x: (Math.random() - 0.5) * 2 * intensity * k,
      y: (Math.random() - 0.5) * 2 * intensity * k,
      duration: duration / steps,
      ease: 'none',
    });
  }
  tl.to(target.pivot, { x: 0, y: 0, duration: 0.04 });
}

/** Scale punch (squash and stretch). Works on any display object. */
export function punch(target: Container, amount = 0.18, duration = 0.35): void {
  const sx = target.scale.x;
  const sy = target.scale.y;
  gsap.killTweensOf(target.scale);
  gsap.fromTo(
    target.scale,
    { x: sx * (1 + amount), y: sy * (1 - amount * 0.7) },
    { x: sx, y: sy, duration, ease: 'elastic.out(1.1, 0.45)' },
  );
}

/** Floating label that rises and fades ("+3", "Combo x4!", "Perfect!"). */
export function floatText(
  parent: Container,
  x: number,
  y: number,
  label: string,
  color = 0xffffff,
  size = 22,
): Text {
  const t = text(label, size, color, 700, { stroke: 0x000000, strokeAlpha: 0.25 });
  t.anchor.set(0.5);
  t.position.set(x, y);
  t.scale.set(0.4);
  parent.addChild(t);
  const tl = gsap.timeline({ onComplete: () => t.destroy() });
  tl.to(t.scale, { x: 1, y: 1, duration: 0.3, ease: 'back.out(3)' });
  tl.to(t, { y: y - 46, duration: 0.9, ease: 'power1.out' }, 0);
  tl.to(t, { alpha: 0, duration: 0.3 }, 0.6);
  return t;
}
