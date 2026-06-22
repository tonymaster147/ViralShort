const cron = require('node-cron');
const { pool } = require('../config/db');
const { changeBalance, withTransaction } = require('../controllers/walletHelper');
const { notify } = require('../controllers/notificationHelper');

// Reward tiers (diamonds) for the top 3 contest winners.
const REWARDS = [
  { diamonds: 500 }, // 1st
  { diamonds: 200 }, // 2nd
  { diamonds: 100 }, // 3rd
];

// Ensure there is an active contest; create a 7-day one if none.
async function ensureActiveContest() {
  const [[active]] = await pool.query(`SELECT id FROM contests WHERE status = 'active' LIMIT 1`);
  if (active) return active.id;

  const [result] = await pool.query(
    `INSERT INTO contests (title, starts_at, ends_at, status)
     VALUES (?, NOW(), (NOW() + INTERVAL 7 DAY), 'active')`,
    ['Weekly Viral Contest']
  );
  console.log('[contest] Started new weekly contest #' + result.insertId);
  return result.insertId;
}

// Close contests whose end time has passed and pay out winners.
async function closeFinishedContests(app) {
  const [contests] = await pool.query(
    `SELECT * FROM contests WHERE status = 'active' AND ends_at <= NOW()`
  );

  for (const contest of contests) {
    // Compute final standings (same formula as live standings).
    const [winners] = await pool.query(
      `SELECT v.id AS video_id, v.user_id,
         ((SELECT COUNT(*) FROM likes l WHERE l.video_id = v.id) * 3
          + v.views
          + (SELECT COALESCE(SUM(gt.diamond_value),0) FROM gifts g JOIN gift_types gt ON gt.id=g.gift_type_id WHERE g.video_id = v.id) * 5) AS score
       FROM videos v
       WHERE v.created_at BETWEEN ? AND ?
       ORDER BY score DESC LIMIT 3`,
      [contest.starts_at, contest.ends_at]
    );

    await withTransaction(async (conn) => {
      for (let i = 0; i < winners.length; i++) {
        const w = winners[i];
        const reward = REWARDS[i];
        // record entry + rank
        await conn.query(
          'INSERT IGNORE INTO contest_entries (contest_id, video_id, user_id, score, rank) VALUES (?, ?, ?, ?, ?)',
          [contest.id, w.video_id, w.user_id, w.score, i + 1]
        );
        if (reward.diamonds) await changeBalance(conn, w.user_id, 'diamonds', reward.diamonds, 'contest_reward', contest.id);
      }
      await conn.query(`UPDATE contests SET status = 'closed' WHERE id = ?`, [contest.id]);
    });

    // Notify winners
    for (let i = 0; i < winners.length; i++) {
      await notify({
        userId: winners[i].user_id, actorId: null, type: 'system',
        message: `🏆 You placed #${i + 1} in "${contest.title}"! Rewards added to your wallet.`,
        app,
      });
    }
    console.log(`[contest] Closed contest #${contest.id}, paid ${winners.length} winners`);
  }

  // Always make sure a fresh contest is running.
  await ensureActiveContest();
}

// Start the scheduler. Runs hourly; also runs once at boot.
function startContestEngine(app) {
  const run = () => closeFinishedContests(app).catch((e) => console.error('[contest] error', e.message));
  run(); // on boot
  cron.schedule('0 * * * *', run); // every hour
  console.log('[contest] Engine started (hourly check)');
}

module.exports = { startContestEngine, ensureActiveContest, closeFinishedContests };
