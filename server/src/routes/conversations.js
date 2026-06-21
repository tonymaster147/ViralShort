const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  listConversations, openConversation, getMessages, sendMessage,
} = require('../controllers/messageController');

const router = express.Router();

router.get('/', requireAuth, listConversations);
router.post('/', requireAuth, openConversation);
router.get('/:id/messages', requireAuth, getMessages);
router.post('/:id/messages', requireAuth, sendMessage);

module.exports = router;
