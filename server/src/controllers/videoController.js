const { pool } = require('../config/db');
const { fileUrl } = require('../config/url');

// Shape a joined video row into the public object sent to the app.
function publicVideo(row, viewerId) {
  return {
    id: row.id,
    videoUrl: fileUrl(row.video_path),
    thumbUrl: fileUrl(row.thumb_path),
    caption: row.caption,
    filter: row.filter,
    soundId: row.sound_id,
    soundTitle: row.sound_title || null,
    views: row.views,
    likeCount: row.like_count || 0,
    commentCount: row.comment_count || 0,
    liked: !!row.liked,
    createdAt: row.created_at,
    user: {
      id: row.user_id,
      username: row.username,
      displayName: row.display_name,
      avatar: fileUrl(row.avatar_path),
    },
  };
}

// Extract #hashtags from a caption.
function parseHashtags(caption) {
  if (!caption) return [];
  const matches = caption.match(/#([a-zA-Z0-9_]+)/g) || [];
  // unique, lowercased, without the leading #
  return [...new Set(matches.map((h) => h.slice(1).toLowerCase()))];
}

async function attachHashtags(videoId, caption) {
  const tags = parseHashtags(caption);
  for (const name of tags) {
    await pool.query('INSERT IGNORE INTO hashtags (name) VALUES (?)', [name]);
    const [[tag]] = await pool.query('SELECT id FROM hashtags WHERE name = ?', [name]);
    await pool.query(
      'INSERT IGNORE INTO video_hashtags (video_id, hashtag_id) VALUES (?, ?)',
      [videoId, tag.id]
    );
  }
}

// Shared SELECT used by feed/detail/profile so counts + liked are consistent.
function baseSelect(viewerId) {
  return `
    SELECT v.*, u.username, u.display_name, u.avatar_path, s.title AS sound_title,
      (SELECT COUNT(*) FROM likes l WHERE l.video_id = v.id) AS like_count,
      (SELECT COUNT(*) FROM comments c WHERE c.video_id = v.id) AS comment_count,
      ${viewerId ? '(SELECT COUNT(*) FROM likes l2 WHERE l2.video_id = v.id AND l2.user_id = ?)' : '0'} AS liked
    FROM videos v
    JOIN users u ON u.id = v.user_id
    LEFT JOIN sounds s ON s.id = v.sound_id
  `;
}

// POST /api/videos
// multipart fields: video (required), music (optional)
// body: caption, filter, soundId, muteOriginal ("true"/"false")
async function createVideo(req, res, next) {
  const path = require('path');
  const fs = require('fs');
  try {
    // Support both upload.single (req.file) and upload.fields (req.files).
    const videoFile = req.file || req.files?.video?.[0];
    const musicFile = req.files?.music?.[0];
    if (!videoFile) return res.status(400).json({ ok: false, error: 'No video file uploaded' });

    const caption = (req.body.caption || '').slice(0, 500);
    const filter = req.body.filter ? String(req.body.filter).slice(0, 30) : null;
    const soundId = req.body.soundId ? Number(req.body.soundId) : null;
    const muteOriginal = String(req.body.muteOriginal) === 'true';

    let finalFilename = videoFile.filename;

    // If custom music was provided, merge it (mute or mix) into a new file.
    if (musicFile) {
      try {
        const { mergeAudio } = require('../jobs/audioMerge');
        const dir = path.dirname(videoFile.path);
        const mergedName = `merged_${Date.now()}_${Math.round(Math.random() * 1e9)}.mp4`;
        const outPath = path.join(dir, mergedName);
        await mergeAudio({
          videoPath: videoFile.path,
          audioPath: musicFile.path,
          muteOriginal,
          outPath,
        });
        finalFilename = mergedName;
        // cleanup originals
        try { fs.unlinkSync(videoFile.path); } catch (_) {}
      } catch (mergeErr) {
        console.error('[merge] failed, using original video:', mergeErr.message);
        // fall back to the original video if merge fails
      } finally {
        try { if (musicFile) fs.unlinkSync(musicFile.path); } catch (_) {}
      }
    }

    const relPath = `videos/${finalFilename}`;
    const [result] = await pool.query(
      'INSERT INTO videos (user_id, video_path, caption, filter, sound_id) VALUES (?, ?, ?, ?, ?)',
      [req.userId, relPath, caption, filter, soundId]
    );

    await attachHashtags(result.insertId, caption);

    const params = req.userId ? [req.userId, result.insertId] : [result.insertId];
    const [rows] = await pool.query(`${baseSelect(req.userId)} WHERE v.id = ?`, params);
    res.status(201).json({ ok: true, video: publicVideo(rows[0], req.userId) });
  } catch (err) {
    next(err);
  }
}

// GET /api/videos/feed?page=1&limit=10  (For You — newest first)
async function getFeed(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 30);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    const params = req.userId ? [req.userId, limit, offset] : [limit, offset];
    const [rows] = await pool.query(
      `${baseSelect(req.userId)} ORDER BY v.created_at DESC LIMIT ? OFFSET ?`,
      params
    );
    res.json({ ok: true, page, videos: rows.map((r) => publicVideo(r, req.userId)) });
  } catch (err) {
    next(err);
  }
}

// GET /api/videos/following?page=1  (videos from people you follow)
async function getFollowingFeed(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 30);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      `${baseSelect(req.userId)}
       WHERE v.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
       ORDER BY v.created_at DESC LIMIT ? OFFSET ?`,
      [req.userId, req.userId, limit, offset]
    );
    res.json({ ok: true, page, videos: rows.map((r) => publicVideo(r, req.userId)) });
  } catch (err) {
    next(err);
  }
}

// GET /api/videos/user/:id  (a user's videos)
async function getUserVideos(req, res, next) {
  try {
    const params = req.userId ? [req.userId, req.params.id] : [req.params.id];
    const [rows] = await pool.query(
      `${baseSelect(req.userId)} WHERE v.user_id = ? ORDER BY v.created_at DESC`,
      params
    );
    res.json({ ok: true, videos: rows.map((r) => publicVideo(r, req.userId)) });
  } catch (err) {
    next(err);
  }
}

// GET /api/videos/:id
async function getVideo(req, res, next) {
  try {
    const params = req.userId ? [req.userId, req.params.id] : [req.params.id];
    const [rows] = await pool.query(`${baseSelect(req.userId)} WHERE v.id = ?`, params);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Video not found' });
    res.json({ ok: true, video: publicVideo(rows[0], req.userId) });
  } catch (err) {
    next(err);
  }
}

// POST /api/videos/:id/view  (increment view count)
async function addView(req, res, next) {
  try {
    await pool.query('UPDATE videos SET views = views + 1 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/videos/:id  (owner only)
async function deleteVideo(req, res, next) {
  try {
    const [[video]] = await pool.query('SELECT user_id FROM videos WHERE id = ?', [req.params.id]);
    if (!video) return res.status(404).json({ ok: false, error: 'Video not found' });
    if (video.user_id !== req.userId) {
      return res.status(403).json({ ok: false, error: 'Not your video' });
    }
    await pool.query('DELETE FROM videos WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// GET /api/videos/sounds  -> list available soundtracks
async function getSounds(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT id, title, author_name FROM sounds ORDER BY id');
    res.json({ ok: true, sounds: rows.map((s) => ({ id: s.id, title: s.title, author: s.author_name })) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createVideo,
  getFeed,
  getFollowingFeed,
  getUserVideos,
  getVideo,
  addView,
  deleteVideo,
  getSounds,
  publicVideo,
};
