/**
 * Where saves go. Every core module reads and writes through `Store` instead of
 * window.localStorage, so a platform can swap in its own save system: on CrazyGames
 * that is the SDK's Data module, which follows a logged-in player across devices.
 * The backend must offer localStorage's getItem / setItem / removeItem.
 */
let backend = null;

function target() {
  return backend ?? window.localStorage;
}

/** Called once by Platform.init(), before any save is read. */
export function useStorageBackend(storage) {
  backend = storage;
}

/** All calls may throw (private mode, quota, platform errors); callers already guard them. */
export const Store = {
  get(key) {
    return target().getItem(key);
  },
  set(key, value) {
    target().setItem(key, value);
  },
  remove(key) {
    target().removeItem(key);
  },
};
