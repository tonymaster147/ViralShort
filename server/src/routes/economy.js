const express = require('express');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const {
  getWallet, getTransactions, dailyStatus, claimDaily,
} = require('../controllers/walletController');
const { getGiftTypes, sendGift } = require('../controllers/giftController');
const {
  getLeaderboard, getCurrentContest, getPacks, buyPack,
} = require('../controllers/economyController');

const router = express.Router();

// Wallet
router.get('/wallet', requireAuth, getWallet);
router.get('/wallet/transactions', requireAuth, getTransactions);
router.get('/wallet/daily/status', requireAuth, dailyStatus);
router.post('/wallet/daily/claim', requireAuth, claimDaily);

// Gifts
router.get('/gifts/types', getGiftTypes);
router.post('/gifts/send', requireAuth, sendGift);

// Leaderboard + contest
router.get('/leaderboard', optionalAuth, getLeaderboard);
router.get('/contest/current', optionalAuth, getCurrentContest);

// Store
router.get('/store/packs', getPacks);
router.post('/store/buy', requireAuth, buyPack);

module.exports = router;
