import Phaser from 'phaser';
import { playSfx, isAllMuted, setAllMuted } from '../core/Sound.js';
import { Ads } from '../core/Ads.js';
import {
  BUTTON_COLORS, COLORS, buttonTexture, panelTexture, pillTexture, badgeTexture, glyphTexture,
  bigStarTexture, vignetteTexture, canvasTexture,
} from './Skin.js';

export { COLORS };

/** Chunky game font for anything big; Fredoka for small print where Lilita gets hard to read. */
export const FONT = '"Lilita One", "Fredoka", "Trebuchet MS", sans-serif';
export const FONT_SMALL = '"Fredoka", "Trebuchet MS", sans-serif';

export function textStyle(size, color = COLORS.text, extra = {}) {
  const big = size >= 16;
  return {
    fontFamily: big ? FONT : FONT_SMALL,
    fontSize: `${size}px`,
    color,
    fontStyle: big ? 'normal' : 'bold',
    ...extra,
  };
}

/** Big white title text with a colored outline and a drop shadow. */
export function titleStyle(size, stroke = '#b45a00', extra = {}) {
  return textStyle(size, '#ffffff', {
    stroke, strokeThickness: Math.max(4, Math.round(size / 6)),
    shadow: { offsetX: 0, offsetY: Math.max(2, Math.round(size / 14)), color: 'rgba(60,30,0,0.35)', blur: 0, fill: true, stroke: true },
    ...extra,
  });
}

/**
 * The BLOOMORA logo: candy letters with a thin colored outline, a white ring,
 * a soft top-to-bottom gloss and only a light shadow. A little sprout grows from the first "O".
 * Returns { logo, letters } so scenes can animate each letter.
 */
export function makeGameLogo(scene, x, y, title, size) {
  const fills = [['#ff6fae', '#ec2a7c'], ['#ffad4a', '#f2740a'], ['#ffd84a', '#f2ac00'], ['#5fd98a', '#1fae54'], ['#5cc4ff', '#178fe3'], ['#b48aff', '#7c42ea']];
  const rims = ['#b81d60', '#c25a06', '#c48300', '#16813f', '#0f68b0', '#5a2bb8'];
  const logo = scene.add.container(x, y);
  const letters = title.split('').map((ch, i) => {
    const k = i % fills.length;
    const letter = scene.add.container(0, 0);
    const back = scene.add.text(0, 0, ch, textStyle(size, rims[k], {
      stroke: rims[k], strokeThickness: Math.round(size / 4.2),
      shadow: { offsetX: 0, offsetY: Math.round(size / 16), color: 'rgba(70,40,20,0.22)', blur: Math.round(size / 10), fill: true, stroke: true },
    })).setOrigin(0.5);
    const front = scene.add.text(0, 0, ch, textStyle(size, fills[k][1], { stroke: '#ffffff', strokeThickness: Math.round(size / 11) })).setOrigin(0.5);
    const grad = front.context.createLinearGradient(0, front.height * 0.2, 0, front.height * 0.8);
    grad.addColorStop(0, fills[k][0]);
    grad.addColorStop(1, fills[k][1]);
    front.setFill(grad);
    letter.add([back, front]);
    letter.letterWidth = front.width;
    return letter;
  });
  const overlap = size * 0.1;
  const totalW = letters.reduce((sum, l) => sum + l.letterWidth - overlap, 0);
  let lx = -totalW / 2;
  letters.forEach((l) => {
    l.x = lx + (l.letterWidth - overlap) / 2;
    lx += l.letterWidth - overlap;
  });
  logo.add(letters);

  // A tiny two-leaf sprout on top of the first "O".
  const o = letters[title.indexOf('O')];
  if (o) {
    const sprout = scene.add.graphics();
    const u = size / 60;
    sprout.lineStyle(4 * u, 0x2f9e57, 1).lineBetween(0, 0, 0, -12 * u);
    sprout.fillStyle(0x2f9e57, 1).fillEllipse(-8 * u, -15 * u, 17 * u, 10 * u).fillEllipse(8 * u, -17 * u, 17 * u, 10 * u);
    sprout.fillStyle(0x7fe39c, 1).fillEllipse(-8 * u, -16 * u, 12 * u, 6 * u).fillEllipse(8 * u, -18 * u, 12 * u, 6 * u);
    sprout.setPosition(0, -size * 0.42);
    o.addAt(sprout, 0);
    scene.tweens.add({ targets: sprout, angle: { from: -10, to: 10 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  return { logo, letters };
}

function pressable(scene, button, onClick) {
  button.setInteractive({ useHandCursor: true });
  const base = () => button.baseScale ?? 1;
  button.on('pointerdown', () => {
    button.setScale(base() * 0.92);
    playSfx(scene, 'click', { volume: 0.5 });
  });
  button.on('pointerout', () => button.setScale(base()));
  button.on('pointerup', () => {
    button.setScale(base());
    onClick?.();
  });
}

/** Glossy candy button with a white outlined label. */
export function makeButton(scene, {
  x, y, width, height, label, color = 'green', fontSize = 22, onClick,
}) {
  const button = scene.add.container(x, y);
  const bg = scene.add.image(0, 0, buttonTexture(scene, width, height, color));
  const text = scene.add.text(0, -4, label, titleStyle(fontSize, BUTTON_COLORS[color]?.text ?? '#21650f')).setOrigin(0.5);
  button.add([bg, text]);
  button.setSize(width, height);
  pressable(scene, button, onClick);
  button.label = text;
  button.bg = bg;
  button.setColor = (c) => {
    bg.setTexture(buttonTexture(scene, width, height, c));
    text.setStroke(BUTTON_COLORS[c]?.text ?? '#21650f', text.style.strokeThickness);
  };
  return button;
}

/**
 * Purple "watch an ad" button with a little play icon. Shows a rewarded ad for
 * `placement` and calls `onReward()` only if the player watched it to the end.
 * Returns null when no ad can be shown, so callers can leave it out of the layout.
 */
export function makeAdButton(scene, {
  x, y, width, height, label, placement, fontSize = 20, onReward,
}) {
  if (!Ads.canShow(placement)) return null;
  let running = false;
  const button = makeButton(scene, {
    x, y, width, height, label, color: 'purple', fontSize,
    onClick: async () => {
      if (running) return;
      running = true;
      button.setAlpha(0.6);
      const watched = await Ads.rewarded(placement);
      running = false;
      if (!button.active) return;
      button.setAlpha(1);
      if (watched) {
        onReward?.(button);
      } else {
        playSfx(scene, 'invalid');
        // Never leave a dead ad button: say why nothing happened.
        if (!Ads.canShow(placement)) {
          const m = button.getWorldTransformMatrix();
          showTooltip(scene, m.tx, m.ty - 30 * m.scaleY, 'No ad right now', 'Ads are not available at the moment. Try again later!', { depth: 400, duration: 2400 });
        }
      }
      // Used up today's ads for this spot: fade the button away.
      if (!Ads.canShow(placement) && button.active) {
        button.disableInteractive();
        scene.tweens.add({ targets: button, alpha: 0, duration: 200, onComplete: () => button.setVisible(false) });
      }
    },
  });
  // Play icon (rounded square with a triangle) to the left of the label.
  const s = Math.round(height * 0.46);
  const icon = scene.add.graphics();
  icon.fillStyle(0xffffff, 1).fillRoundedRect(-s / 2, -s / 2, s, s, s * 0.28);
  icon.fillStyle(0x7a3cc8, 1).fillTriangle(-s * 0.16, -s * 0.24, -s * 0.16, s * 0.24, s * 0.26, 0);
  button.label.setX(s / 2 + 4);
  icon.setPosition(button.label.x - button.label.width / 2 - s / 2 - 8, -3);
  button.add(icon);
  return button;
}

const GLYPHS = { '✕': 'close', '‹': 'back', '⚙': 'gear', '+': 'plus', '≡': 'pause' };
const ICON_GLYPHS = { 'icon-repeat': 'restart' };

/** Square glossy button with a glyph, an icon texture or a short label. */
export function makeRoundButton(scene, {
  x, y, size = 44, icon, label, color = 'green', onClick,
}) {
  const button = scene.add.container(x, y);
  const glyph = GLYPHS[label] ?? ICON_GLYPHS[icon] ?? (['pause', 'close', 'back', 'gear', 'plus', 'restart', 'map'].includes(icon) ? icon : null);
  // A close (✕) button is just a plain X sitting inside the panel; everything else is a glossy rounded square.
  const isClose = glyph === 'close';
  const bg = scene.add.image(0, 0, buttonTexture(scene, size, size, color, size * 0.3)).setVisible(!isClose);
  button.add(bg);
  if (isClose) {
    button.add(scene.add.image(0, 0, glyphTexture(scene, 'close-plain')).setDisplaySize(size * 0.62, size * 0.62));
  } else if (glyph) {
    button.add(scene.add.image(0, -2, glyphTexture(scene, glyph)).setDisplaySize(size * 0.56, size * 0.56));
  } else if (icon) {
    button.add(scene.add.image(0, -2, icon).setDisplaySize(size * 0.58, size * 0.58));
  } else {
    button.add(scene.add.text(0, -3, label, titleStyle(Math.round(size * 0.5), BUTTON_COLORS[color]?.text)).setOrigin(0.5));
  }
  button.setSize(size, size);
  pressable(scene, button, onClick);
  button.bg = bg;
  return button;
}

/** Speaker button: one tap mutes / unmutes all sound effects and music. */
export function makeMuteButton(scene, { x, y, size = 44 }) {
  const button = scene.add.container(x, y);
  const on = buttonTexture(scene, size, size, 'yellow', size * 0.3);
  const off = buttonTexture(scene, size, size, 'grey', size * 0.3);
  const bg = scene.add.image(0, 0, on);
  const icon = scene.add.image(0, -2, 'ui-sound-on').setDisplaySize(size * 0.62, size * 0.62);
  button.add([bg, icon]);
  button.setSize(size, size);
  const refresh = () => {
    const muted = isAllMuted();
    icon.setTexture(muted ? 'ui-sound-off' : 'ui-sound-on');
    bg.setTexture(muted ? off : on);
  };
  pressable(scene, button, () => {
    setAllMuted(!isAllMuted());
    refresh();
    playSfx(scene, 'pop', { step: 6 });
  });
  refresh();
  button.refresh = refresh;
  return button;
}

/** Row of three jelly stars; the first `earned` are gold. */
export function addStars(scene, container, { x = 0, y = 0, size = 20, gap = 4, earned = 0, raiseMiddle = 0 }) {
  for (let i = 0; i < 3; i += 1) {
    const sx = x + (i - 1) * (size + gap);
    const sy = y - (i === 1 ? raiseMiddle : 0);
    container.add(scene.add.image(sx, sy, bigStarTexture(scene, 128, i < earned)).setDisplaySize(size * 1.15, size * 1.15));
  }
}

/** Small count badge (white circle) with a number, as a container. */
export function makeCountBadge(scene, x, y, value, size = 28) {
  const badge = scene.add.container(x, y);
  const bg = scene.add.image(0, 0, badgeTexture(scene, size));
  const text = scene.add.text(0, 0, `${value}`, textStyle(Math.round(size * 0.55), COLORS.text)).setOrigin(0.5);
  badge.add([bg, text]);
  badge.text = text;
  badge.setValue = (v) => text.setText(`${v}`);
  return badge;
}

/**
 * Garden backdrop: sky, hills, a ring of trees and drifting clouds.
 * With `blur: true` it is softly out of focus (depth of field) with floating bokeh lights,
 * so the board in front pops. Call `layout(width, height)` whenever the screen size changes.
 */
export function addGardenBackground(scene, { blur = false } = {}) {
  const skyKey = canvasTexture(scene, 'skin-sky', 4, 512, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#7cc8f0');
    g.addColorStop(0.6, '#c9ecfa');
    g.addColorStop(1, '#f2fbff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 512);
  });
  const world = scene.add.container(0, 0);
  const sky = scene.add.image(0, 0, skyKey).setOrigin(0);
  const sun = scene.add.image(0, 0, 'fx-glow').setTint(0xfff3b0).setAlpha(0.8);
  const ground = scene.add.graphics();
  const hills = scene.add.tileSprite(0, 0, 10, 10, 'bg-grass').setOrigin(0.5, 0.625);
  const depthShade = scene.add.graphics();

  const clouds = [1, 2, 3, 1].map((n, i) => {
    const cloud = scene.add.image(0, 0, `bg-cloud${n}`).setAlpha(0.9);
    cloud.speed = 6 + i * 3;
    cloud.offset = i * 0.27;
    return cloud;
  });

  // A ring of trees: a hazy far row along the horizon and big trees framing the sides.
  const treeKeys = ['map-tree', 'map-treeLong', 'map-treePine', 'map-tree', 'map-treeLong', 'map-bush1', 'map-tree', 'map-treePine'];
  const far = treeKeys.map((k) => scene.add.image(0, 0, k).setOrigin(0.5, 1).setTint(0xb8e0c8).setAlpha(0.95));
  const nearKeys = ['map-tree', 'map-treeLong', 'map-bush2', 'map-treePine', 'map-tree', 'map-bush3'];
  const near = nearKeys.map((k) => scene.add.image(0, 0, k).setOrigin(0.5, 1));
  world.add([sky, sun, ...clouds, hills, ...far, ground, depthShade, ...near]);

  if (blur) world.postFX?.addBlur(1, 2, 2, 1.1, 0xffffff, 6);

  // Floating bokeh lights and a soft vignette sit on top of the (blurred) world.
  const bokeh = blur
    ? Array.from({ length: 10 }, (_, i) => {
      const b = scene.add.image(0, 0, 'fx-glow').setTint(i % 3 ? 0xfff7c8 : 0xd8ffd0).setAlpha(0);
      b.seed = Math.random();
      return b;
    })
    : [];
  const vignette = scene.add.image(0, 0, vignetteTexture(scene)).setOrigin(0).setAlpha(blur ? 0.9 : 0.5);

  let width = 0;
  let height = 0;
  const update = (_time, delta) => {
    clouds.forEach((cloud) => {
      cloud.x += (cloud.speed * delta) / 1000;
      if (cloud.x - cloud.displayWidth / 2 > width) cloud.x = -cloud.displayWidth / 2;
    });
  };
  scene.events.on('update', update);
  scene.events.once('shutdown', () => scene.events.off('update', update));

  return {
    destroy() {
      scene.events.off('update', update);
    },
    layout(w, h) {
      width = w;
      height = h;
      const horizon = h * 0.5;
      const s = Phaser.Math.Clamp(h / 1100, 0.5, 1.1);
      sky.setDisplaySize(w, horizon + 40);
      sun.setPosition(w * 0.78, h * 0.12).setDisplaySize(h * 0.5, h * 0.5);
      ground.clear().fillStyle(0x3cc47a, 1).fillRect(0, horizon, w, h - horizon);
      depthShade.clear();
      depthShade.fillGradientStyle(0x0f7a45, 0x0f7a45, 0x0f7a45, 0x0f7a45, 0, 0, 0.45, 0.45);
      depthShade.fillRect(0, horizon + 40, w, h - horizon - 40);
      hills.setSize(w, 1024 * s).setPosition(w / 2, horizon);
      hills.setTileScale(s, s);
      hills.tilePositionX = (1024 - w / s) / 2;
      far.forEach((t, i) => {
        const fx = (i + 0.5) / far.length;
        t.setPosition(w * fx + Math.sin(i * 7) * 30, horizon + 30 + (i % 2) * 18).setScale(s * (1.3 + (i % 3) * 0.25));
      });
      near.forEach((t, i) => {
        const left = i % 2 === 0;
        const k = Math.floor(i / 2);
        const tx = left ? w * (0.02 + k * 0.09) : w * (0.98 - k * 0.09);
        t.setPosition(tx, h * (0.9 + k * 0.05)).setScale(s * (3.4 - k * 0.6)).setFlipX(!left);
      });
      clouds.forEach((cloud, i) => {
        cloud.setScale(Math.max(0.6, Math.min(1.4, w / 900)));
        cloud.setPosition(w * ((cloud.offset + 0.1) % 1), h * (0.06 + (i % 3) * 0.08));
      });
      vignette.setDisplaySize(w, h);
      bokeh.forEach((b, i) => {
        scene.tweens.killTweensOf(b);
        const size = 40 + b.seed * 110;
        b.setPosition(b.seed * w, (0.15 + ((i * 0.37) % 0.8)) * h).setDisplaySize(size, size).setAlpha(0);
        scene.tweens.add({
          targets: b, alpha: 0.12 + b.seed * 0.18, y: b.y - 40 - b.seed * 60, duration: 4000 + b.seed * 4000,
          delay: i * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
      });
    },
  };
}

export function starPoints(cx, cy, outer, inner = outer * 0.48) {
  const points = [];
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = Phaser.Math.DegToRad(-90 + i * 36);
    points.push(new Phaser.Geom.Point(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return points;
}

/** Textures drawn in code: heart (lives) and padlock (locked levels). */
export function ensureUiTextures(scene) {
  const make = (name, w, h, draw) => {
    if (scene.textures.exists(name)) return;
    const g = scene.make.graphics({}, false);
    draw(g);
    g.generateTexture(name, w, h);
    g.destroy();
  };
  const heart = (g, color, dark) => {
    g.fillStyle(dark, 1);
    g.fillCircle(19, 23, 16).fillCircle(45, 23, 16).fillTriangle(5, 31, 59, 31, 32, 60);
    g.fillStyle(color, 1);
    g.fillCircle(19, 21, 15).fillCircle(45, 21, 15).fillTriangle(5, 27, 59, 27, 32, 56);
    g.fillStyle(0xffffff, 0.55).fillEllipse(17, 15, 12, 7);
  };
  make('ui-heart', 64, 64, (g) => heart(g, 0xff5a6e, 0xc93a4f));
  make('ui-heart-empty', 64, 64, (g) => heart(g, 0xd9d2c3, 0xb3aa98));
  // Booster icons (white-ish art meant to sit on a colored round button).
  make('bst-trowel', 64, 64, (g) => {
    g.fillStyle(0x6e4320, 1).fillRoundedRect(34, 2, 16, 28, 7);
    g.fillStyle(0xb5763e, 1).fillRoundedRect(36, 3, 12, 25, 6);
    g.fillStyle(0x8e9aa6, 1).fillRect(33, 27, 18, 7);
    g.fillStyle(0x6b7783, 1).fillTriangle(24, 33, 60, 33, 40, 63);
    g.fillStyle(0xe3e9ee, 1).fillTriangle(27, 34, 57, 34, 40, 59);
    g.fillStyle(0xffffff, 0.8).fillTriangle(31, 35, 40, 35, 38, 52);
  });
  make('bst-breeze', 64, 64, (g) => {
    const arc = (start, end) => {
      g.lineStyle(10, 0x2f8a3e, 1).beginPath().arc(32, 32, 20, Phaser.Math.DegToRad(start), Phaser.Math.DegToRad(end)).strokePath();
      g.lineStyle(6, 0xffffff, 1).beginPath().arc(32, 32, 20, Phaser.Math.DegToRad(start), Phaser.Math.DegToRad(end)).strokePath();
    };
    arc(200, 330);
    arc(20, 150);
    g.fillStyle(0xffffff, 1).lineStyle(2, 0x2f8a3e, 1);
    g.fillTriangle(46, 12, 58, 26, 42, 28).strokeTriangle(46, 12, 58, 26, 42, 28);
    g.fillTriangle(18, 52, 6, 38, 22, 36).strokeTriangle(18, 52, 6, 38, 22, 36);
  });
  make('bst-swap', 64, 64, (g) => {
    g.fillStyle(0xffffff, 1).lineStyle(3, 0x2f8a3e, 1);
    const arrow = (y, dir) => {
      const pts = dir > 0
        ? [[6, y - 5], [42, y - 5], [42, y - 13], [60, y], [42, y + 13], [42, y + 5], [6, y + 5]]
        : [[58, y - 5], [22, y - 5], [22, y - 13], [4, y], [22, y + 13], [22, y + 5], [58, y + 5]];
      const p = pts.map(([x, yy]) => new Phaser.Geom.Point(x, yy));
      g.fillPoints(p, true).strokePoints(p, true);
    };
    arrow(20, 1);
    arrow(44, -1);
  });
  make('bst-burst', 64, 64, (g) => {
    const pts = [];
    for (let i = 0; i < 16; i += 1) {
      const r = i % 2 ? 16 : 29;
      const a = Phaser.Math.DegToRad(i * 22.5);
      pts.push(new Phaser.Geom.Point(32 + Math.cos(a) * r, 32 + Math.sin(a) * r));
    }
    g.fillStyle(0xff8a3d, 1).fillPoints(pts, true);
    g.fillStyle(0xffd166, 1).fillCircle(32, 32, 15);
    g.fillStyle(0xffffff, 1).fillCircle(32, 32, 7);
  });
  make('bst-moves', 64, 64, (g) => {
    g.fillStyle(0x6db8f0, 1).fillCircle(32, 32, 28);
    g.fillStyle(0xffffff, 1).fillRoundedRect(14, 28, 22, 8, 3).fillRoundedRect(21, 21, 8, 22, 3);
    g.fillStyle(0xffffff, 1).fillRoundedRect(40, 18, 12, 6, 2).fillRoundedRect(46, 18, 6, 28, 2)
      .fillRoundedRect(40, 29, 12, 6, 2).fillRoundedRect(40, 40, 12, 6, 2);
  });

  // Pointing hand for the tutorial (fingertip at the top-left area).
  make('ui-hand', 64, 64, (g) => {
    g.fillStyle(0x3f5a4a, 1);
    g.fillRoundedRect(14, 2, 16, 40, 8).fillRoundedRect(12, 28, 40, 32, 14).fillEllipse(52, 40, 14, 22);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(17, 5, 10, 36, 5).fillRoundedRect(15, 31, 34, 26, 11).fillEllipse(50, 41, 8, 16);
    g.fillStyle(0xe8eef0, 1).fillRoundedRect(29, 33, 4, 12, 2).fillRoundedRect(38, 33, 4, 12, 2);
  });

  // Gold coin with a little flower stamped on it.
  make('ui-coin', 64, 64, (g) => {
    g.fillStyle(0xc98a0e, 1).fillCircle(32, 34, 28);
    g.fillStyle(0xffc93c, 1).fillCircle(32, 31, 28);
    g.fillStyle(0xf0a91c, 1).fillCircle(32, 31, 21);
    g.fillStyle(0xffd966, 1).fillCircle(32, 30, 19);
    g.fillStyle(0xf0a91c, 1);
    [0, 72, 144, 216, 288].forEach((deg) => {
      const a = Phaser.Math.DegToRad(deg - 90);
      g.fillCircle(32 + Math.cos(a) * 8, 30 + Math.sin(a) * 8, 6);
    });
    g.fillStyle(0xfff3b0, 1).fillCircle(32, 30, 4.5);
    g.fillStyle(0xffffff, 0.6).fillEllipse(22, 16, 14, 7);
  });
  // Gift box for the daily reward.
  make('ui-gift', 64, 64, (g) => {
    g.fillStyle(0xc93a6e, 1).fillRoundedRect(8, 28, 48, 32, 6);
    g.fillStyle(0xff5ea8, 1).fillRoundedRect(8, 26, 48, 30, 6);
    g.fillStyle(0xe0487f, 1).fillRoundedRect(4, 18, 56, 14, 5);
    g.fillStyle(0xff7ab8, 1).fillRoundedRect(4, 16, 56, 13, 5);
    g.fillStyle(0xffd166, 1).fillRect(28, 16, 8, 44);
    g.fillStyle(0xffd166, 1).fillEllipse(22, 12, 20, 12).fillEllipse(42, 12, 20, 12);
    g.fillStyle(0xf0a91c, 1).fillCircle(32, 15, 5);
    g.fillStyle(0xffffff, 0.45).fillRoundedRect(10, 18, 18, 4, 2);
  });

  // Speaker icons for the mute button.
  const speaker = (g) => {
    const cone = [[8, 24], [20, 24], [36, 10], [36, 54], [20, 40], [8, 40]].map(([x, y]) => new Phaser.Geom.Point(x, y));
    g.fillStyle(0xffffff, 1).lineStyle(4, 0x8a5a00, 1).fillPoints(cone, true).strokePoints(cone, true);
    g.fillPoints(cone, true);
  };
  make('ui-sound-on', 64, 64, (g) => {
    speaker(g);
    [[12, 4], [22, 4]].forEach(([r, w]) => {
      g.lineStyle(w + 4, 0x8a5a00, 1).beginPath().arc(38, 32, r, -0.9, 0.9).strokePath();
      g.lineStyle(w, 0xffffff, 1).beginPath().arc(38, 32, r, -0.9, 0.9).strokePath();
    });
  });
  make('ui-sound-off', 64, 64, (g) => {
    speaker(g);
    [[[44, 22], [60, 42]], [[60, 22], [44, 42]]].forEach(([[x1, y1], [x2, y2]]) => {
      g.lineStyle(9, 0x8a5a00, 1).lineBetween(x1, y1, x2, y2);
      g.lineStyle(5, 0xff5a6e, 1).lineBetween(x1, y1, x2, y2);
    });
  });

  make('ui-lock', 48, 48, (g) => {
    g.lineStyle(6, 0x8a8f96, 1).strokeCircle(24, 20, 10);
    g.fillStyle(0x8a8f96, 1).fillRoundedRect(8, 20, 32, 24, 6);
    g.fillStyle(0xb9bec4, 1).fillRoundedRect(10, 20, 28, 20, 5);
    g.fillStyle(0x6b7077, 1).fillCircle(24, 29, 4).fillRect(22, 29, 4, 8);
  });
}

const TITLE_COLORS = {
  green: COLORS.title, yellow: COLORS.title, blue: '#2e7fd0', red: '#d0453a', purple: '#8a3fd8',
};

/**
 * Centered wooden popup over a dimmed backdrop that blocks input.
 * Returns { panel, top, width, height, close }: add content to `panel`; `top` is the y below the title.
 */
export function showModal(scene, { title, color = 'green', width = 340, height = 300, depth = 100 }) {
  const { width: W, height: H } = scale(scene);
  const overlay = scene.add.rectangle(W / 2, H / 2, W, H, 0x10200f, 0)
    .setDepth(depth).setInteractive().setScrollFactor(0);
  scene.tweens.add({ targets: overlay, fillAlpha: 0.55, duration: 220 });

  // The panel is always built at its design width; narrow phones scale the whole
  // panel down (below) so rows of icons and buttons never spill past the border.
  const panelW = width;
  const panel = scene.add.container(W / 2, H / 2).setDepth(depth + 1).setScrollFactor(0);
  const bg = scene.add.image(0, 0, panelTexture(scene, panelW, height));
  const titleText = scene.add.text(0, -height / 2 + 40, title, textStyle(30, TITLE_COLORS[color] ?? COLORS.title, {
    stroke: '#ffffff', strokeThickness: 6,
    shadow: { offsetX: 0, offsetY: 3, color: 'rgba(120,60,0,0.25)', blur: 0, fill: true, stroke: true },
  })).setOrigin(0.5);
  // Dashed divider under the title.
  const divider = scene.add.graphics();
  divider.fillStyle(0xd9a86c, 0.8);
  const dw = Math.min(panelW - 90, 240);
  for (let dx = -dw / 2; dx < dw / 2; dx += 14) divider.fillRoundedRect(dx, -height / 2 + 64, 8, 3, 1.5);
  // Little flowers tucked into two corners.
  const deco = (x, y, angle, size) => [
    scene.add.image(x + size * 0.45, y + size * 0.2, 'jewel-leaf').setDisplaySize(size * 0.75, size * 0.75).setAngle(angle + 40),
    scene.add.image(x, y, 'jewel-rose').setDisplaySize(size, size).setAngle(angle),
  ];
  panel.add([bg, divider, titleText,
    ...deco(-panelW / 2 + 12, -height / 2 + 10, -18, 34),
    ...deco(panelW / 2 - 14, height / 2 - 12, 12, 28)]);
  panel.list.forEach((child) => child.setScrollFactor?.(0));

  // Tall popups shrink to fit short screens (small phones in landscape or with browser bars).
  const fit = Math.min(1, (H - 16) / (height + 40), (W - 20) / panelW);
  panel.setScale(0.6 * fit).setAlpha(0);
  scene.tweens.add({ targets: panel, scale: fit, alpha: 1, duration: 320, ease: 'Back.easeOut' });
  playSfx(scene, 'swap', { volume: 0.6, detune: 400 });

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    scene.tweens.add({ targets: overlay, fillAlpha: 0, duration: 160, onComplete: () => overlay.destroy() });
    scene.tweens.add({ targets: panel, scale: 0.75 * fit, alpha: 0, duration: 160, onComplete: () => panel.destroy() });
  };
  return { panel, top: -height / 2 + 70, width: panelW, height, close };
}

function scale(scene) {
  return { width: scene.scale.width, height: scene.scale.height };
}

/** Heart + count + regen timer. Call `refresh()` every second. */
export function makeLivesBadge(scene, x, y, lives) {
  const badge = scene.add.container(x, y);
  const bg = scene.add.image(40, -2, pillTexture(scene, 128, 44));
  const heart = scene.add.image(0, -2, 'ui-heart').setDisplaySize(48, 48);
  const count = scene.add.text(0, -4, '', titleStyle(19, '#b02a3c')).setOrigin(0.5);
  const timer = scene.add.text(30, -2, '', textStyle(18, COLORS.text)).setOrigin(0, 0.5);
  badge.add([bg, heart, count, timer]);
  badge.refresh = () => {
    const n = lives.count();
    const unlimited = lives.isUnlimited?.();
    count.setText(unlimited ? '∞' : `${n}`).setFontFamily(unlimited ? 'Arial, sans-serif' : FONT);
    heart.setTexture(n > 0 ? 'ui-heart' : 'ui-heart-empty');
    const ms = lives.msToNext();
    timer.setText(unlimited ? formatMs(lives.msUnlimited()) : ms > 0 ? formatMs(ms) : 'Full');
  };
  badge.refresh();
  return badge;
}

function formatMs(ms) {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Boost color saturation for the whole scene (WebGL only; harmless elsewhere). */
export function makeVivid(scene, amount = 0.1) {
  const fx = scene.cameras.main.postFX?.addColorMatrix();
  fx?.saturate(amount);
}

/** Texture used for a booster's icon. */
export function boosterIcon(kind) {
  return {
    trowel: 'bst-trowel', breeze: 'bst-breeze', swap: 'bst-swap', rainbow: 'tile-rainbow', burst: 'bst-burst', moves: 'bst-moves',
  }[kind];
}

/** Glossy booster slot with a count badge (or a green "+" when empty). `setCount(n)`, `setActive(bool)`. */
export function makeBoosterButton(scene, { x, y, kind, size = 64, onClick }) {
  const button = scene.add.container(x, y);
  const radius = size * 0.28;
  const tex = { normal: buttonTexture(scene, size, size, 'blue', radius), active: buttonTexture(scene, size, size, 'yellow', radius) };
  const glow = scene.add.image(0, 0, 'fx-glow').setDisplaySize(size * 2, size * 2).setTint(0xfff3b0).setVisible(false);
  const bg = scene.add.image(0, 0, tex.normal);
  const icon = scene.add.image(0, -3, boosterIcon(kind)).setDisplaySize(size * 0.64, size * 0.64);
  const badge = makeCountBadge(scene, size * 0.4, -size * 0.36, 0, Math.round(size * 0.42));
  const plus = scene.add.image(size * 0.4, size * 0.34, buttonTexture(scene, 26, 26, 'green', 13)).setScale(Math.max(0.8, size / 70));
  const plusGlyph = scene.add.image(plus.x, plus.y - 1, glyphTexture(scene, 'plus')).setDisplaySize(15 * plus.scale, 15 * plus.scale);
  button.add([glow, bg, icon, badge, plus, plusGlyph]);
  button.setSize(size, size);
  pressable(scene, button, onClick);

  let pulse = null;
  button.setCount = (n) => {
    if (button.lockedUntil) return;
    badge.setValue(n);
    badge.setVisible(n > 0);
    plus.setVisible(n <= 0);
    plusGlyph.setVisible(n <= 0);
    icon.setAlpha(n > 0 ? 1 : 0.75);
  };
  button.setActive = (on) => {
    glow.setVisible(on);
    bg.setTexture(on ? tex.active : tex.normal);
    pulse?.stop();
    if (on) pulse = scene.tweens.add({ targets: glow, alpha: { from: 1, to: 0.4 }, duration: 500, yoyo: true, repeat: -1 });
  };
  // Locked slot: grey, a padlock and the level that opens it.
  let lockParts = null;
  button.setLocked = (level) => {
    button.lockedUntil = level ?? null;
    lockParts?.forEach((o) => o.destroy());
    lockParts = null;
    const locked = !!level;
    bg.setTexture(locked ? buttonTexture(scene, size, size, 'grey', radius) : tex.normal);
    icon.setVisible(!locked);
    if (locked) {
      [badge, plus, plusGlyph].forEach((o) => o.setVisible(false));
      lockParts = [
        scene.add.image(0, -6, 'ui-lock').setDisplaySize(size * 0.42, size * 0.42),
        scene.add.text(0, size * 0.26, `Lv ${level}`, textStyle(Math.round(size * 0.2), '#ffffff', { stroke: '#666666', strokeThickness: 4 })).setOrigin(0.5),
      ];
      button.add(lockParts);
    }
  };
  return button;
}

let activeTip = null;

/**
 * Small speech-bubble tooltip pointing at (x, y) in screen space. Only one shows at a time;
 * it closes on the next tap or after a few seconds.
 */
export function showTooltip(scene, x, y, title, body, { below = false, depth = 300, duration = 3200 } = {}) {
  if (activeTip?.active) activeTip.destroy();
  const W = scene.scale.width;
  const w = Math.min(250, W - 24);
  const tip = scene.add.container(x, y).setDepth(depth).setScrollFactor(0);
  const head = scene.add.text(0, 0, title, textStyle(17, '#7a4a1e', { wordWrap: { width: w - 28 }, align: 'center' })).setOrigin(0.5, 0);
  const text = scene.add.text(0, 0, body, textStyle(14, '#9a6b3c', { wordWrap: { width: w - 28 }, align: 'center' })).setOrigin(0.5, 0);
  const h = 12 + head.height + 4 + text.height + 12;
  const bx = Phaser.Math.Clamp(x, w / 2 + 12, W - w / 2 - 12) - x;
  const top = below ? 14 : -14 - h;
  head.setPosition(bx, top + 12);
  text.setPosition(bx, top + 12 + head.height + 4);
  const g = scene.add.graphics();
  g.fillStyle(0x5a3a1a, 0.18).fillRoundedRect(bx - w / 2, top + 4, w, h, 16);
  g.fillStyle(0xfff8e8, 1).fillRoundedRect(bx - w / 2, top, w, h, 16);
  g.lineStyle(3, 0xe8b46a, 1).strokeRoundedRect(bx - w / 2, top, w, h, 16);
  const ay = below ? 14 : -14;
  g.fillStyle(0xfff8e8, 1).fillTriangle(-9, ay, 9, ay, 0, below ? 2 : -2);
  g.lineStyle(3, 0xe8b46a, 1).lineBetween(-9, ay, 0, below ? 2 : -2).lineBetween(9, ay, 0, below ? 2 : -2);
  tip.add([g, head, text]);
  tip.setScale(0.6).setAlpha(0);
  scene.tweens.add({ targets: tip, scale: 1, alpha: 1, duration: 180, ease: 'Back.easeOut' });

  const close = () => {
    if (!tip.active) return;
    scene.tweens.add({ targets: tip, alpha: 0, scale: 0.85, duration: 140, onComplete: () => tip.destroy() });
  };
  const timer = duration > 0 ? scene.time.delayedCall(duration, close) : null;
  scene.time.delayedCall(120, () => scene.input.once('pointerdown', close));
  tip.once('destroy', () => timer?.remove());
  tip.close = close;
  activeTip = tip;
  return tip;
}
