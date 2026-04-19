const supabase = require('../config/supabase');
const { log } = require('../utils/activityLog');

const BLOCKED_KEYWORDS = ['medical', 'legal', 'firearm', 'gun', 'drug', 'adult', 'escort', 'auto repair'];

function containsBlockedContent(text) {
  const lower = text.toLowerCase();
  return BLOCKED_KEYWORDS.some((kw) => lower.includes(kw));
}

// ── CREATE LISTING ───────────────────────────────────────────
exports.createListing = async (req, res) => {
  try {
    const { title, description, categoryId, price, priceUnit, prepTimeMinutes,
      deliveryOptions, selfDeliveryRadius, selfDeliveryFee, maxQuantity, specialInstructionsAllowed } = req.body;

    if (containsBlockedContent(title) || containsBlockedContent(description)) {
      return res.status(400).json({ error: 'Listing contains prohibited content. Review our policies.' });
    }

    const { data: hostProfile } = await supabase
      .from('host_profiles').select('id').eq('user_id', req.user.userId).single();

    const { data: listing, error } = await supabase
      .from('listings')
      .insert({
        host_id: hostProfile.id,
        category_id: categoryId,
        title,
        description,
        price,
        price_unit: priceUnit,
        prep_time_minutes: prepTimeMinutes,
        delivery_options: deliveryOptions,
        self_delivery_radius_miles: selfDeliveryRadius,
        self_delivery_fee: selfDeliveryFee,
        max_quantity: maxQuantity,
        special_instructions_allowed: specialInstructionsAllowed,
        approval_status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    await log(req.user.userId, 'listing_created', 'listing', listing.id);
    return res.status(201).json(listing);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create listing.' });
  }
};

// ── GET MY LISTINGS ──────────────────────────────────────────
exports.getMyListings = async (req, res) => {
  try {
    const { data: hostProfile } = await supabase
      .from('host_profiles').select('id').eq('user_id', req.user.userId).single();

    const { data, error } = await supabase
      .from('listings')
      .select('*, categories(name, icon, slug)')
      .eq('host_id', hostProfile.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get listings.' });
  }
};

// ── UPDATE LISTING ───────────────────────────────────────────
exports.updateListing = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, priceUnit, prepTimeMinutes,
      deliveryOptions, selfDeliveryRadius, selfDeliveryFee, maxQuantity, isAvailable } = req.body;

    if (title && containsBlockedContent(title)) {
      return res.status(400).json({ error: 'Listing contains prohibited content.' });
    }

    const { data: hostProfile } = await supabase
      .from('host_profiles').select('id').eq('user_id', req.user.userId).single();

    const { data, error } = await supabase
      .from('listings')
      .update({
        title, description, price, price_unit: priceUnit, prep_time_minutes: prepTimeMinutes,
        delivery_options: deliveryOptions, self_delivery_radius_miles: selfDeliveryRadius,
        self_delivery_fee: selfDeliveryFee, max_quantity: maxQuantity, is_available: isAvailable,
        approval_status: 'pending', // Re-submit for approval on update
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('host_id', hostProfile.id)
      .select()
      .single();

    if (error) throw error;
    await log(req.user.userId, 'listing_updated', 'listing', id);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update listing.' });
  }
};

// ── DELETE LISTING ───────────────────────────────────────────
exports.deleteListing = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: hostProfile } = await supabase
      .from('host_profiles').select('id').eq('user_id', req.user.userId).single();

    const { error } = await supabase.from('listings').delete().eq('id', id).eq('host_id', hostProfile.id);
    if (error) throw error;
    await log(req.user.userId, 'listing_deleted', 'listing', id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete listing.' });
  }
};

// ── ADD PHOTO TO LISTING ─────────────────────────────────────
exports.addListingPhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const { photoUrl } = req.body;
    const { data: listing } = await supabase.from('listings').select('photos').eq('id', id).single();
    const updated = [...(listing.photos || []), photoUrl];
    await supabase.from('listings').update({ photos: updated }).eq('id', id);
    return res.json({ photos: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to add photo.' });
  }
};

// ── PUBLIC BROWSE LISTINGS ───────────────────────────────────
exports.browse = async (req, res) => {
  try {
    const { category, zipCode, city, state, deliveryType, minRating, verifiedOnly, lat, lng, limit = 20, offset = 0 } = req.query;

    let query = supabase
      .from('listings')
      .select(`
        id, title, description, price, price_unit, photos, delivery_options, prep_time_minutes,
        host_profiles!inner(
          id, city, state, star_rating, is_online, review_status, stripe_connect_status,
          users(first_name, last_name, avatar_url)
        ),
        categories(name, icon, slug)
      `)
      .eq('approval_status', 'approved')
      .eq('is_available', true)
      .neq('host_profiles.review_status', 'under_review')
      .neq('host_profiles.review_status', 'suspended')
      .order('host_profiles.is_online', { ascending: false })
      .order('host_profiles.star_rating', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (category) query = query.eq('categories.slug', category);
    if (deliveryType) query = query.contains('delivery_options', [deliveryType]);
    if (minRating) query = query.gte('host_profiles.star_rating', parseFloat(minRating));
    if (verifiedOnly === 'true') query = query.eq('host_profiles.stripe_connect_status', 'active');
    if (city) query = query.ilike('host_profiles.city', `%${city}%`);
    if (state) query = query.ilike('host_profiles.state', `%${state}%`);

    const { data, error, count } = await query;
    if (error) throw error;
    return res.json({ listings: data, total: count });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to browse listings.' });
  }
};

// ── GET SINGLE LISTING ───────────────────────────────────────
exports.getListing = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('listings')
      .select(`
        *, categories(name, icon),
        host_profiles(
          id, bio, city, state, star_rating, is_online, workspace_photos,
          users(first_name, last_name, avatar_url)
        )
      `)
      .eq('id', id)
      .eq('approval_status', 'approved')
      .single();

    if (error || !data) return res.status(404).json({ error: 'Listing not found.' });

    // Get reviews for this listing
    const { data: reviews } = await supabase
      .from('reviews')
      .select('rating, comment, created_at, users!reviewer_id(first_name, last_name, avatar_url)')
      .eq('reviewee_id', data.host_profiles.id)
      .order('created_at', { ascending: false })
      .limit(10);

    return res.json({ ...data, reviews });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to get listing.' });
  }
};
