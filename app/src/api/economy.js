import client from './client';
import { API_URL } from './config';

// Wallet
export async function fetchWallet() {
  const res = await client.get('/wallet');
  return res.data; // { coins, diamonds }
}
export async function fetchTransactions() {
  const res = await client.get('/wallet/transactions');
  return res.data.transactions;
}
export async function fetchDailyStatus() {
  const res = await client.get('/wallet/daily/status');
  return res.data; // { canClaim, amount }
}
export async function claimDaily() {
  const res = await client.post('/wallet/daily/claim');
  return res.data; // { claimed, diamonds }
}

// Diamonds — direct send to a creator
export async function sendDiamond(videoId, amount) {
  const res = await client.post('/gifts/diamond', { videoId, amount });
  return res.data; // { diamonds, creatorDiamonds, amount }
}

// Leaderboard + contest
export async function fetchLeaderboard(period = 'all') {
  const res = await client.get('/leaderboard', { params: { period } });
  return res.data.leaders;
}
export async function fetchContest() {
  const res = await client.get('/contest/current');
  return res.data; // { contest, entries }
}

// Store — diamond packs paid via Razorpay
export async function fetchPacks() {
  const res = await client.get('/store/packs');
  return res.data.packs;
}

// Create a Razorpay order for a diamond pack (server returns order id + public key).
export async function createDiamondOrder(packId) {
  const res = await client.post('/store/order', { packId });
  return res.data; // { orderId, amount, currency, keyId, pack }
}

// Verify the Razorpay payment server-side; on success diamonds are credited.
export async function verifyDiamondPayment(payload) {
  const res = await client.post('/store/verify', payload);
  return res.data; // { diamonds, credited }
}

// URL of the server-hosted Razorpay checkout page (loaded inside a WebView).
export function checkoutUrl({ orderId, keyId, amount, name = 'ViralShort', desc = 'Buy diamonds' }) {
  const q = new URLSearchParams({ oid: orderId, key: keyId, amt: String(amount), name, desc });
  return `${API_URL}/store/checkout?${q.toString()}`;
}
