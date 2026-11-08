import { Store } from './Storage.js';

const STORAGE_KEY = 'bloomora.progress.v1';

function defaults() {
  return { unlocked: 0, stars: {}, celebrated: [] };
}

let cache = null;

function load() {
  if (cache) return cache;
  try {
    const raw = Store.get(STORAGE_KEY);
    cache = raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
  } catch {
    cache = defaults();
  }
  return cache;
}

function save() {
  try {
    Store.set(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Storage may be unavailable (private mode); progress then lasts for this session only.
  }
}

export const Progress = {
  /** Index of the furthest level the player can play. */
  currentLevelIndex(levelCount) {
    return Math.min(load().unlocked, levelCount - 1);
  },

  starsFor(index) {
    return load().stars[index] ?? 0;
  },

  /** Record a win. Returns true when it's a first clear or a better star score (worth a reward). */
  complete(index, stars) {
    const data = load();
    const before = data.stars[index] ?? 0;
    data.stars[index] = Math.max(before, stars);
    data.unlocked = Math.max(data.unlocked, index + 1);
    save();
    return stars > before;
  },

  /** Garden (zone) completion celebrations already shown. */
  isCelebrated(zone) {
    return (load().celebrated ?? []).includes(zone);
  },

  markCelebrated(zone) {
    const data = load();
    data.celebrated = [...new Set([...(data.celebrated ?? []), zone])];
    save();
  },
};
