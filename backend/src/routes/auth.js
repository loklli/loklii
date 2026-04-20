const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { auth: authLimit } = require('../middleware/rateLimiter');

// Profile creation after Supabase Auth email verification (no authenticate middleware — no profile yet)
router.post('/profile', authLimit, ctrl.createProfile);

// Get current user profile (requires valid Supabase session + existing profile)
router.get('/me', authenticate, ctrl.getMe);

// 2FA — login verification (for users who have 2FA enabled)
router.post('/2fa/login', authenticate, ctrl.verifyTwoFALogin);

// 2FA — setup and enable (from settings/dashboard)
router.post('/2fa/setup', authenticate, ctrl.setup2FA);
router.post('/2fa/verify', authenticate, ctrl.verify2FA);

// Push notifications
router.post('/push-token', authenticate, ctrl.registerPushToken);

module.exports = router;
