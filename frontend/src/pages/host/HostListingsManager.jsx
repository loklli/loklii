import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Edit2, Trash2, Clock } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const DELIVERY_OPTS = [
  { value: 'pickup', label: 'Pickup (free)' },
  { value: 'self_delivery', label: 'I deliver' },
  { value: 'third_party', label: '3rd party delivery' },
];

const PRICE_UNITS = ['item', 'hour', 'session', 'dozen', 'pound'];

export default function HostListingsManager() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    title: '', description: '', categoryId: '',
    price: '', priceUnit: 'item', prepTimeMinutes: '',
    deliveryOptions: ['pickup'], selfDeliveryRadius: '', selfDeliveryFee: '',
    maxQuantity: '', specialInstructionsAllowed: true,
  });

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const toggleDelivery = (val) => {
    set('deliveryOptions', form.deliveryOptions.includes(val)
      ? form.deliveryOptions.filter((d) => d !== val)
      : [...form.deliveryOptions, val]);
  };

  useEffect(() => {
    api.get('/host/listings').then((r) => setListings(r.data)).catch(() => {});
    api.get('/listings/categories').then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await api.put(`/host/listings/${editingId}`, form);
        toast.success('Listing updated! Pending re-approval.');
      } else {
        await api.post('/host/listings', form);
        toast.success('Listing submitted for admin approval!');
      }
      const { data } = await api.get('/host/listings');
      setListings(data);
      setShowForm(false);
      setEditingId(null);
      setForm({ title: '', description: '', categoryId: '', price: '', priceUnit: 'item', prepTimeMinutes: '', deliveryOptions: ['pickup'], selfDeliveryRadius: '', selfDeliveryFee: '', maxQuantity: '', specialInstructionsAllowed: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save listing.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this listing?')) return;
    await api.delete(`/host/listings/${id}`);
    setListings((prev) => prev.filter((l) => l.id !== id));
    toast.success('Listing deleted.');
  };

  const startEdit = (listing) => {
    setForm({
      title: listing.title, description: listing.description,
      categoryId: listing.category_id, price: listing.price,
      priceUnit: listing.price_unit, prepTimeMinutes: listing.prep_time_minutes || '',
      deliveryOptions: listing.delivery_options || ['pickup'],
      selfDeliveryRadius: listing.self_delivery_radius_miles || '',
      selfDeliveryFee: listing.self_delivery_fee || '',
      maxQuantity: listing.max_quantity || '',
      specialInstructionsAllowed: listing.special_instructions_allowed,
    });
    setEditingId(listing.id);
    setShowForm(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white px-4 py-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => navigate('/host/dashboard')}><ChevronLeft size={24} /></button>
        <h1 className="font-bold text-lg">My Listings</h1>
        <button onClick={() => { setShowForm(true); setEditingId(null); }} className="ml-auto bg-amber text-white p-2 rounded-xl">
          <Plus size={20} />
        </button>
      </div>

      {/* Listings */}
      <div className="px-4 py-4 flex flex-col gap-3">
        {listings.length === 0 && !showForm && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📝</p>
            <p className="text-gray-500 mb-4">No listings yet.</p>
            <button onClick={() => setShowForm(true)} className="btn-primary">Add Your First Service</button>
          </div>
        )}
        {listings.map((listing) => (
          <div key={listing.id} className="bg-white rounded-2xl p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-bold text-sm">{listing.title}</p>
                <p className="text-xs text-gray-500">{listing.categories?.name} · ${listing.price}/{listing.price_unit}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${
                  listing.approval_status === 'approved' ? 'bg-green-100 text-green-700' :
                  listing.approval_status === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {listing.approval_status === 'approved' ? '✓ Live' : listing.approval_status === 'rejected' ? '✗ Rejected' : '⏳ Pending'}
                </span>
              </div>
              <div className="flex gap-2 ml-2">
                <button onClick={() => startEdit(listing)} className="p-2 bg-gray-100 rounded-xl">
                  <Edit2 size={15} className="text-gray-600" />
                </button>
                <button onClick={() => handleDelete(listing.id)} className="p-2 bg-red-50 rounded-xl">
                  <Trash2 size={15} className="text-red-500" />
                </button>
              </div>
            </div>
            {listing.approval_status === 'rejected' && listing.rejection_reason && (
              <p className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded-lg">Reason: {listing.rejection_reason}</p>
            )}
          </div>
        ))}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end overflow-y-auto">
          <div className="bg-white w-full rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{editingId ? 'Edit Listing' : 'Add New Service'}</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <select className="input-field" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} required>
                <option value="">Select Category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
              <input className="input-field" placeholder="Service Title" value={form.title} onChange={(e) => set('title', e.target.value)} required />
              <textarea className="input-field h-24" placeholder="Description" value={form.description} onChange={(e) => set('description', e.target.value)} required />
              <div className="flex gap-3">
                <input type="number" className="input-field" placeholder="Price" value={form.price} onChange={(e) => set('price', e.target.value)} required min="0.01" step="0.01" />
                <select className="input-field" value={form.priceUnit} onChange={(e) => set('priceUnit', e.target.value)}>
                  {PRICE_UNITS.map((u) => <option key={u} value={u}>per {u}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-gray-400" />
                <input type="number" className="input-field" placeholder="Prep time (min)" value={form.prepTimeMinutes} onChange={(e) => set('prepTimeMinutes', e.target.value)} />
              </div>
              <input type="number" className="input-field" placeholder="Max quantity (optional)" value={form.maxQuantity} onChange={(e) => set('maxQuantity', e.target.value)} />

              <div>
                <p className="text-sm font-medium mb-2">Delivery Options</p>
                <div className="flex flex-col gap-2">
                  {DELIVERY_OPTS.map(({ value, label }) => (
                    <label key={value} className="flex items-center gap-3">
                      <input type="checkbox" checked={form.deliveryOptions.includes(value)} onChange={() => toggleDelivery(value)} className="h-4 w-4 accent-amber" />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {form.deliveryOptions.includes('self_delivery') && (
                <div className="flex gap-3">
                  <input type="number" className="input-field" placeholder="Radius (miles)" value={form.selfDeliveryRadius} onChange={(e) => set('selfDeliveryRadius', e.target.value)} />
                  <input type="number" className="input-field" placeholder="Delivery fee ($)" value={form.selfDeliveryFee} onChange={(e) => set('selfDeliveryFee', e.target.value)} />
                </div>
              )}

              <label className="flex items-center gap-3">
                <input type="checkbox" checked={form.specialInstructionsAllowed} onChange={(e) => set('specialInstructionsAllowed', e.target.checked)} className="h-4 w-4 accent-amber" />
                <span className="text-sm">Allow special requests from customers</span>
              </label>

              <p className="text-xs text-gray-500 bg-yellow-50 p-3 rounded-xl">⚠️ All listings require admin approval before going live. You'll be notified when approved.</p>

              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="flex-1 border border-gray-200 py-3 rounded-xl text-gray-700">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 btn-primary">
                  {loading ? 'Saving...' : editingId ? 'Update' : 'Submit for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
