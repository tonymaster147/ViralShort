const { pool } = require('../config/db');

// Atomically change a user's balance and write a ledger row.
// currency: 'coins' | 'diamonds'; amount can be negative (debit).
// Uses a transaction + balance guard so coins/diamonds never go negative.
async function changeBalance(conn, userId, currency, amount, reason, refId = null) {
  const column = currency === 'diamonds' ? 'diamonds' : 'coins';

  if (amount < 0) {
    // Guarded debit: only succeeds if balance is sufficient.
    const [result] = await conn.query(
      `UPDATE users SET ${column} = ${column} + ? WHERE id = ? AND ${column} >= ?`,
      [amount, userId, -amount]
    );
    if (result.affectedRows === 0) {
      const err = new Error(`Insufficient ${currency}`);
      err.status = 400;
      throw err;
    }
  } else {
    await conn.query(`UPDATE users SET ${column} = ${column} + ? WHERE id = ?`, [amount, userId]);
  }

  await conn.query(
    'INSERT INTO coin_transactions (user_id, currency, amount, reason, ref_id) VALUES (?, ?, ?, ?, ?)',
    [userId, currency, amount, reason, refId]
  );
}

// Run a function inside a DB transaction.
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { changeBalance, withTransaction };
