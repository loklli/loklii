const supabase = require('../config/supabase');
const stripe = require('../config/stripe');
const { notify } = require('../utils/notifications');
const { log } = require('../utils/activityLog');

// ── GET HOST PROFILE ─────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('host_profiles')
      .select(`*, users(first_name, last_name, email, avatar_url, preferred_language)`)
      .eq('user_id', req.user.userId)
      .single();
    if (error || !profile) return res.status(404).json({ error: 'Host profile not found.' });
    // Never expose zip_code publicly
    const { zip_code, ...publicProfile } = profile;
    return res.json(publicProfile);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get profile.' });
  }
};

// ── UPDATE HOST PROFILE ──────────────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    const { bio, city, state, zipCode, latitude, longitude } = req.body;
    const { data, error } = await supabase
      .from('host_profiles')
      .update({ bio, city, state, zip_code: zipCode, latitude, longitude, updated_at: new Date().toISOString() })
      .eq('user_id', req.user.userId)
      .select()
      .single();
    if (error) throw error;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
};

// ── ONLINE/OFFLINE SWITCH ────────────────────────────────────
exports.toggleOnline = async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from('host_profiles')
      .select('is_online, workspace_checklist_completed, workspace_photos, account_paused_for_fee, review_status')
      .eq('user_id', req.user.userId)
      .single();

    if (profile.account_paused_for_fee) {
      return res.status(403).json({ error: 'Account paused due to unpaid maintenance fee.' });
    }
    if (profile.review_status === 'under_review') {
      return res.status(403).json({ error: 'Account is under review. Contact support.' });
    }

    const goingOnline = !profile.is_online;
    if (goingOnline) {
      if (!profile.workspace_checklist_completed) {
        return res.status(400).json({ error: 'Complete workspace cleaning checklist before going online.' });
      }
      if ((profile.workspace_photos || []).length < 2) {
        return res.status(400).json({ error: 'At least 2 workspace photos required before going online.' });
      }
    }

    const { data } = await supabase
      .from('host_profiles')
      .update({ is_online: goingOnline, updated_at: new Date().toISOString() })
      .eq('user_id', req.user.userId)
      .select()
      .single();

    await log(req.user.userId, goingOnline ? 'host_went_online' : 'host_went_offline');
    return res.json({ isOnline: data.is_online });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to toggle status.' });
  }
};

// ── WORKSPACE CHECKLIST ──────────────────────────────────────
exports.completeChecklist = async (req, res) => {
  try {
    await supabase.from('host_profiles').update({
      workspace_checklist_completed: true,
      workspace_checklist_completed_at: new Date().toISOString(),
    }).eq('user_id', req.user.userId);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to complete checklist.' });
  }
};

// ── WORKSPACE PHOTOS ─────────────────────────────────────────
exports.addWorkspacePhoto = async (req, res) => {
  try {
    const { photoUrl } = req.body;
    const { data: profile } = await supabase
      .from('host_profiles').select('workspace_photos').eq('user_id', req.user.userId).single();
    const updated = [...(profile.workspace_photos || []), photoUrl];
    await supabase.from('host_profiles').update({ workspace_photos: updated }).eq('user_id', req.user.userId);
    return res.json({ photos: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to add photo.' });
  }
};

exports.removeWorkspacePhoto = async (req, res) => {
  try {
    const { photoUrl } = req.body;
    const { data: profile } = await supabase
      .from('host_profiles').select('workspace_photos').eq('user_id', req.user.userId).single();
    const updated = (profile.workspace_photos || []).filter((p) => p !== photoUrl);
    await supabase.from('host_profiles').update({ workspace_photos: updated }).eq('user_id', req.user.userId);
    return res.json({ photos: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to remove photo.' });
  }
};

// ── HOST DASHBOARD STATS ─────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from('host_profiles')
      .select('id, star_rating, total_orders_completed, is_online, fee_paid_until, account_paused_for_fee')
      .eq('user_id', req.user.userId)
      .single();

    const { count: pendingOrders } = await supabase
      .from('orders')
      .select('id', { count: 'exact' })
      .eq('host_id', profile.id)
      .eq('status', 'pending');

    const { data: recentOrders } = await supabase
      .from('orders')
      .select('id, order_number, status, total_amount, created_at, listings(title)')
      .eq('host_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(5);

    return res.json({
      starRating: profile.star_rating,
      totalOrdersCompleted: profile.total_orders_completed,
      isOnline: profile.is_online,
      feePaidUntil: profile.fee_paid_until,
      accountPausedForFee: profile.account_paused_for_fee,
      pendingOrders,
      recentOrders,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get stats.' });
  }
};

// ── APPEAL (for under-review hosts) ─────────────────────────
exports.submitAppeal = async (req, res) => {
  try {
    const { appealText } = req.body;
    await supabase.from('host_profiles').update({
      appeal_status: 'pending',
      appeal_text: appealText,
      appeal_submitted_at: new Date().toISOString(),
    }).eq('user_id', req.user.userId);
    await log(req.user.userId, 'host_appeal_submitted');
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to submit appeal.' });
  }
};

// ── STRIPE CONNECT ONBOARDING ────────────────────────────────
exports.createConnectAccount = async (req, res) => {
  try {
    const { data: user } = await supabase.from('users').select('email').eq('id', req.user.userId).single();
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email,
      capabilities: { transfers: { requested: true } },
    });

    await supabase.from('host_profiles').update({ stripe_connect_id: account.id, stripe_connect_status: 'pending' })
      .eq('user_id', req.user.userId);

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.FRONTEND_URL}/host/stripe/refresh`,
      return_url: `${process.env.FRONTEND_URL}/host/stripe/return`,
      type: 'account_onboarding',
    });

    return res.json({ url: accountLink.url });
  } catch (err) {
    console.error('Stripe Connect error:', err);
    return res.status(500).json({ error: 'Failed to create Stripe account.' });
  }
};

exports.getConnectStatus = async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from('host_profiles')
      .select('stripe_connect_id, stripe_connect_status')
      .eq('user_id', req.user.userId)
      .single();

    if (!profile.stripe_connect_id) return res.json({ status: 'not_started' });

    const account = await stripe.accounts.retrieve(profile.stripe_connect_id);
    const status = account.charges_enabled && account.payouts_enabled ? 'active' : 'pending';
    await supabase.from('host_profiles').update({ stripe_connect_status: status }).eq('user_id', req.user.userId);

    return res.json({ status });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get Connect status.' });
  }
};
