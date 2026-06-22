-- ============================================================
--  Migration 004 — Diamonds-only economy + Razorpay checkout
--  Idempotent. Run after 003.
-- ============================================================
USE viralshort;

-- Purchases now track the Razorpay order/payment + how many diamonds were credited.
ALTER TABLE purchases
  MODIFY COLUMN status ENUM('created','pending','completed','failed') NOT NULL DEFAULT 'created',
  ADD COLUMN IF NOT EXISTS razorpay_order_id   VARCHAR(64) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(64) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS diamonds            INT NOT NULL DEFAULT 0;

ALTER TABLE purchases ADD INDEX IF NOT EXISTS idx_rzp_order (razorpay_order_id);

-- Packs are diamond-only now (coins removed from the product).
UPDATE coin_packs SET coins = 0;

-- Redefine the catalog as diamond packs (₹ price in paise = price_cents).
-- Re-runnable: clears and reseeds. Safe because purchases keep their own
-- diamonds/price snapshot and only reference pack_id for display.
INSERT INTO coin_packs (id, name, coins, diamonds, price_cents) VALUES
  (1, 'Pocket',   0, 50,   4900),    -- ₹49
  (2, 'Starter',  0, 120,  9900),    -- ₹99
  (3, 'Popular',  0, 650,  49900),   -- ₹499   (bonus value)
  (4, 'Mega',     0, 1400, 99900),   -- ₹999
  (5, 'Pro',      0, 3000, 199900)   -- ₹1999
ON DUPLICATE KEY UPDATE
  name = VALUES(name), coins = 0, diamonds = VALUES(diamonds), price_cents = VALUES(price_cents);
