import client from './client';

export async function fetchConversations() {
  const res = await client.get('/conversations');
  return res.data.conversations;
}

export async function openConversation(userId) {
  const res = await client.post('/conversations', { userId });
  return res.data; // { conversationId, user }
}

export async function fetchMessages(conversationId) {
  const res = await client.get(`/conversations/${conversationId}/messages`);
  return res.data.messages;
}

export async function sendMessage(conversationId, text) {
  const res = await client.post(`/conversations/${conversationId}/messages`, { text });
  return res.data.message;
}
