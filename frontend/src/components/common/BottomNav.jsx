import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { Home, Search, ShoppingBag, MessageCircle, User, LayoutDashboard } from 'lucide-react';

export default function BottomNav() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();

  const isHost = user?.role === 'host';
  const isAdmin = user?.role === 'superadmin';

  const navItems = isAdmin
    ? [{ to: '/admin', icon: LayoutDashboard, label: t('nav.dashboard') }]
    : isHost
    ? [
        { to: '/', icon: Home, label: t('nav.home') },
        { to: '/host/dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
        { to: '/orders', icon: ShoppingBag, label: t('nav.orders') },
        { to: '/chat', icon: MessageCircle, label: t('nav.messages') },
        { to: '/host/profile', icon: User, label: t('nav.profile') },
      ]
    : [
        { to: '/', icon: Home, label: t('nav.home') },
        { to: '/browse', icon: Search, label: t('nav.browse') },
        { to: '/orders', icon: ShoppingBag, label: t('nav.orders') },
        { to: '/chat', icon: MessageCircle, label: t('nav.messages') },
        { to: '/profile', icon: User, label: t('nav.profile') },
      ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom z-50">
      <div className="flex items-center justify-around py-2 max-w-lg mx-auto">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || pathname.startsWith(to + '/');
          return (
            <Link key={to} to={to} className={`flex flex-col items-center gap-1 px-3 py-1 ${active ? 'text-amber' : 'text-gray-400'}`}>
              <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
