const path = require('path');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');
const ffprobe = require('ffprobe-static');
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobe.path);

const UPLOADS = path.join(__dirname, '..', '..', 'uploads');
const VIDEOS_DIR = path.join(UPLOADS, 'videos');
const THUMBS_DIR = path.join(UPLOADS, 'thumbs');
const COVERS_DIR = path.join(UPLOADS, 'covers');
[VIDEOS_DIR, THUMBS_DIR, COVERS_DIR].forEach((d) => fs.mkdirSync(d, { recursive: true }));

const rand = () => `${Date.now()}_${Math.round(Math.random() * 1e9)}`;

// Read duration / width / height with ffprobe.
function probe(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return resolve({});
      const v = (data.streams || []).find((s) => s.codec_type === 'video') || {};
      resolve({
        duration: data.format?.duration ? Number(data.format.duration) : null,
        width: v.width || null,
        height: v.height || null,
        size: data.format?.size ? Number(data.format.size) : null,
      });
    });
  });
}

// Compress + web-optimize: 1080p, capped bitrate, faststart.
// `denoise` cleans up noisy mic audio (high-pass + FFT denoise) — only used when
// the original audio is kept (never on music, which would muffle it).
// Returns the new filename, or the original if compression fails.
function compress(inPath, { denoise = false } = {}) {
  return new Promise((resolve) => {
    const outName = `opt_${rand()}.mp4`;
    const outPath = path.join(VIDEOS_DIR, outName);
    const opts = [
      '-c:v', 'libx264',
      '-profile:v', 'high',
      '-level', '4.1',
      '-preset', 'medium',        // better quality per bit than veryfast
      '-crf', '23',
      '-maxrate', '4500k',        // 1080p quality, still streamable on Wi-Fi/4G
      '-bufsize', '9000k',
      '-vf', "scale='min(1080,iw)':-2,format=yuv420p",
      '-r', '30',
      '-g', '60',                 // keyframe every 2s — faster seek/start
      '-c:a', 'aac',
      '-b:a', '160k',
      '-movflags', '+faststart',  // moov atom at front for instant start
    ];
    if (denoise) {
      // highpass cuts rumble/handling; afftdn removes hiss; mild to keep voice natural
      opts.splice(opts.indexOf('-c:a'), 0, '-af', 'highpass=f=80,afftdn=nr=10:nf=-25');
    }
    ffmpeg(inPath)
      .outputOptions(opts)
      .on('end', () => resolve({ outPath, outName }))
      .on('error', (err) => {
        console.error('[processor] compress failed:', err.message);
        resolve(null);
      })
      .save(outPath);
  });
}

// Extract a cover frame at `atSeconds` (default 0). Returns rel path or null.
function extractCover(inPath, atSeconds = 0) {
  return new Promise((resolve) => {
    const name = `cover_${rand()}.jpg`;
    const outPath = path.join(COVERS_DIR, name);
    ffmpeg(inPath)
      .seekInput(Math.max(0, atSeconds))
      .outputOptions(['-vframes', '1', '-vf', 'scale=720:-2'])
      .on('end', () => resolve(`covers/${name}`))
      .on('error', (err) => { console.error('[processor] cover failed:', err.message); resolve(null); })
      .save(outPath);
  });
}

// Small thumbnail (grid tiles). Returns rel path or null.
function extractThumb(inPath, atSeconds = 1) {
  return new Promise((resolve) => {
    const name = `thumb_${rand()}.jpg`;
    const outPath = path.join(THUMBS_DIR, name);
    ffmpeg(inPath)
      .seekInput(Math.max(0, atSeconds))
      .outputOptions(['-vframes', '1', '-vf', 'scale=480:-2'])
      .on('end', () => resolve(`thumbs/${name}`))
      .on('error', (err) => { console.error('[processor] thumb failed:', err.message); resolve(null); })
      .save(outPath);
  });
}

// Full pipeline for one uploaded (already audio-merged) video.
//   inputPath  - absolute path to the source video
//   coverTime  - seconds to grab the cover/thumb frame from (default 0/1)
// Returns { videoRel, thumbRel, coverRel, duration, width, height, fileSize }.
async function processVideo(inputPath, { coverTime = 0, overlay = null, denoise = false } = {}) {
  const meta = await probe(inputPath);
  const safeCover = Math.min(coverTime || 0, meta.duration ? meta.duration - 0.1 : coverTime || 0);

  // Compress; fall back to the original file if it fails.
  const compressed = await compress(inputPath, { denoise });
  let finalPath = inputPath;
  let videoRel = `videos/${path.basename(inputPath)}`;
  if (compressed) {
    finalPath = compressed.outPath;
    videoRel = `videos/${compressed.outName}`;
    // remove the pre-compression file
    try { fs.unlinkSync(inputPath); } catch (_) {}
  }

  // Bake editor overlay (text/stickers/drawing) at the final resolution.
  if (overlay && overlay.layers && overlay.layers.length) {
    try {
      const fmeta = await probe(finalPath);
      const { renderOverlay } = require('./overlayRenderer');
      const png = renderOverlay(overlay, fmeta.width, fmeta.height);
      if (png) {
        const { bakeOverlay } = require('./overlayBake');
        const baked = await bakeOverlay(finalPath, png);
        try { fs.unlinkSync(finalPath); } catch (_) {}
        try { fs.unlinkSync(png); } catch (_) {}
        finalPath = baked.outPath;
        videoRel = `videos/${baked.outName}`;
      }
    } catch (e) {
      console.error('[overlay] bake failed, keeping video without overlay:', e.message);
    }
  }

  const [coverRel, thumbRel, meta2] = await Promise.all([
    extractCover(finalPath, safeCover),
    extractThumb(finalPath, Math.max(1, safeCover)),
    probe(finalPath),
  ]);

  return {
    videoRel,
    thumbRel,
    coverRel,
    duration: meta2.duration ?? meta.duration ?? null,
    width: meta2.width ?? meta.width ?? null,
    height: meta2.height ?? meta.height ?? null,
    fileSize: meta2.size ?? null,
  };
}

module.exports = { processVideo, probe, extractCover, extractThumb, compress };
