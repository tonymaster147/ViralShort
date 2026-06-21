import client from './client';

export async function fetchFeed(page = 1, limit = 10) {
  const res = await client.get('/videos/feed', { params: { page, limit } });
  return res.data.videos;
}

export async function fetchFollowingFeed(page = 1, limit = 10) {
  const res = await client.get('/videos/following', { params: { page, limit } });
  return res.data.videos;
}

export async function fetchUserVideos(userId) {
  const res = await client.get(`/videos/user/${userId}`);
  return res.data.videos;
}

export async function fetchSounds() {
  const res = await client.get('/videos/sounds');
  return res.data.sounds;
}

export async function addView(videoId) {
  try {
    await client.post(`/videos/${videoId}/view`);
  } catch (_) {
    // view counting is best-effort
  }
}

export async function deleteVideo(videoId) {
  const res = await client.delete(`/videos/${videoId}`);
  return res.data;
}

// videoAsset: { uri, fileName?, mimeType? } from expo-image-picker
// opts: { filter?, soundId?, music?, muteOriginal? }
//   music: { uri, name?, mimeType? } from expo-document-picker (optional)
export async function uploadVideo(videoAsset, caption, onProgress, opts = {}) {
  const form = new FormData();
  const name = videoAsset.fileName || `video_${Date.now()}.mp4`;
  form.append('caption', caption || '');
  if (opts.filter) form.append('filter', opts.filter);
  if (opts.soundId) form.append('soundId', String(opts.soundId));
  if (opts.muteOriginal) form.append('muteOriginal', 'true');
  form.append('video', {
    uri: videoAsset.uri,
    name,
    type: videoAsset.mimeType || 'video/mp4',
  });
  if (opts.music?.uri) {
    form.append('music', {
      uri: opts.music.uri,
      name: opts.music.name || `music_${Date.now()}.mp3`,
      type: opts.music.mimeType || 'audio/mpeg',
    });
  }
  const res = await client.post('/videos', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0, // no timeout — large video uploads can take a while
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return res.data.video;
}
