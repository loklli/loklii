const supabase = require('../config/supabase');
const stripe = require('../config/stripe');
const { notify, notifyAdmin } = require('../utils/notifications');
const { log } = require('../utils/activityLog');
const axios = require('axios');

const CANCEL_WINDOW_MS = 15 * 60 * 1000;

// ── CREATE ORDER ─────────────────────────────────────────────
exports.createOrder = async (req, res) => {
  try {
    const { listingId, quantity, deliveryType, deliveryAddress, specialRequests } = req.body;

    const { data: customerProfile } = await supabase
      .from('customer_profiles').select('id, chargeback_ban').eq('user_id', req.user.userId).single();
    if (customerProfile.chargeback_ban) {
      return res.status(403).json({ error: 'Account permanently banned due to chargeback.' });
    }

    const { data: listing } = await supabase
      .from('listings')
      .select('*, host_profiles(id, stripe_connect_id, is_online, account_paused_for_fee, self_delivery_fee, self_delivery_radius_miles, users(id))')
      .eq('id', listingId)
      .eq('approval_status', 'approved')
      .eq('is_available', true)
      .single();

    if (!listing) return res.status(404).json({ error: 'Listing not available.' });
    if (listing.host_profiles.account_paused_for_fee) {
      return res.status(400).json({ error: 'This host is temporarily unavailable.' });
    }

    const subtotal = listing.price * quantity;
    let deliveryFee = 0;
    if (deliveryType === 'self_delivery') deliveryFee = listing.host_profiles.self_delivery_fee || 0;
    const total = subtotal + deliveryFee;

    // Create Stripe PaymentIntent — charge goes to host's Connect account
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100),
      currency: 'usd',
      transfer_data: { destination: listing.host_profiles.stripe_connect_id },
      metadata: { platform: 'loklii', listingId, customerId: customerProfile.id },
    });

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        customer_id: customerProfile.id,
        host_id: listing.host_profiles.id,
        listing_id: listingId,
        quantity,
        unit_price: listing.price,
        subtotal,
        delivery_fee: deliveryFee,
        total_amount: total,
        delivery_type: deliveryType,
        delivery_address: deliveryAddress || null,
        special_requests: specialRequests || null,
        stripe_payment_intent_id: paymentIntent.id,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Notify host
    await notify(listing.host_profiles.users.id, 'new_order', {
      title: 'New Order!',
      body: `You have a new order for ${listing.title}.`,
      data: { orderId: order.id, type: 'new_order' },
      smsBody: `Loklii: New order received for ${listing.title}! Open the app to accept.`,
    });

    await log(req.user.userId, 'order_created', 'order', order.id, { total });
    return res.status(201).json({ order, clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Create order error:', err);
    return res.status(500).json({ error: 'Failed to create order.' });
  }
};

// ── HOST: ACCEPT/DECLINE ORDER ───────────────────────────────
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, cancelReason } = req.body;

    const { data: hostProfile } = await supabase
      .from('host_profiles').select('id').eq('user_id', req.user.userId).single();

    const { data: order } = await supabase
      .from('orders')
      .select('*, customer_profiles(users(id))')
      .eq('id', id)
      .eq('host_id', hostProfile.id)
      .single();

    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const now = new Date();
    const createdAt = new Date(order.created_at);
    const elapsedMs = now - createdAt;

    // Host cancel penalty
    if (status === 'cancelled' && order.host_cancelled_at === null) {
      const updates = { status: 'cancelled', host_cancelled_at: now.toISOString() };
      if (elapsedMs > CANCEL_WINDOW_MS) {
        updates.host_cancel_reason = cancelReason;
        // Deduct 0.25 stars
        await supabase.from('host_profiles').update({
          star_rating: supabase.rpc('greatest', [1.0, supabase.raw('star_rating - 0.25')]),
        }).eq('id', hostProfile.id);
      }
      // Full refund to customer
      if (order.stripe_payment_intent_id) {
        await stripe.refunds.create({ payment_intent: order.stripe_payment_intent_id });
      }
      await supabase.from('orders').update(updates).eq('id', id);
    } else {
      const validTransitions = {
        pending: ['accepted', 'declined'],
        accepted: ['preparing', 'cancelled'],
        preparing: ['ready', 'cancelled'],
        ready: ['picked_up', 'delivered'],
        picked_up: ['completed'],
        delivered: ['completed'],
      };
      if (!(validTransitions[order.status] || []).includes(status)) {
        return res.status(400).json({ error: `Cannot transition from ${order.status} to ${status}.` });
      }

      const updates = { status, updated_at: now.toISOString() };
      if (status === 'preparing') updates.host_started_at = now.toISOString();
      if (status === 'completed') {
        updates.completed_at = now.toISOString();
        await supabase.from('host_profiles').update({
          total_orders_completed: supabase.raw('total_orders_completed + 1'),
        }).eq('id', hostProfile.id);
        await checkAndTriggerFee(hostProfile.id);
      }
      await supabase.from('orders').update(updates).eq('id', id);
    }

    // Notify customer
    const custUserId = order.customer_profiles?.users?.id;
    if (custUserId) {
      await notify(custUserId, `order_${status}`, {
        title: `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        body: `Your order #${order.order_number} has been ${status}.`,
        data: { orderId: id, status },
        smsBody: `Loklii: Your order #${order.order_number} is now ${status}.`,
      });
    }

    await log(req.user.userId, `order_${status}`, 'order', id);
    return res.json({ success: true });
  } catch (err) {
    console.error('Update order error:', err);
    return res.status(500).json({ error: 'Failed to update order.' });
  }
};

// ── CUSTOMER: CANCEL ORDER ───────────────────────────────────
exports.customerCancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: customerProfile } = await supabase
      .from('customer_profiles').select('id').eq('user_id', req.user.userId).single();

    const { data: order } = await supabase
      .from('orders').select('*').eq('id', id).eq('customer_id', customerProfile.id).single();
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const now = new Date();
    const elapsedMs = now - new Date(order.created_at);
    let refundAmount = 0;
    let refundReason = '';

    if (elapsedMs <= CANCEL_WINDOW_MS) {
      refundAmount = order.total_amount;
      refundReason = 'Customer cancelled within 15 minutes';
    } else if (order.status === 'accepted' && !order.host_started_at) {
      refundAmount = order.total_amount * 0.5;
      refundReason = 'Customer cancelled before host started — 50% refund';
    } else if (order.host_started_at) {
      refundAmount = 0;
      refundReason = 'Customer cancelled after host started — no refund';
    }

    if (refundAmount > 0 && order.stripe_payment_intent_id) {
      await stripe.refunds.create({
        payment_intent: order.stripe_payment_intent_id,
        amount: Math.round(refundAmount * 100),
      });
    }

    await supabase.from('orders').update({
      status: 'cancelled',
      customer_cancelled_at: now.toISOString(),
      refund_amount: refundAmount,
      refund_reason: refundReason,
    }).eq('id', id);

    await log(req.user.userId, 'customer_cancelled_order', 'order', id, { refundAmount });
    return res.json({ success: true, refundAmount });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to cancel order.' });
  }
};

// ── FILE DISPUTE ─────────────────────────────────────────────
exports.fileDispute = async (req, res) => {
  try {
    const { orderId, reason, evidenceUrls } = req.body;

    const { data: order } = await supabase
      .from('orders').select('*').eq('id', orderId).single();

    if (!order) return res.status(404).json({ error: 'Order not found.' });

    // 72-hour window
    const hoursSinceOrder = (Date.now() - new Date(order.created_at)) / (1000 * 60 * 60);
    if (hoursSinceOrder > 72) {
      return res.status(400).json({ error: 'Dispute window has closed (72 hours).' });
    }

    const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const { data: dispute } = await supabase.from('disputes').insert({
      order_id: orderId,
      filed_by: req.user.userId,
      against_id: req.user.role === 'customer' ? order.host_id : order.customer_id,
      reason,
      evidence_urls: evidenceUrls || [],
      deadline_at: deadline,
    }).select().single();

    await supabase.from('orders').update({ status: 'disputed' }).eq('id', orderId);
    await notifyAdmin('Dispute Filed', `Order ${order.order_number} has a new dispute. Resolve by ${deadline}.`);
    await log(req.user.userId, 'dispute_filed', 'dispute', dispute.id);
    return res.status(201).json(dispute);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to file dispute.' });
  }
};

// ── LEAVE REVIEW ─────────────────────────────────────────────
exports.leaveReview = async (req, res) => {
  try {
    const { orderId, rating, comment } = req.body;

    const { data: order } = await supabase
      .from('orders').select('*').eq('id', orderId).eq('status', 'completed').single();
    if (!order) return res.status(404).json({ error: 'Completed order not found.' });

    let revieweeId;
    if (req.user.role === 'customer') {
      const { data: hp } = await supabase.from('host_profiles').select('users(id)').eq('id', order.host_id).single();
      revieweeId = hp.users.id;
    } else {
      const { data: cp } = await supabase.from('customer_profiles').select('users(id)').eq('id', order.customer_id).single();
      revieweeId = cp.users.id;
    }

    const { data: review, error } = await supabase.from('reviews').insert({
      order_id: orderId,
      reviewer_id: req.user.userId,
      reviewee_id: revieweeId,
      reviewer_role: req.user.role,
      rating,
      comment,
    }).select().single();

    if (error) throw error;
    return res.status(201).json(review);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to leave review.' });
  }
};

// ── GET ORDER TRACKING ───────────────────────────────────────
exports.getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *, listings(title, photos),
        host_profiles(users(first_name, last_name, avatar_url)),
        customer_profiles(users(first_name, last_name))
      `)
      .eq('id', id)
      .single();

    if (error || !order) return res.status(404).json({ error: 'Order not found.' });
    return res.json(order);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get order.' });
  }
};

// ── CHECK HOST FEE THRESHOLD ─────────────────────────────────
async function checkAndTriggerFee(hostProfileId) {
  const { data: profile } = await supabase
    .from('host_profiles').select('total_orders_completed, is_fee_active, fee_paid_until').eq('id', hostProfileId).single();

  const { data: settings } = await supabase.from('platform_settings').select('value').eq('key', 'host_free_orders').single();
  const freeOrders = parseInt(settings?.value || '4');

  if (profile.total_orders_completed >= freeOrders && !profile.is_fee_active) {
    await supabase.from('host_profiles').update({ is_fee_active: true }).eq('id', hostProfileId);
  }

  if (profile.is_fee_active && profile.fee_paid_until && new Date(profile.fee_paid_until) < new Date()) {
    await supabase.from('host_profiles').update({ account_paused_for_fee: true }).eq('id', hostProfileId);
  }
}
