/**
 * Sushi Loop art: hand-written SVG rasterised once into cached textures (kit svgTexture).
 * Faces are drawn in code (main.ts) so diners can blink, chew and smile.
 */
import type { Texture } from 'pixi.js';
import { svgTexture } from '../../kit';
import type { Plate } from './logic.ts';

/** Plate rim colours: every dish has its own colour AND its own shape on top. */
export const RIM: Record<Plate, number> = {
  S: 0xff7a45,
  T: 0x9d74e6,
  M: 0x4cb35a,
  O: 0x4d86ee,
  E: 0xef5d8f,
  G: 0xffc233,
};

export const DISH_NAME: Record<Plate, string> = {
  S: 'salmon',
  T: 'tamago',
  M: 'maki',
  O: 'onigiri',
  E: 'ebi',
  G: "chef's special",
};

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const NORI = '#2f3a33';

function plateSvg(p: Plate): string {
  const rim = hex(RIM[p]);
  const gold = p === 'G';
  const base = `
<circle cx="20" cy="21.6" r="18.4" fill="#000" opacity=".14"/>
<circle cx="20" cy="20" r="18.4" fill="${gold ? 'url(#gold)' : rim}"/>
<circle cx="20" cy="20" r="16.2" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.2" ${gold ? 'stroke-dasharray="2 2.6"' : ''}/>
<circle cx="20" cy="20" r="13.6" fill="#fffaf2"/>
<path d="M9 14 A13 13 0 0 1 20 7" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>`;
  const rice = `<rect x="10.5" y="18" width="19" height="10" rx="5" fill="#fff" stroke="#e7dccb" stroke-width=".8"/>`;
  let dish = '';
  switch (p) {
    case 'S':
      dish = `${rice}
<path d="M9 18 C9 12 14 11.5 20 11.5 C27 11.5 31 12.5 31 17 C31 21.5 27 22 20 22 C13 22 9 21.5 9 18Z" fill="#ff8a5b"/>
<path d="M13 21 L17 12.4 M18.5 21.6 L22.5 12 M24 21.4 L27.6 12.6" stroke="#ffd0b8" stroke-width="1.6" stroke-linecap="round"/>`;
      break;
    case 'T':
      dish = `${rice}
<rect x="9.5" y="11.5" width="21" height="11" rx="2.6" fill="#ffd54a"/>
<rect x="9.5" y="11.5" width="21" height="3.6" rx="1.8" fill="#ffe58a"/>
<rect x="17" y="10.5" width="6" height="18.5" rx="1.2" fill="${NORI}"/>`;
      break;
    case 'M':
      dish = [
        [14.2, 16.2],
        [25.8, 16.2],
        [20, 25.6],
      ]
        .map(
          ([x, y]) =>
            `<circle cx="${x}" cy="${y + 0.8}" r="6.2" fill="#000" opacity=".12"/><circle cx="${x}" cy="${y}" r="6.2" fill="${NORI}"/><circle cx="${x}" cy="${y}" r="4.6" fill="#fff"/><circle cx="${x}" cy="${y}" r="2.1" fill="#5cc46a"/>`,
        )
        .join('');
      break;
    case 'O':
      dish = `
<path d="M20 9.5 L30 27 L10 27 Z" fill="#fff" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>
<path d="M20 9.5 L30 27 L10 27 Z" fill="none" stroke="#e7dccb" stroke-width="7.4" stroke-linejoin="round" opacity=".45"/>
<path d="M20 9.5 L30 27 L10 27 Z" fill="#fff" stroke="#fff" stroke-width="5.6" stroke-linejoin="round"/>
<rect x="14.5" y="21.5" width="11" height="9.5" rx="1.6" fill="${NORI}"/>
<circle cx="18" cy="15.5" r=".8" fill="#3d3a50"/><circle cx="22" cy="17" r=".8" fill="#3d3a50"/>`;
      break;
    case 'E':
      dish = `${rice}
<path d="M12 18 C12 12 20 10.5 26 12.5 C30 14 30.5 18 28 20.5 C25 23 17 23 12 20.5Z" fill="#ff9472"/>
<path d="M16 21.8 C16.5 17 16.5 14 17 12 M20.5 22.2 C21 18 21 14 21.4 11.5 M25 21.2 C25.5 18 25.4 15 25.6 12.6" stroke="#fff" stroke-width="1.5" opacity=".85" fill="none"/>
<path d="M12.5 19.4 L7.5 15 L8 21 L6.5 25 L12.6 21.6Z" fill="#e2462c"/>`;
      break;
    case 'G':
      dish = `${rice}
<path d="M9 18 C9 12 14 11.5 20 11.5 C27 11.5 31 12.5 31 17 C31 21.5 27 22 20 22 C13 22 9 21.5 9 18Z" fill="#e8405a"/>
<path d="M13 15 C17 13.5 23 13.5 28 15" stroke="#ff8a9b" stroke-width="1.4" fill="none" stroke-linecap="round"/>
<path d="M20 9 L21.6 13.4 L26 13.6 L22.5 16.3 L23.8 20.6 L20 18.1 L16.2 20.6 L17.5 16.3 L14 13.6 L18.4 13.4Z" fill="#ffd23f" stroke="#e09a00" stroke-width=".9" stroke-linejoin="round"/>`;
      break;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><defs><linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe680"/><stop offset=".5" stop-color="#ffc233"/><stop offset="1" stop-color="#f29e00"/></linearGradient></defs>${base}${dish}</svg>`;
}

export interface Look {
  skin: string;
  hair: string;
  style: 'short' | 'bob' | 'bun' | 'spiky' | 'long' | 'cap';
  shirt: string;
  cap?: string;
  glasses?: boolean;
}

export const LOOKS: Look[] = [
  { skin: '#ffdcc2', hair: '#3b2a22', style: 'short', shirt: '#6cc3c1' },
  { skin: '#f3c29b', hair: '#2b2b3a', style: 'bob', shirt: '#f28b82' },
  { skin: '#d9a074', hair: '#e0a84a', style: 'bun', shirt: '#9f8cf0' },
  { skin: '#a8714f', hair: '#2b2b3a', style: 'spiky', shirt: '#ffc145' },
  { skin: '#ffdcc2', hair: '#c0563a', style: 'long', shirt: '#5fa8f0' },
  { skin: '#f3c29b', hair: '#6b3d1f', style: 'cap', cap: '#ef5d8f', shirt: '#7fd1a0' },
  { skin: '#d9a074', hair: '#9aa0a8', style: 'short', shirt: '#f59e6b', glasses: true },
  { skin: '#a8714f', hair: '#3b2a22', style: 'bun', shirt: '#f6a5c0' },
];

const FRINGE = 'M13 30 C12 12 22 9 30 9 C40 9 48 13 47 30 C44 22 38 19 30 20 C24 20 16 22 13 30Z';

function hair(l: Look): { back: string; front: string } {
  const f = `fill="${l.hair}"`;
  switch (l.style) {
    case 'short':
      return { back: '', front: `<path d="${FRINGE}" ${f}/>` };
    case 'bun':
      return { back: `<circle cx="30" cy="9" r="7.5" ${f}/>`, front: `<path d="${FRINGE}" ${f}/>` };
    case 'bob':
      return {
        back: '',
        front: `<path d="M10.5 41 C8 12 20 8 30 8 C40 8 52 12 49.5 41 L44.5 41 C46 26 40 20.5 30 20.5 C20 20.5 14 26 15.5 41Z" ${f}/>`,
      };
    case 'spiky':
      return {
        back: '',
        front: `<path d="M13 30 L11.5 16 L18 19.5 L19.5 8 L26 15 L30 4.5 L34 15 L40.5 8 L42 19.5 L48.5 16 L47 30 C44 22 38 19 30 20 C22 19 16 22 13 30Z" ${f}/>`,
      };
    case 'long':
      return {
        back: `<path d="M10.5 60 C5 30 12 8 30 8 C48 8 55 30 49.5 60 Z" ${f}/>`,
        front: `<path d="${FRINGE}" ${f}/>`,
      };
    case 'cap':
      return {
        back: '',
        front: `<path d="${FRINGE}" ${f}/><path d="M12.5 25 C12.5 8 47.5 8 47.5 25 Z" fill="${l.cap}"/><ellipse cx="30" cy="25" rx="21" ry="4" fill="${l.cap}"/><ellipse cx="30" cy="24" rx="19" ry="2.2" fill="#fff" opacity=".25"/><circle cx="30" cy="10" r="2" fill="#fff" opacity=".6"/>`,
      };
  }
}

function dinerSvg(l: Look): string {
  const h = hair(l);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 76">
${h.back}
<path d="M5 76 C5 59 14 51 30 51 C46 51 55 59 55 76 Z" fill="${l.shirt}"/>
<path d="M5 76 C5 59 14 51 30 51 C46 51 55 59 55 76 Z" fill="none" stroke="#000" stroke-opacity=".08" stroke-width="2"/>
<path d="M20 54 C24 60 36 60 40 54" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>
<rect x="25.5" y="42" width="9" height="12" rx="4" fill="${l.skin}"/>
<circle cx="13.5" cy="32" r="4" fill="${l.skin}"/><circle cx="46.5" cy="32" r="4" fill="${l.skin}"/>
<circle cx="30" cy="30" r="17" fill="${l.skin}"/>
<ellipse cx="24" cy="19" rx="6" ry="3" fill="#fff" opacity=".18"/>
${h.front}
${l.glasses ? '<g fill="none" stroke="#3d3a50" stroke-width="1.4"><circle cx="24" cy="31" r="4.6"/><circle cx="36" cy="31" r="4.6"/><path d="M28.6 31 H31.4"/></g>' : ''}
</svg>`;
}

const COURIER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 76">
<rect x="7" y="44" width="46" height="30" rx="6" fill="#2ec4b6"/>
<rect x="7" y="44" width="46" height="8" rx="4" fill="#5fe0d3"/>
<path d="M7 76 C7 60 15 53 30 53 C45 53 53 60 53 76 Z" fill="#ff8a3d"/>
<path d="M18 56 L24 76 M42 56 L36 76" stroke="#2a8f86" stroke-width="3.5" stroke-linecap="round"/>
<rect x="25.5" y="42" width="9" height="12" rx="4" fill="#f3c29b"/>
<circle cx="13.5" cy="32" r="4" fill="#f3c29b"/><circle cx="46.5" cy="32" r="4" fill="#f3c29b"/>
<circle cx="30" cy="30" r="17" fill="#f3c29b"/>
<path d="M12.5 26 C12.5 7 47.5 7 47.5 26 Z" fill="#ff8a3d"/>
<ellipse cx="30" cy="26" rx="20" ry="3.6" fill="#e5671c"/>
<rect x="24" y="12" width="12" height="7" rx="3.5" fill="#fff" opacity=".85"/>
<path d="M27 15.5 h6" stroke="#ff8a3d" stroke-width="2" stroke-linecap="round"/>
</svg>`;

const CHEF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 92">
<path d="M8 92 C8 70 18 62 36 62 C54 62 64 70 64 92 Z" fill="#fff"/>
<path d="M8 92 C8 70 18 62 36 62 C54 62 64 70 64 92 Z" fill="none" stroke="#d9d2c5" stroke-width="2"/>
<path d="M36 64 V92" stroke="#e7e0d3" stroke-width="2"/>
<circle cx="31" cy="74" r="1.8" fill="#c9c0b0"/><circle cx="31" cy="84" r="1.8" fill="#c9c0b0"/>
<path d="M24 62 L36 72 L48 62 Z" fill="#e8405a"/>
<rect x="31" y="52" width="10" height="12" rx="4" fill="#f3c29b"/>
<circle cx="18.5" cy="45" r="4" fill="#f3c29b"/><circle cx="53.5" cy="45" r="4" fill="#f3c29b"/>
<circle cx="36" cy="43" r="17.5" fill="#f3c29b"/>
<path d="M18.5 37 C19 28 53 28 53.5 37 Z" fill="#3b2a22"/>
<path d="M17 30 C14 14 22 6 29 9 C31 1 41 1 43 9 C50 6 58 14 55 30 Z" fill="#fff"/>
<path d="M17 30 C14 14 22 6 29 9 C31 1 41 1 43 9 C50 6 58 14 55 30 Z" fill="none" stroke="#d9d2c5" stroke-width="1.6"/>
<rect x="17" y="27" width="38" height="8" rx="3" fill="#fff" stroke="#d9d2c5" stroke-width="1.4"/>
<path d="M27 44 Q30 41 33 44 M39 44 Q42 41 45 44" fill="none" stroke="#3d3a50" stroke-width="2.2" stroke-linecap="round"/>
<path d="M31 50 Q36 54.5 41 50" fill="none" stroke="#3d3a50" stroke-width="2.2" stroke-linecap="round"/>
<ellipse cx="25" cy="49" rx="3.4" ry="2" fill="#ff8a8a" opacity=".45"/><ellipse cx="47" cy="49" rx="3.4" ry="2" fill="#ff8a8a" opacity=".45"/>
</svg>`;

const CROWN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 20">
<path d="M3 17 L2 5 L9 10 L14 2 L19 10 L26 5 L25 17 Z" fill="#ffc233" stroke="#d98a00" stroke-width="1.6" stroke-linejoin="round"/>
<rect x="3" y="14" width="22" height="4" rx="1.5" fill="#f5a300"/>
<circle cx="14" cy="11" r="2.2" fill="#ef5d8f"/><circle cx="8" cy="13" r="1.4" fill="#4d86ee"/><circle cx="20" cy="13" r="1.4" fill="#4cb35a"/>
</svg>`;

const LANTERN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 40">
<rect x="8" y="1" width="10" height="5" rx="1.5" fill="#3d2b25"/>
<ellipse cx="13" cy="18" rx="12" ry="13" fill="#e8484a"/>
<ellipse cx="13" cy="18" rx="7" ry="11" fill="#ff7a62" opacity=".55"/>
<path d="M2 14 H24 M1.6 19 H24.4 M2.4 24 H23.6" stroke="#b72e35" stroke-width="1" opacity=".6"/>
<rect x="8" y="29" width="10" height="4.5" rx="1.5" fill="#3d2b25"/>
<path d="M13 33 V39" stroke="#ffc233" stroke-width="2.2" stroke-linecap="round"/>
<ellipse cx="9" cy="12" rx="3" ry="4.5" fill="#fff" opacity=".28"/>
</svg>`;

/** Open bento: four compartments (2×2); dishes are drawn into it as they arrive. */
const BENTO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 46">
<rect x="1" y="4" width="62" height="42" rx="7" fill="#000" opacity=".15"/>
<rect x="1" y="1" width="62" height="42" rx="7" fill="#b3263a"/>
<rect x="1" y="1" width="62" height="6" rx="3" fill="#d9465a"/>
<rect x="4.5" y="5" width="26" height="17" rx="3.5" fill="#2b1e24"/>
<rect x="33.5" y="5" width="26" height="17" rx="3.5" fill="#2b1e24"/>
<rect x="4.5" y="24" width="26" height="16" rx="3.5" fill="#2b1e24"/>
<rect x="33.5" y="24" width="26" height="16" rx="3.5" fill="#2b1e24"/>
</svg>`;

const LID_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 46">
<rect x="1" y="4" width="62" height="42" rx="7" fill="#000" opacity=".15"/>
<rect x="1" y="1" width="62" height="42" rx="7" fill="#c42f44"/>
<rect x="5" y="5" width="54" height="34" rx="5" fill="none" stroke="#ffc233" stroke-width="1.6" opacity=".8"/>
<rect x="28" y="1" width="8" height="42" fill="#fff4e0"/>
<path d="M32 22 C24 12 20 18 26 22 C20 26 24 32 32 22 C40 12 44 18 38 22 C44 26 40 32 32 22Z" fill="#fff4e0" stroke="#e6d6b8" stroke-width="1"/>
<ellipse cx="16" cy="9" rx="8" ry="2.5" fill="#fff" opacity=".22"/>
</svg>`;

const POT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 38">
<ellipse cx="24" cy="35" rx="20" ry="3" fill="#000" opacity=".14"/>
<path d="M5 12 H43 V26 C43 33 37 35 24 35 C11 35 5 33 5 26 Z" fill="#5b6472"/>
<path d="M5 12 H43 V17 H5 Z" fill="#76808f"/>
<rect x="1" y="14" width="6" height="4" rx="2" fill="#3f4652"/><rect x="41" y="14" width="6" height="4" rx="2" fill="#3f4652"/>
<ellipse cx="24" cy="12" rx="20" ry="4.5" fill="#8a94a3"/>
<ellipse cx="24" cy="12" rx="16" ry="3" fill="#f5efe6"/>
<path d="M10 22 C10 28 14 31 20 31" stroke="#fff" stroke-width="2" opacity=".25" fill="none" stroke-linecap="round"/>
</svg>`;

const COIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
<circle cx="10" cy="11" r="8.6" fill="#d98a00"/>
<circle cx="10" cy="10" r="8.6" fill="#ffc233"/>
<circle cx="10" cy="10" r="6" fill="none" stroke="#f5a300" stroke-width="1.6"/>
<path d="M8.4 6.8 V13.2 M11.6 6.8 V13.2" stroke="#d98a00" stroke-width="1.6" stroke-linecap="round"/>
<path d="M5 7 A6 6 0 0 1 9 4.4" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".7"/>
</svg>`;

export interface Art {
  plate: Record<Plate, Texture>;
  diner: Texture[];
  courier: Texture;
  chef: Texture;
  crown: Texture;
  lantern: Texture;
  bento: Texture;
  lid: Texture;
  pot: Texture;
  coin: Texture;
}

export async function loadArt(): Promise<Art> {
  const plates: Plate[] = ['S', 'T', 'M', 'O', 'E', 'G'];
  const [plateTex, diner, courier, chef, crown, lantern, bento, lid, pot, coin] = await Promise.all([
    Promise.all(plates.map((p) => svgTexture('sushi:plate:' + p, plateSvg(p), 40, 40, 4))),
    Promise.all(LOOKS.map((l, i) => svgTexture('sushi:diner:' + i, dinerSvg(l), 60, 76))),
    svgTexture('sushi:courier', COURIER_SVG, 60, 76),
    svgTexture('sushi:chef', CHEF_SVG, 72, 92),
    svgTexture('sushi:crown', CROWN_SVG, 28, 20),
    svgTexture('sushi:lantern', LANTERN_SVG, 26, 40),
    svgTexture('sushi:bento', BENTO_SVG, 64, 46),
    svgTexture('sushi:lid', LID_SVG, 64, 46),
    svgTexture('sushi:pot', POT_SVG, 48, 38),
    svgTexture('sushi:coin', COIN_SVG, 20, 20),
  ]);
  const plate = {} as Record<Plate, Texture>;
  plates.forEach((p, i) => (plate[p] = plateTex[i]));
  return { plate, diner, courier, chef, crown, lantern, bento, lid, pot, coin };
}
