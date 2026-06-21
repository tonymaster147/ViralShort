const { pool } = require('../config/db');
const { fileUrl } = require('../config/url');

// Normalize a user pair so (a,b) and (b,a) map to the same conversation.
function normalizePair(x, y) {
  return x < y ? [x, y] : [y, x];
}

// Find or create the conversation between two users; returns its id.
async function getOrCreateConversation(meId, otherId) {
  const [a, b] = normalizePair(meId, otherId);
  const [[existing]] = await pool.query(
    'SELECT id FROM conversations WHERE user_a_id = ? AND user_b_id = ? LIMIT 1',
    [a, b]
  );
  if (existing) return existing.id;
  const [result] = await pool.query(
    'INSERT INTO conversations (user_a_id, user_b_id) VALUES (?, ?)',
    [a, b]
  );
  return result.insertId;
}

function userShape(u) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    avatar: fileUrl(u.avatar_path),
  };
}

// GET /api/conversations  -> list with the other user + last message + unread count
async function listConversations(req, res, next) {
  try {
    const me = req.userId;
    const [rows] = await pool.query(
      `SELECT c.id,
         CASE WHEN c.user_a_id = ? THEN c.user_b_id ELSE c.user_a_id END AS other_id
       FROM conversations c
       WHERE c.user_a_id = ? OR c.user_b_id = ?`,
      [me, me, me]
    );

    const conversations = [];
    for (const row of rows) {
      const [[other]] = await pool.query(
        'SELECT id, username, display_name, avatar_path FROM users WHERE id = ?',
        [row.other_id]
      );
      if (!other) continue;
      const [[last]] = await pool.query(
        'SELECT text, sender_id, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1',
        [row.id]
      );
      const [[{ unread }]] = await pool.query(
        'SELECT COUNT(*) AS unread FROM messages WHERE conversation_id = ? AND sender_id <> ? AND is_read = 0',
        [row.id, me]
      );
      conversations.push({
        id: row.id,
        user: userShape(other),
        lastMessage: last ? { text: last.text, fromMe: last.sender_id === me, createdAt: last.created_at } : null,
        unread,
      });
    }

    // newest activity first
    conversations.sort((x, y) => {
      const tx = x.lastMessage ? new Date(x.lastMessage.createdAt) : 0;
      const ty = y.lastMessage ? new Date(y.lastMessage.createdAt) : 0;
      return ty - tx;
    });

    res.json({ ok: true, conversations });
  } catch (err) {
    next(err);
  }
}

// POST /api/conversations  body: { userId }  -> open/create a conversation
async function openConversation(req, res, next) {
  try {
    const otherId = Number(req.body.userId);
    if (!otherId || otherId === req.userId) {
      return res.status(400).json({ ok: false, error: 'Invalid user' });
    }
    const [[other]] = await pool.query('SELECT id, username, display_name, avatar_path FROM users WHERE id = ?', [otherId]);
    if (!other) return res.status(404).json({ ok: false, error: 'User not found' });

    const conversationId = await getOrCreateConversation(req.userId, otherId);
    res.json({ ok: true, conversationId, user: userShape(other) });
  } catch (err) {
    next(err);
  }
}

// GET /api/conversations/:id/messages  -> messages (marks incoming as read)
async function getMessages(req, res, next) {
  try {
    const conversationId = req.params.id;
    // Authorize: requester must be part of the conversation.
    const [[conv]] = await pool.query(
      'SELECT user_a_id, user_b_id FROM conversations WHERE id = ?', [conversationId]
    );
    if (!conv || (conv.user_a_id !== req.userId && conv.user_b_id !== req.userId)) {
      return res.status(403).json({ ok: false, error: 'Not your conversation' });
    }

    const [rows] = await pool.query(
      'SELECT id, sender_id, text, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [conversationId]
    );
    await pool.query(
      'UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id <> ?',
      [conversationId, req.userId]
    );

    const messages = rows.map((m) => ({
      id: m.id,
      text: m.text,
      fromMe: m.sender_id === req.userId,
      senderId: m.sender_id,
      createdAt: m.created_at,
    }));
    res.json({ ok: true, messages });
  } catch (err) {
    next(err);
  }
}

// Persist a message and return it (used by REST + Socket.IO).
async function persistMessage(conversationId, senderId, text) {
  const [result] = await pool.query(
    'INSERT INTO messages (conversation_id, sender_id, text) VALUES (?, ?, ?)',
    [conversationId, senderId, text]
  );
  const [[row]] = await pool.query(
    'SELECT id, sender_id, text, created_at FROM messages WHERE id = ?', [result.insertId]
  );
  return row;
}

// POST /api/conversations/:id/messages  body: { text }
async function sendMessage(req, res, next) {
  try {
    const conversationId = req.params.id;
    const text = (req.body.text || '').trim().slice(0, 1000);
    if (!text) return res.status(400).json({ ok: false, error: 'Message cannot be empty' });

    const [[conv]] = await pool.query(
      'SELECT user_a_id, user_b_id FROM conversations WHERE id = ?', [conversationId]
    );
    if (!conv || (conv.user_a_id !== req.userId && conv.user_b_id !== req.userId)) {
      return res.status(403).json({ ok: false, error: 'Not your conversation' });
    }

    const row = await persistMessage(conversationId, req.userId, text);
    const message = {
      id: row.id, text: row.text, senderId: row.sender_id,
      fromMe: true, createdAt: row.created_at,
    };

    // Emit in real time to the other participant (if socket layer is attached).
    const otherId = conv.user_a_id === req.userId ? conv.user_b_id : conv.user_a_id;
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${otherId}`).emit('message:new', {
        conversationId: Number(conversationId),
        message: { ...message, fromMe: false },
      });
    }

    res.status(201).json({ ok: true, message });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listConversations, openConversation, getMessages, sendMessage,
  getOrCreateConversation, persistMessage, userShape,
};
