import client from './client';

export async function search(q, type = 'all') {
  const res = await client.get('/discover/search', { params: { q, type } });
  return res.data; // { users, videos, hashtags }
}

export async function fetchTrending() {
  const res = await client.get('/discover/trending');
  return res.data.videos;
}

export async function fetchTrendingHashtags() {
  const res = await client.get('/discover/hashtags/trending');
  return res.data.hashtags;
}

export async function fetchHashtagVideos(name) {
  const res = await client.get(`/discover/hashtag/${encodeURIComponent(name)}`);
  return res.data; // { hashtag, videos }
}

export async function fetchVideo(videoId) {
  const res = await client.get(`/videos/${videoId}`);
  return res.data.video;
}
