const { pool } = require('../config/db');
const { fileUrl } = require('../config/url');

// Shape a joined video row into the public object sent to the app.
function publicVideo(row, viewerId) {
  return {
    id: row.id,
    videoUrl: fileUrl(row.video_path),
    thumbUrl: fileUrl(row.thumb_path),
    coverUrl: fileUrl(row.cover_path),
    caption: row.caption,
    filter: row.filter,
    soundId: row.sound_id,
    soundTitle: row.sound_title || null,
    status: row.status || 'ready',
    duration: row.duration != null ? Number(row.duration) : null,
    width: row.width || null,
    height: row.height || null,
    allowComments: row.allow_comments == null ? true : !!row.allow_comments,
    allowRemix: row.allow_remix == null ? true : !!row.allow_remix,
    allowDownload: !!row.allow_download,
    views: row.views,
    likeCount: row.like_count || 0,
    commentCount: row.comment_count || 0,
    diamonds: row.diamond_total || 0,
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
      (SELECT COALESCE(SUM(ct.amount),0) FROM coin_transactions ct
         WHERE ct.currency='diamonds' AND ct.amount>0 AND ct.ref_id=v.id
           AND ct.reason IN ('gift_received','diamond_received')) AS diamond_total,
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
    // Music trim: which slice of the uploaded audio to use (seconds).
    const musicStart = req.body.musicStart != null ? Math.max(0, Number(req.body.musicStart)) : 0;
    const musicDuration = req.body.musicDuration != null ? Math.max(0, Number(req.body.musicDuration)) : null;
    // Publish options
    const coverTime = req.body.coverTime != null ? Math.max(0, Number(req.body.coverTime)) : 0;
    const allowComments = req.body.allowComments != null ? (String(req.body.allowComments) === 'true' ? 1 : 0) : 1;
    const allowRemix = req.body.allowRemix != null ? (String(req.body.allowRemix) === 'true' ? 1 : 0) : 1;
    const allowDownload = req.body.allowDownload != null ? (String(req.body.allowDownload) === 'true' ? 1 : 0) : 0;

    let finalFilename = videoFile.filename;
    let finalPath = videoFile.path;

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
          musicStart,
          musicDuration,
          outPath,
        });
        finalFilename = mergedName;
        finalPath = outPath;
        // cleanup originals
        try { fs.unlinkSync(videoFile.path); } catch (_) {}
      } catch (mergeErr) {
        console.error('[merge] failed, using original video:', mergeErr.message);
        // fall back to the original video if merge fails
      } finally {
        try { if (musicFile) fs.unlinkSync(musicFile.path); } catch (_) {}
      }
    }

    // Insert immediately as 'processing' so the request returns fast; the
    // heavy ffmpeg work (compress, cover, thumbnail, probe) runs in background.
    const relPath = `videos/${finalFilename}`;
    const [result] = await pool.query(
      `INSERT INTO videos
         (user_id, video_path, caption, filter, sound_id, status, allow_comments, allow_remix, allow_download)
       VALUES (?, ?, ?, ?, ?, 'processing', ?, ?, ?)`,
      [req.userId, relPath, caption, filter, soundId, allowComments, allowRemix, allowDownload]
    );
    const videoId = result.insertId;

    await attachHashtags(videoId, caption);

    // Respond now with the processing video.
    const params = req.userId ? [req.userId, videoId] : [videoId];
    const [rows] = await pool.query(`${baseSelect(req.userId)} WHERE v.id = ?`, params);
    res.status(201).json({ ok: true, video: publicVideo(rows[0], req.userId) });

    // --- Background processing ---
    processInBackground(req.app, videoId, finalPath, coverTime, req.userId).catch((e) =>
      console.error('[processor] background error:', e.message)
    );
  } catch (err) {
    next(err);
  }
}

// Compress + cover + thumbnail + probe, then mark the video ready and notify.
async function processInBackground(app, videoId, inputPath, coverTime, ownerId) {
  try {
    const { processVideo } = require('../jobs/videoProcessor');
    const out = await processVideo(inputPath, { coverTime });
    await pool.query(
      `UPDATE videos SET video_path=?, thumb_path=?, cover_path=?, duration=?, width=?, height=?, file_size=?, status='ready'
       WHERE id=?`,
      [out.videoRel, out.thumbRel, out.coverRel, out.duration, out.width, out.height, out.fileSize, videoId]
    );
    // Tell the owner their reel is live (feed can refresh / swap the processing card).
    try {
      const io = app.get('io');
      if (io) io.to(`user:${ownerId}`).emit('video:ready', { videoId });
    } catch (_) {}
  } catch (err) {
    console.error('[processor] failed for video', videoId, err.message);
    await pool.query("UPDATE videos SET status='failed' WHERE id=?", [videoId]).catch(() => {});
    try {
      const io = app.get('io');
      if (io) io.to(`user:${ownerId}`).emit('video:failed', { videoId });
    } catch (_) {}
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
      `${baseSelect(req.userId)} WHERE v.status = 'ready' ORDER BY v.created_at DESC LIMIT ? OFFSET ?`,
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
       WHERE v.status = 'ready' AND v.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
       ORDER BY v.created_at DESC LIMIT ? OFFSET ?`,
      [req.userId, req.userId, limit, offset]
    );
    res.json({ ok: true, page, videos: rows.map((r) => publicVideo(r, req.userId)) });
  } catch (err) {
    next(err);
  }
}

// GET /api/videos/user/:id  (a user's videos)
// Owner sees their own processing/failed videos too; others see only 'ready'.
async function getUserVideos(req, res, next) {
  try {
    const isOwner = req.userId && Number(req.userId) === Number(req.params.id);
    const statusClause = isOwner ? '' : "AND v.status = 'ready'";
    const params = req.userId ? [req.userId, req.params.id] : [req.params.id];
    const [rows] = await pool.query(
      `${baseSelect(req.userId)} WHERE v.user_id = ? ${statusClause} ORDER BY v.created_at DESC`,
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
    const [[v]] = await pool.query('SELECT views FROM videos WHERE id = ?', [req.params.id]);
    if (v) {
      const { emitVideoStats } = require('../sockets');
      emitVideoStats(req.app, req.params.id, { views: v.views });
    }
    res.json({ ok: true, views: v ? v.views : undefined });
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

// POST /api/videos/:id/cover  body: { coverTime }  (owner only)
// Regenerate the cover (and thumbnail) from a chosen timestamp.
async function setCover(req, res, next) {
  try {
    const [[video]] = await pool.query('SELECT user_id, video_path FROM videos WHERE id = ?', [req.params.id]);
    if (!video) return res.status(404).json({ ok: false, error: 'Video not found' });
    if (video.user_id !== req.userId) return res.status(403).json({ ok: false, error: 'Not your video' });

    const path = require('path');
    const coverTime = Math.max(0, Number(req.body.coverTime) || 0);
    const abs = path.join(__dirname, '..', '..', 'uploads', video.video_path.replace(/^videos\//, 'videos/'));
    const { extractCover, extractThumb } = require('../jobs/videoProcessor');
    const [coverRel, thumbRel] = await Promise.all([
      extractCover(abs, coverTime),
      extractThumb(abs, Math.max(1, coverTime)),
    ]);
    await pool.query('UPDATE videos SET cover_path=?, thumb_path=? WHERE id=?', [coverRel, thumbRel, req.params.id]);
    res.json({ ok: true, coverUrl: fileUrl(coverRel), thumbUrl: fileUrl(thumbRel) });
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
  setCover,
  publicVideo,
};
