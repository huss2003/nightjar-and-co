// Local development server: `npm run dev` → http://localhost:3000
// Uses PGlite (Postgres in WASM, stored in .data/) unless DATABASE_URL is set.
import http from 'node:http';
import { handler } from './app.js';

const PORT = Number(process.env.PORT || 3000);
http.createServer((req, res) => {
  const t = Date.now();
  handler(req, res).finally(() => { if (process.env.LOG) console.log(req.method, req.url, res.statusCode, `${Date.now() - t}ms`); });
}).listen(PORT, () => console.log(`\n  Nightjar & Co. → http://localhost:${PORT}\n  admin → http://localhost:${PORT}/admin\n`));
