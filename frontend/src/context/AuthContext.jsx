import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import api from '../services/api';
import i18n from '../i18n';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [twoFaPending, setTwoFaPending] = useState(false);
  const fetchingRef = useRef(false);

  const applyLanguage = (lang) => {
    if (!lang) return;
    i18n.changeLanguage(lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  };

  const fetchProfile = async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const { data } = await api.get('/auth/me');
      if (data.requires2FA) {
        setTwoFaPending(true);
        setUser(null);
      } else {
        setTwoFaPending(false);
        setUser(data.user);
        applyLanguage(data.user.preferredLanguage);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        // Profile not yet created (mid-signup flow) — stay signed in but no user
        setUser(null);
      } else {
        await supabase.auth.signOut();
        setUser(null);
      }
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
        await fetchProfile();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setTwoFaPending(false);
        setLoading(false);
      } else {
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setTwoFaPending(false);
  };

  const updateUser = (updates) => {
    setUser((prev) => prev ? { ...prev, ...updates } : updates);
  };

  // Called after successful 2FA verification during login
  const completeTwoFALogin = async (code) => {
    const { data } = await api.post('/auth/2fa/login', { token: code });
    setUser(data.user);
    setTwoFaPending(false);
    applyLanguage(data.user.preferredLanguage);
    return data.user;
  };

  // Called by signup pages after profile creation
  const setProfile = (profile) => {
    setUser(profile);
    setTwoFaPending(false);
    applyLanguage(profile.preferredLanguage);
  };

  return (
    <AuthContext.Provider value={{ user, loading, twoFaPending, logout, updateUser, completeTwoFALogin, setProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
