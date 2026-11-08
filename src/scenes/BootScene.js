import Phaser from 'phaser';
import { preloadJewelIcons, preloadKenney } from '../config/Assets.js';
import { GAME_TITLE } from '../config/Constants.js';
import { textStyle, titleStyle, ensureUiTextures, makeVivid, makeGameLogo } from '../ui/UI.js';
import { canvasTexture, pillTexture } from '../ui/Skin.js';
import { Board } from '../board/Board.js';
import { Progress } from '../core/Progress.js';
import { Platform } from '../core/Platform.js';

const TIPS = [
  'Match 4 in a row to grow a line bloom!',
  'L and T shapes make a burst bloom.',
  'Match 5 for a rainbow seed — swap it with any bloom!',
  'Swap two specials together for a giant combo.',
  'Match next to a thirsty pot to water it — its own color counts double!',
  'Come back every day for a free gift!',
];

/**
 * Loading screen: sunny sky, the rainbow logo, a wooden progress bar and a gameplay tip.
 * Everything here is drawn in code, so it shows instantly while the art loads.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    const { width: W, height: H } = this.scale;
    const sky = canvasTexture(this, 'skin-boot-sky', 4, 512, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, '#6cc0ee');
      g.addColorStop(0.55, '#bfe8fa');
      g.addColorStop(0.56, '#7fd36a');
      g.addColorStop(1, '#3fae4f');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 4, 512);
    });
    this.add.image(0, 0, sky).setOrigin(0).setDisplaySize(W, H);

    // Soft sun rays spinning slowly behind the logo.
    const rays = canvasTexture(this, 'skin-boot-rays', 256, 256, (ctx) => {
      for (let i = 0; i < 12; i += 1) {
        const a0 = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(128, 128);
        ctx.arc(128, 128, 128, a0, a0 + Math.PI / 14);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.fill();
      }
    });
    const raySize = Math.max(W, H) * 1.3;
    const rayImg = this.add.image(W / 2, H * 0.36, rays).setDisplaySize(raySize, raySize);
    this.tweens.add({ targets: rayImg, angle: 360, duration: 30000, repeat: -1 });

    // Candy logo: letters pop in one by one, then bob.
    const size = Math.round(Phaser.Math.Clamp(Math.min(W * 0.13, H * 0.13), 48, 100));
    const { letters } = makeGameLogo(this, W / 2, H * 0.36, GAME_TITLE, size);
    letters.forEach((t, i) => {
      t.setScale(0);
      this.tweens.add({ targets: t, scale: 1, duration: 420, delay: 80 * i, ease: 'Back.easeOut' });
      this.tweens.add({ targets: t, y: -8, duration: 700, delay: 600 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
    this.add.text(W / 2, H * 0.36 + size * 0.75, 'Garden Match', titleStyle(22, '#2c861b')).setOrigin(0.5);

    // Wooden progress bar.
    const barW = Math.min(340, W * 0.75);
    const barY = H * 0.68;
    this.add.image(W / 2, barY, pillTexture(this, barW + 16, 34));
    const fill = this.add.graphics();
    const draw = (v) => {
      const w = Math.max(20, (barW - 4) * v);
      fill.clear();
      fill.fillStyle(0x6b3d14, 0.25).fillRoundedRect(W / 2 - barW / 2, barY - 11, barW, 22, 11);
      fill.fillStyle(0xffa928, 1).fillRoundedRect(W / 2 - barW / 2 + 2, barY - 9, w, 18, 9);
      fill.fillStyle(0xffe066, 1).fillRoundedRect(W / 2 - barW / 2 + 2, barY - 9, w, 10, { tl: 9, tr: 9, bl: 0, br: 0 });
      fill.fillStyle(0xffffff, 0.45).fillRoundedRect(W / 2 - barW / 2 + 6, barY - 7, Math.max(0, w - 8), 3, 1.5);
    };
    draw(0);
    const label = this.add.text(W / 2, barY + 36, 'Loading 0%', titleStyle(18, '#6b3d14')).setOrigin(0.5);
    this.add.text(W / 2, H * 0.84, Phaser.Utils.Array.GetRandom(TIPS), textStyle(16, '#ffffff', {
      stroke: '#21650f', strokeThickness: 4, align: 'center', wordWrap: { width: Math.min(420, W - 40) },
    })).setOrigin(0.5);

    this.load.on('progress', (v) => {
      draw(v);
      label.setText(`Loading ${Math.round(v * 100)}%`);
    });

    preloadJewelIcons(this);
    preloadKenney(this);
  }

  create() {
    makeVivid(this);
    Board.ensureTextures(this);
    ensureUiTextures(this);
    Platform.loadingStop();
    // A brand-new player goes straight into level 1 (the tutorial); everyone else gets the menu.
    const firstTime = Progress.starsFor(0) === 0;
    // Let the logo finish its entrance, then fade into the next scene.
    this.time.delayedCall(firstTime ? 700 : 1100, () => {
      this.cameras.main.fadeOut(350, 255, 250, 240);
      this.cameras.main.once('camerafadeoutcomplete', () => (firstTime
        ? this.scene.start('GameScene', { levelIndex: 0 })
        : this.scene.start('MenuScene')));
    });
  }
}
