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

const router = express.Router();

router.post('/', requireAuth, uploadVideoMw.single('video'), createVideo);
router.get('/feed', optionalAuth, getFeed);
router.get('/following', requireAuth, getFollowingFeed);
router.get('/user/:id', optionalAuth, getUserVideos);
router.post('/:id/view', addView);
router.get('/:id', optionalAuth, getVideo);
router.delete('/:id', requireAuth, deleteVideo);

module.exports = router;
