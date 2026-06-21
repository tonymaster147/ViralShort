const path = require('path');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);

const VIDEOS_DIR = path.join(__dirname, '..', '..', 'uploads', 'videos');

// Composite a transparent overlay PNG over the whole video (scaled to fit).
// Re-encodes video (overlay needs it); audio is copied. Returns new file path.
function bakeOverlay(videoPath, overlayPng) {
  return new Promise((resolve, reject) => {
    const outName = `ov_${Date.now()}_${Math.round(Math.random() * 1e9)}.mp4`;
    const outPath = path.join(VIDEOS_DIR, outName);
    ffmpeg(videoPath)
      .input(overlayPng)
      .complexFilter([
        // scale overlay to the video size, then overlay at 0,0
        '[1:v]scale=iw:ih[ov]',         // overlay already rendered at video res
        '[0:v][ov]overlay=0:0[v]',
      ])
      .outputOptions([
        '-map', '[v]',
        '-map', '0:a?',                 // keep audio if present
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-c:a', 'copy',
      ])
      .on('end', () => resolve({ outPath, outName }))
      .on('error', (err) => reject(err))
      .save(outPath);
  });
}

module.exports = { bakeOverlay };
