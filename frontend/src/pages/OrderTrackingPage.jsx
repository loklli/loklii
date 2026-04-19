import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Phone, Star, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import OrderStatusBadge from '../components/common/OrderStatusBadge';

const STEPS = ['pending', 'accepted', 'preparing', 'ready', 'completed'];
const STEP_LABELS = {
  pending: 'Order Placed',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
};

export default function OrderTrackingPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, [id]);

  const fetchOrder = async () => {
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data);
    } catch {
      toast.error('Order not found.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel this order?')) return;
    try {
      const { data } = await api.post(`/orders/${id}/cancel`);
      toast.success(`Order cancelled. Refund: $${data.refundAmount?.toFixed(2) || 0}`);
      fetchOrder();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel.');
    }
  };

  const handleHostAction = async (status, cancelReason) => {
    try {
      await api.patch(`/orders/${id}/status`, { status, cancelReason });
      toast.success(`Order ${status}`);
      fetchOrder();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update order.');
    }
  };

  const handleReview = async () => {
    try {
      await api.post('/orders/review', { orderId: id, rating, comment });
      toast.success('Review submitted!');
      setShowReview(false);
    } catch {
      toast.error('Failed to submit review.');
    }
  };

  const handleDispute = async () => {
    try {
      await api.post('/orders/dispute', { orderId: id, reason: disputeReason });
      toast.success('Dispute filed. Admin will respond within 48 hours.');
      setShowDispute(false);
      fetchOrder();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to file dispute.');
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin w-8 h-8 border-4 border-amber border-t-transparent rounded-full" /></div>;
  if (!order) return null;

  const isHost = user?.role === 'host';
  const currentStepIdx = STEPS.indexOf(order.status);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white px-4 py-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => navigate(-1)}><ChevronLeft size={24} /></button>
        <h1 className="font-bold text-lg">Order #{order.order_number}</h1>
        <div className="ml-auto"><OrderStatusBadge status={order.status} /></div>
      </div>

      {/* Progress Tracker */}
      {!['cancelled', 'disputed', 'refunded'].includes(order.status) && (
        <div className="bg-white px-4 py-6 mb-3">
          <div className="flex items-center">
            {STEPS.map((step, i) => (
              <div key={step} className="flex items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  i <= currentStepIdx ? 'bg-amber text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  {i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-1 mx-1 ${i < currentStepIdx ? 'bg-amber' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            {STEPS.map((step) => (
              <span key={step} className="text-[10px] text-gray-500 text-center flex-1">{STEP_LABELS[step]}</span>
            ))}
          </div>
        </div>
      )}

      {/* Order Details */}
      <div className="mx-4 card p-4 mb-3">
        <div className="flex gap-3">
          {order.listings?.photos?.[0] && (
            <img src={order.listings.photos[0]} alt="" className="w-16 h-16 object-cover rounded-xl" />
          )}
          <div className="flex-1">
            <p className="font-bold text-sm">{order.listings?.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {isHost ? `Customer: ${order.customer_profiles?.users?.first_name}` : `Host: ${order.host_profiles?.users?.first_name}`}
            </p>
            <p className="text-xs text-gray-500">Qty: {order.quantity} · {order.delivery_type}</p>
          </div>
          <p className="font-bold text-amber">${order.total_amount}</p>
        </div>
        {order.special_requests && (
          <div className="mt-3 p-2 bg-cream rounded-xl">
            <p className="text-xs text-gray-600">Notes: {order.special_requests}</p>
          </div>
        )}
      </div>

      {/* Host Actions */}
      {isHost && (
        <div className="mx-4 mb-3">
          <h2 className="font-bold mb-2 text-sm">Update Order Status</h2>
          <div className="flex flex-wrap gap-2">
            {order.status === 'pending' && (
              <>
                <button onClick={() => handleHostAction('accepted')} className="btn-primary text-sm py-2 px-4">Accept</button>
                <button onClick={() => handleHostAction('declined')} className="border border-red-300 text-red-600 text-sm py-2 px-4 rounded-xl">Decline</button>
              </>
            )}
            {order.status === 'accepted' && (
              <button onClick={() => handleHostAction('preparing')} className="btn-primary text-sm py-2 px-4">Start Preparing</button>
            )}
            {order.status === 'preparing' && (
              <button onClick={() => handleHostAction('ready')} className="btn-primary text-sm py-2 px-4">Mark Ready</button>
            )}
            {['ready', 'picked_up'].includes(order.status) && (
              <button onClick={() => handleHostAction('completed')} className="btn-primary text-sm py-2 px-4">Mark Completed</button>
            )}
            {['pending', 'accepted'].includes(order.status) && (
              <button onClick={() => { const r = prompt('Why are you cancelling?'); if (r) handleHostAction('cancelled', r); }} className="border border-red-300 text-red-600 text-sm py-2 px-4 rounded-xl">Cancel Order</button>
            )}
          </div>
        </div>
      )}

      {/* Customer Actions */}
      {!isHost && (
        <div className="mx-4 flex flex-col gap-3 mb-3">
          {['pending', 'accepted'].includes(order.status) && (
            <button onClick={handleCancel} className="border border-red-300 text-red-600 py-3 rounded-xl text-sm font-medium w-full">
              {t('orders.cancel_order')}
            </button>
          )}
          {order.status === 'completed' && (
            <>
              <button onClick={() => setShowReview(true)} className="btn-secondary w-full text-sm py-3">
                <Star size={16} className="inline mr-2" />{t('orders.leave_review')}
              </button>
              <button onClick={() => setShowDispute(true)} className="border border-orange-300 text-orange-600 py-3 rounded-xl text-sm font-medium w-full">
                <AlertTriangle size={16} className="inline mr-2" />{t('orders.file_dispute')}
              </button>
            </>
          )}
          <button
            onClick={async () => {
              try {
                const { data } = await api.post('/chat/conversations', { recipientId: order.host_profiles?.users?.id, orderId: id });
                navigate(`/chat/${data.conversationId}`);
              } catch { navigate('/chat'); }
            }}
            className="border border-gray-200 text-gray-700 py-3 rounded-xl text-sm font-medium w-full"
          >
            <Phone size={16} className="inline mr-2" />Contact Host
          </button>
        </div>
      )}

      {/* Dispute note */}
      <p className="px-4 text-xs text-gray-400 text-center">{t('orders.dispute_window')}</p>

      {/* Review Modal */}
      {showReview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6">
            <h2 className="text-xl font-bold mb-4">{t('orders.leave_review')}</h2>
            <div className="flex gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} onClick={() => setRating(i)}>
                  <Star size={32} className={i <= rating ? 'text-amber fill-amber' : 'text-gray-300'} />
                </button>
              ))}
            </div>
            <textarea className="input-field h-24 mb-4" placeholder="Share your experience..." value={comment} onChange={(e) => setComment(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={() => setShowReview(false)} className="flex-1 border border-gray-200 py-3 rounded-xl">{t('common.cancel')}</button>
              <button onClick={handleReview} disabled={rating === 0} className="flex-1 btn-primary">{t('common.submit')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Modal */}
      {showDispute && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6">
            <h2 className="text-xl font-bold mb-2">{t('orders.file_dispute')}</h2>
            <p className="text-sm text-gray-500 mb-4">{t('orders.dispute_window')}</p>
            <textarea className="input-field h-28 mb-4" placeholder="Describe the issue..." value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={() => setShowDispute(false)} className="flex-1 border border-gray-200 py-3 rounded-xl">{t('common.cancel')}</button>
              <button onClick={handleDispute} disabled={!disputeReason} className="flex-1 btn-primary">{t('common.submit')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
