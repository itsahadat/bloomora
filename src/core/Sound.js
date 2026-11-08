import { audioContext, isRunning, SOUNDS, playBuffer } from './Synth.js';
import {
  startMusic, stopMusic, musicWanted, addMusicTrack,
} from './Music.js';
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

/** Start the background tune ('menu' or 'level') unless the player turned music off. */
export function playMusic(track = 'menu') {
  if (!isMusicMuted()) startMusic(track);
}

// ---------------------------------------------------------------- recorded sound files

/**
 * Sound effects with a recorded file in public/assets/audio/<key>.mp3. Any key that is
 * missing here, or whose file fails to load, keeps its synthesized sound (core/Synth.js).
 * Loudness is evened out automatically from each file (see analyse()); `weight` then makes
 * a sound a bit louder or softer than the rest on purpose.
 * `steps`: how the call's `step` (combo chain, star 1-2-3, pot filling) raises the pitch.
 */
const SAMPLE_FILES = {
  pop: { weight: 1, steps: (s) => Math.min(s, 7) },
  swap: { weight: 0.8 },
  select: { weight: 0.7 },
  invalid: { weight: 0.8 },
  click: { weight: 0.7 },
  line: { weight: 1 },
  blast: { weight: 1 },
  boom: { weight: 1.1 },
  rainbow: { weight: 1.1 },
  smash: { weight: 1.1 },
  start: { weight: 1 },
  win: { weight: 1.1 },
  lose: { weight: 0.9 },
  star: { weight: 1, steps: (s) => s * 2 },
  coin: { weight: 0.8 },
  sparkle: { weight: 0.9 },
  tick: { weight: 0.6 },
  crate: { weight: 0.9 },
  break: { weight: 1 },
  snip: { weight: 1 },
  drip: { weight: 0.9, steps: (s) => s },
  bloom: { weight: 1 },
  spread: { weight: 1 },
  dig: { weight: 1 },
  breeze: { weight: 0.9 },
};

/** Music loops: file name -> track name used by playMusic(). */
const MUSIC_FILES = { 'music-menu': 'menu', 'music-level': 'level' };

// Target loudness (RMS of the audible part, dBFS) after balancing.
const SFX_TARGET_DB = -28;
// Music sits well under the effects: a quiet background bed.
const MUSIC_TARGET_DB = -37;

const PENTA = [0, 2, 4, 7, 9];
/** Semitones for pentatonic step `s` (0, 2, 4, 7, 9, 12, ...), capped at an octave and a half. */
const pentaSemis = (s) => Math.min(19, 12 * Math.floor(s / 5) + PENTA[Math.max(0, Math.round(s)) % 5]);

/**
 * Where the sound really starts and ends (skipping silence the editor left at both ends)
 * and the gain that brings its loudness to `targetDb`.
 */
function analyse(buffer, targetDb) {
  const data = buffer.getChannelData(0);
  const rate = buffer.sampleRate;
  let first = -1;
  let last = 0;
  for (let i = 0; i < data.length; i += 1) {
    if (Math.abs(data[i]) > 0.01) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return { start: 0, end: buffer.duration, gain: 1 };
  let sum = 0;
  for (let i = first; i <= last; i += 1) sum += data[i] * data[i];
  const rmsDb = 10 * Math.log10(sum / (last - first + 1) || 1e-9);
  return {
    start: Math.max(0, first / rate - 0.005),
    end: Math.min(buffer.duration, last / rate + 0.05),
    gain: Math.min(3, Math.max(0.05, 10 ** ((targetDb - rmsDb) / 20))),
  };
}

const samples = {};

function loadAudio(file) {
  return fetch(`${import.meta.env.BASE_URL}assets/audio/${file}.mp3`)
    .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(res.status))))
    .then((data) => audioContext().decodeAudioData(data));
}

/** Fetch and decode the files in the background; until one arrives its synth version plays. */
function loadSamples() {
  if (!audioContext()) return;
  Object.keys(SAMPLE_FILES).forEach((key) => {
    loadAudio(key)
      .then((buffer) => { samples[key] = { buffer, ...analyse(buffer, SFX_TARGET_DB) }; })
      .catch(() => {
        // Missing or undecodable: keep the synthesized sound.
      });
  });
  Object.entries(MUSIC_FILES).forEach(([file, track]) => {
    loadAudio(file)
      .then((buffer) => addMusicTrack(track, { buffer, ...analyse(buffer, MUSIC_TARGET_DB) }))
      .catch(() => {
        // Missing: the synthesized lullaby keeps playing.
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
    const sample = samples[key];
    if (file && sample) {
      const semis = file.steps ? pentaSemis(file.steps(config.step ?? 0)) : 0;
      playBuffer(sample.buffer, {
        vol: sample.gain * file.weight * volume,
        rate: pitch * 2 ** (semis / 12),
        offset: sample.start,
      });
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
