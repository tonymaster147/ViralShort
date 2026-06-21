const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const {
  search, trendingVideos, trendingHashtags, videosByHashtag,
} = require('../controllers/discoverController');

const router = express.Router();

router.get('/search', optionalAuth, search);
router.get('/trending', optionalAuth, trendingVideos);
router.get('/hashtags/trending', optionalAuth, trendingHashtags);
router.get('/hashtag/:name', optionalAuth, videosByHashtag);

module.exports = router;
