import { dayNumber } from './Daily.js';
import { setSilenced } from './Synth.js';
import { Platform } from './Platform.js';
import { Store } from './Storage.js';

/**
 * Rewarded ads, one layer for every platform.
 *
 * The game only ever asks `Ads.canShow(placement)` and `await Ads.rewarded(placement)`;
 * which ad network answers depends on the build target (VITE_TARGET):
 *  - Android app: AdMob (Google's test ads until real IDs are set).
 *  - CrazyGames build: the CrazyGames SDK (its test overlay on localhost).
 *  - Other dev builds, or any build opened with `?fakeads`: a test ad.
 *  - Anything else: no ads, so the ad buttons simply stay hidden.
 * Providers silence the game's sound themselves, only once the ad really starts.
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
    saved = JSON.parse(Store.get(STORAGE_KEY));
  } catch {
    saved = null;
  }
  // A new day starts every count from zero.
  state = saved && saved.day === dayNumber() && saved.used ? saved : { day: dayNumber(), used: {} };
  return state;
}

function save() {
  try {
    Store.set(STORAGE_KEY, JSON.stringify(state));
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
    setSilenced('ad', true);
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
      setSilenced('ad', false);
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

/**
 * CrazyGames rewarded video. Reward only on adFinished. When ads are switched off
 * (Basic Launch, kids mode) or blocked, every ad button hides for the rest of the session.
 */
const crazyAds = {
  name: 'crazygames',
  off: false,
  ready() {
    return !this.off && !!Platform.crazy;
  },
  rewarded() {
    return new Promise((resolve) => {
      let done = false;
      const end = (watched) => {
        if (done) return;
        done = true;
        setSilenced('ad', false);
        resolve(watched);
      };
      try {
        Platform.crazy.ad.requestAd('rewarded', {
          adStarted: () => setSilenced('ad', true),
          adFinished: () => end(true),
          adError: (error) => {
            const code = error?.code;
            if (code === 'adsDisabled' || code === 'adblock') crazyAds.off = true;
            end(false);
          },
        });
      } catch {
        end(false);
      }
    });
  },
};

/**
 * AdMob rewarded video for the Android app. Until real IDs are set (VITE_ADMOB_REWARDED_ID
 * at build time), Google's public test ad unit is used: it always serves a "Test Ad".
 * One ad is kept loaded in the background so the button can show it at once.
 */
const ADMOB_REWARDED_ID = import.meta.env.VITE_ADMOB_REWARDED_ID || 'ca-app-pub-3940256099942544/5224354917';

const admobAds = {
  name: 'admob',
  mod: null,
  loaded: false,
  loading: false,

  async init() {
    const mod = await import('@capacitor-community/admob');
    this.mod = mod;
    await mod.AdMob.initialize({});
    // EU/UK players must be asked for consent (Google's own form) before ads load.
    try {
      const info = await mod.AdMob.requestConsentInfo();
      if (info.status === mod.AdmobConsentStatus.REQUIRED && info.isConsentFormAvailable) {
        await mod.AdMob.showConsentForm();
      }
    } catch {
      // Consent form not set up in AdMob yet: ads still load (non-personalised where required).
    }
    this.load();
  },

  async load() {
    if (!this.mod || this.loading || this.loaded) return;
    this.loading = true;
    try {
      await this.mod.AdMob.prepareRewardVideoAd({ adId: ADMOB_REWARDED_ID });
      this.loaded = true;
    } catch {
      // No fill or offline: try again in a while.
      setTimeout(() => this.load(), 30000);
    } finally {
      this.loading = false;
    }
  },

  ready() {
    return this.loaded;
  },

  rewarded() {
    const { AdMob, RewardAdPluginEvents } = this.mod;
    return new Promise((resolve) => {
      let earned = false;
      let done = false;
      const handles = [];
      const finish = (watched) => {
        if (done) return;
        done = true;
        handles.forEach((h) => h.then((x) => x.remove()).catch(() => {}));
        setSilenced('ad', false);
        this.loaded = false;
        this.load();
        resolve(watched);
      };
      // The reward only counts once the player closes the ad after earning it.
      handles.push(AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { earned = true; }));
      handles.push(AdMob.addListener(RewardAdPluginEvents.Dismissed, () => finish(earned)));
      handles.push(AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => finish(false)));
      setSilenced('ad', true);
      AdMob.showRewardVideoAd().then(() => { earned = true; }).catch(() => finish(false));
    });
  },
};

/** Start the ad network for this build (the Android app's AdMob); others need nothing. */
export function initAds() {
  if (Platform.target !== 'android') return;
  admobAds.init().catch((err) => console.warn('[Ads] AdMob unavailable', err));
}

// H5 Games Ads (own site) plugs in here later.
function provider() {
  if (Platform.target === 'android') return admobAds;
  if (Platform.target === 'crazygames' && Platform.crazy) return crazyAds;
  const forceFake = new URLSearchParams(window.location.search).has('fakeads');
  if (import.meta.env.DEV || forceFake) return fakeAds;
  return noAds;
}

let busy = false;

export const Ads = {
  STORAGE_KEY,

  /** Ads left today for this placement. */
  left(placement) {
    const cap = AD_PLACEMENTS[placement]?.cap ?? 0;
    return Math.max(0, cap - (load().used[placement] ?? 0));
  },

  /**
   * True when this placement is done for now: today's ads are used up, or ads are off for
   * good this session (CrazyGames Basic Launch, ad blocker). A network that is merely still
   * loading its next ad doesn't count.
   */
  exhausted(placement) {
    return this.left(placement) <= 0 || provider().off === true || provider() === noAds;
  },

  /** True when an ad button for this placement should be shown. */
  canShow(placement) {
    return !busy && provider().ready() && this.left(placement) > 0;
  },

  /**
   * Show a rewarded ad. Resolves true only when the player watched it to the end;
   * only then should the reward be given.
   */
  async rewarded(placement) {
    if (!this.canShow(placement)) return false;
    busy = true;
    try {
      const watched = await provider().rewarded(placement);
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
