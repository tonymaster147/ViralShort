const express = require('express');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { uploadVideoWithMusic } = require('../middleware/upload');
const {
  createVideo,
  getFeed,
  getFollowingFeed,
  getUserVideos,
  getVideo,
  addView,
  deleteVideo,
  getSounds,
  getTrendingSounds,
  searchSounds,
  getSavedSounds,
  toggleSavedSound,
  setCover,
} = require('../controllers/videoController');
const {
  toggleLike, getComments, addComment,
} = require('../controllers/socialController');

const router = express.Router();

router.post('/', requireAuth, uploadVideoWithMusic, createVideo);
// Sounds (specific routes before /:id)
router.get('/sounds/trending', optionalAuth, getTrendingSounds);
router.get('/sounds/search', optionalAuth, searchSounds);
router.get('/sounds/saved', requireAuth, getSavedSounds);
router.post('/sounds/:id/save', requireAuth, toggleSavedSound);
router.get('/sounds', optionalAuth, getSounds);
router.get('/feed', optionalAuth, getFeed);
router.get('/following', requireAuth, getFollowingFeed);
router.get('/user/:id', optionalAuth, getUserVideos);
router.post('/:id/cover', requireAuth, setCover);
router.post('/:id/view', addView);
router.get('/:id', optionalAuth, getVideo);
router.delete('/:id', requireAuth, deleteVideo);

// Social
router.post('/:id/like', requireAuth, toggleLike);
router.get('/:id/comments', optionalAuth, getComments);
router.post('/:id/comments', requireAuth, addComment);

module.exports = router;
