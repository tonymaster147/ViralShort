import client from './client';

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
  return res.data; // { claimed, coins, diamonds }
}

// Gifts
export async function fetchGiftTypes() {
  const res = await client.get('/gifts/types');
  return res.data.gifts;
}
export async function sendGift(giftTypeId, videoId) {
  const res = await client.post('/gifts/send', { giftTypeId, videoId });
  return res.data; // { coins, diamonds, gift }
}

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

// Store
export async function fetchPacks() {
  const res = await client.get('/store/packs');
  return res.data.packs;
}
export async function buyPack(packId) {
  const res = await client.post('/store/buy', { packId });
  return res.data; // { coins, diamonds, purchased }
}
