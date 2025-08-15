const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { createChat, listMyChats, listDiscoverChats, joinChat, getChat, deleteChat } = require('../controllers/chatController');

router.post('/', requireAuth, createChat);
router.get('/', requireAuth, listMyChats);
router.get('/discover', requireAuth, listDiscoverChats);
router.post('/:chatId/join', requireAuth, joinChat);
router.get('/:chatId', requireAuth, getChat);
router.delete('/:chatId', requireAuth, deleteChat);

module.exports = router;
