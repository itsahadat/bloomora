/**
 * Tiny local receiver for promo art: the dev build POSTs { name, dataUrl } and the PNG
 * is written to docs/store/. Run: node scripts/promo/save-server.mjs (port 5190).
 */
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const OUT = join(process.cwd(), 'docs', 'store');
mkdirSync(OUT, { recursive: true });

createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5180');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.end();
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    try {
      const { name, dataUrl } = JSON.parse(body);
      const file = join(OUT, basename(name));
      writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
      console.log('saved', file);
      res.end('ok');
    } catch (err) {
      res.statusCode = 400;
      res.end(String(err));
    }
  });
}).listen(5190, '127.0.0.1');
