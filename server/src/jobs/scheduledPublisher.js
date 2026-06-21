const cron = require('node-cron');
const { pool } = require('../config/db');

// Publish scheduled reels whose time has arrived.
async function publishDue(app) {
  try {
    const [due] = await pool.query(
      "SELECT id, user_id FROM videos WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= NOW()"
    );
    for (const v of due) {
      await pool.query("UPDATE videos SET status = 'ready' WHERE id = ?", [v.id]);
      try {
        const io = app.get('io');
        if (io) io.to(`user:${v.user_id}`).emit('video:ready', { videoId: v.id });
      } catch (_) {}
      console.log(`[scheduler] published scheduled reel #${v.id}`);
    }
  } catch (e) {
    console.error('[scheduler] error:', e.message);
  }
}

// Check every minute.
function startScheduledPublisher(app) {
  publishDue(app);
  cron.schedule('* * * * *', () => publishDue(app));
  console.log('[scheduler] Scheduled-post publisher started (every minute)');
}

module.exports = { startScheduledPublisher, publishDue };
