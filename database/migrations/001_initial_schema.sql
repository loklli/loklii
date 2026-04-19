-- ============================================================
-- LOKLII DATABASE SCHEMA
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================
-- USERS TABLE (base for hosts and customers)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('host', 'customer', 'superadmin')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  avatar_url TEXT,
  date_of_birth DATE NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_suspended BOOLEAN DEFAULT false,
  suspension_reason TEXT,
  two_fa_enabled BOOLEAN DEFAULT false,
  two_fa_secret TEXT,
  recovery_codes TEXT[], -- hashed recovery codes
  stripe_customer_id TEXT,
  stripe_identity_session_id TEXT,
  preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en', 'ar', 'es')),
  last_login_at TIMESTAMPTZ,
  session_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- HOST PROFILES
-- ============================================================
CREATE TABLE host_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL, -- private, not shown publicly
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  is_online BOOLEAN DEFAULT false,
  star_rating DECIMAL(3,2) DEFAULT 5.00,
  total_reviews INTEGER DEFAULT 0,
  negative_review_count INTEGER DEFAULT 0,
  review_status TEXT DEFAULT 'good' CHECK (review_status IN ('good', 'under_review', 'suspended')),
  workspace_photos TEXT[] DEFAULT '{}',
  workspace_checklist_completed BOOLEAN DEFAULT false,
  workspace_checklist_completed_at TIMESTAMPTZ,
  stripe_connect_id TEXT,
  stripe_connect_status TEXT DEFAULT 'pending' CHECK (stripe_connect_status IN ('pending', 'active', 'restricted')),
  total_orders_completed INTEGER DEFAULT 0,
  is_fee_active BOOLEAN DEFAULT false, -- true after 4th order
  fee_paid_until TIMESTAMPTZ,
  account_paused_for_fee BOOLEAN DEFAULT false,
  appeal_status TEXT CHECK (appeal_status IN ('none', 'pending', 'resolved')),
  appeal_text TEXT,
  appeal_submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- CUSTOMER PROFILES
-- ============================================================
CREATE TABLE customer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  dietary_preferences TEXT[] DEFAULT '{}',
  allergy_notes TEXT,
  false_dispute_count INTEGER DEFAULT 0,
  chargeback_ban BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  name_ar TEXT,
  name_es TEXT,
  icon TEXT,
  slug TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO categories (name, name_ar, name_es, icon, slug, sort_order) VALUES
  ('Home-cooked meals', 'وجبات منزلية', 'Comida casera', '🍽️', 'food-cooking', 1),
  ('Baked goods & pastries', 'مخبوزات وحلويات', 'Repostería y pasteles', '🧁', 'baked-goods', 2),
  ('Beauty & nail care', 'جمال وعناية بالأظافر', 'Belleza y cuidado de uñas', '💅', 'beauty-hair', 3),
  ('Henna & body art', 'حناء وفن الجسد', 'Henna y arte corporal', '🌿', 'henna-art', 4),
  ('Other', 'أخرى', 'Otros', '✨', 'other', 5);

-- ============================================================
-- LISTINGS
-- ============================================================
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id UUID NOT NULL REFERENCES host_profiles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  price_unit TEXT DEFAULT 'item' CHECK (price_unit IN ('item', 'hour', 'session', 'dozen', 'pound')),
  prep_time_minutes INTEGER,
  photos TEXT[] DEFAULT '{}',
  delivery_options TEXT[] DEFAULT '{}' CHECK (delivery_options <@ ARRAY['pickup', 'self_delivery', 'third_party']),
  self_delivery_radius_miles DECIMAL(5,2),
  self_delivery_fee DECIMAL(10,2),
  max_quantity INTEGER,
  is_available BOOLEAN DEFAULT true,
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  special_instructions_allowed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customer_profiles(id),
  host_id UUID NOT NULL REFERENCES host_profiles(id),
  listing_id UUID NOT NULL REFERENCES listings(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('pickup', 'self_delivery', 'third_party')),
  delivery_address JSONB,
  special_requests TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'accepted', 'declined', 'preparing', 'ready',
    'picked_up', 'delivered', 'completed', 'cancelled', 'disputed', 'refunded'
  )),
  stripe_payment_intent_id TEXT,
  stripe_transfer_id TEXT,
  refund_amount DECIMAL(10,2),
  refund_reason TEXT,
  host_started_at TIMESTAMPTZ,
  customer_cancelled_at TIMESTAMPTZ,
  host_cancelled_at TIMESTAMPTZ,
  host_cancel_reason TEXT,
  completed_at TIMESTAMPTZ,
  doordash_delivery_id TEXT,
  uber_delivery_id TEXT,
  delivery_provider TEXT CHECK (delivery_provider IN ('doordash', 'uber', 'host', 'customer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Generate order number trigger
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'LK-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id),
  reviewer_id UUID NOT NULL REFERENCES users(id),
  reviewee_id UUID NOT NULL REFERENCES users(id),
  reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('customer', 'host')),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_negative BOOLEAN GENERATED ALWAYS AS (rating <= 2) STORED,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Update host star rating on new review
CREATE OR REPLACE FUNCTION update_host_star_rating()
RETURNS TRIGGER AS $$
DECLARE
  host_profile_id UUID;
  current_rating DECIMAL(3,2);
  neg_count INTEGER;
BEGIN
  -- Only process reviews where the reviewee is a host
  SELECT hp.id, hp.star_rating, hp.negative_review_count
    INTO host_profile_id, current_rating, neg_count
    FROM host_profiles hp
    WHERE hp.user_id = NEW.reviewee_id;

  IF host_profile_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.is_negative THEN
    -- Deduct 0.25 per negative review, floor at 1.0
    UPDATE host_profiles
      SET star_rating = GREATEST(1.0, star_rating - 0.25),
          negative_review_count = negative_review_count + 1,
          total_reviews = total_reviews + 1,
          review_status = CASE
            WHEN negative_review_count + 1 >= 10 THEN 'under_review'
            ELSE review_status
          END,
          updated_at = now()
      WHERE id = host_profile_id;
  ELSE
    UPDATE host_profiles
      SET total_reviews = total_reviews + 1,
          updated_at = now()
      WHERE id = host_profile_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_review_insert
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_host_star_rating();

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id),
  participant_1 UUID NOT NULL REFERENCES users(id),
  participant_2 UUID NOT NULL REFERENCES users(id),
  last_message_at TIMESTAMPTZ,
  is_blocked BOOLEAN DEFAULT false,
  blocked_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  sender_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  is_flagged BOOLEAN DEFAULT false, -- contains phone/email/payment info
  flag_reason TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- DISPUTES
-- ============================================================
CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id),
  filed_by UUID NOT NULL REFERENCES users(id),
  against_id UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  evidence_urls TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'auto_refunded')),
  admin_notes TEXT,
  resolved_by UUID REFERENCES users(id),
  resolution TEXT CHECK (resolution IN ('refund_full', 'refund_partial', 'no_refund', 'other')),
  deadline_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  is_false_dispute BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- SAVED HOSTS (customer favorites)
-- ============================================================
CREATE TABLE saved_hosts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customer_profiles(id),
  host_id UUID NOT NULL REFERENCES host_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, host_id)
);

-- ============================================================
-- BLOCKS & REPORTS
-- ============================================================
CREATE TABLE blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id UUID NOT NULL REFERENCES users(id),
  blocked_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES users(id),
  reported_id UUID NOT NULL REFERENCES users(id),
  listing_id UUID REFERENCES listings(id),
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  sent_sms BOOLEAN DEFAULT false,
  sent_push BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PUSH TOKENS
-- ============================================================
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  token TEXT NOT NULL,
  device TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);

-- ============================================================
-- HOST FEE SUBSCRIPTIONS
-- ============================================================
CREATE TABLE host_fee_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id UUID NOT NULL REFERENCES host_profiles(id),
  stripe_payment_intent_id TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 29.99,
  status TEXT DEFAULT 'paid' CHECK (status IN ('paid', 'failed')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ACTIVITY LOG
-- ============================================================
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PLATFORM SETTINGS
-- ============================================================
CREATE TABLE platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO platform_settings (key, value) VALUES
  ('host_fee_amount', '29.99'),
  ('host_free_orders', '4'),
  ('fee_period_months', '6'),
  ('dispute_auto_refund_hours', '48'),
  ('dispute_filing_window_hours', '72'),
  ('false_dispute_limit', '3'),
  ('negative_review_limit', '10'),
  ('review_star_deduction', '0.25'),
  ('cancel_penalty_window_minutes', '15');

-- ============================================================
-- PASSWORD RESET TOKENS
-- ============================================================
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('email', 'sms')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_host_profiles_user_id ON host_profiles(user_id);
CREATE INDEX idx_host_profiles_is_online ON host_profiles(is_online);
CREATE INDEX idx_host_profiles_star_rating ON host_profiles(star_rating DESC);
CREATE INDEX idx_host_profiles_review_status ON host_profiles(review_status);
CREATE INDEX idx_listings_host_id ON listings(host_id);
CREATE INDEX idx_listings_category_id ON listings(category_id);
CREATE INDEX idx_listings_approval_status ON listings(approval_status);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_host_id ON orders(host_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_activity_log_actor_id ON activity_log(actor_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE host_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own record
CREATE POLICY "users_read_own" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth.uid() = id);

-- Host profiles: owner can update, public can read approved profiles
CREATE POLICY "host_profiles_read_public" ON host_profiles FOR SELECT USING (true);
CREATE POLICY "host_profiles_update_own" ON host_profiles FOR UPDATE USING (
  auth.uid() = user_id
);

-- Listings: public reads approved, host manages own
CREATE POLICY "listings_read_approved" ON listings FOR SELECT USING (
  approval_status = 'approved' OR
  host_id = (SELECT id FROM host_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "listings_manage_own" ON listings FOR ALL USING (
  host_id = (SELECT id FROM host_profiles WHERE user_id = auth.uid())
);

-- Orders: participant access only
CREATE POLICY "orders_participant_access" ON orders FOR SELECT USING (
  customer_id = (SELECT id FROM customer_profiles WHERE user_id = auth.uid()) OR
  host_id = (SELECT id FROM host_profiles WHERE user_id = auth.uid())
);

-- Notifications: own only
CREATE POLICY "notifications_own" ON notifications FOR ALL USING (user_id = auth.uid());
