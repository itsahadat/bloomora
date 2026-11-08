import Phaser from 'phaser';
import { LEVELS, ZONES, resolveObjective } from '../levels/LevelData.js';
import { Progress } from '../core/Progress.js';
import { Lives } from '../core/Lives.js';
import { goalIconKey } from '../board/Board.js';
import { playSfx, playMusic } from '../core/Sound.js';
import { Inventory, BOOSTERS } from '../core/Inventory.js';
import { Wallet } from '../core/Wallet.js';
import { Daily } from '../core/Daily.js';
import { openLuckyWheel, makeWheelButton } from '../ui/LuckyWheel.js';
import { openQuests, makeQuestButton } from '../ui/QuestBoard.js';
import { openZoneComplete } from '../ui/Celebration.js';
import { Unlocks } from '../core/Unlocks.js';

/** Map look for tougher levels. */
const DIFFICULTY = {
  hard: { orb: 'red', text: '#861b13', tag: 'HARD', tagColor: '#d0453a' },
  super: { orb: 'purple', text: '#552090', tag: 'SUPER HARD', tagColor: '#8a3fd8' },
};
import {
  makeCoinBadge, openShop, openDailyReward, openBuyBooster, openNoLives,
} from '../ui/Shop.js';
import {
  textStyle, titleStyle, makeButton, makeRoundButton, showModal, makeLivesBadge, addStars, makeBoosterButton, makeVivid,
  makeMuteButton, makeCountBadge, COLORS,
} from '../ui/UI.js';
import { orbTexture, insetTexture, cardTexture, canvasTexture, pillTexture } from '../ui/Skin.js';

const NODE_GAP = 150;
/** How many locked levels show above the player's current one; the rest hide under clouds. */
const REVEAL_AHEAD = 9;
const TOP_SPACE = 360;
const BOTTOM_SPACE = 200;
const MEADOW = 0x9fd987;

/**
 * Scrolling garden path. Level 1 is at the bottom; the path winds upwards.
 * Drag / swipe / mouse wheel to scroll; tap a node to open its level card.
 */
export class MapScene extends Phaser.Scene {
  constructor() {
    super('MapScene');
  }

  init(data) {
    this.restoreScroll = data?.scrollY;
    this.focusLevel = data?.focusLevel;
    this.justUnlocked = data?.justUnlocked;
  }

  create() {
    makeVivid(this);
    const { width: W, height: H } = this.scale;
    this.unlocked = Progress.currentLevelIndex(LEVELS.length);
    this.worldH = TOP_SPACE + (LEVELS.length - 1) * NODE_GAP + BOTTOM_SPACE + H * 0.3;
    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, Math.max(this.worldH, H));
    cam.setBackgroundColor(MEADOW);

    this.nodes = LEVELS.map((level, i) => this.nodePosition(i));
    this.drawWorld();
    this.drawPath();
    this.drawNodes();
    this.drawClouds();
    this.createHud();
    this.setupScrolling();
    playMusic();

    // A finished garden gets its celebration first, then the daily gift.
    const zone = this.pendingZone();
    if (zone !== null) this.time.delayedCall(500, () => this.celebrateZone(zone));
    else if (Daily.canClaim()) this.time.delayedCall(450, () => this.showDaily());

    if (this.restoreScroll !== undefined) {
      cam.scrollY = this.restoreScroll;
    } else {
      const focus = this.nodes[this.focusLevel ?? this.unlocked];
      cam.scrollY = Phaser.Math.Clamp(focus.y - H * 0.55, 0, Math.max(0, this.worldH - H));
    }
    if (this.clouds) {
      const top = Math.max(0, this.cloudEdge(this.revealIndex) - H * 0.7);
      cam.setBounds(0, top, W, Math.max(this.worldH - top, H));
    }
    if (this.justUnlocked !== undefined && this.justUnlocked === this.unlocked && this.justUnlocked > 0) {
      this.playUnlockFanfare(this.justUnlocked);
    }

    const onResize = () => this.scene.restart({ scrollY: cam.scrollY });
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
  }

  nodePosition(i) {
    const { width: W } = this.scale;
    const amp = Math.min(W * 0.26, 170);
    const y = this.worldH - BOTTOM_SPACE - i * NODE_GAP;
    const x = W / 2 + Math.sin(i * 1.1) * amp;
    return { x, y };
  }

  // ---------------------------------------------------------------- world art

  drawWorld() {
    const { width: W } = this.scale;
    const rng = new Phaser.Math.RandomDataGenerator(['bloomora-map']);

    // Sky and hills at the very top: the end of the current garden.
    const skyH = 300;
    this.add.rectangle(0, 0, W, skyH, 0xd1eefa).setOrigin(0);
    const s = 0.5;
    this.add.tileSprite(W / 2, skyH, W, 1024 * s, 'bg-grass').setOrigin(0.5, 0.625).setTileScale(s, s);
    this.add.rectangle(0, skyH, W, 40, 0x23c073).setOrigin(0);
    const fade = this.add.graphics();
    fade.fillGradientStyle(0x23c073, 0x23c073, MEADOW, MEADOW, 1).fillRect(0, skyH + 40, W, 160);
    [0.15, 0.6, 0.9].forEach((fx, i) => {
      this.add.image(W * fx, 50 + i * 30, `bg-cloud${i + 1}`).setAlpha(0.9).setScale(0.8);
    });
    this.add.text(W / 2, skyH - 120, 'More gardens coming soon!', textStyle(20, '#ffffff', {
      stroke: '#7a4a1e', strokeThickness: 6,
    })).setOrigin(0.5);

    // Each garden has its own meadow tint, blending softly into the next one.
    const tints = [0x9fd987, 0xc5d77e, 0x8fd3b0, 0xa8dc8a];
    const zoneTop = (zi) => (ZONES[zi + 1] ? this.nodes[ZONES[zi + 1].start].y + NODE_GAP / 2 : skyH + 40);
    ZONES.forEach((zone, zi) => {
      const bottom = zi === 0 ? this.worldH : zoneTop(zi - 1);
      const top = zoneTop(zi);
      const tint = tints[zi % tints.length];
      this.add.rectangle(0, top, W, bottom - top, tint).setOrigin(0);
      if (zi > 0) {
        const prev = tints[(zi - 1) % tints.length];
        this.add.graphics().fillGradientStyle(tint, tint, prev, prev, 1).fillRect(0, bottom - 80, W, 160);
      }
    });
    // Hills at the top fade into the highest garden's meadow.
    const topTint = tints[(ZONES.length - 1) % tints.length];
    this.add.graphics().fillGradientStyle(0x23c073, 0x23c073, topTint, topTint, 1).fillRect(0, skyH + 40, W, 160);

    // Meadow texture: soft lighter patches and little grass tufts.
    const meadow = this.add.graphics();
    for (let i = 0; i < 46; i += 1) {
      meadow.fillStyle(0xffffff, 0.12).fillEllipse(rng.between(0, W), rng.between(skyH + 200, this.worldH), rng.between(80, 220), rng.between(30, 70));
    }
    for (let i = 0; i < 200; i += 1) {
      const x = rng.between(0, W);
      const y = rng.between(skyH + 120, this.worldH);
      meadow.fillStyle(0x4f9e3c, 0.9);
      meadow.fillTriangle(x - 4, y, x - 1, y - 10, x + 1, y);
      meadow.fillTriangle(x, y, x + 4, y - 8, x + 5, y);
    }

    const awayFromPath = (x, y, gap) => !this.nodes.some((n) => Math.abs(n.y - y) < 70 && Math.abs(n.x - x) < gap)
      && [0, -40, 40].every((dy) => Math.abs(this.pathXAt(y + dy) - x) > gap);

    // Little ponds with lily pads.
    for (let y = skyH + 400; y < this.worldH - 200; y += 620) {
      const side = rng.pick([0.17, 0.83]);
      const x = W * side;
      if (!awayFromPath(x, y, 130)) continue;
      const pond = this.add.graphics();
      pond.fillStyle(0x6fae5a, 1).fillEllipse(x, y + 6, 150, 70);
      pond.fillStyle(0x4bb3e6, 1).fillEllipse(x, y, 140, 62);
      pond.fillStyle(0x7fd0f5, 1).fillEllipse(x - 10, y - 6, 100, 36);
      pond.fillStyle(0xffffff, 0.55).fillEllipse(x - 30, y - 12, 34, 8);
      pond.fillStyle(0x58b04a, 1).fillCircle(x + 30, y + 8, 10).fillCircle(x + 10, y + 16, 7);
      pond.fillStyle(0xff9ad5, 1).fillCircle(x + 30, y + 6, 4);
    }

    // Flower patches: clusters of tiny blooms in each garden's own kinds.
    const zoneFlowers = [['rose', 'sun', 'berry', 'crystal'], ['strawberry', 'carrot', 'mushroom', 'sun'], ['apple', 'lemon', 'grape', 'kiwi'], ['pineapple', 'banana', 'orange', 'watermelon']];
    for (let i = 0; i < Math.floor(this.worldH / 120); i += 1) {
      const cx = rng.between(30, W - 30);
      const cy = rng.between(skyH + 220, this.worldH - 40);
      if (!awayFromPath(cx, cy, 90)) continue;
      const zi = ZONES.reduce((acc, z, k) => (this.nodes[z.start] && cy < this.nodes[z.start].y + NODE_GAP / 2 ? k : acc), 0);
      const kinds = zoneFlowers[zi % zoneFlowers.length];
      for (let k = 0; k < rng.between(3, 5); k += 1) {
        const fx = cx + rng.between(-28, 28);
        const fy = cy + rng.between(-14, 14);
        this.add.ellipse(fx, fy + 8, 18, 6, 0x2f6b2a, 0.25);
        this.add.image(fx, fy, `jewel-${rng.pick(kinds)}`).setDisplaySize(20, 20).setAngle(rng.between(-15, 15));
      }
    }

    // Trees and bushes along both sides, kept away from the path.
    const props = ['map-tree', 'map-treeLong', 'map-treePine', 'map-bush1', 'map-bush2', 'map-bush3', 'map-bush4', 'map-treeSmall2', 'map-fence'];
    const placed = [];
    for (let y = skyH + 160; y < this.worldH; y += 70) {
      for (let k = 0; k < 2; k += 1) {
        const x = rng.between(10, W - 10);
        // Props are drawn upwards from their base, so check the path over the prop's height too.
        const nearPath = this.nodes.some((n) => Math.abs(n.y - y + 40) < NODE_GAP * 0.8 && Math.abs(n.x - x) < 120)
          || [0, -50, -100, -150].some((dy) => Math.abs(this.pathXAt(y + dy) - x) < 95);
        if (nearPath) continue;
        placed.push({ x, y: y + rng.between(-20, 20), key: rng.pick(props) });
      }
    }
    placed.sort((a, b) => a.y - b.y).forEach(({ x, y, key }) => {
      const scale = key.startsWith('map-tree') && !key.includes('Small') ? 0.6 : key.includes('Small') ? 1.4 : 0.8;
      this.add.image(x, y, key).setOrigin(0.5, 1).setScale(scale);
    });
  }

  /** Approximate x of the path at a given world y (between nodes). */
  pathXAt(y) {
    const t = (this.worldH - BOTTOM_SPACE - y) / NODE_GAP;
    const amp = Math.min(this.scale.width * 0.26, 170);
    return this.scale.width / 2 + Math.sin(t * 1.1) * amp;
  }

  drawPath() {
    const points = [];
    const first = this.nodes[0];
    points.push(new Phaser.Math.Vector2(first.x, first.y + 160));
    this.nodes.forEach((n) => points.push(new Phaser.Math.Vector2(n.x, n.y)));
    const last = this.nodes[this.nodes.length - 1];
    points.push(new Phaser.Math.Vector2(last.x, last.y - 140));
    const curve = new Phaser.Curves.Spline(points);
    const length = curve.getLength();

    // A winding dirt road: dark edge, sandy middle, a lighter centre and scattered pebbles.
    const g = this.add.graphics();
    const pts = curve.getSpacedPoints(Math.floor(length / 8));
    pts.forEach((pt) => g.fillStyle(0x2f6b2a, 0.25).fillCircle(pt.x + 2, pt.y + 6, 24));
    pts.forEach((pt) => g.fillStyle(0x9a6a36, 1).fillCircle(pt.x, pt.y, 22));
    pts.forEach((pt) => g.fillStyle(0xe2bc80, 1).fillCircle(pt.x, pt.y, 18));
    pts.forEach((pt) => g.fillStyle(0xf0d4a2, 1).fillCircle(pt.x - 2, pt.y - 2, 9));
    const rng = new Phaser.Math.RandomDataGenerator(['bloomora-road']);
    curve.getSpacedPoints(Math.floor(length / 34)).forEach((pt) => {
      g.fillStyle(0xc49a62, 1).fillEllipse(pt.x + rng.between(-12, 12), pt.y + rng.between(-8, 8), rng.between(4, 7), rng.between(3, 5));
    });

    // Completed stretch glows with little petals.
    const doneUntil = this.nodes[Math.min(this.unlocked, this.nodes.length - 1)].y;
    curve.getSpacedPoints(Math.floor(length / 30)).forEach((pt, i) => {
      if (pt.y < doneUntil) return;
      const colors = [0xff8fc4, 0xffe066, 0xffffff, 0x9ee6ff];
      g.fillStyle(colors[i % colors.length], 0.95).fillEllipse(pt.x + (i % 2 ? 9 : -9), pt.y, 6, 4);
    });

    // A wooden sign where each new garden begins.
    ZONES.forEach((zone) => {
      const n = this.nodes[zone.start];
      if (!n) return;
      const { width: W } = this.scale;
      const sx = n.x > W / 2 ? Math.max(80, n.x - 150) : Math.min(W - 80, n.x + 150);
      const sy = n.y + 50;
      const sign = this.add.graphics();
      sign.fillStyle(0x2f6b2a, 0.3).fillEllipse(sx, sy + 40, 40, 10);
      sign.fillStyle(0x6e4320, 1).fillRoundedRect(sx - 5, sy - 6, 10, 48, 3);
      this.add.image(sx, sy - 20, cardTexture(this, 164, 46, 0));
      this.add.text(sx, sy - 21, zone.name, titleStyle(18, '#6b3d14')).setOrigin(0.5);
    });
  }

  // ---------------------------------------------------------------- level nodes

  drawNodes() {
    this.nodes.forEach((pos, i) => {
      const level = LEVELS[i];
      const stars = Progress.starsFor(i);
      const done = i < this.unlocked || stars > 0;
      const current = i === this.unlocked;
      const locked = i > this.unlocked;

      const node = this.add.container(pos.x, pos.y);
      this.nodeViews = this.nodeViews ?? [];
      this.nodeViews[i] = node;
      const diff = DIFFICULTY[level.difficulty];
      const color = locked ? 'grey' : diff ? diff.orb : current ? 'yellow' : 'green';
      const bg = this.add.image(0, 0, orbTexture(this, current ? 84 : 74, color));
      node.add(bg);
      if (diff) {
        const tag = this.add.text(0, -50, diff.tag, titleStyle(13, diff.tagColor)).setOrigin(0.5);
        node.add(tag);
      }

      if (locked) {
        node.add(this.add.image(0, -2, 'ui-lock').setDisplaySize(34, 34));
      } else {
        node.add(this.add.text(0, -3, `${level.id}`, titleStyle(current ? 34 : 30, diff ? diff.text : current ? '#a24f00' : '#21650f')).setOrigin(0.5));
      }
      if (done) addStars(this, node, { x: 0, y: 48, size: 24, gap: 0, earned: stars, raiseMiddle: -6 });

      if (current) {
        const halo = this.add.image(0, 0, 'fx-glow').setTint(0xfff3b0).setDisplaySize(170, 170).setAlpha(0.8);
        node.addAt(halo, 0);
        this.tweens.add({ targets: halo, alpha: 0.35, scale: halo.scale * 1.15, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: bg, scale: bg.scale * 1.08, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        // Little marker hopping above the current level.
        const marker = this.add.image(pos.x, pos.y - 70, 'jewel-rose').setDisplaySize(44, 44);
        this.currentMarker = marker;
        this.tweens.add({ targets: marker, y: pos.y - 82, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }

      bg.setInteractive({ useHandCursor: !locked });
      bg.on('pointerup', () => {
        if (this.dragDistance > 12 || i > this.revealIndex) return;
        if (locked) {
          playSfx(this, 'click', { volume: 0.4, detune: -500 });
          this.tweens.add({ targets: node, angle: { from: -8, to: 8 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => node.setAngle(0) });
          return;
        }
        playSfx(this, 'click', { volume: 0.5 });
        this.openLevelCard(i);
      });
    });
  }

  openLevelCard(index) {
    const level = LEVELS[index];
    const diff = DIFFICULTY[level.difficulty];
    const modal = showModal(this, { title: diff ? `Level ${level.id} · ${diff.tag === 'HARD' ? 'Hard' : 'Super Hard'}` : `Level ${level.id}`, color: diff ? diff.orb : 'yellow', width: 380, height: 500 });
    const { panel, top, width: panelW } = modal;

    panel.add(this.add.text(0, top + 12, `${level.name}  ·  ${level.moves} moves`, textStyle(18, COLORS.soft)).setOrigin(0.5));
    addStars(this, panel, { x: 0, y: top + 48, size: 30, gap: 8, earned: Progress.starsFor(index), raiseMiddle: 6 });

    // Goals in a sunken box, each with a count badge.
    const goals = Object.entries(resolveObjective(level));
    panel.add(this.add.text(0, top + 90, 'Goal', textStyle(24, COLORS.text)).setOrigin(0.5));
    const insetW = panelW - 70;
    panel.add(this.add.image(0, top + 148, insetTexture(this, insetW, 92)));
    const spacing = Math.min(90, (insetW - 20) / goals.length);
    goals.forEach(([type, count], i) => {
      const x = (i - (goals.length - 1) / 2) * spacing;
      panel.add(this.add.image(x - 4, top + 142, goalIconKey(type)).setDisplaySize(54, 54));
      panel.add(makeCountBadge(this, x + 20, top + 164, count, 30));
    });

    // Pre-level boosters: tap to bring one along (spent when the level starts); empty ones can be bought.
    const chosen = new Set();
    const hint = this.add.text(0, top + 212, 'Select starting boosters', textStyle(20, COLORS.text)).setOrigin(0.5);
    panel.add(hint);
    const kinds = Object.keys(BOOSTERS).filter((k) => !BOOSTERS[k].inGame);
    kinds.forEach((kind, i) => {
      const btn = makeBoosterButton(this, {
        x: (i - 1) * 96, y: top + 272, kind, size: 74,
        onClick: () => {
          if (btn.lockedUntil) {
            playSfx(this, 'invalid');
            hint.setText(`${BOOSTERS[kind].name} unlocks at level ${btn.lockedUntil}`);
            return;
          }
          if (Inventory.count(kind) <= 0) {
            openBuyBooster(this, kind, { onBought: () => btn.setCount(Inventory.count(kind)) });
            return;
          }
          if (chosen.has(kind)) chosen.delete(kind);
          else chosen.add(kind);
          btn.setActive(chosen.has(kind));
          if (!chosen.has(kind)) btn.setCount(Inventory.count(kind));
          hint.setText(chosen.has(kind) ? BOOSTERS[kind].help : 'Select starting boosters');
        },
      });
      btn.setCount(Inventory.count(kind));
      btn.setLocked(Unlocks.lockedUntil(kind, LEVELS.length));
      panel.add(btn);
    });

    const play = makeButton(this, {
      x: 0, y: modal.height / 2 - 4, width: 240, height: 72, label: 'Play', color: 'yellow', fontSize: 36,
      onClick: () => {
        if (Lives.count() <= 0) {
          modal.close();
          this.showNoLives();
          return;
        }
        const boosters = [...chosen].filter((k) => Inventory.use(k));
        this.scene.start('GameScene', { levelIndex: index, boosters });
      },
    });
    this.tweens.add({ targets: play, scale: 1.04, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const close = makeRoundButton(this, {
      x: modal.width / 2 - 22, y: -modal.height / 2 + 22, size: 46, label: '✕', color: 'red', onClick: () => modal.close(),
    });
    panel.add([play, close]);
    panel.setScrollFactor(0, 0, true);
  }

  showNoLives() {
    openNoLives(this, { onLives: () => this.livesBadge.refresh(), onClose: () => this.livesBadge.refresh() });
  }

  /** Y where the cloud bank starts, just above level `index`. */
  cloudEdge(index) {
    return this.nodes[index].y - NODE_GAP * 0.55;
  }

  /** Levels far ahead hide under a soft bank of clouds that rolls back as the player progresses. */
  drawClouds() {
    this.revealIndex = Math.min(LEVELS.length - 1, this.unlocked + REVEAL_AHEAD);
    if (this.revealIndex >= LEVELS.length - 1) return;
    const { width: W } = this.scale;
    const edge = this.cloudEdge(this.revealIndex);
    const clouds = this.add.container(0, edge).setDepth(45);
    const rng = new Phaser.Math.RandomDataGenerator(['bloomora-clouds']);

    // Smooth mist: clear at the edge, solid higher up (one stretched gradient, no bands).
    const MIST = 620;
    const fog = canvasTexture(this, 'map-fog', 4, 256, (ctx) => {
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, 'rgba(244,249,255,1)');
      grad.addColorStop(0.45, 'rgba(244,249,255,0.85)');
      grad.addColorStop(1, 'rgba(244,249,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 4, 256);
    });
    const solid = this.add.rectangle(0, -edge - 400, W, edge + 400 - MIST + 2, 0xf4f9ff).setOrigin(0);
    const mist = this.add.image(0, -MIST, fog).setOrigin(0).setDisplaySize(W, MIST);
    clouds.add([solid, mist]);

    // Soft cumulus puffs (radial gradients, no outlines): sparse and faint at the edge,
    // bigger, whiter and packed tighter the higher they float.
    const puffTex = canvasTexture(this, 'map-cloud', 320, 200, (ctx) => {
      const blob = (x, y, r, a) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,255,255,${a})`);
        g.addColorStop(0.6, `rgba(255,255,255,${a * 0.85})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      };
      // Cool shading underneath, then the bright billows on top.
      // (an ellipse squashed from a circle, so it fades out well inside the canvas)
      ctx.save();
      ctx.translate(160, 140);
      ctx.scale(2, 0.6);
      const shade = ctx.createRadialGradient(0, 0, 0, 0, 0, 70);
      shade.addColorStop(0, 'rgba(196,214,238,0.55)');
      shade.addColorStop(1, 'rgba(196,214,238,0)');
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.arc(0, 0, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      [[90, 110, 62, 1], [150, 86, 78, 1], [220, 104, 64, 1], [120, 124, 56, 0.9], [196, 128, 58, 0.9], [262, 122, 44, 0.8], [56, 128, 40, 0.8]]
        .forEach(([x, y, r, al]) => blob(x, y, r, al));
    });
    for (let y = 10; y > -1000; y -= 46) {
      const depth = Math.min(1, -y / 620);
      const count = 1 + Math.round(depth * 3);
      for (let i = 0; i < count; i += 1) {
        const x = rng.between(-80, W + 80);
        const scale = (0.55 + depth * 0.7) * rng.realInRange(0.8, 1.2);
        const c = this.add.image(x, y + rng.between(-20, 20), puffTex)
          .setScale(scale * rng.pick([1, -1]), scale)
          .setAlpha(Math.min(1, 0.22 + depth * 1.1) * rng.realInRange(0.85, 1));
        clouds.add(c);
        this.tweens.add({ targets: c, x: x + rng.between(-26, 26), duration: rng.between(5000, 9000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    }

    // A small sign floating in the clouds.
    const sign = this.add.container(W / 2, -250);
    sign.add([
      this.add.image(0, 0, pillTexture(this, 290, 46)),
      this.add.text(0, -2, 'Clear levels to part the clouds', textStyle(17, '#5f7fa3')).setOrigin(0.5),
    ]);
    clouds.add(sign);
    this.tweens.add({ targets: sign, y: -258, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.clouds = clouds;
  }

  /** After a first clear: the camera glides from the finished level up to the new one, which pops open. */
  playUnlockFanfare(index) {
    const node = this.nodeViews?.[index];
    if (!node) return;
    const { height: H } = this.scale;
    const cam = this.cameras.main;
    const from = this.nodes[index - 1];
    const to = this.nodes[index];
    const clampY = (y) => Phaser.Math.Clamp(y - H * 0.55, 0, Math.max(0, this.worldH - H));
    cam.scrollY = clampY(from.y);
    node.setScale(0);
    this.currentMarker?.setAlpha(0);

    // A grey padlock sits where the new level will appear, then bursts.
    const lock = this.add.image(to.x, to.y, 'ui-lock').setDisplaySize(40, 40);
    this.tweens.chain({
      targets: lock,
      tweens: [
        { delay: 500, angle: { from: -14, to: 14 }, duration: 70, yoyo: true, repeat: 4 },
        { scale: lock.scale * 1.6, alpha: 0, duration: 260, ease: 'Quad.easeOut', onComplete: () => lock.destroy() },
      ],
    });
    this.tweens.add({ targets: cam, scrollY: clampY(to.y), duration: 900, delay: 150, ease: 'Sine.easeInOut' });
    // The cloud bank drifts back to uncover one more level.
    if (this.clouds) {
      const edge = this.clouds.y;
      this.clouds.y = this.cloudEdge(this.revealIndex - 1);
      this.tweens.add({ targets: this.clouds, y: edge, duration: 1400, delay: 900, ease: 'Sine.easeInOut' });
    }
    this.time.delayedCall(1250, () => {
      playSfx(this, 'win', { volume: 0.7 });
      const sparkle = this.add.particles(to.x, to.y, 'fx-star6', {
        lifespan: 800, speed: { min: 100, max: 300 }, scale: { start: 0.5, end: 0 }, alpha: { start: 1, end: 0 },
        tint: [0xffffff, 0xfff3b0, 0xffe08a, 0xff8fc4], emitting: false,
      });
      sparkle.explode(36);
      this.time.delayedCall(1000, () => sparkle.destroy());
      this.tweens.add({ targets: node, scale: 1, duration: 520, ease: 'Back.easeOut' });
      this.tweens.add({ targets: this.currentMarker, alpha: 1, duration: 300, delay: 400 });
    });
  }

  /** Highest finished garden whose celebration hasn't been shown (older ones are marked silently). */
  pendingZone() {
    let pending = null;
    ZONES.forEach((zone, zi) => {
      const last = (ZONES[zi + 1]?.start ?? LEVELS.length) - 1;
      if (Progress.starsFor(last) > 0 && !Progress.isCelebrated(zi)) {
        if (pending !== null) Progress.markCelebrated(pending);
        pending = zi;
      }
    });
    return pending;
  }

  celebrateZone(zi) {
    openZoneComplete(this, {
      zoneName: ZONES[zi].name,
      nextName: ZONES[zi + 1]?.name,
      coinTarget: () => {
        const m = this.coinBadge.coin.getWorldTransformMatrix();
        return { x: m.tx, y: m.ty };
      },
      // Marked only once the reward is claimed, so an interrupted popup shows again.
      onClose: () => {
        Progress.markCelebrated(zi);
        if (Daily.canClaim()) this.time.delayedCall(700, () => this.showDaily());
      },
    });
  }

  showDaily() {
    openDailyReward(this, {
      coinTarget: () => {
        const m = this.coinBadge.coin.getWorldTransformMatrix();
        return { x: m.tx, y: m.ty };
      },
      onClose: () => this.livesBadge.refresh(),
    });
  }

  // ---------------------------------------------------------------- HUD & scrolling

  createHud() {
    const { width: W } = this.scale;
    const bar = this.add.graphics().setScrollFactor(0).setDepth(49);
    bar.fillGradientStyle(0x2f5d45, 0x2f5d45, 0x2f5d45, 0x2f5d45, 0.35, 0.35, 0, 0).fillRect(0, 0, W, 90);
    const back = makeRoundButton(this, {
      x: 34, y: 34, size: 46, label: '‹', color: 'yellow', onClick: () => this.scene.start('MenuScene'),
    });
    const badge = makeLivesBadge(this, 96, 34, Lives);
    this.livesBadge = badge;
    this.coinBadge = makeCoinBadge(this, W - 112, 34, { onShop: () => openShop(this, { onClose: () => badge.refresh() }) });
    const mute = makeMuteButton(this, { x: W - 34, y: 88, size: 44 });
    [back, badge, this.coinBadge, mute].forEach((o) => o.setScrollFactor(0, 0, true).setDepth(50));
    this.time.addEvent({ delay: 1000, loop: true, callback: () => badge.refresh() });

    // Gift button (bottom-left) stays for the day's gift if the popup was skipped.
    if (Daily.canClaim()) {
      const { height: H } = this.scale;
      const gift = this.add.image(44, H - 50, 'ui-gift').setDisplaySize(64, 64).setScrollFactor(0).setDepth(50)
        .setInteractive({ useHandCursor: true });
      this.tweens.add({ targets: gift, angle: { from: -10, to: 10 }, duration: 300, yoyo: true, repeat: -1, repeatDelay: 900 });
      gift.on('pointerup', () => {
        if (!Daily.canClaim()) return;
        playSfx(this, 'click');
        this.showDaily();
      });
      this.giftButton = gift;
      const hide = () => {
        if (!Daily.canClaim() && gift.active) gift.destroy();
      };
      this.time.addEvent({ delay: 500, loop: true, callback: hide });
    }

    // Lucky Flower Wheel (bottom-right): a free spin every day.
    const { width: SW, height: SH } = this.scale;
    this.wheelButton = makeWheelButton(this, {
      x: SW - 46, y: SH - 54, size: 70,
      canTap: () => this.dragDistance <= 12,
      onClick: () => this.showWheel(),
    }).setScrollFactor(0, 0, true).setDepth(50);

    // Weekly quests (bottom-left).
    this.questButton = makeQuestButton(this, {
      x: 46, y: SH - 60, size: 62,
      canTap: () => this.dragDistance <= 12,
      onClick: () => openQuests(this, {
        coinTarget: () => {
          const m = this.coinBadge.coin.getWorldTransformMatrix();
          return { x: m.tx, y: m.ty };
        },
        onClose: () => this.questButton.refresh(),
      }),
    }).setScrollFactor(0, 0, true).setDepth(50);
  }

  showWheel() {
    openLuckyWheel(this, {
      coinTarget: () => {
        const m = this.coinBadge.coin.getWorldTransformMatrix();
        return { x: m.tx, y: m.ty };
      },
      onClose: () => this.wheelButton.refresh(),
    });
  }

  setupScrolling() {
    const cam = this.cameras.main;
    this.dragDistance = 0;
    let lastY = null;
    let velocity = 0;

    this.input.on('pointerdown', (p) => {
      lastY = p.y;
      this.dragDistance = 0;
      velocity = 0;
    });
    this.input.on('pointermove', (p) => {
      if (!p.isDown || lastY === null) return;
      const dy = p.y - lastY;
      lastY = p.y;
      this.dragDistance += Math.abs(dy);
      cam.scrollY -= dy;
      velocity = dy;
    });
    this.input.on('pointerup', () => {
      lastY = null;
    });
    this.input.on('wheel', (_p, _objs, _dx, dy) => {
      cam.scrollY += dy * 0.6;
    });

    // A little momentum after a swipe.
    this.events.on('update', () => {
      if (lastY === null && Math.abs(velocity) > 0.3) {
        cam.scrollY -= velocity;
        velocity *= 0.92;
      }
    });
  }
}
