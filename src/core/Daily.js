import { Store } from './Storage.js';

const STORAGE_KEY = 'bloomora.daily.v1';

/** A 7-day streak of gifts; the cycle starts over after day 7 or a missed day. */
export const DAILY_REWARDS = [
  { coins: 50 },
  { boosters: { trowel: 1 } },
  { coins: 100 },
  { boosters: { swap: 1, breeze: 1 } },
  { coins: 150 },
  { boosters: { burst: 1, rainbow: 1 } },
  { coins: 300, lives: true },
];

export const dayNumber = (date = new Date()) => Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / 86400000);

let state = null;

function load() {
  if (state) return state;
  try {
    state = JSON.parse(Store.get(STORAGE_KEY));
  } catch {
    state = null;
  }
  if (!state || typeof state.streak !== 'number') state = { lastDay: -1, streak: 0 };
  return state;
}

function save() {
  try {
    Store.set(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Not persisted.
  }
}

export const Daily = {
  STORAGE_KEY,

  canClaim() {
    return load().lastDay !== dayNumber();
  },

  /** Which day of the streak (0..6) the next claim is. */
  nextIndex() {
    const s = load();
    const continues = s.lastDay === dayNumber() - 1 || s.lastDay === dayNumber();
    return continues ? s.streak % DAILY_REWARDS.length : 0;
  },

  /** Mark today's gift as taken; returns the reward and its streak index. */
  claim() {
    const index = this.nextIndex();
    state.streak = index + 1;
    state.lastDay = dayNumber();
    save();
    return { index, reward: DAILY_REWARDS[index] };
  },
};
