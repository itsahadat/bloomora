const STORAGE_KEY = 'bloomora.coins.v1';
const START_COINS = 200;

let coins = null;
const listeners = new Set();

function load() {
  if (coins !== null) return coins;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    coins = raw === null ? START_COINS : Math.max(0, Number(raw) || 0);
  } catch {
    coins = START_COINS;
  }
  return coins;
}

function save() {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(coins));
  } catch {
    // Not persisted; coins still work for this session.
  }
  listeners.forEach((fn) => fn(coins));
}

/** Coins earned by winning, spent in the shop. */
export const Wallet = {
  STORAGE_KEY,

  count() {
    return load();
  },

  add(amount) {
    coins = load() + amount;
    save();
  },

  /** Spend coins; returns false (and spends nothing) if there aren't enough. */
  spend(amount) {
    if (load() < amount) return false;
    coins -= amount;
    save();
    return true;
  },

  /** Subscribe to changes; returns an unsubscribe function. */
  onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** Coins for a win: more stars and a first clear pay more. */
  winReward(stars, firstClear) {
    return 20 + stars * 15 + (firstClear ? 30 : 0);
  },
};
