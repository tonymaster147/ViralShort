const { pool } = require('../config/db');

// Create a notification. Never notify yourself.
// Pass `app` to also emit a real-time 'notification:new' event.
async function notify({ userId, actorId, type, videoId = null, message = null, app = null }) {
  if (!userId || userId === actorId) return;
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, actor_id, type, video_id, message) VALUES (?, ?, ?, ?, ?)',
      [userId, actorId, type, videoId, message]
    );
    if (app) {
      const io = app.get('io');
      if (io) io.to(`user:${userId}`).emit('notification:new', { type, videoId });
    }
  } catch (_) {
    // notifications are best-effort
  }
}

module.exports = { notify };
