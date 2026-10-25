// ---------------------------------------------------------------------------
// Product reviews. One review per email per product. A review is marked
// "verified buyer" when that email has a paid order containing the product.
// The product's rating summary (metafields.reviews) is recalculated on every
// change, the same way review apps write rating metafields on Shopify.
// ---------------------------------------------------------------------------
import { q, one, bumpCatalog } from './db.js';

export const productReviews = (productId) => q("select id, rating, title, body, author, verified, created_at from reviews where product_id = $1 and status = 'published' order by created_at desc limit 50", [productId]);

export async function recalcRating(productId) {
  const r = await one("select coalesce(round(avg(rating)::numeric, 1), 0)::float as rating, count(*)::int as n from reviews where product_id = $1 and status = 'published'", [productId]);
  await q("update products set metafields = jsonb_set(metafields, '{reviews}', $2::jsonb), updated_at = now() where id = $1", [productId, JSON.stringify({ rating: Number(r.rating) || 0, rating_count: r.n })]);
  await bumpCatalog();
}

export async function submitReview(product, body, customer) {
  const clip = (s, n) => String(s ?? '').trim().slice(0, n);
  const rating = Math.round(Number(body.rating));
  const email = clip(customer?.email || body.email, 200).toLowerCase();
  const author = clip(body.author || (customer ? `${customer.first_name} ${customer.last_name?.[0] || ''}.` : ''), 60);
  const text = clip(body.body, 2000);
  if (!(rating >= 1 && rating <= 5)) throw new Error('Choose a star rating.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('Enter a valid email address.');
  if (!author) throw new Error('Add a name to show with your review.');
  if (text.length < 10) throw new Error('Tell us a little more (at least 10 characters).');
  if (body.website) throw new Error('Could not submit review.'); // honeypot field, hidden from people
  const bought = await one(`select 1 from orders where email = $1 and status = 'paid' and line_items @> $2::jsonb limit 1`, [email, JSON.stringify([{ product_id: product.id }])]);
  const rows = await q(`insert into reviews (product_id, rating, title, body, author, email, verified) values ($1,$2,$3,$4,$5,$6,$7)
    on conflict (product_id, email) do nothing returning id`, [product.id, rating, clip(body.title, 120), text, author, email, !!bought]);
  if (!rows.length) throw new Error('You’ve already reviewed this piece. Thank you!');
  await recalcRating(product.id);
}
