const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/stripeController');
const { authenticate } = require('../middleware/auth');

// Webhook must use raw body — configured in index.js
router.post('/webhook', express.raw({ type: 'application/json' }), ctrl.handleWebhook);
router.post('/identity/session', authenticate, ctrl.createIdentitySession);
router.get('/identity/status', authenticate, ctrl.checkIdentityStatus);
router.post('/fee/session', authenticate, ctrl.createFeepaymentSession);

module.exports = router;
