const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);

// Merge audio into a video with per-track volume control.
//
//   videoPath       - source video (input 0)
//   originalVolume  - 0..1 gain for the video's own audio (0 = muted)
//   tracks          - array of added audio sources, each:
//                       { path, start=0, duration=null, volume=1 }
//                     (e.g. music + voice-over)
//   outPath         - destination
//
// Builds a filter graph that volume-adjusts every present source and mixes them.
// Video stream is copied (no re-encode) for speed.
function mergeAudio({ videoPath, originalVolume = 1, tracks = [], outPath }) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(videoPath);

    // Add each track input with its own trim (-ss / -t).
    tracks.forEach((t) => {
      const opts = [];
      if (t.start > 0) opts.push('-ss', String(t.start));
      if (t.duration && t.duration > 0) opts.push('-t', String(t.duration));
      command.input(t.path);
      if (opts.length) command.inputOptions(opts);
    });

    const labels = [];
    const filters = [];

    // Original audio (input 0) — include unless muted (volume 0).
    if (originalVolume > 0) {
      filters.push(`[0:a]volume=${originalVolume}[a0]`);
      labels.push('[a0]');
    }
    // Added tracks are inputs 1..N.
    tracks.forEach((t, i) => {
      const idx = i + 1;
      const vol = t.volume != null ? t.volume : 1;
      filters.push(`[${idx}:a]volume=${vol}[t${idx}]`);
      labels.push(`[t${idx}]`);
    });

    if (labels.length === 0) {
      // Everything muted → strip audio entirely.
      command
        .outputOptions(['-map', '0:v:0', '-an', '-c:v', 'copy'])
        .on('end', () => resolve(outPath))
        .on('error', reject)
        .save(outPath);
      return;
    }

    let aout;
    if (labels.length === 1) {
      aout = labels[0];
      command.complexFilter(filters);
    } else {
      filters.push(`${labels.join('')}amix=inputs=${labels.length}:duration=shortest:dropout_transition=0[aout]`);
      aout = '[aout]';
      command.complexFilter(filters);
    }

    command
      .outputOptions(['-map', '0:v:0', '-map', aout, '-c:v', 'copy', '-shortest'])
      .on('end', () => resolve(outPath))
      .on('error', reject)
      .save(outPath);
  });
}

module.exports = { mergeAudio };
