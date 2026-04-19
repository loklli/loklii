const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/ordersController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, ctrl.createOrder);
router.get('/:id', authenticate, ctrl.getOrder);
router.patch('/:id/status', authenticate, ctrl.updateOrderStatus);
router.post('/:id/cancel', authenticate, ctrl.customerCancelOrder);
router.post('/dispute', authenticate, ctrl.fileDispute);
router.post('/review', authenticate, ctrl.leaveReview);

module.exports = router;
