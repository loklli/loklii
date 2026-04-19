const express = require('express');
const router = express.Router();
const hostCtrl = require('../controllers/hostController');
const listCtrl = require('../controllers/listingsController');
const { authenticate, requireHost } = require('../middleware/auth');

const auth = [authenticate, requireHost];

router.get('/profile', ...auth, hostCtrl.getProfile);
router.put('/profile', ...auth, hostCtrl.updateProfile);
router.post('/online', ...auth, hostCtrl.toggleOnline);
router.post('/checklist', ...auth, hostCtrl.completeChecklist);
router.post('/workspace-photo', ...auth, hostCtrl.addWorkspacePhoto);
router.delete('/workspace-photo', ...auth, hostCtrl.removeWorkspacePhoto);
router.get('/dashboard', ...auth, hostCtrl.getDashboardStats);
router.post('/appeal', ...auth, hostCtrl.submitAppeal);
router.post('/stripe/connect', ...auth, hostCtrl.createConnectAccount);
router.get('/stripe/status', ...auth, hostCtrl.getConnectStatus);

// Listings
router.get('/listings', ...auth, listCtrl.getMyListings);
router.post('/listings', ...auth, listCtrl.createListing);
router.put('/listings/:id', ...auth, listCtrl.updateListing);
router.delete('/listings/:id', ...auth, listCtrl.deleteListing);
router.post('/listings/:id/photos', ...auth, listCtrl.addListingPhoto);

module.exports = router;
