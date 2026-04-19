import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, MessageCircle, ShoppingBag, MapPin, Clock, Star, Flag } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import api from '../services/api';
import StarRating from '../components/common/StarRating';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

function CheckoutForm({ order, clientSecret, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handlePay = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/orders/${order.id}` },
    });
    if (error) toast.error(error.message);
    setLoading(false);
  };

  return (
    <form onSubmit={handlePay} className="flex flex-col gap-4">
      <PaymentElement />
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Processing...' : `Pay $${order.total_amount}`}
      </button>
    </form>
  );
}

export default function ListingDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [deliveryType, setDeliveryType] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [showBooking, setShowBooking] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [clientSecret, setClientSecret] = useState('');
  const [photoIdx, setPhotoIdx] = useState(0);

  useEffect(() => {
    api.get(`/listings/${id}`).then(({ data }) => {
      setListing(data);
      if (data.delivery_options?.[0]) setDeliveryType(data.delivery_options[0]);
    }).catch(() => toast.error('Listing not found.')).finally(() => setLoading(false));
  }, [id]);

  const handleBook = async () => {
    if (!user) return navigate('/login');
    try {
      const { data } = await api.post('/orders', {
        listingId: id, quantity: qty, deliveryType,
        deliveryAddress: deliveryType !== 'pickup' ? { street: deliveryAddress } : null,
        specialRequests,
      });
      setOrderData(data.order);
      setClientSecret(data.clientSecret);
      setShowBooking(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create order.');
    }
  };

  const handleMessage = async () => {
    if (!user) return navigate('/login');
    try {
      const { data } = await api.post('/chat/conversations', { recipientId: listing.host_profiles?.users?.id });
      navigate(`/chat/${data.conversationId}`);
    } catch {
      navigate('/chat');
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin w-8 h-8 border-4 border-amber border-t-transparent rounded-full" /></div>;
  if (!listing) return null;

  const deliveryFee = deliveryType === 'self_delivery' ? (listing.host_profiles?.self_delivery_fee || 0) : 0;
  const total = listing.price * qty + deliveryFee;

  return (
    <div className="min-h-screen bg-white pb-32">
      {/* Photo Gallery */}
      <div className="relative h-64 bg-gray-200 overflow-hidden">
        {listing.photos?.length > 0 ? (
          <img src={listing.photos[photoIdx]} alt={listing.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl text-gray-300">🏠</div>
        )}
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 bg-white/90 p-2 rounded-full">
          <ChevronLeft size={20} />
        </button>
        {listing.photos?.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
            {listing.photos.map((_, i) => (
              <button key={i} onClick={() => setPhotoIdx(i)} className={`w-2 h-2 rounded-full ${i === photoIdx ? 'bg-white' : 'bg-white/50'}`} />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-4">
        {/* Title & Price */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{listing.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <MapPin size={13} className="text-gray-400" />
              <span className="text-sm text-gray-500">{listing.host_profiles?.city}, {listing.host_profiles?.state}</span>
            </div>
          </div>
          <span className="text-2xl font-bold text-amber">${listing.price}</span>
        </div>

        {/* Host Info */}
        <div className="flex items-center gap-3 mt-4 p-3 bg-cream rounded-xl">
          <div className="w-12 h-12 bg-amber rounded-full flex items-center justify-center text-white font-bold text-lg">
            {listing.host_profiles?.users?.first_name?.[0]}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">{listing.host_profiles?.users?.first_name} {listing.host_profiles?.users?.last_name}</p>
            <StarRating rating={listing.host_profiles?.star_rating} size={13} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleMessage} className="p-2 border border-gray-200 rounded-xl">
              <MessageCircle size={18} className="text-gray-600" />
            </button>
            <button onClick={() => navigate(`/host/${listing.host_profiles?.id}`)} className="text-xs text-amber underline px-2">{t('common.view_profile')}</button>
          </div>
        </div>

        {/* Description */}
        <div className="mt-4">
          <p className="text-gray-700 text-sm leading-relaxed">{listing.description}</p>
        </div>

        {/* Details */}
        <div className="flex gap-4 mt-4">
          {listing.prep_time_minutes && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock size={13} /> Prep: {listing.prep_time_minutes} min
            </div>
          )}
          {listing.price_unit && (
            <div className="text-xs text-gray-500">Per {listing.price_unit}</div>
          )}
        </div>

        {/* Delivery Options */}
        <div className="mt-4">
          <p className="font-semibold text-sm mb-2">Delivery Options</p>
          <div className="flex gap-2">
            {listing.delivery_options?.map((opt) => (
              <button
                key={opt}
                onClick={() => setDeliveryType(opt)}
                className={`px-3 py-2 rounded-xl text-xs font-medium border ${deliveryType === opt ? 'bg-amber text-white border-amber' : 'bg-white text-gray-700 border-gray-200'}`}
              >
                {opt === 'pickup' ? t('listings.delivery_pickup') : opt === 'self_delivery' ? t('listings.delivery_self') : t('listings.delivery_3p')}
              </button>
            ))}
          </div>
        </div>

        {/* Delivery Address */}
        {deliveryType !== 'pickup' && (
          <div className="mt-3">
            <input
              className="input-field"
              placeholder="Delivery address..."
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
            />
          </div>
        )}

        {/* Special Requests */}
        {listing.special_instructions_allowed && (
          <div className="mt-4">
            <p className="font-semibold text-sm mb-2">{t('listings.special_requests')}</p>
            <textarea className="input-field h-20 text-sm" value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} placeholder="Any special requests or instructions..." />
          </div>
        )}

        {/* Quantity */}
        <div className="flex items-center gap-4 mt-4">
          <p className="font-semibold text-sm">{t('listings.qty')}</p>
          <div className="flex items-center gap-3">
            <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-8 h-8 border border-gray-300 rounded-full flex items-center justify-center text-lg">-</button>
            <span className="font-bold text-lg w-6 text-center">{qty}</span>
            <button onClick={() => setQty(Math.min(listing.max_quantity || 99, qty + 1))} className="w-8 h-8 border border-gray-300 rounded-full flex items-center justify-center text-lg">+</button>
          </div>
        </div>

        {/* Reviews */}
        <div className="mt-6">
          <h2 className="font-bold text-base mb-3">{t('listings.reviews')}</h2>
          {listing.reviews?.length === 0 ? (
            <p className="text-sm text-gray-400">{t('listings.no_reviews')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {listing.reviews?.map((review) => (
                <div key={review.id} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{review.users?.first_name}</p>
                    <StarRating rating={review.rating} size={12} />
                  </div>
                  {review.comment && <p className="text-xs text-gray-600 mt-1">{review.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Book Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 safe-bottom">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-600">Total</span>
          <span className="text-xl font-bold text-amber">${total.toFixed(2)}</span>
        </div>
        <button onClick={handleBook} className="btn-primary w-full flex items-center justify-center gap-2">
          <ShoppingBag size={18} /> {t('listings.book_now')}
        </button>
      </div>

      {/* Booking / Payment Modal */}
      {showBooking && clientSecret && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Complete Payment</h2>
            <div className="mb-4 p-3 bg-cream rounded-xl text-sm">
              <p className="font-medium">{listing.title} × {qty}</p>
              <p className="text-gray-600 mt-1">Total: <strong>${orderData?.total_amount}</strong></p>
            </div>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm order={orderData} clientSecret={clientSecret} onSuccess={() => navigate(`/orders/${orderData.id}`)} />
            </Elements>
            <button onClick={() => setShowBooking(false)} className="w-full mt-3 text-sm text-gray-500 underline">{t('common.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
