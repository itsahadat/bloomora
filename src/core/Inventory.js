import { Store } from './Storage.js';

const STORAGE_KEY = 'bloomora.boosters.v1';
export const BOOSTER_STORAGE_KEY = STORAGE_KEY;

/** In-level boosters and pre-level boosters, with the starting amounts a new player gets. */
export const BOOSTERS = {
  trowel: { name: 'Trowel', help: 'Tap a tile to dig it up', inGame: true, start: 3, price: 120 },
  breeze: { name: 'Breeze', help: 'Shuffles the whole board', inGame: true, start: 2, price: 100 },
  swap: { name: 'Bee Swap', help: 'Swap any two blooms for free', inGame: true, start: 3, price: 120 },
  rainbow: { name: 'Rainbow Start', help: 'Start with a rainbow seed', inGame: false, start: 1, price: 200 },
  burst: { name: 'Burst Start', help: 'Start with a burst + line bloom', inGame: false, start: 2, price: 150 },
  moves: { name: '+3 Moves', help: 'Three extra moves', inGame: false, start: 2, price: 150 },
};

let counts = null;

function load() {
  if (counts) return counts;
  let saved = null;
  try {
    saved = JSON.parse(Store.get(STORAGE_KEY));
  } catch {
    saved = null;
  }
  counts = Object.fromEntries(Object.entries(BOOSTERS).map(([k, b]) => [k, saved?.[k] ?? b.start]));
  return counts;
}

function save() {
  try {
    Store.set(STORAGE_KEY, JSON.stringify(counts));
  } catch {
    // Not persisted; counts still work for this session.
  }
}

export const Inventory = {
  count(kind) {
    return load()[kind] ?? 0;
  },

  add(kind, amount = 1) {
    load()[kind] = (load()[kind] ?? 0) + amount;
    save();
  },

  /** Spend one; returns false if none are left. */
  use(kind) {
    if (this.count(kind) <= 0) return false;
    load()[kind] -= 1;
    save();
    return true;
  },

  /** A random booster to hand out as a reward. */
  randomReward() {
    const pool = ['trowel', 'trowel', 'breeze', 'swap', 'swap', 'rainbow', 'burst', 'burst', 'moves'];
    return pool[Math.floor(Math.random() * pool.length)];
  },
};
