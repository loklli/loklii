const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/listingsController');
const { authenticate } = require('../middleware/auth');
const { standard } = require('../middleware/rateLimiter');

router.get('/', standard, ctrl.browse);
router.get('/categories', standard, async (req, res) => {
  const supabase = require('../config/supabase');
  const { data } = await supabase.from('categories').select('*').eq('is_active', true).order('sort_order');
  return res.json(data);
});
router.get('/:id', standard, ctrl.getListing);

module.exports = router;
