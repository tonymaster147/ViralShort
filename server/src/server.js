const http = require('http');
const app = require('./app');
const { checkConnection } = require('./config/db');
const { attachSockets } = require('./sockets');
require('dotenv').config();

const PORT = Number(process.env.PORT) || 4000;
const server = http.createServer(app);

// Real-time layer (DMs + notifications)
attachSockets(server, app);

(async () => {
  try {
    await checkConnection();
    console.log('[db] Connected to MySQL ✅');
  } catch (err) {
    console.error('[db] MySQL connection FAILED ❌');
    console.error('     ->', err.message);
    console.error('     Make sure XAMPP MySQL is running and the "viralshort" database exists.');
  }

  server.listen(PORT, () => {
    console.log(`[server] ViralShort API running on http://127.0.0.1:${PORT}`);
    console.log(`[server] Health check: http://127.0.0.1:${PORT}/api/health`);
  });
})();
