/**
 * Moving Day level check. Run with: node src/games/moving/logic.test.ts
 *
 * For every room: the stored solution must be a full, rule-abiding packing that can also be
 * dropped in one item at a time under gravity (each item lands right on its spot). Then the solver
 * counts the distinct packings (identical items swapped count once) so the difficulty curve is
 * visible: lots of answers early, few late. Rotation rooms also report the count with turning
 * switched off, and the rotation intro must be impossible without turning.
 */
import { buildOrder, isSolved, settle, solve, violations } from './logic.ts';
import { KINDS, LEVELS, kindOf, puzzleOf, solutionOf } from './levels.ts';

const CAP = 500;
let failed = 0;
const fail = (msg: string) => {
  failed++;
  console.log(`  FAIL ${msg}`);
};

function check(name: string, cond: boolean, msg: string) {
  if (!cond) fail(`${name}: ${msg}`);
}

const rows: string[][] = [['#', 'room', 'box', 'items', 'spare', 'twist', 'solutions', 'fixed-orient']];

LEVELS.forEach((level, li) => {
  const name = `${li + 1} ${level.room}`;
  const puz = puzzleOf(level);
  for (const item of level.items) check(name, kindOf(item).kind in KINDS, `unknown item ${item}`);

  const fragile = puz.pieces.some((p) => p.fragile);
  const heavy = puz.pieces.some((p) => p.heavy);
  const twist = [level.rotate ? 'rotate' : '', fragile ? 'fragile' : '', heavy ? 'heavy' : '']
    .filter(Boolean)
    .join('+');

  // 1. Stored solution.
  const sol = solutionOf(level);
  const found = solve(puz, { limit: 1 });
  check(name, found.count > 0, 'no solution exists');
  if (sol.length !== puz.pieces.length) {
    fail(`${name}: stored solution has ${sol.length} entries, needs ${puz.pieces.length}`);
    if (found.first) console.log(`    solution: ${JSON.stringify(found.first.map((p) => [p.x, p.y, p.r]))},`);
  } else {
    if (!level.rotate) check(name, sol.every((p) => p.r === 0), 'turned item in a room without rotation');
    check(name, isSolved(puz, sol), `stored solution breaks a rule ${JSON.stringify(violations(puz, sol))}`);
    // Drop it in one item at a time, the way a player (or the hint) would: every item must
    // land exactly on its spot, so nothing in the answer hangs in the air.
    check(name, buildOrder(puz, sol) !== null, 'stored solution can’t be dropped in under gravity');
    check(name, settle(puz, sol).falls.length === 0, 'something in the stored solution would fall');
  }

  // 2. Difficulty: how many packings exist?
  const all = solve(puz, { limit: CAP });
  const countStr = `${all.count >= CAP ? `${CAP}+` : all.count}${all.complete ? '' : '?'}`;
  let noRot = '';
  if (level.rotate) {
    const fixed = solve(puz, { limit: CAP, rotate: false });
    noRot = `${fixed.count >= CAP ? `${CAP}+` : fixed.count}`;
    // Every rotation room should need at least some turning.
    check(name, fixed.count < all.count || all.count >= CAP, 'turning items never helps');
    if (level.intro?.includes('turn')) check(name, fixed.count === 0, 'rotation intro solvable without turning');
  }
  // Each new twist gets its own intro line the first time it appears.
  if (li === 0) check(name, !!level.intro, 'first room needs an intro');

  rows.push([
    String(li + 1),
    level.room,
    `${level.cols}x${level.rows}`,
    String(puz.pieces.length),
    String(puz.spare),
    twist || '-',
    countStr,
    noRot || '-',
  ]);
});

// Twist introductions: the first room with each twist carries an intro line.
for (const twist of ['rotate', 'fragile', 'heavy'] as const) {
  const li = LEVELS.findIndex((l) => {
    const p = puzzleOf(l);
    return twist === 'rotate' ? l.rotate : p.pieces.some((x) => x[twist]);
  });
  if (li >= 0) check(`${li + 1} ${LEVELS[li].room}`, !!LEVELS[li].intro, `introduces ${twist} without an intro line`);
}
check('levels', LEVELS.length >= 15 && LEVELS.length <= 18, `expected 15-18 rooms, got ${LEVELS.length}`);

const widths = rows[0].map((_, c) => Math.max(...rows.map((r) => r[c].length)));
for (const r of rows) console.log(r.map((s, c) => s.padEnd(widths[c])).join('  '));
console.log('');
if (failed) {
  // Throwing exits non-zero without needing Node's types (tsconfig only has vite/client).
  throw new Error(`${failed} check(s) failed`);
}
console.log(`All ${LEVELS.length} rooms solvable; stored solutions valid and droppable.`);
