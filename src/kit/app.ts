import { Application, Container } from 'pixi.js';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import { gsap } from 'gsap';
import { unlockAudio } from './sfx';

/**
 * Logical design size. Every game lays out in this portrait space (a modern phone
 * in points). The root container is scaled to fit the window, so 1 unit = 1 pt on a
 * 390-wide phone. `H` grows on tall screens so there is no letterbox top/bottom on
 * phones; on wide screens (desktop) the board stays phone-shaped and centred.
 */
export const W = 390;
export const MIN_H = 720;
export const MAX_H = 900;

export interface Game {
  app: Application;
  /** Scaled, centred root. Put everything in here. */
  root: Container;
  /** Current logical height (between MIN_H and MAX_H). Width is always W. */
  H: number;
  /** Register a layout callback; called now and on every resize. */
  onResize(cb: (H: number) => void): void;
}

export async function createGame(opts: { background: string }): Promise<Game> {
  document.body.style.background = opts.background;
  const app = new Application();
  await app.init({
    background: opts.background,
    resizeTo: window,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2.5),
    autoDensity: true,
    preference: 'webgl',
  });
  document.getElementById('app')!.appendChild(app.canvas);

  // Keep tweens smooth after a tab switch instead of jumping.
  gsap.ticker.lagSmoothing(500, 33);

  await Promise.all([
    document.fonts.load('400 20px Fredoka'),
    document.fonts.load('600 20px Fredoka'),
    document.fonts.load('700 20px Fredoka'),
  ]).catch(() => undefined);

  const root = new Container();
  app.stage.addChild(root);

  const callbacks: ((H: number) => void)[] = [];
  const game: Game = {
    app,
    root,
    H: MIN_H,
    onResize(cb) {
      callbacks.push(cb);
      cb(game.H);
    },
  };

  const layout = () => {
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    const aspectH = (sh / sw) * W;
    const H = Math.max(MIN_H, Math.min(MAX_H, aspectH));
    const scale = Math.min(sw / W, sh / H);
    root.scale.set(scale);
    root.x = Math.round((sw - W * scale) / 2);
    root.y = Math.round((sh - H * scale) / 2);
    const changed = H !== game.H;
    game.H = H;
    if (changed) callbacks.forEach((cb) => cb(H));
  };
  layout();
  window.addEventListener('resize', layout);

  // Stop iOS double-tap zoom, rubber-banding and long-press menus.
  const stop = (e: Event) => e.preventDefault();
  app.canvas.addEventListener('touchmove', stop, { passive: false });
  app.canvas.addEventListener('contextmenu', stop);
  window.addEventListener('pointerdown', unlockAudio, { once: false });

  return game;
}

/** Promise-based wait that respects GSAP's clock. */
export function wait(seconds: number): Promise<void> {
  return new Promise((resolve) => gsap.delayedCall(seconds, resolve));
}
