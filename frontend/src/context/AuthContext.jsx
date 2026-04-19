import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import i18n from '../i18n';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('loklii_user');
    const token = localStorage.getItem('loklii_token');
    if (stored && token) {
      const parsed = JSON.parse(stored);
      setUser(parsed);
      if (parsed.preferredLanguage) {
        i18n.changeLanguage(parsed.preferredLanguage);
        document.documentElement.dir = parsed.preferredLanguage === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = parsed.preferredLanguage;
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password, twoFaCode) => {
    const { data } = await api.post('/auth/login', { email, password, twoFaCode });
    if (data.requires2FA) return { requires2FA: true };
    localStorage.setItem('loklii_token', data.token);
    localStorage.setItem('loklii_user', JSON.stringify(data.user));
    setUser(data.user);
    if (data.user.preferredLanguage) {
      i18n.changeLanguage(data.user.preferredLanguage);
      document.documentElement.dir = data.user.preferredLanguage === 'ar' ? 'rtl' : 'ltr';
    }
    return data;
  };

  const signup = async (formData) => {
    const { data } = await api.post('/auth/signup', formData);
    localStorage.setItem('loklii_token', data.token);
    localStorage.setItem('loklii_user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('loklii_token');
    localStorage.removeItem('loklii_user');
    setUser(null);
  };

  const updateUser = (updates) => {
    const updated = { ...user, ...updates };
    localStorage.setItem('loklii_user', JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
