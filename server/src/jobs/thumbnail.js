const path = require('path');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);

const THUMBS_DIR = path.join(__dirname, '..', '..', 'uploads', 'thumbs');
fs.mkdirSync(THUMBS_DIR, { recursive: true });

// Capture a single frame near the start of the video as a JPG thumbnail.
// Resolves with the thumbnail filename, or null on failure.
function generateThumbnail(videoPath) {
  return new Promise((resolve) => {
    const filename = `thumb_${Date.now()}_${Math.round(Math.random() * 1e9)}.jpg`;
    ffmpeg(videoPath)
      .on('end', () => resolve(filename))
      .on('error', (err) => {
        console.error('[thumb] failed:', err.message);
        resolve(null);
      })
      .screenshots({
        timestamps: ['00:00:01'], // 1s in (avoids black first frame)
        filename,
        folder: THUMBS_DIR,
        size: '480x?', // width 480, keep aspect ratio
      });
  });
}

module.exports = { generateThumbnail };
