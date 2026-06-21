const { pool } = require('../config/db');
const { changeBalance, withTransaction } = require('./walletHelper');
const { notify } = require('./notificationHelper');

// GET /api/gifts/types  -> gift catalog
async function getGiftTypes(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT id, name, coin_cost, diamond_value FROM gift_types ORDER BY coin_cost');
    res.json({
      ok: true,
      gifts: rows.map((g) => ({ id: g.id, name: g.name, coinCost: g.coin_cost, diamondValue: g.diamond_value })),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/gifts/send  body: { giftTypeId, videoId }
// Sender spends coins; creator receives diamonds. Atomic.
async function sendGift(req, res, next) {
  try {
    const giftTypeId = Number(req.body.giftTypeId);
    const videoId = Number(req.body.videoId);
    if (!giftTypeId || !videoId) {
      return res.status(400).json({ ok: false, error: 'giftTypeId and videoId required' });
    }

    const [[gift]] = await pool.query('SELECT * FROM gift_types WHERE id = ?', [giftTypeId]);
    if (!gift) return res.status(404).json({ ok: false, error: 'Gift not found' });

    const [[video]] = await pool.query('SELECT user_id FROM videos WHERE id = ?', [videoId]);
    if (!video) return res.status(404).json({ ok: false, error: 'Video not found' });
    if (video.user_id === req.userId) {
      return res.status(400).json({ ok: false, error: "You can't gift your own video" });
    }

    const creatorId = video.user_id;

    await withTransaction(async (conn) => {
      // 1) sender pays coins (guarded — throws if insufficient)
      await changeBalance(conn, req.userId, 'coins', -gift.coin_cost, 'gift_sent', videoId);
      // 2) creator receives diamonds
      await changeBalance(conn, creatorId, 'diamonds', gift.diamond_value, 'gift_received', videoId);
      // 3) record the gift
      await conn.query(
        'INSERT INTO gifts (gift_type_id, sender_id, creator_id, video_id) VALUES (?, ?, ?, ?)',
        [giftTypeId, req.userId, creatorId, videoId]
      );
    });

    await notify({
      userId: creatorId, actorId: req.userId, type: 'gift', videoId,
      message: `sent you a ${gift.name} (+${gift.diamond_value} 💎)`, app: req.app,
    });

    const [[me]] = await pool.query('SELECT coins, diamonds FROM users WHERE id = ?', [req.userId]);
    res.json({ ok: true, coins: me.coins, diamonds: me.diamonds, gift: { name: gift.name, diamondValue: gift.diamond_value } });
  } catch (err) {
    next(err);
  }
}

// POST /api/gifts/diamond  body: { videoId, amount }
// Directly transfer diamonds from sender to the video's creator.
// Leaderboard ranks by diamonds received (users.diamonds).
async function sendDiamond(req, res, next) {
  try {
    const videoId = Number(req.body.videoId);
    const amount = Math.max(1, Math.min(Number(req.body.amount) || 1, 10000));
    if (!videoId) return res.status(400).json({ ok: false, error: 'videoId required' });

    const [[video]] = await pool.query('SELECT user_id FROM videos WHERE id = ?', [videoId]);
    if (!video) return res.status(404).json({ ok: false, error: 'Video not found' });
    if (video.user_id === req.userId) {
      return res.status(400).json({ ok: false, error: "You can't send diamonds to your own video" });
    }

    const creatorId = video.user_id;

    await withTransaction(async (conn) => {
      // sender spends diamonds (guarded — throws if insufficient)
      await changeBalance(conn, req.userId, 'diamonds', -amount, 'diamond_sent', videoId);
      // creator receives diamonds (ledger entry drives the weekly leaderboard)
      await changeBalance(conn, creatorId, 'diamonds', amount, 'diamond_received', videoId);
    });

    await notify({
      userId: creatorId, actorId: req.userId, type: 'gift', videoId,
      message: `sent you ${amount} 💎`, app: req.app,
    });

    const [[me]] = await pool.query('SELECT coins, diamonds FROM users WHERE id = ?', [req.userId]);
    const [[creator]] = await pool.query('SELECT diamonds FROM users WHERE id = ?', [creatorId]);
    res.json({ ok: true, coins: me.coins, diamonds: me.diamonds, creatorDiamonds: creator.diamonds, amount });
  } catch (err) {
    next(err);
  }
}

module.exports = { getGiftTypes, sendGift, sendDiamond };
