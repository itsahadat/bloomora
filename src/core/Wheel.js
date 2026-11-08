import { dayNumber } from './Daily.js';

const STORAGE_KEY = 'bloomora.wheel.v1';

/** Coins for each spin after the day's free one. */
export const SPIN_PRICE = 100;

/**
 * The eight wheel segments, clockwise from the top.
 * `weight` is the relative chance of landing there.
 */
export const WHEEL_PRIZES = [
  { coins: 30, weight: 22 },
  { booster: 'trowel', weight: 12 },
  { coins: 60, weight: 16 },
  { booster: 'breeze', weight: 12 },
  { coins: 120, weight: 9 },
  { booster: 'swap', weight: 12 },
  { coins: 300, weight: 3, jackpot: true },
  { booster: 'rainbow', weight: 6 },
];

let state = null;

function load() {
  if (state) return state;
  try {
    state = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    state = null;
  }
  if (!state || typeof state.lastFree !== 'number') state = { lastFree: -1 };
  return state;
}

function save() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Not persisted.
  }
}

/** Lucky Flower Wheel: one free spin per day, more for coins. */
export const Wheel = {
  STORAGE_KEY,

  hasFreeSpin() {
    return load().lastFree !== dayNumber();
  },

  useFreeSpin() {
    load().lastFree = dayNumber();
    save();
  },

  /** Pick a segment index by weight. */
  roll() {
    const total = WHEEL_PRIZES.reduce((sum, p) => sum + p.weight, 0);
    let r = Math.random() * total;
    for (let i = 0; i < WHEEL_PRIZES.length; i += 1) {
      r -= WHEEL_PRIZES[i].weight;
      if (r < 0) return i;
    }
    return 0;
  },
};
