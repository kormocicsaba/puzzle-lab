import { CanvasSource, Texture } from 'pixi.js';

/**
 * Rasterise an SVG string into a crisp texture whose logical size is w×h.
 * Use this for characters and props: hand-written SVG (gradients, soft shadows,
 * highlights) looks far better than raw Graphics calls, and stays free of image files.
 * Textures are cached by key.
 */
const cache = new Map<string, Promise<Texture>>();

export function svgTexture(key: string, svg: string, w: number, h: number, res = 3): Promise<Texture> {
  const hit = cache.get(key);
  if (hit) return hit;
  const p = (async () => {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * res);
    c.height = Math.ceil(h * res);
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0, c.width, c.height);
    return new Texture({ source: new CanvasSource({ resource: c, resolution: res }) });
  })();
  cache.set(key, p);
  return p;
}

/** Hex helpers for tinting / shading colours in code. */
export function shade(hex: number, amt: number): number {
  // amt -1..1: negative darkens, positive lightens
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  const f = (c: number) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
  return (f(r) << 16) | (f(g) << 8) | f(b);
}

export function css(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}
