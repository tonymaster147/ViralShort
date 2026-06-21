const { pool } = require('../config/db');
const { changeBalance, withTransaction } = require('./walletHelper');

const DAILY_BONUS = 20; // coins per daily claim

// GET /api/wallet  -> balances
async function getWallet(req, res, next) {
  try {
    const [[u]] = await pool.query('SELECT coins, diamonds FROM users WHERE id = ?', [req.userId]);
    res.json({ ok: true, coins: u.coins, diamonds: u.diamonds });
  } catch (err) {
    next(err);
  }
}

// GET /api/wallet/transactions  -> ledger history
async function getTransactions(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT id, currency, amount, reason, created_at FROM coin_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
      [req.userId]
    );
    res.json({
      ok: true,
      transactions: rows.map((r) => ({
        id: r.id, currency: r.currency, amount: r.amount, reason: r.reason, createdAt: r.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/wallet/daily/status  -> can the user claim today?
async function dailyStatus(req, res, next) {
  try {
    const [[row]] = await pool.query(
      `SELECT MAX(created_at) AS last FROM coin_transactions
       WHERE user_id = ? AND reason = 'daily_login'`,
      [req.userId]
    );
    const last = row.last ? new Date(row.last) : null;
    const claimedToday = last && last.toDateString() === new Date().toDateString();
    res.json({ ok: true, canClaim: !claimedToday, amount: DAILY_BONUS });
  } catch (err) {
    next(err);
  }
}

// POST /api/wallet/daily/claim  -> claim daily coins (once per calendar day)
async function claimDaily(req, res, next) {
  try {
    const [[row]] = await pool.query(
      `SELECT MAX(created_at) AS last FROM coin_transactions
       WHERE user_id = ? AND reason = 'daily_login'`,
      [req.userId]
    );
    const last = row.last ? new Date(row.last) : null;
    if (last && last.toDateString() === new Date().toDateString()) {
      return res.status(400).json({ ok: false, error: 'Already claimed today' });
    }

    await withTransaction(async (conn) => {
      await changeBalance(conn, req.userId, 'coins', DAILY_BONUS, 'daily_login');
    });

    const [[u]] = await pool.query('SELECT coins, diamonds FROM users WHERE id = ?', [req.userId]);
    res.json({ ok: true, claimed: DAILY_BONUS, coins: u.coins, diamonds: u.diamonds });
  } catch (err) {
    next(err);
  }
}

module.exports = { getWallet, getTransactions, dailyStatus, claimDaily, DAILY_BONUS };
