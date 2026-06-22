const { pool } = require('../config/db');
const { fileUrl } = require('../config/url');
const { changeBalance, withTransaction } = require('./walletHelper');

// ---------- LEADERBOARD ----------

// GET /api/leaderboard?period=all|week  -> top creators by diamonds
async function getLeaderboard(req, res, next) {
  try {
    const period = req.query.period === 'week' ? 'week' : 'all';
    let rows;
    if (period === 'week') {
      // diamonds RECEIVED in the last 7 days (gift_received + diamond_received),
      // taken straight from the ledger so direct sends + coin-gifts both count.
      [rows] = await pool.query(
        `SELECT u.id, u.username, u.display_name, u.avatar_path,
                COALESCE(SUM(ct.amount), 0) AS score
         FROM coin_transactions ct
         JOIN users u ON u.id = ct.user_id
         WHERE ct.currency = 'diamonds' AND ct.amount > 0
           AND ct.reason IN ('gift_received','diamond_received','contest_reward')
           AND ct.created_at >= (NOW() - INTERVAL 7 DAY)
         GROUP BY u.id ORDER BY score DESC LIMIT 50`
      );
    } else {
      [rows] = await pool.query(
        `SELECT id, username, display_name, avatar_path, diamonds AS score
         FROM users WHERE diamonds > 0 ORDER BY diamonds DESC LIMIT 50`
      );
    }
    res.json({
      ok: true, period,
      leaders: rows.map((r, i) => ({
        rank: i + 1,
        id: r.id, username: r.username, displayName: r.display_name,
        avatar: fileUrl(r.avatar_path), score: Number(r.score),
      })),
    });
  } catch (err) {
    next(err);
  }
}

// ---------- CONTEST ----------

// GET /api/contest/current  -> active contest + standings
async function getCurrentContest(req, res, next) {
  try {
    const [[contest]] = await pool.query(
      `SELECT * FROM contests WHERE status = 'active' ORDER BY id DESC LIMIT 1`
    );
    if (!contest) return res.json({ ok: true, contest: null, entries: [] });

    // Live standings: score = likes*3 + views + gifts_diamonds*5 for videos posted during the contest.
    const [entries] = await pool.query(
      `SELECT v.id AS video_id, v.caption, v.views, u.id AS user_id, u.username, u.display_name, u.avatar_path,
         (SELECT COUNT(*) FROM likes l WHERE l.video_id = v.id) AS likes,
         (SELECT COALESCE(SUM(gt.diamond_value),0) FROM gifts g JOIN gift_types gt ON gt.id=g.gift_type_id WHERE g.video_id = v.id) AS gift_diamonds
       FROM videos v JOIN users u ON u.id = v.user_id
       WHERE v.created_at BETWEEN ? AND ?
       ORDER BY (
         (SELECT COUNT(*) FROM likes l WHERE l.video_id = v.id) * 3
         + v.views
         + (SELECT COALESCE(SUM(gt.diamond_value),0) FROM gifts g JOIN gift_types gt ON gt.id=g.gift_type_id WHERE g.video_id = v.id) * 5
       ) DESC
       LIMIT 20`,
      [contest.starts_at, contest.ends_at]
    );

    res.json({
      ok: true,
      contest: {
        id: contest.id, title: contest.title,
        startsAt: contest.starts_at, endsAt: contest.ends_at, status: contest.status,
      },
      entries: entries.map((e, i) => ({
        rank: i + 1,
        videoId: e.video_id, caption: e.caption, views: e.views, likes: e.likes,
        score: e.likes * 3 + e.views + Number(e.gift_diamonds) * 5,
        user: { id: e.user_id, username: e.username, displayName: e.display_name, avatar: fileUrl(e.avatar_path) },
      })),
    });
  } catch (err) {
    next(err);
  }
}

// ---------- PURCHASES (mock checkout) ----------

// GET /api/store/packs  -> coin/diamond packs
async function getPacks(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT id, name, coins, diamonds, price_cents FROM coin_packs ORDER BY price_cents');
    res.json({
      ok: true,
      packs: rows.map((p) => ({
        id: p.id, name: p.name, coins: p.coins, diamonds: p.diamonds,
        priceCents: p.price_cents, currency: 'INR',
        priceLabel: `₹${Math.round(p.price_cents / 100)}`,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/store/buy  body: { packId }  -> mock purchase, credits the pack
async function buyPack(req, res, next) {
  try {
    const packId = Number(req.body.packId);
    const [[pack]] = await pool.query('SELECT * FROM coin_packs WHERE id = ?', [packId]);
    if (!pack) return res.status(404).json({ ok: false, error: 'Pack not found' });

    await withTransaction(async (conn) => {
      const [purchase] = await conn.query(
        "INSERT INTO purchases (user_id, pack_id, status) VALUES (?, ?, 'completed')",
        [req.userId, packId]
      );
      if (pack.coins > 0) {
        await changeBalance(conn, req.userId, 'coins', pack.coins, 'purchase', purchase.insertId);
      }
      if (pack.diamonds > 0) {
        await changeBalance(conn, req.userId, 'diamonds', pack.diamonds, 'purchase', purchase.insertId);
      }
    });

    const [[u]] = await pool.query('SELECT coins, diamonds FROM users WHERE id = ?', [req.userId]);
    res.json({ ok: true, coins: u.coins, diamonds: u.diamonds, purchased: { coins: pack.coins, diamonds: pack.diamonds } });
  } catch (err) {
    next(err);
  }
}

module.exports = { getLeaderboard, getCurrentContest, getPacks, buyPack };
