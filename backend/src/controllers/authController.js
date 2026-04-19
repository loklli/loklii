const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { sendSMS, sendEmail } = require('../utils/notifications');
const { log } = require('../utils/activityLog');

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

function generateToken(userId, role) {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function generateRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () => crypto.randomBytes(10).toString('hex'));
}

// ── SIGNUP ──────────────────────────────────────────────────
exports.signup = async (req, res) => {
  try {
    const { email, phone, password, role, firstName, lastName, dateOfBirth, language } = req.body;

    // Age check — must be 18+
    const dob = new Date(dateOfBirth);
    const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (age < 18) return res.status(400).json({ error: 'Must be 18 or older to register.' });

    if (!['host', 'customer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }

    // Check duplicate
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .or(`email.eq.${email},phone.eq.${phone}`)
      .maybeSingle();
    if (existing) return res.status(409).json({ error: 'Email or phone already registered.' });

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const rawCodes = generateRecoveryCodes();
    const hashedCodes = await Promise.all(rawCodes.map((c) => bcrypt.hash(c, BCRYPT_ROUNDS)));

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email: email.toLowerCase(),
        phone,
        password_hash: passwordHash,
        role,
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirth,
        preferred_language: language || 'en',
        recovery_codes: hashedCodes,
      })
      .select()
      .single();

    if (error) throw error;

    // Create role profile
    if (role === 'host') {
      await supabase.from('host_profiles').insert({ user_id: user.id, city: '', state: '', zip_code: '' });
    } else {
      await supabase.from('customer_profiles').insert({ user_id: user.id });
    }

    const token = generateToken(user.id, user.role);
    await log(user.id, 'signup', 'user', user.id, { role });

    return res.status(201).json({
      token,
      recoveryCodes: rawCodes,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
};

// ── LOGIN ────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password, twoFaCode } = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) return res.status(401).json({ error: 'Invalid credentials.' });
    if (!user.is_active) return res.status(403).json({ error: 'Account deactivated.' });
    if (user.is_suspended) return res.status(403).json({ error: 'Account suspended.' });

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) return res.status(401).json({ error: 'Invalid credentials.' });

    // 2FA check
    if (user.two_fa_enabled) {
      if (!twoFaCode) return res.status(200).json({ requires2FA: true });
      const verified = speakeasy.totp.verify({
        secret: user.two_fa_secret,
        encoding: 'base32',
        token: twoFaCode,
        window: 1,
      });
      if (!verified) return res.status(401).json({ error: 'Invalid 2FA code.' });
    }

    await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);

    const token = generateToken(user.id, user.role);
    await log(user.id, 'login', 'user', user.id, {}, req.ip);

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        twoFaEnabled: user.two_fa_enabled,
        preferredLanguage: user.preferred_language,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed.' });
  }
};

// ── ENABLE 2FA ───────────────────────────────────────────────
exports.setup2FA = async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({ name: `Loklii (${req.user.email || ''})`, length: 20 });
    await supabase.from('users').update({ two_fa_secret: secret.base32 }).eq('id', req.user.userId);
    const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);
    return res.json({ secret: secret.base32, qrCode: qrDataUrl });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to setup 2FA.' });
  }
};

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

// ── PASSWORD RESET ───────────────────────────────────────────
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email, method } = req.body; // method: 'email' | 'sms'
    const { data: user } = await supabase.from('users').select('id, email, phone').eq('email', email.toLowerCase()).single();
    if (!user) return res.json({ success: true }); // Don't reveal existence

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await supabase.from('password_reset_tokens').insert({
      user_id: user.id, token_hash: tokenHash, method, expires_at: expiresAt,
    });

    if (method === 'email') {
      const link = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;
      await sendEmail(user.email, 'Reset your Loklii password',
        `<p>Click <a href="${link}">here</a> to reset your password. This link expires in 15 minutes.</p>`
      );
    } else if (method === 'sms' && user.phone) {
      await sendSMS(user.phone, `Your Loklii password reset code is: ${rawToken.slice(0, 6).toUpperCase()}. Expires in 15 minutes.`);
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to send reset.' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const { data: record } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!record) return res.status(400).json({ error: 'Invalid or expired reset token.' });

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await supabase.from('users').update({ password_hash: passwordHash }).eq('id', record.user_id);
    await supabase.from('password_reset_tokens').update({ used_at: new Date().toISOString() }).eq('id', record.id);

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
};

// ── RECOVERY CODE LOGIN ──────────────────────────────────────
exports.loginWithRecoveryCode = async (req, res) => {
  try {
    const { email, password, recoveryCode } = req.body;
    const { data: user } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).single();
    if (!user) return res.status(401).json({ error: 'Invalid credentials.' });

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) return res.status(401).json({ error: 'Invalid credentials.' });

    // Check recovery codes
    let validIndex = -1;
    for (let i = 0; i < (user.recovery_codes || []).length; i++) {
      const match = await bcrypt.compare(recoveryCode, user.recovery_codes[i]);
      if (match) { validIndex = i; break; }
    }
    if (validIndex === -1) return res.status(401).json({ error: 'Invalid recovery code.' });

    // Invalidate used code
    const newCodes = [...user.recovery_codes];
    newCodes.splice(validIndex, 1);
    await supabase.from('users').update({ recovery_codes: newCodes, two_fa_enabled: false }).eq('id', user.id);

    const token = generateToken(user.id, user.role);
    return res.json({ token, message: '2FA disabled. Please set up 2FA again.' });
  } catch (err) {
    return res.status(500).json({ error: 'Recovery login failed.' });
  }
};

// ── REGISTER PUSH TOKEN ──────────────────────────────────────
exports.registerPushToken = async (req, res) => {
  try {
    const { token, device } = req.body;
    await supabase.from('push_tokens').upsert({ user_id: req.user.userId, token, device }, { onConflict: 'user_id,token' });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to register push token.' });
  }
};
