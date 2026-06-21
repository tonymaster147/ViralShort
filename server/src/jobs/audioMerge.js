const path = require('path');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);

// Merge a music track into a video.
//   videoPath  - absolute path to the source video
//   audioPath  - absolute path to the music file
//   muteOriginal - if true, drop the original video audio entirely;
//                  if false, mix music UNDER the original audio
//   musicStart - seconds offset into the music to start from (default 0)
//   musicDuration - seconds of music to use (default: until video ends)
//   outPath    - absolute path to write the result
// Resolves with outPath. The chosen music slice plays from the video start.
function mergeAudio({ videoPath, audioPath, muteOriginal, musicStart = 0, musicDuration = null, outPath }) {
  return new Promise((resolve, reject) => {
    // Apply the trim to the music INPUT: seek to start (-ss) and limit length (-t).
    const audioInputOpts = [];
    if (musicStart > 0) audioInputOpts.push('-ss', String(musicStart));
    if (musicDuration && musicDuration > 0) audioInputOpts.push('-t', String(musicDuration));

    const command = ffmpeg(videoPath).input(audioPath);
    if (audioInputOpts.length) command.inputOptions(audioInputOpts);

    if (muteOriginal) {
      // Use only the music; cut audio to the shortest stream (video length).
      command
        .outputOptions([
          '-map', '0:v:0',      // video from input 0
          '-map', '1:a:0',      // audio from input 1 (music)
          '-c:v', 'copy',       // don't re-encode video (fast)
          '-shortest',
        ]);
    } else {
      // Mix original audio + music together.
      command
        .complexFilter([
          '[0:a][1:a]amix=inputs=2:duration=shortest:dropout_transition=0[aout]',
        ])
        .outputOptions([
          '-map', '0:v:0',
          '-map', '[aout]',
          '-c:v', 'copy',
          '-shortest',
        ]);
    }

    command
      .on('end', () => resolve(outPath))
      .on('error', (err) => reject(err))
      .save(outPath);
  });
}

module.exports = { mergeAudio };
