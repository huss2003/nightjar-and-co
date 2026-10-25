// Build step for Vercel: copy theme assets into public/ so the CDN serves them directly.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'public');
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, 'theme', 'assets'), path.join(out, 'assets'), { recursive: true });
console.log('copied theme/assets → public/assets');
