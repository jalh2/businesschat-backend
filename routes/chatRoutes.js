const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { createChat, listMyChats, listDiscoverChats, joinChat, getChat, deleteChat } = require('../controllers/chatController');
const { createManualAdjustment, listTransactions } = require('../controllers/balanceController');

router.post('/', requireAuth, createChat);
router.get('/', requireAuth, listMyChats);
router.get('/discover', requireAuth, listDiscoverChats);
router.post('/:chatId/join', requireAuth, joinChat);
router.get('/:chatId', requireAuth, getChat);
router.delete('/:chatId', requireAuth, deleteChat);

// Balance management
router.post('/:chatId/balance-adjustment', requireAuth, createManualAdjustment);
router.get('/:chatId/balance-transactions', requireAuth, listTransactions);

module.exports = router;
