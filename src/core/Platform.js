import { useStorageBackend } from './Storage.js';
import { setSilenced } from './Synth.js';

/**
 * The platform this build is for, set at build time with VITE_TARGET:
 * 'web' (own site / GitHub Pages, the default), 'itch' or 'crazygames'.
 * Platform hides each portal's SDK behind one small API, so game code just calls
 * Platform.gameplayStart() and friends and never checks where it is running.
 */
export const TARGET = import.meta.env.VITE_TARGET || 'web';

const CRAZY_SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

/** The live CrazyGames SDK, or null when not on CrazyGames (or it failed to load). */
let crazy = null;
let inGameplay = false;

function loadScript(src, timeoutMs) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    el.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    el.onerror = () => {
      clearTimeout(timer);
      reject(new Error('load failed'));
    };
    document.head.append(el);
  });
}

/** Run an SDK call without ever letting a platform error break the game. */
function safely(fn) {
  try {
    fn();
  } catch (err) {
    console.warn('[Platform]', err);
  }
}

async function initCrazyGames() {
  await loadScript(CRAZY_SDK_URL, 8000);
  const sdk = window.CrazyGames?.SDK;
  if (!sdk) return;
  await sdk.init();
  // 'local' on localhost (test mode), 'crazygames' on their site; 'disabled' anywhere else.
  if (sdk.environment !== 'local' && sdk.environment !== 'crazygames') return;
  crazy = sdk;
  // Saves follow the CrazyGames account (guests fall back to their local storage).
  useStorageBackend(sdk.data);
  // The site's own mute setting wins over the game's sound buttons.
  const applyMute = () => setSilenced('platform', !!sdk.game.settings?.muteAudio);
  applyMute();
  safely(() => sdk.game.addSettingsChangeListener(applyMute));
}

export const Platform = {
  target: TARGET,

  /** Call once before the game starts. Never throws; without an SDK the game still runs. */
  async init() {
    if (TARGET !== 'crazygames') return;
    try {
      await initCrazyGames();
    } catch (err) {
      console.warn('[Platform] CrazyGames SDK unavailable, running without it.', err);
      crazy = null;
    }
  },

  /** The CrazyGames SDK when it is live, for the ad provider. */
  get crazy() {
    return crazy;
  },

  /** True when saves go to a platform account and need a moment to be written. */
  get savesAreRemote() {
    return !!crazy;
  },

  loadingStart() {
    if (crazy) safely(() => crazy.game.loadingStart());
  },

  loadingStop() {
    if (crazy) safely(() => crazy.game.loadingStop());
  },

  /** The player is actively playing a level (start, resume, continue). */
  gameplayStart() {
    if (inGameplay) return;
    inGameplay = true;
    if (crazy) safely(() => crazy.game.gameplayStart());
  },

  /** Any break in play: pause, level end, leaving the level. */
  gameplayStop() {
    if (!inGameplay) return;
    inGameplay = false;
    if (crazy) safely(() => crazy.game.gameplayStop());
  },
};
