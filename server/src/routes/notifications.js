const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getNotifications, getUnreadCount } = require('../controllers/socialController');

const router = express.Router();

router.get('/', requireAuth, getNotifications);
router.get('/unread-count', requireAuth, getUnreadCount);

module.exports = router;
