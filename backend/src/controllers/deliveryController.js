const axios = require('axios');
const supabase = require('../config/supabase');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// ── DOORDASH DRIVE API ───────────────────────────────────────
function generateDoorDashJWT() {
  const header = { alg: 'HS256', 'dd-ver': 'DD-JWT-V1', kid: process.env.DOORDASH_KEY_ID };
  const payload = {
    aud: 'doordash',
    iss: process.env.DOORDASH_DEVELOPER_ID,
    kid: process.env.DOORDASH_KEY_ID,
    exp: Math.floor(Date.now() / 1000) + 300,
    iat: Math.floor(Date.now() / 1000),
  };
  return jwt.sign(payload, Buffer.from(process.env.DOORDASH_SIGNING_SECRET, 'base64'), {
    algorithm: 'HS256',
    header,
  });
}

async function createDoorDashDelivery(order, pickupAddress, dropoffAddress) {
  const token = generateDoorDashJWT();
  const response = await axios.post(
    'https://openapi.doordash.com/drive/v2/deliveries',
    {
      external_delivery_id: order.id,
      pickup_address: pickupAddress.street,
      pickup_business_name: 'Loklii Host',
      pickup_phone_number: '+10000000000', // Twilio masked number
      pickup_instructions: 'Ring doorbell',
      dropoff_address: dropoffAddress.street,
      dropoff_phone_number: dropoffAddress.phone || '+10000000000',
      dropoff_instructions: dropoffAddress.instructions || '',
      order_value: Math.round(order.subtotal * 100),
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

// ── UBER DIRECT API ──────────────────────────────────────────
let uberAccessToken = null;
let uberTokenExpiry = 0;

async function getUberToken() {
  if (uberAccessToken && Date.now() < uberTokenExpiry) return uberAccessToken;
  const resp = await axios.post('https://login.uber.com/oauth/v2/token', new URLSearchParams({
    client_id: process.env.UBER_CLIENT_ID,
    client_secret: process.env.UBER_CLIENT_SECRET,
    grant_type: 'client_credentials',
    scope: 'eats.deliveries',
  }));
  uberAccessToken = resp.data.access_token;
  uberTokenExpiry = Date.now() + (resp.data.expires_in - 60) * 1000;
  return uberAccessToken;
}

async function createUberDelivery(order, pickupAddress, dropoffAddress) {
  const token = await getUberToken();
  const response = await axios.post(
    'https://api.uber.com/v1/eats/deliveries',
    {
      pickup: { name: 'Loklii Host', address: pickupAddress },
      dropoff: { name: dropoffAddress.name, address: dropoffAddress },
      external_id: order.id,
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  return response.data;
}

// ── DISPATCH (DoorDash → Uber fallback) ────────────────────
exports.dispatchDelivery = async (req, res) => {
  try {
    const { orderId } = req.body;
    const { data: order } = await supabase
      .from('orders')
      .select('*, listings(host_profiles(zip_code, city, state))')
      .eq('id', orderId)
      .single();

    if (!order || order.delivery_type !== 'third_party') {
      return res.status(400).json({ error: 'Invalid order for third-party delivery.' });
    }

    const pickupAddress = {
      street: `${order.listings.host_profiles.city}, ${order.listings.host_profiles.state} ${order.listings.host_profiles.zip_code}`,
    };
    const dropoffAddress = order.delivery_address;

    let deliveryId = null;
    let provider = null;

    try {
      const ddResult = await createDoorDashDelivery(order, pickupAddress, dropoffAddress);
      deliveryId = ddResult.external_delivery_id;
      provider = 'doordash';
    } catch (ddErr) {
      console.warn('DoorDash failed, falling back to Uber Direct:', ddErr.message);
      try {
        const uberResult = await createUberDelivery(order, pickupAddress, dropoffAddress);
        deliveryId = uberResult.id;
        provider = 'uber';
      } catch (uberErr) {
        console.error('Both delivery providers failed:', uberErr.message);
        return res.status(503).json({ error: 'No delivery drivers available. Please retry.' });
      }
    }

    await supabase.from('orders').update({
      delivery_provider: provider,
      doordash_delivery_id: provider === 'doordash' ? deliveryId : null,
      uber_delivery_id: provider === 'uber' ? deliveryId : null,
    }).eq('id', orderId);

    return res.json({ success: true, provider, deliveryId });
  } catch (err) {
    console.error('Dispatch error:', err);
    return res.status(500).json({ error: 'Failed to dispatch delivery.' });
  }
};

// ── DELIVERY STATUS WEBHOOK (DoorDash) ──────────────────────
exports.doorDashWebhook = async (req, res) => {
  const { external_delivery_id, delivery_status } = req.body;
  const statusMap = {
    'enroute_to_pickup': 'preparing',
    'arrived_at_pickup': 'ready',
    'picked_up': 'picked_up',
    'delivered': 'delivered',
  };
  if (statusMap[delivery_status]) {
    await supabase.from('orders').update({ status: statusMap[delivery_status] }).eq('id', external_delivery_id);
  }
  return res.json({ received: true });
};
