const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (videos, thumbnails, avatars) statically.
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Health check — Phase 0 round-trip test.
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    app: 'ViralShort API',
    time: new Date().toISOString(),
  });
});

// --- Routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/videos', require('./routes/videos'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/discover', require('./routes/discover'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not found' });
});

// Central error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  // Friendlier message for oversized uploads.
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ ok: false, error: 'Video too large (max 200 MB). Try a shorter clip.' });
  }
  res.status(err.status || 500).json({ ok: false, error: err.message || 'Server error' });
});

module.exports = app;
