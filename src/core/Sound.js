import { audioContext, isRunning, SOUNDS, playBuffer } from './Synth.js';
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

// ---------------------------------------------------------------- recorded sound files

/**
 * Sound effects that have a recorded file in public/assets/sfx/<key>.mp3, with a volume
 * to balance them against each other. Every other key keeps its synthesized sound
 * (core/Synth.js), so files can be added one at a time.
 * `steps`: how the call's `step` (combo chain, star 1-2-3, pot filling) raises the pitch.
 */
// Volumes were set from each file's measured loudness (RMS) so they sit together
// and roughly level with the synthesized sounds that are still in use.
const SAMPLE_FILES = {
  pop: { vol: 0.5, steps: (s) => Math.min(s, 7) },
  swap: { vol: 0.7 },
  select: { vol: 0.3 },
  invalid: { vol: 0.28 },
  click: { vol: 0.7 },
  special: { vol: 0.4 },
  star: { vol: 0.25, steps: (s) => s * 2 },
  sparkle: { vol: 0.45 },
  tick: { vol: 0.4 },
  drip: { vol: 0.46, steps: (s) => s },
  bloom: { vol: 0.5 },
};

const PENTA = [0, 2, 4, 7, 9];
/** Semitones for pentatonic step `s` (0, 2, 4, 7, 9, 12, ...), capped at an octave and a half. */
const pentaSemis = (s) => Math.min(19, 12 * Math.floor(s / 5) + PENTA[Math.max(0, Math.round(s)) % 5]);

const samples = {};

/** Fetch and decode the sound files in the background; until one arrives its synth version plays. */
function loadSamples() {
  const ctx = audioContext();
  if (!ctx) return;
  Object.keys(SAMPLE_FILES).forEach((key) => {
    fetch(`${import.meta.env.BASE_URL}assets/sfx/${key}.mp3`)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(res.status))))
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => { samples[key] = buffer; })
      .catch(() => {
        // Missing or undecodable: keep the synthesized sound.
      });
  });
}
loadSamples();

/**
 * Play a sound effect: the recorded file when there is one, otherwise the synthesized sound.
 * config: { volume (multiplier, default 1), detune (cents), step (pitch step for pops/stars) }
 * The first argument (scene) is unused but kept so call sites read naturally.
 */
export function playSfx(_scene, key, config = {}) {
  if (isMuted() || !isRunning()) return;
  const pitch = 2 ** ((config.detune ?? 0) / 1200);
  const volume = config.volume ?? 1;
  try {
    const file = SAMPLE_FILES[key];
    if (file && samples[key]) {
      const semis = file.steps ? pentaSemis(file.steps(config.step ?? 0)) : 0;
      playBuffer(samples[key], { vol: file.vol * volume, rate: pitch * 2 ** (semis / 12) });
      return;
    }
    SOUNDS[key]?.(pitch, volume, config);
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
