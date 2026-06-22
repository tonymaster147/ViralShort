// Razorpay helper — server-side only. Uses the REST API directly (no SDK dep)
// so the KEY_SECRET never leaves the server.
const crypto = require('crypto');

const KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

function isConfigured() {
  return Boolean(KEY_ID && KEY_SECRET);
}

// Create a Razorpay order. `amountPaise` is the charge in the smallest unit
// (₹1 = 100 paise). Returns the order object ({ id, amount, currency, ... }).
async function createOrder({ amountPaise, currency = 'INR', receipt, notes }) {
  if (!isConfigured()) throw new Error('Razorpay keys not configured');
  const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: amountPaise, currency, receipt, notes, payment_capture: 1 }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.description || 'Razorpay order failed';
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Verify the checkout signature: HMAC_SHA256(order_id + "|" + payment_id) with
// the KEY_SECRET must equal the signature Razorpay returned. Constant-time compare.
function verifyPaymentSignature({ orderId, paymentId, signature }) {
  if (!isConfigured() || !orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac('sha256', KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { isConfigured, createOrder, verifyPaymentSignature, KEY_ID };
