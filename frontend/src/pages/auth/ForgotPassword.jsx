import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../services/supabase';
import Logo from '../../components/common/Logo';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch {
      toast.error('Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center">
        <p className="text-5xl mb-4">📧</p>
        <h2 className="text-xl font-bold mb-2">Check your email</h2>
        <p className="text-gray-500 text-sm mb-6">We sent a password reset link to <strong>{email}</strong>. It expires in 15 minutes.</p>
        <Link to="/login" className="text-amber underline">{t('auth.back_to_login')}</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6">
      <Logo size="md" />
      <h1 className="text-xl font-bold mt-6 mb-2">{t('auth.reset_password')}</h1>
      <p className="text-gray-500 text-sm mb-8 text-center">Enter your email and we'll send you a reset link.</p>
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <input type="email" className="input-field" placeholder={t('auth.email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? t('common.loading') : 'Send Reset Link'}
        </button>
        <Link to="/login" className="text-center text-sm text-gray-500 underline">{t('auth.back_to_login')}</Link>
      </form>
    </div>
  );
}
