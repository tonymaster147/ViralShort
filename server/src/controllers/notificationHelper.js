const { pool } = require('../config/db');

// Create a notification. Never notify yourself.
async function notify({ userId, actorId, type, videoId = null, message = null }) {
  if (!userId || userId === actorId) return;
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, actor_id, type, video_id, message) VALUES (?, ?, ?, ?, ?)',
      [userId, actorId, type, videoId, message]
    );
  } catch (_) {
    // notifications are best-effort
  }
}

module.exports = { notify };
