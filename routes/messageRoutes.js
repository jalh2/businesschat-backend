const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { upload, uploadAudio } = require('../middleware/upload');
const { listByChat, createText, createImage, createPayment, confirmPayment, getImage, getReceipt, createVoice, getVoice } = require('../controllers/messageController');

// Lazy-load retrieval routes (prefix to avoid conflicts with :chatId routes)
router.get('/image/:messageId', requireAuth, getImage);
router.get('/receipt/:messageId', requireAuth, getReceipt);
router.get('/voice/:messageId', requireAuth, getVoice);

router.get('/:chatId', requireAuth, listByChat);
router.post('/:chatId/text', requireAuth, createText);
router.post('/:chatId/image', requireAuth, upload.single('image'), createImage);
router.post('/:chatId/payment', requireAuth, upload.single('receipt'), createPayment);
router.post('/:chatId/:messageId/confirm', requireAuth, confirmPayment);
router.post('/:chatId/voice', requireAuth, uploadAudio.single('voice'), createVoice);

module.exports = router;
