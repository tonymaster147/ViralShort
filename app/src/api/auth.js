import client from './client';

export async function signupRequest(username, email, password) {
  const res = await client.post('/auth/signup', { username, email, password });
  return res.data;
}

export async function loginRequest(emailOrUsername, password) {
  const res = await client.post('/auth/login', { emailOrUsername, password });
  return res.data;
}

export async function fetchMe() {
  const res = await client.get('/users/me');
  return res.data.user;
}

export async function updateProfile({ displayName, bio }) {
  const res = await client.patch('/users/me', { displayName, bio });
  return res.data.user;
}

// imageAsset: { uri, fileName?, mimeType? } from expo-image-picker
export async function uploadAvatar(imageAsset) {
  const form = new FormData();
  const name = imageAsset.fileName || `avatar_${Date.now()}.jpg`;
  form.append('avatar', {
    uri: imageAsset.uri,
    name,
    type: imageAsset.mimeType || 'image/jpeg',
  });
  const res = await client.post('/users/me/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0,
  });
  return res.data.user;
}
