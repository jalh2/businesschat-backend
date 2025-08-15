const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { listByChat, createText, createImage, createPayment, confirmPayment, getImage, getReceipt } = require('../controllers/messageController');

// Lazy-load retrieval routes (prefix to avoid conflicts with :chatId routes)
router.get('/image/:messageId', requireAuth, getImage);
router.get('/receipt/:messageId', requireAuth, getReceipt);

router.get('/:chatId', requireAuth, listByChat);
router.post('/:chatId/text', requireAuth, createText);
router.post('/:chatId/image', requireAuth, upload.single('image'), createImage);
router.post('/:chatId/payment', requireAuth, upload.single('receipt'), createPayment);
router.post('/:chatId/:messageId/confirm', requireAuth, confirmPayment);

module.exports = router;
