const express = require('express');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { uploadAvatar: uploadAvatarMw } = require('../middleware/upload');
const {
  getMe,
  getUserById,
  updateMe,
  uploadAvatar,
} = require('../controllers/userController');
const {
  toggleFollow, getFollowers, getFollowing,
} = require('../controllers/socialController');

const router = express.Router();

router.get('/me', requireAuth, getMe);
router.patch('/me', requireAuth, updateMe);
router.post('/me/avatar', requireAuth, uploadAvatarMw.single('avatar'), uploadAvatar);
router.get('/:id', optionalAuth, getUserById);

// Social
router.post('/:id/follow', requireAuth, toggleFollow);
router.get('/:id/followers', getFollowers);
router.get('/:id/following', getFollowing);

module.exports = router;
