require('dotenv').config();

const BASE = (process.env.PUBLIC_BASE_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');

// Turn a stored relative path (e.g. "avatars/123.png") into a full URL.
// Returns null if no path. Passes through values already absolute.
function fileUrl(relPath) {
  if (!relPath) return null;
  if (/^https?:\/\//i.test(relPath)) return relPath;
  return `${BASE}/uploads/${relPath}`;
}

module.exports = { fileUrl, BASE };
