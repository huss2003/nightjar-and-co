// Vercel Function entry: every non-static request is rewritten here (see vercel.json).
import { handler } from '../server/app.js';

export const config = { maxDuration: 20 };
export default function (req, res) {
  // Vercel passes the original path in the request URL; keep the query string intact
  return handler(req, res);
}
