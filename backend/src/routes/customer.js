const express = require('express');
const router = express.Router();
const { authenticate, requireCustomer } = require('../middleware/auth');
const supabase = require('../config/supabase');

const auth = [authenticate, requireCustomer];

// Profile
router.get('/profile', ...auth, async (req, res) => {
  const { data } = await supabase.from('customer_profiles')
    .select('*, users(first_name, last_name, email, phone, avatar_url, preferred_language)')
    .eq('user_id', req.user.userId).single();
  return res.json(data);
});

router.put('/profile', ...auth, async (req, res) => {
  const { city, state, zipCode, dietaryPreferences, allergyNotes } = req.body;
  await supabase.from('customer_profiles').update({
    city, state, zip_code: zipCode,
    dietary_preferences: dietaryPreferences,
    allergy_notes: allergyNotes,
  }).eq('user_id', req.user.userId);
  return res.json({ success: true });
});

// Saved hosts
router.get('/saved-hosts', ...auth, async (req, res) => {
  const { data: cp } = await supabase.from('customer_profiles').select('id').eq('user_id', req.user.userId).single();
  const { data } = await supabase.from('saved_hosts')
    .select('*, host_profiles(id, city, state, star_rating, users(first_name, last_name, avatar_url))')
    .eq('customer_id', cp.id);
  return res.json(data);
});

router.post('/saved-hosts/:hostId', ...auth, async (req, res) => {
  const { data: cp } = await supabase.from('customer_profiles').select('id').eq('user_id', req.user.userId).single();
  await supabase.from('saved_hosts').upsert({ customer_id: cp.id, host_id: req.params.hostId }, { onConflict: 'customer_id,host_id' });
  return res.json({ success: true });
});

router.delete('/saved-hosts/:hostId', ...auth, async (req, res) => {
  const { data: cp } = await supabase.from('customer_profiles').select('id').eq('user_id', req.user.userId).single();
  await supabase.from('saved_hosts').delete().eq('customer_id', cp.id).eq('host_id', req.params.hostId);
  return res.json({ success: true });
});

// Order history
router.get('/orders', ...auth, async (req, res) => {
  const { data: cp } = await supabase.from('customer_profiles').select('id').eq('user_id', req.user.userId).single();
  const { data } = await supabase.from('orders')
    .select('*, listings(title, photos), host_profiles(users(first_name, last_name, avatar_url))')
    .eq('customer_id', cp.id)
    .order('created_at', { ascending: false });
  return res.json(data);
});

module.exports = router;
