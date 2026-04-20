const supabase = require('../config/supabase');

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    // Verify via Supabase Auth (handles expiry, rotation automatically)
    const { data: { user: sbUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !sbUser) return res.status(401).json({ error: 'Invalid or expired token' });

    const { data: user, error } = await supabase
      .from('users')
      .select('id, role, is_active, is_suspended, two_fa_enabled, email, first_name, last_name, preferred_language')
      .eq('id', sbUser.id)
      .single();

    if (error || !user) return res.status(401).json({ error: 'Profile not found' });
    if (!user.is_active) return res.status(403).json({ error: 'Account deactivated' });
    if (user.is_suspended) return res.status(403).json({ error: 'Account suspended' });

    req.user = { ...user, userId: user.id };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

const requireHost = requireRole('host');
const requireCustomer = requireRole('customer');
const requireAdmin = requireRole('superadmin');

module.exports = { authenticate, requireRole, requireHost, requireCustomer, requireAdmin };
