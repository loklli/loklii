import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Power, Star, ShoppingBag, AlertTriangle, CheckCircle, Plus, Wallet } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import OrderStatusBadge from '../../components/common/OrderStatusBadge';

const CHECKLIST_ITEMS = [
  'Surfaces cleaned and sanitized',
  'Handwashing station available',
  'Cooking area clean and organized',
  'Pets away from workspace (if applicable)',
  'Proper food storage in place',
];

export default function HostDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklistItems, setChecklistItems] = useState(CHECKLIST_ITEMS.map(() => false));

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const { data } = await api.get('/host/dashboard');
      setStats(data);
    } catch {
      toast.error('Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleOnline = async () => {
    if (!stats?.isOnline && !stats?.workspaceChecklistCompleted) {
      setShowChecklist(true);
      return;
    }
    setToggling(true);
    try {
      const { data } = await api.post('/host/online');
      setStats((s) => ({ ...s, isOnline: data.isOnline }));
      toast.success(data.isOnline ? 'You are now online!' : 'You are now offline.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to toggle status.');
    } finally {
      setToggling(false);
    }
  };

  const handleCompleteChecklist = async () => {
    if (!checklistItems.every(Boolean)) {
      return toast.error('Please complete all checklist items.');
    }
    try {
      await api.post('/host/checklist');
      toast.success('Checklist complete!');
      setShowChecklist(false);
      handleToggleOnline();
    } catch {
      toast.error('Failed to complete checklist.');
    }
  };

  const handlePayFee = async () => {
    try {
      const { data } = await api.post('/stripe/fee/session');
      window.location.href = data.url;
    } catch {
      toast.error('Failed to open payment.');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><div className="animate-spin w-8 h-8 border-4 border-amber border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Fee Banner */}
      {stats?.accountPausedForFee && (
        <div className="bg-red-500 text-white px-4 py-3 text-sm text-center">
          <p>{t('host.fee_banner')}</p>
          <button onClick={handlePayFee} className="mt-2 bg-white text-red-600 font-bold px-4 py-1 rounded-full text-xs">
            {t('host.pay_fee')}
          </button>
        </div>
      )}

      {/* Under Review Banner */}
      {stats?.reviewStatus === 'under_review' && (
        <div className="bg-orange-400 text-white px-4 py-3 text-sm text-center">
          <p>{t('host.under_review')}</p>
          <button onClick={() => navigate('/host/appeal')} className="mt-1 underline text-xs">{t('host.appeal_submit')}</button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white px-4 py-6 border-b border-gray-100">
        <h1 className="text-xl font-bold">{t('nav.dashboard')}</h1>
        <p className="text-sm text-gray-500 mt-0.5">Welcome back! Manage your services.</p>
      </div>

      {/* Online Toggle */}
      <div className="px-4 py-4">
        <button
          onClick={handleToggleOnline}
          disabled={toggling || stats?.accountPausedForFee || stats?.reviewStatus === 'under_review'}
          className={`w-full flex items-center justify-between p-4 rounded-2xl font-bold text-lg transition-all ${
            stats?.isOnline ? 'bg-teal text-white' : 'bg-gray-100 text-gray-700'
          } disabled:opacity-50`}
        >
          <span>{stats?.isOnline ? t('host.go_offline') : t('host.go_online')}</span>
          <Power size={24} />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="px-4 grid grid-cols-2 gap-3 mb-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Star size={18} className="text-amber" />
            <span className="text-xs text-gray-500">Star Rating</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.starRating?.toFixed(1)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag size={18} className="text-teal" />
            <span className="text-xs text-gray-500">Completed</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.totalOrdersCompleted}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={18} className="text-amber" />
            <span className="text-xs text-gray-500">Pending Orders</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.pendingOrders}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={18} className="text-green-500" />
            <span className="text-xs text-gray-500">Fee Valid Until</span>
          </div>
          <p className="text-sm font-bold text-gray-900">
            {stats?.feePaidUntil ? new Date(stats.feePaidUntil).toLocaleDateString() : 'Free period'}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 mb-4">
        <div className="flex gap-3">
          <button onClick={() => navigate('/host/listings/new')} className="flex-1 flex items-center justify-center gap-2 bg-amber text-white py-3 rounded-xl font-semibold text-sm">
            <Plus size={18} /> {t('host.add_listing')}
          </button>
          <button onClick={() => navigate('/host/listings')} className="flex-1 bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-semibold text-sm">
            My Listings
          </button>
        </div>
      </div>

      {/* Stripe Connect */}
      <div className="px-4 mb-4">
        <button onClick={() => navigate('/host/stripe')} className="w-full bg-white border border-gray-200 p-4 rounded-2xl flex items-center justify-between">
          <span className="font-semibold text-sm">Stripe Payout Setup</span>
          <span className="text-xs text-amber">Setup →</span>
        </button>
      </div>

      {/* Recent Orders */}
      {stats?.recentOrders?.length > 0 && (
        <div className="px-4">
          <h2 className="font-bold text-lg mb-3">Recent Orders</h2>
          <div className="flex flex-col gap-3">
            {stats.recentOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => navigate(`/orders/${order.id}`)}
                className="card p-4 flex items-center justify-between cursor-pointer"
              >
                <div>
                  <p className="font-semibold text-sm">{order.listings?.title}</p>
                  <p className="text-xs text-gray-500">#{order.order_number}</p>
                </div>
                <div className="text-right">
                  <OrderStatusBadge status={order.status} />
                  <p className="text-sm font-bold mt-1">${order.total_amount}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workspace Checklist Modal */}
      {showChecklist && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{t('host.checklist_title')}</h2>
            <p className="text-sm text-gray-600 mb-4">Complete all items before going online.</p>
            <div className="flex flex-col gap-3 mb-6">
              {CHECKLIST_ITEMS.map((item, i) => (
                <label key={i} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checklistItems[i]}
                    onChange={() => setChecklistItems((prev) => prev.map((v, j) => j === i ? !v : v))}
                    className="h-5 w-5 accent-amber"
                  />
                  <span className="text-sm">{item}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowChecklist(false)} className="flex-1 border border-gray-300 py-3 rounded-xl text-gray-700">Cancel</button>
              <button onClick={handleCompleteChecklist} className="flex-1 btn-primary">Go Online</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
