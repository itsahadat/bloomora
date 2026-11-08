import Phaser from 'phaser';
import { textStyle, titleStyle, makeButton, makeRoundButton, makeAdButton, showModal, boosterIcon } from './UI.js';
import { canvasTexture } from './Skin.js';
import { flyCoins } from './Shop.js';
import { Wallet } from '../core/Wallet.js';
import { Inventory, BOOSTERS } from '../core/Inventory.js';
import { Wheel, WHEEL_PRIZES, SPIN_PRICE } from '../core/Wheel.js';
import { playSfx } from '../core/Sound.js';
import { Ads } from '../core/Ads.js';

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

/** Wheel art is painted on 2x canvases (smooth, anti-aliased) and shown at 1x. */
const HD = 2;

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
/** Mix a 0xRRGGBB color toward white by `t` (0..1). */
const lighten = (n, t) => {
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

function hdImage(scene, key, size, draw) {
  canvasTexture(scene, key, size * HD, size * HD, (ctx) => {
    ctx.scale(HD, HD);
    draw(ctx, size / 2);
  });
  return scene.add.image(0, 0, key).setDisplaySize(size, size);
}

/** Static rim: wooden outer ring and a polished gold band (does not turn). */
function drawRim(scene, radius) {
  const size = (radius + 26) * 2;
  return hdImage(scene, `wheel-rim-${radius}`, size, (ctx, c) => {
    const ring = (r, fill) => {
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
    };
    ctx.save();
    ctx.shadowColor = 'rgba(60, 30, 0, 0.35)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    const wood = ctx.createLinearGradient(0, c - radius - 20, 0, c + radius + 20);
    wood.addColorStop(0, '#c98a4c');
    wood.addColorStop(1, '#7a4a1e');
    ring(radius + 20, wood);
    ctx.restore();
    const gold = ctx.createLinearGradient(0, c - radius - 16, 0, c + radius + 16);
    gold.addColorStop(0, '#fff1b8');
    gold.addColorStop(0.35, '#ffcf4a');
    gold.addColorStop(0.7, '#f0a91c');
    gold.addColorStop(1, '#c47a0c');
    ring(radius + 16, gold);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(122, 74, 30, 0.8)';
    ctx.beginPath();
    ctx.arc(c, c, radius + 16, 0, Math.PI * 2);
    ctx.stroke();
    // Dark lip the face sits in.
    ring(radius + 3, '#7a4a1e');
  });
}

/** One glowing light bulb for the rim. */
function bulbTexture(scene) {
  return canvasTexture(scene, 'wheel-bulb', 24 * HD, 24 * HD, (ctx) => {
    ctx.scale(HD, HD);
    const g = ctx.createRadialGradient(10, 10, 1, 12, 12, 11);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.45, '#fff6c8');
    g.addColorStop(1, 'rgba(255, 214, 90, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(12, 12, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fffbe8';
    ctx.beginPath();
    ctx.arc(12, 12, 4.2, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** The turning face: glossy slices with prize icons. Segment 0 sits at the top. */
function drawFace(scene, radius, { icons = true } = {}) {
  const face = scene.add.container(0, 0);
  const half = Phaser.Math.DegToRad(SLICE / 2);
  face.add(hdImage(scene, `wheel-face-${radius}-${icons ? 1 : 0}`, radius * 2, (ctx, c) => {
    WHEEL_PRIZES.forEach((prize, i) => {
      const mid = Phaser.Math.DegToRad(-90 + i * SLICE);
      const base = prize.jackpot ? JACKPOT : PETALS[i % PETALS.length];
      const g = ctx.createRadialGradient(c, c, radius * 0.1, c, c, radius);
      g.addColorStop(0, lighten(base, 0.55));
      g.addColorStop(0.8, hex(base));
      g.addColorStop(1, hex(base));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, radius, mid - half, mid + half);
      ctx.closePath();
      ctx.fill();
    });
    // Soft inner shadow at the edge for depth.
    const edge = ctx.createRadialGradient(c, c, radius * 0.82, c, c, radius);
    edge.addColorStop(0, 'rgba(90, 40, 0, 0)');
    edge.addColorStop(1, 'rgba(90, 40, 0, 0.22)');
    ctx.fillStyle = edge;
    ctx.beginPath();
    ctx.arc(c, c, radius, 0, Math.PI * 2);
    ctx.fill();
    // White dividers with round ends, and gold pegs on the edge.
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, radius * 0.028);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    WHEEL_PRIZES.forEach((_p, i) => {
      const a = Phaser.Math.DegToRad(-90 + i * SLICE + SLICE / 2);
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * radius * 0.18, c + Math.sin(a) * radius * 0.18);
      ctx.lineTo(c + Math.cos(a) * (radius - 2), c + Math.sin(a) * (radius - 2));
      ctx.stroke();
      if (icons) {
        const px = c + Math.cos(a) * (radius - 7);
        const py = c + Math.sin(a) * (radius - 7);
        const peg = ctx.createRadialGradient(px - 1.5, py - 1.5, 0.5, px, py, 5);
        peg.addColorStop(0, '#fff6d0');
        peg.addColorStop(1, '#d48f12');
        ctx.fillStyle = peg;
        ctx.beginPath();
        ctx.arc(px, py, 4.6, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }));

  if (icons) {
    WHEEL_PRIZES.forEach((prize, i) => {
      const deg = -90 + i * SLICE;
      const a = Phaser.Math.DegToRad(deg);
      const at = (r) => ({ x: Math.cos(a) * r, y: Math.sin(a) * r });
      const iconPos = at(radius * (prize.coins ? 0.72 : 0.63));
      const size = radius * (prize.coins ? 0.25 : 0.33);
      face.add(scene.add.image(iconPos.x, iconPos.y, prizeIcon(prize)).setDisplaySize(size, size).setAngle(deg + 90));
      if (prize.coins) {
        const labelPos = at(radius * 0.45);
        face.add(scene.add.text(labelPos.x, labelPos.y, `${prize.coins}`, titleStyle(Math.round(radius * 0.16), prize.jackpot ? '#a3121f' : '#b45a00', { resolution: HD }))
          .setOrigin(0.5).setAngle(deg + 90));
      }
    });
  }
  return face;
}

/** Center cap: a polished gold boss with a rose on it. */
function drawHub(scene, radius) {
  const hub = scene.add.container(0, 0);
  const cap = hdImage(scene, `wheel-hub-${Math.round(radius)}`, (radius + 5) * 2, (ctx, c) => {
    ctx.save();
    ctx.shadowColor = 'rgba(60, 30, 0, 0.35)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    const gold = ctx.createLinearGradient(0, c - radius - 4, 0, c + radius + 4);
    gold.addColorStop(0, '#fff1b8');
    gold.addColorStop(0.5, '#f5b52a');
    gold.addColorStop(1, '#b8700a');
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.arc(c, c, radius + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const cream = ctx.createRadialGradient(c, c - radius * 0.3, 1, c, c, radius);
    cream.addColorStop(0, '#ffffff');
    cream.addColorStop(1, '#ffeec8');
    ctx.fillStyle = cream;
    ctx.beginPath();
    ctx.arc(c, c, radius, 0, Math.PI * 2);
    ctx.fill();
  });
  hub.add([cap, scene.add.image(0, 0, 'jewel-rose').setDisplaySize(radius * 1.55, radius * 1.55)]);
  return hub;
}

/**
 * Glossy red pin pointer at the top. The image's origin is the round head, so it can
 * flick on each peg while its tip points into the wheel.
 */
function drawPointer(scene, size) {
  const w = size * 1.5;
  const h = size * 2;
  const r = size * 0.55;
  const key = `wheel-pointer-${size}`;
  canvasTexture(scene, key, w * HD, h * HD, (ctx) => {
    ctx.scale(HD, HD);
    const cx = w / 2;
    const cy = r + 2;
    const tipY = h - 3;
    const shape = () => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI * 0.82, Math.PI * 0.18);
      ctx.lineTo(cx, tipY);
      ctx.closePath();
    };
    ctx.save();
    ctx.shadowColor = 'rgba(60, 20, 0, 0.35)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 2;
    shape();
    const red = ctx.createLinearGradient(0, 0, 0, h);
    red.addColorStop(0, '#ff6f8a');
    red.addColorStop(0.55, '#e0244a');
    red.addColorStop(1, '#a8102c');
    ctx.fillStyle = red;
    ctx.fill();
    ctx.restore();
    shape();
    ctx.lineWidth = Math.max(2, size * 0.1);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    // Gold stud and a glint.
    const stud = ctx.createRadialGradient(cx - 1, cy - 1, 0.5, cx, cy, r * 0.42);
    stud.addColorStop(0, '#fff6d0');
    stud.addColorStop(1, '#d48f12');
    ctx.fillStyle = stud;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.45, cy - r * 0.45, r * 0.22, r * 0.12, -0.7, 0, Math.PI * 2);
    ctx.fill();
  });
  return scene.add.image(0, 0, key).setDisplaySize(w, h).setOrigin(0.5, (r + 2) / h);
}

/**
 * Lucky Flower Wheel popup: one free spin a day, then SPIN_PRICE coins a spin.
 * `coinTarget()` returns where won coins fly to (the coin badge).
 */
export function openLuckyWheel(scene, { coinTarget, onClose } = {}) {
  // An extra "spin for an ad" button sits under the main one when ads are available.
  const adRow = Ads.canShow('spin') ? 62 : 0;
  const modal = showModal(scene, { title: 'Lucky Wheel', color: 'yellow', width: 360, height: 480 + adRow, depth: 130 });
  const { panel, top, width } = modal;
  const R = Math.round(Math.min(122, (width - 64) / 2));
  const cy = top + R + 26;

  const rim = drawRim(scene, R);
  rim.y = cy;

  // Twinkling bulbs around the rim.
  const bulbs = [];
  for (let i = 0; i < 16; i += 1) {
    const a = Phaser.Math.DegToRad(i * 22.5);
    const bulb = scene.add.image(Math.cos(a) * (R + 9.5), cy + Math.sin(a) * (R + 9.5), bulbTexture(scene)).setDisplaySize(15, 15);
    bulbs.push(bulb);
    scene.tweens.add({ targets: bulb, alpha: 0.35, duration: 420, yoyo: true, repeat: -1, delay: (i % 2) * 420 });
  }

  const face = drawFace(scene, R);
  face.y = cy;
  const hub = drawHub(scene, R * 0.17);
  hub.y = cy;
  const pointer = drawPointer(scene, 24);
  pointer.y = cy - R - 14;

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

  const adButton = adRow ? makeAdButton(scene, {
    x: 0, y: cy + R + 86 + adRow, width: 220, height: 50, label: 'Free Spin', placement: 'spin', fontSize: 22,
    onReward: () => spin(true),
  }) : null;
  const refreshAdButton = () => {
    // Only offered once the day's free spin is used, and hidden while the wheel turns.
    if (adButton?.active) adButton.setVisible(!Wheel.hasFreeSpin() && !spinning && Ads.canShow('spin'));
  };
  refreshButton();

  let spinning = false;
  let current = 0;
  const close = makeRoundButton(scene, {
    x: width / 2 - 34, y: -modal.height / 2 + 34, size: 40, label: '✕', color: 'red',
    onClick: () => {
      if (spinning) return;
      modal.close();
      onClose?.();
    },
  });
  panel.add([rim, ...bulbs, face, hub, pointer, info, button, close, ...(adButton ? [adButton] : [])]);
  refreshAdButton();

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
    refreshAdButton();
    button.setAlpha(1);
    close.setAlpha(1);
  };

  /** `fromAd`: the player just watched an ad, so this spin is free. */
  const spin = (fromAd = false) => {
    if (spinning) return;
    if (fromAd) {
      // Paid for by the ad.
    } else if (Wheel.hasFreeSpin()) {
      Wheel.useFreeSpin();
    } else if (!Wallet.spend(SPIN_PRICE)) {
      info.setText('Not enough coins yet!').setColor('#d12a3a');
      playSfx(scene, 'invalid');
      scene.tweens.add({ targets: info, x: { from: -8, to: 0 }, duration: 260, ease: 'Elastic.easeOut' });
      return;
    }
    spinning = true;
    refreshAdButton();
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
  const rim = drawRim(scene, r - 8);
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
