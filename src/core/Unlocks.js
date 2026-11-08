import { Progress } from './Progress.js';
import { Seen } from './Seen.js';

/** Level id at which each booster unlocks, so new players meet them one at a time. */
export const BOOSTER_UNLOCK = {
  trowel: 6, burst: 8, breeze: 10, moves: 11, rainbow: 12, swap: 14,
};

export const Unlocks = {
  /** Level id that unlocks `kind`, or null when it's already open for this player. */
  lockedUntil(kind, levelCount) {
    const need = BOOSTER_UNLOCK[kind];
    if (!need) return null;
    const furthestId = Progress.currentLevelIndex(levelCount) + 1;
    return furthestId >= need ? null : need;
  },

  /** Boosters that unlock on this level and haven't been introduced yet. */
  newOnLevel(levelId) {
    return Object.keys(BOOSTER_UNLOCK).filter((k) => BOOSTER_UNLOCK[k] === levelId && !Seen.has(`booster-${k}`));
  },

  markIntroduced(kinds) {
    Seen.mark(kinds.map((k) => `booster-${k}`));
  },
};
