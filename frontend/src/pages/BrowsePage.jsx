import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, MapPin, Filter, Star } from 'lucide-react';
import api from '../services/api';
import StarRating from '../components/common/StarRating';
import InfiniteScroll from 'react-infinite-scroll-component';

const CATEGORIES = ['All', 'food-cooking', 'baked-goods', 'beauty-hair', 'henna-art', 'other'];
const CATEGORY_LABELS = { 'food-cooking': '🍽️ Home-cooked meals', 'baked-goods': '🧁 Baked goods & pastries', 'beauty-hair': '💅 Beauty & nail care', 'henna-art': '🌿 Henna & body art', other: '✨ Other' };

export default function BrowsePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [listings, setListings] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(params.get('q') || '');
  const [activeCategory, setActiveCategory] = useState(params.get('category') || '');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [minRating, setMinRating] = useState('');

  const LIMIT = 12;

  const fetchListings = useCallback(async (reset = false) => {
    try {
      const currentOffset = reset ? 0 : offset;
      const qp = new URLSearchParams({
        limit: LIMIT,
        offset: currentOffset,
        ...(activeCategory && { category: activeCategory }),
        ...(search && { city: search }),
        ...(minRating && { minRating }),
      });

      const { data } = await api.get(`/listings?${qp}`);
      const fetched = data.listings || [];

      if (reset) {
        setListings(fetched);
        setOffset(LIMIT);
      } else {
        setListings((prev) => [...prev, ...fetched]);
        setOffset((o) => o + LIMIT);
      }

      setHasMore(fetched.length === LIMIT);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, search, minRating, offset]);

  useEffect(() => {
    setLoading(true);
    fetchListings(true);
  }, [activeCategory, minRating]);

  const handleSearch = (e) => {
    e.preventDefault();
    setLoading(true);
    fetchListings(true);
  };

  const handleGPS = () => {
    navigator.geolocation?.getCurrentPosition(({ coords }) => {
      setParams({ lat: coords.latitude, lng: coords.longitude });
      fetchListings(true);
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Search Bar */}
      <div className="bg-white px-4 py-4 sticky top-0 z-30 border-b border-gray-100">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('landing.search_placeholder')}
              className="input-field pl-9 text-sm py-2.5"
            />
          </div>
          <button type="button" onClick={handleGPS} className="p-2.5 bg-gray-100 rounded-xl">
            <MapPin size={18} className="text-amber" />
          </button>
          <button type="button" onClick={() => setShowFilters(!showFilters)} className="p-2.5 bg-gray-100 rounded-xl">
            <Filter size={18} className={showFilters ? 'text-amber' : 'text-gray-600'} />
          </button>
        </form>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Min Rating:</label>
              <select className="input-field py-1.5 text-sm flex-1" value={minRating} onChange={(e) => setMinRating(e.target.value)}>
                <option value="">Any</option>
                <option value="4">4+ stars</option>
                <option value="4.5">4.5+ stars</option>
                <option value="5">5 stars</option>
              </select>
            </div>
          </div>
        )}

        {/* Category Chips */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveCategory('')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${!activeCategory ? 'bg-amber text-white border-amber' : 'bg-white text-gray-700 border-gray-200'}`}
          >
            All
          </button>
          {CATEGORIES.slice(1).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat === activeCategory ? '' : cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${activeCategory === cat ? 'bg-amber text-white border-amber' : 'bg-white text-gray-700 border-gray-200'}`}
            >
              {CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-amber border-t-transparent rounded-full" />
        </div>
      ) : (
        <InfiniteScroll
          dataLength={listings.length}
          next={fetchListings}
          hasMore={hasMore}
          loader={<div className="text-center py-4 text-gray-400 text-sm">Loading more...</div>}
          endMessage={<p className="text-center py-6 text-gray-400 text-sm">No more listings.</p>}
        >
          <div className="px-4 py-4 grid grid-cols-2 gap-3">
            {listings.length === 0 ? (
              <div className="col-span-2 text-center py-12">
                <p className="text-4xl mb-3">🔍</p>
                <p className="text-gray-500">No services found in your area yet.</p>
              </div>
            ) : (
              listings.map((listing) => (
                <div
                  key={listing.id}
                  onClick={() => navigate(`/listing/${listing.id}`)}
                  className="card cursor-pointer active:scale-95 transition-transform"
                >
                  <div className="relative h-32 bg-gray-200 overflow-hidden">
                    {listing.photos?.[0] ? (
                      <img src={listing.photos[0]} alt={listing.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl text-gray-300">🏠</div>
                    )}
                    {listing.host_profiles?.is_online && (
                      <span className="absolute top-2 left-2 bg-teal text-white text-[10px] font-bold px-2 py-0.5 rounded-full">ONLINE</span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-xs text-gray-900 truncate">{listing.title}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{listing.host_profiles?.city}, {listing.host_profiles?.state}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-amber font-bold text-sm">${listing.price}</span>
                      <div className="flex items-center gap-0.5">
                        <Star size={11} className="text-amber fill-amber" />
                        <span className="text-[11px] text-gray-600">{listing.host_profiles?.star_rating?.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </InfiniteScroll>
      )}
    </div>
  );
}
