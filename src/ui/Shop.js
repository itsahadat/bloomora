import { textStyle, makeButton, makeRoundButton, showModal, boosterIcon } from './UI.js';
import { pillTexture } from './Skin.js';
import { Wallet } from '../core/Wallet.js';
import { Inventory, BOOSTERS } from '../core/Inventory.js';
import { Lives, UNLIMITED_MS, formatTimer } from '../core/Lives.js';
import { Daily, DAILY_REWARDS } from '../core/Daily.js';
import { playSfx } from '../core/Sound.js';

export const LIVES_PRICE = 250;
export const ONE_LIFE_PRICE = 90;
export const UNLIMITED_PRICE = 450;

/** Make every child of a modal panel ignore camera scroll (needed on the scrolling map). */
function pin(panel) {
  panel.setScrollFactor?.(0, 0, true);
}

/** Coin pill with a "+" that opens the shop. Updates itself when coins change. */
export function makeCoinBadge(scene, x, y, { onShop } = {}) {
  const badge = scene.add.container(x, y);
  const g = scene.add.image(38, -2, pillTexture(scene, 124, 44));
  const coin = scene.add.image(0, -2, 'ui-coin').setDisplaySize(44, 44);
  const count = scene.add.text(26, -2, '', textStyle(19, '#b8740b')).setOrigin(0, 0.5);
  badge.add([g, coin, count]);
  if (onShop) {
    badge.add(makeRoundButton(scene, { x: 82, y: -2, size: 32, label: '+', color: 'green', onClick: onShop }));
  }
  const refresh = (n = Wallet.count()) => count.setText(n.toLocaleString());
  refresh();
  const off = Wallet.onChange((n) => {
    refresh(n);
    scene.tweens.add({ targets: coin, scale: coin.scale * 1.25, duration: 110, yoyo: true });
  });
  badge.once('destroy', off);
  scene.events.once('shutdown', off);
  badge.coin = coin;
  return badge;
}

/** A shower of coins flying from (x, y) to a target point, then `onArrive`. */
export function flyCoins(scene, from, to, amount, onArrive) {
  const n = Math.min(10, Math.max(3, Math.round(amount / 15)));
  for (let i = 0; i < n; i += 1) {
    const c = scene.add.image(from.x, from.y, 'ui-coin').setDisplaySize(30, 30).setDepth(200).setScrollFactor(0);
    const midX = from.x + (Math.random() - 0.5) * 160;
    const midY = from.y - 40 - Math.random() * 80;
    scene.tweens.chain({
      targets: c,
      tweens: [
        { x: midX, y: midY, duration: 260, delay: i * 50, ease: 'Quad.easeOut' },
        {
          x: to.x, y: to.y, scale: c.scale * 0.6, duration: 380, ease: 'Quad.easeIn',
          onComplete: () => {
            playSfx(scene, 'coin', { volume: 0.6, detune: i * 40 });
            c.destroy();
            if (i === n - 1) onArrive?.();
          },
        },
      ],
    });
  }
}

/** Ask to buy one booster with coins. `onBought` runs after a successful purchase. */
export function openBuyBooster(scene, kind, { onBought, onClose } = {}) {
  const b = BOOSTERS[kind];
  const modal = showModal(scene, { title: `Get ${b.name}?`, color: 'yellow', width: 320, height: 300, depth: 120 });
  const { panel, top } = modal;
  panel.add(scene.add.image(0, top + 46, boosterIcon(kind)).setDisplaySize(64, 64));
  panel.add(scene.add.text(0, top + 96, b.help, textStyle(15, '#9a6b3c', { align: 'center', wordWrap: { width: 260 } })).setOrigin(0.5));
  const affordable = Wallet.count() >= b.price;
  const finish = () => {
    modal.close();
    onClose?.();
  };
  const buy = makeButton(scene, {
    x: 0, y: top + 150, width: 200, height: 52, label: `${b.price}`, color: affordable ? 'green' : 'blue', fontSize: 22,
    onClick: () => {
      if (!Wallet.spend(b.price)) {
        note.setText('Not enough coins yet — win levels to earn more!').setColor('#c25b5b');
        playSfx(scene, 'invalid');
        return;
      }
      Inventory.add(kind, 1);
      playSfx(scene, 'coin');
      onBought?.();
      finish();
    },
  });
  buy.label.setX(14);
  buy.add(scene.add.image(-34, -3, 'ui-coin').setDisplaySize(30, 30));
  const note = scene.add.text(0, top + 194, `You have ${Wallet.count().toLocaleString()} coins`, textStyle(14, '#b08a60', { align: 'center', wordWrap: { width: 260 } })).setOrigin(0.5);
  const close = makeRoundButton(scene, {
    x: modal.width / 2 - 34, y: -modal.height / 2 + 34, size: 40, label: '✕', color: 'red', onClick: finish,
  });
  panel.add([buy, note, close]);
  pin(panel);
  return modal;
}

/** The garden shop: boosters and a lives refill, paid with coins. */
export function openShop(scene, { onClose } = {}) {
  const rows = [
    ...Object.keys(BOOSTERS).map((kind) => ({
      kind, icon: boosterIcon(kind), name: BOOSTERS[kind].name, price: BOOSTERS[kind].price,
      owned: () => `Have ${Inventory.count(kind)}`,
      buy: () => Inventory.add(kind, 1),
      can: () => true,
    })),
    {
      kind: 'lives', icon: 'ui-heart', name: 'Refill Lives', price: LIVES_PRICE,
      owned: () => `${Lives.count()} / ${Lives.MAX}`,
      buy: () => Lives.refill(),
      can: () => !Lives.isFull(),
    },
    {
      kind: 'unlimited', icon: 'ui-heart', infinite: true, name: 'Unlimited Lives', price: UNLIMITED_PRICE,
      owned: () => (Lives.isUnlimited() ? `Active · ${formatTimer(Lives.msUnlimited())} left` : '30 minutes of free tries'),
      buy: () => Lives.addUnlimited(UNLIMITED_MS),
      can: () => true,
    },
  ];
  const rowH = 58;
  const height = 64 + 58 + rows.length * rowH + 20 + 62;
  const modal = showModal(scene, { title: 'Garden Shop', color: 'green', width: 360, height, depth: 120 });
  const { panel, top, width } = modal;

  const wallet = scene.add.container(0, top + 28);
  const walletText = scene.add.text(8, 0, '', textStyle(20, '#b8860b')).setOrigin(0, 0.5);
  const refreshWallet = () => {
    walletText.setText(Wallet.count().toLocaleString());
    wallet.setX(-(walletText.width + 36) / 2 + 18);
  };
  wallet.add([scene.add.image(-12, 0, 'ui-coin').setDisplaySize(32, 32), walletText]);
  panel.add(wallet);
  refreshWallet();

  const left = -width / 2 + 20;
  rows.forEach((row, i) => {
    const y = top + 58 + i * rowH + rowH / 2;
    const bg = scene.add.graphics();
    bg.fillStyle(i % 2 ? 0xfdf4e0 : 0xf4ecd8, 1).fillRoundedRect(left, y - rowH / 2 + 3, width - 40, rowH - 6, 14);
    const icon = scene.add.image(left + 28, y, row.icon).setDisplaySize(38, 38);
    const mark = row.infinite ? [scene.add.text(left + 28, y - 3, '∞', textStyle(22, '#ffffff', { fontFamily: 'Arial, sans-serif', fontStyle: 'bold', stroke: '#b02a3c', strokeThickness: 4 })).setOrigin(0.5)] : [];
    const name = scene.add.text(left + 56, y - 9, row.name, textStyle(16, '#7a4a1e')).setOrigin(0, 0.5);
    const owned = scene.add.text(left + 56, y + 11, row.owned(), textStyle(12, '#b08a60')).setOrigin(0, 0.5);
    const btn = makeButton(scene, {
      x: width / 2 - 70, y, width: 96, height: 40, label: `${row.price}`, color: 'yellow', fontSize: 18,
      onClick: () => {
        if (!row.can()) {
          playSfx(scene, 'invalid');
          owned.setText('Already full!');
          scene.time.delayedCall(1200, () => owned.active && owned.setText(row.owned()));
          return;
        }
        if (!Wallet.spend(row.price)) {
          playSfx(scene, 'invalid');
          scene.tweens.add({ targets: wallet, x: wallet.x + 6, duration: 50, yoyo: true, repeat: 3 });
          walletText.setColor('#c25b5b');
          scene.time.delayedCall(700, () => walletText.active && walletText.setColor('#b8860b'));
          return;
        }
        row.buy();
        playSfx(scene, 'coin');
        owned.setText(row.owned());
        refreshWallet();
        scene.tweens.add({ targets: icon, scale: icon.scale * 1.3, duration: 120, yoyo: true });
      },
    });
    btn.label.setX(12);
    btn.add(scene.add.image(-26, -3, 'ui-coin').setDisplaySize(22, 22));
    panel.add([bg, icon, ...mark, name, owned, btn]);
  });

  panel.add(makeButton(scene, {
    x: 0, y: height / 2 - 46, width: 220, height: 48, label: 'Get More Coins', color: 'blue', fontSize: 19,
    onClick: () => openCoinPacks(scene),
  }));

  const close = makeRoundButton(scene, {
    x: width / 2 - 34, y: -height / 2 + 34, size: 40, label: '✕', color: 'red',
    onClick: () => {
      modal.close();
      onClose?.();
    },
  });
  panel.add(close);
  pin(panel);
  return modal;
}

function rewardIcon(reward) {
  if (reward.coins && !reward.boosters) return 'ui-coin';
  if (reward.boosters) return boosterIcon(Object.keys(reward.boosters)[0]);
  return 'ui-coin';
}

function rewardText(reward) {
  const parts = [];
  if (reward.coins) parts.push(`+${reward.coins} coins`);
  Object.entries(reward.boosters ?? {}).forEach(([k, n]) => parts.push(`+${n} ${BOOSTERS[k].name}`));
  if (reward.lives) parts.push('Full lives');
  return parts.join('  ·  ');
}

/** Daily gift popup with the 7-day streak. Grants the reward when claimed. */
export function openDailyReward(scene, { coinTarget, onClose } = {}) {
  const today = Daily.nextIndex();
  const modal = showModal(scene, { title: 'Daily Gift', color: 'blue', width: 380, height: 360, depth: 130 });
  const { panel, top, width } = modal;

  const gift = scene.add.image(0, top + 46, 'ui-gift').setDisplaySize(70, 70);
  scene.tweens.add({ targets: gift, angle: { from: -8, to: 8 }, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  panel.add(gift);

  const gap = 4;
  const box = Math.min(46, (width - 28 - gap * 6) / 7);
  const rowW = box * 7 + gap * 6;
  DAILY_REWARDS.forEach((reward, i) => {
    const x = -rowW / 2 + box / 2 + i * (box + gap);
    const y = top + 126;
    const done = i < today;
    const isToday = i === today;
    const g = scene.add.graphics();
    g.fillStyle(isToday ? 0xffd166 : done ? 0xb5e39c : 0xf4ecd8, 1).fillRoundedRect(x - box / 2, y - box / 2 - 8, box, box + 16, 10);
    if (isToday) g.lineStyle(3, 0xf0a91c, 1).strokeRoundedRect(x - box / 2, y - box / 2 - 8, box, box + 16, 10);
    const label = scene.add.text(x, y - box / 2 + 2, `Day ${i + 1}`, textStyle(10, isToday ? '#8a5a00' : '#b08a60')).setOrigin(0.5);
    const icon = scene.add.image(x, y + 8, reward.lives ? 'ui-heart' : rewardIcon(reward)).setDisplaySize(box * 0.6, box * 0.6);
    if (done) icon.setAlpha(0.45);
    panel.add([g, label, icon]);
    if (done) panel.add(scene.add.text(x, y + 8, '✓', textStyle(20, '#2f9e57', { stroke: '#ffffff', strokeThickness: 4 })).setOrigin(0.5));
    if (isToday) scene.tweens.add({ targets: icon, scale: icon.scale * 1.15, duration: 420, yoyo: true, repeat: -1 });
  });

  const reward = DAILY_REWARDS[today];
  panel.add(scene.add.text(0, top + 182, rewardText(reward), textStyle(17, '#7a4a1e', { align: 'center', wordWrap: { width: width - 40 } })).setOrigin(0.5));
  panel.add(scene.add.text(0, top + 206, 'Come back tomorrow to keep your streak!', textStyle(12, '#b08a60')).setOrigin(0.5));

  const claim = makeButton(scene, {
    x: 0, y: top + 252, width: 200, height: 56, label: 'Claim!', color: 'green', fontSize: 26,
    onClick: () => {
      const { reward: r } = Daily.claim();
      Object.entries(r.boosters ?? {}).forEach(([k, n]) => Inventory.add(k, n));
      if (r.lives) Lives.refill();
      playSfx(scene, 'bloom');
      const m = claim.getWorldTransformMatrix();
      modal.close();
      if (r.coins) {
        const target = coinTarget?.() ?? { x: scene.scale.width - 80, y: 34 };
        flyCoins(scene, { x: m.tx, y: m.ty }, target, r.coins, () => Wallet.add(r.coins));
      } else {
        playSfx(scene, 'sparkle');
      }
      onClose?.();
    },
  });
  panel.add(claim);
  pin(panel);
  return modal;
}

/**
 * Coin packs page. There is no real store yet, so every pack just says "Coming soon"
 * (no payment of any kind is taken).
 */
export function openCoinPacks(scene, { onClose } = {}) {
  const packs = [
    { coins: 500, label: 'Handful', tag: '' },
    { coins: 1200, label: 'Basket', tag: 'Popular' },
    { coins: 3000, label: 'Barrow', tag: 'Best value' },
  ];
  const rowH = 66;
  const height = 64 + 40 + packs.length * rowH + 70;
  const modal = showModal(scene, { title: 'Coin Packs', color: 'blue', width: 340, height, depth: 140 });
  const { panel, top, width } = modal;
  const note = scene.add.text(0, top + 22, 'The coin store is coming soon!', textStyle(15, '#9a6b3c')).setOrigin(0.5);
  panel.add(note);
  const left = -width / 2 + 20;
  packs.forEach((pack, i) => {
    const y = top + 48 + i * rowH + rowH / 2;
    const bg = scene.add.graphics();
    bg.fillStyle(i % 2 ? 0xfdf4e0 : 0xf4ecd8, 1).fillRoundedRect(left, y - rowH / 2 + 4, width - 40, rowH - 8, 14);
    const pile = scene.add.container(left + 34, y);
    for (let k = 0; k <= i; k += 1) pile.add(scene.add.image((k - i / 2) * 9, -k * 3, 'ui-coin').setDisplaySize(34, 34));
    const name = scene.add.text(left + 72, y - 10, `${pack.coins.toLocaleString()} coins`, textStyle(18, '#b8740b')).setOrigin(0, 0.5);
    const sub = scene.add.text(left + 72, y + 12, pack.tag ? `${pack.label} · ${pack.tag}` : pack.label, textStyle(12, '#b08a60')).setOrigin(0, 0.5);
    const btn = makeButton(scene, {
      x: width / 2 - 66, y, width: 88, height: 40, label: 'Soon', color: 'grey', fontSize: 17,
      onClick: () => {
        playSfx(scene, 'invalid');
        note.setText('Not available yet — win levels and spin the wheel!').setColor('#c25b5b');
        scene.tweens.add({ targets: note, scale: { from: 1.12, to: 1 }, duration: 260, ease: 'Back.easeOut' });
      },
    });
    panel.add([bg, pile, name, sub, btn]);
  });
  const close = makeRoundButton(scene, {
    x: width / 2 - 34, y: -height / 2 + 34, size: 40, label: '✕', color: 'red',
    onClick: () => {
      modal.close();
      onClose?.();
    },
  });
  panel.add(close);
  pin(panel);
  return modal;
}

/**
 * Out of Lives popup: wait for the next life, or spend coins on one life, a full refill
 * or 30 minutes of unlimited lives. `onLives()` runs once the player has a life again.
 */
export function openNoLives(scene, { onLives, onClose, closeLabel = 'Wait' } = {}) {
  const modal = showModal(scene, { title: 'Out of Lives', color: 'red', width: 340, height: 430, depth: 140 });
  const { panel, top } = modal;
  const heart = scene.add.image(0, top + 44, 'ui-heart-empty').setDisplaySize(60, 60);
  scene.tweens.add({ targets: heart, scale: heart.scale * 1.08, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  const timer = scene.add.text(0, top + 94, '', textStyle(17, '#9a6b3c', { align: 'center' })).setOrigin(0.5);
  const coins = scene.add.text(0, top + 118, '', textStyle(13, '#b08a60')).setOrigin(0.5);
  const update = () => {
    timer.setText(`Next life in ${formatTimer(Lives.msToNext())}`);
    coins.setText(`You have ${Wallet.count().toLocaleString()} coins`);
    if (Lives.count() > 0 && !modal.done) finish(true);
  };
  const tick = scene.time.addEvent({ delay: 1000, loop: true, callback: update });
  const finish = (gotLives) => {
    modal.done = true;
    tick.remove();
    modal.close();
    if (gotLives) onLives?.();
    else onClose?.();
  };
  const offer = (y, label, price, color, buy) => {
    const btn = makeButton(scene, {
      x: 0, y, width: 250, height: 50, label: `${label} · ${price}`, color, fontSize: 18,
      onClick: () => {
        if (!Wallet.spend(price)) {
          playSfx(scene, 'invalid');
          coins.setText('Not enough coins yet!').setColor('#c25b5b');
          scene.time.delayedCall(900, () => coins.active && coins.setColor('#b08a60'));
          return;
        }
        buy();
        playSfx(scene, 'bloom');
        finish(true);
      },
    });
    btn.label.setX(14);
    btn.add(scene.add.image(14 - btn.label.width / 2 - 22, -3, 'ui-coin').setDisplaySize(26, 26));
    return btn;
  };
  panel.add([heart, timer, coins,
    offer(top + 164, '+1 Life', ONE_LIFE_PRICE, 'green', () => Lives.addOne()),
    offer(top + 222, 'Full Refill', LIVES_PRICE, 'green', () => Lives.refill()),
    offer(top + 280, 'Unlimited 30 min', UNLIMITED_PRICE, 'yellow', () => Lives.addUnlimited(UNLIMITED_MS)),
    makeButton(scene, { x: 0, y: top + 344, width: 250, height: 48, label: closeLabel, color: 'blue', fontSize: 19, onClick: () => finish(false) }),
  ]);
  update();
  pin(panel);
  return modal;
}
