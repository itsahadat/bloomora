import { Platform } from './Platform.js';
import { Store } from './Storage.js';
import { STORE_URL } from './Share.js';

/**
 * Play Store reviews (Android app only).
 * - Google's in-app review card is asked for after a few happy moments: the first clear of
 *   levels 5, 12 and 25. Google decides whether it actually appears (it limits how often),
 *   and the game never knows whether a review was left, so it never asks twice for the same level.
 * - Settings has a "Rate Bloomora" button that opens the store page directly.
 */

const KEY = 'bloomora.review.v1';
const MILESTONES = [4, 11, 24]; // level indexes (0-based)

function asked() {
  try {
    return JSON.parse(Store.get(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export const Review = {
  get available() {
    return Platform.target === 'android';
  },

  /** After a win: maybe show Google's review card (a moment later, once the results are up). */
  afterWin(levelIndex, firstClear) {
    if (!this.available || !firstClear || !MILESTONES.includes(levelIndex)) return;
    const done = asked();
    if (done.includes(levelIndex)) return;
    try {
      Store.set(KEY, JSON.stringify([...done, levelIndex]));
    } catch {
      // Saving failed; asking again later is harmless.
    }
    setTimeout(async () => {
      try {
        const { InAppReview } = await import('@capacitor-community/in-app-review');
        await InAppReview.requestReview();
      } catch (err) {
        console.warn('[Review] not available', err);
      }
    }, 2200);
  },

  /** Open Bloomora's Play Store page (the system hands it to the Play Store app). */
  openStore() {
    window.open(STORE_URL, '_blank');
  },
};
