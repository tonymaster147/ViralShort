const { pool } = require('../config/db');
const { fileUrl } = require('../config/url');
const { notify } = require('./notificationHelper');

// ---------- LIKES ----------

// POST /api/videos/:id/like  -> toggles like, returns new state + count
async function toggleLike(req, res, next) {
  try {
    const videoId = req.params.id;
    const [[video]] = await pool.query('SELECT user_id FROM videos WHERE id = ?', [videoId]);
    if (!video) return res.status(404).json({ ok: false, error: 'Video not found' });

    const [[existing]] = await pool.query(
      'SELECT 1 AS x FROM likes WHERE user_id = ? AND video_id = ? LIMIT 1',
      [req.userId, videoId]
    );

    let liked;
    if (existing) {
      await pool.query('DELETE FROM likes WHERE user_id = ? AND video_id = ?', [req.userId, videoId]);
      liked = false;
    } else {
      await pool.query('INSERT INTO likes (user_id, video_id) VALUES (?, ?)', [req.userId, videoId]);
      liked = true;
      await notify({ userId: video.user_id, actorId: req.userId, type: 'like', videoId });
    }

    const [[{ c }]] = await pool.query('SELECT COUNT(*) AS c FROM likes WHERE video_id = ?', [videoId]);
    res.json({ ok: true, liked, likeCount: c });
  } catch (err) {
    next(err);
  }
}

// ---------- COMMENTS ----------

function publicComment(row) {
  return {
    id: row.id,
    text: row.text,
    parentId: row.parent_id,
    createdAt: row.created_at,
    replyCount: row.reply_count || 0,
    user: {
      id: row.user_id,
      username: row.username,
      displayName: row.display_name,
      avatar: fileUrl(row.avatar_path),
    },
  };
}

// GET /api/videos/:id/comments  -> top-level comments with reply counts
async function getComments(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, u.username, u.display_name, u.avatar_path,
         (SELECT COUNT(*) FROM comments r WHERE r.parent_id = c.id) AS reply_count
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.video_id = ? AND c.parent_id IS NULL
       ORDER BY c.created_at DESC`,
      [req.params.id]
    );
    res.json({ ok: true, comments: rows.map(publicComment) });
  } catch (err) {
    next(err);
  }
}

// GET /api/comments/:id/replies
async function getReplies(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, u.username, u.display_name, u.avatar_path, 0 AS reply_count
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.parent_id = ? ORDER BY c.created_at ASC`,
      [req.params.id]
    );
    res.json({ ok: true, comments: rows.map(publicComment) });
  } catch (err) {
    next(err);
  }
}

// POST /api/videos/:id/comments  body: { text, parentId? }
async function addComment(req, res, next) {
  try {
    const videoId = req.params.id;
    const text = (req.body.text || '').trim().slice(0, 500);
    const parentId = req.body.parentId || null;
    if (!text) return res.status(400).json({ ok: false, error: 'Comment cannot be empty' });

    const [[video]] = await pool.query('SELECT user_id FROM videos WHERE id = ?', [videoId]);
    if (!video) return res.status(404).json({ ok: false, error: 'Video not found' });

    const [result] = await pool.query(
      'INSERT INTO comments (video_id, user_id, parent_id, text) VALUES (?, ?, ?, ?)',
      [videoId, req.userId, parentId, text]
    );

    // Notify the video owner (and the parent comment author if it's a reply).
    await notify({ userId: video.user_id, actorId: req.userId, type: 'comment', videoId });
    if (parentId) {
      const [[parent]] = await pool.query('SELECT user_id FROM comments WHERE id = ?', [parentId]);
      if (parent) await notify({ userId: parent.user_id, actorId: req.userId, type: 'comment', videoId });
    }

    const [rows] = await pool.query(
      `SELECT c.*, u.username, u.display_name, u.avatar_path, 0 AS reply_count
       FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`,
      [result.insertId]
    );
    res.status(201).json({ ok: true, comment: publicComment(rows[0]) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/comments/:id  (author only)
async function deleteComment(req, res, next) {
  try {
    const [[c]] = await pool.query('SELECT user_id FROM comments WHERE id = ?', [req.params.id]);
    if (!c) return res.status(404).json({ ok: false, error: 'Comment not found' });
    if (c.user_id !== req.userId) return res.status(403).json({ ok: false, error: 'Not your comment' });
    await pool.query('DELETE FROM comments WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ---------- FOLLOWS ----------

// POST /api/users/:id/follow  -> toggle follow
async function toggleFollow(req, res, next) {
  try {
    const targetId = Number(req.params.id);
    if (targetId === req.userId) {
      return res.status(400).json({ ok: false, error: "You can't follow yourself" });
    }
    const [[target]] = await pool.query('SELECT id FROM users WHERE id = ?', [targetId]);
    if (!target) return res.status(404).json({ ok: false, error: 'User not found' });

    const [[existing]] = await pool.query(
      'SELECT 1 AS x FROM follows WHERE follower_id = ? AND following_id = ? LIMIT 1',
      [req.userId, targetId]
    );

    let following;
    if (existing) {
      await pool.query('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [req.userId, targetId]);
      following = false;
    } else {
      await pool.query('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', [req.userId, targetId]);
      following = true;
      await notify({ userId: targetId, actorId: req.userId, type: 'follow' });
    }

    const [[{ c }]] = await pool.query('SELECT COUNT(*) AS c FROM follows WHERE following_id = ?', [targetId]);
    res.json({ ok: true, following, followers: c });
  } catch (err) {
    next(err);
  }
}

// GET /api/users/:id/followers  and  /following
function userListShape(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatar: fileUrl(row.avatar_path),
  };
}

async function getFollowers(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_path
       FROM follows f JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = ? ORDER BY f.created_at DESC`,
      [req.params.id]
    );
    res.json({ ok: true, users: rows.map(userListShape) });
  } catch (err) {
    next(err);
  }
}

async function getFollowing(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_path
       FROM follows f JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = ? ORDER BY f.created_at DESC`,
      [req.params.id]
    );
    res.json({ ok: true, users: rows.map(userListShape) });
  } catch (err) {
    next(err);
  }
}

// ---------- NOTIFICATIONS ----------

// GET /api/notifications
async function getNotifications(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT n.*, a.username AS actor_username, a.display_name AS actor_display, a.avatar_path AS actor_avatar
       FROM notifications n LEFT JOIN users a ON a.id = n.actor_id
       WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 50`,
      [req.userId]
    );
    await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.userId]);
    const notifications = rows.map((r) => ({
      id: r.id,
      type: r.type,
      videoId: r.video_id,
      message: r.message,
      isRead: !!r.is_read,
      createdAt: r.created_at,
      actor: r.actor_id ? {
        id: r.actor_id,
        username: r.actor_username,
        displayName: r.actor_display,
        avatar: fileUrl(r.actor_avatar),
      } : null,
    }));
    res.json({ ok: true, notifications });
  } catch (err) {
    next(err);
  }
}

// GET /api/notifications/unread-count
async function getUnreadCount(req, res, next) {
  try {
    const [[{ c }]] = await pool.query(
      'SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.userId]
    );
    res.json({ ok: true, count: c });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  toggleLike,
  getComments, getReplies, addComment, deleteComment,
  toggleFollow, getFollowers, getFollowing,
  getNotifications, getUnreadCount,
};
