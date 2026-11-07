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

/** Start (or keep) the music. Safe to call before the first user gesture: it waits for the unlock. */
export function startMusic() {
  wanted = true;
  const ctx = audioContext();
  if (!ctx || !isRunning() || timer) return;
  const bus = getMusicBus();
  bus.gain.cancelScheduledValues(ctx.currentTime);
  bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
  bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2);
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
}

export function musicWanted() {
  return wanted;
}
