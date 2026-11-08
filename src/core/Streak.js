const STORAGE_KEY = 'bloomora.streak.v1';

/** Win streak: each win in a row (up to 3) starts the next level with more free specials. */
export const STREAK_GIFTS = [[], ['line'], ['line', 'bomb'], ['line', 'bomb', 'rainbow']];
export const STREAK_MAX = STREAK_GIFTS.length - 1;

let state = null;

function load() {
  if (state) return state;
  try {
    state = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    state = null;
  }
  if (!state || typeof state.wins !== 'number') state = { wins: 0 };
  return state;
}

function save() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Not persisted.
  }
}

export const Streak = {
  STORAGE_KEY,

  count() {
    return load().wins;
  },

  /** Specials the next level starts with. */
  gifts() {
    return STREAK_GIFTS[Math.min(load().wins, STREAK_MAX)];
  },

  win() {
    load().wins = Math.min(STREAK_MAX, load().wins + 1);
    save();
  },

  /** Giving up on a level (losing a life) breaks the streak. */
  lose() {
    load().wins = 0;
    save();
  },
};
