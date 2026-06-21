const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getNotifications, getUnreadCount, markAllRead } = require('../controllers/socialController');

const router = express.Router();

router.get('/', requireAuth, getNotifications);
router.get('/unread-count', requireAuth, getUnreadCount);
router.post('/read-all', requireAuth, markAllRead);

module.exports = router;
