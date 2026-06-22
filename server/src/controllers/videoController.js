const { pool } = require('../config/db');
const { fileUrl } = require('../config/url');

// Shape a joined video row into the public object sent to the app.
function publicVideo(row, viewerId) {
  return {
    id: row.id,
    videoUrl: fileUrl(row.video_path),
    hlsUrl: fileUrl(row.hls_path),
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
    locationName: row.location_name || null,
    scheduledAt: row.scheduled_at || null,
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
    // Source video: a single 'video' (gallery) OR multiple 'clips' (camera) to join.
    const clipFiles = req.files?.clips || [];
    let videoFile = req.file || req.files?.video?.[0];

    // Optional per-clip edit metadata (trim/speed/rotate/crop, image clips).
    let clipMeta = null;
    if (req.body.clipMeta) { try { clipMeta = JSON.parse(req.body.clipMeta); } catch (_) { clipMeta = null; } }

    if (!videoFile && clipFiles.length > 0) {
      if (Array.isArray(clipMeta) && clipMeta.length) {
        // Gallery/clip-editor path: trim/speed/rotate/crop + image->clip, then concat.
        try {
          const { buildFromClips } = require('../jobs/prepareClips');
          const built = await buildFromClips(clipFiles.map((f) => f.path), clipMeta);
          videoFile = { path: built.outPath, filename: built.outName };
        } catch (prepErr) {
          console.error('[prepare] failed:', prepErr.message);
          return res.status(500).json({ ok: false, error: 'Could not process clips' });
        }
      } else if (clipFiles.length === 1) {
        videoFile = clipFiles[0];
      } else {
        // Camera path (no per-clip edits): simple concat.
        try {
          const { joinClips } = require('../jobs/concatClips');
          const joined = await joinClips(clipFiles.map((f) => f.path));
          videoFile = { path: joined.outPath, filename: joined.outName };
        } catch (joinErr) {
          console.error('[concat] failed:', joinErr.message);
          return res.status(500).json({ ok: false, error: 'Could not join clips' });
        }
      }
    }

    const musicFile = req.files?.music?.[0];
    const voiceFile = req.files?.voiceover?.[0];
    if (!videoFile) return res.status(400).json({ ok: false, error: 'No video file uploaded' });

    const caption = (req.body.caption || '').slice(0, 500);
    const filter = req.body.filter ? String(req.body.filter).slice(0, 30) : null;
    const soundId = req.body.soundId ? Number(req.body.soundId) : null;
    const muteOriginal = String(req.body.muteOriginal) === 'true';
    // Music trim: which slice of the uploaded audio to use (seconds).
    const musicStart = req.body.musicStart != null ? Math.max(0, Number(req.body.musicStart)) : 0;
    const musicDuration = req.body.musicDuration != null ? Math.max(0, Number(req.body.musicDuration)) : null;
    // Volume controls (0..1)
    const clampVol = (v, d) => (v != null && !isNaN(Number(v)) ? Math.max(0, Math.min(2, Number(v))) : d);
    const originalVolume = muteOriginal ? 0 : clampVol(req.body.originalVolume, 1);
    const musicVolume = clampVol(req.body.musicVolume, 1);
    const voiceVolume = clampVol(req.body.voiceVolume, 1);
    // Editor overlay (text/stickers/drawing) — JSON string of normalized layers.
    let overlay = null;
    if (req.body.overlay) {
      try { overlay = JSON.parse(req.body.overlay); } catch (_) { overlay = null; }
    }
    // Publish options
    const coverTime = req.body.coverTime != null ? Math.max(0, Number(req.body.coverTime)) : 0;
    const allowComments = req.body.allowComments != null ? (String(req.body.allowComments) === 'true' ? 1 : 0) : 1;
    const allowRemix = req.body.allowRemix != null ? (String(req.body.allowRemix) === 'true' ? 1 : 0) : 1;
    const allowDownload = req.body.allowDownload != null ? (String(req.body.allowDownload) === 'true' ? 1 : 0) : 0;
    // Location + schedule
    const locationName = req.body.locationName ? String(req.body.locationName).slice(0, 150) : null;
    const locationLat = req.body.locationLat != null && req.body.locationLat !== '' ? Number(req.body.locationLat) : null;
    const locationLng = req.body.locationLng != null && req.body.locationLng !== '' ? Number(req.body.locationLng) : null;
    let scheduledAt = null;
    if (req.body.scheduledAt) {
      const d = new Date(req.body.scheduledAt);
      if (!isNaN(d.getTime()) && d.getTime() > Date.now() + 30000) scheduledAt = d; // must be >30s in the future
    }

    // Resolve the added music source: device music file takes precedence,
    // else a catalog sound that has an audio file.
    let musicPath = musicFile ? musicFile.path : null;
    if (!musicPath && soundId) {
      const [[snd]] = await pool.query('SELECT audio_path FROM sounds WHERE id = ?', [soundId]);
      if (snd?.audio_path) {
        musicPath = path.join(__dirname, '..', '..', 'uploads', snd.audio_path);
      }
    }

    // Build the track list for the mixer.
    const tracks = [];
    if (musicPath) tracks.push({ path: musicPath, start: musicStart, duration: musicDuration, volume: musicVolume });
    if (voiceFile) tracks.push({ path: voiceFile.path, start: 0, duration: null, volume: voiceVolume });

    let finalFilename = videoFile.filename;
    let finalPath = videoFile.path;

    // Merge if there's any added track OR the user changed the original volume.
    const needsMerge = tracks.length > 0 || originalVolume !== 1;
    if (needsMerge) {
      try {
        const { mergeAudio } = require('../jobs/audioMerge');
        const dir = path.dirname(videoFile.path);
        const mergedName = `merged_${Date.now()}_${Math.round(Math.random() * 1e9)}.mp4`;
        const outPath = path.join(dir, mergedName);
        await mergeAudio({ videoPath: videoFile.path, originalVolume, tracks, outPath });
        finalFilename = mergedName;
        finalPath = outPath;
        try { fs.unlinkSync(videoFile.path); } catch (_) {}
      } catch (mergeErr) {
        console.error('[merge] failed, using original video:', mergeErr.message);
      } finally {
        try { if (musicFile) fs.unlinkSync(musicFile.path); } catch (_) {}
        try { if (voiceFile) fs.unlinkSync(voiceFile.path); } catch (_) {}
      }
    }

    // Bump usage_count for a catalog sound that was actually used.
    if (soundId) {
      pool.query('UPDATE sounds SET usage_count = usage_count + 1 WHERE id = ?', [soundId]).catch(() => {});
    }

    // Insert immediately as 'processing' so the request returns fast; the
    // heavy ffmpeg work (compress, cover, thumbnail, probe) runs in background.
    const relPath = `videos/${finalFilename}`;
    const [result] = await pool.query(
      `INSERT INTO videos
         (user_id, video_path, caption, filter, sound_id, status, allow_comments, allow_remix, allow_download,
          has_voiceover, location_name, location_lat, location_lng, scheduled_at)
       VALUES (?, ?, ?, ?, ?, 'processing', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.userId, relPath, caption, filter, soundId, allowComments, allowRemix, allowDownload,
       voiceFile ? 1 : 0, locationName, locationLat, locationLng, scheduledAt]
    );
    const videoId = result.insertId;

    await attachHashtags(videoId, caption);
    await attachMentions(req.app, videoId, caption, req.body.mentions, req.userId);

    // Respond now with the processing video.
    const params = req.userId ? [req.userId, videoId] : [videoId];
    const [rows] = await pool.query(`${baseSelect(req.userId)} WHERE v.id = ?`, params);
    res.status(201).json({ ok: true, video: publicVideo(rows[0], req.userId) });

    // --- Background processing --- (final status: 'scheduled' if scheduled, else 'ready')
    processInBackground(req.app, videoId, finalPath, coverTime, req.userId, !!scheduledAt, overlay).catch((e) =>
      console.error('[processor] background error:', e.message)
    );
  } catch (err) {
    next(err);
  }
}

// Parse @mentions from the caption + explicit list, store them, and notify.
async function attachMentions(app, videoId, caption, explicit, actorId) {
  const { notify } = require('./notificationHelper');
  const names = new Set();
  (caption?.match(/@([a-zA-Z0-9_]+)/g) || []).forEach((m) => names.add(m.slice(1).toLowerCase()));
  if (explicit) {
    String(explicit).split(',').map((s) => s.trim().replace(/^@/, '').toLowerCase()).filter(Boolean).forEach((n) => names.add(n));
  }
  for (const name of names) {
    const [[u]] = await pool.query('SELECT id FROM users WHERE LOWER(username) = ? LIMIT 1', [name]);
    if (!u || u.id === actorId) continue;
    await pool.query('INSERT IGNORE INTO mentions (video_id, user_id) VALUES (?, ?)', [videoId, u.id]);
    await notify({ userId: u.id, actorId, type: 'mention', videoId, message: 'mentioned you in a reel', app });
  }
}

// Compress + overlay-bake + cover + thumbnail + probe, then mark ready/scheduled and notify.
async function processInBackground(app, videoId, inputPath, coverTime, ownerId, scheduled = false, overlay = null) {
  try {
    const { processVideo } = require('../jobs/videoProcessor');
    const out = await processVideo(inputPath, { coverTime, overlay });
    const finalStatus = scheduled ? 'scheduled' : 'ready';
    await pool.query(
      `UPDATE videos SET video_path=?, thumb_path=?, cover_path=?, duration=?, width=?, height=?, file_size=?, status=?
       WHERE id=?`,
      [out.videoRel, out.thumbRel, out.coverRel, out.duration, out.width, out.height, out.fileSize, finalStatus, videoId]
    );
    // Tell the owner (scheduled posts won't appear in feed until due).
    try {
      const io = app.get('io');
      if (io) io.to(`user:${ownerId}`).emit(scheduled ? 'video:scheduled' : 'video:ready', { videoId });
    } catch (_) {}

    // Optional HLS (off by default — the faststart 720p MP4 starts faster for short
    // clips). Enable with HLS_ENABLED=true once you move to ABR + a CDN.
    if (process.env.HLS_ENABLED === 'true') {
      (async () => {
        try {
          const path = require('path');
          const { generateHls } = require('../jobs/hlsGenerator');
          const abs = path.join(__dirname, '..', '..', 'uploads', out.videoRel);
          const hlsRel = await generateHls(abs, videoId);
          if (hlsRel) await pool.query('UPDATE videos SET hls_path = ? WHERE id = ?', [hlsRel, videoId]);
        } catch (e) {
          console.error('[hls] error:', e.message);
        }
      })();
    }
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

// Shape a sound row (+ optional saved flag).
function publicSound(s, savedSet) {
  return {
    id: s.id,
    title: s.title,
    author: s.author_name,
    audioUrl: fileUrl(s.audio_path),
    artUrl: fileUrl(s.art_path),
    duration: s.duration != null ? Number(s.duration) : null,
    usageCount: s.usage_count || 0,
    trending: !!s.is_trending,
    saved: savedSet ? savedSet.has(s.id) : undefined,
  };
}

async function savedSetFor(userId) {
  if (!userId) return new Set();
  const [rows] = await pool.query('SELECT sound_id FROM saved_sounds WHERE user_id = ?', [userId]);
  return new Set(rows.map((r) => r.sound_id));
}

// GET /api/videos/sounds  -> full catalog (with saved flag if authed)
async function getSounds(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM sounds ORDER BY usage_count DESC, id');
    const saved = await savedSetFor(req.userId);
    res.json({ ok: true, sounds: rows.map((s) => publicSound(s, saved)) });
  } catch (err) {
    next(err);
  }
}

// GET /api/videos/sounds/trending
async function getTrendingSounds(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM sounds WHERE is_trending = 1 ORDER BY usage_count DESC LIMIT 30'
    );
    const saved = await savedSetFor(req.userId);
    res.json({ ok: true, sounds: rows.map((s) => publicSound(s, saved)) });
  } catch (err) {
    next(err);
  }
}

// GET /api/videos/sounds/search?q=
async function searchSounds(req, res, next) {
  try {
    const q = `%${(req.query.q || '').trim()}%`;
    const [rows] = await pool.query(
      'SELECT * FROM sounds WHERE title LIKE ? OR author_name LIKE ? ORDER BY usage_count DESC LIMIT 30',
      [q, q]
    );
    const saved = await savedSetFor(req.userId);
    res.json({ ok: true, sounds: rows.map((s) => publicSound(s, saved)) });
  } catch (err) {
    next(err);
  }
}

// GET /api/videos/sounds/saved  (auth)
async function getSavedSounds(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT s.* FROM saved_sounds ss JOIN sounds s ON s.id = ss.sound_id
       WHERE ss.user_id = ? ORDER BY ss.created_at DESC`,
      [req.userId]
    );
    res.json({ ok: true, sounds: rows.map((s) => publicSound(s, new Set(rows.map((r) => r.id)))) });
  } catch (err) {
    next(err);
  }
}

// POST /api/videos/sounds/:id/save  (auth) -> toggle saved
async function toggleSavedSound(req, res, next) {
  try {
    const soundId = Number(req.params.id);
    const [[exists]] = await pool.query(
      'SELECT 1 AS x FROM saved_sounds WHERE user_id = ? AND sound_id = ? LIMIT 1',
      [req.userId, soundId]
    );
    let saved;
    if (exists) {
      await pool.query('DELETE FROM saved_sounds WHERE user_id = ? AND sound_id = ?', [req.userId, soundId]);
      saved = false;
    } else {
      await pool.query('INSERT IGNORE INTO saved_sounds (user_id, sound_id) VALUES (?, ?)', [req.userId, soundId]);
      saved = true;
    }
    res.json({ ok: true, saved });
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
  getTrendingSounds,
  searchSounds,
  getSavedSounds,
  toggleSavedSound,
  setCover,
  publicVideo,
};
