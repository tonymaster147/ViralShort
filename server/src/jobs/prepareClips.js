const path = require('path');
const fs = require('fs');
const os = require('os');
const ffmpegPath = require('ffmpeg-static');
const ffprobe = require('ffprobe-static');
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobe.path);

const VIDEOS_DIR = path.join(__dirname, '..', '..', 'uploads', 'videos');
const TARGET_W = 1080;
const TARGET_H = 1920;

const rand = () => `${Date.now()}_${Math.round(Math.random() * 1e9)}`;

function hasAudio(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return resolve(false);
      resolve((data.streams || []).some((s) => s.codec_type === 'audio'));
    });
  });
}

// atempo only supports 0.5–2.0; chain factors for anything outside.
function atempoChain(speed) {
  let s = speed, parts = [];
  while (s > 2.0) { parts.push('atempo=2.0'); s /= 2.0; }
  while (s < 0.5) { parts.push('atempo=0.5'); s /= 0.5; }
  parts.push(`atempo=${s.toFixed(4)}`);
  return parts.join(',');
}

function transposePrefix(rotate) {
  if (rotate === 90) return 'transpose=1,';
  if (rotate === 270) return 'transpose=2,';
  if (rotate === 180) return 'transpose=1,transpose=1,';
  return '';
}

// Build the scale/crop (fill = cover, fit = pad) chain to TARGET_WxH.
function fitChain(fit) {
  if (fit === 'fit') {
    return `scale=${TARGET_W}:${TARGET_H}:force_original_aspect_ratio=decrease,pad=${TARGET_W}:${TARGET_H}:(ow-iw)/2:(oh-ih)/2:black`;
  }
  // cover (default)
  return `scale=${TARGET_W}:${TARGET_H}:force_original_aspect_ratio=increase,crop=${TARGET_W}:${TARGET_H}`;
}

// Prepare one clip into a normalized 1080x1920 H.264+AAC file.
//   meta: { type:'video'|'image', trimStart, trimDur, speed, rotate, fit, duration }
async function prepareClip(inputPath, meta = {}) {
  const isImage = meta.type === 'image';
  const speed = Math.min(4, Math.max(0.25, Number(meta.speed) || 1));
  const rotate = [0, 90, 180, 270].includes(Number(meta.rotate)) ? Number(meta.rotate) : 0;
  const fit = meta.fit === 'fit' ? 'fit' : 'cover';
  const outName = `clip_${rand()}.mp4`;
  const outPath = path.join(VIDEOS_DIR, outName);

  const vf = `${transposePrefix(rotate)}${fitChain(fit)},setpts=PTS/${speed},setsar=1`;

  await new Promise((resolve, reject) => {
    let cmd = ffmpeg();

    if (isImage) {
      const dur = Math.max(1, Math.min(10, Number(meta.duration) || 3));
      cmd = cmd
        .input(inputPath).inputOptions(['-loop', '1', '-t', String(dur)])
        .input('anullsrc=channel_layout=stereo:sample_rate=44100').inputOptions(['-f', 'lavfi', '-t', String(dur)])
        .outputOptions([
          '-vf', `${transposePrefix(rotate)}${fitChain(fit)},setsar=1`,
          '-map', '0:v:0', '-map', '1:a:0',
          '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
          '-c:a', 'aac', '-pix_fmt', 'yuv420p', '-shortest',
        ]);
    } else {
      // trim via input seeking
      const inOpts = [];
      if (meta.trimStart > 0) inOpts.push('-ss', String(meta.trimStart));
      if (meta.trimDur > 0) inOpts.push('-t', String(meta.trimDur));
      cmd = cmd.input(inputPath);
      if (inOpts.length) cmd.inputOptions(inOpts);

      const audio = meta._hasAudio;
      if (audio) {
        cmd.outputOptions([
          '-vf', vf,
          '-af', atempoChain(speed),
          '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
          '-c:a', 'aac', '-pix_fmt', 'yuv420p',
        ]);
      } else {
        // no audio in source — add silent track so all clips are uniform
        cmd.input('anullsrc=channel_layout=stereo:sample_rate=44100').inputOptions(['-f', 'lavfi']);
        cmd.outputOptions([
          '-vf', vf,
          '-map', '0:v:0', '-map', '1:a:0',
          '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
          '-c:a', 'aac', '-pix_fmt', 'yuv420p', '-shortest',
        ]);
      }
    }

    cmd.on('end', () => resolve()).on('error', reject).save(outPath);
  });

  return outPath;
}

// Concat already-uniform clips fast (demuxer, stream copy).
function concatUniform(clipPaths) {
  return new Promise((resolve, reject) => {
    const listPath = path.join(os.tmpdir(), `concat_${rand()}.txt`);
    fs.writeFileSync(listPath, clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
    const outName = `joined_${rand()}.mp4`;
    const outPath = path.join(VIDEOS_DIR, outName);
    ffmpeg()
      .input(listPath).inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c', 'copy'])
      .on('end', () => { try { fs.unlinkSync(listPath); } catch (_) {} resolve({ outPath, outName }); })
      .on('error', (err) => { try { fs.unlinkSync(listPath); } catch (_) {} reject(err); })
      .save(outPath);
  });
}

// Prepare all clips with their meta, then concat. Returns { outPath, outName }.
// `metas` is parallel to `inputPaths`.
async function buildFromClips(inputPaths, metas) {
  const prepared = [];
  for (let i = 0; i < inputPaths.length; i++) {
    const meta = metas[i] || {};
    if (meta.type !== 'image') meta._hasAudio = await hasAudio(inputPaths[i]);
    const out = await prepareClip(inputPaths[i], meta);
    prepared.push(out);
  }
  // cleanup source uploads
  inputPaths.forEach((p) => { try { fs.unlinkSync(p); } catch (_) {} });

  if (prepared.length === 1) {
    return { outPath: prepared[0], outName: path.basename(prepared[0]) };
  }
  const joined = await concatUniform(prepared);
  prepared.forEach((p) => { try { fs.unlinkSync(p); } catch (_) {} });
  return joined;
}

module.exports = { buildFromClips, prepareClip, concatUniform };
