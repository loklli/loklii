const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../middleware/auth');

const auth = [authenticate, requireAdmin];

router.get('/overview', ...auth, ctrl.getOverview);

// Listings
router.get('/listings/pending', ...auth, ctrl.getPendingListings);
router.post('/listings/:id/approve', ...auth, ctrl.approveListing);
router.post('/listings/:id/reject', ...auth, ctrl.rejectListing);

// Hosts
router.get('/hosts', ...auth, ctrl.getHosts);
router.post('/hosts/:userId/pause', ...auth, ctrl.pauseHost);
router.post('/hosts/:userId/reinstate', ...auth, ctrl.reinstateHost);

// Customers
router.get('/customers', ...auth, ctrl.getCustomers);
router.post('/customers/:userId/suspend', ...auth, ctrl.suspendCustomer);

// Disputes
router.get('/disputes', ...auth, ctrl.getDisputes);
router.post('/disputes/:id/resolve', ...auth, ctrl.resolveDispute);

// Appeals
router.get('/appeals', ...auth, ctrl.getAppeals);
router.post('/appeals/:hostProfileId/resolve', ...auth, ctrl.resolveAppeal);

// Settings & logs
router.get('/settings', ...auth, ctrl.getSettings);
router.put('/settings', ...auth, ctrl.updateSetting);
router.get('/activity-log', ...auth, ctrl.getActivityLog);

module.exports = router;
