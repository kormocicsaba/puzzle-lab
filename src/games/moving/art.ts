/**
 * Moving Day art: hand-written SVG for every household item (64 units per grid cell, drawn in
 * the item's natural orientation and filling its cell shape), the fragile / heavy stickers, and
 * the per-room colour themes. Rasterised once per kind through the kit's svgTexture cache.
 */
import type { Kind, ThemeKey } from './levels.ts';

export const CELL = 64;
const INK = '#4a3226';

function svg(w: number, h: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w * CELL} ${h * CELL}" width="${w * CELL}" height="${h * CELL}">
<g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
}

/** Soft white highlight stripe (no outline). */
const shine = (x: number, y: number, w: number, h: number, r = 3, o = 0.35) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#fff" opacity="${o}" stroke="none"/>`;

const ART: Record<Kind, [w: number, h: number, body: string]> = {
  // ------------------------------------------------------------------ 1×1
  mug: [
    1,
    1,
    `<path d="M45 24 h5 a9 9 0 0 1 0 18 h-5" fill="none" stroke-width="6"/>
     <path d="M45 24 h5 a9 9 0 0 1 0 18 h-5" fill="none" stroke="#f4a261" stroke-width="2"/>
     <path d="M13 18 h33 v30 a8 8 0 0 1 -8 8 h-17 a8 8 0 0 1 -8 -8 z" fill="#e76f51"/>
     <path d="M13 30 h33 v8 h-33 z" fill="#fff4e0" stroke="none"/>
     <ellipse cx="29.5" cy="18" rx="16.5" ry="4" fill="#7a3322"/>
     ${shine(17, 23, 4, 26, 2)}
     <path d="M24 12 q-4 -4 0 -8 M33 12 q-4 -4 0 -8" fill="none" stroke="#c9b8a6" stroke-width="2.5"/>`,
  ],
  jar: [
    1,
    1,
    `<rect x="14" y="22" width="36" height="34" rx="9" fill="#f6b73c"/>
     <rect x="17" y="12" width="30" height="11" rx="3" fill="#d1495b"/>
     <path d="M20 12 v11 M26 12 v11 M32 12 v11 M38 12 v11 M44 12 v11" stroke="#fff" stroke-width="2" opacity=".6"/>
     <rect x="20" y="32" width="24" height="14" rx="3" fill="#fff8e7"/>
     <path d="M27 39 q5 -6 10 0 q-5 6 -10 0 z" fill="#f6b73c" stroke-width="2"/>
     ${shine(18, 26, 4, 22, 2)}`,
  ],
  clock: [
    1,
    1,
    `<path d="M20 50 l-5 8 M44 50 l5 8" stroke-width="4"/>
     <circle cx="17" cy="16" r="8" fill="#e9c46a"/><circle cx="47" cy="16" r="8" fill="#e9c46a"/>
     <circle cx="32" cy="34" r="21" fill="#2a9d8f"/>
     <circle cx="32" cy="34" r="15" fill="#fffaf0"/>
     <path d="M32 34 v-10 M32 34 l7 4" stroke-width="3"/>
     <circle cx="32" cy="34" r="2" fill="${INK}" stroke="none"/>
     <rect x="29" y="9" width="6" height="5" rx="1" fill="#e9c46a"/>`,
  ],
  duck: [
    1,
    1,
    `<path d="M10 38 q0 18 22 18 h8 q16 0 16 -14 q0 -8 -6 -8 q-10 0 -14 -2 q-14 -6 -26 6 z" fill="#ffd23f"/>
     <circle cx="25" cy="22" r="12" fill="#ffd23f"/>
     <path d="M9 22 q-6 2 0 7 q6 0 7 -4 z" fill="#f77f00"/>
     <circle cx="22" cy="19" r="2.4" fill="${INK}" stroke="none"/>
     <path d="M30 42 q8 6 16 0" fill="none" stroke-width="2.5"/>
     ${shine(30, 14, 4, 8, 2, 0.5)}`,
  ],
  ball: [
    1,
    1,
    `<circle cx="32" cy="34" r="23" fill="#fff"/>
     <path d="M32 34 L32 11 A23 23 0 0 1 52 45 Z" fill="#ef476f" stroke="none"/>
     <path d="M32 34 L52 45 A23 23 0 0 1 12 45 Z" fill="#ffd166" stroke="none"/>
     <path d="M32 34 L12 45 A23 23 0 0 1 32 11 Z" fill="#118ab2" stroke="none"/>
     <path d="M32 34 L32 11 M32 34 L52 45 M32 34 L12 45" stroke="#fff" stroke-width="5"/>
     <circle cx="32" cy="34" r="5" fill="#fff" stroke-width="2"/>
     <circle cx="32" cy="34" r="23" fill="none"/>
     ${shine(18, 22, 5, 5, 2.5, 0.7)}`,
  ],
  glass: [
    1,
    1,
    `<path d="M18 6 h28 q2 22 -14 26 q-16 -4 -14 -26 z" fill="#d7f0fa" opacity=".95"/>
     <path d="M19.5 16 h25 q-2 13 -12.5 15 q-10.5 -2 -12.5 -15 z" fill="#c1121f" stroke="none" opacity=".8"/>
     <path d="M18 6 h28 q2 22 -14 26 q-16 -4 -14 -26 z" fill="none"/>
     <path d="M32 32 v18" stroke-width="3.5"/>
     <ellipse cx="32" cy="54" rx="12" ry="4" fill="#d7f0fa"/>
     ${shine(22, 9, 3, 14, 1.5, 0.8)}`,
  ],
  globe: [
    1,
    1,
    `<path d="M14 46 h36 l4 12 h-44 z" fill="#8d5a3b"/>
     <circle cx="32" cy="29" r="21" fill="#cfe8f7"/>
     <path d="M14 38 q18 -6 36 0 q-6 10 -18 12 q-12 -2 -18 -12 z" fill="#fff" stroke="none"/>
     <path d="M26 38 v-8 l6 -6 l6 6 v8 z" fill="#e76f51" stroke-width="2"/>
     <path d="M24 31 l8 -9 l8 9" fill="none" stroke-width="2.5"/>
     <circle cx="20" cy="20" r="1.8" fill="#fff" stroke="none"/><circle cx="41" cy="16" r="1.5" fill="#fff" stroke="none"/>
     <circle cx="44" cy="28" r="1.8" fill="#fff" stroke="none"/><circle cx="27" cy="14" r="1.4" fill="#fff" stroke="none"/>
     <circle cx="32" cy="29" r="21" fill="none"/>
     ${shine(19, 15, 4, 10, 2, 0.8)}`,
  ],
  teapot: [
    1,
    1,
    `<path d="M48 30 q10 -4 10 -14" fill="none" stroke-width="5"/>
     <path d="M48 30 q10 -4 10 -14" fill="none" stroke="#fff" stroke-width="1.5"/>
     <path d="M15 30 q-9 2 -7 11 q2 6 9 5" fill="none" stroke-width="4"/>
     <path d="M12 38 q0 -18 20 -18 q20 0 20 18 q0 16 -20 16 q-20 0 -20 -16 z" fill="#fdfcf7"/>
     <path d="M14 42 q18 6 36 0" fill="none" stroke="#3a86ff" stroke-width="3"/>
     <circle cx="25" cy="34" r="2.5" fill="#3a86ff" stroke="none"/><circle cx="32" cy="31" r="2.5" fill="#3a86ff" stroke="none"/><circle cx="39" cy="34" r="2.5" fill="#3a86ff" stroke="none"/>
     <ellipse cx="32" cy="20" rx="11" ry="3.5" fill="#fdfcf7"/>
     <circle cx="32" cy="14" r="3.5" fill="#3a86ff"/>
     <rect x="20" y="56" width="24" height="3" rx="1.5" fill="${INK}" stroke="none"/>`,
  ],
  paint: [
    1,
    1,
    `<path d="M16 22 q16 -20 32 0" fill="none" stroke-width="3"/>
     <rect x="13" y="20" width="38" height="38" rx="5" fill="#adb5bd"/>
     <rect x="13" y="20" width="38" height="8" rx="3" fill="#6c757d"/>
     <path d="M13 28 h38 v6 q-4 0 -4 6 q0 4 -4 4 q-3 0 -3 -6 q0 -4 -6 -4 h-21 z" fill="#3a86ff"/>
     <rect x="18" y="40" width="20" height="12" rx="2" fill="#fff" opacity=".8" stroke="none"/>
     ${shine(46, 30, 3, 22, 1.5, 0.45)}`,
  ],
  // ------------------------------------------------------------------ 1×2 standing
  book: [
    1,
    2,
    `<rect x="15" y="8" width="34" height="114" rx="4" fill="#2a9d8f"/>
     <rect x="15" y="22" width="34" height="7" fill="#e9c46a"/>
     <rect x="15" y="100" width="34" height="7" fill="#e9c46a"/>
     <rect x="22" y="44" width="20" height="40" rx="2" fill="#fffaf0" stroke-width="2"/>
     <path d="M26 54 h12 M26 62 h12 M26 70 h8" stroke-width="2"/>
     ${shine(19, 12, 4, 104, 2, 0.3)}`,
  ],
  bottle: [
    1,
    2,
    `<rect x="26" y="4" width="12" height="9" rx="2" fill="#c1121f"/>
     <path d="M27 13 h10 v22 q11 8 11 22 v57 a7 7 0 0 1 -7 7 h-18 a7 7 0 0 1 -7 -7 v-57 q0 -14 11 -22 z" fill="#3f8f4f"/>
     <rect x="16" y="66" width="32" height="30" rx="3" fill="#fff4dc"/>
     <path d="M22 76 h20 M24 84 h16" stroke-width="2"/>
     ${shine(20, 54, 4, 56, 2, 0.35)}`,
  ],
  vase: [
    1,
    2,
    `<path d="M32 50 q-2 -24 -14 -34 M32 50 q2 -26 12 -36 M32 50 v-36" fill="none" stroke="#2d6a4f" stroke-width="3"/>
     <path d="M10 14 q4 -10 10 -2 q4 -8 8 2 q-2 9 -9 8 q-7 0 -9 -8 z" fill="#ef476f" stroke-width="2.5"/>
     <path d="M34 8 q4 -9 9 -1 q5 -8 9 2 q-2 9 -9 8 q-7 0 -9 -9 z" fill="#ffd166" stroke-width="2.5"/>
     <path d="M26 12 q6 -10 12 0 q-1 9 -6 9 q-5 0 -6 -9 z" fill="#ff8fab" stroke-width="2.5"/>
     <path d="M24 46 h16 v8 q14 10 14 34 q0 30 -22 30 q-22 0 -22 -30 q0 -24 14 -34 z" fill="#f1f6fb"/>
     <path d="M12 82 q20 8 40 0 M13 96 q19 8 38 0" fill="none" stroke="#1d4ed8" stroke-width="3"/>
     <circle cx="32" cy="74" r="4" fill="#1d4ed8" stroke="none"/>
     <rect x="23" y="44" width="18" height="5" rx="2" fill="#1d4ed8" stroke-width="2"/>
     ${shine(17, 66, 4, 30, 2, 0.6)}`,
  ],
  flour: [
    1,
    2,
    `<path d="M14 26 q-2 -10 6 -14 l4 -6 l4 6 l4 -6 l4 6 l4 -6 l4 6 q8 4 6 14 q6 30 4 86 a8 8 0 0 1 -8 8 h-28 a8 8 0 0 1 -8 -8 q-2 -56 4 -86 z" fill="#f2e6cf"/>
     <path d="M17 24 q15 6 30 0" fill="none" stroke="#c9a66b" stroke-width="4"/>
     <path d="M32 92 v-34 M32 66 q-8 -4 -8 -10 q8 2 8 10 M32 66 q8 -4 8 -10 q-8 2 -8 10 M32 78 q-8 -4 -8 -10 q8 2 8 10 M32 78 q8 -4 8 -10 q-8 2 -8 10" fill="#e9b949" stroke="#b07d2b" stroke-width="2"/>
     <rect x="18" y="98" width="28" height="7" rx="2" fill="#c1121f" stroke="none" opacity=".75"/>`,
  ],
  // ------------------------------------------------------------------ 2×1 lying
  shoes: [
    2,
    1,
    `<path d="M6 54 v-18 q0 -12 10 -14 q6 0 8 6 q8 6 20 8 q14 2 14 12 v6 z" fill="#ef476f"/>
     <rect x="5" y="50" width="54" height="8" rx="3" fill="#fff"/>
     <path d="M20 30 l6 6 M26 28 l6 6" stroke="#fff" stroke-width="2.5"/>
     <path d="M70 54 v-18 q0 -12 10 -14 q6 0 8 6 q8 6 20 8 q14 2 14 12 v6 z" fill="#118ab2"/>
     <rect x="69" y="50" width="54" height="8" rx="3" fill="#fff"/>
     <path d="M84 30 l6 6 M90 28 l6 6" stroke="#fff" stroke-width="2.5"/>`,
  ],
  plates: [
    2,
    1,
    `<ellipse cx="64" cy="52" rx="54" ry="6" fill="#f8f9fa"/>
     <ellipse cx="64" cy="44" rx="54" ry="6" fill="#f8f9fa"/>
     <ellipse cx="64" cy="36" rx="54" ry="6" fill="#f8f9fa"/>
     <ellipse cx="64" cy="28" rx="54" ry="6" fill="#f8f9fa"/>
     <ellipse cx="64" cy="20" rx="54" ry="6" fill="#f8f9fa"/>
     <ellipse cx="64" cy="20" rx="38" ry="3.2" fill="none" stroke="#4895ef" stroke-width="2.5"/>
     <path d="M12 30 q52 10 104 0 M12 38 q52 10 104 0 M12 46 q52 10 104 0" fill="none" stroke="#4895ef" stroke-width="2"/>`,
  ],
  toaster: [
    2,
    1,
    `<path d="M40 22 q4 -14 14 -12 q8 2 6 14 z M66 22 q4 -14 14 -12 q8 2 6 14 z" fill="#e9b872" stroke-width="2.5"/>
     <rect x="14" y="20" width="94" height="38" rx="14" fill="#a8dadc"/>
     <rect x="36" y="18" width="26" height="5" rx="2" fill="${INK}" stroke="none"/>
     <rect x="64" y="18" width="26" height="5" rx="2" fill="${INK}" stroke="none"/>
     <rect x="108" y="30" width="8" height="10" rx="2" fill="#e63946"/>
     <circle cx="30" cy="44" r="4" fill="#fff"/>
     ${shine(20, 26, 70, 4, 2, 0.6)}`,
  ],
  laptop: [
    2,
    1,
    `<rect x="24" y="6" width="80" height="44" rx="5" fill="#6c757d"/>
     <rect x="29" y="11" width="70" height="34" rx="2" fill="#90e0ef" stroke-width="2"/>
     <path d="M29 34 l18 -14 l14 10 l12 -8 l26 18 v5 h-70 z" fill="#48cae4" stroke="none"/>
     <path d="M12 50 h104 l-6 8 h-92 z" fill="#ced4da"/>
     <rect x="56" y="52" width="16" height="3" rx="1.5" fill="#6c757d" stroke="none"/>
     ${shine(32, 14, 22, 4, 2, 0.6)}`,
  ],
  towels: [
    2,
    1,
    `<rect x="12" y="40" width="104" height="17" rx="8" fill="#80ed99"/>
     <rect x="16" y="24" width="98" height="17" rx="8" fill="#ffafcc"/>
     <rect x="20" y="8" width="92" height="17" rx="8" fill="#a2d2ff"/>
     <path d="M40 8 v17 M46 8 v17 M38 24 v17 M44 24 v17 M36 40 v17 M42 40 v17" stroke="#fff" stroke-width="2.5" opacity=".8"/>`,
  ],
  radio: [
    2,
    1,
    `<path d="M88 22 l18 -18" stroke-width="3"/><circle cx="106" cy="4" r="3" fill="${INK}" stroke="none"/>
     <rect x="10" y="20" width="108" height="38" rx="10" fill="#e76f51"/>
     <circle cx="38" cy="39" r="13" fill="#3d2c24"/>
     <circle cx="34" cy="35" r="2" fill="#e9c46a" stroke="none"/><circle cx="42" cy="35" r="2" fill="#e9c46a" stroke="none"/>
     <circle cx="34" cy="43" r="2" fill="#e9c46a" stroke="none"/><circle cx="42" cy="43" r="2" fill="#e9c46a" stroke="none"/>
     <circle cx="38" cy="39" r="2" fill="#e9c46a" stroke="none"/>
     <rect x="60" y="29" width="44" height="12" rx="3" fill="#fff4dc" stroke-width="2"/>
     <path d="M66 29 v5 M74 29 v5 M82 29 v5 M90 29 v5 M98 29 v5" stroke-width="1.5"/>
     <circle cx="70" cy="49" r="4" fill="#3d2c24" stroke="none"/><circle cx="94" cy="49" r="4" fill="#3d2c24" stroke="none"/>`,
  ],
  eggs: [
    2,
    1,
    `<ellipse cx="28" cy="30" rx="12" ry="15" fill="#fff6e5"/>
     <ellipse cx="52" cy="28" rx="12" ry="15" fill="#f3d9b1"/>
     <ellipse cx="76" cy="30" rx="12" ry="15" fill="#fff6e5"/>
     <ellipse cx="100" cy="28" rx="12" ry="15" fill="#f3d9b1"/>
     <path d="M8 38 h112 l-6 20 h-100 z" fill="#c9b79c"/>
     <path d="M20 40 q8 10 16 0 M44 40 q8 10 16 0 M68 40 q8 10 16 0 M92 40 q8 10 16 0" fill="none" stroke-width="2.5"/>`,
  ],
  books: [
    2,
    1,
    `<rect x="12" y="42" width="104" height="15" rx="3" fill="#264653"/>
     <rect x="18" y="26" width="94" height="16" rx="3" fill="#e76f51"/>
     <rect x="10" y="9" width="100" height="17" rx="3" fill="#e9c46a"/>
     <path d="M100 42 v15 M104 26 v16 M24 9 v17" stroke="#fff" stroke-width="2.5" opacity=".7"/>
     <path d="M108 45 h6 v9 h-6 M110 29 h-6 M14 12 h-4" fill="#fff" stroke-width="2"/>`,
  ],
  toolbox: [
    2,
    1,
    `<path d="M44 22 v-10 h40 v10" fill="none" stroke-width="6"/>
     <path d="M44 22 v-10 h40 v10" fill="none" stroke="#adb5bd" stroke-width="2"/>
     <rect x="10" y="20" width="108" height="38" rx="5" fill="#d62828"/>
     <rect x="10" y="20" width="108" height="11" rx="4" fill="#f77f00"/>
     <rect x="56" y="32" width="16" height="8" rx="2" fill="#dee2e6"/>
     ${shine(16, 36, 90, 3, 1.5, 0.35)}`,
  ],
  pot: [
    2,
    1,
    `<path d="M14 32 h-8 v10 h8 M114 32 h8 v10 h-8" fill="#343a40" stroke-width="3"/>
     <path d="M14 26 h100 v20 q0 12 -14 12 h-72 q-14 0 -14 -12 z" fill="#343a40"/>
     <ellipse cx="64" cy="26" rx="52" ry="6" fill="#495057"/>
     <path d="M58 20 q6 -10 12 0" fill="#adb5bd"/>
     ${shine(22, 32, 6, 18, 3, 0.25)}`,
  ],
  // ------------------------------------------------------------------ 3×1, 1×3
  pan: [
    3,
    1,
    `<rect x="94" y="28" width="92" height="12" rx="6" fill="#6b4226"/>
     <circle cx="178" cy="34" r="2.5" fill="#fffaf0" stroke="none"/>
     <path d="M6 26 h92 q-2 26 -26 26 h-40 q-24 0 -26 -26 z" fill="#343a40"/>
     <ellipse cx="52" cy="26" rx="46" ry="5" fill="#495057"/>
     ${shine(20, 33, 50, 3, 1.5, 0.25)}`,
  ],
  train: [
    3,
    1,
    `<path d="M62 46 h10 M126 46 h10" stroke-width="4"/>
     <rect x="8" y="22" width="56" height="26" rx="4" fill="#e63946"/>
     <rect x="38" y="8" width="24" height="18" rx="3" fill="#e63946"/>
     <rect x="42" y="12" width="16" height="10" rx="2" fill="#a8dadc" stroke-width="2"/>
     <rect x="14" y="10" width="10" height="13" rx="2" fill="#343a40"/>
     <rect x="72" y="24" width="54" height="24" rx="4" fill="#457b9d"/>
     <rect x="136" y="24" width="50" height="24" rx="4" fill="#f4a261"/>
     <circle cx="80" cy="16" r="7" fill="#ffd166"/><circle cx="96" cy="16" r="7" fill="#06d6a0"/><circle cx="112" cy="17" r="6" fill="#ef476f"/>
     <path d="M140 24 l8 -12 h28 l6 12" fill="#e9c46a" stroke-width="2.5"/>
     <circle cx="22" cy="52" r="7" fill="#343a40"/><circle cx="50" cy="52" r="7" fill="#343a40"/>
     <circle cx="86" cy="52" r="7" fill="#343a40"/><circle cx="112" cy="52" r="7" fill="#343a40"/>
     <circle cx="150" cy="52" r="7" fill="#343a40"/><circle cx="174" cy="52" r="7" fill="#343a40"/>`,
  ],
  umbrella: [
    1,
    3,
    `<path d="M32 160 v20 q0 8 -8 8 q-7 0 -7 -7" fill="none" stroke-width="5"/>
     <path d="M32 160 v20 q0 8 -8 8 q-7 0 -7 -7" fill="none" stroke="#9c6644" stroke-width="2"/>
     <path d="M32 6 v8" stroke-width="3"/>
     <path d="M32 12 q14 20 14 80 q0 50 -8 70 h-12 q-8 -20 -8 -70 q0 -60 14 -80 z" fill="#7b2cbf"/>
     <path d="M32 12 q4 40 0 150 M32 12 q-4 40 0 150" fill="none" stroke-width="2"/>
     <path d="M20 90 q12 6 24 0" fill="none" stroke="#c77dff" stroke-width="5"/>
     <path d="M20 90 q12 6 24 0" fill="none" stroke-width="1.5" opacity=".4"/>`,
  ],
  // ------------------------------------------------------------------ 4×1, 1×4
  rug: [
    4,
    1,
    `<rect x="18" y="12" width="224" height="42" rx="6" fill="#bc4749"/>
     <path d="M48 12 v42 M72 12 v42 M120 12 v42 M144 12 v42 M192 12 v42 M216 12 v42" stroke="#f2e8cf" stroke-width="5"/>
     <path d="M96 12 v42 M168 12 v42" stroke="#386641" stroke-width="7"/>
     <rect x="18" y="12" width="224" height="42" rx="6" fill="none"/>
     <ellipse cx="18" cy="33" rx="12" ry="21" fill="#f2e8cf"/>
     <path d="M18 33 m-6 0 a6 9 0 1 0 12 0 a4 6 0 1 0 -8 0" fill="none" stroke-width="2.5"/>
     <path d="M244 20 l12 -2 M244 28 l12 0 M244 36 l12 2 M244 44 l12 4" stroke-width="2.5"/>`,
  ],
  skateboard: [
    4,
    1,
    `<circle cx="58" cy="50" r="9" fill="#ffd166"/><circle cx="198" cy="50" r="9" fill="#ffd166"/>
     <rect x="48" y="34" width="20" height="8" fill="#adb5bd"/><rect x="188" y="34" width="20" height="8" fill="#adb5bd"/>
     <path d="M6 24 q0 -10 12 -8 h220 q12 -2 12 8 q0 10 -12 10 h-220 q-12 0 -12 -10 z" fill="#06d6a0"/>
     <path d="M80 18 l20 14 M110 18 l20 14 M140 18 l20 14" stroke="#fff" stroke-width="4" opacity=".75"/>`,
  ],
  guitar: [
    1,
    4,
    `<rect x="24" y="4" width="16" height="30" rx="4" fill="#6b4226"/>
     <circle cx="21" cy="12" r="3" fill="#dee2e6" stroke-width="2"/><circle cx="21" cy="24" r="3" fill="#dee2e6" stroke-width="2"/>
     <circle cx="43" cy="12" r="3" fill="#dee2e6" stroke-width="2"/><circle cx="43" cy="24" r="3" fill="#dee2e6" stroke-width="2"/>
     <rect x="27" y="32" width="10" height="110" fill="#8d5a3b"/>
     <path d="M27 50 h10 M27 70 h10 M27 88 h10 M27 104 h10 M27 118 h10" stroke-width="1.5"/>
     <path d="M32 132 q24 -6 24 22 q0 12 -6 18 q12 10 12 36 q0 42 -30 42 q-30 0 -30 -42 q0 -26 12 -36 q-6 -6 -6 -18 q0 -28 24 -22 z" fill="#f4a261"/>
     <circle cx="32" cy="186" r="10" fill="#3d2c24"/>
     <rect x="22" y="216" width="20" height="6" rx="2" fill="#6b4226"/>
     <path d="M30 34 v186 M34 34 v186" stroke="#fffaf0" stroke-width="1" opacity=".8"/>`,
  ],
  // ------------------------------------------------------------------ 2×2, 3×2
  teddy: [
    2,
    2,
    `<circle cx="38" cy="20" r="11" fill="#b5835a"/><circle cx="90" cy="20" r="11" fill="#b5835a"/>
     <circle cx="38" cy="20" r="5" fill="#e6b89c" stroke="none"/><circle cx="90" cy="20" r="5" fill="#e6b89c" stroke="none"/>
     <ellipse cx="64" cy="92" rx="38" ry="30" fill="#b5835a"/>
     <ellipse cx="64" cy="96" rx="20" ry="17" fill="#e6b89c" stroke="none"/>
     <ellipse cx="26" cy="112" rx="14" ry="10" fill="#b5835a"/><ellipse cx="102" cy="112" rx="14" ry="10" fill="#b5835a"/>
     <ellipse cx="24" cy="84" rx="10" ry="14" fill="#b5835a"/><ellipse cx="104" cy="84" rx="10" ry="14" fill="#b5835a"/>
     <circle cx="64" cy="44" r="28" fill="#b5835a"/>
     <ellipse cx="64" cy="53" rx="12" ry="9" fill="#e6b89c"/>
     <ellipse cx="64" cy="49" rx="5" ry="3.5" fill="${INK}" stroke="none"/>
     <path d="M64 53 v4 q-4 4 -7 1 M64 57 q4 4 7 1" fill="none" stroke-width="2.2"/>
     <circle cx="52" cy="38" r="3.4" fill="${INK}" stroke="none"/><circle cx="76" cy="38" r="3.4" fill="${INK}" stroke="none"/>
     <path d="M52 72 l12 6 l12 -6 l-4 10 h-16 z" fill="#e63946" stroke-width="2.5"/>`,
  ],
  backpack: [
    2,
    2,
    `<path d="M48 22 q0 -16 16 -16 q16 0 16 16" fill="none" stroke-width="6"/>
     <path d="M48 22 q0 -16 16 -16 q16 0 16 16" fill="none" stroke="#3a86ff" stroke-width="2"/>
     <rect x="18" y="20" width="92" height="102" rx="26" fill="#3a86ff"/>
     <path d="M18 54 q46 -16 92 0" fill="none" stroke-width="3"/>
     <rect x="34" y="72" width="60" height="40" rx="12" fill="#ffbe0b"/>
     <path d="M38 84 h52" stroke-width="2.5"/>
     <rect x="58" y="78" width="12" height="10" rx="3" fill="#fff"/>
     ${shine(26, 30, 6, 30, 3, 0.35)}`,
  ],
  microwave: [
    2,
    2,
    `<rect x="6" y="18" width="116" height="94" rx="10" fill="#e9ecef"/>
     <rect x="16" y="30" width="72" height="70" rx="6" fill="#343a40"/>
     <rect x="22" y="36" width="60" height="58" rx="4" fill="#495057" stroke="none"/>
     <ellipse cx="52" cy="82" rx="18" ry="5" fill="#ffd166" stroke-width="2"/>
     <rect x="94" y="30" width="20" height="14" rx="2" fill="#80ed99" stroke-width="2"/>
     <circle cx="104" cy="58" r="5" fill="#adb5bd" stroke-width="2"/><circle cx="104" cy="74" r="5" fill="#adb5bd" stroke-width="2"/>
     <rect x="96" y="86" width="16" height="8" rx="2" fill="#adb5bd" stroke-width="2"/>
     <rect x="22" y="112" width="12" height="6" rx="2" fill="${INK}" stroke="none"/><rect x="94" y="112" width="12" height="6" rx="2" fill="${INK}" stroke="none"/>
     <path d="M28 44 l18 -6 M28 52 l26 -10" stroke="#fff" stroke-width="3" opacity=".3"/>`,
  ],
  mirror: [
    2,
    2,
    `<rect x="10" y="8" width="108" height="112" rx="50" fill="#e9c46a"/>
     <rect x="20" y="18" width="88" height="92" rx="42" fill="#cdeffd"/>
     <path d="M40 46 l24 -18 M38 66 l40 -32 M70 96 l22 -18" stroke="#fff" stroke-width="6" opacity=".85"/>
     <circle cx="64" cy="12" r="5" fill="#e76f51"/>
     <rect x="10" y="8" width="108" height="112" rx="50" fill="none"/>`,
  ],
  crate: [
    2,
    2,
    `<circle cx="38" cy="40" r="30" fill="#212529"/><circle cx="38" cy="40" r="10" fill="#ef476f"/>
     <circle cx="76" cy="36" r="30" fill="#212529"/><circle cx="76" cy="36" r="10" fill="#ffd166"/>
     <rect x="58" y="16" width="44" height="50" rx="2" fill="#4cc9f0" transform="rotate(8 80 40)"/>
     <rect x="8" y="50" width="112" height="70" rx="4" fill="#c08552"/>
     <path d="M8 74 h112 M8 98 h112" stroke-width="3"/>
     <rect x="50" y="58" width="28" height="10" rx="5" fill="#3d2c24" stroke="none"/>
     <path d="M14 56 v58 M114 56 v58" stroke="#8c5a3c" stroke-width="3"/>`,
  ],
  tire: [
    2,
    2,
    `<circle cx="64" cy="64" r="56" fill="#2b2d42"/>
     <circle cx="64" cy="64" r="56" fill="none" stroke="#495057" stroke-width="8" stroke-dasharray="10 8"/>
     <circle cx="64" cy="64" r="56" fill="none"/>
     <circle cx="64" cy="64" r="30" fill="#adb5bd"/>
     <circle cx="64" cy="64" r="10" fill="#6c757d"/>
     <circle cx="64" cy="44" r="3.5" fill="#495057" stroke="none"/><circle cx="83" cy="58" r="3.5" fill="#495057" stroke="none"/>
     <circle cx="76" cy="80" r="3.5" fill="#495057" stroke="none"/><circle cx="52" cy="80" r="3.5" fill="#495057" stroke="none"/>
     <circle cx="45" cy="58" r="3.5" fill="#495057" stroke="none"/>
     <path d="M30 40 a40 40 0 0 1 22 -18" fill="none" stroke="#fff" stroke-width="5" opacity=".25"/>`,
  ],
  tv: [
    3,
    2,
    `<path d="M80 112 l-14 12 M112 112 l14 12" stroke-width="5"/>
     <rect x="8" y="8" width="176" height="106" rx="10" fill="#343a40"/>
     <rect x="18" y="18" width="156" height="86" rx="4" fill="#4cc9f0"/>
     <path d="M18 84 q30 -22 60 -8 q30 14 50 -10 q22 -20 46 -6 v44 h-156 z" fill="#80ed99" stroke="none"/>
     <circle cx="142" cy="40" r="11" fill="#ffd166" stroke="none"/>
     <path d="M30 32 l26 -10 M30 44 l40 -16" stroke="#fff" stroke-width="5" opacity=".5"/>
     <rect x="18" y="18" width="156" height="86" rx="4" fill="none"/>`,
  ],
  // ------------------------------------------------------------------ odd shapes
  lamp: [
    2,
    3,
    `<ellipse cx="32" cy="182" rx="24" ry="6" fill="#264653"/>
     <path d="M32 176 v-150 q0 -10 10 -10 h40" fill="none" stroke-width="7"/>
     <path d="M32 176 v-150 q0 -10 10 -10 h40" fill="none" stroke="#e9c46a" stroke-width="3"/>
     <path d="M70 10 h44 l10 40 h-64 z" fill="#2a9d8f"/>
     <ellipse cx="92" cy="54" rx="12" ry="5" fill="#ffe066"/>
     <path d="M70 10 l-4 14 M114 10 l4 14" stroke="#fff" stroke-width="2" opacity=".4"/>
     <circle cx="32" cy="160" r="4" fill="#e9c46a"/>`,
  ],
  hairdryer: [
    2,
    2,
    `<path d="M22 50 h26 l-6 64 a6 6 0 0 1 -6 6 h-4 a6 6 0 0 1 -6 -6 z" fill="#ff8fab"/>
     <path d="M34 120 q0 6 6 6" fill="none" stroke-width="3"/>
     <rect x="28" y="70" width="10" height="16" rx="3" fill="#fff" stroke-width="2"/>
     <path d="M10 14 h70 q20 0 20 20 q0 20 -20 20 h-70 q-6 0 -6 -6 v-28 q0 -6 6 -6 z" fill="#ff8fab"/>
     <path d="M98 20 h22 v28 h-22 z" fill="#adb5bd"/>
     <path d="M12 22 v24 M18 22 v24" stroke-width="2.5"/>
     ${shine(30, 20, 50, 5, 2.5, 0.45)}`,
  ],
  blocks: [
    2,
    2,
    `<rect x="8" y="8" width="50" height="50" rx="6" fill="#ffd166"/>
     <path d="M22 46 l11 -28 l11 28 M26 36 h14" fill="none" stroke-width="4"/>
     <rect x="8" y="70" width="50" height="50" rx="6" fill="#ef476f"/>
     <path d="M24 82 v26 h8 q10 0 10 -7 q0 -6 -9 -6 q8 0 8 -6 q0 -7 -9 -7 z" fill="#fff" stroke-width="3"/>
     <rect x="70" y="70" width="50" height="50" rx="6" fill="#118ab2"/>
     <path d="M106 86 q-4 -6 -11 -6 q-12 0 -12 15 q0 15 12 15 q7 0 11 -6" fill="none" stroke="#fff" stroke-width="4"/>`,
  ],
  hockey: [
    2,
    3,
    `<path d="M26 8 h14 l2 140 q2 20 22 22 h52 a6 6 0 0 1 6 6 v6 a6 6 0 0 1 -6 6 h-62 q-30 0 -30 -30 z" fill="#d4a373"/>
     <path d="M26 8 h14 v40 h-14 z" fill="#343a40"/>
     <path d="M70 170 h44 v14 h-44 z" fill="#f8f9fa" stroke-width="2"/>
     <path d="M78 170 v14 M88 170 v14 M98 170 v14" stroke-width="1.5"/>
     <path d="M30 56 v90" stroke="#fff" stroke-width="2.5" opacity=".45"/>`,
  ],
  plant: [
    3,
    2,
    `<path d="M74 70 h44 l-6 52 h-32 z" fill="#e76f51"/>
     <rect x="70" y="68" width="52" height="12" rx="3" fill="#f4a261"/>
     <path d="M96 70 q-40 -10 -84 -40 q30 -6 54 6 q-10 -20 -4 -32 q24 10 28 36 q6 -30 36 -36 q2 20 -14 38 q30 -14 64 -4 q-30 24 -80 32 z" fill="#52b788"/>
     <path d="M96 68 q-30 -14 -64 -30 M96 68 q-4 -24 -18 -52 M96 68 q12 -26 30 -40 M96 68 q30 -10 62 -14" fill="none" stroke="#2d6a4f" stroke-width="2.5"/>`,
  ],
  chair: [
    2,
    3,
    `<rect x="14" y="8" width="16" height="176" rx="4" fill="#bc6c25"/>
     <rect x="14" y="16" width="16" height="10" fill="#dda15e" stroke-width="2"/>
     <rect x="14" y="46" width="16" height="10" fill="#dda15e" stroke-width="2"/>
     <rect x="14" y="76" width="16" height="10" fill="#dda15e" stroke-width="2"/>
     <rect x="100" y="116" width="14" height="68" rx="4" fill="#bc6c25"/>
     <rect x="8" y="98" width="112" height="20" rx="6" fill="#dda15e"/>
     <rect x="12" y="88" width="104" height="12" rx="6" fill="#e63946"/>
     <path d="M30 150 h70" stroke-width="5"/>
     <path d="M30 150 h70" stroke="#dda15e" stroke-width="2"/>`,
  ],
  castle: [
    3,
    2,
    `<rect x="6" y="80" width="180" height="42" rx="3" fill="#f4a261"/>
     <path d="M6 80 v-8 h18 v8 h16 v-8 h18 v8 M134 80 v-8 h18 v8 h16 v-8 h18 v8" fill="#f4a261"/>
     <path d="M76 122 v-22 q20 -16 40 0 v22 z" fill="#6b4226"/>
     <rect x="8" y="26" width="48" height="56" fill="#e9c46a"/>
     <path d="M8 26 v-10 h12 v10 h12 v-10 h12 v10 h12 v-10" fill="#e9c46a"/>
     <rect x="136" y="26" width="48" height="56" fill="#e9c46a"/>
     <path d="M136 26 v-10 h12 v10 h12 v-10 h12 v10 h12 v-10" fill="#e9c46a"/>
     <path d="M32 16 v-12 l14 5 l-14 5 M160 16 v-12 l14 5 l-14 5" fill="#e63946" stroke-width="2.5"/>
     <rect x="26" y="40" width="12" height="18" rx="6" fill="#3d2c24" stroke="none"/>
     <rect x="154" y="40" width="12" height="18" rx="6" fill="#3d2c24" stroke="none"/>`,
  ],
  horse: [
    3,
    2,
    `<path d="M4 112 q92 30 184 0" fill="none" stroke-width="7"/>
     <path d="M4 112 q92 30 184 0" fill="none" stroke="#bc4749" stroke-width="3"/>
     <path d="M46 100 l-6 18 M132 100 l6 18" stroke-width="5"/>
     <path d="M26 84 q-14 6 -18 22 q14 -2 20 -14" fill="#6b4226"/>
     <path d="M134 72 q-4 -34 10 -52 q8 -12 22 -8 l16 14 q4 6 -2 10 l-14 0 l-6 34 z" fill="#fefae0"/>
     <path d="M24 86 q0 -18 18 -18 h96 q14 0 18 10 l4 10 q2 14 -12 14 h-108 q-16 0 -16 -16 z" fill="#fefae0"/>
     <circle cx="60" cy="82" r="5" fill="#bc4749" stroke="none"/><circle cx="88" cy="90" r="5" fill="#bc4749" stroke="none"/><circle cx="114" cy="80" r="5" fill="#bc4749" stroke="none"/>
     <path d="M142 18 q-12 12 -12 46 l8 0 q0 -30 12 -42 z" fill="#6b4226"/>
     <path d="M152 10 l2 -7 l7 9" fill="#fefae0"/>
     <circle cx="166" cy="22" r="2.8" fill="${INK}" stroke="none"/>
     <path d="M100 70 v-4 h10 v4" fill="#bc4749" stroke-width="2.5"/>`,
  ],
  table: [
    3,
    2,
    `<rect x="12" y="56" width="16" height="66" rx="3" fill="#a3683f"/>
     <rect x="164" y="56" width="16" height="66" rx="3" fill="#a3683f"/>
     <rect x="20" y="36" width="152" height="26" rx="3" fill="#bc6c25"/>
     <rect x="76" y="42" width="40" height="14" rx="3" fill="#dda15e" stroke-width="2"/>
     <circle cx="96" cy="49" r="2.5" fill="${INK}" stroke="none"/>
     <rect x="4" y="22" width="184" height="16" rx="5" fill="#dda15e"/>
     <ellipse cx="44" cy="14" rx="14" ry="8" fill="#fefae0"/>
     <path d="M34 14 q10 -14 20 0" fill="#90be6d" stroke-width="2"/>
     ${shine(12, 26, 120, 3, 1.5, 0.45)}`,
  ],
  sofa: [
    4,
    2,
    `<rect x="8" y="22" width="48" height="102" rx="16" fill="#1d3557"/>
     <rect x="200" y="22" width="48" height="102" rx="16" fill="#1d3557"/>
     <rect x="48" y="68" width="160" height="32" rx="10" fill="#457b9d"/>
     <rect x="60" y="70" width="24" height="22" rx="6" fill="#ffb703" transform="rotate(-10 72 81)"/>
     <rect x="52" y="88" width="76" height="24" rx="9" fill="#a8dadc"/>
     <rect x="128" y="88" width="76" height="24" rx="9" fill="#a8dadc"/>
     <rect x="52" y="110" width="152" height="12" rx="4" fill="#1d3557"/>
     ${shine(16, 32, 6, 40, 3, 0.25)}${shine(208, 32, 6, 40, 3, 0.25)}`,
  ],
};

export function itemArt(kind: Kind): { svg: string; w: number; h: number } {
  const [w, h, body] = ART[kind];
  return { svg: svg(w, h, body), w: w * CELL, h: h * CELL };
}

/** Red "glass, handle with care" sticker. */
export const FRAGILE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
<rect x="2" y="3" width="36" height="35" rx="8" fill="#9d0208"/>
<rect x="2" y="1" width="36" height="35" rx="8" fill="#e63946" stroke="#fff" stroke-width="3"/>
<path d="M13 8 h14 q1 11 -7 13 q-8 -2 -7 -13 z" fill="#fff"/>
<path d="M20 21 v7 M15 30 h10" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
<path d="M17 10 l3 4 l-2 3" stroke="#e63946" stroke-width="1.6" fill="none" stroke-linecap="round"/>
</svg>`;

/** Dark "heavy" weight badge. */
export const HEAVY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
<rect x="2" y="3" width="36" height="35" rx="8" fill="#1b1b1b"/>
<rect x="2" y="1" width="36" height="35" rx="8" fill="#3d405b" stroke="#fff" stroke-width="3"/>
<path d="M15 14 a5 5 0 0 1 10 0" fill="none" stroke="#fff" stroke-width="3"/>
<path d="M10 30 l3 -14 h14 l3 14 z" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
<text x="20" y="28" font-family="Arial, sans-serif" font-size="8" font-weight="700" fill="#3d405b" text-anchor="middle">KG</text>
</svg>`;

// ------------------------------------------------------------------------------------------------
// Rooms

export type WallPattern = 'stripes' | 'dots' | 'tiles' | 'plain' | 'brick' | 'panel' | 'diamonds' | 'flowers';
export type FloorKind = 'wood' | 'tiles' | 'concrete' | 'carpet';

export interface Theme {
  wall: number;
  wall2: number;
  pattern: WallPattern;
  floor: number;
  floor2: number;
  floorKind: FloorKind;
  rug: number;
  rug2: number;
  /** Buttons, fill meter. */
  accent: number;
  /** Title text over the wall. */
  ink: number;
}

export const THEMES: Record<ThemeKey, Theme> = {
  hallway: { wall: 0xf3e3c3, wall2: 0xe9d3ab, pattern: 'stripes', floor: 0xc58b5a, floor2: 0xa8714a, floorKind: 'wood', rug: 0x9c4f46, rug2: 0xe8c07d, accent: 0xe07a5f, ink: 0x5a3d2b },
  kitchen: { wall: 0xd8eedf, wall2: 0xffffff, pattern: 'tiles', floor: 0xf1e3c8, floor2: 0x8fb8a8, floorKind: 'tiles', rug: 0x3d7068, rug2: 0xf6d57a, accent: 0x2a9d8f, ink: 0x2f4f4a },
  bathroom: { wall: 0xd3ecf5, wall2: 0xffffff, pattern: 'tiles', floor: 0xe8f1f2, floor2: 0xb9d6dc, floorKind: 'tiles', rug: 0x5fa8d3, rug2: 0xffffff, accent: 0x3a86c8, ink: 0x2c4a5a },
  kids: { wall: 0xfde2e4, wall2: 0xfad0d6, pattern: 'dots', floor: 0xd9a86c, floor2: 0xbb8a52, floorKind: 'wood', rug: 0x8ecae6, rug2: 0xffd166, accent: 0xef476f, ink: 0x6b2c3e },
  study: { wall: 0x2f4858, wall2: 0x355366, pattern: 'panel', floor: 0x9c6b46, floor2: 0x7f5536, floorKind: 'wood', rug: 0xa23e48, rug2: 0xe9c46a, accent: 0xe9a23b, ink: 0xfdf0d5 },
  bedroom: { wall: 0xe6dcf5, wall2: 0xd9ccef, pattern: 'flowers', floor: 0xcdb4db, floor2: 0xbfa3d0, floorKind: 'carpet', rug: 0xffffff, rug2: 0xb8a1d9, accent: 0x8e6cc7, ink: 0x473660 },
  dining: { wall: 0xf6d6b8, wall2: 0xeec39d, pattern: 'diamonds', floor: 0xb5774a, floor2: 0x95603b, floorKind: 'wood', rug: 0x7a4b8f, rug2: 0xf1c27d, accent: 0xd1495b, ink: 0x5c2e2e },
  cupboards: { wall: 0xfff1d0, wall2: 0xf6e1b1, pattern: 'stripes', floor: 0xe5d4b5, floor2: 0xc9b38d, floorKind: 'tiles', rug: 0xe07a5f, rug2: 0xfff1d0, accent: 0xf08c3c, ink: 0x6b4b22 },
  closet: { wall: 0xe3e8d6, wall2: 0xd4dbc2, pattern: 'panel', floor: 0xc9a27a, floor2: 0xad865f, floorKind: 'wood', rug: 0x6a994e, rug2: 0xf2e8cf, accent: 0x6a994e, ink: 0x3b4a2f },
  garage: { wall: 0xb8bfc6, wall2: 0xa4acb4, pattern: 'brick', floor: 0x8d949b, floor2: 0x7a8188, floorKind: 'concrete', rug: 0x5c636a, rug2: 0xf2c14e, accent: 0xf2a541, ink: 0x2b3036 },
  workshop: { wall: 0xc9b79c, wall2: 0xb8a586, pattern: 'panel', floor: 0x9a9184, floor2: 0x857c70, floorKind: 'concrete', rug: 0x7f5539, rug2: 0xe6b655, accent: 0xd9822b, ink: 0x3d2f22 },
  pantry: { wall: 0xfbe7c6, wall2: 0xf4d6a6, pattern: 'dots', floor: 0xd8b08c, floor2: 0xbd9068, floorKind: 'tiles', rug: 0xa44a3f, rug2: 0xf5d0a9, accent: 0xc8553d, ink: 0x5e3a22 },
  den: { wall: 0x7d9d8c, wall2: 0x6f8e7d, pattern: 'stripes', floor: 0xa47148, floor2: 0x8a5d39, floorKind: 'wood', rug: 0xc8553d, rug2: 0xf6e6c5, accent: 0xf28f3b, ink: 0xfdf6e9 },
  music: { wall: 0x3a3557, wall2: 0x443f66, pattern: 'diamonds', floor: 0x8a5a44, floor2: 0x704634, floorKind: 'wood', rug: 0xd4a373, rug2: 0x6d597a, accent: 0xb5838d, ink: 0xfdf0d5 },
  nursery: { wall: 0xdff3e4, wall2: 0xc9ead1, pattern: 'flowers', floor: 0xf0e2cf, floor2: 0xe4d0b6, floorKind: 'carpet', rug: 0xffc8dd, rug2: 0xbde0fe, accent: 0x52b788, ink: 0x2d5a45 },
  attic: { wall: 0xd7b98e, wall2: 0xc6a678, pattern: 'panel', floor: 0xae8259, floor2: 0x936944, floorKind: 'wood', rug: 0x6b705c, rug2: 0xddbea9, accent: 0xcb997e, ink: 0x4a3423 },
  living: { wall: 0xffe5c2, wall2: 0xffd59e, pattern: 'stripes', floor: 0xc28654, floor2: 0xa46d40, floorKind: 'wood', rug: 0x2a9d8f, rug2: 0xf4a261, accent: 0xe76f51, ink: 0x5a3d2b },
};
