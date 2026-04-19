-- ============================================================
-- AUTO-EXPIRE DISPUTE AUTO-REFUND (can also be run via cron)
-- ============================================================
CREATE OR REPLACE FUNCTION auto_refund_expired_disputes()
RETURNS void AS $$
DECLARE
  dispute_record RECORD;
BEGIN
  FOR dispute_record IN
    SELECT d.id, d.order_id, o.stripe_payment_intent_id
    FROM disputes d
    JOIN orders o ON o.id = d.order_id
    WHERE d.status = 'open'
      AND d.deadline_at < now()
  LOOP
    UPDATE disputes SET status = 'auto_refunded' WHERE id = dispute_record.id;
    UPDATE orders SET status = 'refunded' WHERE id = dispute_record.order_id;
    -- Stripe refund is handled in app layer
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- HOST STAR RATING (safe increment/decrement)
-- ============================================================
CREATE OR REPLACE FUNCTION deduct_host_star(host_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE host_profiles
    SET star_rating = GREATEST(1.0, star_rating - 0.25),
        updated_at = now()
    WHERE user_id = host_user_id;
END;
$$ LANGUAGE plpgsql;

