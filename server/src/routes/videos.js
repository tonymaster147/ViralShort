const express = require('express');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { uploadVideo: uploadVideoMw } = require('../middleware/upload');
const {
  createVideo,
  getFeed,
  getFollowingFeed,
  getUserVideos,
  getVideo,
  addView,
  deleteVideo,
} = require('../controllers/videoController');
const {
  toggleLike, getComments, addComment,
} = require('../controllers/socialController');

const router = express.Router();

router.post('/', requireAuth, uploadVideoMw.single('video'), createVideo);
router.get('/feed', optionalAuth, getFeed);
router.get('/following', requireAuth, getFollowingFeed);
router.get('/user/:id', optionalAuth, getUserVideos);
router.post('/:id/view', addView);
router.get('/:id', optionalAuth, getVideo);
router.delete('/:id', requireAuth, deleteVideo);

// Social
router.post('/:id/like', requireAuth, toggleLike);
router.get('/:id/comments', optionalAuth, getComments);
router.post('/:id/comments', requireAuth, addComment);

module.exports = router;
