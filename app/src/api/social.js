import client from './client';

export async function toggleLike(videoId) {
  const res = await client.post(`/videos/${videoId}/like`);
  return res.data; // { liked, likeCount }
}

export async function fetchComments(videoId) {
  const res = await client.get(`/videos/${videoId}/comments`);
  return res.data.comments;
}

export async function fetchReplies(commentId) {
  const res = await client.get(`/comments/${commentId}/replies`);
  return res.data.comments;
}

export async function addComment(videoId, text, parentId = null) {
  const res = await client.post(`/videos/${videoId}/comments`, { text, parentId });
  return res.data.comment;
}

export async function deleteComment(commentId) {
  const res = await client.delete(`/comments/${commentId}`);
  return res.data;
}

export async function toggleFollow(userId) {
  const res = await client.post(`/users/${userId}/follow`);
  return res.data; // { following, followers }
}

export async function fetchUser(userId) {
  const res = await client.get(`/users/${userId}`);
  return res.data.user;
}

export async function fetchNotifications() {
  const res = await client.get('/notifications');
  return res.data.notifications;
}

export async function fetchUnreadCount() {
  const res = await client.get('/notifications/unread-count');
  return res.data.count;
}

export async function markAllNotificationsRead() {
  const res = await client.post('/notifications/read-all');
  return res.data;
}
