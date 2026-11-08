import { dayNumber } from './Daily.js';

const STORAGE_KEY = 'bloomora.quests.v1';

/** Weekly garden quests: three per week, each worth coins once finished. */
const FRUITS = ['strawberry', 'grape', 'kiwi', 'apple', 'lemon', 'blueberry', 'orange', 'banana', 'watermelon', 'pineapple', 'drop', 'sun', 'leaf', 'rose'];
const PLURAL = (t) => (t === 'leaf' ? 'leaves' : /[^aeiou]y$/.test(t) ? `${t.slice(0, -1)}ies` : `${t}s`);

/** Quest templates; `make(rng)` builds one. Kinds: collect:<type>, win, stars, special, booster, obstacle. */
const TEMPLATES = [
  (rng) => {
    const t = FRUITS[Math.floor(rng() * FRUITS.length)];
    return { kind: `collect:${t}`, icon: `jewel-${t}`, goal: 150, text: `Collect 150 ${PLURAL(t)}`, coins: 120 };
  },
  () => ({ kind: 'win', icon: 'ui-star', goal: 8, text: 'Win 8 levels', coins: 200 }),
  () => ({ kind: 'stars', icon: 'ui-star', goal: 15, text: 'Earn 15 stars', coins: 180 }),
  () => ({ kind: 'special', icon: 'sp-bomb', goal: 40, text: 'Make 40 special blooms', coins: 150 }),
  () => ({ kind: 'booster', icon: 'bst-trowel', goal: 6, text: 'Use 6 boosters', coins: 120 }),
  () => ({ kind: 'obstacle', icon: 'ob-crate1', goal: 60, text: 'Clear 60 soil, boxes, vines or weeds', coins: 150 }),
];

const weekNumber = () => Math.floor((dayNumber() + 3) / 7);

/** Small seeded random so everyone gets the same quests in a given week. */
function seeded(seed) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function build(week) {
  const rng = seeded(week);
  const pool = TEMPLATES.map((t, i) => i);
  const quests = [0];
  // Always one "collect" quest, plus two other kinds.
  while (quests.length < 3) {
    const pick = pool[1 + Math.floor(rng() * (pool.length - 1))];
    if (!quests.includes(pick)) quests.push(pick);
  }
  return quests.map((i) => ({ ...TEMPLATES[i](rng), progress: 0, claimed: false }));
}

let state = null;

function load() {
  const week = weekNumber();
  if (!state) {
    try {
      state = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      state = null;
    }
  }
  if (!state || state.week !== week || !Array.isArray(state.quests)) {
    state = { week, quests: build(week) };
    save();
  }
  return state;
}

function save() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Not persisted.
  }
}

export const Quests = {
  STORAGE_KEY,

  list() {
    return load().quests;
  },

  /** Count progress for every quest of this kind. */
  add(kind, amount = 1) {
    let changed = false;
    load().quests.forEach((q) => {
      if (q.kind === kind && q.progress < q.goal) {
        q.progress = Math.min(q.goal, q.progress + amount);
        changed = true;
      }
    });
    if (changed) save();
  },

  claimable() {
    return load().quests.some((q) => q.progress >= q.goal && !q.claimed);
  },

  /** Marks a finished quest claimed; returns its coin reward (0 if not claimable). */
  claim(index) {
    const q = load().quests[index];
    if (!q || q.claimed || q.progress < q.goal) return 0;
    q.claimed = true;
    save();
    return q.coins;
  },

  /** Milliseconds until the weekly reset. */
  msToReset() {
    const nextWeekDay = (weekNumber() + 1) * 7 - 3;
    const now = new Date();
    const localMs = now.getTime() - now.getTimezoneOffset() * 60000;
    return nextWeekDay * 86400000 - localMs;
  },
};
