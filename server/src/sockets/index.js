const { Server } = require('socket.io');
const { verifyToken } = require('../config/jwt');
const { pool } = require('../config/db');
const { persistMessage } = require('../controllers/messageController');

// Attach Socket.IO to the HTTP server and wire real-time messaging.
function attachSockets(server, app) {
  const io = new Server(server, { cors: { origin: '*' } });

  // Make io reachable from REST controllers (req.app.get('io')).
  app.set('io', io);

  // Auth handshake: client sends { auth: { token } }.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));
    try {
      socket.userId = verifyToken(token).id;
      next();
    } catch (_) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const me = socket.userId;
    socket.join(`user:${me}`); // personal room for DMs + notifications

    // Typing indicator relay
    socket.on('typing', ({ toUserId, conversationId, typing }) => {
      io.to(`user:${toUserId}`).emit('typing', { conversationId, userId: me, typing });
    });

    // Real-time send (alternative to the REST endpoint).
    socket.on('message:send', async ({ conversationId, text }, ack) => {
      try {
        const clean = (text || '').trim().slice(0, 1000);
        if (!clean) return ack?.({ ok: false, error: 'Empty message' });

        const [[conv]] = await pool.query(
          'SELECT user_a_id, user_b_id FROM conversations WHERE id = ?', [conversationId]
        );
        if (!conv || (conv.user_a_id !== me && conv.user_b_id !== me)) {
          return ack?.({ ok: false, error: 'Not your conversation' });
        }

        const row = await persistMessage(conversationId, me, clean);
        const base = { id: row.id, text: row.text, senderId: row.sender_id, createdAt: row.created_at };
        const otherId = conv.user_a_id === me ? conv.user_b_id : conv.user_a_id;

        io.to(`user:${otherId}`).emit('message:new', {
          conversationId: Number(conversationId),
          message: { ...base, fromMe: false },
        });
        ack?.({ ok: true, message: { ...base, fromMe: true } });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on('disconnect', () => {});
  });

  return io;
}

// Helper for REST controllers to push a notification in real time.
function emitNotification(app, userId, payload) {
  const io = app.get('io');
  if (io) io.to(`user:${userId}`).emit('notification:new', payload);
}

module.exports = { attachSockets, emitNotification };
