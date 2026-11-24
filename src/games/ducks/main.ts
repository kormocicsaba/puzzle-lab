import { createGame, TopBar, Button, showResult, burst, confetti, sfx, TapHand, Hint } from '../../kit';

const game = await createGame({ background: '#2b2340' });
const bar = new TopBar({ onRestart: () => location.reload() });
bar.set('Kit check', 'placeholder');
game.root.addChild(bar);
const b = new Button('Win', () => {
  burst(game.root, 195, 400, { shape: 'star' });
  sfx.win();
  confetti(game.root, 390, game.H);
  showResult(game.root, 390, game.H, { win: true, title: 'Level done!', body: 'Great sorting', stars: 2, primary: { label: 'Next', onTap: () => {} }, secondary: { label: 'Replay', onTap: () => {} } });
});
b.position.set(195, 400);
game.root.addChild(b);
game.root.addChild(new TapHand(195, 500));
const h = new Hint('Tap a diner to seat them at the counter');
h.position.set(195, 600);
game.root.addChild(h);
