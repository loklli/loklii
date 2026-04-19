const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');

router.get('/conversations', authenticate, ctrl.getConversations);
router.post('/conversations', authenticate, ctrl.startConversation);
router.get('/conversations/:conversationId/messages', authenticate, ctrl.getMessages);
router.post('/messages', authenticate, ctrl.sendMessage);
router.post('/block/:userId', authenticate, ctrl.blockUser);
router.post('/report', authenticate, ctrl.report);

module.exports = router;
