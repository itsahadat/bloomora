import { dayNumber } from './Daily.js';
import { audioContext } from './Synth.js';

/**
 * Rewarded ads, one layer for every platform.
 *
 * The game only ever asks `Ads.canShow(placement)` and `await Ads.rewarded(placement)`;
 * which ad network answers depends on the build target (VITE_TARGET). Until a real
 * network is wired in, dev builds (or any build opened with `?fakeads`) use a test ad,
 * and other builds report "no ads", so the ad buttons simply stay hidden.
 */

const STORAGE_KEY = 'bloomora.ads.v1';

/** Where rewarded ads appear, and how many times a day each one can be watched. */
export const AD_PLACEMENTS = {
  moves: { cap: 3 }, // Out of Moves: +3 moves
  life: { cap: 5 }, // Out of Lives: +1 life
  spin: { cap: 3 }, // Lucky Wheel: an extra spin
  coins: { cap: 5 }, // Coin Packs: free coins
  double: { cap: 5 }, // Level won: double the coins
};

/** Coins given by the "free coins" ad. */
export const AD_COINS = 50;

// ---------------------------------------------------------------- daily caps

let state = null;

function load() {
  if (state && state.day === dayNumber()) return state;
  let saved = null;
  try {
    saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    saved = null;
  }
  // A new day starts every count from zero.
  state = saved && saved.day === dayNumber() && saved.used ? saved : { day: dayNumber(), used: {} };
  return state;
}

function save() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Not persisted; caps still hold for this session.
  }
}

// ---------------------------------------------------------------- providers

/** No ad network: every ad button stays hidden. */
const noAds = {
  name: 'none',
  ready: () => false,
  rewarded: async () => false,
};

/**
 * Test ad for development: a full-screen overlay with a short countdown, plus a
 * "Close" button to test what happens when a player quits an ad early.
 */
const fakeAds = {
  name: 'fake',
  ready: () => true,
  rewarded: () => new Promise((resolve) => {
    const SECONDS = 3;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(10,20,10,0.92);display:flex;'
      + 'flex-direction:column;align-items:center;justify-content:center;gap:18px;color:#fff;'
      + 'font:600 20px Fredoka, sans-serif;text-align:center;user-select:none;';
    const tag = document.createElement('div');
    tag.textContent = 'TEST AD';
    tag.style.cssText = 'padding:4px 12px;border-radius:8px;background:#f0a91c;color:#4a2a00;font-size:14px;letter-spacing:2px;';
    const text = document.createElement('div');
    const close = document.createElement('button');
    close.textContent = 'Close (no reward)';
    close.style.cssText = 'margin-top:12px;padding:10px 18px;border:0;border-radius:12px;background:#555;color:#fff;font:inherit;font-size:15px;cursor:pointer;';
    overlay.append(tag, text, close);
    document.body.append(overlay);

    let left = SECONDS;
    const finish = (watched) => {
      clearInterval(timer);
      overlay.remove();
      resolve(watched);
    };
    const tick = () => {
      if (left <= 0) {
        finish(true);
        return;
      }
      text.textContent = `Your reward in ${left}…`;
      left -= 1;
    };
    const timer = setInterval(tick, 1000);
    tick();
    close.addEventListener('click', () => finish(false));
  }),
};

function pickProvider() {
  const forceFake = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('fakeads');
  if (import.meta.env.DEV || forceFake) return fakeAds;
  // Real networks (CrazyGames SDK, H5 Games Ads, AdMob) plug in here per VITE_TARGET.
  return noAds;
}

const provider = pickProvider();
let busy = false;

/** Pause all game sound while an ad plays. */
async function withSoundPaused(run) {
  const ctx = audioContext();
  const wasRunning = ctx?.state === 'running';
  if (wasRunning) await ctx.suspend().catch(() => {});
  try {
    return await run();
  } finally {
    if (wasRunning) await ctx.resume().catch(() => {});
  }
}

export const Ads = {
  STORAGE_KEY,

  /** Ads left today for this placement. */
  left(placement) {
    const cap = AD_PLACEMENTS[placement]?.cap ?? 0;
    return Math.max(0, cap - (load().used[placement] ?? 0));
  },

  /** True when an ad button for this placement should be shown. */
  canShow(placement) {
    return !busy && provider.ready() && this.left(placement) > 0;
  },

  /**
   * Show a rewarded ad. Resolves true only when the player watched it to the end;
   * only then should the reward be given.
   */
  async rewarded(placement) {
    if (!this.canShow(placement)) return false;
    busy = true;
    try {
      const watched = await withSoundPaused(() => provider.rewarded(placement));
      if (watched) {
        const s = load();
        s.used[placement] = (s.used[placement] ?? 0) + 1;
        save();
      }
      return watched;
    } catch {
      return false;
    } finally {
      busy = false;
    }
  },
};
