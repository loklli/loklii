import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from '../../components/common/Logo';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [method, setMethod] = useState('email');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/password/reset/request', { email, method });
      setSent(true);
    } catch {
      toast.error('Failed to send reset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-5xl mb-4">📧</p>
        <h2 className="text-xl font-bold mb-2">Check your {method === 'email' ? 'email' : 'phone'}</h2>
        <p className="text-gray-500 text-sm mb-6">We sent you a {method === 'email' ? 'link' : 'code'} to reset your password. It expires in 15 minutes.</p>
        <Link to="/login" className="text-amber underline">{t('auth.back_to_login')}</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <Logo size="md" />
      <h1 className="text-xl font-bold mt-6 mb-2">{t('auth.reset_password')}</h1>
      <p className="text-gray-500 text-sm mb-8 text-center">Enter your email and choose how to receive your reset link.</p>
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <input type="email" className="input-field" placeholder={t('auth.email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
        <div className="flex gap-3">
          <button type="button" onClick={() => setMethod('email')} className={`flex-1 py-2.5 rounded-xl text-sm font-medium border ${method === 'email' ? 'bg-amber text-white border-amber' : 'bg-white text-gray-700 border-gray-200'}`}>Email Link</button>
          <button type="button" onClick={() => setMethod('sms')} className={`flex-1 py-2.5 rounded-xl text-sm font-medium border ${method === 'sms' ? 'bg-amber text-white border-amber' : 'bg-white text-gray-700 border-gray-200'}`}>SMS Code</button>
        </div>
        <button type="submit" disabled={loading} className="btn-primary">{loading ? t('common.loading') : 'Send Reset'}</button>
        <Link to="/login" className="text-center text-sm text-gray-500 underline">{t('auth.back_to_login')}</Link>
      </form>
    </div>
  );
}
