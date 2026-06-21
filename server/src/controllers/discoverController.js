const { pool } = require('../config/db');
const { fileUrl } = require('../config/url');
const { publicVideo } = require('./videoController');

// SELECT shared with the video controller so counts/liked stay consistent.
function videoSelect(viewerId) {
  return `
    SELECT v.*, u.username, u.display_name, u.avatar_path,
      (SELECT COUNT(*) FROM likes l WHERE l.video_id = v.id) AS like_count,
      (SELECT COUNT(*) FROM comments c WHERE c.video_id = v.id) AS comment_count,
      ${viewerId ? '(SELECT COUNT(*) FROM likes l2 WHERE l2.video_id = v.id AND l2.user_id = ?)' : '0'} AS liked
    FROM videos v
    JOIN users u ON u.id = v.user_id
  `;
}

// GET /api/discover/search?q=...&type=all|users|videos|hashtags
async function search(req, res, next) {
  try {
    const q = (req.query.q || '').trim();
    const type = req.query.type || 'all';
    if (!q) return res.json({ ok: true, users: [], videos: [], hashtags: [] });
    const like = `%${q}%`;

    const result = { users: [], videos: [], hashtags: [] };

    if (type === 'all' || type === 'users') {
      const [users] = await pool.query(
        `SELECT id, username, display_name, avatar_path, bio,
           (SELECT COUNT(*) FROM follows f WHERE f.following_id = users.id) AS followers
         FROM users
         WHERE username LIKE ? OR display_name LIKE ?
         ORDER BY followers DESC LIMIT 20`,
        [like, like]
      );
      result.users = users.map((u) => ({
        id: u.id, username: u.username, displayName: u.display_name,
        avatar: fileUrl(u.avatar_path), bio: u.bio, followers: u.followers,
      }));
    }

    if (type === 'all' || type === 'videos') {
      const params = req.userId ? [req.userId, like, 20] : [like, 20];
      const [videos] = await pool.query(
        `${videoSelect(req.userId)} WHERE v.caption LIKE ? ORDER BY v.views DESC LIMIT ?`,
        params
      );
      result.videos = videos.map((v) => publicVideo(v, req.userId));
    }

    if (type === 'all' || type === 'hashtags') {
      const [hashtags] = await pool.query(
        `SELECT h.id, h.name, COUNT(vh.video_id) AS video_count
         FROM hashtags h LEFT JOIN video_hashtags vh ON vh.hashtag_id = h.id
         WHERE h.name LIKE ?
         GROUP BY h.id ORDER BY video_count DESC LIMIT 20`,
        [like]
      );
      result.hashtags = hashtags.map((h) => ({ id: h.id, name: h.name, videoCount: h.video_count }));
    }

    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

// GET /api/discover/trending  -> top videos by views (recent window)
async function trendingVideos(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 60);
    const params = req.userId ? [req.userId, limit] : [limit];
    const [rows] = await pool.query(
      `${videoSelect(req.userId)}
       ORDER BY (v.views + (SELECT COUNT(*) FROM likes l WHERE l.video_id = v.id) * 3) DESC,
                v.created_at DESC
       LIMIT ?`,
      params
    );
    res.json({ ok: true, videos: rows.map((v) => publicVideo(v, req.userId)) });
  } catch (err) {
    next(err);
  }
}

// GET /api/discover/hashtags/trending  -> top hashtags by video count
async function trendingHashtags(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT h.id, h.name, COUNT(vh.video_id) AS video_count
       FROM hashtags h JOIN video_hashtags vh ON vh.hashtag_id = h.id
       GROUP BY h.id ORDER BY video_count DESC LIMIT 20`
    );
    res.json({ ok: true, hashtags: rows.map((h) => ({ id: h.id, name: h.name, videoCount: h.video_count })) });
  } catch (err) {
    next(err);
  }
}

// GET /api/discover/hashtag/:name  -> videos under a hashtag
async function videosByHashtag(req, res, next) {
  try {
    const name = (req.params.name || '').toLowerCase();
    const params = req.userId ? [req.userId, name] : [name];
    const [rows] = await pool.query(
      `${videoSelect(req.userId)}
       JOIN video_hashtags vh ON vh.video_id = v.id
       JOIN hashtags h ON h.id = vh.hashtag_id
       WHERE h.name = ? ORDER BY v.views DESC`,
      params
    );
    const [[tag]] = await pool.query(
      'SELECT COUNT(vh.video_id) AS video_count FROM hashtags h LEFT JOIN video_hashtags vh ON vh.hashtag_id = h.id WHERE h.name = ?',
      [name]
    );
    res.json({
      ok: true,
      hashtag: { name, videoCount: tag ? tag.video_count : 0 },
      videos: rows.map((v) => publicVideo(v, req.userId)),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { search, trendingVideos, trendingHashtags, videosByHashtag };
