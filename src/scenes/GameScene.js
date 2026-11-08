import Phaser from 'phaser';
import { Board, goalIconKey, countLayout } from '../board/Board.js';
import { LEVELS, resolveObjective } from '../levels/LevelData.js';
import { Seen } from '../core/Seen.js';

/** Obstacles that get a one-time "New!" card, in the order they're explained. */
const FEATURES = {
  soil: { icon: 'cell-soil1', name: 'Dry Soil', text: 'Match blooms sitting on dry soil to grow fresh grass. Dark soil needs two matches.' },
  crate: { icon: 'ob-crate1', name: 'Planter Box', text: 'Match right next to a box to break it. Boxes with metal bands take two hits.' },
  vine: { icon: 'ob-vine', name: 'Vines', text: 'A vine holds its bloom in place. Match that bloom to cut the vine free.' },
  seed: { icon: 'item-seed', name: 'Seeds', text: 'Clear the blooms below a seed to bring it down to the bottom of the garden.' },
  weed: { icon: 'ob-weed', name: 'Thorny Weed', text: 'Clear a weed every turn, or it spreads to a neighbouring tile!' },
  pot: { icon: 'ob-pot', name: 'Thirsty Pot', text: 'Match next to a pot to water it. Its own bloom kind waters double!' },
};
import { Progress } from '../core/Progress.js';
import {
  textStyle, titleStyle, makeButton, makeRoundButton, addGardenBackground, showModal, makeBoosterButton, boosterIcon,
  makeVivid, makeMuteButton, makeCountBadge, showTooltip, makeAdButton, COLORS,
} from '../ui/UI.js';
import { Ads } from '../core/Ads.js';
import { Platform } from '../core/Platform.js';
import {
  cardTexture, insetTexture, panelTexture, raysTexture, bigStarTexture,
} from '../ui/Skin.js';
import { isMuted, setMuted, isMusicMuted, setMusicMuted } from '../core/Sound.js';
import { Inventory, BOOSTERS } from '../core/Inventory.js';
import { playSfx, playMusic } from '../core/Sound.js';
import { Lives } from '../core/Lives.js';
import { Streak } from '../core/Streak.js';
import { Quests } from '../core/Quests.js';
import { Unlocks } from '../core/Unlocks.js';
import { addMascot } from '../ui/Mascot.js';
import { Wallet } from '../core/Wallet.js';
import { openBuyBooster, openNoLives } from '../ui/Shop.js';

const CONTINUE_PRICE = 150;

const PAD = 12;
const CARD_H = 104;
const BOOSTER_BAR = 92;
const COMBO_WORDS = ['', '', 'Sweet!', 'Lovely!', 'Blooming!', 'Gorgeous!', 'Garden Glory!'];

/** Captions for the first-levels tutorial hand. */
const TUTORIAL_STEPS = [
  ['Swipe to swap!', 'Slide a fruit into its neighbour to line up 3 of a kind.'],
  ['Make 4 in a row', 'Matching 4 makes a line bloom that clears a whole row!'],
  ['Grow the garden', 'Match on the brown soil to turn it into fresh grass.'],
];

/** How each difficulty shows up in the level intro. */
const DIFFICULTY = {
  hard: { label: 'Hard Level!', color: '#d0453a' },
  super: { label: 'Super Hard Level!', color: '#8a3fd8' },
};

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data) {
    const fallback = Progress.currentLevelIndex(LEVELS.length);
    this.levelIndex = Phaser.Math.Clamp(data?.levelIndex ?? fallback, 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
    this.startBoosters = data?.boosters ?? [];
    this.movesLeft = this.level.moves + (this.startBoosters.includes('moves') ? 3 : 0);
    this.remaining = resolveObjective(this.level);
    // Score thresholds for the three star markers scale with the level's move count.
    this.score = 0;
    // Measured ~200-270 points per move, so a solid win plus bonus round lands near 2 stars.
    this.starScores = [this.level.moves * 100, this.level.moves * 200, this.level.moves * 290];
    this.starsLit = 0;
    this.ended = false;
    // The free "+3 Moves for an ad" continue is offered once per attempt.
    this.adContinueUsed = false;
    // Win streak gifts for this attempt, and quest progress waiting to be saved.
    this.streakGifts = Streak.gifts();
    this.tally = {};
  }

  create() {
    makeVivid(this);
    this.background = addGardenBackground(this, { blur: true });

    this.board = new Board(this, {
      types: this.level.types,
      layout: this.level.layout,
      seeds: this.level.objective.seed ?? 0,
      potNeed: this.level.potNeed,
      callbacks: {
        moveUsed: () => this.useMove(),
        collect: (type, x, y) => this.collect(type, x, y),
        combo: (chain) => this.showCombo(chain),
        turnEnd: () => this.checkEnd(),
        shuffle: () => this.showBanner('No moves left — shuffling!'),
        boosterUsed: (kind) => this.onBoosterUsed(kind),
        weedSpread: () => this.onWeedSpread(),
        score: (points, pos) => this.addScore(points, pos),
        special: () => this.tallyAdd('special'),
      },
    });

    this.createHud();
    this.createBoosterBar();
    this.layout();

    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.layout, this);
      // Leaving or restarting the level is a break in play.
      Platform.gameplayStop();
    });
    Platform.gameplayStart();

    this.board.start()
      .then(() => this.board.applyStartBoosters([...this.startBoosters, ...this.streakGifts.map((k) => `streak:${k}`)]))
      .then(() => this.maybeShowTutorial());
    playSfx(this, 'start');
    playMusic();
    // First time a level brings a new obstacle, explain it before play starts.
    // Before play: introduce new obstacles, then newly unlocked boosters, then the level intro.
    const fresh = this.newFeatures();
    const unlocked = Unlocks.newOnLevel(this.level.id);
    const steps = [];
    if (fresh.length) steps.push((next) => this.showFeatureCard(fresh, next));
    if (unlocked.length) steps.push((next) => this.showUnlockCard(unlocked, next));
    if (steps.length) {
      this.board.locked = true;
      const run = (i) => {
        if (i >= steps.length) {
          this.board.locked = false;
          this.showIntro();
          return;
        }
        steps[i](() => run(i + 1));
      };
      this.time.delayedCall(450, () => run(0));
    } else {
      this.showIntro();
    }
  }

  // ---------------------------------------------------------------- HUD

  /** Wooden card: a label on the wood strip and content in the cream window. */
  makeCard(label) {
    const card = this.add.container(0, 0);
    card.bg = this.add.image(0, 0, cardTexture(this, 100, CARD_H));
    card.label = this.add.text(0, 0, label, titleStyle(17, '#8b4f1c')).setOrigin(0.5);
    card.add([card.bg, card.label]);
    card.resize = (w, h, labelH = 28) => {
      card.bg.setTexture(cardTexture(this, w, h, labelH));
      card.label.setPosition(0, -h / 2 + labelH / 2 + 1);
      card.w = w;
      card.h = h;
      card.labelH = labelH;
    };
    return card;
  }

  createHud() {
    this.hud = this.add.container(0, 0).setDepth(10);

    // Moves.
    this.movesBubble = this.makeCard('Moves');
    this.movesText = this.add.text(0, 0, `${this.movesLeft}`, textStyle(42, COLORS.text)).setOrigin(0.5);
    this.movesBubble.add(this.movesText);

    // Targets.
    this.goalCard = this.makeCard('Targets');
    this.goalItems = {};
    this.goalRow = this.add.container(0, 0);
    Object.entries(this.remaining).forEach(([type, count]) => {
      const item = this.add.container(0, 0);
      const icon = this.add.image(0, 0, goalIconKey(type)).setDisplaySize(46, 46);
      const badge = makeCountBadge(this, 18, 16, count, 28);
      item.add([icon, badge]);
      item.setSize(56, 56).setInteractive({ useHandCursor: true });
      item.on('pointerdown', () => {
        const m = item.getWorldTransformMatrix();
        const [title, body] = this.describeGoal(type);
        showTooltip(this, m.tx, m.ty + 30 * m.scaleY, title, body, { below: true });
      });
      this.goalRow.add(item);
      this.goalItems[type] = { item, icon, text: badge.text, shown: count };
    });
    this.goalCard.add(this.goalRow);

    // Level + score bar with three star markers.
    this.scoreCard = this.makeCard(`Level ${this.level.id}`);
    this.scoreBar = this.add.container(0, 0);
    this.scoreBarGfx = this.add.graphics();
    this.scoreFill = this.add.graphics();
    this.scoreText = this.add.text(0, 0, '0', textStyle(13, '#ffffff', { stroke: '#7a4a00', strokeThickness: 4 })).setOrigin(0.5);
    this.starMarkers = this.starScores.map(() => this.add.image(0, 0, bigStarTexture(this, 128, false)).setDisplaySize(26, 26));
    this.scoreBar.add([this.scoreBarGfx, this.scoreFill, this.scoreText, ...this.starMarkers]);
    this.scoreCard.add(this.scoreBar);

    this.pauseButton = makeRoundButton(this, { x: 0, y: 0, size: 48, label: '≡', color: 'green', onClick: () => this.openPause() });
    this.muteButton = makeMuteButton(this, { x: 0, y: 0, size: 48 });

    this.hud.add([this.movesBubble, this.goalCard, this.scoreCard, this.pauseButton, this.muteButton]);
  }

  /** Landscape screens get side columns; portrait screens a top bar and a bottom booster row. */
  isWide() {
    const { width: W, height: H } = this.scale;
    // Includes 800x450 (a common desktop portal frame) and phones held sideways.
    return W >= 560 && W > H * 1.15;
  }

  /** Scale the side-column HUD by `s` (short landscape screens shrink it to fit). */
  setHudScale(s) {
    this.hudScale = s;
    [this.movesBubble, this.goalCard, this.scoreCard, this.boosterBar].forEach((o) => o.setScale(s));
    [this.pauseButton, this.muteButton].forEach((b) => {
      b.baseScale = s;
      b.setScale(s);
    });
  }

  layout() {
    const { width: W, height: H } = this.scale;
    this.background.layout(W, H);
    const wide = this.isWide();
    const goals = Object.values(this.goalItems);

    if (wide) {
      const colW = 150;
      const goalsH = 36 + goals.length * 62 + 10;
      const colH = CARD_H + 12 + goalsH + 12 + 84;
      // The left column (and the right one, to match) shrinks to fit short screens.
      const s = Math.min(1, (H - PAD * 2) / colH);
      this.setHudScale(s);
      const cx = PAD + (colW / 2) * s;
      let y = PAD;
      this.movesBubble.resize(colW, CARD_H);
      this.movesBubble.setPosition(cx, y + (CARD_H / 2) * s);
      this.movesText.setPosition(0, 14);
      y += (CARD_H + 12) * s;

      this.goalCard.resize(colW, goalsH);
      this.goalCard.setPosition(cx, y + (goalsH / 2) * s);
      this.goalRow.setScale(1).setPosition(-6, -goalsH / 2 + 36 + 6);
      goals.forEach(({ item }, i) => item.setPosition(0, 31 + i * 62));
      y += (goalsH + 12) * s;

      this.scoreCard.resize(colW, 84);
      this.scoreCard.setPosition(cx, y + 42 * s);
      this.layoutScoreBar(colW - 34, 16);

      this.pauseButton.setPosition(W - PAD - 30 * s, PAD + 30 * s);
      this.muteButton.setPosition(W - PAD - 30 * s, PAD + 88 * s);

      // Boosters sit below the two round buttons, centered in the space that is left.
      const kinds = Object.keys(this.boosterButtons);
      const boosterTop = PAD + 124 * s;
      this.boosterBar.setPosition(W - PAD - 46 * s, (boosterTop + H - PAD) / 2);
      kinds.forEach((k, i) => this.boosterButtons[k].setPosition(0, (i - (kinds.length - 1) / 2) * 96));

      const left = PAD + colW * s + 16;
      const right = 112 * s;
      this.boardRect = this.board.layout(left, PAD, W - left - PAD - right, H - PAD * 2);
    } else {
      this.setHudScale(1);
      const hudW = Math.min(W - PAD * 2, 600);
      const left = (W - hudW) / 2;
      const btnCol = 56;
      const movesW = 96;
      this.movesBubble.resize(movesW, CARD_H);
      this.movesBubble.setPosition(left + movesW / 2, PAD + CARD_H / 2);
      this.movesText.setPosition(0, 14);

      const goalW = hudW - movesW - btnCol - 16;
      this.goalCard.resize(goalW, CARD_H);
      this.goalCard.setPosition(left + movesW + 8 + goalW / 2, PAD + CARD_H / 2);
      const spacing = Math.min(70, (goalW - 20) / goals.length);
      const goalScale = Math.min(1, spacing / 64);
      this.goalRow.setScale(goalScale).setPosition(-4, 14);
      goals.forEach(({ item }, i) => item.setPosition(((i - (goals.length - 1) / 2) * spacing) / goalScale, 0));

      const bx = left + hudW - btnCol / 2 + 2;
      this.pauseButton.setPosition(bx, PAD + 24);
      this.muteButton.setPosition(bx, PAD + CARD_H - 22);

      const barTop = PAD + CARD_H + 8;
      this.scoreCard.resize(hudW, 40, 0);
      this.scoreCard.label.setVisible(false);
      this.scoreCard.setPosition(W / 2, barTop + 20);
      this.layoutScoreBar(hudW - 40, 0);

      const kinds = Object.keys(this.boosterButtons);
      this.boosterBar.setPosition(W / 2, H - PAD - BOOSTER_BAR / 2 + 6);
      kinds.forEach((k, i) => this.boosterButtons[k].setPosition((i - (kinds.length - 1) / 2) * 92, 0));

      const boardTop = barTop + 40 + 10;
      this.boardRect = this.board.layout(PAD, boardTop, W - PAD * 2, H - boardTop - PAD - BOOSTER_BAR);
    }
    this.scoreCard.label.setVisible(wide);
    this.boosterHint.setPosition(this.boardRect.x + this.boardRect.width / 2, this.boardRect.y + this.boardRect.height + 2);
  }

  /** Score bar `width` wide, centered in the score card at offset y. */
  layoutScoreBar(width, y) {
    this.scoreBarW = width;
    this.scoreBar.setPosition(-width / 2, y);
    this.scoreBarGfx.clear();
    this.scoreBarGfx.fillStyle(0x6b3d14, 0.85).fillRoundedRect(0, -9, width, 18, 9);
    this.scoreBarGfx.lineStyle(2, 0xffffff, 0.7).strokeRoundedRect(0, -9, width, 18, 9);
    this.scoreText.setPosition(width / 2, 0);
    this.starMarkers.forEach((star, i) => star.setPosition(width * this.starPosition(i), -1));
    this.drawScoreFill();
  }

  /** Where star i sits along the bar (0..1). */
  starPosition(i) {
    return Math.min(0.97, this.starScores[i] / (this.starScores[2] * 1.03));
  }

  drawScoreFill() {
    const ratio = Math.min(1, this.score / (this.starScores[2] * 1.03));
    const w = Math.max(0, (this.scoreBarW - 4) * ratio);
    this.scoreFill.clear();
    if (w > 6) {
      this.scoreFill.fillStyle(0xffa928, 1).fillRoundedRect(2, -7, w, 14, 7);
      this.scoreFill.fillStyle(0xffe066, 1).fillRoundedRect(2, -7, w, 8, { tl: 7, tr: 7, bl: 0, br: 0 });
      this.scoreFill.fillStyle(0xffffff, 0.4).fillRoundedRect(5, -6, Math.max(0, w - 6), 3, 1.5);
    }
    this.scoreText.setText(this.score.toLocaleString());
  }

  addScore(points, pos) {
    this.score += points;
    this.drawScoreFill();

    // Floating "+points" where it happened.
    if (pos) {
      const big = points >= 200;
      const t = this.add.text(pos.x, pos.y, '+' + points, textStyle(big ? 30 : 22, big ? '#ffe066' : '#ffffff', {
        stroke: big ? '#b05e00' : '#2f6b3a', strokeThickness: 6,
      })).setOrigin(0.5).setDepth(45).setScale(0.6);
      this.tweens.add({ targets: t, scale: 1, duration: 140, ease: 'Back.easeOut' });
      this.tweens.add({ targets: t, y: pos.y - 50, alpha: 0, duration: 700, delay: 250, onComplete: () => t.destroy() });
    }

    // Light up star markers as thresholds are passed.
    while (this.starsLit < 3 && this.score >= this.starScores[this.starsLit]) {
      const star = this.starMarkers[this.starsLit];
      star.setTexture(bigStarTexture(this, 128, true));
      const full = star.scale;
      this.tweens.add({ targets: star, scale: full * 1.6, duration: 160, yoyo: true, ease: 'Quad.easeOut' });
      playSfx(this, 'star', { volume: 0.8, step: this.starsLit });
      this.starsLit += 1;
    }
  }

  /** Final stars: the better of the score result and the moves-left result. */
  computeStars(movesAtWin) {
    const byScore = this.score >= this.starScores[2] ? 3 : this.score >= this.starScores[1] ? 2 : 1;
    const ratio = movesAtWin / this.level.moves;
    const byMoves = ratio >= 0.35 ? 3 : ratio >= 0.15 ? 2 : 1;
    return Math.max(byScore, byMoves);
  }

  goalWorldPosition(type) {
    const { item } = this.goalItems[type];
    const m = item.getWorldTransformMatrix();
    return { x: m.tx, y: m.ty };
  }

  /** A weed grew: there's one more to clear. */
  onWeedSpread() {
    if (this.remaining.weed === undefined || this.ended) return;
    this.remaining.weed += 1;
    const goal = this.goalItems.weed;
    goal.shown += 1;
    goal.text.setText(`${goal.shown}`).setColor(COLORS.bad);
    this.tweens.add({ targets: goal.item, scale: 1.25, duration: 120, yoyo: true, onComplete: () => goal.text.setColor(COLORS.text) });
    if (!this.weedWarned) this.showBanner('Clear a weed each turn or they spread!');
    this.weedWarned = true;
  }

  // ---------------------------------------------------------------- boosters

  createBoosterBar() {
    this.boosterBar = this.add.container(0, 0).setDepth(10);
    this.boosterButtons = {};
    const kinds = Object.keys(BOOSTERS).filter((k) => BOOSTERS[k].inGame);
    kinds.forEach((kind) => {
      const btn = makeBoosterButton(this, {
        x: 0, y: 0, kind, size: 72,
        onClick: () => {
          if (btn.heldForTip) { btn.heldForTip = false; return; }
          this.pressBooster(kind);
        },
      });
      // Press and hold a booster to see what it does.
      btn.on('pointerdown', () => {
        btn.heldForTip = false;
        btn.holdTimer?.remove();
        btn.holdTimer = this.time.delayedCall(420, () => {
          btn.heldForTip = true;
          const m = btn.getWorldTransformMatrix();
          showTooltip(this, m.tx, m.ty - 40 * m.scaleY, BOOSTERS[kind].name, `${BOOSTERS[kind].help}.
Tap to use it.`);
        });
      });
      btn.on('pointerout', () => btn.holdTimer?.remove());
      btn.on('pointerup', () => btn.holdTimer?.remove());
      btn.setCount(Inventory.count(kind));
      btn.setLocked(Unlocks.lockedUntil(kind, LEVELS.length));
      this.boosterBar.add(btn);
      this.boosterButtons[kind] = btn;
    });
    this.boosterHint = this.add.text(0, 0, '', titleStyle(18, '#6b3d14')).setOrigin(0.5, 1).setDepth(12);
  }

  /** Title and explanation for a goal's tooltip. */
  describeGoal(type) {
    const left = Math.max(0, this.remaining[type]);
    const done = left <= 0 ? ' Done!' : '';
    const info = {
      soil: ['Dry Soil', 'Match blooms sitting on brown soil to grow grass. Dark soil needs two matches.'],
      crate: ['Planter Boxes', 'Match right next to a box to break it. Boxes with metal bands take two hits.'],
      vine: ['Vines', 'A vine holds a bloom in place. Match that bloom to cut the vine.'],
      weed: ['Thorny Weeds', 'Match next to a weed to pull it. Leave them alone and they spread!'],
      pot: ['Thirsty Pots', 'Match next to a pot to water it. Blooms of the kind it shows count double!'],
      seed: ['Seeds', 'Clear the blooms under a seed so it drops to the bottom row.'],
    }[type];
    if (info) return [info[0], `${info[1]} ${left} to go.${done}`];
    const plural = type === 'leaf' ? 'leaves' : /[^aeiou]y$/.test(type) ? `${type.slice(0, -1)}ies` : `${type}s`;
    const title = plural.charAt(0).toUpperCase() + plural.slice(1);
    return [title, left > 0 ? `Match ${left} more ${plural}. Long matches and specials help!` : 'All collected!'];
  }

  // ---------------------------------------------------------------- pause

  openPause() {
    if (this.ended || this.pauseOpen) return;
    const board = this.board;
    const wasLocked = board.locked;
    board.locked = true;
    this.pauseOpen = true;
    Platform.gameplayStop();
    const modal = showModal(this, { title: 'Paused', color: 'yellow', width: 330, height: 430 });
    const { panel, top } = modal;
    const done = () => {
      modal.close();
      board.locked = wasLocked;
      this.pauseOpen = false;
      Platform.gameplayStart();
    };
    const soundLabel = () => (isMuted() ? 'Sound: Off' : 'Sound: On');
    const musicLabel = () => (isMusicMuted() ? 'Music: Off' : 'Music: On');
    const sound = makeButton(this, {
      x: -70, y: top + 40, width: 128, height: 50, label: soundLabel(), color: isMuted() ? 'grey' : 'blue', fontSize: 17,
      onClick: () => {
        setMuted(!isMuted());
        sound.label.setText(soundLabel());
        sound.setColor(isMuted() ? 'grey' : 'blue');
        this.muteButton.refresh();
      },
    });
    const music = makeButton(this, {
      x: 70, y: top + 40, width: 128, height: 50, label: musicLabel(), color: isMusicMuted() ? 'grey' : 'blue', fontSize: 17,
      onClick: () => {
        setMusicMuted(!isMusicMuted());
        music.label.setText(musicLabel());
        music.setColor(isMusicMuted() ? 'grey' : 'blue');
        this.muteButton.refresh();
      },
    });
    const resume = makeButton(this, { x: 0, y: top + 116, width: 230, height: 60, label: 'Resume', color: 'green', fontSize: 26, onClick: done });
    const restart = makeButton(this, {
      x: 0, y: top + 190, width: 230, height: 56, label: 'Restart', color: 'yellow', fontSize: 23,
      onClick: () => {
        done();
        this.confirmLeave(() => this.restartLevel());
      },
    });
    const map = makeButton(this, {
      x: 0, y: top + 260, width: 230, height: 56, label: 'Quit to Map', color: 'red', fontSize: 23,
      onClick: () => {
        done();
        this.confirmLeave(() => this.goToMap());
      },
    });
    const close = makeRoundButton(this, {
      x: modal.width / 2 - 34, y: -modal.height / 2 + 34, size: 40, label: '✕', color: 'red', onClick: done,
    });
    panel.add([sound, music, resume, restart, map, close]);
  }

  pressBooster(kind) {
    const board = this.board;
    if (this.ended || board.busy || board.locked) return;
    const button = this.boosterButtons[kind];
    if (button.lockedUntil) {
      playSfx(this, 'invalid');
      const m = button.getWorldTransformMatrix();
      showTooltip(this, m.tx, m.ty - 40 * m.scaleY, `${BOOSTERS[kind].name} is locked`, `It unlocks at level ${button.lockedUntil}. Keep growing!`);
      return;
    }

    if (board.mode === kind || (kind === 'swap' && board.mode === 'swap')) {
      this.setBoosterMode(null);
      return;
    }
    if (Inventory.count(kind) <= 0) {
      this.tweens.add({ targets: button, angle: { from: -10, to: 10 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => button.setAngle(0) });
      this.setBoosterMode(null);
      const wasLocked = board.locked;
      board.locked = true;
      openBuyBooster(this, kind, {
        onBought: () => button.setCount(Inventory.count(kind)),
        onClose: () => { board.locked = wasLocked; },
      });
      return;
    }
    if (kind === 'breeze') {
      this.setBoosterMode(null);
      board.useBreeze().then((used) => {
        if (used) this.onBoosterUsed('breeze');
      });
      return;
    }
    this.setBoosterMode(kind);
  }

  setBoosterMode(kind) {
    this.board.mode = kind;
    this.board.clearSelection();
    Object.entries(this.boosterButtons).forEach(([k, btn]) => {
      btn.setActive(k === kind);
      if (k !== kind) btn.setCount(Inventory.count(k));
    });
    this.boosterHint.setText(kind ? BOOSTERS[kind].help : '');
  }

  onBoosterUsed(kind) {
    this.tallyAdd('booster');
    Inventory.use(kind);
    playSfx(this, 'sparkle');
    this.setBoosterMode(null);
    this.boosterButtons[kind]?.setCount(Inventory.count(kind));
  }

  // ---------------------------------------------------------------- gameplay callbacks

  useMove() {
    if (this.ended) return;
    this.movesLeft = Math.max(0, this.movesLeft - 1);
    this.movesText.setText(`${this.movesLeft}`);
    this.tweens.add({ targets: this.movesBubble, scale: 1.15 * (this.hudScale ?? 1), duration: 110, yoyo: true });
    if (this.movesLeft <= 5) {
      this.movesText.setColor(COLORS.bad);
    }
    if (this.movesLeft === 5 && this.level.moves > 10) {
      this.time.delayedCall(250, () => this.showBanner('5 moves left!'));
    }
  }

  collect(type, x, y) {
    this.tallyAdd(['soil', 'crate', 'vine', 'weed'].includes(type) ? 'obstacle' : `collect:${type}`);
    if (this.remaining[type] === undefined || this.remaining[type] <= 0) return;
    this.remaining[type] -= 1;

    const target = this.goalWorldPosition(type);
    const flyer = this.add.image(x, y, goalIconKey(type)).setDisplaySize(40, 40).setDepth(50);
    const midX = (x + target.x) / 2 + Phaser.Math.Between(-60, 60);
    const midY = Math.min(y, target.y) - 40;
    const path = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(x, y), new Phaser.Math.Vector2(midX, midY), new Phaser.Math.Vector2(target.x, target.y),
    );
    const progress = { t: 0 };
    this.tweens.add({
      targets: progress,
      t: 1,
      duration: Phaser.Math.Between(420, 620),
      ease: 'Sine.easeIn',
      onUpdate: () => {
        const p = path.getPoint(progress.t);
        flyer.setPosition(p.x, p.y);
        flyer.setDisplaySize(40 - progress.t * 14, 40 - progress.t * 14);
      },
      onComplete: () => {
        flyer.destroy();
        const goal = this.goalItems[type];
        goal.shown -= 1;
        const shown = goal.shown;
        goal.text.setText(shown <= 0 ? '✓' : `${shown}`);
        if (shown <= 0) goal.text.setColor(COLORS.good);
        this.tweens.killTweensOf(goal.item);
        goal.item.setScale(1);
        this.tweens.add({ targets: goal.item, scale: 1.18, duration: 90, yoyo: true });
      },
    });
  }

  tallyAdd(kind, n = 1) {
    this.tally[kind] = (this.tally[kind] ?? 0) + n;
  }

  /** Save quest progress collected since the last turn. */
  flushTally() {
    Object.entries(this.tally).forEach(([kind, n]) => Quests.add(kind, n));
    this.tally = {};
  }

  /** Giving up costs a life and breaks the win streak. */
  giveUp() {
    Lives.lose();
    if (!Lives.isUnlimited()) Streak.lose();
  }

  checkEnd() {
    this.flushTally();
    if (this.ended) return;
    const won = Object.values(this.remaining).every((v) => v <= 0);
    if (won) {
      this.finish(true);
    } else if (this.movesLeft <= 0) {
      this.finish(false);
    }
  }

  finish(won) {
    this.ended = true;
    Platform.gameplayStop();
    this.board.locked = true;
    this.board.stopHint();
    this.setBoosterMode(null);

    if (won) {
      const movesAtWin = this.movesLeft;
      this.time.delayedCall(500, () => playSfx(this, 'win'));
      const hasNext = this.levelIndex < LEVELS.length - 1;
      // Stars are decided after the bonus round has added its points.
      this.celebrate().then(() => {
        const stars = this.computeStars(movesAtWin);
        const firstClear = Progress.starsFor(this.levelIndex) === 0;
        const rewarded = Progress.complete(this.levelIndex, stars);
        const reward = rewarded ? Inventory.randomReward() : null;
        if (reward) Inventory.add(reward);
        const coins = Wallet.winReward(stars, firstClear);
        Wallet.add(coins);
        Streak.win();
        this.flushTally();
        Quests.add('win');
        Quests.add('stars', stars);
        return { stars, reward, coins, firstClear };
      }).then(async (result) => {
        await this.showVictory();
        return result;
      }).then(({ stars, reward, coins, firstClear }) => {
        const coinChip = { icon: 'ui-coin', text: `+${coins}`, coins };
        return this.showPopup({
          title: 'Garden Bloomed!',
          subtitle: 'Score ' + this.score.toLocaleString(),
          rewards: [
            coinChip,
            ...(reward ? [{ icon: boosterIcon(reward), text: '+1' }] : []),
          ],
          stars,
          buttons: [
            {
              label: `Double Coins`,
              ad: 'double',
              onClick: (_close, btn) => {
                Wallet.add(coins);
                playSfx(this, 'coin');
                coinChip.labelText?.setText(`+${coins * 2}`);
                if (coinChip.chip) this.tweens.add({ targets: coinChip.chip, scale: 1.25, duration: 160, yoyo: true, ease: 'Back.easeOut' });
                btn.disableInteractive();
                this.tweens.add({ targets: btn, alpha: 0, duration: 200, onComplete: () => btn.setVisible(false) });
              },
            },
            hasNext
              ? {
                label: 'Next Level',
                onClick: () => (Lives.count() > 0
                  ? this.scene.restart({ levelIndex: this.levelIndex + 1 })
                  : this.goToMap(this.levelIndex + 1, firstClear)),
              }
              : { label: 'Replay', onClick: () => this.restartLevel() },
            { label: 'Map', color: 'blue', onClick: () => this.goToMap(this.levelIndex + 1, firstClear) },
          ],
        });
      });
    } else {
      // The life is only lost if the player gives up; +3 Moves lets them keep going.
      this.time.delayedCall(400, () => playSfx(this, 'lose'));
      const missing = Object.entries(this.remaining).filter(([, v]) => v > 0);
      const extra = Inventory.count('moves');
      const buttons = [];
      if (extra > 0) {
        buttons.push({ label: `+3 Moves (${extra} left)`, color: 'green', onClick: (close) => this.continueWithMoves(close, 'booster') });
      } else if (Wallet.count() >= CONTINUE_PRICE) {
        buttons.push({ label: `+3 Moves · ${CONTINUE_PRICE} coins`, color: 'green', onClick: (close) => this.continueWithMoves(close, 'coins') });
      }
      // One free continue per attempt for watching an ad.
      if (!this.adContinueUsed) {
        buttons.push({ label: '+3 Moves', ad: 'moves', onClick: (close) => { this.adContinueUsed = true; this.continueWithMoves(close, 'ad'); } });
      }
      buttons.push(
        { label: 'Try Again', color: 'yellow', onClick: () => { this.giveUp(); this.restartLevel(); } },
        { label: 'Map', color: 'blue', onClick: () => { this.giveUp(); this.goToMap(); } },
      );
      this.time.delayedCall(600, () => this.showPopup({
        title: 'Out of Moves',
        subtitle: 'Giving up costs a life.',
        missing,
        stars: null,
        buttons,
      }));
    }
  }

  /**
   * Keep playing after running out: +3 moves paid with a booster, with coins,
   * or free after a watched ad (`source`: 'booster' | 'coins' | 'ad').
   */
  continueWithMoves(closePopup, source = 'booster') {
    if (source === 'coins' && !Wallet.spend(CONTINUE_PRICE)) return;
    if (source === 'booster' && !Inventory.use('moves')) return;
    const payWithCoins = source === 'coins';
    closePopup();
    this.ended = false;
    Platform.gameplayStart();
    this.board.locked = false;
    this.movesLeft += 3;
    this.movesText.setText(`${this.movesLeft}`).setColor(COLORS.text);
    this.tweens.add({ targets: this.movesBubble, scale: 1.35 * (this.hudScale ?? 1), duration: 180, yoyo: true, ease: 'Back.easeOut' });
    this.showBanner('+3 Moves!');
    playSfx(this, payWithCoins ? 'coin' : 'sparkle');
  }

  restartLevel() {
    if (Lives.count() <= 0) {
      openNoLives(this, {
        closeLabel: 'Back to Map',
        onLives: () => this.scene.restart({ levelIndex: this.levelIndex }),
        onClose: () => this.goToMap(),
      });
      return;
    }
    this.scene.restart({ levelIndex: this.levelIndex });
  }

  /** `unlockedNew` plays the map's "path opens" fanfare for a first clear. */
  goToMap(focusLevel = this.levelIndex, unlockedNew = false) {
    const focus = Math.min(focusLevel, LEVELS.length - 1);
    this.scene.start('MapScene', { focusLevel: focus, justUnlocked: unlockedNew && focusLevel < LEVELS.length ? focus : undefined });
  }

  /** Leaving a level after making a move costs a life, so ask first. */
  confirmLeave(action) {
    const started = this.movesLeft < this.level.moves;
    if (this.ended || !started) {
      action();
      return;
    }
    const wasLocked = this.board.locked;
    this.board.locked = true;
    const modal = showModal(this, { title: 'Leave Level?', color: 'red', width: 320, height: 250 });
    const { panel, top } = modal;
    panel.add(this.add.image(0, top + 40, 'ui-heart-empty').setDisplaySize(50, 50));
    panel.add(this.add.text(0, top + 84, 'You will lose a life.', textStyle(17, '#9a6b3c')).setOrigin(0.5));
    panel.add(makeButton(this, {
      x: -70, y: top + 136, width: 124, height: 48, label: 'Leave', color: 'red', fontSize: 20,
      onClick: () => {
        this.giveUp();
        action();
      },
    }));
    panel.add(makeButton(this, {
      x: 70, y: top + 136, width: 124, height: 48, label: 'Stay', color: 'green', fontSize: 20,
      onClick: () => {
        modal.close();
        this.board.locked = wasLocked;
      },
    }));
  }

  // ---------------------------------------------------------------- celebration

  /** Confetti, then leftover moves become line blooms that all go off (the bonus round). */
  async celebrate() {
    this.showConfetti();
    const wait = (ms) => new Promise((resolve) => this.time.delayedCall(ms, resolve));
    this.showGoalsDone();
    await wait(1500);
    const bonus = Math.min(this.movesLeft, 12);
    if (bonus > 0) {
      this.showBanner('Bonus Bloom!');
      await wait(500);
      await this.board.bonusRound(bonus, (pos) => this.bonusSpark(pos));
    }
    await wait(300);
  }

  /** Big "All Goals Complete!" burst the moment the level is won. */
  showGoalsDone() {
    const { x, y } = this.boardCenter();
    const layer = this.add.container(x, y).setDepth(90);
    const star = this.add.image(0, -78, bigStarTexture(this, 256, true)).setScale(0);
    const text = this.add.text(0, 44, 'All Goals\nComplete!', titleStyle(Math.min(54, this.scale.width * 0.11), '#2c861b', { align: 'center' }))
      .setOrigin(0.5).setScale(0.3).setAlpha(0);
    layer.add([star, text]);
    playSfx(this, 'special');
    this.tweens.add({ targets: star, scale: 0.34, angle: { from: -90, to: 0 }, duration: 420, ease: 'Back.easeOut' });
    this.tweens.add({ targets: text, scale: 1, alpha: 1, duration: 360, delay: 120, ease: 'Back.easeOut' });
    this.tweens.add({ targets: layer, alpha: 0, y: y - 40, duration: 320, delay: 1250, onComplete: () => layer.destroy() });
  }

  /** A spark flies from the moves bubble to the bloom it turns into a line bloom. */
  bonusSpark(pos) {
    this.movesLeft = Math.max(0, this.movesLeft - 1);
    this.movesText.setText(`${this.movesLeft}`);
    const m = this.movesBubble.getWorldTransformMatrix();
    const spark = this.add.image(m.tx, m.ty, 'fx-star6').setDisplaySize(60, 60).setTint(0xfff3b0).setDepth(60);
    this.tweens.add({
      targets: spark, x: pos.x, y: pos.y, angle: 180, duration: 260, ease: 'Quad.easeIn', onComplete: () => spark.destroy(),
    });
  }

  showConfetti() {
    const { width: W } = this.scale;
    const confetti = this.add.particles(0, -20, 'fx-petal', {
      x: { min: 0, max: W },
      lifespan: 3400,
      speedY: { min: 120, max: 280 },
      speedX: { min: -70, max: 70 },
      rotate: { start: 0, end: 540 },
      scale: { min: 0.8, max: 1.5 },
      tint: [0xff5ea8, 0xffd166, 0x58d68d, 0x53b9ff, 0xc77dff, 0xffffff],
      gravityY: 50,
      frequency: 20,
      quantity: 2,
    }).setDepth(90);
    this.time.delayedCall(1800, () => confetti.stop());
    this.time.delayedCall(5500, () => confetti.destroy());
  }

  // ---------------------------------------------------------------- new obstacle cards

  /** Obstacles in this level the player hasn't been introduced to yet. */
  newFeatures() {
    const counts = countLayout(this.level.layout);
    if (this.level.objective.seed) counts.seed = this.level.objective.seed;
    return Object.keys(FEATURES).filter((f) => counts[f] > 0 && !Seen.has(f));
  }

  showFeatureCard(features, onDone) {
    const rowH = 132;
    const modal = showModal(this, { title: 'New!', color: 'green', width: 380, height: 150 + features.length * rowH });
    const { panel, top, width } = modal;
    features.forEach((f, i) => {
      const info = FEATURES[f];
      const y = top + 14 + i * rowH + rowH / 2;
      panel.add(this.add.image(0, y, insetTexture(this, width - 50, rowH - 12)));
      const icon = this.add.image(-width / 2 + 74, y, info.icon).setDisplaySize(78, 78);
      panel.add(icon);
      this.tweens.add({ targets: icon, scale: icon.scale * 1.08, angle: { from: -4, to: 4 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const tx = -width / 2 + 128;
      panel.add(this.add.text(tx, y - 34, info.name, textStyle(23, COLORS.title, { stroke: '#ffffff', strokeThickness: 4 })).setOrigin(0, 0.5));
      panel.add(this.add.text(tx, y + 12, info.text, textStyle(15, COLORS.text, { wordWrap: { width: width - 170 } })).setOrigin(0, 0.5));
    });
    panel.add(makeButton(this, {
      x: 0, y: modal.height / 2 - 52, width: 200, height: 58, label: 'Got it!', color: 'green', fontSize: 25,
      onClick: () => {
        Seen.mark(features);
        modal.close();
        onDone();
      },
    }));
    playSfx(this, 'sparkle');
  }

  /** "New booster!" card: Bea presents a newly unlocked booster and gives one to try. */
  showUnlockCard(kinds, onDone) {
    const kind = kinds[0];
    const b = BOOSTERS[kind];
    const modal = showModal(this, { title: 'New Booster!', color: 'blue', width: 340, height: 360, depth: 120 });
    const { panel, top } = modal;
    const glow = this.add.image(30, top + 70, 'fx-glow').setDisplaySize(170, 170).setTint(0xfff3b0).setAlpha(0.8);
    this.tweens.add({ targets: glow, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
    const icon = this.add.image(30, top + 70, boosterIcon(kind)).setDisplaySize(84, 84);
    const iconScale = icon.scale;
    icon.setScale(0);
    this.tweens.add({ targets: icon, scale: iconScale, duration: 480, delay: 200, ease: 'Back.easeOut' });
    const bea = addMascot(this, -96, top + 92, 92);
    const name = this.add.text(0, top + 150, b.name, titleStyle(28, '#1a5bb0')).setOrigin(0.5);
    const help = this.add.text(0, top + 190, `${b.help}.`, textStyle(16, '#9a6b3c', { align: 'center', wordWrap: { width: 280 } })).setOrigin(0.5);
    const gift = this.add.text(0, top + 222, 'Here\u2019s one free to try!', textStyle(15, '#2f9e57')).setOrigin(0.5);
    const ok = makeButton(this, {
      x: 0, y: top + 280, width: 200, height: 58, label: 'Got it!', color: 'green', fontSize: 24,
      onClick: () => {
        kinds.forEach((k) => Inventory.add(k, 1));
        Unlocks.markIntroduced(kinds);
        Object.entries(this.boosterButtons).forEach(([k, btn]) => btn.setCount(Inventory.count(k)));
        playSfx(this, 'sparkle');
        modal.close();
        if (kinds.length > 1) this.showUnlockCard(kinds.slice(1), onDone);
        else onDone();
      },
    });
    panel.add([glow, icon, bea, name, help, gift, ok]);
    playSfx(this, 'special');
  }

  // ---------------------------------------------------------------- tutorial

  /** First time on the early levels: a hand shows a valid swipe until the player touches the board. */
  maybeShowTutorial() {
    if (this.levelIndex > 2 || Progress.starsFor(this.levelIndex) > 0 || this.ended) return;
    this.time.delayedCall(this.level.tip ? 1500 : 400, () => {
      const move = this.board.findPossibleMove();
      if (!move || this.board.busy) return;
      const [a, b] = move.map((t) => {
        const p = this.board.cellPos(t.r, t.c);
        return this.board.toWorld(p.x, p.y);
      });
      const size = this.board.scaleFactor * 64;
      const { width: W, height: H } = this.scale;

      // Spotlight: dim everything except the two blooms to swap.
      const shade = this.add.renderTexture(0, 0, W, H).setOrigin(0).setDepth(34).setAlpha(0);
      shade.fill(0x1a0f05, 0.62);
      const hole = this.make.graphics({}, false);
      const x0 = Math.min(a.x, b.x) - size / 2 - 6;
      const y0 = Math.min(a.y, b.y) - size / 2 - 6;
      hole.fillStyle(0xffffff, 1).fillRoundedRect(x0, y0, Math.abs(a.x - b.x) + size + 12, Math.abs(a.y - b.y) + size + 12, 16);
      shade.erase(hole);
      hole.destroy();
      this.tweens.add({ targets: shade, alpha: 1, duration: 300 });

      const glowA = this.add.image(a.x, a.y, 'fx-glow').setDisplaySize(size * 1.6, size * 1.6).setTint(0xfff3b0).setDepth(35);
      const glowB = this.add.image(b.x, b.y, 'fx-glow').setDisplaySize(size * 1.6, size * 1.6).setTint(0xfff3b0).setDepth(35);
      const hand = this.add.image(a.x + 12, a.y + 18, 'ui-hand').setOrigin(0.3, 0.05).setDisplaySize(56, 56).setDepth(40);
      const loop = this.tweens.chain({
        targets: hand,
        loop: -1,
        tweens: [
          { x: a.x + 12, y: a.y + 18, alpha: 1, duration: 10 },
          { scale: hand.scale * 0.9, duration: 200 },
          { x: b.x + 12, y: b.y + 18, duration: 600, ease: 'Sine.easeInOut' },
          { scale: hand.scale, alpha: 0, duration: 300, delay: 200 },
        ],
      });
      [glowA, glowB].forEach((g) => this.tweens.add({ targets: g, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 }));

      // Bea explains from the half of the board away from the move.
      const r = this.boardRect;
      const pairUp = (a.y + b.y) / 2 < r.y + r.height / 2;
      const beaSize = Math.min(120, r.width * 0.26);
      const beaX = r.x + beaSize * 0.7;
      const beaY = pairUp ? r.y + r.height - beaSize * 0.6 : r.y + beaSize * 0.6;
      const bea = addMascot(this, beaX, beaY, beaSize).setDepth(41);
      const beaScale = bea.scale;
      bea.setScale(0);
      this.tweens.add({ targets: bea, scale: beaScale, duration: 380, ease: 'Back.easeOut' });
      const [title, body] = TUTORIAL_STEPS[this.levelIndex];
      const caption = showTooltip(this, beaX + beaSize * 0.9, pairUp ? beaY - beaSize * 0.45 : beaY + beaSize * 0.45, title, body, { duration: 0, depth: 45, below: !pairUp });
      this.input.once('pointerdown', () => {
        loop.stop();
        caption.close();
        this.tweens.add({ targets: [shade, bea], alpha: 0, duration: 220, onComplete: () => { shade.destroy(); bea.destroy(); } });
        [hand, glowA, glowB].forEach((o) => o.destroy());
      });
    });
  }

  // ---------------------------------------------------------------- overlays

  boardCenter() {
    const r = this.boardRect;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }

  showIntro() {
    const { x, y } = this.boardCenter();
    const banner = this.add.container(x, y).setDepth(60);
    const goals = Object.entries(this.remaining);
    const diff = DIFFICULTY[this.level.difficulty];
    const gifts = this.streakGifts.length;
    const w = Math.min(this.boardRect.width * 0.94, 380);
    const tipText = this.level.tip
      ? this.add.text(0, 0, this.level.tip, textStyle(15, COLORS.text, { wordWrap: { width: w - 60 }, align: 'center' })).setOrigin(0.5)
      : null;
    const h = 118 + 78 + (tipText ? tipText.height + 16 : 0) + (diff ? 26 : 0) + (gifts ? 28 : 0);
    const bg = this.add.image(0, 0, panelTexture(this, w, h));
    banner.add(bg);
    let cy = -h / 2 + 40;
    const title = this.add.text(0, cy, `Level ${this.level.id}`, textStyle(34, diff?.color ?? COLORS.title, { stroke: '#ffffff', strokeThickness: 6 })).setOrigin(0.5);
    cy += 36;
    const sub = this.add.text(0, cy, this.level.name, textStyle(19, COLORS.soft)).setOrigin(0.5);
    banner.add([title, sub]);
    if (diff) {
      cy += 28;
      const tag = this.add.text(0, cy, diff.label, titleStyle(18, diff.color)).setOrigin(0.5);
      banner.add(tag);
      this.tweens.add({ targets: tag, scale: 1.12, duration: 380, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
    }
    // Goals pop in one by one.
    cy += 52;
    const spacing = Math.min(78, (w - 50) / goals.length);
    goals.forEach(([type, count], i) => {
      const item = this.add.container((i - (goals.length - 1) / 2) * spacing, cy);
      item.add([this.add.image(0, 0, goalIconKey(type)).setDisplaySize(50, 50), makeCountBadge(this, 20, 18, count, 28)]);
      item.setScale(0);
      this.tweens.add({ targets: item, scale: 1, duration: 300, delay: 260 + i * 140, ease: 'Back.easeOut' });
      banner.add(item);
    });
    cy += 42;
    if (gifts) {
      cy += 4;
      banner.add(this.add.text(0, cy, `Win streak x${Streak.count()}: free special${gifts > 1 ? 's' : ''}!`, textStyle(16, '#e0731a')).setOrigin(0.5));
      cy += 24;
    }
    if (tipText) {
      tipText.setY(cy + tipText.height / 2 + 4);
      banner.add(tipText);
    }
    banner.setScale(0.6).setAlpha(0);
    this.tweens.chain({
      targets: banner,
      tweens: [
        { scale: 1, alpha: 1, duration: 320, ease: 'Back.easeOut' },
        { scale: 0.9, alpha: 0, duration: 260, delay: (this.level.tip ? 2400 : 1500) + goals.length * 140, ease: 'Quad.easeIn' },
      ],
      onComplete: () => banner.destroy(),
    });
  }

  showCombo(chain) {
    const word = COMBO_WORDS[Math.min(chain, COMBO_WORDS.length - 1)];
    if (!word) return;
    const { x, y } = this.boardCenter();
    const text = this.add.text(x, y, word, titleStyle(52, '#d63c84'))
      .setOrigin(0.5).setDepth(55).setScale(0.3).setAngle(Phaser.Math.Between(-8, 8));
    this.tweens.chain({
      targets: text,
      tweens: [
        { scale: 1.1, duration: 220, ease: 'Back.easeOut' },
        { y: y - 60, alpha: 0, duration: 420, delay: 380, ease: 'Quad.easeIn' },
      ],
      onComplete: () => text.destroy(),
    });
  }

  showBanner(message) {
    const { x, y } = this.boardCenter();
    const text = this.add.text(x, y, message, titleStyle(28, '#7a4a1e', { align: 'center', wordWrap: { width: Math.max(220, this.boardRect.width - 30) } }))
      .setOrigin(0.5).setDepth(55).setAlpha(0);
    this.tweens.chain({
      targets: text,
      tweens: [
        { alpha: 1, duration: 200 },
        { alpha: 0, duration: 300, delay: 900 },
      ],
      onComplete: () => text.destroy(),
    });
  }

  /** Dark overlay, spinning light rays, a big jelly star and "Victory!"; resolves on Continue. */
  showVictory() {
    return new Promise((resolve) => {
      const { width: W, height: H } = this.scale;
      const layer = this.add.container(0, 0).setDepth(95);
      const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x0c1f0c, 0).setInteractive();
      const size = Math.min(W, H) * 1.1;
      const rays = this.add.image(W / 2, H / 2, raysTexture(this, 512)).setDisplaySize(size, size).setAlpha(0);
      const star = this.add.image(W / 2, H / 2, bigStarTexture(this, 256, true)).setScale(0);
      const starHalf = Math.min(W, H) * 0.21;
      const title = this.add.text(W / 2, Math.max(50, H / 2 - starHalf - 46), 'Victory!', titleStyle(Math.min(76, W * 0.15), '#2b5a1e'))
        .setOrigin(0.5).setScale(0.3).setAlpha(0);
      layer.add([overlay, rays, star, title]);
      // Bea cheers next to the star.
      const beaSize = Math.min(150, Math.min(W, H) * 0.24);
      const bea = addMascot(this, W / 2 - starHalf - beaSize * 0.2, H / 2 + starHalf * 0.55, beaSize);
      const beaScale = bea.scale;
      bea.setScale(0);
      layer.add(bea);
      this.tweens.add({ targets: bea, scale: beaScale, duration: 420, delay: 500, ease: 'Back.easeOut' });

      this.tweens.add({ targets: overlay, fillAlpha: 0.6, duration: 300 });
      this.tweens.add({ targets: rays, alpha: 0.9, duration: 500 });
      this.tweens.add({ targets: rays, angle: 360, duration: 14000, repeat: -1 });
      const starScale = Math.min(W, H) * 0.42 / 256;
      this.tweens.add({ targets: star, scale: starScale, angle: { from: -60, to: 0 }, duration: 600, delay: 150, ease: 'Back.easeOut' });
      this.tweens.add({ targets: star, scale: starScale * 1.06, duration: 900, delay: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 420, delay: 300, ease: 'Back.easeOut' });
      this.time.delayedCall(300, () => {
        const sparkle = this.add.particles(W / 2, H / 2, 'fx-star6', {
          lifespan: 900, speed: { min: 120, max: 360 }, scale: { start: 0.5, end: 0 }, alpha: { start: 1, end: 0 },
          tint: [0xffffff, 0xfff3b0, 0xffe08a], emitting: false,
        });
        layer.add(sparkle);
        sparkle.explode(30);
      });

      const cont = makeButton(this, {
        x: W / 2, y: Math.min(H - 50, H / 2 + starHalf + 56), width: 230, height: 66, label: 'Continue', color: 'blue', fontSize: 28,
        onClick: () => {
          cont.disableInteractive();
          this.tweens.add({ targets: layer.list, alpha: 0, duration: 250, onComplete: () => layer.destroy() });
          this.tweens.add({ targets: cont, alpha: 0, duration: 250, onComplete: () => cont.destroy() });
          resolve();
        },
      });
      cont.setDepth(96).setAlpha(0);
      this.tweens.add({ targets: cont, alpha: 1, duration: 300, delay: 1000 });
    });
  }

  /** Results / out-of-moves popup on the wooden panel. */
  showPopup({ title, subtitle, stars, buttons: allButtons, rewards = [], missing = [] }) {
    // Ad buttons only take a row when an ad can actually be shown.
    const buttons = allButtons.filter((b) => !b.ad || Ads.canShow(b.ad));
    const height = 150 + (stars !== null ? 96 : 0) + (rewards.length ? 58 : 0) + (missing.length ? 96 : 0) + buttons.length * 64;
    const modal = showModal(this, { title, color: stars !== null ? 'yellow' : 'red', width: 370, height });
    const { panel, top, width: panelW } = modal;
    let y = top + 10;

    if (stars !== null) {
      [-1, 0, 1].forEach((offset, i) => {
        const size = i === 1 ? 84 : 66;
        const sx = offset * 82;
        const sy = y + 40 - (i === 1 ? 12 : 0);
        panel.add(this.add.image(sx, sy, bigStarTexture(this, 128, false)).setDisplaySize(size, size).setAlpha(0.6));
        if (i < stars) {
          const gold = this.add.image(sx, sy, bigStarTexture(this, 128, true)).setDisplaySize(size, size);
          const full = gold.scale;
          gold.setScale(0);
          const glow = this.add.image(sx, sy, 'fx-star6').setDisplaySize(size * 2.4, size * 2.4).setAlpha(0).setTint(0xfff3b0);
          panel.add([glow, gold]);
          this.tweens.add({
            targets: gold, scale: full, angle: { from: -40, to: 0 }, duration: 360, delay: 450 + i * 280, ease: 'Back.easeOut',
            onStart: () => playSfx(this, 'star', { step: i }),
          });
          this.tweens.add({ targets: glow, alpha: { from: 1, to: 0 }, scale: glow.scale * 1.4, duration: 600, delay: 500 + i * 280 });
        }
      });
      y += 96;
    }

    if (missing.length) {
      const insetW = panelW - 70;
      panel.add(this.add.image(0, y + 42, insetTexture(this, insetW, 84)));
      const spacing = Math.min(80, (insetW - 20) / missing.length);
      missing.forEach(([type, count], i) => {
        const x = (i - (missing.length - 1) / 2) * spacing;
        panel.add(this.add.image(x, y + 38, goalIconKey(type)).setDisplaySize(46, 46));
        panel.add(makeCountBadge(this, x + 18, y + 56, count, 28));
      });
      y += 96;
    }

    const sub = this.add.text(0, y + 12, subtitle, textStyle(stars !== null ? 22 : 15, COLORS.text, { wordWrap: { width: panelW - 60 }, align: 'center' })).setOrigin(0.5);
    panel.add(sub);
    y += 40;

    if (rewards.length) {
      const chipW = 104;
      rewards.forEach((rw, i) => {
        const chip = this.add.container((i - (rewards.length - 1) / 2) * (chipW + 12), y + 18);
        const bg = this.add.image(0, 0, insetTexture(this, chipW, 44));
        const icon = this.add.image(-chipW / 2 + 24, 0, rw.icon).setDisplaySize(36, 36);
        const label = this.add.text(-chipW / 2 + 48, 0, rw.text, textStyle(21, '#b8740b')).setOrigin(0, 0.5);
        chip.add([bg, icon, label]).setScale(0);
        // Let callers update the chip later (e.g. "Double Coins").
        rw.chip = chip;
        rw.labelText = label;
        panel.add(chip);
        this.tweens.add({
          targets: chip, scale: 1, duration: 320, delay: 1400 + i * 200, ease: 'Back.easeOut',
          onStart: () => playSfx(this, rw.coins ? 'coin' : 'sparkle'),
        });
      });
      y += 58;
    }

    y += 22;
    buttons.forEach((b, i) => {
      const spec = {
        x: 0, y: y + i * 64, width: Math.min(260, panelW - 80), height: 54, label: b.label, fontSize: 23,
      };
      const button = b.ad
        ? makeAdButton(this, { ...spec, placement: b.ad, onReward: (btn) => b.onClick(modal.close, btn) })
        : makeButton(this, { ...spec, color: b.color ?? 'green', onClick: () => b.onClick(modal.close) });
      if (button) panel.add(button);
    });
  }
}
