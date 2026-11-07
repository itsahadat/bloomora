import Phaser from 'phaser';
import { BOARD_ROWS, BOARD_COLS, JEWEL_TYPES, JEWEL_COLORS } from '../config/Constants.js';
import { playSfx } from '../core/Sound.js';
import { tileTexture } from '../ui/Skin.js';
import { ensureObstacleArt } from '../ui/ObstacleArt.js';

/** Size of one cell in board-local units. The whole board is scaled to fit the screen. */
export const CELL = 64;

const ROWS = BOARD_ROWS;
const COLS = BOARD_COLS;
const SWAP_MS = 150;
const FALL_STEP_MS = 70;

const key = (r, c) => `${r},${c}`;
const parseKey = (k) => k.split(',').map(Number);
const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
const NEIGHBORS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/** Texture used to show a goal of the given kind (blooms and obstacles). */
const OBSTACLE_ICONS = {
  soil: 'cell-soil1', crate: 'ob-crate1', vine: 'ob-vine', weed: 'ob-weed', seed: 'item-seed', pot: 'ob-pot',
};
export function goalIconKey(type) {
  return OBSTACLE_ICONS[type] ?? `jewel-${type}`;
}

/**
 * Level layout: an array of ROWS strings, COLS characters each.
 *   .  normal cell        _  hole (not part of the board)
 *   s  dry soil (1 layer) S  dry soil (2 layers)
 *   c  planter box (1 hp) C  planter box (2 hp)
 *   v  vine-wrapped bloom
 *   w  thorny weed (spreads if you don't clear one each turn)
 *   1-9 thirsty pot that wants blooms of JEWEL_TYPES[n-1]
 *       (rose, leaf, drop, sun, berry, crystal, carrot, strawberry, apple)
 */
export function parseLayout(layout) {
  return Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => {
    const ch = layout?.[r]?.[c] ?? '.';
    return {
      playable: ch !== '_',
      soil: ch === 's' ? 1 : ch === 'S' ? 2 : 0,
      crate: ch === 'c' ? 1 : ch === 'C' ? 2 : 0,
      vine: ch === 'v' ? 1 : 0,
      weed: ch === 'w' ? 1 : 0,
      pot: /[1-9]/.test(ch) ? Number(ch) : 0,
    };
  }));
}

/** How many soil cells / planter boxes / vines a layout contains (used for "clear all" goals). */
export function countLayout(layout) {
  const counts = { soil: 0, crate: 0, vine: 0, weed: 0, pot: 0 };
  parseLayout(layout).flat().forEach((cell) => {
    if (cell.soil) counts.soil += 1;
    if (cell.crate) counts.crate += 1;
    if (cell.weed) counts.weed += 1;
    if (cell.vine) counts.vine += 1;
    if (cell.pot) counts.pot += 1;
  });
  return counts;
}

/**
 * Special tiles:
 *  - lineH / lineV : made by matching 4 in a row; clears its whole row / column.
 *  - bomb          : made by an L or T shaped match; bursts a diamond around it.
 *  - rainbow       : made by matching 5 in a row; swap it with a bloom to clear every bloom of that kind.
 * Swapping two specials together triggers a bigger combo.
 */
export class Board {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.types = options.types ?? JEWEL_TYPES;
    this.on = {
      moveUsed: () => {},
      collect: () => {},
      combo: () => {},
      turnEnd: () => {},
      shuffle: () => {},
      boosterUsed: () => {},
      weedSpread: () => {},
      score: () => {},
      ...options.callbacks,
    };

    this.cells = parseLayout(options.layout);
    // Thirsty pots: turn the layout digit into the bloom kind it wants and how many.
    this.cells.flat().forEach((cell) => {
      cell.pot = cell.pot ? { type: JEWEL_TYPES[cell.pot - 1], need: options.potNeed ?? 4 } : null;
    });
    // Seed Drop: how many seeds still have to enter the board.
    this.seedsToSpawn = options.seeds ?? 0;
    this.weedCleared = false;
    this.turnWasMove = false;
    this.grid = [];
    this.busy = true;
    this.locked = false;
    this.selected = null;
    this.dragStart = null;
    this.chain = 0;
    /** Active booster that changes what a tap does: 'trowel' | 'swap' | null. */
    this.mode = null;
    this.hintTimer = null;
    this.hintTweens = [];
    this.scaleFactor = 1;
    this.lastSfx = {};

    Board.ensureTextures(scene);

    this.root = scene.add.container(0, 0);
    this.bg = scene.add.graphics();
    this.groundLayer = scene.add.container(0, 0);
    this.selGfx = scene.add.graphics();
    this.tileLayer = scene.add.container(0, 0);
    this.overLayer = scene.add.container(0, 0);
    this.fxLayer = scene.add.container(0, 0);
    this.root.add([this.bg, this.groundLayer, this.selGfx, this.tileLayer, this.overLayer, this.fxLayer]);

    // New tiles fall in from above the board; the mask hides them until they enter it.
    this.maskShape = scene.make.graphics({}, false);
    this.tileLayer.setMask(this.maskShape.createGeometryMask());

    this.createEmitters();
    this.drawBackground();
    this.createObstacleSprites();
    this.setupInput();

    scene.events.once('shutdown', () => {
      this.hintTimer?.remove();
      this.maskShape.destroy();
    });
  }

  // ---------------------------------------------------------------- textures / fx setup

  static ensureTextures(scene) {
    // Glossy 128px obstacle art first; the flat versions below are then skipped.
    ensureObstacleArt(scene);
    const tex = scene.textures;
    const make = (name, w, h, draw) => {
      if (tex.exists(name)) return;
      const g = scene.make.graphics({}, false);
      draw(g);
      g.generateTexture(name, w, h);
      g.destroy();
    };

    make('fx-spark', 16, 16, (g) => g.fillStyle(0xffffff, 1).fillCircle(8, 8, 8));
    make('fx-petal', 20, 12, (g) => g.fillStyle(0xffffff, 1).fillEllipse(10, 6, 20, 11));
    make('fx-chip', 12, 12, (g) => g.fillStyle(0xffffff, 1).fillRect(0, 0, 12, 7));

    make('tile-rainbow', 64, 64, (g) => {
      const colors = [0xff5ea8, 0xffd166, 0x58d68d, 0x53b9ff, 0xc77dff];
      colors.forEach((color, i) => {
        g.fillStyle(color, 1);
        g.slice(32, 32, 28, Phaser.Math.DegToRad(i * 72 - 90), Phaser.Math.DegToRad((i + 1) * 72 - 90), false);
        g.fillPath();
      });
      g.lineStyle(3, 0xffffff, 0.95).strokeCircle(32, 32, 28);
      g.fillStyle(0xffffff, 1).fillCircle(32, 32, 12);
      g.fillStyle(0xfff3b0, 1).fillCircle(32, 32, 7);
    });

    // Ground: dry soil (two strengths) and the grass that grows once it is cleared.
    const speckles = [[14, 16], [40, 12], [26, 30], [48, 38], [16, 46], [36, 50], [52, 22], [8, 32]];
    const soil = (g, base, dark, count) => {
      g.fillStyle(base, 1).fillRoundedRect(2, 2, 60, 60, 11);
      g.fillStyle(dark, 1);
      speckles.slice(0, count).forEach(([x, y]) => g.fillEllipse(x, y, 7, 4));
      g.lineStyle(2, dark, 0.8).strokeRoundedRect(3, 3, 58, 58, 10);
    };
    make('cell-soil1', 64, 64, (g) => soil(g, 0xc08a52, 0x8f5f30, 6));
    make('cell-soil2', 64, 64, (g) => soil(g, 0x9a6634, 0x6b421d, 8));
    make('cell-grass', 64, 64, (g) => {
      g.fillStyle(0xb5e39c, 1).fillRoundedRect(2, 2, 60, 60, 11);
      g.fillStyle(0x86c96b, 1);
      [[12, 50], [24, 18], [44, 46], [50, 16], [32, 34], [14, 28]].forEach(([x, y]) => {
        g.fillTriangle(x - 3, y + 5, x, y - 6, x + 3, y + 5);
        g.fillTriangle(x + 2, y + 5, x + 6, y - 3, x + 7, y + 5);
      });
    });

    // Planter boxes.
    const crate = (g, banded) => {
      g.fillStyle(0x8a5a2b, 1).fillRoundedRect(3, 5, 58, 56, 9);
      g.fillStyle(0xc98b4f, 1).fillRoundedRect(3, 3, 58, 54, 9);
      g.fillStyle(0xb37640, 1);
      [17, 31, 45].forEach((y) => g.fillRect(6, y, 52, 2));
      g.fillStyle(0xe0a96d, 1).fillRect(8, 6, 48, 4);
      if (banded) {
        g.fillStyle(0x8e9aa6, 1).fillRect(3, 12, 58, 6).fillRect(3, 40, 58, 6);
        g.fillStyle(0xd0d8df, 1);
        [[8, 15], [56, 15], [8, 43], [56, 43]].forEach(([x, y]) => g.fillCircle(x, y, 2.5));
      } else {
        g.fillStyle(0x6e4320, 1);
        [[9, 9], [55, 9], [9, 51], [55, 51]].forEach(([x, y]) => g.fillCircle(x, y, 2));
      }
      g.lineStyle(2, 0x6e4320, 1).strokeRoundedRect(3, 3, 58, 56, 9);
    };
    // Thorny weed: a dark bramble knot with thorns and a sly little purple bud.
    make('ob-weed', 64, 64, (g) => {
      g.fillStyle(0x2d5a2a, 1).fillCircle(32, 34, 26);
      g.fillStyle(0x3f7a35, 1).fillCircle(26, 30, 15).fillCircle(40, 30, 14).fillCircle(32, 42, 15);
      g.fillStyle(0x56993f, 1).fillCircle(24, 26, 8).fillCircle(41, 27, 7).fillCircle(33, 41, 8);
      g.fillStyle(0xe6e0c8, 1);
      [[8, 30, -1, 0], [56, 30, 1, 0], [32, 6, 0, -1], [14, 52, -1, 1], [50, 52, 1, 1], [16, 12, -1, -1], [48, 12, 1, -1]]
        .forEach(([x, y, dx, dy]) => g.fillTriangle(x - dy * 4, y + dx * 4, x + dy * 4, y - dx * 4, x + dx * 9, y + dy * 9));
      g.fillStyle(0x9b59d0, 1).fillCircle(44, 18, 6);
      g.fillStyle(0xc89bf0, 1).fillCircle(42, 16, 2.5);
    });
    // Seed pod that has to be brought down to the bottom of the board.
    make('item-seed', 64, 64, (g) => {
      g.fillStyle(0x7a4a22, 1).fillEllipse(32, 38, 38, 44);
      g.fillStyle(0xc98b4f, 1).fillEllipse(32, 38, 34, 40);
      g.fillStyle(0xe8b878, 1).fillEllipse(26, 32, 12, 20);
      g.fillStyle(0x5a3416, 1).fillEllipse(32, 20, 40, 16);
      g.fillStyle(0x8a5a2b, 1).fillEllipse(32, 18, 36, 12);
      g.fillStyle(0x58b04a, 1).fillEllipse(38, 8, 16, 8).fillEllipse(27, 9, 12, 7);
      g.lineStyle(3, 0x3f8a35, 1).lineBetween(32, 14, 33, 6);
    });
    make('ob-crate1', 64, 64, (g) => crate(g, false));
    make('ob-crate2', 64, 64, (g) => crate(g, true));

    // Vines wrapping a bloom.
    make('ob-vine', 64, 64, (g) => {
      const stroke = (points, width, color) => {
        g.lineStyle(width, color, 1);
        const curve = new Phaser.Curves.Spline(points);
        g.strokePoints(curve.getPoints(24));
      };
      [[[4, 14], [22, 26], [42, 18], [60, 34]], [[4, 50], [24, 38], [40, 48], [60, 30]], [[30, 2], [24, 30], [36, 62]]]
        .forEach((pts) => {
          stroke(pts, 7, 0x2e7a3b);
          stroke(pts, 4, 0x5cb85c);
        });
      g.fillStyle(0x4caf50, 1);
      [[14, 20, 0.5], [50, 26, -0.6], [18, 44, -0.4], [46, 44, 0.6], [28, 14, 1]].forEach(([x, y]) => {
        g.fillEllipse(x, y, 13, 7);
      });
      g.fillStyle(0x9be27f, 1);
      [[14, 19], [50, 25], [18, 43], [46, 43]].forEach(([x, y]) => g.fillEllipse(x, y, 6, 2.5));
    });

    // Thirsty pot: a terracotta flower pot with dry soil, waiting to be watered.
    make('ob-pot', 64, 64, (g) => {
      const body = [[12, 24], [52, 24], [46, 60], [18, 60]].map(([x, y]) => new Phaser.Geom.Point(x, y));
      g.fillStyle(0x9c4a2a, 1).fillPoints(body.map((p) => new Phaser.Geom.Point(p.x, p.y + 2)), true);
      g.fillStyle(0xd9703f, 1).fillPoints(body, true);
      g.fillStyle(0xf09a68, 1).fillTriangle(17, 26, 24, 26, 21, 56);
      g.fillStyle(0xb85a32, 1).fillRect(15, 40, 34, 4);
      g.fillStyle(0xa8502c, 1).fillRoundedRect(6, 16, 52, 14, 6);
      g.fillStyle(0xeb8550, 1).fillRoundedRect(6, 14, 52, 13, 6);
      g.fillStyle(0xffb98a, 0.8).fillRoundedRect(10, 15, 22, 4, 2);
      g.fillStyle(0x6b421d, 1).fillEllipse(32, 16, 42, 9);
      g.fillStyle(0x8f5f30, 1).fillEllipse(28, 15, 10, 3).fillEllipse(40, 17, 8, 3);
    });
  }

  createEmitters() {
    const make = (color, texture, gravity = 520) => {
      const emitter = this.scene.add.particles(0, 0, texture, {
        lifespan: { min: 320, max: 680 },
        speed: { min: 90, max: 320 },
        angle: { min: 0, max: 360 },
        rotate: { min: 0, max: 360 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 },
        gravityY: gravity,
        tint: color,
        emitting: false,
      });
      this.fxLayer.add(emitter);
      return emitter;
    };

    this.emitters = {};
    JEWEL_TYPES.forEach((type) => {
      this.emitters[type] = make(JEWEL_COLORS[type], 'fx-petal');
    });
    this.emitters.white = make(0xffffff, 'fx-spark');
    this.emitters.gold = make(0xffd166, 'fx-spark');
    this.emitters.wood = make(0xb37640, 'fx-chip', 700);
    this.emitters.leaf = make(0x4caf50, 'fx-petal', 300);
    this.emitters.grass = make(0x86c96b, 'fx-petal', 200);

    // Kenney particle sprites (128px) for sparkles and twinkles.
    const sparkle = (texture, config) => {
      const emitter = this.scene.add.particles(0, 0, texture, {
        lifespan: { min: 400, max: 800 },
        speed: { min: 40, max: 200 },
        angle: { min: 0, max: 360 },
        rotate: { min: -40, max: 40 },
        alpha: { start: 1, end: 0 },
        emitting: false,
        ...config,
      });
      this.fxLayer.add(emitter);
      return emitter;
    };
    this.emitters.sparkle = sparkle('fx-star6', { scale: { start: 0.55, end: 0 }, tint: [0xffffff, 0xfff3b0, 0xffe08a] });
    this.emitters.twinkle = sparkle('fx-star4', { scale: { start: 0.45, end: 0 }, speed: { min: 20, max: 90 }, tint: 0xffffff });
  }

  /** Play a sound, skipping exact repeats within 40 ms (e.g. several beams firing at once). */
  sfx(key, config) {
    const now = this.scene.time.now;
    if (now - (this.lastSfx[key] ?? -1000) < 40) return;
    this.lastSfx[key] = now;
    playSfx(this.scene, key, config);
  }

  /** A one-shot Kenney sprite flash (glow, ring, magic star...) that grows and fades. */
  flashSprite(texture, x, y, { size = CELL, toScale = 2, tint = 0xffffff, duration = 380, spin = 0, alpha = 0.95 } = {}) {
    const img = this.scene.add.image(x, y, texture).setTint(tint).setAlpha(alpha);
    const base = size / img.width;
    img.setScale(base * 0.3);
    this.fxLayer.add(img);
    this.scene.tweens.add({
      targets: img,
      scale: base * toScale,
      alpha: 0,
      angle: spin,
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => img.destroy(),
    });
  }

  drawBackground() {
    const g = this.bg;
    g.clear();
    const playable = [];
    for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) if (this.cells[r][c].playable) playable.push([r, c]);

    // The frame follows the board's shape, so holes show the garden behind.
    // Soft drop shadow, a deep-teal frame with a lighter rim, then cream tiles with small gaps.
    playable.forEach(([r, c]) => {
      g.fillStyle(0x06221f, 0.35).fillRoundedRect(c * CELL - 12, r * CELL - 4, CELL + 24, CELL + 22, 20);
    });
    playable.forEach(([r, c]) => {
      g.fillStyle(0x2f8a80, 1).fillRoundedRect(c * CELL - 11, r * CELL - 11, CELL + 22, CELL + 22, 18);
    });
    playable.forEach(([r, c]) => {
      g.fillStyle(0x17504b, 1).fillRoundedRect(c * CELL - 7, r * CELL - 7, CELL + 14, CELL + 14, 14);
    });
    playable.forEach(([r, c]) => {
      const { x, y } = this.cellPos(r, c);
      this.groundLayer.add(this.scene.add.image(x, y, tileTexture(this.scene, CELL, (r + c) % 2 === 1)));
    });
  }

  createObstacleSprites() {
    this.groundImages = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.crateSprites = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.weedSprites = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.vineSprites = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.potSprites = Array.from({ length: ROWS }, () => Array(COLS).fill(null));

    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const cell = this.cells[r][c];
        const { x, y } = this.cellPos(r, c);
        if (cell.soil) {
          this.groundImages[r][c] = this.scene.add.image(x, y, `cell-soil${cell.soil}`).setDisplaySize(CELL, CELL);
          this.groundLayer.add(this.groundImages[r][c]);
        }
        if (cell.crate) {
          this.crateSprites[r][c] = this.scene.add.image(x, y, `ob-crate${cell.crate}`).setDisplaySize(CELL - 2, CELL - 2);
          this.overLayer.add(this.crateSprites[r][c]);
        }
        if (cell.weed) this.addWeedSprite(r, c);
        if (cell.pot) this.addPotSprite(r, c);
        if (cell.vine) {
          this.vineSprites[r][c] = this.scene.add.image(x, y, 'ob-vine').setDisplaySize(62, 62);
          this.overLayer.add(this.vineSprites[r][c]);
        }
      }
    }
  }

  // ---------------------------------------------------------------- layout

  /** Fit the board inside the given screen rectangle. Returns the board's on-screen rect. */
  layout(x, y, width, height) {
    const pad = 10;
    const bw = COLS * CELL + pad * 2;
    const bh = ROWS * CELL + pad * 2;
    const s = Math.max(0.2, Math.min(width / bw, height / bh));
    this.scaleFactor = s;

    const ox = x + (width - bw * s) / 2 + pad * s;
    const oy = y + (height - bh * s) / 2 + pad * s;
    this.root.setPosition(ox, oy).setScale(s);

    this.maskShape.clear().fillStyle(0xffffff, 1).fillRect(ox, oy, COLS * CELL * s, ROWS * CELL * s);
    this.rect = { x: ox, y: oy, width: COLS * CELL * s, height: ROWS * CELL * s };
    return this.rect;
  }

  cellPos(r, c) {
    return { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 };
  }

  toWorld(lx, ly) {
    return { x: this.root.x + lx * this.scaleFactor, y: this.root.y + ly * this.scaleFactor };
  }

  pointerToCell(pointer) {
    const lx = (pointer.x - this.root.x) / this.scaleFactor;
    const ly = (pointer.y - this.root.y) / this.scaleFactor;
    const c = Math.floor(lx / CELL);
    const r = Math.floor(ly / CELL);
    return inBounds(r, c) ? { r, c } : null;
  }

  // ---------------------------------------------------------------- helpers

  tween(config) {
    return new Promise((resolve) => {
      this.scene.tweens.add({ ...config, onComplete: () => resolve() });
    });
  }

  wait(ms) {
    return new Promise((resolve) => this.scene.time.delayedCall(ms, resolve));
  }

  tileAt(k) {
    const [r, c] = parseKey(k);
    return this.grid[r]?.[c] ?? null;
  }

  cellAt(k) {
    const [r, c] = parseKey(k);
    return this.cells[r]?.[c] ?? null;
  }

  /** A cell that can hold a bloom (part of the board and not a planter box). */
  holdsTile(r, c) {
    const cell = this.cells[r]?.[c];
    return !!cell && cell.playable && cell.crate === 0 && cell.weed === 0 && !cell.pot;
  }

  /** A bloom that can be swapped or fall (not wrapped in vines). */
  isMovable(r, c) {
    return this.holdsTile(r, c) && !!this.grid[r][c] && this.cells[r][c].vine === 0;
  }

  randomType() {
    return Phaser.Utils.Array.GetRandom(this.types);
  }

  canInteract() {
    return !this.busy && !this.locked;
  }

  // ---------------------------------------------------------------- tiles

  createTile(r, c, type, special = null, startY = null) {
    const { x, y } = this.cellPos(r, c);
    const sprite = this.scene.add.container(x, startY ?? y);
    const tile = { r, c, type, special, sprite, loops: [] };
    this.tileLayer.add(sprite);
    this.grid[r][c] = tile;
    this.renderTile(tile);
    return tile;
  }

  stopLoops(tile) {
    tile.loops.forEach((t) => t.stop());
    tile.loops = [];
  }

  renderTile(tile) {
    const { scene } = this;
    this.stopLoops(tile);
    tile.sprite.removeAll(true);

    if (tile.special === 'seed') {
      const seed = scene.add.image(0, 0, 'item-seed').setDisplaySize(54, 54);
      const glow = scene.add.image(0, 0, 'fx-glow').setDisplaySize(90, 90).setTint(0xfff3b0).setAlpha(0.55);
      tile.sprite.add([glow, seed]);
      tile.loops.push(scene.tweens.add({ targets: seed, angle: { from: -6, to: 6 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
      tile.loops.push(scene.tweens.add({ targets: glow, alpha: 0.2, duration: 900, yoyo: true, repeat: -1 }));
      return;
    }

    if (tile.special === 'rainbow') {
      const orb = scene.add.image(0, -2, 'tile-rainbow').setDisplaySize(56, 56);
      tile.sprite.add(orb);
      tile.loops.push(scene.tweens.add({ targets: orb, angle: { from: -8, to: 8 }, scale: orb.scale * 1.06, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
      return;
    }

    const color = JEWEL_COLORS[tile.type];
    tile.sprite.add(scene.add.ellipse(0, 22, 40, 10, 0x5a3d1a, 0.18));

    if (tile.special === 'lineH' || tile.special === 'lineV') {
      // Capsule rocket with a little badge of its bloom in the middle window.
      const horizontal = tile.special === 'lineH';
      const glow = scene.add.image(0, 0, 'fx-glow').setTint(color).setDisplaySize(70, 70).setAlpha(0.55);
      const capsule = scene.add.image(0, 0, horizontal ? 'sp-line-h' : 'sp-line-v').setDisplaySize(60, 60);
      const badge = scene.add.image(0, 0, `jewel-${tile.type}`).setDisplaySize(26, 26);
      tile.sprite.add([glow, capsule, badge]);
      tile.loops.push(scene.tweens.add({ targets: glow, alpha: 0.2, duration: 460, yoyo: true, repeat: -1 }));
      tile.loops.push(scene.tweens.add({
        targets: capsule, [horizontal ? 'x' : 'y']: { from: -1.5, to: 1.5 }, duration: 90, yoyo: true, repeat: -1,
      }));
      return;
    }

    if (tile.special === 'bomb') {
      const glow = scene.add.image(0, 2, 'fx-glow').setTint(color).setDisplaySize(72, 72).setAlpha(0.55);
      const bomb = scene.add.image(0, -2, 'sp-bomb').setDisplaySize(58, 58);
      const badge = scene.add.image(-3, 5, `jewel-${tile.type}`).setDisplaySize(24, 24);
      tile.sprite.add([glow, bomb, badge]);
      tile.loops.push(scene.tweens.add({ targets: [bomb, badge], scaleX: '*=1.06', scaleY: '*=0.95', duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
      tile.loops.push(scene.tweens.add({ targets: glow, alpha: 0.2, duration: 380, yoyo: true, repeat: -1 }));
      return;
    }

    tile.sprite.add(scene.add.image(0, -1, `jewel-${tile.type}`).setDisplaySize(54, 54));
  }

  moveTile(tile, duration = SWAP_MS, ease = 'Quad.easeInOut') {
    const { x, y } = this.cellPos(tile.r, tile.c);
    return this.tween({ targets: tile.sprite, x, y, duration, ease });
  }

  swapInGrid(a, b) {
    const t1 = this.grid[a.r][a.c];
    const t2 = this.grid[b.r][b.c];
    this.grid[a.r][a.c] = t2;
    this.grid[b.r][b.c] = t1;
    t2.r = a.r; t2.c = a.c;
    t1.r = b.r; t1.c = b.c;
  }

  // ---------------------------------------------------------------- board setup

  async start() {
    this.busy = true;
    const typeAt = (r, c) => (inBounds(r, c) ? this.grid[r][c]?.type : undefined);
    let attempts = 0;
    do {
      this.grid = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => (
        this.holdsTile(r, c) ? { r, c, type: null, special: null, sprite: null, loops: [] } : null
      )));
      for (let r = 0; r < ROWS; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          if (!this.grid[r][c]) continue;
          let type;
          do {
            type = this.randomType();
          } while (
            (typeAt(r, c - 1) === type && typeAt(r, c - 2) === type) ||
            (typeAt(r - 1, c) === type && typeAt(r - 2, c) === type)
          );
          this.grid[r][c].type = type;
        }
      }
      attempts += 1;
    } while (!this.findPossibleMove() && attempts < 50);

    // Seed Drop: the first seed starts near the top of the board.
    if (this.seedsToSpawn > 0) {
      const spots = this.grid.flat().filter((t) => t && t.r <= 1 && this.cells[t.r][t.c].vine === 0);
      const spot = Phaser.Utils.Array.GetRandom(spots);
      if (spot) {
        spot.type = null;
        spot.special = 'seed';
        this.seedsToSpawn -= 1;
      }
    }

    const drops = [];
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        if (!this.grid[r][c]) continue;
        const { y } = this.cellPos(r, c);
        const tile = this.createTile(r, c, this.grid[r][c].type, this.grid[r][c].special, y - ROWS * CELL - 40);
        drops.push(this.tween({
          targets: tile.sprite,
          y,
          duration: 460,
          delay: (ROWS - 1 - r) * 45 + c * 18,
          ease: 'Back.easeOut',
        }));
      }
    }
    await Promise.all(drops);
    this.busy = false;
    this.resetHint();
  }

  // ---------------------------------------------------------------- input

  setupInput() {
    const input = this.scene.input;

    input.on('pointerdown', (pointer) => {
      this.stopHint();
      if (!this.canInteract()) return;
      const cell = this.pointerToCell(pointer);
      if (this.mode === 'trowel') {
        const target = cell && this.cells[cell.r][cell.c];
        const tile = this.grid[cell?.r]?.[cell?.c];
        if (target?.playable && ((tile && tile.special !== 'seed') || target.crate || target.weed || target.pot)) this.useTrowel(cell);
        return;
      }
      if (!cell || !this.holdsTile(cell.r, cell.c)) {
        this.clearSelection();
        return;
      }

      if (this.selected && Math.abs(this.selected.r - cell.r) + Math.abs(this.selected.c - cell.c) === 1) {
        const from = this.selected;
        this.clearSelection();
        this.trySwap(from, cell);
        return;
      }

      if (!this.isMovable(cell.r, cell.c)) {
        this.clearSelection();
        this.nudgeBlocked(cell);
        return;
      }

      this.dragStart = { cell, x: pointer.x, y: pointer.y };
      this.select(cell);
    });

    input.on('pointermove', (pointer) => {
      if (!this.dragStart || !pointer.isDown || !this.canInteract()) return;
      const dx = pointer.x - this.dragStart.x;
      const dy = pointer.y - this.dragStart.y;
      const threshold = CELL * this.scaleFactor * 0.32;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;

      const from = this.dragStart.cell;
      const to = Math.abs(dx) > Math.abs(dy)
        ? { r: from.r, c: from.c + Math.sign(dx) }
        : { r: from.r + Math.sign(dy), c: from.c };
      this.dragStart = null;
      this.clearSelection();
      if (inBounds(to.r, to.c)) this.trySwap(from, to);
    });

    input.on('pointerup', () => {
      this.dragStart = null;
    });
  }

  /** Little wiggle when the player pokes something that can't move. */
  nudgeBlocked({ r, c }) {
    const target = this.vineSprites[r]?.[c] ?? this.crateSprites[r]?.[c] ?? this.weedSprites[r]?.[c] ?? this.potSprites[r]?.[c];
    if (!target) return;
    this.scene.tweens.add({ targets: target, angle: { from: -6, to: 6 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => target.setAngle(0) });
  }

  select(cell) {
    this.clearSelection();
    this.selected = cell;
    const g = this.selGfx;
    g.lineStyle(4, 0x6fcf8a, 1).strokeRoundedRect(cell.c * CELL + 2, cell.r * CELL + 2, CELL - 4, CELL - 4, 12);
    g.fillStyle(0xbdeec9, 0.6).fillRoundedRect(cell.c * CELL + 2, cell.r * CELL + 2, CELL - 4, CELL - 4, 12);
    const tile = this.grid[cell.r][cell.c];
    if (tile) {
      this.sfx('select');
      this.selectTween = this.scene.tweens.add({
        targets: tile.sprite, scale: 1.12, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
  }

  clearSelection() {
    this.selGfx.clear();
    if (this.selectTween) {
      const target = this.selectTween.targets?.[0];
      this.selectTween.stop();
      target?.setScale?.(1);
      this.selectTween = null;
    }
    this.selected = null;
  }

  // ---------------------------------------------------------------- hint

  resetHint() {
    this.hintTimer?.remove();
    this.hintTimer = this.scene.time.delayedCall(5000, () => this.showHint());
  }

  showHint() {
    if (!this.canInteract()) return;
    const move = this.findPossibleMove();
    if (!move) return;
    this.stopHint();
    this.hintTweens = move.map((tile) => this.scene.tweens.add({
      targets: tile.sprite, scale: 1.16, angle: { from: -6, to: 6 }, duration: 220, yoyo: true, repeat: 3,
      onComplete: () => tile.sprite.setScale(1).setAngle(0),
    }));
    this.hintTimer = this.scene.time.delayedCall(4000, () => this.showHint());
  }

  stopHint() {
    this.hintTimer?.remove();
    this.hintTweens.forEach((t) => {
      const target = t.targets?.[0];
      t.stop();
      target?.setScale?.(1).setAngle?.(0);
    });
    this.hintTweens = [];
  }

  // ---------------------------------------------------------------- turn flow

  async trySwap(a, b) {
    if (!this.canInteract()) return;
    const free = this.mode === 'swap';
    if (!this.isMovable(a.r, a.c) || !this.isMovable(b.r, b.c)) {
      this.nudgeBlocked(this.isMovable(a.r, a.c) ? b : a);
      return;
    }
    const tA = this.grid[a.r][a.c];
    const tB = this.grid[b.r][b.c];

    this.busy = true;
    this.stopHint();
    this.chain = 0;
    this.weedCleared = false;
    this.turnWasMove = !free;
    if (free) {
      // Bee Swap: the swap always sticks and doesn't use a move.
      this.mode = null;
      this.on.boosterUsed('swap');
    }
    const useMove = () => {
      if (!free) this.on.moveUsed();
    };

    this.sfx('swap');
    this.swapInGrid(a, b);
    await Promise.all([this.moveTile(tA), this.moveTile(tB)]);

    const power = (t) => t.special && t.special !== 'seed';
    const isCombo = (tA.special === 'rainbow' && tB.special !== 'seed')
      || (tB.special === 'rainbow' && tA.special !== 'seed')
      || (power(tA) && power(tB));

    if (isCombo) {
      useMove();
      await this.resolveSwapCombo(tA, tB);
    } else {
      const groups = this.findGroups();
      if (groups.length === 0 && free) {
        await this.finishTurn();
        return;
      }
      if (groups.length === 0) {
        this.sfx('invalid');
        this.swapInGrid(a, b);
        await Promise.all([this.moveTile(tA, SWAP_MS + 30), this.moveTile(tB, SWAP_MS + 30)]);
        this.busy = false;
        this.resetHint();
        return;
      }
      useMove();
      // The tile the player moved is where a special should appear.
      await this.resolveGroups(groups, [key(tA.r, tA.c), key(tB.r, tB.c)]);
    }

    await this.finishTurn();
  }

  /** Let everything settle after a move or booster, then hand control back. */
  async finishTurn() {
    await this.cascade();
    // Weeds spread after a real move that didn't clear any weed.
    if (this.turnWasMove && !this.weedCleared && await this.spreadWeed()) {
      await this.cascade();
    }
    this.turnWasMove = false;
    if (!this.findPossibleMove()) await this.shuffle();
    this.busy = false;
    this.resetHint();
    this.on.turnEnd();
  }

  // ---------------------------------------------------------------- boosters

  /** Trowel: dig up one cell (a bloom, a vine, or one layer of a planter box). */
  async useTrowel({ r, c }) {
    this.mode = null;
    this.on.boosterUsed('trowel');
    this.busy = true;
    this.stopHint();
    this.chain = 0;

    const { x, y } = this.cellPos(r, c);
    const tool = this.scene.add.image(x + 40, y - 80, 'bst-trowel').setDisplaySize(60, 60).setAngle(-35);
    this.fxLayer.add(tool);
    await this.tween({ targets: tool, x: x + 6, y: y - 14, angle: 15, duration: 240, ease: 'Back.easeIn' });
    this.sfx('dig');
    this.scene.cameras.main.shake(90, 0.004);
    this.emitters.wood.explode(8, x, y + 10);
    this.emitters.sparkle.explode(4, x, y);
    this.tween({ targets: tool, y: y - 60, alpha: 0, duration: 260 }).then(() => tool.destroy());

    await this.clearCells([key(r, c)]);
    await this.finishTurn();
  }

  /** Breeze: shuffle the board on demand. */
  async useBreeze() {
    if (!this.canInteract()) return false;
    this.busy = true;
    this.stopHint();
    this.clearSelection();
    this.sfx('breeze');
    await this.shuffle(true);
    this.busy = false;
    this.resetHint();
    return true;
  }

  /**
   * Bonus round after a win: each leftover move turns a random bloom into a line bloom,
   * then they all go off together. `onConvert(worldPos)` fires as each one is picked.
   */
  async bonusRound(count, onConvert) {
    let step = 0;
    this.busy = true;
    this.stopHint();
    const picks = Phaser.Utils.Array.Shuffle(
      this.grid.flat().filter((t) => t && !t.special && this.cells[t.r][t.c].vine === 0),
    ).slice(0, count);

    for (const tile of picks) {
      tile.special = Phaser.Utils.Array.GetRandom(['lineH', 'lineV']);
      this.renderTile(tile);
      const { x, y } = this.cellPos(tile.r, tile.c);
      this.emitters.sparkle.explode(6, x, y);
      playSfx(this.scene, 'pop', { volume: 0.7, step: Math.min(step, 12) });
      step += 1;
      onConvert?.(this.toWorld(x, y));
      this.scene.tweens.add({ targets: tile.sprite, scale: 1.3, duration: 120, yoyo: true });
      await this.wait(110);
    }
    await this.wait(350);
    this.chain = 0;
    await this.clearCells(picks.filter((t) => this.grid[t.r][t.c] === t).map((t) => key(t.r, t.c)));
    await this.cascade();
    this.busy = false;
  }

  /** Pre-level boosters: turn random free blooms into specials before the first move. */
  async applyStartBoosters(kinds) {
    const specials = [];
    if (kinds.includes('rainbow')) specials.push('rainbow');
    if (kinds.includes('burst')) specials.push('bomb', Phaser.Utils.Array.GetRandom(['lineH', 'lineV']));
    if (!specials.length) return;

    this.busy = true;
    const candidates = Phaser.Utils.Array.Shuffle(
      this.grid.flat().filter((t) => t && !t.special && this.cells[t.r][t.c].vine === 0),
    );
    await Promise.all(specials.map((special, i) => {
      const tile = candidates[i];
      if (!tile) return Promise.resolve();
      tile.special = special;
      if (special === 'rainbow') tile.type = null;
      this.renderTile(tile);
      const { x, y } = this.cellPos(tile.r, tile.c);
      tile.sprite.setScale(0);
      return this.wait(i * 250).then(() => {
        playSfx(this.scene, 'special');
        this.emitters.sparkle.explode(10, x, y);
        this.flashSprite('fx-glow', x, y, { size: CELL * 1.8, toScale: 1.4, tint: 0xfff3b0 });
        return this.tween({ targets: tile.sprite, scale: 1, duration: 320, ease: 'Back.easeOut' });
      });
    }));
    this.busy = false;
    this.resetHint();
  }

  async cascade() {
    for (;;) {
      await this.applyGravity();
      if (await this.collectSeeds()) continue;
      const groups = this.findGroups();
      if (groups.length === 0) return;
      await this.wait(40);
      await this.resolveGroups(groups, []);
      if (this.chain >= 2) this.on.combo(this.chain);
    }
  }

  // ---------------------------------------------------------------- matching

  matchType(tile) {
    return tile && tile.special !== 'rainbow' ? tile.type : null;
  }

  findRuns() {
    const runs = [];
    const typeAt = (r, c) => this.matchType(this.grid[r][c]);
    for (let r = 0; r < ROWS; r += 1) {
      let c = 0;
      while (c < COLS) {
        const type = typeAt(r, c);
        let end = c + 1;
        if (type) while (end < COLS && typeAt(r, end) === type) end += 1;
        if (type && end - c >= 3) {
          runs.push({ dir: 'h', type, cells: Array.from({ length: end - c }, (_, i) => key(r, c + i)) });
        }
        c = end;
      }
    }
    for (let c = 0; c < COLS; c += 1) {
      let r = 0;
      while (r < ROWS) {
        const type = typeAt(r, c);
        let end = r + 1;
        if (type) while (end < ROWS && typeAt(end, c) === type) end += 1;
        if (type && end - r >= 3) {
          runs.push({ dir: 'v', type, cells: Array.from({ length: end - r }, (_, i) => key(r + i, c)) });
        }
        r = end;
      }
    }
    return runs;
  }

  /** Runs that share a cell are merged into one group (this is how L / T shapes are found). */
  findGroups() {
    let groups = [];
    this.findRuns().forEach((run) => {
      const overlapping = groups.filter((g) => run.cells.some((k) => g.cells.has(k)));
      const merged = { type: run.type, cells: new Set(run.cells), runs: [run] };
      overlapping.forEach((g) => {
        g.cells.forEach((k) => merged.cells.add(k));
        merged.runs.push(...g.runs);
      });
      groups = groups.filter((g) => !overlapping.includes(g));
      groups.push(merged);
    });
    return groups;
  }

  specialForGroup(group) {
    const longest = Math.max(...group.runs.map((r) => r.cells.length));
    const hasH = group.runs.some((r) => r.dir === 'h');
    const hasV = group.runs.some((r) => r.dir === 'v');
    if (longest >= 5) return 'rainbow';
    if (hasH && hasV) return 'bomb';
    if (longest === 4) return group.runs.find((r) => r.cells.length === 4).dir === 'h' ? 'lineH' : 'lineV';
    return null;
  }

  /** Where the new special appears: the moved tile, else the L/T corner, else the middle of the run. */
  spawnCellForGroup(group, preferred) {
    const free = (k) => group.cells.has(k) && this.cellAt(k).vine === 0;
    const pick = preferred.find(free);
    if (pick) return pick;
    const h = group.runs.find((r) => r.dir === 'h');
    const v = group.runs.find((r) => r.dir === 'v');
    if (h && v) {
      const cross = h.cells.find((k) => v.cells.includes(k));
      if (cross && free(cross)) return cross;
    }
    const longest = group.runs.reduce((a, b) => (b.cells.length > a.cells.length ? b : a));
    const mid = longest.cells[Math.floor(longest.cells.length / 2)];
    if (free(mid)) return mid;
    return [...group.cells].find(free) ?? null;
  }

  async resolveGroups(groups, preferred) {
    this.chain += 1;
    const toClear = new Set();
    const spawns = [];
    groups.forEach((group) => {
      group.cells.forEach((k) => toClear.add(k));
      const special = this.specialForGroup(group);
      const spawnKey = special ? this.spawnCellForGroup(group, preferred) : null;
      if (spawnKey) {
        spawns.push({ key: spawnKey, special, type: special === 'rainbow' ? null : group.type });
      }
    });
    await this.clearCells(toClear, { spawns });
  }

  /** Area a special tile clears when it goes off. */
  specialArea(tile, k) {
    const [r, c] = parseKey(k);
    const color = JEWEL_COLORS[tile.type] ?? 0xffffff;
    switch (tile.special) {
      case 'lineH':
        return { cells: Array.from({ length: COLS }, (_, i) => key(r, i)), fx: { kind: 'beam', dir: 'h', r, c, color } };
      case 'lineV':
        return { cells: Array.from({ length: ROWS }, (_, i) => key(i, c)), fx: { kind: 'beam', dir: 'v', r, c, color } };
      case 'bomb':
        return { cells: this.diamond(r, c, 2), fx: { kind: 'blast', r, c, radius: 2.6, color } };
      case 'rainbow': {
        const type = this.mostCommonType();
        const cells = type ? this.keysOfType(type) : [];
        return { cells, fx: { kind: 'rainbow', r, c, targets: cells } };
      }
      default:
        return { cells: [], fx: null };
    }
  }

  diamond(r, c, radius) {
    const cells = [];
    for (let dr = -radius; dr <= radius; dr += 1) {
      for (let dc = -radius; dc <= radius; dc += 1) {
        if (Math.abs(dr) + Math.abs(dc) <= radius && inBounds(r + dr, c + dc)) cells.push(key(r + dr, c + dc));
      }
    }
    return cells;
  }

  keysOfType(type, normalOnly = false) {
    const keys = [];
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const t = this.grid[r][c];
        if (t && t.special !== 'rainbow' && t.type === type && (!normalOnly || !t.special)) keys.push(key(r, c));
      }
    }
    return keys;
  }

  mostCommonType() {
    const counts = {};
    this.grid.flat().forEach((t) => {
      if (t && t.type && t.special !== 'rainbow') counts[t.type] = (counts[t.type] || 0) + 1;
    });
    const entries = Object.entries(counts);
    if (!entries.length) return null;
    return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  }

  /**
   * Clear a set of cells. Any special tile caught in the clear goes off too (chain reactions),
   * unless its key is in skipTrigger. Obstacles react too:
   *  - a vine on a cleared cell is cut, but its bloom stays;
   *  - planter boxes in the area, or next to a cleared bloom, lose one hit point;
   *  - dry soil under a cleared bloom loses one layer.
   * New specials from `spawns` appear once the clear is done.
   */
  async clearCells(initialKeys, { spawns = [], skipTrigger = new Set(), extraFx = [] } = {}) {
    const cleared = new Set();
    const queue = [...initialKeys];
    const effects = [...extraFx];

    while (queue.length) {
      const k = queue.shift();
      if (cleared.has(k)) continue;
      const cell = this.cellAt(k);
      if (!cell || !cell.playable) continue;
      cleared.add(k);
      const tile = this.tileAt(k);
      if (!tile || cell.vine || tile.special === 'seed') continue;
      if (tile.special && !skipTrigger.has(k)) {
        const area = this.specialArea(tile, k);
        if (area.fx) effects.push(area.fx);
        area.cells.forEach((next) => {
          if (!cleared.has(next)) queue.push(next);
        });
      }
    }

    const removed = [];
    const vineHits = [];
    const crateHits = new Set();
    // Pots: a direct hit waters once; each adjacent cleared bloom waters once, or twice if it's the pot's own kind.
    const potHits = new Map();
    const water = (k, amount = 1) => potHits.set(k, (potHits.get(k) ?? 0) + amount);
    cleared.forEach((k) => {
      const cell = this.cellAt(k);
      if (cell.pot) water(k);
      else if (cell.crate || cell.weed) crateHits.add(k);
      else if (this.tileAt(k)?.special === 'seed') return;
      else if (this.tileAt(k) && cell.vine) vineHits.push(k);
      else if (this.tileAt(k)) removed.push(k);
    });
    removed.forEach((k) => {
      const [r, c] = parseKey(k);
      const type = this.tileAt(k)?.type;
      NEIGHBORS.forEach(([dr, dc]) => {
        const n = this.cells[r + dr]?.[c + dc];
        const nk = key(r + dr, c + dc);
        if (n?.crate || n?.weed) crateHits.add(nk);
        if (n?.pot && type && !cleared.has(nk)) water(nk, n.pot.type === type ? 2 : 1);
      });
    });

    effects.forEach((fx) => this.playEffect(fx));
    if (effects.length) await this.wait(90);

    // Points: blooms (worth more deeper in a cascade), obstacles, and new specials.
    const points = removed.length * 20 * Math.max(1, this.chain)
      + (vineHits.length + crateHits.size) * 40
      + [...potHits.values()].reduce((sum, n) => sum + n * 30, 0)
      + spawns.reduce((sum, sp) => sum + (sp.special === 'rainbow' ? 200 : 100), 0);
    if (points > 0) {
      const keys = removed.length ? removed : [...cleared];
      const avg = keys.reduce((acc, k) => {
        const [r, c] = parseKey(k);
        const p = this.cellPos(r, c);
        return { x: acc.x + p.x / keys.length, y: acc.y + p.y / keys.length };
      }, { x: 0, y: 0 });
      this.on.score(points, this.toWorld(avg.x, avg.y));
    }

    // Each step of a cascade pops one note higher up the scale.
    if (removed.length) this.sfx('pop', { step: Math.min(this.chain - 1, 10) });
    if (crateHits.size) this.sfx('crate');
    if (vineHits.length) this.sfx('snip');

    const anims = [];
    removed.forEach((k) => {
      const tile = this.tileAt(k);
      const [r, c] = parseKey(k);
      this.grid[r][c] = null;
      if (tile.type && tile.special !== 'rainbow') this.collectAt(tile.type, r, c);
      anims.push(this.popTile(tile));
      this.damageSoil(r, c);
    });
    vineHits.forEach((k) => anims.push(this.cutVine(...parseKey(k))));
    crateHits.forEach((k) => anims.push(this.hitCrate(...parseKey(k))));
    potHits.forEach((n, k) => anims.push(this.waterPot(...parseKey(k), n)));
    await Promise.all(anims);

    if (spawns.length) {
      this.sfx('special');
      await Promise.all(spawns.map((s) => {
        const [r, c] = parseKey(s.key);
        if (this.grid[r][c] || !this.holdsTile(r, c)) return Promise.resolve();
        const tile = this.createTile(r, c, s.type, s.special);
        tile.sprite.setScale(0);
        const p = this.cellPos(r, c);
        this.emitters.sparkle.explode(8, p.x, p.y);
        this.flashSprite('fx-glow', p.x, p.y, { size: CELL * 1.6, toScale: 1.4, tint: 0xfff3b0 });
        return this.tween({ targets: tile.sprite, scale: 1, duration: 260, ease: 'Back.easeOut' });
      }));
    }
  }

  collectAt(type, r, c) {
    const p = this.cellPos(r, c);
    const world = this.toWorld(p.x, p.y);
    this.on.collect(type, world.x, world.y);
  }

  popTile(tile) {
    this.stopLoops(tile);
    this.scene.tweens.killTweensOf(tile.sprite);
    const { x, y } = tile.sprite;
    const emitter = tile.special === 'rainbow' ? this.emitters.white : this.emitters[tile.type];
    emitter?.explode(tile.special ? 14 : 7, x, y);
    this.emitters.twinkle.explode(tile.special ? 4 : 1, x, y);
    return this.tween({
      targets: tile.sprite,
      scale: 0,
      alpha: 0,
      duration: 200,
      delay: Phaser.Math.Between(0, 50),
      ease: 'Back.easeIn',
    }).then(() => tile.sprite.destroy());
  }

  damageSoil(r, c) {
    const cell = this.cells[r][c];
    if (!cell.soil) return;
    cell.soil -= 1;
    const image = this.groundImages[r][c];
    const { x, y } = this.cellPos(r, c);
    if (cell.soil > 0) {
      image.setTexture(`cell-soil${cell.soil}`);
      this.scene.tweens.add({ targets: image, scale: image.scale * 0.85, duration: 90, yoyo: true });
      return;
    }
    image.setTexture('cell-grass');
    const full = CELL / image.width;
    image.setScale(full * 0.3);
    this.scene.tweens.add({ targets: image, scale: full, duration: 320, ease: 'Back.easeOut' });
    this.emitters.grass.explode(10, x, y);
    this.collectAt('soil', r, c);
  }

  cutVine(r, c) {
    const cell = this.cells[r][c];
    const sprite = this.vineSprites[r][c];
    cell.vine = 0;
    this.vineSprites[r][c] = null;
    const { x, y } = this.cellPos(r, c);
    this.emitters.leaf.explode(14, x, y);
    this.collectAt('vine', r, c);
    return this.tween({ targets: sprite, scale: sprite.scale * 1.3, alpha: 0, angle: 20, duration: 240, ease: 'Quad.easeOut' })
      .then(() => sprite.destroy());
  }

  hitCrate(r, c) {
    const cell = this.cells[r][c];
    if (cell.weed) return this.pullWeed(r, c);
    if (!cell.crate) return Promise.resolve();
    cell.crate -= 1;
    const sprite = this.crateSprites[r][c];
    const { x, y } = this.cellPos(r, c);
    this.emitters.wood.explode(cell.crate > 0 ? 6 : 16, x, y);

    if (cell.crate > 0) {
      sprite.setTexture(`ob-crate${cell.crate}`);
      return this.tween({ targets: sprite, scale: sprite.scale * 0.86, duration: 80, yoyo: true });
    }
    this.crateSprites[r][c] = null;
    this.sfx('break');
    this.collectAt('crate', r, c);
    return this.tween({ targets: sprite, scale: sprite.scale * 1.25, alpha: 0, duration: 220, ease: 'Quad.easeOut' })
      .then(() => sprite.destroy());
  }

  playEffect(fx) {
    const { scene } = this;
    const { x, y } = this.cellPos(fx.r, fx.c);
    const w = COLS * CELL;
    const h = ROWS * CELL;

    if (fx.kind === 'beam') {
      this.sfx('line');
      const horizontal = fx.dir === 'h';
      const make = (thickness, color, alpha) => scene.add.rectangle(
        horizontal ? w / 2 : x, horizontal ? y : h / 2,
        horizontal ? w : thickness, horizontal ? thickness : h, color, alpha,
      );
      const glow = make(CELL * 0.9, fx.color, 0.45);
      const core = make(CELL * 0.35, 0xffffff, 1);
      this.fxLayer.add([glow, core]);
      [glow, core].forEach((rect) => {
        const prop = horizontal ? 'scaleX' : 'scaleY';
        scene.tweens.add({
          targets: rect,
          [prop]: { from: 0, to: 1 },
          duration: 140,
          ease: 'Quad.easeOut',
          onComplete: () => scene.tweens.add({
            targets: rect,
            alpha: 0,
            [horizontal ? 'scaleY' : 'scaleX']: 0.1,
            duration: 260,
            onComplete: () => rect.destroy(),
          }),
        });
      });
      for (let i = 0; i < (horizontal ? COLS : ROWS); i += 1) {
        const p = horizontal ? this.cellPos(fx.r, i) : this.cellPos(i, fx.c);
        this.emitters.white.explode(2, p.x, p.y);
        if (i % 2 === 0) this.emitters.sparkle.explode(1, p.x, p.y);
      }
      this.flashSprite('fx-star6', x, y, { size: CELL * 2, toScale: 1.6, tint: 0xffffff, duration: 320 });
      return;
    }

    if (fx.kind === 'blast') {
      // Big combo blasts get the full boom; a single burst bloom gets the punchy blast.
      this.sfx(fx.radius >= 4 ? 'boom' : 'blast');
      const size = CELL * fx.radius * 2;
      this.flashSprite('fx-glow', x, y, { size, toScale: 1.2, tint: 0xffffff, duration: 360 });
      this.flashSprite('fx-ring', x, y, { size, toScale: 1.25, tint: fx.color, duration: 460 });
      this.emitters.gold.explode(24, x, y);
      this.emitters.sparkle.explode(10, x, y);
      scene.cameras.main.shake(fx.radius >= 4 ? 320 : 160, Math.min(0.018, 0.0035 * fx.radius));
      return;
    }

    if (fx.kind === 'rainbow') {
      this.sfx('rainbow');
      const g = scene.add.graphics();
      const colors = [0xff5ea8, 0xffd166, 0x58d68d, 0x53b9ff, 0xc77dff];
      fx.targets.forEach((k, i) => {
        const [r, c] = parseKey(k);
        const p = this.cellPos(r, c);
        g.lineStyle(5, colors[i % colors.length], 0.9).lineBetween(x, y, p.x, p.y);
      });
      this.fxLayer.add(g);
      scene.tweens.add({ targets: g, alpha: 0, duration: 520, delay: 120, onComplete: () => g.destroy() });
      this.flashSprite('fx-magic', x, y, { size: CELL * 3, toScale: 1.3, tint: 0xfff3b0, duration: 600, spin: 180 });
      this.flashSprite('fx-twirl', x, y, { size: CELL * 2.6, toScale: 1.6, tint: 0xff9ad5, duration: 560, spin: -270 });
      this.emitters.white.explode(20, x, y);
      fx.targets.forEach((k) => {
        const [r, c] = parseKey(k);
        const p = this.cellPos(r, c);
        this.emitters.twinkle.explode(1, p.x, p.y);
      });
    }
  }

  /** Swapping two specials (or a rainbow with anything) triggers a combo instead of a normal match. */
  async resolveSwapCombo(tA, tB) {
    this.chain = 1;
    const kA = key(tA.r, tA.c);
    const kB = key(tB.r, tB.c);
    const center = { r: tA.r, c: tA.c };
    const sA = tA.special;
    const sB = tB.special;
    // Two specials colliding: a heavy smash (a single rainbow swap plays its own harp sound).
    const rainbowOnPlain = (sA === 'rainbow' && !sB) || (sB === 'rainbow' && !sA);
    if (!rainbowOnPlain) this.sfx('smash');

    if (sA === 'rainbow' && sB === 'rainbow') {
      const all = [];
      for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) all.push(key(r, c));
      await this.clearCells(all, {
        skipTrigger: new Set([kA, kB]),
        extraFx: [{ kind: 'blast', r: center.r, c: center.c, radius: 9, color: 0xffd166 }],
      });
      return;
    }

    if (sA === 'rainbow' || sB === 'rainbow') {
      const rainbow = sA === 'rainbow' ? tA : tB;
      const other = rainbow === tA ? tB : tA;
      const kR = key(rainbow.r, rainbow.c);
      const kO = key(other.r, other.c);

      if (!other.special) {
        const targets = this.keysOfType(other.type);
        await this.clearCells([kR, ...targets], {
          skipTrigger: new Set([kR]),
          extraFx: [{ kind: 'rainbow', r: rainbow.r, c: rainbow.c, targets }],
        });
        return;
      }

      // Rainbow + special: every free bloom of that kind becomes the same special, then they all go off.
      const targets = this.keysOfType(other.type, true).filter((k) => !this.cellAt(k).vine);
      this.playEffect({ kind: 'rainbow', r: rainbow.r, c: rainbow.c, targets });
      targets.forEach((k) => {
        const t = this.tileAt(k);
        t.special = other.special === 'bomb' ? 'bomb' : Phaser.Utils.Array.GetRandom(['lineH', 'lineV']);
        this.renderTile(t);
        this.scene.tweens.add({ targets: t.sprite, scale: 1.25, duration: 160, yoyo: true });
      });
      await this.wait(480);
      await this.clearCells([kR, kO, ...targets], { skipTrigger: new Set([kR]) });
      return;
    }

    // Both are line / bomb specials.
    const lines = [sA, sB].filter((s) => s.startsWith('line')).length;
    const cells = new Set();
    const fx = [];
    const { r, c } = center;
    const addRow = (row) => {
      if (row < 0 || row >= ROWS) return;
      for (let i = 0; i < COLS; i += 1) cells.add(key(row, i));
      fx.push({ kind: 'beam', dir: 'h', r: row, c, color: 0xffd166 });
    };
    const addCol = (col) => {
      if (col < 0 || col >= COLS) return;
      for (let i = 0; i < ROWS; i += 1) cells.add(key(i, col));
      fx.push({ kind: 'beam', dir: 'v', r, c: col, color: 0xffd166 });
    };

    if (lines === 2) {
      addRow(r);
      addCol(c);
    } else if (lines === 1) {
      [-1, 0, 1].forEach((d) => {
        addRow(r + d);
        addCol(c + d);
      });
    } else {
      for (let dr = -3; dr <= 3; dr += 1) {
        for (let dc = -3; dc <= 3; dc += 1) {
          const inside = Math.max(Math.abs(dr), Math.abs(dc)) <= 2 || Math.abs(dr) + Math.abs(dc) <= 3;
          if (inside && inBounds(r + dr, c + dc)) cells.add(key(r + dr, c + dc));
        }
      }
      fx.push({ kind: 'blast', r, c, radius: 4.2, color: 0xff8fb8 });
    }

    cells.add(kA);
    cells.add(kB);
    await this.clearCells(cells, { skipTrigger: new Set([kA, kB]), extraFx: fx });
  }

  // ---------------------------------------------------------------- thirsty pots

  addPotSprite(r, c) {
    const { scene } = this;
    const { pot } = this.cells[r][c];
    const { x, y } = this.cellPos(r, c);
    const sprite = scene.add.container(x, y);
    const potImg = scene.add.image(0, 6, 'ob-pot').setDisplaySize(58, 58);
    // The bloom it's thirsty for peeks out of the soil.
    const want = scene.add.image(0, -14, `jewel-${pot.type}`).setDisplaySize(30, 30).setAlpha(0.9);
    const badge = scene.add.circle(19, 19, 12, 0x53b9ff).setStrokeStyle(3, 0xffffff);
    const count = scene.add.text(19, 18, `${pot.need}`, {
      fontFamily: '"Fredoka", sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5);
    sprite.add([potImg, want, badge, count]);
    sprite.count = count;
    sprite.want = want;
    this.overLayer.add(sprite);
    this.potSprites[r][c] = sprite;
    scene.tweens.add({
      targets: want, angle: { from: -8, to: 8 }, y: -16, duration: 900 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    return sprite;
  }

  /** Water a pot `amount` times; when it has had enough it blossoms and frees the cell. */
  waterPot(r, c, amount) {
    const cell = this.cells[r][c];
    const sprite = this.potSprites[r][c];
    if (!cell.pot || !sprite) return Promise.resolve();
    cell.pot.need = Math.max(0, cell.pot.need - amount);
    const { x, y } = this.cellPos(r, c);
    this.emitters.drop.explode(6, x, y - 12);

    if (cell.pot.need > 0) {
      sprite.count.setText(`${cell.pot.need}`);
      this.sfx('drip', { step: Math.max(0, 6 - cell.pot.need) });
      return this.tween({ targets: sprite, scaleX: 1.12, scaleY: 0.9, duration: 90, yoyo: true });
    }

    // Blossom!
    const { type } = cell.pot;
    cell.pot = null;
    this.potSprites[r][c] = null;
    this.sfx('bloom');
    this.scene.tweens.killTweensOf(sprite.want);
    this.emitters.sparkle.explode(10, x, y);
    this.emitters[type]?.explode(16, x, y - 10);
    this.flashSprite('fx-glow', x, y, { size: CELL * 2, toScale: 1.5, tint: JEWEL_COLORS[type] });
    this.collectAt('pot', r, c);
    const flower = this.scene.add.image(x, y - 6, `jewel-${type}`).setDisplaySize(30, 30);
    this.fxLayer.add(flower);
    this.tween({
      targets: flower, y: y - 50, scale: flower.scale * 2.4, alpha: 0, angle: 30, duration: 620, ease: 'Quad.easeOut',
    }).then(() => flower.destroy());
    return this.tween({ targets: sprite, scale: 0, alpha: 0, duration: 260, ease: 'Back.easeIn' }).then(() => sprite.destroy());
  }

  // ---------------------------------------------------------------- weeds

  addWeedSprite(r, c) {
    const { x, y } = this.cellPos(r, c);
    const sprite = this.scene.add.image(x, y, 'ob-weed').setDisplaySize(60, 60);
    this.overLayer.add(sprite);
    this.weedSprites[r][c] = sprite;
    this.scene.tweens.add({
      targets: sprite, angle: { from: -3, to: 3 }, duration: 900 + Math.random() * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    return sprite;
  }

  pullWeed(r, c) {
    const cell = this.cells[r][c];
    const sprite = this.weedSprites[r][c];
    cell.weed = 0;
    this.weedSprites[r][c] = null;
    this.weedCleared = true;
    this.sfx('snip');
    const { x, y } = this.cellPos(r, c);
    this.emitters.leaf.explode(16, x, y);
    this.collectAt('weed', r, c);
    this.scene.tweens.killTweensOf(sprite);
    return this.tween({ targets: sprite, y: y - 30, scale: sprite.scale * 1.2, alpha: 0, angle: 40, duration: 260, ease: 'Quad.easeOut' })
      .then(() => sprite.destroy());
  }

  weedCount() {
    return this.cells.flat().filter((cell) => cell.weed).length;
  }

  /** One weed grows into a neighbouring plain bloom. Returns true if it spread. */
  async spreadWeed() {
    const targets = [];
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        if (!this.cells[r][c].weed) continue;
        NEIGHBORS.forEach(([dr, dc]) => {
          const t = this.grid[r + dr]?.[c + dc];
          if (t && !t.special && this.cells[r + dr][c + dc].vine === 0) targets.push(t);
        });
      }
    }
    if (!targets.length) return false;

    const victim = Phaser.Utils.Array.GetRandom(targets);
    const { r, c } = victim;
    this.grid[r][c] = null;
    this.stopLoops(victim);
    this.sfx('spread');
    await this.tween({ targets: victim.sprite, scale: 0, angle: 90, duration: 220, ease: 'Back.easeIn' });
    victim.sprite.destroy();

    this.cells[r][c].weed = 1;
    const sprite = this.addWeedSprite(r, c);
    const full = sprite.scale;
    sprite.setScale(0);
    const { x, y } = this.cellPos(r, c);
    this.emitters.leaf.explode(10, x, y);
    this.on.weedSpread(this.toWorld(x, y));
    await this.tween({ targets: sprite, scale: full, duration: 320, ease: 'Back.easeOut' });
    return true;
  }

  // ---------------------------------------------------------------- seeds

  seedsOnBoard() {
    return this.grid.flat().filter((t) => t?.special === 'seed').length;
  }

  /** Should the next refill tile be a seed? Only one seed is on the board at a time. */
  wantSeed() {
    if (this.seedsToSpawn <= 0 || this.seedsOnBoard() > 0) return false;
    if (Math.random() > 0.6) return false;
    this.seedsToSpawn -= 1;
    return true;
  }

  /** Lowest cell of a column that can hold a bloom: seeds there are collected. */
  bottomRow(c) {
    for (let r = ROWS - 1; r >= 0; r -= 1) {
      if (this.holdsTile(r, c)) return r;
      if (this.cells[r][c].playable) return -1;
    }
    return -1;
  }

  async collectSeeds() {
    const done = [];
    for (let c = 0; c < COLS; c += 1) {
      const r = this.bottomRow(c);
      const tile = r >= 0 ? this.grid[r][c] : null;
      if (tile?.special === 'seed') done.push(tile);
    }
    if (!done.length) return false;

    this.sfx('bloom');
    await Promise.all(done.map((tile) => {
      this.grid[tile.r][tile.c] = null;
      this.stopLoops(tile);
      const { x, y } = this.cellPos(tile.r, tile.c);
      this.emitters.sparkle.explode(10, x, y);
      this.emitters.grass.explode(12, x, y);
      this.flashSprite('fx-glow', x, y, { size: CELL * 2, toScale: 1.5, tint: 0xb5e39c });
      this.collectAt('seed', tile.r, tile.c);
      this.on.score(300, this.toWorld(x, y));
      return this.tween({ targets: tile.sprite, y: y + CELL * 0.8, scale: 0.4, alpha: 0, duration: 380, ease: 'Quad.easeIn' })
        .then(() => tile.sprite.destroy());
    }));
    return true;
  }

  // ---------------------------------------------------------------- gravity / refill

  /** Topmost cell of a column that can hold a bloom; new blooms enter the board there. */
  spawnRow(c) {
    for (let r = 0; r < ROWS; r += 1) {
      const cell = this.cells[r][c];
      if (cell.playable) return cell.crate || cell.weed || cell.pot ? -1 : r;
    }
    return -1;
  }

  /** Can an empty cell still be filled by a bloom falling straight down into it? */
  fedFromAbove(r, c) {
    for (let rr = r - 1; rr >= 0; rr -= 1) {
      if (!this.holdsTile(rr, c)) return false;
      if (this.grid[rr][c]) return this.cells[rr][c].vine === 0;
    }
    return this.spawnRow(c) !== -1;
  }

  /**
   * Blooms fall one cell per step. Straight down first; when nothing can fall straight,
   * a bloom slides diagonally into a gap that is blocked from above (under a planter box, vine or hole).
   */
  async applyGravity() {
    const moved = new Set();
    const empty = (r, c) => inBounds(r, c) && this.holdsTile(r, c) && !this.grid[r][c];

    for (let step = 0; step < ROWS * 4; step += 1) {
      const moves = [];

      for (let r = ROWS - 2; r >= 0; r -= 1) {
        for (let c = 0; c < COLS; c += 1) {
          if (this.isMovable(r, c) && empty(r + 1, c)) moves.push(this.shiftTile(r, c, r + 1, c));
        }
      }

      for (let c = 0; c < COLS; c += 1) {
        const top = this.spawnRow(c);
        if (top !== -1 && !this.grid[top][c]) {
          const { y } = this.cellPos(top, c);
          const tile = this.wantSeed()
            ? this.createTile(top, c, null, 'seed', y - CELL)
            : this.createTile(top, c, this.randomType(), null, y - CELL);
          moves.push(tile);
        }
      }

      if (!moves.length) {
        outer: for (let r = ROWS - 2; r >= 0; r -= 1) {
          for (let c = 0; c < COLS; c += 1) {
            if (!this.isMovable(r, c)) continue;
            for (const dc of Phaser.Utils.Array.Shuffle([-1, 1])) {
              if (empty(r + 1, c + dc) && !this.fedFromAbove(r + 1, c + dc)) {
                moves.push(this.shiftTile(r, c, r + 1, c + dc));
                break outer;
              }
            }
          }
        }
      }

      if (!moves.length) break;
      moves.forEach((t) => moved.add(t));
      await Promise.all(moves.map((tile) => this.moveTile(tile, FALL_STEP_MS, 'Linear')));
    }

    moved.forEach((tile) => {
      if (tile.sprite.active) {
        this.scene.tweens.add({ targets: tile.sprite, scaleY: 0.86, scaleX: 1.08, duration: 70, yoyo: true });
      }
    });
  }

  shiftTile(r, c, r2, c2) {
    const tile = this.grid[r][c];
    this.grid[r2][c2] = tile;
    this.grid[r][c] = null;
    tile.r = r2;
    tile.c = c2;
    return tile;
  }

  // ---------------------------------------------------------------- move detection / shuffle

  hasMatchAt(r, c) {
    const type = this.matchType(this.grid[r][c]);
    if (!type) return false;
    const same = (rr, cc) => inBounds(rr, cc) && this.matchType(this.grid[rr][cc]) === type;
    let h = 1;
    for (let i = c - 1; same(r, i); i -= 1) h += 1;
    for (let i = c + 1; same(r, i); i += 1) h += 1;
    let v = 1;
    for (let i = r - 1; same(i, c); i -= 1) v += 1;
    for (let i = r + 1; same(i, c); i += 1) v += 1;
    return h >= 3 || v >= 3;
  }

  findPossibleMove() {
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const r2 = r + dr;
          const c2 = c + dc;
          if (!inBounds(r2, c2) || !this.isMovable(r, c) || !this.isMovable(r2, c2)) continue;
          const a = this.grid[r][c];
          const b = this.grid[r2][c2];
          const power = (t) => t.special && t.special !== 'seed';
          if ((a.special === 'rainbow' && b.special !== 'seed') || (b.special === 'rainbow' && a.special !== 'seed')
            || (power(a) && power(b))) return [a, b];
          this.grid[r][c] = b;
          this.grid[r2][c2] = a;
          const ok = this.hasMatchAt(r, c) || this.hasMatchAt(r2, c2);
          this.grid[r][c] = a;
          this.grid[r2][c2] = b;
          if (ok) return [a, b];
        }
      }
    }
    return null;
  }

  async shuffle(onPurpose = false) {
    if (!onPurpose) this.on.shuffle();
    const normals = this.grid.flat().filter((t) => t && !t.special && this.cells[t.r][t.c].vine === 0);
    const types = normals.map((t) => t.type);

    let ok = false;
    for (let attempt = 0; attempt < 300 && !ok; attempt += 1) {
      const pool = attempt < 100 ? Phaser.Utils.Array.Shuffle([...types]) : normals.map(() => this.randomType());
      normals.forEach((t, i) => { t.type = pool[i]; });
      ok = this.findGroups().length === 0 && !!this.findPossibleMove();
    }

    await this.tween({ targets: normals.map((t) => t.sprite), scale: 0, duration: 180, ease: 'Back.easeIn' });
    normals.forEach((t) => this.renderTile(t));
    await this.tween({ targets: normals.map((t) => t.sprite), scale: 1, duration: 260, ease: 'Back.easeOut' });
  }
}
