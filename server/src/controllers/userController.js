const { pool } = require('../config/db');
const { publicUser } = require('./authController');

// Attach follower/following/video counts to a public user object.
async function withCounts(user) {
  if (!user) return null;
  const [[followers]] = await pool.query(
    'SELECT COUNT(*) AS c FROM follows WHERE following_id = ?', [user.id]
  );
  const [[following]] = await pool.query(
    'SELECT COUNT(*) AS c FROM follows WHERE follower_id = ?', [user.id]
  );
  const [[videos]] = await pool.query(
    'SELECT COUNT(*) AS c FROM videos WHERE user_id = ?', [user.id]
  );
  return {
    ...user,
    followers: followers.c,
    following: following.c,
    videoCount: videos.c,
  };
}

// GET /api/users/me
async function getMe(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.userId]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'User not found' });
    const user = await withCounts(publicUser(rows[0]));
    res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
}

// GET /api/users/:id
async function getUserById(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'User not found' });
    const user = await withCounts(publicUser(rows[0]));

    // Is the requester following this user?
    let isFollowing = false;
    if (req.userId) {
      const [[f]] = await pool.query(
        'SELECT 1 AS x FROM follows WHERE follower_id = ? AND following_id = ? LIMIT 1',
        [req.userId, req.params.id]
      );
      isFollowing = !!f;
    }
    res.json({ ok: true, user: { ...user, isFollowing } });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/users/me
async function updateMe(req, res, next) {
  try {
    const { displayName, bio } = req.body;
    const fields = [];
    const values = [];
    if (displayName !== undefined) { fields.push('display_name = ?'); values.push(displayName); }
    if (bio !== undefined) { fields.push('bio = ?'); values.push(bio); }

    if (fields.length) {
      values.push(req.userId);
      await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.userId]);
    const user = await withCounts(publicUser(rows[0]));
    res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
}

// POST /api/users/me/avatar  (multipart, field name "avatar")
async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No avatar file uploaded' });
    const relPath = `avatars/${req.file.filename}`;
    await pool.query('UPDATE users SET avatar_path = ? WHERE id = ?', [relPath, req.userId]);

    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.userId]);
    const user = await withCounts(publicUser(rows[0]));
    res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMe, getUserById, updateMe, uploadAvatar, withCounts };
