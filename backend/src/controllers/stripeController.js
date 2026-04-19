const stripe = require('../config/stripe');
const supabase = require('../config/supabase');
const { notify } = require('../utils/notifications');
const { log } = require('../utils/activityLog');

// ── STRIPE IDENTITY VERIFICATION ────────────────────────────
exports.createIdentitySession = async (req, res) => {
  try {
    const session = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: { userId: req.user.userId },
      options: {
        document: {
          require_id_number: true,
          require_live_capture: true,
          require_matching_selfie: true,
        },
      },
    });

    await supabase.from('users').update({ stripe_identity_session_id: session.id }).eq('id', req.user.userId);
    return res.json({ clientSecret: session.client_secret, sessionId: session.id });
  } catch (err) {
    console.error('Identity session error:', err);
    return res.status(500).json({ error: 'Failed to create identity session.' });
  }
};

exports.checkIdentityStatus = async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('users').select('stripe_identity_session_id').eq('id', req.user.userId).single();

    if (!user.stripe_identity_session_id) return res.json({ status: 'not_started' });

    const session = await stripe.identity.verificationSessions.retrieve(user.stripe_identity_session_id);
    if (session.status === 'verified') {
      await supabase.from('users').update({ is_verified: true }).eq('id', req.user.userId);
    }
    return res.json({ status: session.status });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to check identity status.' });
  }
};

// ── HOST MAINTENANCE FEE ─────────────────────────────────────
exports.createFeepaymentSession = async (req, res) => {
  try {
    const { data: user } = await supabase.from('users').select('email').eq('id', req.user.userId).single();
    const { data: profile } = await supabase.from('host_profiles').select('id').eq('user_id', req.user.userId).single();
    const { data: setting } = await supabase.from('platform_settings').select('value').eq('key', 'host_fee_amount').single();

    const amount = Math.round(parseFloat(setting.value) * 100);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'usd', product_data: { name: 'Loklii Host Maintenance Fee (6 months)' }, unit_amount: amount }, quantity: 1 }],
      mode: 'payment',
      customer_email: user.email,
      success_url: `${process.env.FRONTEND_URL}/host/dashboard?fee=success`,
      cancel_url: `${process.env.FRONTEND_URL}/host/dashboard?fee=cancelled`,
      metadata: { hostProfileId: profile.id, type: 'host_fee' },
    });

    return res.json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create payment session.' });
  }
};

// ── STRIPE WEBHOOK ───────────────────────────────────────────
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.metadata?.type === 'host_fee') {
          const hostProfileId = session.metadata.hostProfileId;
          const periodEnd = new Date();
          periodEnd.setMonth(periodEnd.getMonth() + 6);

          await supabase.from('host_profiles').update({
            fee_paid_until: periodEnd.toISOString(),
            account_paused_for_fee: false,
          }).eq('id', hostProfileId);

          await supabase.from('host_fee_payments').insert({
            host_id: hostProfileId,
            stripe_payment_intent_id: session.payment_intent,
            amount: session.amount_total / 100,
            period_start: new Date().toISOString(),
            period_end: periodEnd.toISOString(),
          });

          const { data: hp } = await supabase.from('host_profiles').select('users(id)').eq('id', hostProfileId).single();
          await notify(hp.users.id, 'fee_paid', {
            title: 'Fee Payment Received',
            body: 'Your Loklii host maintenance fee has been received. Your account is active for 6 months.',
          });
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object;
        // Log for manual review if needed
        await log(null, 'payment_failed', 'payment_intent', null, { paymentIntentId: pi.id });
        break;
      }

      case 'account.updated': {
        const account = event.data.object;
        const status = account.charges_enabled && account.payouts_enabled ? 'active' : 'pending';
        await supabase.from('host_profiles').update({ stripe_connect_status: status }).eq('stripe_connect_id', account.id);
        break;
      }
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(500).json({ error: 'Webhook processing failed.' });
  }
};
