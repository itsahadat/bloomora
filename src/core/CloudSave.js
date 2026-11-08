import { Store } from './Storage.js';
import { Platform } from './Platform.js';

/**
 * Cloud save for the Android app: sign in with Google (Firebase Authentication) and the
 * whole save (every "bloomora.*" key) is mirrored to Firestore at saves/<user id>.
 *
 * - On start and right after signing in, the save with more progress wins
 *   (levels unlocked first, then total stars); if that's the cloud one, the game reloads with it.
 * - Every local save schedules an upload a few seconds later (batched, to stay well inside
 *   Firestore's free daily writes), and leaving the app uploads at once.
 * - Without a signed-in player, or without Firebase set up (google-services.json),
 *   nothing happens and the game simply saves on the phone as before.
 */

const PREFIX = 'bloomora.';
const UPLOAD_DELAY = 8000;
// Device-only settings that shouldn't follow the player to another phone.
const LOCAL_ONLY = new Set(['bloomora.muted', 'bloomora.music', 'bloomora.ads.v1']);

let auth = null;
let firestore = null;
let user = null;
let uploadTimer = null;
let applying = false;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => {
    try {
      fn(user);
    } catch {
      // A listener's problem is not the save's problem.
    }
  });
}

/** All save keys and values on this device. */
function snapshot() {
  const data = {};
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(PREFIX) && !LOCAL_ONLY.has(key)) data[key] = window.localStorage.getItem(key);
  }
  return data;
}

/** How far a save has got: levels unlocked weigh most, then stars. */
function score(data) {
  try {
    const p = JSON.parse(data?.['bloomora.progress.v1'] ?? 'null');
    if (!p) return 0;
    const stars = Object.values(p.stars ?? {}).reduce((sum, s) => sum + (Number(s) || 0), 0);
    return (Number(p.unlocked) || 0) * 1000 + stars;
  } catch {
    return 0;
  }
}

async function upload() {
  clearTimeout(uploadTimer);
  uploadTimer = null;
  if (!user || !firestore) return;
  const data = snapshot();
  try {
    await firestore.FirebaseFirestore.setDocument({
      reference: `saves/${user.uid}`,
      data: { data, score: score(data), savedAt: Date.now() },
    });
  } catch (err) {
    console.warn('[CloudSave] upload failed', err);
  }
}

function scheduleUpload(key) {
  if (applying || !user || !key?.startsWith(PREFIX) || LOCAL_ONLY.has(key)) return;
  if (!uploadTimer) uploadTimer = setTimeout(upload, UPLOAD_DELAY);
}

/** Compare the cloud save with this phone's and keep the one with more progress. */
async function sync() {
  if (!user || !firestore) return;
  let cloud = null;
  try {
    const { snapshot: doc } = await firestore.FirebaseFirestore.getDocument({ reference: `saves/${user.uid}` });
    cloud = doc?.data ?? null;
  } catch (err) {
    console.warn('[CloudSave] download failed', err);
    return;
  }
  const local = snapshot();
  if (cloud?.data && score(cloud.data) > score(local)) {
    // The cloud save is further along (e.g. a new or reset phone): use it.
    applying = true;
    Object.keys(local).forEach((key) => window.localStorage.removeItem(key));
    Object.entries(cloud.data).forEach(([key, value]) => {
      if (typeof value === 'string') window.localStorage.setItem(key, value);
    });
    window.location.reload();
    return;
  }
  await upload();
}

export const CloudSave = {
  /** True in builds that have cloud save (the Android app). */
  get available() {
    return Platform.target === 'android';
  },

  /** The signed-in player ({ uid, displayName, email }) or null. */
  get user() {
    return user;
  },

  /** Call `fn(user)` whenever the player signs in or out. */
  onChange(fn) {
    listeners.add(fn);
  },

  /** Start up: restore a signed-in player and sync. Never throws. */
  async init() {
    if (!this.available) return;
    try {
      auth = await import('@capacitor-firebase/authentication');
      firestore = await import('@capacitor-firebase/firestore');
      ({ user } = await auth.FirebaseAuthentication.getCurrentUser());
    } catch (err) {
      console.warn('[CloudSave] Firebase not set up yet', err);
      auth = null;
      firestore = null;
      return;
    }
    Store.onChange(scheduleUpload);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && uploadTimer) upload();
    });
    notify();
    if (user) await sync();
  },

  /** Sign in with Google, then sync. Resolves true when signed in. */
  async signIn() {
    if (!auth) return false;
    try {
      ({ user } = await auth.FirebaseAuthentication.signInWithGoogle());
    } catch (err) {
      console.warn('[CloudSave] sign-in cancelled or failed', err);
      return false;
    }
    notify();
    await sync();
    return !!user;
  },

  async signOut() {
    if (!auth) return;
    await upload();
    try {
      await auth.FirebaseAuthentication.signOut();
    } catch {
      // Already signed out.
    }
    user = null;
    notify();
  },
};
