const express = require('express');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { getReplies, deleteComment } = require('../controllers/socialController');

const router = express.Router();

router.get('/:id/replies', optionalAuth, getReplies);
router.delete('/:id', requireAuth, deleteComment);

module.exports = router;
