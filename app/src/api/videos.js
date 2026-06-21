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
export async function uploadVideo(videoAsset, caption, onProgress) {
  const form = new FormData();
  const name = videoAsset.fileName || `video_${Date.now()}.mp4`;
  form.append('caption', caption || '');
  form.append('video', {
    uri: videoAsset.uri,
    name,
    type: videoAsset.mimeType || 'video/mp4',
  });
  const res = await client.post('/videos', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return res.data.video;
}
