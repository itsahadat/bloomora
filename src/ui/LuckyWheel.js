import Phaser from 'phaser';
import { textStyle, titleStyle, makeButton, makeRoundButton, showModal, boosterIcon } from './UI.js';
import { flyCoins } from './Shop.js';
import { Wallet } from '../core/Wallet.js';
import { Inventory, BOOSTERS } from '../core/Inventory.js';
import { Wheel, WHEEL_PRIZES, SPIN_PRICE } from '../core/Wheel.js';
import { playSfx } from '../core/Sound.js';

const SLICE = 360 / WHEEL_PRIZES.length;
const PETALS = [0xff8fc1, 0xffe08a, 0x9be57a, 0x8fd3ff];
const JACKPOT = 0xff5e6c;

function prizeIcon(prize) {
  return prize.coins ? 'ui-coin' : boosterIcon(prize.booster);
}

function prizeText(prize) {
  if (prize.coins) return prize.jackpot ? `JACKPOT! +${prize.coins} coins!` : `+${prize.coins} coins!`;
  return `+1 ${BOOSTERS[prize.booster].name}!`;
}

/** Static wooden rim with a gold band (does not turn). */
function drawRim(scene, radius) {
  const g = scene.add.graphics();
  g.fillStyle(0x2a1606, 0.25).fillCircle(0, 6, radius + 15);
  g.fillStyle(0x8a5a2b, 1).fillCircle(0, 0, radius + 15);
  g.fillStyle(0xffc94a, 1).fillCircle(0, 0, radius + 11);
  g.fillStyle(0xf0a91c, 1).fillCircle(0, 0, radius + 2);
  return g;
}

/** The turning face: petal-colored slices with prize icons. Segment 0 sits at the top. */
function drawFace(scene, radius, { icons = true } = {}) {
  const face = scene.add.container(0, 0);
  const g = scene.add.graphics();
  const half = Phaser.Math.DegToRad(SLICE / 2);
  WHEEL_PRIZES.forEach((prize, i) => {
    const mid = Phaser.Math.DegToRad(-90 + i * SLICE);
    g.fillStyle(prize.jackpot ? JACKPOT : PETALS[i % PETALS.length], 1);
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, radius, mid - half, mid + half, false);
    g.closePath();
    g.fillPath();
    // A lighter inner band makes each slice look like a glossy petal.
    g.fillStyle(0xffffff, 0.18);
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, radius * 0.92, mid - half * 0.82, mid + half * 0.82, false);
    g.closePath();
    g.fillPath();
  });
  // White dividers and pegs between slices.
  g.lineStyle(Math.max(1.5, radius * 0.025), 0xffffff, 0.95);
  WHEEL_PRIZES.forEach((_p, i) => {
    const a = Phaser.Math.DegToRad(-90 + i * SLICE + SLICE / 2);
    g.lineBetween(0, 0, Math.cos(a) * radius, Math.sin(a) * radius);
  });
  if (icons) {
    WHEEL_PRIZES.forEach((_p, i) => {
      const a = Phaser.Math.DegToRad(-90 + i * SLICE + SLICE / 2);
      g.fillStyle(0xffffff, 1).fillCircle(Math.cos(a) * (radius - 6), Math.sin(a) * (radius - 6), 4);
    });
  }
  face.add(g);

  if (icons) {
    WHEEL_PRIZES.forEach((prize, i) => {
      const deg = -90 + i * SLICE;
      const a = Phaser.Math.DegToRad(deg);
      const at = (r) => ({ x: Math.cos(a) * r, y: Math.sin(a) * r });
      const iconPos = at(radius * (prize.coins ? 0.7 : 0.62));
      const size = radius * (prize.coins ? 0.26 : 0.34);
      face.add(scene.add.image(iconPos.x, iconPos.y, prizeIcon(prize)).setDisplaySize(size, size).setAngle(deg + 90));
      if (prize.coins) {
        const labelPos = at(radius * 0.43);
        face.add(scene.add.text(labelPos.x, labelPos.y, `${prize.coins}`, titleStyle(Math.round(radius * 0.16), prize.jackpot ? '#a3121f' : '#b45a00'))
          .setOrigin(0.5).setAngle(deg + 90));
      }
    });
  }
  return face;
}

/** Center cap with a rose on it. */
function drawHub(scene, radius) {
  const hub = scene.add.container(0, 0);
  const g = scene.add.graphics();
  g.fillStyle(0x8a5a2b, 1).fillCircle(0, 0, radius + 3);
  g.fillStyle(0xfff6e0, 1).fillCircle(0, 0, radius);
  hub.add([g, scene.add.image(0, 0, 'jewel-rose').setDisplaySize(radius * 1.6, radius * 1.6)]);
  return hub;
}

/** Red flag pointer at the top; its origin is the pivot so it can flick on each peg. */
function drawPointer(scene, size) {
  const g = scene.add.graphics();
  g.fillStyle(0x2a1606, 0.25).fillTriangle(-size * 0.55, -size * 0.25 + 3, size * 0.55, -size * 0.25 + 3, 0, size + 3);
  g.fillStyle(0xe0244a, 1).fillTriangle(-size * 0.55, -size * 0.25, size * 0.55, -size * 0.25, 0, size);
  g.lineStyle(3, 0xffffff, 1).strokeTriangle(-size * 0.55, -size * 0.25, size * 0.55, -size * 0.25, 0, size);
  g.fillStyle(0xffffff, 1).fillCircle(0, 0, size * 0.18);
  return g;
}

/**
 * Lucky Flower Wheel popup: one free spin a day, then SPIN_PRICE coins a spin.
 * `coinTarget()` returns where won coins fly to (the coin badge).
 */
export function openLuckyWheel(scene, { coinTarget, onClose } = {}) {
  const modal = showModal(scene, { title: 'Lucky Wheel', color: 'yellow', width: 360, height: 480, depth: 130 });
  const { panel, top, width } = modal;
  const R = Math.round(Math.min(122, (width - 64) / 2));
  const cy = top + R + 26;

  const rim = drawRim(scene, R);
  rim.y = cy;

  // Twinkling bulbs around the rim.
  const bulbs = [];
  for (let i = 0; i < 16; i += 1) {
    const a = Phaser.Math.DegToRad(i * 22.5);
    const bulb = scene.add.circle(Math.cos(a) * (R + 7), cy + Math.sin(a) * (R + 7), 3.5, i % 2 ? 0xffffff : 0xfff3b0);
    bulbs.push(bulb);
    scene.tweens.add({ targets: bulb, alpha: 0.25, duration: 380, yoyo: true, repeat: -1, delay: (i % 2) * 380 });
  }

  const face = drawFace(scene, R);
  face.y = cy;
  const hub = drawHub(scene, R * 0.17);
  hub.y = cy;
  const pointer = drawPointer(scene, 24);
  pointer.y = cy - R - 12;

  const info = scene.add.text(0, cy + R + 34, '', textStyle(17, '#7a4a1e', { align: 'center' })).setOrigin(0.5);
  const setInfo = () => info.setText(Wheel.hasFreeSpin() ? 'Your free spin is ready!' : 'Next free spin tomorrow').setColor('#7a4a1e');
  setInfo();

  const button = makeButton(scene, {
    x: 0, y: cy + R + 86, width: 220, height: 58, label: '', color: 'green', fontSize: 26, onClick: () => spin(),
  });
  const coin = scene.add.image(0, -3, 'ui-coin').setDisplaySize(34, 34);
  button.add(coin);
  const refreshButton = () => {
    const free = Wheel.hasFreeSpin();
    button.setColor(free ? 'green' : 'yellow');
    button.label.setText(free ? 'Spin Free!' : `Spin  ${SPIN_PRICE}`);
    coin.setVisible(!free);
    button.label.x = free ? 0 : -16;
    coin.x = button.label.width / 2 + 4;
  };
  refreshButton();

  let spinning = false;
  let current = 0;
  const close = makeRoundButton(scene, {
    x: width / 2 - 26, y: -modal.height / 2 + 26, size: 38, label: '✕', color: 'red',
    onClick: () => {
      if (spinning) return;
      modal.close();
      onClose?.();
    },
  });
  panel.add([rim, ...bulbs, face, hub, pointer, info, button, close]);

  const award = (index) => {
    const prize = WHEEL_PRIZES[index];
    info.setText(prizeText(prize)).setColor(prize.jackpot ? '#d12a3a' : '#2f9e57');
    scene.tweens.add({ targets: info, scale: { from: 1.35, to: 1 }, duration: 380, ease: 'Back.easeOut' });

    // The prize pops out of the hub.
    const pop = scene.add.image(0, cy, prizeIcon(prize)).setDisplaySize(10, 10);
    panel.add(pop);
    const big = R * 0.7;
    scene.tweens.chain({
      targets: pop,
      tweens: [
        { displayWidth: big, displayHeight: big, y: cy - 10, duration: 360, ease: 'Back.easeOut' },
        { alpha: 0, y: cy - 50, duration: 420, delay: 500, onComplete: () => pop.destroy() },
      ],
    });

    playSfx(scene, prize.jackpot ? 'win' : 'sparkle');
    if (prize.coins) {
      const from = { x: panel.x, y: panel.y + cy };
      const to = coinTarget?.() ?? { x: scene.scale.width - 80, y: 34 };
      scene.time.delayedCall(420, () => flyCoins(scene, from, to, prize.coins, () => Wallet.add(prize.coins)));
    } else {
      Inventory.add(prize.booster, 1);
    }

    spinning = false;
    refreshButton();
    button.setAlpha(1);
    close.setAlpha(1);
  };

  const spin = () => {
    if (spinning) return;
    if (Wheel.hasFreeSpin()) {
      Wheel.useFreeSpin();
    } else if (!Wallet.spend(SPIN_PRICE)) {
      info.setText('Not enough coins yet!').setColor('#d12a3a');
      playSfx(scene, 'invalid');
      scene.tweens.add({ targets: info, x: { from: -8, to: 0 }, duration: 260, ease: 'Elastic.easeOut' });
      return;
    }
    spinning = true;
    button.setAlpha(0.55);
    close.setAlpha(0.4);
    info.setText('Good luck!').setColor('#7a4a1e');
    playSfx(scene, 'breeze', { volume: 0.6 });

    const index = Wheel.roll();
    // Turning the face by -index * SLICE puts segment `index` under the pointer.
    const target = -index * SLICE + Phaser.Math.FloatBetween(-SLICE * 0.38, SLICE * 0.38);
    const end = current + 360 * 5 + Phaser.Math.Wrap(target - current, 0, 360);
    const proxy = { a: current };
    let peg = Math.floor((current + SLICE / 2) / SLICE);
    scene.tweens.add({
      targets: proxy,
      a: end,
      duration: 4400,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        face.angle = proxy.a;
        const now = Math.floor((proxy.a + SLICE / 2) / SLICE);
        if (now !== peg) {
          peg = now;
          playSfx(scene, 'tick');
          pointer.angle = -22;
          scene.tweens.add({ targets: pointer, angle: 0, duration: 90, ease: 'Quad.easeOut' });
        }
      },
      onComplete: () => {
        current = Phaser.Math.Wrap(end, 0, 360);
        award(index);
      },
    });
  };

  panel.setScrollFactor?.(0, 0, true);
  return modal;
}

/**
 * Small wheel button for a HUD. Spins gently and shows a "!" while today's free spin is waiting.
 * `canTap()` lets a scrolling scene ignore taps that were really drags. Call `refresh()` after spinning.
 */
export function makeWheelButton(scene, { x, y, size = 64, onClick, canTap = () => true }) {
  const button = scene.add.container(x, y);
  const r = size * 0.42;
  const rim = drawRim(scene, r - 8).setScale(1);
  const face = drawFace(scene, r - 6, { icons: false });
  const hub = drawHub(scene, r * 0.24);
  const pointer = drawPointer(scene, 10);
  pointer.y = -r - 2;
  const dot = scene.add.container(r * 0.8, -r * 0.8);
  dot.add([
    scene.add.circle(0, 0, 11, 0xe0244a).setStrokeStyle(3, 0xffffff),
    scene.add.text(0, -1, '!', titleStyle(15, '#8a0f1f')).setOrigin(0.5),
  ]);
  button.add([rim, face, hub, pointer, dot]);
  button.setSize(size, size);
  button.setInteractive({ useHandCursor: true });

  let idle = null;
  let bounce = null;
  const refresh = () => {
    const free = Wheel.hasFreeSpin();
    dot.setVisible(free);
    idle?.remove();
    bounce?.remove();
    idle = null;
    bounce = null;
    if (free) {
      idle = scene.tweens.add({ targets: face, angle: '+=360', duration: 6000, repeat: -1 });
      bounce = scene.tweens.add({ targets: dot, scale: 1.2, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  };
  refresh();

  button.on('pointerdown', () => button.setScale(0.92));
  button.on('pointerout', () => button.setScale(1));
  button.on('pointerup', () => {
    button.setScale(1);
    if (!canTap()) return;
    playSfx(scene, 'click', { volume: 0.5 });
    onClick?.();
  });
  button.refresh = refresh;
  return button;
}
