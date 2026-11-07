const STORAGE_KEY = 'bloomora.seen.v1';

let seen = null;

function load() {
  if (seen) return seen;
  try {
    seen = new Set(JSON.parse(window.localStorage.getItem(STORAGE_KEY)) ?? []);
  } catch {
    seen = new Set();
  }
  return seen;
}

/** Remembers which obstacles the player has already been introduced to. */
export const Seen = {
  STORAGE_KEY,

  has(feature) {
    return load().has(feature);
  },

  mark(features) {
    features.forEach((f) => load().add(f));
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...load()]));
    } catch {
      // Not persisted; the card may show again next session.
    }
  },
};
