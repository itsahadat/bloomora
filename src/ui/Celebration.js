import Phaser from 'phaser';
import { textStyle, titleStyle, makeButton, showModal, boosterIcon } from './UI.js';
import { raysTexture, bigStarTexture } from './Skin.js';
import { flyCoins } from './Shop.js';
import { Wallet } from '../core/Wallet.js';
import { Inventory } from '../core/Inventory.js';
import { playSfx } from '../core/Sound.js';

export const ZONE_REWARD = { coins: 300, booster: 'rainbow' };

/** A burst of confetti falling over the whole screen. */
export function confetti(scene, count = 70) {
  const { width: W, height: H } = scene.scale;
  const colors = [0xff5ea8, 0xffd166, 0x58d68d, 0x53b9ff, 0xc77dff, 0xff8f22];
  for (let i = 0; i < count; i += 1) {
    const piece = scene.add.rectangle(W / 2, H * 0.35, Phaser.Math.Between(6, 11), Phaser.Math.Between(10, 18), colors[i % colors.length])
      .setDepth(220).setScrollFactor(0).setAngle(Phaser.Math.Between(0, 360));
    const x = W / 2 + Phaser.Math.Between(-W * 0.55, W * 0.55);
    scene.tweens.chain({
      targets: piece,
      tweens: [
        { x: (W / 2 + x) / 2, y: H * 0.35 - Phaser.Math.Between(60, 220), duration: 380, ease: 'Quad.easeOut' },
        {
          x, y: H + 40, angle: `+=${Phaser.Math.Between(240, 720)}`, duration: Phaser.Math.Between(1500, 2600), ease: 'Sine.easeIn',
          onComplete: () => piece.destroy(),
        },
      ],
    });
  }
}

/** "Garden Complete!" popup with a trophy star, confetti and a reward. */
export function openZoneComplete(scene, { zoneName, nextName, coinTarget, onClose } = {}) {
  playSfx(scene, 'win');
  confetti(scene);
  const modal = showModal(scene, { title: 'Garden Complete!', color: 'green', width: 360, height: 430, depth: 210 });
  const { panel, top } = modal;
  const rays = scene.add.image(0, top + 76, raysTexture(scene, 512)).setDisplaySize(260, 260).setAlpha(0.5);
  scene.tweens.add({ targets: rays, angle: 360, duration: 9000, repeat: -1 });
  const star = scene.add.image(0, top + 76, bigStarTexture(scene, 256, true)).setDisplaySize(118, 118).setScale(0);
  scene.tweens.add({ targets: star, scale: 118 / 256, duration: 520, ease: 'Back.easeOut', delay: 150 });
  const name = scene.add.text(0, top + 158, zoneName, titleStyle(26, '#2c861b')).setOrigin(0.5);
  const sub = scene.add.text(0, top + 192, nextName ? `Next garden: ${nextName}` : 'More gardens are growing soon!', textStyle(16, '#9a6b3c')).setOrigin(0.5);

  const reward = scene.add.container(0, top + 248);
  const coinIcon = scene.add.image(-70, 0, 'ui-coin').setDisplaySize(40, 40);
  const coinText = scene.add.text(-46, 0, `+${ZONE_REWARD.coins}`, textStyle(22, '#b8740b')).setOrigin(0, 0.5);
  const bIcon = scene.add.image(40, 0, boosterIcon(ZONE_REWARD.booster)).setDisplaySize(40, 40);
  const bText = scene.add.text(64, 0, '+1', textStyle(22, '#7a4a1e')).setOrigin(0, 0.5);
  reward.add([coinIcon, coinText, bIcon, bText]);

  const claim = makeButton(scene, {
    x: 0, y: top + 320, width: 210, height: 60, label: 'Hooray!', color: 'yellow', fontSize: 26,
    onClick: () => {
      Inventory.add(ZONE_REWARD.booster, 1);
      const m = claim.getWorldTransformMatrix();
      const to = coinTarget?.() ?? { x: scene.scale.width - 80, y: 34 };
      flyCoins(scene, { x: m.tx, y: m.ty }, to, ZONE_REWARD.coins, () => Wallet.add(ZONE_REWARD.coins));
      playSfx(scene, 'bloom');
      modal.close();
      onClose?.();
    },
  });
  scene.tweens.add({ targets: claim, scale: 1.05, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  panel.add([rays, star, name, sub, reward, claim]);
  panel.setScrollFactor?.(0, 0, true);
  return modal;
}
