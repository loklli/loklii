import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, Search, Star, Shield, Clock, Users } from 'lucide-react';
import Logo from '../components/common/Logo';
import api from '../services/api';

export default function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState([]);
  const [featuredListings, setFeaturedListings] = useState([]);

  useEffect(() => {
    api.get('/listings/categories').then((r) => setCategories(r.data)).catch(() => {});
    api.get('/listings?limit=6').then((r) => setFeaturedListings(r.data.listings || [])).catch(() => {});
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) navigate(`/browse?q=${encodeURIComponent(search.trim())}`);
  };

  const handleGPS = () => {
    navigator.geolocation?.getCurrentPosition(({ coords }) => {
      navigate(`/browse?lat=${coords.latitude}&lng=${coords.longitude}`);
    });
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 bg-white sticky top-0 z-40 border-b border-gray-100">
        <Logo size="md" />
        <div className="flex gap-3">
          <button onClick={() => navigate('/login')} className="text-sm font-medium text-gray-700 px-4 py-2 rounded-xl border border-gray-200">
            {t('auth.login')}
          </button>
          <button onClick={() => navigate('/signup')} className="btn-primary text-sm py-2 px-4">
            {t('auth.signup')}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-cream px-4 py-12 text-center">
        <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-2">
          {t('landing.hero_title')}<br />
          <span className="text-amber">{t('landing.hero_title_2')}</span>
        </h1>
        <p className="text-gray-600 mt-3 mb-8 text-base max-w-sm mx-auto">{t('landing.hero_subtitle')}</p>

        <form onSubmit={handleSearch} className="flex gap-2 max-w-sm mx-auto">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('landing.search_placeholder')}
              className="input-field pl-10 text-sm"
            />
          </div>
          <button type="button" onClick={handleGPS} className="p-3 bg-white border border-gray-300 rounded-xl">
            <MapPin size={18} className="text-amber" />
          </button>
        </form>

        <div className="flex flex-col gap-3 mt-6 max-w-xs mx-auto">
          <button onClick={() => navigate('/browse')} className="btn-secondary w-full">{t('landing.cta_customer')}</button>
          <button onClick={() => navigate('/host/signup')} className="btn-outline w-full">{t('landing.cta_host')}</button>
        </div>
      </section>

      {/* Categories */}
      <section className="px-4 py-8">
        <h2 className="section-title mb-4">{t('landing.categories')}</h2>
        <div className="grid grid-cols-3 gap-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => navigate(`/browse?category=${cat.slug}`)}
              className="card p-3 flex flex-col items-center gap-1 active:scale-95 transition-transform"
            >
              <span className="text-2xl">{cat.icon}</span>
              <span className="text-xs font-medium text-center text-gray-700">{cat.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-cream px-4 py-8">
        <h2 className="section-title mb-6 text-center">{t('landing.how_it_works')}</h2>
        <div className="flex flex-col gap-4">
          {[
            { icon: Search, step: '1', label: t('landing.step_browse') },
            { icon: Clock, step: '2', label: t('landing.step_book') },
            { icon: Users, step: '3', label: t('landing.step_enjoy') },
          ].map(({ icon: Icon, step, label }) => (
            <div key={step} className="flex items-center gap-4 bg-white rounded-2xl p-4">
              <div className="w-10 h-10 bg-amber rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">{step}</span>
              </div>
              <div className="flex items-center gap-3">
                <Icon size={20} className="text-amber" />
                <span className="font-medium text-gray-800">{label}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust Badges */}
      <section className="px-4 py-8">
        <div className="flex justify-around">
          {[
            { icon: Shield, label: 'ID Verified Hosts' },
            { icon: Star, label: 'Star Rated' },
            { icon: Users, label: 'Community Trusted' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-2 text-center">
              <div className="w-12 h-12 bg-cream rounded-full flex items-center justify-center">
                <Icon size={22} className="text-amber" />
              </div>
              <span className="text-xs text-gray-600 font-medium max-w-[80px]">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Listings */}
      {featuredListings.length > 0 && (
        <section className="px-4 py-8 bg-cream">
          <h2 className="section-title mb-4">{t('landing.featured_hosts')}</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
            {featuredListings.map((listing) => (
              <div
                key={listing.id}
                onClick={() => navigate(`/listing/${listing.id}`)}
                className="card flex-shrink-0 w-52 snap-start cursor-pointer active:scale-95 transition-transform"
              >
                <div className="h-36 bg-gray-200 overflow-hidden">
                  {listing.photos?.[0] ? (
                    <img src={listing.photos[0]} alt={listing.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">🏠</div>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-sm text-gray-900 truncate">{listing.title}</p>
                  <p className="text-xs text-gray-500">{listing.host_profiles?.city}, {listing.host_profiles?.state}</p>
                  <p className="text-amber font-bold text-sm mt-1">${listing.price}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 px-4 py-8 text-center text-xs">
        <span className="text-xl font-bold">
          <span className="text-amber">Lok</span>
          <span className="text-white">lii</span>
        </span>
        <p className="mt-3">© 2026 Loklii. All rights reserved.</p>
        <div className="flex justify-center gap-4 mt-3">
          <button onClick={() => navigate('/legal')} className="underline">Terms & Disclaimer</button>
          <button onClick={() => navigate('/privacy')} className="underline">Privacy Policy</button>
        </div>
      </footer>

      {/* Bottom padding for mobile nav */}
      <div className="h-20" />
    </div>
  );
}
