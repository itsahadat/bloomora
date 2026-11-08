/**
 * Build the web game for the Android app and copy it into the Capacitor project.
 * Usage: npm run android        -> then open/run with `npx cap open android` or `npm run android:run`
 * VITE_TARGET=android skips the offline service worker (the app already ships every file).
 */
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'dist-android';
execSync(`npx vite build --outDir ${DIR} --emptyOutDir`, {
  stdio: 'inherit',
  env: { ...process.env, VITE_TARGET: 'android' },
});
rmSync(join(DIR, 'sw.js'), { force: true });
execSync('npx cap sync android', { stdio: 'inherit' });
