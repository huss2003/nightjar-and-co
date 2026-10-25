// ---------------------------------------------------------------------------
// Transactional email. Every message is written to the `emails` table (the
// admin "Email log" shows it). If RESEND_API_KEY is set it is also sent
// through Resend; otherwise it stays logged, which is how the demo runs.
// ---------------------------------------------------------------------------
import { q } from './db.js';
import { esc, money } from '../theme/snippets/helpers.js';

const FROM = () => process.env.EMAIL_FROM || 'Nightjar & Co. <onboarding@resend.dev>';

export async function sendEmail(to, subject, html, kind = 'transactional') {
  let status = 'logged';
  if (process.env.RESEND_API_KEY) {
    try {
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: FROM(), to: [to], subject, html }) });
      status = r.ok ? 'sent' : `failed (${r.status})`;
    } catch { status = 'failed'; }
  }
  await q('insert into emails (to_email, subject, html, kind, status) values ($1,$2,$3,$4,$5)', [to, subject, html, kind, status]);
  return status;
}

const frame = (title, body, origin = '') => `<!doctype html><html><body style="margin:0;background:#f6f2ec;font-family:Figtree,Helvetica,Arial,sans-serif;color:#221d29">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:6px;overflow:hidden">
<tr><td style="background:#2a2238;color:#f1e9dc;padding:22px 32px;font-family:Georgia,serif;font-size:22px">Nightjar &amp; Co.</td></tr>
<tr><td style="padding:32px"><h1 style="font-family:Georgia,serif;font-weight:400;font-size:28px;margin:0 0 16px">${title}</h1>${body}</td></tr>
<tr><td style="padding:20px 32px;background:#efe7f4;font-size:12px;color:#5e5568">Nightjar &amp; Co. is a portfolio project. Payments run in Stripe test mode and no orders ship.${origin ? ` <a href="${origin}" style="color:#4b3358">Visit the shop</a>` : ''}</td></tr>
</table></td></tr></table></body></html>`;

const lines = (order) => `<table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:16px 0">
${order.line_items.map((l) => `<tr style="border-bottom:1px solid #eee"><td>${l.quantity} × ${esc(l.title)}<br><span style="color:#777">${esc(l.variant_title || '')}</span></td><td align="right">${money(l.price * l.quantity)}</td></tr>`).join('')}
<tr><td>Subtotal</td><td align="right">${money(order.subtotal_price)}</td></tr>
${order.total_discounts ? `<tr><td>Discount</td><td align="right">−${money(order.total_discounts)}</td></tr>` : ''}
<tr><td>${esc(order.shipping_lines[0]?.title || 'Shipping')}</td><td align="right">${order.shipping_lines[0]?.price ? money(order.shipping_lines[0].price) : 'Free'}</td></tr>
<tr><td><strong>Total</strong></td><td align="right"><strong>${money(order.total_price)}</strong></td></tr></table>`;

export function orderConfirmation(order, origin) {
  const a = order.shipping_address;
  return sendEmail(order.email, `Order #${order.number} confirmed`, frame(`Thank you, ${esc(order.customer.first_name || 'night owl')}`,
    `<p>We’ve got your order <strong>#${order.number}</strong> and we’re getting it ready in the studio.</p>${lines(order)}
    <p style="font-size:14px">Delivering to:<br>${esc(a.first_name)} ${esc(a.last_name)}<br>${esc(a.address1)}${a.address2 ? `, ${esc(a.address2)}` : ''}<br>${esc(a.city)} ${esc(a.zip)}<br>${esc(a.country_code)}</p>
    <p><a href="${origin}/orders/${order.token}" style="display:inline-block;background:#cdb8dd;color:#221d29;padding:12px 20px;border-radius:3px;text-decoration:none">View your order</a></p>`, origin), 'order_confirmation');
}

export function shippingConfirmation(order, f, origin) {
  return sendEmail(order.email, `Order #${order.number} is on its way`, frame('Your order is on its way',
    `<p>Good news: order <strong>#${order.number}</strong> has left the studio.</p><p>Carrier: <strong>${esc(f.carrier)}</strong><br>Tracking number: <strong>${esc(f.tracking_number || '—')}</strong></p>${lines(order)}
    <p><a href="${origin}/orders/${order.token}" style="color:#4b3358">Track your order</a></p>`, origin), 'shipping_confirmation');
}

export function refundNotice(order, amount, origin) {
  return sendEmail(order.email, `Refund for order #${order.number}`, frame('Your refund is on its way',
    `<p>We’ve refunded <strong>${money(amount)}</strong> for order <strong>#${order.number}</strong>. It can take 5–10 working days to show on your statement.</p>`, origin), 'refund');
}

export function welcomeEmail(email, origin) {
  return sendEmail(email, 'Welcome to the night owls — here’s 10% off', frame('Welcome to the night owls',
    `<p>Thanks for joining. You’ll hear about new prints and restocks before anyone else.</p><p>Here’s 10% off your first order:</p>
    <p style="font-size:22px;letter-spacing:.1em;background:#efe7f4;display:inline-block;padding:10px 18px;border-radius:3px">WELCOME10</p>`, origin), 'marketing');
}

export function accountWelcome(c, origin) {
  return sendEmail(c.email, 'Your Nightjar & Co. account', frame(`Hello ${esc(c.first_name || 'there')}`,
    `<p>Your account is ready. You can track orders, save your address and keep a wishlist.</p><p><a href="${origin}/account" style="color:#4b3358">Go to your account</a></p>`, origin), 'account');
}

export function passwordResetEmail(email, link, origin) {
  return sendEmail(email, 'Reset your password', frame('Reset your password',
    `<p>Someone asked to reset the password for this account. If that was you, use the link below within an hour.</p><p><a href="${link}" style="display:inline-block;background:#cdb8dd;color:#221d29;padding:12px 20px;border-radius:3px;text-decoration:none">Choose a new password</a></p><p style="font-size:13px;color:#777">If you didn’t ask for this, you can ignore this email.</p>`, origin), 'account');
}
