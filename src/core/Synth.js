/**
 * Tiny WebAudio synth: every sound effect and the background tune are generated in code,
 * so they stay soft, bubbly and in tune with each other (C major pentatonic).
 */
const AC = window.AudioContext || window.webkitAudioContext;

let ctx = null;
let sfxBus = null;
let musicBus = null;
let noiseBuffer = null;

export function audioContext() {
  if (ctx || !AC) return ctx;
  ctx = new AC();
  // Gentle limiter so stacked pops in a big cascade never clip.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -16;
  limiter.knee.value = 12;
  limiter.ratio.value = 4;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.2;
  limiter.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.connect(limiter);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0;
  musicBus.connect(limiter);

  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return ctx;
}

export function isRunning() {
  return !!ctx && ctx.state === 'running';
}

export function getMusicBus() {
  return musicBus;
}

// ---------------------------------------------------------------- notes

const PENTA = [0, 2, 4, 7, 9];
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

/** Frequency of pentatonic step `step` above C5 (0 = C5, 5 = C6, ...). */
export function penta(step) {
  const s = Math.max(0, Math.round(step));
  return mtof(72 + 12 * Math.floor(s / 5) + PENTA[s % 5]);
}

const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 'C5', 'F#4', 'Bb3' -> frequency. */
export function noteFreq(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return 440;
  const semis = NOTE_INDEX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return mtof(12 * (Number(m[3]) + 1) + semis);
}

// ---------------------------------------------------------------- voices

/**
 * One oscillator with a pluck envelope.
 * `at` is an absolute context time (defaults to now + t). `to` glides the pitch.
 */
export function tone({
  f, type = 'sine', t = 0, at = null, dur = 0.15, vol = 0.3, attack = 0.004,
  to = null, glide = null, vib = null, bus = sfxBus,
}) {
  if (!ctx) return;
  const start = at ?? ctx.currentTime + t;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(f, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + (glide ?? dur));
  if (vib) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = vib.rate;
    depth.gain.value = vib.depth;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(start);
    lfo.stop(start + dur + 0.05);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(bus);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

/** Soft marimba / music-box note: a sine with a quick bright overtone. */
export function bell(f, { t = 0, at = null, dur = 0.5, vol = 0.15, bus = sfxBus } = {}) {
  tone({ f, t, at, dur, vol, attack: 0.003, bus });
  tone({ f: f * 4, t, at, dur: dur * 0.3, vol: vol * 0.22, attack: 0.002, bus });
  tone({ f: f * 2, type: 'triangle', t, at, dur: dur * 0.5, vol: vol * 0.12, attack: 0.002, bus });
}

let punchBus = null;
/** A softly saturating bus: makes booms and smashes thick and punchy without harsh clipping. */
function punch() {
  if (punchBus || !ctx) return punchBus;
  const shaper = ctx.createWaveShaper();
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 3.2) / Math.tanh(3.2);
  }
  shaper.curve = curve;
  shaper.oversample = '2x';
  const out = ctx.createGain();
  out.gain.value = 0.75;
  shaper.connect(out).connect(sfxBus);
  punchBus = shaper;
  return punchBus;
}

/** Filtered noise for whooshes and puffs. */
export function noise({
  t = 0, dur = 0.2, vol = 0.1, freq = 1200, to = null, q = 1, type = 'bandpass', bus = sfxBus,
}) {
  if (!ctx) return;
  const start = ctx.currentTime + t;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, start);
  if (to) filter.frequency.exponentialRampToValueAtTime(to, start + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + Math.min(0.03, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filter).connect(g).connect(bus);
  src.start(start, Math.random() * 0.5);
  src.stop(start + dur + 0.05);
}

// ---------------------------------------------------------------- sound effects

/** p = pitch multiplier, v = volume multiplier, o = extra options (e.g. step). */
export const SOUNDS = {
  // UI button: a little wooden "tok".
  click(p, v) {
    tone({ f: 1050 * p, to: 640 * p, glide: 0.05, dur: 0.08, vol: 0.2 * v });
    tone({ f: 2100 * p, type: 'triangle', dur: 0.03, vol: 0.05 * v });
  },
  // Picking up a bloom.
  select(p, v) {
    tone({ f: 1300 * p, to: 1750 * p, glide: 0.04, dur: 0.07, vol: 0.1 * v });
  },
  // Two blooms trade places: a soft "fwip".
  swap(p, v) {
    tone({ f: 420 * p, to: 860 * p, glide: 0.1, dur: 0.13, vol: 0.12 * v });
    noise({ dur: 0.12, vol: 0.035 * v, freq: 1800 * p, to: 4200 * p, q: 1.4 });
  },
  // Swap that doesn't match: a wobbly "boi-oing".
  invalid(p, v) {
    tone({ f: 540 * p, to: 300 * p, glide: 0.26, dur: 0.3, vol: 0.17 * v, type: 'triangle', vib: { rate: 16, depth: 30 } });
  },
  // A match: bubble pop + a marimba note that climbs with each cascade step.
  pop(p, v, { step = 0 } = {}) {
    const f = penta(step + 2) * p;
    tone({ f: f * 0.5, to: f * 1.05, glide: 0.035, dur: 0.09, vol: 0.2 * v });
    bell(f, { t: 0.012, dur: 0.38, vol: 0.14 * v });
  },
  // A special bloom is born: sparkly triad.
  special(p, v) {
    [10, 12, 14].forEach((s, i) => bell(penta(s) * p, { t: i * 0.055, dur: 0.55, vol: 0.11 * v }));
    tone({ f: penta(17) * p, t: 0.16, dur: 0.4, vol: 0.04 * v });
  },
  // Line bloom fires: a bright "zwiiip".
  line(p, v) {
    tone({ f: 480 * p, to: 2000 * p, glide: 0.16, dur: 0.22, vol: 0.1 * v, type: 'triangle' });
    noise({ dur: 0.24, vol: 0.05 * v, freq: 2500, to: 7000, q: 2 });
  },
  // Burst bloom: a punchy "BOOM" — thump, noise burst, crackle — with a sparkle on top.
  blast(p, v) {
    const bus = punch();
    tone({ f: 160 * p, to: 42 * p, glide: 0.35, dur: 0.6, vol: 0.5 * v, attack: 0.002, bus });
    tone({ f: 320 * p, to: 90 * p, glide: 0.12, dur: 0.18, vol: 0.25 * v, type: 'triangle', attack: 0.002, bus });
    noise({ dur: 0.5, vol: 0.32 * v, freq: 3000, to: 160, q: 0.6, type: 'lowpass', bus });
    noise({ dur: 0.06, vol: 0.14 * v, freq: 3500, type: 'highpass', q: 0.7 });
    for (let i = 0; i < 3; i += 1) noise({ t: 0.08 + i * 0.06, dur: 0.04, vol: 0.06 * v, freq: 2500 + Math.random() * 2500, q: 4 });
    bell(penta(12) * p, { t: 0.06, dur: 0.45, vol: 0.07 * v });
  },
  // Big explosion: sub-bass drop + noise blast + rumble tail, with a sparkle on top.
  boom(p, v) {
    const bus = punch();
    tone({ f: 120 * p, to: 32 * p, glide: 0.7, dur: 1.1, vol: 0.55 * v, attack: 0.003, bus });
    tone({ f: 260 * p, to: 60 * p, glide: 0.25, dur: 0.35, vol: 0.35 * v, type: 'triangle', attack: 0.002, bus });
    noise({ dur: 0.9, vol: 0.4 * v, freq: 2400, to: 120, q: 0.6, type: 'lowpass', bus });
    noise({ dur: 0.12, vol: 0.18 * v, freq: 3000, type: 'highpass', q: 0.7 });
    noise({ t: 0.15, dur: 1.0, vol: 0.12 * v, freq: 180, to: 60, q: 0.8, type: 'lowpass', bus });
    [12, 14, 17].forEach((s, i) => bell(penta(s) * p, { t: 0.12 + i * 0.06, dur: 0.6, vol: 0.06 * v }));
  },
  // Wooden crate breaking apart: crack, splinters and a hollow thunk.
  break(p, v) {
    const bus = punch();
    noise({ dur: 0.07, vol: 0.35 * v, freq: 1800 * p, q: 1.5, bus });
    tone({ f: 220 * p, to: 90 * p, glide: 0.12, dur: 0.2, vol: 0.32 * v, type: 'triangle', bus });
    for (let i = 0; i < 5; i += 1) {
      noise({ t: 0.04 + i * 0.035 + Math.random() * 0.02, dur: 0.035, vol: (0.16 - i * 0.02) * v, freq: (2600 + Math.random() * 1800) * p, q: 3 });
    }
    noise({ t: 0.05, dur: 0.25, vol: 0.08 * v, freq: 700, to: 250, type: 'lowpass' });
  },
  // Heavy crunchy hit when two specials collide.
  smash(p, v) {
    const bus = punch();
    noise({ dur: 0.18, vol: 0.38 * v, freq: 5000, to: 900, q: 0.5, type: 'lowpass', bus });
    noise({ dur: 0.08, vol: 0.2 * v, freq: 4000, type: 'highpass', q: 0.8 });
    tone({ f: 180 * p, to: 50 * p, glide: 0.3, dur: 0.45, vol: 0.45 * v, bus });
    tone({ f: 640 * p, to: 220 * p, glide: 0.1, dur: 0.14, vol: 0.12 * v, type: 'square', bus });
    for (let i = 0; i < 4; i += 1) {
      noise({ t: 0.06 + i * 0.05, dur: 0.05, vol: 0.08 * v, freq: 3200 + Math.random() * 2000, q: 4 });
    }
    bell(penta(15) * p, { t: 0.1, dur: 0.5, vol: 0.07 * v });
  },
  // Rainbow seed: a quick harp glissando.
  rainbow(p, v) {
    for (let i = 0; i < 10; i += 1) bell(penta(5 + i) * p, { t: i * 0.035, dur: 0.45, vol: 0.08 * v });
  },
  // Score star lights up (step 0..2 rises).
  star(p, v, { step = 0 } = {}) {
    bell(penta(10 + step * 2) * p, { dur: 0.7, vol: 0.14 * v });
    bell(penta(12 + step * 2) * p, { t: 0.07, dur: 0.6, vol: 0.09 * v });
  },
  // Planter box hit: hollow wood knock.
  crate(p, v) {
    tone({ f: 360 * p, to: 190 * p, glide: 0.08, dur: 0.11, vol: 0.22 * v, type: 'triangle' });
    noise({ dur: 0.05, vol: 0.08 * v, freq: 1600, q: 1 });
  },
  // Vine or weed snipped: two tiny scissor blips.
  snip(p, v) {
    tone({ f: 1900 * p, to: 1250 * p, glide: 0.03, dur: 0.045, vol: 0.09 * v });
    tone({ f: 2200 * p, to: 1400 * p, glide: 0.03, t: 0.06, dur: 0.045, vol: 0.09 * v });
  },
  // Pot watered by one bloom: a little "drip".
  drip(p, v, { step = 0 } = {}) {
    const f = penta(8 + step) * p;
    tone({ f: f * 0.6, to: f * 1.4, glide: 0.06, dur: 0.12, vol: 0.13 * v });
  },
  // A pot blossoms / a seed is collected: happy rising "ta-da-ding".
  bloom(p, v) {
    [5, 7, 9, 10].forEach((s, i) => bell(penta(s) * p, { t: i * 0.07, dur: 0.5, vol: 0.12 * v }));
    tone({ f: penta(15) * p, t: 0.3, dur: 0.5, vol: 0.05 * v });
  },
  // A weed spreads: a small "uh-oh".
  spread(p, v) {
    tone({ f: 392 * p, to: 370 * p, dur: 0.16, vol: 0.13 * v, type: 'triangle' });
    tone({ f: 311 * p, to: 262 * p, t: 0.17, dur: 0.3, vol: 0.13 * v, type: 'triangle' });
  },
  // Coin earned: classic two-note "bling".
  coin(p, v) {
    tone({ f: noteFreq('B5') * p, dur: 0.09, vol: 0.1 * v, type: 'triangle' });
    tone({ f: noteFreq('E6') * p, t: 0.075, dur: 0.4, vol: 0.12 * v, type: 'triangle' });
    tone({ f: noteFreq('E7') * p, t: 0.075, dur: 0.2, vol: 0.03 * v });
  },
  // Trowel digs: soft thunk + sparkle.
  dig(p, v) {
    tone({ f: 170 * p, to: 80 * p, glide: 0.12, dur: 0.18, vol: 0.28 * v });
    noise({ dur: 0.12, vol: 0.08 * v, freq: 600, to: 200, type: 'lowpass' });
    bell(penta(13) * p, { t: 0.08, dur: 0.35, vol: 0.06 * v });
  },
  // Breeze booster / shuffle: a whoosh with a rising twinkle.
  breeze(p, v) {
    noise({ dur: 0.6, vol: 0.07 * v, freq: 400, to: 3200, q: 0.9 });
    [5, 7, 9, 11].forEach((s, i) => bell(penta(s) * p, { t: 0.15 + i * 0.07, dur: 0.35, vol: 0.06 * v }));
  },
  // Level begins.
  start(p, v) {
    [5, 7, 10].forEach((s, i) => bell(penta(s) * p, { t: i * 0.1, dur: 0.5, vol: 0.12 * v }));
  },
  // Level complete: music-box fanfare.
  win(p, v) {
    ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, i) => bell(noteFreq(n) * p, { t: i * 0.09, dur: 0.6, vol: 0.13 * v }));
    ['C6', 'E6', 'G6'].forEach((n) => bell(noteFreq(n) * p, { t: 0.55, dur: 1.4, vol: 0.09 * v }));
    for (let i = 0; i < 6; i += 1) tone({ f: penta(16 + (i % 3)) * p, t: 0.6 + i * 0.08, dur: 0.25, vol: 0.03 * v });
  },
  // Out of moves: a gentle "awww".
  lose(p, v) {
    [['G5', 'F#5'], ['E5', 'D#5'], ['C5', 'B4']].forEach(([a, b], i) => {
      tone({ f: noteFreq(a) * p, to: noteFreq(b) * p, t: i * 0.22, dur: i === 2 ? 0.7 : 0.3, vol: 0.12 * v, type: 'triangle', vib: i === 2 ? { rate: 5, depth: 6 } : null });
    });
  },
  // Booster spent / reward popped.
  sparkle(p, v) {
    [12, 14, 15, 17].forEach((s, i) => tone({ f: penta(s) * p, t: i * 0.045, dur: 0.25, vol: 0.06 * v }));
  },
};
