/**
 * Build a game-portal upload: bloomora-<portal>.zip with index.html at the zip root.
 * Usage: npm run itch         -> upload on itch.io as an HTML game
 *        npm run crazygames   -> upload on the CrazyGames Developer Portal
 */
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

const PORTALS = {
  itch: 'upload it on itch.io as an HTML game',
  crazygames: 'upload it on the CrazyGames Developer Portal (choose "Progress Save" for the Data module)',
};
const portal = process.argv[2];
if (!PORTALS[portal]) {
  console.error(`Usage: node scripts/portal.mjs <${Object.keys(PORTALS).join('|')}>`);
  process.exit(1);
}

const DIR = `dist-${portal}`;
const OUT = `bloomora-${portal}.zip`;

// VITE_TARGET picks the portal's SDK and skips the offline service worker
// (portals show the game in a frame; a cache there would hold back updates).
execSync(`npx vite build --outDir ${DIR} --emptyOutDir`, {
  stdio: 'inherit',
  env: { ...process.env, VITE_TARGET: portal },
});
rmSync(join(DIR, 'sw.js'), { force: true });

// Minimal zip writer (forward-slash paths, which itch.io needs).
const files = [];
(function walk(dir, prefix) {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, `${prefix}${name}/`);
    else files.push({ name: prefix + name, data: readFileSync(full) });
  }
})(DIR, '');

const parts = [];
const central = [];
let offset = 0;
for (const { name, data } of files) {
  const nameBuf = Buffer.from(name, 'utf8');
  const packed = deflateRawSync(data, { level: 9 });
  const store = packed.length >= data.length; // PNGs are already compressed
  const body = store ? data : packed;
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(store ? 0 : 8, 8);
  local.writeUInt32LE(0, 10); // time/date
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);
  parts.push(local, nameBuf, body);

  const cen = Buffer.alloc(46);
  cen.writeUInt32LE(0x02014b50, 0);
  cen.writeUInt16LE(20, 4);
  cen.writeUInt16LE(20, 6);
  cen.writeUInt16LE(0x0800, 8);
  cen.writeUInt16LE(store ? 0 : 8, 10);
  cen.writeUInt32LE(0, 12);
  cen.writeUInt32LE(crc, 16);
  cen.writeUInt32LE(body.length, 20);
  cen.writeUInt32LE(data.length, 24);
  cen.writeUInt16LE(nameBuf.length, 28);
  cen.writeUInt32LE(offset, 42);
  central.push(cen, nameBuf);
  offset += local.length + nameBuf.length + body.length;
}
const cenBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cenBuf.length, 12);
end.writeUInt32LE(offset, 16);
writeFileSync(OUT, Buffer.concat([...parts, cenBuf, end]));

console.log(`\nMade ${OUT} (${files.length} files, ${(statSync(OUT).size / 1048576).toFixed(1)} MB) — ${PORTALS[portal]}.`);
