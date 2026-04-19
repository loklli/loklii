import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, ShoppingBag, AlertTriangle, CheckSquare, Settings, BarChart3, Activity, List } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import Logo from '../../components/common/Logo';

const TABS = ['overview', 'listings', 'hosts', 'customers', 'disputes', 'appeals', 'settings', 'log'];

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [pendingListings, setPendingListings] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [appeals, setAppeals] = useState([]);
  const [settings, setSettings] = useState({});
  const [activityLog, setActivityLog] = useState([]);

  useEffect(() => {
    api.get('/admin/overview').then((r) => setOverview(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'listings') api.get('/admin/listings/pending').then((r) => setPendingListings(r.data)).catch(() => {});
    if (tab === 'hosts') api.get('/admin/hosts').then((r) => setHosts(r.data)).catch(() => {});
    if (tab === 'customers') api.get('/admin/customers').then((r) => setCustomers(r.data)).catch(() => {});
    if (tab === 'disputes') api.get('/admin/disputes').then((r) => setDisputes(r.data)).catch(() => {});
    if (tab === 'appeals') api.get('/admin/appeals').then((r) => setAppeals(r.data)).catch(() => {});
    if (tab === 'settings') api.get('/admin/settings').then((r) => setSettings(r.data)).catch(() => {});
    if (tab === 'log') api.get('/admin/activity-log').then((r) => setActivityLog(r.data)).catch(() => {});
  }, [tab]);

  const approveListing = async (id) => {
    await api.post(`/admin/listings/${id}/approve`);
    setPendingListings((p) => p.filter((l) => l.id !== id));
    toast.success('Listing approved!');
  };

  const rejectListing = async (id) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    await api.post(`/admin/listings/${id}/reject`, { reason });
    setPendingListings((p) => p.filter((l) => l.id !== id));
    toast.success('Listing rejected.');
  };

  const pauseHost = async (userId) => {
    const reason = prompt('Pause reason:');
    if (!reason) return;
    await api.post(`/admin/hosts/${userId}/pause`, { reason });
    setHosts((prev) => prev.map((h) => h.users?.id === userId ? { ...h, users: { ...h.users, is_suspended: true } } : h));
    toast.success('Host paused.');
  };

  const reinstateHost = async (userId) => {
    await api.post(`/admin/hosts/${userId}/reinstate`);
    toast.success('Host reinstated.');
    api.get('/admin/hosts').then((r) => setHosts(r.data));
  };

  const resolveDispute = async (id) => {
    const resolution = prompt('Resolution (refund_full / refund_partial / no_refund):');
    if (!resolution) return;
    const notes = prompt('Admin notes:') || '';
    await api.post(`/admin/disputes/${id}/resolve`, { resolution, adminNotes: notes });
    setDisputes((p) => p.filter((d) => d.id !== id));
    toast.success('Dispute resolved.');
  };

  const resolveAppeal = async (hostProfileId) => {
    const decision = prompt('Decision (reinstate / remove):');
    if (!decision) return;
    await api.post(`/admin/appeals/${hostProfileId}/resolve`, { decision });
    setAppeals((p) => p.filter((a) => a.id !== hostProfileId));
    toast.success('Appeal resolved.');
  };

  const updateSetting = async (key, value) => {
    await api.put('/admin/settings', { key, value });
    setSettings((s) => ({ ...s, [key]: value }));
    toast.success('Setting updated.');
  };

  const TAB_ICONS = { overview: BarChart3, listings: List, hosts: Users, customers: Users, disputes: AlertTriangle, appeals: CheckSquare, settings: Settings, log: Activity };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-amber text-white px-4 py-4 flex items-center justify-between">
        <Logo size="sm" />
        <span className="text-sm font-semibold bg-white/20 px-3 py-1 rounded-full">Admin</span>
      </div>

      {/* Tab Navigation */}
      <div className="flex overflow-x-auto bg-white border-b border-gray-200 px-2">
        {TABS.map((t) => {
          const Icon = TAB_ICONS[t];
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-3 text-xs font-medium capitalize ${tab === t ? 'text-amber border-b-2 border-amber' : 'text-gray-500'}`}
            >
              <Icon size={16} />
              {t}
            </button>
          );
        })}
      </div>

      <div className="px-4 py-4">
        {/* Overview */}
        {tab === 'overview' && overview && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total Hosts', value: overview.totalHosts, color: 'text-amber' },
              { label: 'Total Customers', value: overview.totalCustomers, color: 'text-teal' },
              { label: 'Pending Listings', value: overview.pendingListings, color: 'text-orange-500' },
              { label: 'Open Disputes', value: overview.openDisputes, color: 'text-red-500' },
              { label: 'Pending Appeals', value: overview.pendingAppeals, color: 'text-purple-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-2xl p-4 shadow-sm">
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Pending Listings */}
        {tab === 'listings' && (
          <div className="flex flex-col gap-3">
            {pendingListings.length === 0 && <p className="text-center text-gray-400 py-8">No pending listings.</p>}
            {pendingListings.map((listing) => (
              <div key={listing.id} className="bg-white rounded-2xl p-4">
                <p className="font-bold text-sm">{listing.title}</p>
                <p className="text-xs text-gray-500">{listing.categories?.name} · ${listing.price}</p>
                <p className="text-xs text-gray-400">Host: {listing.host_profiles?.users?.first_name} {listing.host_profiles?.users?.last_name}</p>
                <p className="text-xs text-gray-600 mt-2">{listing.description}</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => approveListing(listing.id)} className="flex-1 btn-primary text-sm py-2">Approve</button>
                  <button onClick={() => rejectListing(listing.id)} className="flex-1 border border-red-300 text-red-600 text-sm py-2 rounded-xl">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Hosts */}
        {tab === 'hosts' && (
          <div className="flex flex-col gap-3">
            {hosts.map((host) => (
              <div key={host.id} className="bg-white rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{host.users?.first_name} {host.users?.last_name}</p>
                    <p className="text-xs text-gray-500">{host.users?.email}</p>
                    <p className="text-xs text-gray-400">★ {host.star_rating} · {host.total_orders_completed} orders</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    {host.users?.is_suspended ? (
                      <button onClick={() => reinstateHost(host.users.id)} className="text-xs bg-teal text-white px-3 py-1 rounded-full">Reinstate</button>
                    ) : (
                      <button onClick={() => pauseHost(host.users.id)} className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full">Pause</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Customers */}
        {tab === 'customers' && (
          <div className="flex flex-col gap-3">
            {customers.map((cust) => (
              <div key={cust.id} className="bg-white rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{cust.users?.first_name} {cust.users?.last_name}</p>
                  <p className="text-xs text-gray-500">{cust.users?.email}</p>
                  <p className="text-xs text-gray-400">Disputes: {cust.false_dispute_count}</p>
                </div>
                {!cust.users?.is_suspended && (
                  <button onClick={async () => { const r = prompt('Reason:'); if (r) { await api.post(`/admin/customers/${cust.users.id}/suspend`, { reason: r }); toast.success('Suspended.'); } }} className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full">Suspend</button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Disputes */}
        {tab === 'disputes' && (
          <div className="flex flex-col gap-3">
            {disputes.length === 0 && <p className="text-center text-gray-400 py-8">No open disputes.</p>}
            {disputes.map((dispute) => (
              <div key={dispute.id} className="bg-white rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-sm">Order #{dispute.orders?.order_number}</p>
                  <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                    Due: {new Date(dispute.deadline_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-gray-600">{dispute.reason}</p>
                <p className="text-xs text-gray-400 mt-1">${dispute.orders?.total_amount}</p>
                <button onClick={() => resolveDispute(dispute.id)} className="mt-3 btn-primary text-sm py-2 w-full">Resolve</button>
              </div>
            ))}
          </div>
        )}

        {/* Appeals */}
        {tab === 'appeals' && (
          <div className="flex flex-col gap-3">
            {appeals.length === 0 && <p className="text-center text-gray-400 py-8">No pending appeals.</p>}
            {appeals.map((appeal) => (
              <div key={appeal.id} className="bg-white rounded-2xl p-4">
                <p className="font-bold text-sm">{appeal.users?.first_name} {appeal.users?.last_name}</p>
                <p className="text-xs text-gray-500">{appeal.users?.email}</p>
                <p className="text-xs text-gray-400">Negative reviews: {appeal.negative_review_count}</p>
                <p className="text-xs text-gray-700 mt-2 bg-gray-50 p-2 rounded-xl">{appeal.appeal_text}</p>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => resolveAppeal(appeal.id)} className="flex-1 btn-primary text-sm py-2">Reinstate</button>
                  <button onClick={async () => { await api.post(`/admin/appeals/${appeal.id}/resolve`, { decision: 'remove' }); setAppeals((p) => p.filter((a) => a.id !== appeal.id)); toast.success('Removed.'); }} className="flex-1 border border-red-300 text-red-600 text-sm py-2 rounded-xl">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Settings */}
        {tab === 'settings' && (
          <div className="flex flex-col gap-3">
            {Object.entries(settings).map(([key, value]) => (
              <div key={key} className="bg-white rounded-2xl p-4 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{key.replace(/_/g, ' ')}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    defaultValue={value}
                    onBlur={(e) => { if (e.target.value !== value) updateSetting(key, e.target.value); }}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-20 text-right"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Activity Log */}
        {tab === 'log' && (
          <div className="flex flex-col gap-2">
            {activityLog.map((entry) => (
              <div key={entry.id} className="bg-white rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">{entry.action.replace(/_/g, ' ')}</span>
                  <span className="text-[10px] text-gray-400">{new Date(entry.created_at).toLocaleString()}</span>
                </div>
                {entry.users && (
                  <p className="text-[11px] text-gray-500 mt-0.5">{entry.users.first_name} {entry.users.last_name} ({entry.users.role})</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
