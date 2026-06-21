const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { signToken } = require('../config/jwt');
const { fileUrl } = require('../config/url');

// Shape a DB user row into the public object sent to the app.
function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    avatar: fileUrl(row.avatar_path),
    bio: row.bio,
    coins: row.coins,
    diamonds: row.diamonds,
    createdAt: row.created_at,
  };
}

async function signup(req, res, next) {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ ok: false, error: 'username, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters' });
    }

    // Uniqueness check
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
      [username, email]
    );
    if (existing.length) {
      return res.status(409).json({ ok: false, error: 'Username or email already taken' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password_hash, display_name, coins) VALUES (?, ?, ?, ?, ?)',
      [username, email, hash, username, 50] // welcome bonus: 50 coins
    );

    // Record welcome bonus in the ledger.
    await pool.query(
      'INSERT INTO coin_transactions (user_id, currency, amount, reason) VALUES (?, "coins", 50, "signup_bonus")',
      [result.insertId]
    );

    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    const user = publicUser(rows[0]);
    const token = signToken({ id: user.id });

    res.status(201).json({ ok: true, token, user });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { emailOrUsername, password } = req.body;
    if (!emailOrUsername || !password) {
      return res.status(400).json({ ok: false, error: 'emailOrUsername and password are required' });
    }

    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1',
      [emailOrUsername, emailOrUsername]
    );
    if (!rows.length) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    const row = rows[0];
    const match = await bcrypt.compare(password, row.password_hash);
    if (!match) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [row.id]);

    const user = publicUser(row);
    const token = signToken({ id: user.id });
    res.json({ ok: true, token, user });
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, publicUser };
