import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, MessageCircle, Flag, Star } from 'lucide-react';
import api from '../services/api';
import StarRating from '../components/common/StarRating';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function HostPublicProfile() {
  const { hostId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [host, setHost] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/listings?hostId=${hostId}&limit=20`),
    ]).then(([listingsRes]) => {
      setListings(listingsRes.data.listings || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [hostId]);

  const handleMessage = async () => {
    if (!user) return navigate('/login');
    try {
      const { data } = await api.post('/chat/conversations', { recipientId: hostId });
      navigate(`/chat/${data.conversationId}`);
    } catch { navigate('/chat'); }
  };

  const handleReport = async () => {
    const reason = prompt('Reason for report:');
    if (!reason) return;
    await api.post('/chat/report', { reportedId: hostId, reason });
    toast.success('Report submitted.');
  };

  if (loading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin w-8 h-8 border-4 border-amber border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white px-4 py-4 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => navigate(-1)}><ChevronLeft size={24} /></button>
        <h1 className="font-bold text-lg">Host Profile</h1>
        <button onClick={handleReport} className="ml-auto">
          <Flag size={18} className="text-gray-400" />
        </button>
      </div>

      {/* Profile Header */}
      <div className="bg-white px-4 py-6 text-center border-b border-gray-100">
        <div className="w-20 h-20 bg-amber rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-3">
          {listings[0]?.host_profiles?.users?.first_name?.[0] || '?'}
        </div>
        <h2 className="text-xl font-bold">{listings[0]?.host_profiles?.users?.first_name} {listings[0]?.host_profiles?.users?.last_name}</h2>
        <p className="text-sm text-gray-500 mt-1">{listings[0]?.host_profiles?.city}, {listings[0]?.host_profiles?.state}</p>
        <StarRating rating={listings[0]?.host_profiles?.star_rating || 5} />
        {listings[0]?.host_profiles?.is_online && (
          <span className="inline-block mt-2 bg-teal text-white text-xs font-bold px-3 py-1 rounded-full">● Online</span>
        )}
        <div className="flex gap-3 mt-4 justify-center">
          <button onClick={handleMessage} className="btn-secondary flex items-center gap-2 py-2 px-5 text-sm">
            <MessageCircle size={16} /> Message
          </button>
          {user && (
            <button
              onClick={async () => { await api.post(`/customer/saved-hosts/${hostId}`); toast.success('Host saved!'); }}
              className="border border-gray-200 py-2 px-5 rounded-xl text-sm"
            >
              ♡ Save
            </button>
          )}
        </div>
      </div>

      {/* Workspace Photos */}
      {listings[0]?.host_profiles?.workspace_photos?.length > 0 && (
        <div className="px-4 py-4">
          <h2 className="font-bold mb-3">Workspace</h2>
          <div className="flex gap-2 overflow-x-auto">
            {listings[0].host_profiles.workspace_photos.map((photo, i) => (
              <img key={i} src={photo} alt="Workspace" className="h-28 w-28 object-cover rounded-xl flex-shrink-0" />
            ))}
          </div>
        </div>
      )}

      {/* Listings */}
      <div className="px-4 py-4">
        <h2 className="font-bold mb-3">Services</h2>
        <div className="grid grid-cols-2 gap-3">
          {listings.map((listing) => (
            <div
              key={listing.id}
              onClick={() => navigate(`/listing/${listing.id}`)}
              className="card cursor-pointer active:scale-95 transition-transform"
            >
              <div className="h-28 bg-gray-200 overflow-hidden">
                {listing.photos?.[0] ? (
                  <img src={listing.photos[0]} alt={listing.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl text-gray-300">🏠</div>
                )}
              </div>
              <div className="p-3">
                <p className="font-semibold text-xs truncate">{listing.title}</p>
                <p className="text-amber font-bold text-sm mt-1">${listing.price}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
