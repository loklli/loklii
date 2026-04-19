const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { auth: authLimit, sms: smsLimit } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const Joi = require('joi');

const signupSchema = Joi.object({
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^\+?[\d\s\-()]{10,15}$/).required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('host', 'customer').required(),
  firstName: Joi.string().min(1).max(50).required(),
  lastName: Joi.string().min(1).max(50).required(),
  dateOfBirth: Joi.string().isoDate().required(),
  language: Joi.string().valid('en', 'ar', 'es').default('en'),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  twoFaCode: Joi.string().optional(),
});

router.post('/signup', authLimit, validate(signupSchema), ctrl.signup);
router.post('/login', authLimit, validate(loginSchema), ctrl.login);
router.post('/login/recovery', authLimit, ctrl.loginWithRecoveryCode);
router.post('/2fa/setup', authenticate, ctrl.setup2FA);
router.post('/2fa/verify', authenticate, ctrl.verify2FA);
router.post('/password/reset/request', smsLimit, ctrl.requestPasswordReset);
router.post('/password/reset', authLimit, ctrl.resetPassword);
router.post('/push-token', authenticate, ctrl.registerPushToken);

module.exports = router;
