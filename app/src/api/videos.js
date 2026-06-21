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

export async function fetchTrendingSounds() {
  const res = await client.get('/videos/sounds/trending');
  return res.data.sounds;
}

export async function searchSounds(q) {
  const res = await client.get('/videos/sounds/search', { params: { q } });
  return res.data.sounds;
}

export async function fetchSavedSounds() {
  const res = await client.get('/videos/sounds/saved');
  return res.data.sounds;
}

export async function toggleSavedSound(soundId) {
  const res = await client.post(`/videos/sounds/${soundId}/save`);
  return res.data; // { saved }
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

export async function fetchVideo(videoId) {
  const res = await client.get(`/videos/${videoId}`);
  return res.data.video;
}

export async function setCover(videoId, coverTime) {
  const res = await client.post(`/videos/${videoId}/cover`, { coverTime });
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
  if (opts.musicStart != null) form.append('musicStart', String(opts.musicStart));
  if (opts.musicDuration != null) form.append('musicDuration', String(opts.musicDuration));
  if (opts.coverTime != null) form.append('coverTime', String(opts.coverTime));
  if (opts.allowComments != null) form.append('allowComments', String(opts.allowComments));
  if (opts.allowRemix != null) form.append('allowRemix', String(opts.allowRemix));
  if (opts.allowDownload != null) form.append('allowDownload', String(opts.allowDownload));
  if (opts.originalVolume != null) form.append('originalVolume', String(opts.originalVolume));
  if (opts.musicVolume != null) form.append('musicVolume', String(opts.musicVolume));
  if (opts.voiceVolume != null) form.append('voiceVolume', String(opts.voiceVolume));
  if (opts.locationName) form.append('locationName', opts.locationName);
  if (opts.locationLat != null) form.append('locationLat', String(opts.locationLat));
  if (opts.locationLng != null) form.append('locationLng', String(opts.locationLng));
  if (opts.scheduledAt) form.append('scheduledAt', opts.scheduledAt);
  if (opts.mentions) form.append('mentions', opts.mentions);
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
  if (opts.voiceover?.uri) {
    form.append('voiceover', {
      uri: opts.voiceover.uri,
      name: opts.voiceover.name || `voice_${Date.now()}.m4a`,
      type: opts.voiceover.mimeType || 'audio/mp4',
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
