import Phaser from 'phaser';
import { GAME_TITLE } from '../config/Constants.js';
import { LEVELS, resolveObjective } from '../levels/LevelData.js';
import { goalIconKey } from '../board/Board.js';
import { Progress } from '../core/Progress.js';
import {
  textStyle, titleStyle, makeGameLogo, makeButton, makeRoundButton, addGardenBackground, addStars, showModal, makeVivid,
  makeMuteButton, COLORS,
} from '../ui/UI.js';
import { panelTexture } from '../ui/Skin.js';
import {
  isMuted, setMuted, isMusicMuted, setMusicMuted, playMusic, playSfx,
} from '../core/Sound.js';
import { Wallet } from '../core/Wallet.js';
import { Daily } from '../core/Daily.js';
import { Seen } from '../core/Seen.js';
import { BOOSTER_STORAGE_KEY } from '../core/Inventory.js';
import { Wheel } from '../core/Wheel.js';
import { Streak } from '../core/Streak.js';
import { Quests } from '../core/Quests.js';
import { Store } from '../core/Storage.js';
import { Platform } from '../core/Platform.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    makeVivid(this);
    this.cameras.main.fadeIn(300, 255, 250, 240);
    this.build();
    playMusic();
    // Rebuild the (stateless) menu when the window size changes.
    const onResize = () => {
      this.background?.destroy();
      this.children.removeAll(true);
      this.tweens.killAll();
      this.build();
    };
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
  }

  openSettings() {
    const modal = showModal(this, { title: 'Settings', color: 'yellow', width: 320, height: 396 });
    const { panel, top } = modal;
    const soundLabel = () => (isMuted() ? 'Sound: Off' : 'Sound: On');
    const sound = makeButton(this, {
      x: 0, y: top + 50, width: 230, height: 52, label: soundLabel(), color: isMuted() ? 'blue' : 'green', fontSize: 21,
      onClick: () => {
        setMuted(!isMuted());
        sound.label.setText(soundLabel());
        this.muteButton?.refresh();
        playSfx(this, 'pop', { step: 4 });
      },
    });
    const musicLabel = () => (isMusicMuted() ? 'Music: Off' : 'Music: On');
    const music = makeButton(this, {
      x: 0, y: top + 116, width: 230, height: 52, label: musicLabel(), color: 'green', fontSize: 21,
      onClick: () => {
        setMusicMuted(!isMusicMuted());
        music.label.setText(musicLabel());
        this.muteButton?.refresh();
      },
    });
    const credits = makeButton(this, {
      x: 0, y: top + 182, width: 230, height: 52, label: 'Credits', color: 'blue', fontSize: 21,
      onClick: () => {
        modal.close();
        this.openCredits();
      },
    });
    const reset = makeButton(this, {
      x: 0, y: top + 248, width: 230, height: 52, label: 'Reset Progress', color: 'red', fontSize: 21,
      onClick: () => {
        modal.close();
        this.confirmReset();
      },
    });
    const close = makeRoundButton(this, {
      x: modal.width / 2 - 34, y: -modal.height / 2 + 34, size: 40, label: '✕', color: 'red', onClick: () => modal.close(),
    });
    panel.add([sound, music, credits, reset, close]);
  }

  openCredits() {
    const modal = showModal(this, { title: 'Credits', color: 'blue', width: 360, height: 400 });
    const { panel, top } = modal;
    const lines = [
      ['Bloomora', 22, '#7a4a1e'],
      ['A garden match puzzle', 15, '#9a6b3c'],
      ['', 10],
      ['UI, backgrounds & particles', 15, '#7a4a1e'],
      ['Kenney · www.kenney.nl (CC0)', 15, '#9a6b3c'],
      ['Sounds & music synthesized in-game', 14, '#9a6b3c'],
      ['', 6],
      ['Fonts: Lilita One & Fredoka (SIL OFL)', 14, '#9a6b3c'],
      ['Bloom, fruit & booster art: Bloomora (custom)', 14, '#9a6b3c'],
    ];
    let y = top + 32;
    lines.forEach(([text, size, color]) => {
      if (text) panel.add(this.add.text(0, y, text, textStyle(size, color, { align: 'center' })).setOrigin(0.5));
      y += size + 12;
    });
    panel.add(makeButton(this, {
      x: 0, y: modal.height / 2 - 48, width: 180, height: 50, label: 'OK', color: 'blue', onClick: () => modal.close(),
    }));
  }

  confirmReset() {
    const modal = showModal(this, { title: 'Reset Progress?', color: 'red', width: 330, height: 250 });
    const { panel, top } = modal;
    panel.add(this.add.text(0, top + 50, 'Stars, levels, lives, coins and\nboosters will all start over.', textStyle(16, '#9a6b3c', { align: 'center' })).setOrigin(0.5));
    panel.add(makeButton(this, {
      x: -72, y: top + 132, width: 126, height: 48, label: 'Reset', color: 'red', fontSize: 20,
      onClick: () => {
        ['bloomora.progress.v1', 'bloomora.lives.v1', BOOSTER_STORAGE_KEY, Wallet.STORAGE_KEY, Daily.STORAGE_KEY, Seen.STORAGE_KEY, Wheel.STORAGE_KEY, Streak.STORAGE_KEY, Quests.STORAGE_KEY].forEach((k) => {
          try {
            Store.remove(k);
          } catch {
            // Storage unavailable: nothing saved to clear.
          }
        });
        // Platform saves (CrazyGames) are written about a second later: wait for them.
        if (Platform.savesAreRemote) this.time.delayedCall(1500, () => window.location.reload());
        else window.location.reload();
      },
    }));
    panel.add(makeButton(this, {
      x: 72, y: top + 132, width: 126, height: 48, label: 'Cancel', color: 'green', fontSize: 20, onClick: () => modal.close(),
    }));
  }

  build() {
    const { width, height } = this.scale;
    this.background = addGardenBackground(this, { blur: true });
    this.background.layout(width, height);

    makeRoundButton(this, {
      x: width - 36, y: 36, size: 46, label: '⚙', color: 'yellow', onClick: () => this.openSettings(),
    });
    this.muteButton = makeMuteButton(this, { x: width - 92, y: 36, size: 46 });

    // Floating blooms in the background.
    ['rose', 'strawberry', 'drop', 'sun', 'grape', 'kiwi'].forEach((type, i) => {
      const x = width * (0.1 + (i % 3) * 0.4 + (i > 2 ? 0.2 : 0));
      const y = height * (i > 2 ? 0.78 : 0.12) + (i % 2) * 30;
      const bloom = this.add.image(x, y, `jewel-${type}`).setDisplaySize(56, 56).setAlpha(0.85);
      this.tweens.add({
        targets: bloom, y: y - 14, angle: { from: -8, to: 8 }, duration: 1600 + i * 180,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    });

    // Candy logo, each letter bobbing in a little wave.
    const size = Math.round(Phaser.Math.Clamp(Math.min(width * 0.13, height * 0.15), 52, 110));
    const { letters } = makeGameLogo(this, width * 0.5, height * 0.22, GAME_TITLE, size);
    letters.forEach((t, i) => {
      this.tweens.add({
        targets: t, y: -10, duration: 700, delay: i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    });

    const tagline = this.add.text(width * 0.5, height * 0.22 + size * 0.72, 'Bloom your garden with brilliant matches', titleStyle(20, '#2c861b'))
      .setOrigin(0.5);
    // Keep a margin on narrow phones instead of running edge to edge.
    if (tagline.width > width - 48) tagline.setScale((width - 48) / tagline.width);

    const index = Progress.currentLevelIndex(LEVELS.length);
    const level = LEVELS[index];

    const card = this.add.container(width * 0.5, height * 0.52);
    const cardBg = this.add.image(0, 0, panelTexture(this, 320, 160));
    const cardTitle = this.add.text(0, -40, `Level ${level.id}`, textStyle(30, COLORS.title, { stroke: '#ffffff', strokeThickness: 6 })).setOrigin(0.5);
    const cardSubtitle = this.add.text(0, -8, level.name, textStyle(18, COLORS.soft)).setOrigin(0.5);
    card.add([cardBg, cardTitle, cardSubtitle]);

    const goals = Object.entries(resolveObjective(level));
    goals.forEach(([type, count], i) => {
      const x = (i - (goals.length - 1) / 2) * 80;
      const icon = this.add.image(x - 14, 36, goalIconKey(type)).setDisplaySize(38, 38);
      const text = this.add.text(x + 10, 36, `${count}`, textStyle(20, COLORS.text)).setOrigin(0, 0.5);
      card.add([icon, text]);
    });

    const stars = Progress.starsFor(index);
    if (stars > 0) {
      addStars(this, card, { x: 108, y: -52, size: 20, gap: 2, earned: stars });
    }

    const play = makeButton(this, {
      x: width * 0.5,
      y: height * 0.52 + 132,
      width: 260,
      height: 80,
      label: 'Play',
      color: 'yellow',
      fontSize: 40,
      onClick: () => this.scene.start('MapScene'),
    });
    this.tweens.add({ targets: play, scale: 1.05, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}
