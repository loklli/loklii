const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const supabase = require('../config/supabase');
const { log } = require('../utils/activityLog');

// ── CREATE PROFILE (called after Supabase Auth email verification) ──────────
exports.createProfile = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const { data: { user: sbUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !sbUser) return res.status(401).json({ error: 'Invalid token' });

    // Idempotent — return existing profile if already created
    const { data: existing } = await supabase.from('users').select('*').eq('id', sbUser.id).single();
    if (existing) {
      return res.json({ user: formatUser(existing) });
    }

    const { phone, role, firstName, lastName, dateOfBirth, language,
            city, state, zipCode, dietaryPreferences, allergyNotes } = req.body;

    if (!['host', 'customer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }

    const dob = new Date(dateOfBirth);
    const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000);
    if (isNaN(age) || age < 18) return res.status(400).json({ error: 'Must be 18 or older to register.' });

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        id: sbUser.id,
        email: sbUser.email,
        phone: phone || null,
        role,
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirth,
        preferred_language: language || 'en',
        is_verified: true, // email confirmed by Supabase
      })
      .select()
      .single();

    if (error) {
      console.error('Profile creation error:', error);
      return res.status(500).json({ error: 'Failed to create profile.' });
    }

    if (role === 'host') {
      await supabase.from('host_profiles').insert({
        user_id: user.id,
        city: city || '',
        state: state || '',
        zip_code: zipCode || '',
      });
    } else {
      await supabase.from('customer_profiles').insert({
        user_id: user.id,
        city: city || null,
        state: state || null,
        zip_code: zipCode || null,
        dietary_preferences: dietaryPreferences || [],
        allergy_notes: allergyNotes || null,
      });
    }

    await log(user.id, 'signup', 'user', user.id, { role });

    return res.status(201).json({ user: formatUser(user) });
  } catch (err) {
    console.error('createProfile error:', err);
    return res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
};

// ── GET ME ───────────────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    if (req.user.two_fa_enabled) {
      // 2FA is required — return flag so frontend can prompt for code
      return res.json({ requires2FA: true });
    }

    await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', req.user.userId);
    return res.json({ user: formatUser(req.user) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch profile.' });
  }
};

// ── 2FA LOGIN CHECK (called after user submits TOTP during login) ────────────
exports.verifyTwoFALogin = async (req, res) => {
  try {
    const { token } = req.body;
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.userId)
      .single();

    if (!user?.two_fa_secret) return res.status(400).json({ error: '2FA not set up.' });

    const verified = speakeasy.totp.verify({
      secret: user.two_fa_secret,
      encoding: 'base32',
      token,
      window: 1,
    });
    if (!verified) return res.status(401).json({ error: 'Invalid 2FA code.' });

    await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);
    await log(user.id, 'login_2fa', 'user', user.id, {});

    return res.json({ user: formatUser(user) });
  } catch (err) {
    return res.status(500).json({ error: 'Verification failed.' });
  }
};

// ── SETUP 2FA ────────────────────────────────────────────────────────────────
exports.setup2FA = async (req, res) => {
  try {
    const { data: user } = await supabase.from('users').select('email').eq('id', req.user.userId).single();
    const secret = speakeasy.generateSecret({ name: `Loklii (${user?.email || ''})`, length: 20 });
    await supabase.from('users').update({ two_fa_secret: secret.base32 }).eq('id', req.user.userId);
    const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);
    return res.json({ secret: secret.base32, qrCode: qrDataUrl });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to setup 2FA.' });
  }
};

// ── VERIFY 2FA SETUP ─────────────────────────────────────────────────────────
exports.verify2FA = async (req, res) => {
  try {
    const { token } = req.body;
    const { data: user } = await supabase.from('users').select('two_fa_secret').eq('id', req.user.userId).single();
    const verified = speakeasy.totp.verify({
      secret: user.two_fa_secret, encoding: 'base32', token, window: 1,
    });
    if (!verified) return res.status(400).json({ error: 'Invalid code.' });
    await supabase.from('users').update({ two_fa_enabled: true }).eq('id', req.user.userId);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify 2FA.' });
  }
};

// ── REGISTER PUSH TOKEN ──────────────────────────────────────────────────────
exports.registerPushToken = async (req, res) => {
  try {
    const { token, device } = req.body;
    await supabase.from('push_tokens').upsert(
      { user_id: req.user.userId, token, device },
      { onConflict: 'user_id,token' }
    );
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to register push token.' });
  }
};

// ── HELPERS ──────────────────────────────────────────────────────────────────
function formatUser(u) {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    firstName: u.first_name,
    lastName: u.last_name,
    preferredLanguage: u.preferred_language,
    twoFaEnabled: u.two_fa_enabled,
    isVerified: u.is_verified,
  };
}
