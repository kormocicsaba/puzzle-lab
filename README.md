# Puzzle Lab

**Play it on your phone: https://kormocicsaba.github.io/puzzle-lab/** (sound on)

Three polished web demos used to find out which mobile puzzle idea is the most fun:

| Game | Page | Idea |
|---|---|---|
| Sushi Loop | `sushi.html` | Conveyor flow: seat diners, they grab plates off a moving belt; stools are the pressure |
| Duckling Dash | `ducks.html` | Arrow escape: tap a duck, it swims straight off the pond; bumps cost hearts |
| Moving Day | `moving.html` | Side-view packing: drop household items into a moving box; they fall until they land, fragile on top |

### Gravity in Moving Day

An item you let go of falls straight down from where you released it and stops on the first thing below it
(a faint guide shows where it will land). Letting go over a stack puts the item on top; letting go inside a
pocket under an overhang slides it in. Pulling an item out makes whatever rested on it fall. An item that
would stick out of the top of the box can't go there. Every room is checked by `logic.test.ts` to be
buildable in some drop order, not just to have a valid final layout.

## Stack

Vite 8 + TypeScript (strict) + PixiJS 8 (WebGL 2D) + GSAP 3 for tweens. The Fredoka font is bundled
through `@fontsource`. All art is drawn in code (SVG strings rasterised with `svgTexture`, or Pixi
`Graphics`), and all sound is synthesised (`src/kit/sfx.ts`), so there are no binary assets.

```bash
npm install
npm run dev        # http://localhost:5190 (hub) · /sushi.html · /ducks.html · /moving.html
npm run typecheck
npm run build      # static site in dist/, relative paths, host anywhere
```

Every push to `main` builds the site and deploys it to GitHub Pages (`.github/workflows/pages.yml`).

Pure game logic lives in `src/games/<id>/logic.ts` (no Pixi imports) and is tested with Node's built-in
type stripping: `node src/games/<id>/logic.test.ts`.

## Layout

- `src/kit/`: shared shell. `createGame` (portrait 390-wide logical space, scaled to fit), `sfx`
  (Web Audio synth, pentatonic so chains sound musical), `haptic` (Vibration API), `fx` (burst,
  confetti, ring, shake, punch, floatText), `ui` (text, Button, IconButton, TopBar, showResult, Hint,
  TapHand, pressable), `art` (svgTexture, shade), `save` (safe localStorage).
- `src/games/<id>/`: one folder per game. A game never edits another game's folder.
- `index.html` + `src/hub/`: the hub page linking the three games.

## Quality bar (definition of done for a demo)

1. **First 10 seconds teach the rule without text walls**: a TapHand or a one-line Hint on level 1, and the
   first level cannot be lost.
2. **Every action has feedback within one frame**: press animation, sound and (where it matters) haptic.
   Successes get a punch, a particle burst and a rising pitch when chained.
3. **Fails are readable and fair**: the player sees why they failed (highlight the cause) and can retry
   in one tap. No hidden randomness decides a level; levels are fixed and verified solvable by code.
4. **A curve, not a plateau**: ~12–20 levels; a new idea every few levels, introduced by a level that
   showcases it alone. Difficulty ramps with breathers.
5. **Calm, warm look**: soft palette, rounded shapes, gentle shadows, idle animation (things breathe/bob),
   no clutter. Every screen is legible at 375×667 and looks good at 430×932 and on desktop.
6. **Progress is kept** (current level) in `save`, and a level select is not needed; the top bar shows
   "Level N".
7. 60 fps on a mid phone: reuse textures, avoid per-frame allocations, destroy what you remove.
