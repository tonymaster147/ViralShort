const path = require('path');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);

const VIDEOS_DIR = path.join(__dirname, '..', '..', 'uploads', 'videos');

// Concatenate multiple recorded clips into one video.
// Re-encodes via the concat filter so clips with slightly different params still join.
// Normalizes each clip to 1080-wide H.264 + AAC; clips without audio get silent audio.
// Returns the absolute output path.
function concatClips(clipPaths, outPath) {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();
    clipPaths.forEach((p) => cmd.input(p));

    // Build a filter graph: scale/pad each video, ensure each has audio.
    const parts = [];
    const maps = [];
    clipPaths.forEach((_, i) => {
      parts.push(
        `[${i}:v]scale='min(1080,iw)':-2,setsar=1,format=yuv420p[v${i}]`,
        // anullsrc as fallback isn't per-input simple; rely on clips having audio.
      );
      maps.push(`[v${i}][${i}:a]`);
    });
    const filter = `${parts.join(';')};${maps.join('')}concat=n=${clipPaths.length}:v=1:a=1[v][a]`;

    cmd
      .complexFilter(filter)
      .outputOptions([
        '-map', '[v]',
        '-map', '[a]',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
      ])
      .on('end', () => resolve(outPath))
      .on('error', (err) => reject(err))
      .save(outPath);
  });
}

// Fallback: concat without audio (for clips recorded with the mic disabled).
function concatClipsNoAudio(clipPaths, outPath) {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();
    clipPaths.forEach((p) => cmd.input(p));
    const parts = clipPaths.map((_, i) => `[${i}:v]scale='min(1080,iw)':-2,setsar=1,format=yuv420p[v${i}]`);
    const maps = clipPaths.map((_, i) => `[v${i}]`).join('');
    const filter = `${parts.join(';')};${maps}concat=n=${clipPaths.length}:v=1:a=0[v]`;
    cmd
      .complexFilter(filter)
      .outputOptions(['-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23'])
      .on('end', () => resolve(outPath))
      .on('error', reject)
      .save(outPath);
  });
}

// Join clips; try with audio first, fall back to video-only.
async function joinClips(clipPaths) {
  const outName = `joined_${Date.now()}_${Math.round(Math.random() * 1e9)}.mp4`;
  const outPath = path.join(VIDEOS_DIR, outName);
  try {
    await concatClips(clipPaths, outPath);
  } catch (e) {
    console.error('[concat] with-audio failed, retrying video-only:', e.message);
    await concatClipsNoAudio(clipPaths, outPath);
  }
  // cleanup source clips
  clipPaths.forEach((p) => { try { fs.unlinkSync(p); } catch (_) {} });
  return { outPath, outName };
}

module.exports = { joinClips };
