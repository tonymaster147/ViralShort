const express = require('express');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const {
  getWallet, getTransactions, dailyStatus, claimDaily,
} = require('../controllers/walletController');
const { getGiftTypes, sendGift, sendDiamond } = require('../controllers/giftController');
const {
  getLeaderboard, getCurrentContest, getPacks,
} = require('../controllers/economyController');
const {
  createDiamondOrder, verifyDiamondPayment, checkoutPage,
} = require('../controllers/razorpayController');

const router = express.Router();

// Wallet
router.get('/wallet', requireAuth, getWallet);
router.get('/wallet/transactions', requireAuth, getTransactions);
router.get('/wallet/daily/status', requireAuth, dailyStatus);
router.post('/wallet/daily/claim', requireAuth, claimDaily);

// Gifts
router.get('/gifts/types', getGiftTypes);
router.post('/gifts/send', requireAuth, sendGift);
router.post('/gifts/diamond', requireAuth, sendDiamond);

// Leaderboard + contest
router.get('/leaderboard', optionalAuth, getLeaderboard);
router.get('/contest/current', optionalAuth, getCurrentContest);

// Store — Razorpay diamond purchases
router.get('/store/packs', getPacks);
router.post('/store/order', requireAuth, createDiamondOrder);
router.post('/store/verify', requireAuth, verifyDiamondPayment);
// Checkout page loaded inside the in-app WebView (no secret, no auth needed).
router.get('/store/checkout', checkoutPage);

module.exports = router;
