const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { data: user, error } = await supabase
      .from('users')
      .select('id, role, is_active, is_suspended, two_fa_enabled')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) return res.status(401).json({ error: 'Invalid token' });
    if (!user.is_active) return res.status(403).json({ error: 'Account deactivated' });
    if (user.is_suspended) return res.status(403).json({ error: 'Account suspended' });

    req.user = { ...user, userId: user.id };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
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
