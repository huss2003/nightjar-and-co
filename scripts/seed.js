// `npm run seed`: create the schema (if needed) and load the launch catalog into an empty database.
import { ensureSchema, q } from '../server/db.js';
import { seed } from '../server/seed.js';
await ensureSchema();
const [{ n }] = await q('select count(*)::int as n from products');
if (n) console.log(`database already has ${n} products; nothing to do`);
else console.log(`seeded ${await seed()} products`);
process.exit(0);
