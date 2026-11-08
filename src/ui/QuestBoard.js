import { textStyle, titleStyle, makeButton, makeRoundButton, showModal } from './UI.js';
import { flyCoins } from './Shop.js';
import { buttonTexture } from './Skin.js';
import { Quests } from '../core/Quests.js';
import { Wallet } from '../core/Wallet.js';
import { playSfx } from '../core/Sound.js';

function formatDays(ms) {
  const h = Math.max(0, Math.floor(ms / 3600000));
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

/** Weekly quests popup: progress bars and a Claim button for each finished quest. */
export function openQuests(scene, { coinTarget, onClose } = {}) {
  const quests = Quests.list();
  const rowH = 86;
  const height = 64 + 36 + quests.length * rowH + 40;
  const modal = showModal(scene, { title: 'Weekly Quests', color: 'purple', width: 370, height, depth: 130 });
  const { panel, top, width } = modal;
  panel.add(scene.add.text(0, top + 16, `New quests in ${formatDays(Quests.msToReset())}`, textStyle(14, '#9a6b3c')).setOrigin(0.5));

  const left = -width / 2 + 20;
  const barW = width - 40 - 64 - 112;
  quests.forEach((q, i) => {
    const y = top + 42 + i * rowH + rowH / 2;
    const done = q.progress >= q.goal;
    const bg = scene.add.graphics();
    bg.fillStyle(done && !q.claimed ? 0xfff0c2 : i % 2 ? 0xfdf4e0 : 0xf4ecd8, 1).fillRoundedRect(left, y - rowH / 2 + 4, width - 40, rowH - 8, 16);
    const icon = scene.add.image(left + 32, y, q.icon).setDisplaySize(44, 44);
    const text = scene.add.text(left + 62, y - 16, q.text, textStyle(15, '#7a4a1e', { wordWrap: { width: barW + 8 } })).setOrigin(0, 0.5);
    const bar = scene.add.graphics();
    const bx = left + 62; const by = y + 14;
    bar.fillStyle(0xe6d6b8, 1).fillRoundedRect(bx, by - 7, barW, 14, 7);
    const frac = Math.min(1, q.progress / q.goal);
    if (frac > 0) bar.fillStyle(done ? 0x4fc12f : 0xa35cf0, 1).fillRoundedRect(bx, by - 7, Math.max(14, barW * frac), 14, 7);
    const count = scene.add.text(bx + barW / 2, by, `${q.progress} / ${q.goal}`, textStyle(11, '#ffffff', { stroke: '#6b4a2a', strokeThickness: 3 })).setOrigin(0.5);
    panel.add([bg, icon, text, bar, count]);

    const bx2 = width / 2 - 72;
    if (q.claimed) {
      panel.add(scene.add.text(bx2, y, '✓ Done', textStyle(17, '#2f9e57')).setOrigin(0.5));
      return;
    }
    const btn = makeButton(scene, {
      x: bx2, y, width: 96, height: 44, label: `${q.coins}`, color: done ? 'green' : 'grey', fontSize: 18,
      onClick: () => {
        const coins = Quests.claim(i);
        if (!coins) {
          playSfx(scene, 'invalid');
          return;
        }
        playSfx(scene, 'bloom');
        const m = btn.getWorldTransformMatrix();
        const to = coinTarget?.() ?? { x: scene.scale.width - 80, y: 34 };
        flyCoins(scene, { x: m.tx, y: m.ty }, to, coins, () => Wallet.add(coins));
        btn.destroy();
        panel.add(scene.add.text(bx2, y, '✓ Done', textStyle(17, '#2f9e57')).setOrigin(0.5));
        bg.clear().fillStyle(i % 2 ? 0xfdf4e0 : 0xf4ecd8, 1).fillRoundedRect(left, y - rowH / 2 + 4, width - 40, rowH - 8, 16);
      },
    });
    btn.label.setX(12);
    btn.add(scene.add.image(-24, -3, 'ui-coin').setDisplaySize(24, 24));
    if (done) scene.tweens.add({ targets: btn, scale: 1.06, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    panel.add(btn);
  });

  const close = makeRoundButton(scene, {
    x: width / 2 - 26, y: -height / 2 + 26, size: 38, label: '✕', color: 'red',
    onClick: () => {
      modal.close();
      onClose?.();
    },
  });
  panel.add(close);
  panel.setScrollFactor?.(0, 0, true);
  return modal;
}

/** Round "Quests" HUD button with a red "!" when a reward is waiting. Call `refresh()` after the popup closes. */
export function makeQuestButton(scene, { x, y, size = 64, onClick, canTap = () => true }) {
  const button = scene.add.container(x, y);
  const bg = scene.add.image(0, 0, buttonTexture(scene, size, size, 'purple', size / 2));
  const icon = scene.add.image(0, -4, 'ui-star').setDisplaySize(size * 0.56, size * 0.56);
  const label = scene.add.text(0, size * 0.42, 'Quests', titleStyle(14, '#552090')).setOrigin(0.5);
  const dot = scene.add.container(size * 0.36, -size * 0.36);
  dot.add([
    scene.add.circle(0, 0, 11, 0xe0244a).setStrokeStyle(3, 0xffffff),
    scene.add.text(0, -1, '!', titleStyle(15, '#8a0f1f')).setOrigin(0.5),
  ]);
  button.add([bg, icon, label, dot]);
  button.setSize(size, size).setInteractive({ useHandCursor: true });
  let bounce = null;
  button.refresh = () => {
    const ready = Quests.claimable();
    dot.setVisible(ready);
    bounce?.remove();
    bounce = ready ? scene.tweens.add({ targets: dot, scale: 1.2, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }) : null;
  };
  button.refresh();
  button.on('pointerdown', () => button.setScale(0.92));
  button.on('pointerout', () => button.setScale(1));
  button.on('pointerup', () => {
    button.setScale(1);
    if (!canTap()) return;
    playSfx(scene, 'click', { volume: 0.5 });
    onClick?.();
  });
  return button;
}
