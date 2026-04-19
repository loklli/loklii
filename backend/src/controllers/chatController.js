const supabase = require('../config/supabase');
const { log } = require('../utils/activityLog');

// Detect and block sharing of personal contact info
const PII_PATTERN = /(\+?\d[\d\s\-()]{7,}\d)|([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})|(4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})/;

function containsPII(text) {
  return PII_PATTERN.test(text);
}

// ── GET CONVERSATIONS ────────────────────────────────────────
exports.getConversations = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id, last_message_at, is_blocked,
        participant_1:users!participant_1(id, first_name, last_name, avatar_url),
        participant_2:users!participant_2(id, first_name, last_name, avatar_url),
        orders(id, order_number, status)
      `)
      .or(`participant_1.eq.${req.user.userId},participant_2.eq.${req.user.userId}`)
      .order('last_message_at', { ascending: false });

    if (error) throw error;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get conversations.' });
  }
};

// ── GET MESSAGES ─────────────────────────────────────────────
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;

    // Verify user is participant
    const { data: convo } = await supabase
      .from('conversations').select('participant_1, participant_2, is_blocked')
      .eq('id', conversationId).single();
    if (!convo || (convo.participant_1 !== req.user.userId && convo.participant_2 !== req.user.userId)) {
      return res.status(403).json({ error: 'Not a participant.' });
    }

    let query = supabase
      .from('messages')
      .select('*, users!sender_id(id, first_name, avatar_url)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (before) query = query.lt('created_at', before);

    const { data, error } = await query;
    if (error) throw error;

    // Mark as read
    await supabase.from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', req.user.userId)
      .is('read_at', null);

    return res.json(data.reverse());
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get messages.' });
  }
};

// ── SEND MESSAGE ─────────────────────────────────────────────
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId, content } = req.body;

    const { data: convo } = await supabase
      .from('conversations').select('participant_1, participant_2, is_blocked')
      .eq('id', conversationId).single();

    if (!convo || (convo.participant_1 !== req.user.userId && convo.participant_2 !== req.user.userId)) {
      return res.status(403).json({ error: 'Not a participant.' });
    }
    if (convo.is_blocked) return res.status(403).json({ error: 'Conversation is blocked.' });

    const isFlagged = containsPII(content);
    if (isFlagged) {
      await log(req.user.userId, 'message_flagged_pii', 'conversation', conversationId);
    }

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: req.user.userId,
        content: isFlagged ? '[Message blocked: contact info not allowed in chat]' : content,
        is_flagged: isFlagged,
        flag_reason: isFlagged ? 'Contains phone/email/payment info' : null,
      })
      .select()
      .single();

    if (error) throw error;

    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId);
    return res.status(201).json(message);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to send message.' });
  }
};

// ── START CONVERSATION ───────────────────────────────────────
exports.startConversation = async (req, res) => {
  try {
    const { recipientId, orderId } = req.body;

    // Check for existing conversation
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(`and(participant_1.eq.${req.user.userId},participant_2.eq.${recipientId}),and(participant_1.eq.${recipientId},participant_2.eq.${req.user.userId})`)
      .maybeSingle();

    if (existing) return res.json({ conversationId: existing.id });

    const { data, error } = await supabase
      .from('conversations')
      .insert({ participant_1: req.user.userId, participant_2: recipientId, order_id: orderId || null })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json({ conversationId: data.id });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to start conversation.' });
  }
};

// ── BLOCK USER ───────────────────────────────────────────────
exports.blockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    await supabase.from('blocks').insert({ blocker_id: req.user.userId, blocked_id: userId });
    await supabase.from('conversations')
      .update({ is_blocked: true, blocked_by: req.user.userId })
      .or(`and(participant_1.eq.${req.user.userId},participant_2.eq.${userId}),and(participant_1.eq.${userId},participant_2.eq.${req.user.userId})`);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to block user.' });
  }
};

// ── REPORT USER/LISTING ──────────────────────────────────────
exports.report = async (req, res) => {
  try {
    const { reportedId, listingId, reason, details } = req.body;
    const { data: report } = await supabase.from('reports').insert({
      reporter_id: req.user.userId,
      reported_id: reportedId,
      listing_id: listingId || null,
      reason,
      details,
    }).select().single();

    const { notify: notifyFn } = require('../utils/notifications');
    const { notifyAdmin } = require('../utils/notifications');
    await notifyAdmin('Safety Report', `A new report was filed against user ${reportedId}. Reason: ${reason}`);
    return res.status(201).json(report);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to submit report.' });
  }
};
