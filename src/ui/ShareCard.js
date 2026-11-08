import { makeGameLogo, textStyle, titleStyle, boosterIcon } from './UI.js';
import { raysTexture, bigStarTexture } from './Skin.js';
import { mascotTexture } from './Mascot.js';
import { GAME_TITLE } from '../config/Constants.js';

/**
 * Draws a "level cleared" card (1080x1350, the 4:5 size Instagram and Facebook show in full)
 * from the game's own art and returns it as a PNG data URL.
 * The pieces are built off the display list, drawn once into a render texture, then destroyed.
 */
export const CARD_W = 1080;
export const CARD_H = 1350;

export function renderWinCard(scene, { levelNumber, levelName, stars, score, coins, reward }) {
  return new Promise((resolve) => {
    const W = CARD_W;
    const H = CARD_H;
    const root = scene.add.container(0, 0);
    root.removeFromDisplayList();

    // Garden background, scaled to cover the card.
    const bgTex = scene.textures.get('bg-grass').getSourceImage();
    const cover = Math.max(W / bgTex.width, H / bgTex.height);
    root.add(scene.add.image(W / 2, H / 2, 'bg-grass').setScale(cover));
    root.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x0c1f0c, 0.18));
    root.add(scene.add.image(W / 2, 640, raysTexture(scene, 512)).setDisplaySize(1250, 1250).setAlpha(0.55));

    const { logo } = makeGameLogo(scene, W / 2, 165, GAME_TITLE, 150);
    root.add(logo);

    // Cream card with a wooden rim.
    const card = scene.add.graphics();
    card.fillStyle(0x8a4e1f, 0.35).fillRoundedRect(96, 352, 888, 800, 56);
    card.fillStyle(0xd98c3a, 1).fillRoundedRect(90, 336, 900, 800, 56);
    card.fillStyle(0xfff7e6, 1).fillRoundedRect(112, 358, 856, 756, 44);
    card.lineStyle(4, 0xe8c48e, 1);
    for (let x = 150; x < 930; x += 30) card.lineBetween(x, 382, x + 14, 382);
    root.add(card);

    root.add(scene.add.text(W / 2, 450, `Level ${levelNumber} Cleared!`, titleStyle(84, '#b45a00')).setOrigin(0.5));
    root.add(scene.add.text(W / 2, 530, levelName, textStyle(46, '#9a6b3c')).setOrigin(0.5));

    [-1, 0, 1].forEach((offset, i) => {
      const size = i === 1 ? 210 : 165;
      const earned = i < stars;
      root.add(scene.add.image(W / 2 + offset * 200, 680 - (i === 1 ? 26 : 0), bigStarTexture(scene, 256, earned))
        .setDisplaySize(size, size).setAlpha(earned ? 1 : 0.55));
    });

    root.add(scene.add.text(W / 2, 845, `Score ${score.toLocaleString()}`, titleStyle(72, '#2b5a1e')).setOrigin(0.5));

    // Rewards row: coins and, sometimes, a booster.
    const chips = [{ icon: 'ui-coin', text: `+${coins}` }, ...(reward ? [{ icon: boosterIcon(reward), text: '+1' }] : [])];
    chips.forEach((c, i) => {
      const cx = W / 2 + (i - (chips.length - 1) / 2) * 260;
      const chip = scene.add.graphics();
      chip.fillStyle(0xf3dfb8, 1).fillRoundedRect(cx - 115, 920, 230, 92, 30);
      root.add(chip);
      root.add(scene.add.image(cx - 60, 966, c.icon).setDisplaySize(70, 70));
      root.add(scene.add.text(cx - 14, 966, c.text, textStyle(50, '#b8740b')).setOrigin(0, 0.5));
    });

    root.add(scene.add.text(W / 2, 1068, 'Can you beat my score?', textStyle(44, '#7a4a1e')).setOrigin(0.5));

    // Bea cheering at the bottom corner, and the call to play.
    root.add(scene.add.image(150, 1205, mascotTexture(scene)).setDisplaySize(240, 240).setAngle(-8));
    root.add(scene.add.text(W / 2 + 60, 1250, 'Play Bloomora free!', titleStyle(58, '#1f7a2e')).setOrigin(0.5));

    const rt = scene.add.renderTexture(0, 0, W, H).setOrigin(0).setVisible(false);
    rt.draw(root);
    rt.snapshot((image) => {
      resolve(image?.src ?? null);
      root.each((child) => scene.tweens.killTweensOf(child));
      scene.tweens.killTweensOf(logo.list.flatMap((l) => l.list ?? []));
      root.destroy(true);
      rt.destroy();
    });
  });
}
