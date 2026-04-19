require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { standard } = require('./middleware/rateLimiter');
const supabase = require('./config/supabase');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
});

// ── SECURITY ─────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(standard);

// Stripe webhook needs raw body — must come before json parser
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));

// ── SESSION TIMEOUT CHECK ────────────────────────────────────
app.use(async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token);
      if (decoded?.userId) {
        await supabase.from('users').update({ session_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() }).eq('id', decoded.userId);
      }
    } catch {}
  }
  next();
});

// ── ROUTES ───────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/host', require('./routes/host'));
app.use('/api/customer', require('./routes/customer'));
app.use('/api/listings', require('./routes/listings'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/stripe', require('./routes/stripe'));
app.use('/api/delivery', require('./routes/delivery'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── REAL-TIME CHAT via Socket.IO ─────────────────────────────
const jwt = require('jsonwebtoken');

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  socket.join(`user:${socket.userId}`);

  socket.on('join_conversation', (conversationId) => {
    socket.join(`conversation:${conversationId}`);
  });

  socket.on('send_message', async (data) => {
    const { conversationId, content } = data;
    // Message is persisted via REST API; this just broadcasts in real-time
    io.to(`conversation:${conversationId}`).emit('new_message', {
      conversationId,
      content,
      senderId: socket.userId,
      createdAt: new Date().toISOString(),
    });
  });

  socket.on('typing', (data) => {
    socket.to(`conversation:${data.conversationId}`).emit('user_typing', {
      userId: socket.userId,
      conversationId: data.conversationId,
    });
  });

  socket.on('disconnect', () => {
    socket.leave(`user:${socket.userId}`);
  });
});

// ── AUTO RESOLVE EXPIRED DISPUTES ────────────────────────────
const autoResolveDisputes = async () => {
  const stripe = require('./config/stripe');
  const { data: expiredDisputes } = await supabase
    .from('disputes')
    .select('*, orders(stripe_payment_intent_id, total_amount)')
    .eq('status', 'open')
    .lt('deadline_at', new Date().toISOString());

  for (const dispute of expiredDisputes || []) {
    if (dispute.orders.stripe_payment_intent_id) {
      try {
        await stripe.refunds.create({ payment_intent: dispute.orders.stripe_payment_intent_id });
      } catch (e) {
        console.error('Auto-refund failed:', e.message);
      }
    }
    await supabase.from('disputes').update({ status: 'auto_refunded' }).eq('id', dispute.id);
    await supabase.from('orders').update({ status: 'refunded' }).eq('id', dispute.order_id);
  }
};

// Run every hour
setInterval(autoResolveDisputes, 60 * 60 * 1000);

// ── START ────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Loklii backend running on port ${PORT}`);
  autoResolveDisputes(); // Run once on startup
});

module.exports = { app, io };
