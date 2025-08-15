const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { me, updateMe } = require('../controllers/userController');

router.get('/me', requireAuth, me);
router.patch('/me', requireAuth, updateMe);

module.exports = router;
