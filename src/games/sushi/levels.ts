/**
 * Handcrafted levels as compact data. Every level is checked by logic.test.ts:
 * supply matches demand, a solver wins it, three stars are reachable, and on
 * pressure levels the "seat the front diner" habit loses.
 *
 * Dishes: S salmon nigiri · T tamago · M cucumber maki · O onigiri · E ebi · G chef's special.
 * Diners: "S2" wants 2 salmon; "S2T1" is a VIP (two dishes); "#SMTE" is a takeaway box.
 */
import type { DinerKind, DinerSpec, Dish, LevelSpec, OrderItem, Plate } from './logic.ts';

interface RawLevel {
  name: string;
  diners: string;
  kitchen: string;
  stools?: number;
  choose?: number;
  cook?: number;
  lap?: number;
  stars: [number, number];
  hint?: string;
  tutorial?: boolean;
  /** Pressure level: the naive "front diner first" habit must lose (checked by the test). */
  pressure?: boolean;
}

const RAW: RawLevel[] = [
  {
    name: 'Opening time',
    diners: 'S2 T2 M2',
    kitchen: 'STSMTM',
    cook: 2,
    lap: 8,
    tutorial: true,
    hint: 'Tap a diner to seat them',
    stars: [6, 6],
  },
  {
    name: 'First regulars',
    diners: 'S2 M2 T2 S2 O2 T2',
    kitchen: 'SMSTMTOSSOTT',
    cook: 2,
    lap: 8,
    hint: 'Coming up shows what the chef makes next',
    stars: [5, 8],
  },
  {
    name: 'Three seats',
    diners: 'O3 O3 M2 T2 S2 M2 T2 S3 T2 S3 M2',
    kitchen: 'SSTTMMSSSTTMMSSSTTMMOOOOOO',
    stools: 3,
    hint: 'Seat whoever wants what is coming up',
    stars: [9, 12],
    pressure: true,
  },
  {
    name: 'Big appetites',
    diners: 'M5 S4 S4 M4 O3 O5',
    kitchen: 'MSOOOOSOSSSSMOSSMMMMMOOMM',
    stools: 4,
    hint: 'Hungry diners stay for up to five plates',
    stars: [10, 12],
  },
  {
    name: 'Lunch rush',
    diners: 'E3 T3 S3 S3 E4 M3 O3 E3 O4 M3',
    kitchen: 'OOMMMMSSSSTTOOOMMEEEEEOOEESSEEET',
    stools: 4,
    hint: 'At 16 plates the kitchen jams. Watch the meter!',
    stars: [12, 14],
    pressure: true,
  },
  {
    name: 'Quiet evening',
    diners: 'O3 T3 S3 O2 E2 O3 O2 M2',
    kitchen: 'OOOOSOSOOOTMEETTSMOO',
    stools: 5,
    stars: [8, 11],
  },
  {
    name: 'Very important diners',
    diners: 'T3 E3 M2T1 O2 M3 M2S1 E2',
    kitchen: 'ETTTTMMEMMEEOEOMMMS',
    stools: 4,
    hint: 'VIPs wear a crown and want two kinds',
    stars: [8, 11],
  },
  {
    name: 'Crowded counter',
    diners: 'O2 O4 T3 O1T2 S2 S4 M4 T3 M2O2 T3',
    kitchen: 'MMMTTTTSSSTTTTTMMMTTOOOOSSSOOOOO',
    stools: 4,
    stars: [12, 14],
    pressure: true,
  },
  {
    name: 'To go, please',
    diners: 'S2 S3 M2 S2 M2 S3 #MOET O2',
    kitchen: 'SSESSSMMMTOSSSMMOOSS',
    stools: 3,
    hint: 'Takeaway boxes fill at the window, not a stool',
    stars: [9, 12],
  },
  {
    name: 'Delivery wave',
    diners: 'M2 O2 M3 M3 E3 E2 #MESO T3 T3 #OTSE',
    kitchen: 'TTTTMMMTEEEESSTTEEEMMMOOOOMMM',
    stools: 3,
    stars: [12, 14],
    pressure: true,
  },
  {
    name: "Chef's special",
    diners: 'O2 M4 E2 O4 M4 M3 S3 T2',
    kitchen: 'OOOGOEMMMGMMMSSSMMTTOOEMMM',
    stools: 3,
    hint: 'Golden plates: anyone eats them, and the chef cooks one less',
    stars: [8, 11],
  },
  {
    name: 'Friday night',
    diners: 'O3 O3 #SSTO T3 E2 O2 S2M2 M3 S2M2 M2',
    kitchen: 'MTTTMMMMMGOSSMMMSSSOOOEEOOTOOOS',
    stools: 4,
    stars: [9, 12],
    pressure: true,
  },
  {
    name: 'Full house',
    diners: 'E3 M4 E1T1 M4 M4 O4 S4 O4 #MTTS T2M2 T4',
    kitchen: 'SSSMGMMTTOOOMMOTTSSOOTTTEEEOOMMMMMTTEMMMMM',
    stools: 4,
    stars: [12, 14],
    pressure: true,
  },
  {
    name: 'Last call',
    diners: 'S3 S1T2 E3 O3 #EOTO O3 O3 M2E2 #TMEM M4 T4 M2',
    kitchen: 'OOOOEEEMGMMMGOOOOEEMMMMOTTTTMMTTTTOOEESSSS',
    stools: 3,
    stars: [11, 14],
    pressure: true,
  },
];

function parseDiner(tok: string, id: number): DinerSpec {
  const box = tok.startsWith('#');
  const body = box ? tok.slice(1) : tok;
  const order: OrderItem[] = [];
  const re = /([STMOE])(\d*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const dish = m[1] as Dish;
    const n = m[2] ? Number(m[2]) : 1;
    const hit = order.find((o) => o.dish === dish);
    if (hit) hit.n += n;
    else order.push({ dish, n });
  }
  const kind: DinerKind = box ? 'box' : order.length > 1 ? 'vip' : 'normal';
  // Looks rotate through the cast so neighbours rarely match.
  return { id, kind, order, look: (id * 5 + 3) % 8 };
}

export type Level = LevelSpec & { pressure: boolean };

function parse(r: RawLevel): Level {
  return {
    name: r.name,
    stools: r.stools ?? 5,
    choose: r.choose ?? 3,
    cook: r.cook ?? 1,
    lap: r.lap ?? 7.5,
    kitchen: r.kitchen.replace(/\s+/g, '').split('') as Plate[],
    diners: r.diners.trim().split(/\s+/).map(parseDiner),
    stars: r.stars,
    hint: r.hint,
    tutorial: r.tutorial,
    pressure: !!r.pressure,
  };
}

export const LEVELS: Level[] = RAW.map(parse);
