import { Texture } from 'pixi.js';
import { svgTexture } from '../../kit';

/**
 * All Duckling Dash art as SVG strings, rasterised once with the kit's svgTexture.
 * Ducks are drawn top-down facing up in a 64×64 frame centred on the cell, split into
 * body / wing / head so the head can look around, the wings can flap and a sleeper can
 * tuck its head onto its back.
 */

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

interface Pal {
  light: string;
  mid: string;
  dark: string;
  line: string;
  beak: string;
  beakDark: string;
}

const YELLOW: Pal = { light: '#fff4b8', mid: '#ffd84f', dark: '#f2a734', line: '#d98a1f', beak: '#ff9a3c', beakDark: '#e06a10' };
const WHITE: Pal = { light: '#ffffff', mid: '#f7f2e8', dark: '#dccfb8', line: '#b5a588', beak: '#ffa24a', beakDark: '#df6d16' };
const CHICK: Pal = { light: '#fffbe0', mid: '#ffec8a', dark: '#f6ca48', line: '#e3ad33', beak: '#ffb460', beakDark: '#ee8a2a' };

/** Proportions per duck kind, in the 64 frame (centre 32,32). */
export interface DuckShape {
  cy: number; // body centre y
  rx: number;
  ry: number;
  hy: number; // head centre y
  hr: number;
  /** Shoulder point where a wing is pinned (left side; right is mirrored). */
  sx: number;
  sy: number;
  wing: number; // wing length
}

export const SHAPES: Record<'single' | 'mother' | 'kid', DuckShape> = {
  single: { cy: 37, rx: 15.5, ry: 17.5, hy: 19.5, hr: 10.5, sx: 20, sy: 31, wing: 22 },
  mother: { cy: 37, rx: 16.5, ry: 18.5, hy: 18.5, hr: 11, sx: 19, sy: 30, wing: 24 },
  kid: { cy: 38, rx: 13.5, ry: 14, hy: 21, hr: 12, sx: 21.5, sy: 33, wing: 13 },
};

function body(p: Pal, s: DuckShape): string {
  const tailY = s.cy + s.ry - 5;
  return svg(
    64,
    64,
    `<defs><radialGradient id="b" cx="42%" cy="34%" r="72%"><stop offset="0" stop-color="${p.light}"/><stop offset=".55" stop-color="${p.mid}"/><stop offset="1" stop-color="${p.dark}"/></radialGradient></defs>
    <path d="M${32 - 7} ${tailY} Q32 ${tailY + 13} ${32 + 7} ${tailY} Z" fill="${p.dark}" stroke="${p.line}" stroke-width="1.4" stroke-linejoin="round"/>
    <ellipse cx="32" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" fill="url(#b)" stroke="${p.line}" stroke-width="1.6"/>
    <ellipse cx="${32 - 4}" cy="${s.cy - 5}" rx="${s.rx * 0.42}" ry="${s.ry * 0.36}" fill="#fff" opacity=".38"/>`,
  );
}

function wing(p: Pal, s: DuckShape): string {
  const { sx, sy, wing: l } = s;
  return svg(
    64,
    64,
    `<defs><linearGradient id="w" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="${p.mid}"/><stop offset="1" stop-color="${p.dark}"/></linearGradient></defs>
    <path d="M${sx} ${sy} C${sx - 7} ${sy + l * 0.2} ${sx - 6} ${sy + l * 0.8} ${sx + 2} ${sy + l} C${sx + 6} ${sy + l * 0.7} ${sx + 6} ${sy + l * 0.25} ${sx} ${sy} Z" fill="url(#w)" stroke="${p.line}" stroke-width="1.3" stroke-linejoin="round"/>
    <path d="M${sx - 1.5} ${sy + l * 0.45} q1.5 ${l * 0.2} 3.5 ${l * 0.35}" stroke="${p.line}" stroke-width="1.1" fill="none" opacity=".55" stroke-linecap="round"/>`,
  );
}

function head(p: Pal, s: DuckShape, opts: { asleep?: boolean; bow?: boolean }): string {
  const { hy, hr } = s;
  const ex = hr * 0.52;
  const ey = hy - 1.5;
  const eyes = opts.asleep
    ? [-1, 1]
        .map((k) => `<path d="M${32 + k * ex - 2.6} ${ey} q2.6 2.4 5.2 0" stroke="#3b2f3a" stroke-width="1.7" fill="none" stroke-linecap="round"/>`)
        .join('')
    : [-1, 1]
        .map(
          (k) =>
            `<circle cx="${32 + k * ex}" cy="${ey}" r="2.5" fill="#3b2f3a"/><circle cx="${32 + k * ex + 0.8}" cy="${ey - 0.9}" r="0.9" fill="#fff"/>`,
        )
        .join('');
  const bowY = hy + hr - 1;
  const bow = opts.bow
    ? `<ellipse cx="${32 - 5.5}" cy="${bowY}" rx="5.8" ry="3.6" fill="#ff7aa2" stroke="#d84f7d" stroke-width="1.2" transform="rotate(-22 ${32 - 5.5} ${bowY})"/>
       <ellipse cx="${32 + 5.5}" cy="${bowY}" rx="5.8" ry="3.6" fill="#ff7aa2" stroke="#d84f7d" stroke-width="1.2" transform="rotate(22 ${32 + 5.5} ${bowY})"/>
       <circle cx="32" cy="${bowY}" r="2.8" fill="#ff5c8f" stroke="#d84f7d" stroke-width="1.1"/>`
    : '';
  return svg(
    64,
    64,
    `<defs><radialGradient id="h" cx="42%" cy="35%" r="70%"><stop offset="0" stop-color="${p.light}"/><stop offset=".6" stop-color="${p.mid}"/><stop offset="1" stop-color="${p.dark}"/></radialGradient></defs>
    <ellipse cx="32" cy="${hy - hr - 0.5}" rx="5.4" ry="6" fill="${p.beak}" stroke="${p.beakDark}" stroke-width="1.3"/>
    <path d="M30 ${hy - hr - 2.5} h4" stroke="${p.beakDark}" stroke-width="1.1" stroke-linecap="round" opacity=".6"/>
    <circle cx="32" cy="${hy}" r="${hr}" fill="url(#h)" stroke="${p.line}" stroke-width="1.6"/>
    <ellipse cx="${32 - 3}" cy="${hy - 4}" rx="3.8" ry="2.6" fill="#fff" opacity=".5"/>
    <circle cx="${32 - hr * 0.62}" cy="${hy + 3}" r="2.6" fill="#ff8fa3" opacity=".45"/>
    <circle cx="${32 + hr * 0.62}" cy="${hy + 3}" r="2.6" fill="#ff8fa3" opacity=".45"/>
    ${eyes}${bow}`,
  );
}

const shadow = svg(
  64,
  64,
  `<defs><filter id="f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.6"/></filter></defs>
  <ellipse cx="32" cy="33" rx="20" ry="20" fill="#16506e" opacity=".3" filter="url(#f)"/>`,
);

const chevron = svg(
  20,
  14,
  `<path d="M3 11 L10 4 L17 11" stroke="#1d5f86" stroke-opacity=".28" stroke-width="5.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
   <path d="M3 10 L10 3 L17 10" stroke="#fff" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
);

function rock(v: number): string {
  const blob =
    v === 0
      ? 'M13 36 C11 22 23 12 35 13 C47 14 55 24 52 37 C50 48 40 53 30 52 C20 51 14 45 13 36Z'
      : 'M12 33 C13 21 26 14 37 16 C49 18 54 29 51 39 C48 49 37 53 27 51 C17 49 11 43 12 33Z';
  return svg(
    64,
    64,
    `<defs><radialGradient id="r" cx="36%" cy="30%" r="80%"><stop offset="0" stop-color="#e2ded6"/><stop offset=".55" stop-color="#b0aca3"/><stop offset="1" stop-color="#7e7a72"/></radialGradient>
    <filter id="f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter></defs>
    <ellipse cx="33" cy="38" rx="25" ry="21" fill="#16506e" opacity=".28" filter="url(#f)"/>
    <ellipse cx="32" cy="34" rx="27" ry="23" fill="none" stroke="#fff" stroke-width="2" opacity=".45"/>
    <path d="${blob}" fill="url(#r)" stroke="#6c685f" stroke-width="1.6"/>
    <path d="M21 26 C25 19 33 17 40 19" stroke="#fff" opacity=".55" stroke-width="3" fill="none" stroke-linecap="round"/>
    <ellipse cx="${v ? 23 : 40}" cy="${v ? 43 : 42}" rx="6.5" ry="3.6" fill="#8dbb5f"/>
    <circle cx="${v ? 42 : 21}" cy="${v ? 40 : 40}" r="3" fill="#9fca6e"/>
    <circle cx="${v ? 30 : 46}" cy="${v ? 47 : 33}" r="2" fill="#9fca6e"/>`,
  );
}

function padPath(r: number, notchAt: number, gap: number): string {
  const a1 = notchAt + gap / 2;
  const a2 = notchAt - gap / 2 + Math.PI * 2;
  const p = (a: number) => `${(32 + Math.cos(a) * r).toFixed(2)} ${(32 + Math.sin(a) * r).toFixed(2)}`;
  return `M32 32 L${p(a1)} A${r} ${r} 0 1 1 ${p(a2)} Z`;
}

function veins(r: number, notchAt: number): string {
  let out = '';
  for (let i = 1; i < 8; i++) {
    const a = notchAt + (i / 8) * Math.PI * 2;
    out += `<path d="M32 32 L${(32 + Math.cos(a) * r * 0.85).toFixed(1)} ${(32 + Math.sin(a) * r * 0.85).toFixed(1)}" stroke="#4c9440" stroke-width="1.2" opacity=".35" stroke-linecap="round"/>`;
  }
  return out;
}

const turnPad = svg(
  64,
  64,
  `<defs><radialGradient id="p" cx="45%" cy="40%" r="70%"><stop offset="0" stop-color="#b4e68a"/><stop offset=".7" stop-color="#78c55b"/><stop offset="1" stop-color="#529d43"/></radialGradient>
  <filter id="f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter></defs>
  <circle cx="34" cy="35" r="27" fill="#16506e" opacity=".25" filter="url(#f)"/>
  <path d="${padPath(28, Math.PI * 0.3, 0.5)}" fill="url(#p)" stroke="#47893a" stroke-width="1.6" stroke-linejoin="round"/>
  ${veins(28, Math.PI * 0.3)}`,
);

/** Clockwise curved arrow; mirrored (scale.x = -1) for counter-clockwise. */
function arrow(): string {
  const r = 14.5;
  const a0 = (200 * Math.PI) / 180;
  const a1 = (80 * Math.PI) / 180 + Math.PI * 2;
  const P = (a: number, rr = r) => [32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr];
  const [x0, y0] = P(a0);
  const [x1, y1] = P(a1);
  // Arrow head at a1, pointing along the clockwise tangent.
  const tx = -Math.sin(a1);
  const ty = Math.cos(a1);
  const nx = Math.cos(a1);
  const ny = Math.sin(a1);
  const tip = [x1 + tx * 8, y1 + ty * 8];
  const b1 = [x1 + nx * 6.5, y1 + ny * 6.5];
  const b2 = [x1 - nx * 6.5, y1 - ny * 6.5];
  const arc = `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 1 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  const head = `M${b1[0].toFixed(2)} ${b1[1].toFixed(2)} L${tip[0].toFixed(2)} ${tip[1].toFixed(2)} L${b2[0].toFixed(2)} ${b2[1].toFixed(2)} Z`;
  return svg(
    64,
    64,
    `<path d="${arc}" stroke="#2f6b35" stroke-opacity=".35" stroke-width="8" fill="none" stroke-linecap="round"/>
     <path d="${head}" fill="#2f6b35" fill-opacity=".35" stroke="#2f6b35" stroke-opacity=".35" stroke-width="3" stroke-linejoin="round"/>
     <path d="${arc}" stroke="#fff" stroke-width="4.6" fill="none" stroke-linecap="round"/>
     <path d="${head}" fill="#fff" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`,
  );
}

function reed(v: number): string {
  const leaves =
    v === 0
      ? `<path d="M24 120 C20 90 12 66 4 44 C15 64 22 88 27 120Z" fill="#5da24c"/>
         <path d="M26 120 C30 88 38 62 46 40 C37 64 31 90 29 120Z" fill="#6cb758"/>
         <path d="M25 120 C24 86 25 50 27 20 C29 52 30 86 29 120Z" fill="#4d9443"/>
         <path d="M20 120 C18 100 13 86 8 76 C15 86 20 98 23 120Z" fill="#7cc463"/>`
      : `<path d="M24 120 C18 94 10 74 2 58 C14 74 21 94 27 120Z" fill="#6cb758"/>
         <path d="M26 120 C32 92 40 72 48 54 C38 74 31 94 29 120Z" fill="#5da24c"/>
         <path d="M28 120 C30 96 33 80 38 66 C34 82 32 98 31 120Z" fill="#7cc463"/>`;
  const tails =
    v === 0
      ? `<path d="M20 120 L16 36" stroke="#6f8f3a" stroke-width="2.2" stroke-linecap="round"/>
         <rect x="11.5" y="18" width="9" height="24" rx="4.5" fill="#8b5a2b"/><rect x="13.5" y="21" width="2.5" height="14" rx="1.2" fill="#b07a45"/>
         <path d="M16 18 L16 10" stroke="#6f8f3a" stroke-width="1.8" stroke-linecap="round"/>
         <path d="M31 120 L35 50" stroke="#6f8f3a" stroke-width="2" stroke-linecap="round"/>
         <rect x="31" y="34" width="8" height="20" rx="4" fill="#7d4f24"/><rect x="33" y="37" width="2.2" height="11" rx="1.1" fill="#a8743f"/>`
      : `<path d="M25 120 L24 40" stroke="#6f8f3a" stroke-width="2.2" stroke-linecap="round"/>
         <rect x="19.5" y="22" width="9" height="24" rx="4.5" fill="#8b5a2b"/><rect x="21.5" y="25" width="2.5" height="14" rx="1.2" fill="#b07a45"/>
         <path d="M24 22 L24 13" stroke="#6f8f3a" stroke-width="1.8" stroke-linecap="round"/>`;
  return svg(52, 120, leaves + tails);
}

const tuft = svg(
  26,
  18,
  `<path d="M4 18 C5 11 3 6 1 2 C6 6 8 12 8 18Z" fill="#8cc472"/>
   <path d="M9 18 C10 9 12 4 14 0 C14 7 13 12 13 18Z" fill="#79b862"/>
   <path d="M15 18 C17 11 21 7 25 5 C21 10 19 14 19 18Z" fill="#8cc472"/>`,
);

function flower(c: string): string {
  return svg(
    16,
    16,
    `${[0, 1, 2, 3, 4]
      .map((i) => `<circle cx="${8 + Math.cos((i / 5) * Math.PI * 2) * 3.8}" cy="${8 + Math.sin((i / 5) * Math.PI * 2) * 3.8}" r="3" fill="${c}"/>`)
      .join('')}<circle cx="8" cy="8" r="2.3" fill="#ffc94d"/>`,
  );
}

const ripple = svg(80, 40, `<ellipse cx="40" cy="20" rx="36" ry="15" fill="none" stroke="#fff" stroke-width="2.4"/>`);
const wake = svg(32, 20, `<path d="M3 3 Q16 16 29 3" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`);

const HEART = 'M17 29 C7 21.5 2 15.5 2 9.6 C2 5.2 5.4 2 9.5 2 C12.6 2 15.2 3.8 17 6.6 C18.8 3.8 21.4 2 24.5 2 C28.6 2 32 5.2 32 9.6 C32 15.5 27 21.5 17 29 Z';
function heart(part: 'full' | 'left' | 'right' | 'empty'): string {
  const crack = '17,0 15,7 19,12 14,18 18,23 17,31';
  const clip =
    part === 'left' ? `<clipPath id="c"><polygon points="0,0 ${crack} 0,31"/></clipPath>` : part === 'right' ? `<clipPath id="c"><polygon points="34,0 ${crack} 34,31"/></clipPath>` : '';
  if (part === 'empty')
    return svg(34, 31, `<path d="${HEART}" fill="#2f5d3a" fill-opacity=".14" stroke="#fff" stroke-opacity=".75" stroke-width="2.2" stroke-linejoin="round"/>`);
  return svg(
    34,
    31,
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a9c"/><stop offset="1" stop-color="#f0415e"/></linearGradient>${clip}</defs>
    <g ${clip ? 'clip-path="url(#c)"' : ''}>
    <path d="${HEART}" fill="url(#g)" stroke="#c9304b" stroke-width="2" stroke-linejoin="round"/>
    <ellipse cx="10" cy="9" rx="4" ry="2.8" fill="#fff" opacity=".6" transform="rotate(-30 10 9)"/></g>`,
  );
}

export interface Art {
  body: Record<'single' | 'mother' | 'kid', Texture>;
  wing: Record<'single' | 'mother' | 'kid', Texture>;
  head: Record<'single' | 'mother' | 'kid', Texture>;
  sleepHead: Texture;
  shadow: Texture;
  chevron: Texture;
  rock: Texture[];
  turnPad: Texture;
  arrow: Texture;
  reed: Texture[];
  tuft: Texture;
  flowers: Texture[];
  ripple: Texture;
  wake: Texture;
  heart: Record<'full' | 'left' | 'right' | 'empty', Texture>;
}

export async function loadArt(): Promise<Art> {
  const t = (k: string, s: string, w = 64, h = 64, res = 3) => svgTexture('ducks:' + k, s, w, h, res);
  const [bs, bm, bk, ws, wm, wk, hs, hm, hk, hz, sh, ch, r0, r1, tp, ar, re0, re1, tu, f0, f1, f2, ri, wa, hf, hl, hr, he] =
    await Promise.all([
      t('body-s', body(YELLOW, SHAPES.single)),
      t('body-m', body(WHITE, SHAPES.mother)),
      t('body-k', body(CHICK, SHAPES.kid)),
      t('wing-s', wing(YELLOW, SHAPES.single)),
      t('wing-m', wing(WHITE, SHAPES.mother)),
      t('wing-k', wing(CHICK, SHAPES.kid)),
      t('head-s', head(YELLOW, SHAPES.single, {})),
      t('head-m', head(WHITE, SHAPES.mother, { bow: true })),
      t('head-k', head(CHICK, SHAPES.kid, {})),
      t('head-z', head(YELLOW, SHAPES.single, { asleep: true })),
      t('shadow', shadow),
      t('chevron', chevron, 20, 14),
      t('rock0', rock(0)),
      t('rock1', rock(1)),
      t('turnpad', turnPad),
      t('arrow', arrow()),
      t('reed0', reed(0), 52, 120, 2),
      t('reed1', reed(1), 52, 120, 2),
      t('tuft', tuft, 26, 18, 2),
      t('flower0', flower('#ffffff'), 16, 16, 2),
      t('flower1', flower('#ffd0e0'), 16, 16, 2),
      t('flower2', flower('#e6dcff'), 16, 16, 2),
      t('ripple', ripple, 80, 40, 2),
      t('wake', wake, 32, 20, 2),
      t('heart-full', heart('full'), 34, 31),
      t('heart-left', heart('left'), 34, 31),
      t('heart-right', heart('right'), 34, 31),
      t('heart-empty', heart('empty'), 34, 31),
    ]);
  return {
    body: { single: bs, mother: bm, kid: bk },
    wing: { single: ws, mother: wm, kid: wk },
    head: { single: hs, mother: hm, kid: hk },
    sleepHead: hz,
    shadow: sh,
    chevron: ch,
    rock: [r0, r1],
    turnPad: tp,
    arrow: ar,
    reed: [re0, re1],
    tuft: tu,
    flowers: [f0, f1, f2],
    ripple: ri,
    wake: wa,
    heart: { full: hf, left: hl, right: hr, empty: he },
  };
}

/** The pond for a given size: sandy rim, water gradient, soft inner shadow. Cached per size. */
export function pondTexture(w: number, h: number, radius: number): Promise<Texture> {
  const B = 12;
  const W = w + B * 2;
  const H = h + B * 2;
  return svgTexture(
    `ducks:pond:${w}x${h}`,
    svg(
      W,
      H,
      `<defs>
        <linearGradient id="w" x1="0" y1="0" x2="0.25" y2="1"><stop offset="0" stop-color="#aee0f7"/><stop offset=".55" stop-color="#8fd0f0"/><stop offset="1" stop-color="#74bee6"/></linearGradient>
        <filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter>
        <clipPath id="c"><rect x="${B}" y="${B}" width="${w}" height="${h}" rx="${radius}"/></clipPath>
      </defs>
      <rect x="${B - 6}" y="${B - 2}" width="${w + 12}" height="${h + 12}" rx="${radius + 6}" fill="#4f8a43" opacity=".35" filter="url(#s)"/>
      <rect x="${B - 6}" y="${B - 6}" width="${w + 12}" height="${h + 12}" rx="${radius + 6}" fill="#e3d2a4"/>
      <rect x="${B - 6}" y="${B - 6}" width="${w + 12}" height="${h + 12}" rx="${radius + 6}" fill="none" stroke="#c9b582" stroke-width="2"/>
      <rect x="${B}" y="${B}" width="${w}" height="${h}" rx="${radius}" fill="url(#w)"/>
      <g clip-path="url(#c)">
        <rect x="${B}" y="${B}" width="${w}" height="${h}" rx="${radius}" fill="none" stroke="#2a7aa8" stroke-opacity=".45" stroke-width="16" filter="url(#b)"/>
        <ellipse cx="${B + w * 0.28}" cy="${B + h * 0.18}" rx="${w * 0.22}" ry="${h * 0.06}" fill="#fff" opacity=".12"/>
        <ellipse cx="${B + w * 0.7}" cy="${B + h * 0.62}" rx="${w * 0.18}" ry="${h * 0.05}" fill="#fff" opacity=".08"/>
      </g>`,
    ),
    W,
    H,
    2,
  );
}
export const POND_BORDER = 12;
