const { pool } = require('../config/db');
const razorpay = require('../config/razorpay');
const { changeBalance, withTransaction } = require('./walletHelper');

// POST /api/store/order  body: { packId }
// Creates a Razorpay order for the pack and records a pending purchase.
// Returns everything the in-app checkout needs (the KEY_ID is public).
async function createDiamondOrder(req, res, next) {
  try {
    if (!razorpay.isConfigured()) {
      return res.status(503).json({ ok: false, error: 'Payments are not configured on the server.' });
    }
    const packId = Number(req.body.packId);
    const [[pack]] = await pool.query('SELECT * FROM coin_packs WHERE id = ?', [packId]);
    if (!pack) return res.status(404).json({ ok: false, error: 'Pack not found' });

    const order = await razorpay.createOrder({
      amountPaise: pack.price_cents,
      currency: 'INR',
      receipt: `pack_${packId}_u${req.userId}_${Date.now()}`,
      notes: { userId: String(req.userId), packId: String(packId), diamonds: String(pack.diamonds) },
    });

    // Record the pending purchase, bound to this order id + user.
    await pool.query(
      `INSERT INTO purchases (user_id, pack_id, status, razorpay_order_id, diamonds)
       VALUES (?, ?, 'created', ?, ?)`,
      [req.userId, packId, order.id, pack.diamonds]
    );

    res.json({
      ok: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpay.KEY_ID,
      pack: { id: pack.id, name: pack.name, diamonds: pack.diamonds, priceLabel: `₹${Math.round(pack.price_cents / 100)}` },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/store/verify  body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// Verifies the signature, then credits diamonds exactly once (idempotent).
async function verifyDiamondPayment(req, res, next) {
  try {
    const orderId = req.body.razorpay_order_id;
    const paymentId = req.body.razorpay_payment_id;
    const signature = req.body.razorpay_signature;

    const ok = razorpay.verifyPaymentSignature({ orderId, paymentId, signature });
    if (!ok) {
      if (orderId) {
        await pool.query("UPDATE purchases SET status='failed' WHERE razorpay_order_id=? AND status='created'", [orderId]);
      }
      return res.status(400).json({ ok: false, error: 'Payment verification failed' });
    }

    // The purchase must belong to this user and match the order we created.
    const [[purchase]] = await pool.query(
      'SELECT * FROM purchases WHERE razorpay_order_id = ? AND user_id = ? LIMIT 1',
      [orderId, req.userId]
    );
    if (!purchase) return res.status(404).json({ ok: false, error: 'Purchase not found' });

    // Idempotency: if already completed, just return the current balance.
    if (purchase.status === 'completed') {
      const [[u0]] = await pool.query('SELECT diamonds FROM users WHERE id = ?', [req.userId]);
      return res.json({ ok: true, diamonds: u0.diamonds, credited: 0, alreadyCredited: true });
    }

    await withTransaction(async (conn) => {
      // Re-read inside the txn and lock to avoid double-credit on concurrent calls.
      const [[p]] = await conn.query(
        "SELECT id, status, diamonds FROM purchases WHERE id = ? FOR UPDATE",
        [purchase.id]
      );
      if (p.status === 'completed') return;
      await conn.query(
        "UPDATE purchases SET status='completed', razorpay_payment_id=? WHERE id=?",
        [paymentId, p.id]
      );
      if (p.diamonds > 0) {
        await changeBalance(conn, req.userId, 'diamonds', p.diamonds, 'purchase', p.id);
      }
    });

    const [[u]] = await pool.query('SELECT diamonds FROM users WHERE id = ?', [req.userId]);
    res.json({ ok: true, diamonds: u.diamonds, credited: purchase.diamonds });
  } catch (err) {
    next(err);
  }
}

// GET /api/store/checkout?oid=..&key=..&amt=..&name=..&desc=..
// Serves the Razorpay Standard Web Checkout page. Loaded inside an in-app
// WebView; it posts the result back to React Native via postMessage.
// Contains NO secret — key id and order id are safe to expose.
function checkoutPage(req, res) {
  const esc = (s) => String(s == null ? '' : s).replace(/[<>"'&]/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' }[c]
  ));
  // Pass to JS as JSON strings (safe inside <script>).
  const j = (s) => JSON.stringify(String(s == null ? '' : s));
  // Razorpay's name/description reject emoji & many symbols ("description
  // contains invalid characters"). Keep only a safe ASCII subset.
  const ascii = (s, fallback) => {
    const out = String(s == null ? '' : s).replace(/[^a-zA-Z0-9 _.,:()\-]/g, '').trim();
    return out || fallback;
  };
  const oid = req.query.oid;
  const key = req.query.key;
  const amt = req.query.amt;
  const name = ascii(req.query.name, 'ViralShort');
  const desc = ascii(req.query.desc, 'Buy diamonds');

  res.type('html').send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <title>${esc(name)}</title>
  <style>
    html,body{margin:0;height:100%;background:#0b0b0f;color:#fff;font-family:-apple-system,Roboto,Segoe UI,sans-serif}
    .wrap{height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px}
    .dot{width:34px;height:34px;border:3px solid #2a2a35;border-top-color:#7c3aed;border-radius:50%;animation:spin 1s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    .btn{background:#7c3aed;color:#fff;border:0;border-radius:10px;padding:14px 22px;font-size:16px;font-weight:700}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="dot"></div>
    <div id="msg">Opening secure checkout…</div>
    <button id="retry" class="btn" style="display:none" onclick="start()">Pay now</button>
  </div>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    function post(obj){ try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(obj)); } catch(e){} }
    function showRetry(t){ document.getElementById('msg').textContent = t || 'Tap to pay'; document.getElementById('retry').style.display='block'; }
    function start(){
      document.getElementById('retry').style.display='none';
      document.getElementById('msg').textContent='Opening secure checkout…';
      try {
        var rzp = new Razorpay({
          key: ${j(key)},
          order_id: ${j(oid)},
          amount: ${j(amt)},
          currency: 'INR',
          name: ${j(name)},
          description: ${j(desc)},
          theme: { color: '#7c3aed' },
          handler: function(r){ post({ status:'success', razorpay_payment_id:r.razorpay_payment_id, razorpay_order_id:r.razorpay_order_id, razorpay_signature:r.razorpay_signature }); },
          modal: { ondismiss: function(){ post({ status:'dismissed' }); }, escape: true }
        });
        rzp.on('payment.failed', function(r){ post({ status:'failed', error: r && r.error && r.error.description }); });
        rzp.open();
      } catch (e){ post({ status:'error', error: String(e && e.message || e) }); showRetry('Could not open checkout'); }
    }
    if (typeof Razorpay === 'undefined') { showRetry('Checkout failed to load'); post({ status:'error', error:'checkout.js failed to load' }); }
    else { start(); }
  </script>
</body>
</html>`);
}

module.exports = { createDiamondOrder, verifyDiamondPayment, checkoutPage };
