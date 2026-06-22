const path = require('path');
const fs = require('fs');
const os = require('os');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);

const HLS_ROOT = path.join(__dirname, '..', '..', 'uploads', 'hls');

// Generate a single-rendition VOD HLS playlist for a video.
// NOTE: the project path contains a space ("my projects") which fluent-ffmpeg
// mishandles in -hls_segment_filename, so we render into a space-free temp dir
// then move the playlist + segments into uploads/hls/<id>/.
function generateHls(absVideoPath, videoId) {
  return new Promise((resolve) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hls-'));
    const segPattern = path.join(tmp, 'seg_%03d.ts');
    const playlistTmp = path.join(tmp, 'index.m3u8');

    ffmpeg(absVideoPath)
      .outputOptions([
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-hls_time', '4',
        '-hls_playlist_type', 'vod',
        '-hls_flags', 'independent_segments',
        '-hls_segment_filename', segPattern,
      ])
      .on('end', () => {
        try {
          const dir = path.join(HLS_ROOT, String(videoId));
          fs.mkdirSync(dir, { recursive: true });
          // copy (not rename) — temp dir may be on a different drive (EXDEV)
          for (const f of fs.readdirSync(tmp)) {
            fs.copyFileSync(path.join(tmp, f), path.join(dir, f));
          }
          fs.rmSync(tmp, { recursive: true, force: true });
          resolve(`hls/${videoId}/index.m3u8`);
        } catch (e) {
          console.error('[hls] move failed:', e.message);
          resolve(null);
        }
      })
      .on('error', (err) => {
        console.error('[hls] failed:', err.message);
        try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
        resolve(null);
      })
      .save(playlistTmp);
  });
}

module.exports = { generateHls };
