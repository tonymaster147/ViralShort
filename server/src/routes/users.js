const express = require('express');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { uploadAvatar: uploadAvatarMw } = require('../middleware/upload');
const {
  getMe,
  getUserById,
  updateMe,
  uploadAvatar,
} = require('../controllers/userController');

const router = express.Router();

router.get('/me', requireAuth, getMe);
router.patch('/me', requireAuth, updateMe);
router.post('/me/avatar', requireAuth, uploadAvatarMw.single('avatar'), uploadAvatar);
router.get('/:id', optionalAuth, getUserById);

module.exports = router;
