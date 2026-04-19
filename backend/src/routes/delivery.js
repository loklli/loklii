const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/deliveryController');
const { authenticate } = require('../middleware/auth');

router.post('/dispatch', authenticate, ctrl.dispatchDelivery);
router.post('/webhook/doordash', ctrl.doorDashWebhook);

module.exports = router;
