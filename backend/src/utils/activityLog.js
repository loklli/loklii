const supabase = require('../config/supabase');

async function log(actorId, action, targetType = null, targetId = null, metadata = {}, ipAddress = null) {
  await supabase.from('activity_log').insert({
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
    ip_address: ipAddress,
  });
}

module.exports = { log };
