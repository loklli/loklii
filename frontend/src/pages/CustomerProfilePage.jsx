import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { LogOut, Settings } from 'lucide-react';
import api from '../services/api';
import OrderStatusBadge from '../components/common/OrderStatusBadge';
import toast from 'react-hot-toast';

const DIETARY_OPTIONS = ['Halal', 'Kosher', 'Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Keto'];

export default function CustomerProfilePage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [savedHosts, setSavedHosts] = useState([]);
  const [activeTab, setActiveTab] = useState('orders');
  const [editingPrefs, setEditingPrefs] = useState(false);
  const [dietPrefs, setDietPrefs] = useState([]);
  const [allergyNotes, setAllergyNotes] = useState('');

  useEffect(() => {
    api.get('/customer/profile').then((r) => {
      setProfile(r.data);
      setDietPrefs(r.data.dietary_preferences || []);
      setAllergyNotes(r.data.allergy_notes || '');
    }).catch(() => {});
    api.get('/customer/orders').then((r) => setOrders(r.data)).catch(() => {});
    api.get('/customer/saved-hosts').then((r) => setSavedHosts(r.data)).catch(() => {});
  }, []);

  const savePrefs = async () => {
    await api.put('/customer/profile', { dietaryPreferences: dietPrefs, allergyNotes });
    setEditingPrefs(false);
    toast.success('Preferences saved!');
  };

  const unsaveHost = async (hostId) => {
    await api.delete(`/customer/saved-hosts/${hostId}`);
    setSavedHosts((prev) => prev.filter((h) => h.host_id !== hostId));
  };

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-4 py-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-teal rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {user?.firstName?.[0]}
            </div>
            <div>
              <p className="font-bold text-lg">{user?.firstName} {user?.lastName}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 text-gray-400">
            <LogOut size={20} />
          </button>
        </div>

        {/* Verify CTA */}
        {!profile?.users?.is_verified && (
          <button onClick={() => navigate('/verify-identity')} className="mt-4 w-full bg-cream border border-amber text-amber text-sm font-medium py-2 rounded-xl">
            🪪 Get Identity Verified
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-200">
        {['orders', 'saved', 'preferences'].map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-3 text-sm font-medium capitalize ${activeTab === t ? 'text-amber border-b-2 border-amber' : 'text-gray-500'}`}
          >
            {t === 'orders' ? 'Orders' : t === 'saved' ? 'Saved' : 'Preferences'}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">
        {/* Orders */}
        {activeTab === 'orders' && (
          <div className="flex flex-col gap-3">
            {orders.length === 0 && (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">📦</p>
                <p className="text-gray-500">No orders yet.</p>
                <button onClick={() => navigate('/browse')} className="mt-4 btn-secondary text-sm py-2 px-6">Browse Services</button>
              </div>
            )}
            {orders.map((order) => (
              <div
                key={order.id}
                onClick={() => navigate(`/orders/${order.id}`)}
                className="card p-4 cursor-pointer flex items-center gap-3"
              >
                {order.listings?.photos?.[0] ? (
                  <img src={order.listings.photos[0]} alt="" className="w-14 h-14 object-cover rounded-xl" />
                ) : (
                  <div className="w-14 h-14 bg-gray-200 rounded-xl flex items-center justify-center text-2xl">🏠</div>
                )}
                <div className="flex-1">
                  <p className="font-semibold text-sm">{order.listings?.title}</p>
                  <p className="text-xs text-gray-500">#{order.order_number}</p>
                  <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <OrderStatusBadge status={order.status} />
                  <p className="text-sm font-bold mt-1">${order.total_amount}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Saved Hosts */}
        {activeTab === 'saved' && (
          <div className="flex flex-col gap-3">
            {savedHosts.length === 0 && <p className="text-center text-gray-400 py-8">No saved hosts yet.</p>}
            {savedHosts.map((item) => (
              <div key={item.id} className="card p-4 flex items-center gap-3">
                <div className="w-12 h-12 bg-amber rounded-full flex items-center justify-center text-white font-bold">
                  {item.host_profiles?.users?.first_name?.[0]}
                </div>
                <div className="flex-1" onClick={() => navigate(`/host/${item.host_id}`)}>
                  <p className="font-semibold text-sm">{item.host_profiles?.users?.first_name} {item.host_profiles?.users?.last_name}</p>
                  <p className="text-xs text-gray-500">{item.host_profiles?.city}, {item.host_profiles?.state}</p>
                  <p className="text-xs text-amber">★ {item.host_profiles?.star_rating?.toFixed(1)}</p>
                </div>
                <button onClick={() => unsaveHost(item.host_id)} className="text-gray-400 text-xs">Remove</button>
              </div>
            ))}
          </div>
        )}

        {/* Preferences */}
        {activeTab === 'preferences' && (
          <div className="flex flex-col gap-4">
            <h2 className="font-bold">Dietary Preferences</h2>
            <div className="flex flex-wrap gap-2">
              {DIETARY_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setDietPrefs((prev) => prev.includes(opt) ? prev.filter((d) => d !== opt) : [...prev, opt])}
                  className={`px-3 py-1.5 rounded-full text-sm border ${dietPrefs.includes(opt) ? 'bg-teal text-white border-teal' : 'bg-white text-gray-700 border-gray-200'}`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Allergy Notes</label>
              <textarea
                className="input-field h-20"
                value={allergyNotes}
                onChange={(e) => setAllergyNotes(e.target.value)}
                placeholder="e.g. severe peanut allergy..."
              />
            </div>
            <button onClick={savePrefs} className="btn-secondary w-full">{t('common.save')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
