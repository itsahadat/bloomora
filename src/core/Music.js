import { audioContext, isRunning, getMusicBus, bell, tone, noteFreq } from './Synth.js';

/**
 * Background music: a looping 8-bar music-box lullaby (C - Am - F - G),
 * scheduled a little ahead of time on the WebAudio clock so it never drifts.
 */
const BPM = 96;
const EIGHTH = 60 / BPM / 2;

const _ = null;
const MELODY = [
  'E5', _, 'G5', 'A5', 'G5', _, 'E5', _,
  'C5', _, 'E5', 'G5', 'A5', _, 'G5', _,
  'F5', _, 'A5', 'C6', 'A5', 'G5', 'F5', _,
  'G5', _, 'B5', _, 'D6', _, _, _,
  'C6', _, 'G5', 'E5', 'G5', _, 'C6', _,
  'E6', _, 'D6', 'C6', 'A5', _, _, _,
  'A5', _, 'C6', 'A5', 'G5', _, 'E5', 'D5',
  'E5', _, 'D5', _, 'C5', _, _, _,
];
// Root on beat 1, fifth on beat 3 of every bar.
const BASS = [['C3', 'G3'], ['A2', 'E3'], ['F2', 'C3'], ['G2', 'D3'], ['C3', 'G3'], ['A2', 'E3'], ['F2', 'C3'], ['G2', 'C3']];
// Soft offbeat "pluck" chord tones.
const CHORDS = [['E4', 'G4'], ['C4', 'E4'], ['A4', 'C5'], ['B4', 'D5'], ['E4', 'G4'], ['C4', 'E4'], ['A4', 'C5'], ['B4', 'D5']];

let wanted = false;
let timer = null;
let nextTime = 0;
let step = 0;

function playStep(i, at) {
  const bus = getMusicBus();
  const bar = Math.floor(i / 8);
  const pos = i % 8;
  const note = MELODY[i];
  if (note) bell(noteFreq(note), { at, dur: 0.9, vol: 0.075, bus });
  if (pos === 0 || pos === 4) {
    const b = BASS[bar][pos === 0 ? 0 : 1];
    tone({ f: noteFreq(b), at, dur: 0.6, vol: 0.09, attack: 0.01, bus });
  }
  if (pos === 2 || pos === 6) {
    CHORDS[bar].forEach((n) => tone({ f: noteFreq(n), type: 'triangle', at, dur: 0.25, vol: 0.022, bus }));
  }
}

function schedule() {
  const ctx = audioContext();
  if (!ctx || !isRunning()) return;
  // After a throttled background tab, skip ahead instead of playing a burst of old notes.
  if (nextTime < ctx.currentTime - 0.1) nextTime = ctx.currentTime + 0.05;
  while (nextTime < ctx.currentTime + 0.25) {
    playStep(step, nextTime);
    nextTime += EIGHTH;
    step = (step + 1) % MELODY.length;
  }
}

// ---------------------------------------------------------------- recorded tracks

/** Recorded loops by name ('menu', 'level'): { buffer, start, end, gain }. */
const tracks = {};
let currentTrack = 'menu';
let source = null;
let sourceGain = null;
let sourceTrack = null;

/** Register a decoded music file; it replaces the synthesized tune for that track. */
export function addMusicTrack(name, track) {
  tracks[name] = track;
  // Arrived while that music should already be playing: switch over now.
  if (wanted && name === currentTrack) startMusic(name);
}

function stopSource(fade = 0.4) {
  if (!source) return;
  const ctx = audioContext();
  const old = source;
  const oldGain = sourceGain;
  oldGain.gain.cancelScheduledValues(ctx.currentTime);
  oldGain.gain.setValueAtTime(oldGain.gain.value, ctx.currentTime);
  oldGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
  old.stop(ctx.currentTime + fade + 0.05);
  source = null;
  sourceGain = null;
  sourceTrack = null;
}

function playTrack(name, track) {
  const ctx = audioContext();
  if (sourceTrack === name && source) return;
  stopSource(0.6);
  const src = ctx.createBufferSource();
  src.buffer = track.buffer;
  src.loop = true;
  // Loop only the audible part, so the encoder's silence at both ends never leaves a gap.
  src.loopStart = track.start;
  src.loopEnd = track.end;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(track.gain, ctx.currentTime + 0.8);
  src.connect(gain).connect(getMusicBus());
  src.start(ctx.currentTime, track.start);
  source = src;
  sourceGain = gain;
  sourceTrack = name;
}

/**
 * Start (or keep) the music for `track` ('menu' or 'level'): its recorded file when loaded
 * (the menu file stands in for a missing level file), else the synthesized lullaby.
 * Safe to call before the first user gesture: it waits for the unlock.
 */
export function startMusic(track = currentTrack) {
  wanted = true;
  currentTrack = track;
  const ctx = audioContext();
  if (!ctx || !isRunning()) return;
  const bus = getMusicBus();
  bus.gain.cancelScheduledValues(ctx.currentTime);
  bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
  bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2);

  const name = tracks[track] ? track : tracks.menu ? 'menu' : null;
  if (name) {
    clearInterval(timer);
    timer = null;
    playTrack(name, tracks[name]);
    return;
  }
  if (timer) return;
  nextTime = ctx.currentTime + 0.1;
  schedule();
  timer = setInterval(schedule, 60);
}

export function stopMusic() {
  wanted = false;
  const ctx = audioContext();
  if (!ctx) return;
  const bus = getMusicBus();
  bus.gain.cancelScheduledValues(ctx.currentTime);
  bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
  bus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
  clearInterval(timer);
  timer = null;
  stopSource(0.4);
}

export function musicWanted() {
  return wanted;
}
