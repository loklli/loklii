const supabase = require('../config/supabase');
const { notify, notifyAdmin } = require('../utils/notifications');
const { log } = require('../utils/activityLog');
const stripe = require('../config/stripe');

// ── DASHBOARD OVERVIEW ───────────────────────────────────────
exports.getOverview = async (req, res) => {
  try {
    const [hosts, customers, pendingListings, openDisputes, pendingAppeals] = await Promise.all([
      supabase.from('host_profiles').select('id', { count: 'exact' }),
      supabase.from('customer_profiles').select('id', { count: 'exact' }),
      supabase.from('listings').select('id', { count: 'exact' }).eq('approval_status', 'pending'),
      supabase.from('disputes').select('id', { count: 'exact' }).eq('status', 'open'),
      supabase.from('host_profiles').select('id', { count: 'exact' }).eq('appeal_status', 'pending'),
    ]);

    return res.json({
      totalHosts: hosts.count,
      totalCustomers: customers.count,
      pendingListings: pendingListings.count,
      openDisputes: openDisputes.count,
      pendingAppeals: pendingAppeals.count,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get overview.' });
  }
};

// ── MANAGE LISTINGS (approve / reject) ──────────────────────
exports.getPendingListings = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('listings')
      .select('*, categories(name), host_profiles(users(first_name, last_name, email))')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get pending listings.' });
  }
};

exports.approveListing = async (req, res) => {
  try {
    const { id } = req.params;
    await supabase.from('listings').update({
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: req.user.userId,
    }).eq('id', id);

    const { data: listing } = await supabase
      .from('listings').select('host_profiles(users(id))').eq('id', id).single();
    const hostUserId = listing.host_profiles.users.id;
    await notify(hostUserId, 'listing_approved', {
      title: 'Listing Approved!',
      body: 'Your listing has been approved and is now live.',
      data: { listingId: id },
    });

    await log(req.user.userId, 'listing_approved', 'listing', id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to approve listing.' });
  }
};

exports.rejectListing = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    await supabase.from('listings').update({
      approval_status: 'rejected',
      rejection_reason: reason,
    }).eq('id', id);

    const { data: listing } = await supabase
      .from('listings').select('host_profiles(users(id))').eq('id', id).single();
    await notify(listing.host_profiles.users.id, 'listing_rejected', {
      title: 'Listing Rejected',
      body: `Your listing was not approved. Reason: ${reason}`,
      data: { listingId: id },
    });

    await log(req.user.userId, 'listing_rejected', 'listing', id, { reason });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reject listing.' });
  }
};

// ── MANAGE HOSTS ─────────────────────────────────────────────
exports.getHosts = async (req, res) => {
  try {
    const { status, search, limit = 20, offset = 0 } = req.query;
    let query = supabase
      .from('host_profiles')
      .select('*, users(id, first_name, last_name, email, phone, is_suspended, is_active, created_at)')
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)
      .order('created_at', { ascending: false });

    if (status === 'under_review') query = query.eq('review_status', 'under_review');
    if (status === 'paused') query = query.eq('account_paused_for_fee', true);

    const { data, error } = await query;
    if (error) throw error;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get hosts.' });
  }
};

exports.pauseHost = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    await supabase.from('users').update({ is_suspended: true, suspension_reason: reason }).eq('id', userId);
    await supabase.from('host_profiles').update({ is_online: false }).eq('user_id', userId);
    await notify(userId, 'account_paused', { title: 'Account Paused', body: `Your account has been paused. Reason: ${reason}` });
    await log(req.user.userId, 'admin_paused_host', 'user', userId, { reason });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to pause host.' });
  }
};

exports.reinstateHost = async (req, res) => {
  try {
    const { userId } = req.params;
    await supabase.from('users').update({ is_suspended: false, suspension_reason: null }).eq('id', userId);
    await supabase.from('host_profiles').update({
      review_status: 'good',
      appeal_status: 'resolved',
      account_paused_for_fee: false,
    }).eq('user_id', userId);
    await notify(userId, 'account_reinstated', { title: 'Account Reinstated', body: 'Your account is active again.' });
    await log(req.user.userId, 'admin_reinstated_host', 'user', userId);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reinstate host.' });
  }
};

// ── MANAGE CUSTOMERS ─────────────────────────────────────────
exports.getCustomers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('customer_profiles')
      .select('*, users(id, first_name, last_name, email, phone, is_suspended, created_at)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get customers.' });
  }
};

exports.suspendCustomer = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    await supabase.from('users').update({ is_suspended: true, suspension_reason: reason }).eq('id', userId);
    await log(req.user.userId, 'admin_suspended_customer', 'user', userId, { reason });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to suspend customer.' });
  }
};

// ── MANAGE DISPUTES ──────────────────────────────────────────
exports.getDisputes = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('disputes')
      .select('*, orders(order_number, total_amount, stripe_payment_intent_id)')
      .eq('status', 'open')
      .order('deadline_at', { ascending: true });
    if (error) throw error;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get disputes.' });
  }
};

exports.resolveDispute = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution, adminNotes, isFalseDispute } = req.body;

    const { data: dispute } = await supabase.from('disputes').select('*, orders(stripe_payment_intent_id, total_amount, customer_id)').eq('id', id).single();

    // Issue refund if needed
    if (['refund_full', 'refund_partial'].includes(resolution) && dispute.orders.stripe_payment_intent_id) {
      const amount = resolution === 'refund_full' ? dispute.orders.total_amount : dispute.orders.total_amount * 0.5;
      await stripe.refunds.create({
        payment_intent: dispute.orders.stripe_payment_intent_id,
        amount: Math.round(amount * 100),
      });
      await supabase.from('orders').update({ status: 'refunded', refund_amount: amount }).eq('id', dispute.order_id);
    }

    // Track false disputes
    if (isFalseDispute) {
      await supabase.from('customer_profiles').update({
        false_dispute_count: supabase.raw('false_dispute_count + 1'),
      }).eq('id', dispute.orders.customer_id);

      const { data: cp } = await supabase.from('customer_profiles').select('false_dispute_count, users(id)').eq('id', dispute.orders.customer_id).single();
      const { data: settings } = await supabase.from('platform_settings').select('value').eq('key', 'false_dispute_limit').single();
      if (cp.false_dispute_count >= parseInt(settings.value || '3')) {
        await supabase.from('users').update({ is_suspended: true, suspension_reason: 'Exceeded false dispute limit' }).eq('id', cp.users.id);
      }
    }

    await supabase.from('disputes').update({
      status: 'resolved',
      resolution,
      admin_notes: adminNotes,
      resolved_by: req.user.userId,
      resolved_at: new Date().toISOString(),
      is_false_dispute: isFalseDispute || false,
    }).eq('id', id);

    await log(req.user.userId, 'dispute_resolved', 'dispute', id, { resolution });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to resolve dispute.' });
  }
};

// ── MANAGE APPEALS ───────────────────────────────────────────
exports.getAppeals = async (req, res) => {
  try {
    const { data } = await supabase
      .from('host_profiles')
      .select('id, appeal_text, appeal_submitted_at, star_rating, negative_review_count, users(id, first_name, last_name, email)')
      .eq('appeal_status', 'pending');
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get appeals.' });
  }
};

exports.resolveAppeal = async (req, res) => {
  try {
    const { hostProfileId } = req.params;
    const { decision } = req.body; // 'reinstate' | 'remove'

    if (decision === 'reinstate') {
      await supabase.from('host_profiles').update({
        review_status: 'good',
        appeal_status: 'resolved',
        negative_review_count: 0,
      }).eq('id', hostProfileId);
      const { data: hp } = await supabase.from('host_profiles').select('users(id)').eq('id', hostProfileId).single();
      await notify(hp.users.id, 'appeal_resolved', { title: 'Appeal Approved', body: 'Your account has been reinstated.' });
    } else {
      await supabase.from('host_profiles').update({ review_status: 'suspended', appeal_status: 'resolved' }).eq('id', hostProfileId);
      const { data: hp } = await supabase.from('host_profiles').select('users(id)').eq('id', hostProfileId).single();
      await supabase.from('users').update({ is_active: false }).eq('id', hp.users.id);
      await notify(hp.users.id, 'appeal_denied', { title: 'Appeal Denied', body: 'Your account has been permanently removed.' });
    }

    await log(req.user.userId, `appeal_${decision}`, 'host_profile', hostProfileId);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to resolve appeal.' });
  }
};

// ── PLATFORM SETTINGS ────────────────────────────────────────
exports.getSettings = async (req, res) => {
  try {
    const { data } = await supabase.from('platform_settings').select('*');
    return res.json(Object.fromEntries(data.map((s) => [s.key, s.value])));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get settings.' });
  }
};

exports.updateSetting = async (req, res) => {
  try {
    const { key, value } = req.body;
    await supabase.from('platform_settings').upsert({ key, value, updated_by: req.user.userId, updated_at: new Date().toISOString() });
    await log(req.user.userId, 'setting_updated', 'platform_settings', null, { key, value });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update setting.' });
  }
};

// ── ACTIVITY LOG ─────────────────────────────────────────────
exports.getActivityLog = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const { data } = await supabase
      .from('activity_log')
      .select('*, users!actor_id(first_name, last_name, email, role)')
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get activity log.' });
  }
};
