import { audioContext, isRunning, SOUNDS } from './Synth.js';
import { startMusic, stopMusic, musicWanted } from './Music.js';
import { Store } from './Storage.js';

const MUTE_KEY = 'bloomora.muted';
const MUSIC_KEY = 'bloomora.music';

function readFlag(storageKey, fallback) {
  try {
    const v = Store.get(storageKey);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

function writeFlag(storageKey, value) {
  try {
    Store.set(storageKey, value ? '1' : '0');
  } catch {
    // Not persisted; the setting still applies for this session.
  }
}

let muted = null;
let musicOff = null;

export function isMuted() {
  if (muted === null) muted = readFlag(MUTE_KEY, false);
  return muted;
}

export function setMuted(value) {
  muted = value;
  writeFlag(MUTE_KEY, value);
}

export function isMusicMuted() {
  if (musicOff === null) musicOff = readFlag(MUSIC_KEY, false);
  return musicOff;
}

export function setMusicMuted(value) {
  musicOff = value;
  writeFlag(MUSIC_KEY, value);
  if (value) stopMusic();
  else startMusic();
}

/** True when both sound effects and music are off. */
export function isAllMuted() {
  return isMuted() && isMusicMuted();
}

/** One switch for everything (the speaker button). */
export function setAllMuted(value) {
  setMuted(value);
  setMusicMuted(value);
}

/** Start the background tune unless the player turned music off. */
export function playMusic() {
  if (!isMusicMuted()) startMusic();
}

/**
 * Play a synthesized sound effect.
 * config: { volume (multiplier, default 1), detune (cents), step (pitch step for pops/stars) }
 * The first argument (scene) is unused but kept so call sites read naturally.
 */
export function playSfx(_scene, key, config = {}) {
  if (isMuted() || !isRunning()) return;
  const sound = SOUNDS[key];
  if (!sound) return;
  const pitch = 2 ** ((config.detune ?? 0) / 1200);
  try {
    sound(pitch, config.volume ?? 1, config);
  } catch {
    // Never let audio break the game.
  }
}

// Browsers only allow audio after a user gesture: resume on the first tap / key press.
function unlock() {
  const ctx = audioContext();
  if (!ctx) return;
  const resumed = ctx.state === 'running' ? Promise.resolve() : ctx.resume();
  resumed.then(() => {
    if (musicWanted() && !isMusicMuted()) startMusic();
  }).catch(() => {});
}
['pointerdown', 'touchend', 'keydown'].forEach((type) => window.addEventListener(type, unlock, true));

// Pause all audio while the tab is hidden.
document.addEventListener('visibilitychange', () => {
  const ctx = audioContext();
  if (!ctx) return;
  if (document.hidden) ctx.suspend().catch(() => {});
  else unlock();
});
