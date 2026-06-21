const mysql = require('mysql2/promise');
require('dotenv').config();

// Shared connection pool for the whole app.
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'viralshort',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Quick connectivity check used at startup.
async function checkConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SELECT 1');
  } finally {
    conn.release();
  }
}

module.exports = { pool, checkConnection };
