const STORAGE_KEY = 'bloomora.lives.v1';
const MAX_LIVES = 5;
const REGEN_MS = 30 * 60 * 1000;

let state = null;

function load() {
  if (state) return state;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    state = raw ? JSON.parse(raw) : null;
  } catch {
    state = null;
  }
  if (!state || typeof state.lives !== 'number') state = { lives: MAX_LIVES, last: Date.now() };
  return state;
}

function save() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Not persisted; lives still work for this session.
  }
}

/** Add any lives that regenerated while the player was away. */
function refresh() {
  const s = load();
  const now = Date.now();
  if (s.lives >= MAX_LIVES) {
    s.last = now;
    return s;
  }
  const gained = Math.floor((now - s.last) / REGEN_MS);
  if (gained > 0) {
    s.lives = Math.min(MAX_LIVES, s.lives + gained);
    s.last = s.lives >= MAX_LIVES ? now : s.last + gained * REGEN_MS;
    save();
  }
  return s;
}

export const Lives = {
  MAX: MAX_LIVES,

  count() {
    return refresh().lives;
  },

  /** Milliseconds until the next life arrives (0 when full). */
  msToNext() {
    const s = refresh();
    return s.lives >= MAX_LIVES ? 0 : Math.max(0, REGEN_MS - (Date.now() - s.last));
  },

  isFull() {
    return refresh().lives >= MAX_LIVES;
  },

  /** Top lives back up to the maximum. */
  refill() {
    const s = refresh();
    s.lives = MAX_LIVES;
    s.last = Date.now();
    save();
  },

  lose() {
    const s = refresh();
    if (s.lives >= MAX_LIVES) s.last = Date.now();
    s.lives = Math.max(0, s.lives - 1);
    save();
  },
};

export function formatTimer(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
