import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import OtpInput from 'react-otp-input';
import Logo from '../../components/common/Logo';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { t } = useTranslation();
  const { user, twoFaPending, completeTwoFALogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      if (user.role === 'host') navigate('/host/dashboard');
      else if (user.role === 'superadmin') navigate('/admin');
      else navigate('/browse');
    }
  }, [user, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes('Email not confirmed')) {
          toast.error('Please verify your email before logging in.');
        } else {
          toast.error(error.message || 'Login failed.');
        }
      }
      // onAuthStateChange in AuthContext handles the rest (sets user or twoFaPending)
    } catch (err) {
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFA = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await completeTwoFALogin(twoFaCode);
      if (result.role === 'host') navigate('/host/dashboard');
      else if (result.role === 'superadmin') navigate('/admin');
      else navigate('/browse');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid code.');
      setTwoFaCode('');
    } finally {
      setLoading(false);
    }
  };

  if (twoFaPending) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 py-12">
        <Logo size="lg" />
        <h1 className="text-2xl font-bold mt-6 mb-2">{t('auth.two_fa')}</h1>
        <p className="text-gray-500 text-sm mb-8 text-center">Enter the 6-digit code from your authenticator app.</p>
        <form onSubmit={handleTwoFA} className="w-full max-w-sm flex flex-col gap-4">
          <OtpInput
            value={twoFaCode} onChange={setTwoFaCode} numInputs={6}
            renderInput={(props) => <input {...props} className="input-field text-center !w-10 mx-1 text-lg" />}
            containerStyle="flex justify-center"
          />
          <button type="submit" disabled={loading || twoFaCode.length < 6} className="btn-primary w-full">
            {loading ? t('common.loading') : 'Verify'}
          </button>
        </form>
        <Link to="/login/recovery" className="mt-4 text-sm text-gray-500 underline">{t('auth.recovery_code')}</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 py-12">
      <Logo size="lg" />
      <h1 className="text-2xl font-bold mt-6 mb-8">{t('auth.login')}</h1>

      <form onSubmit={handleLogin} className="w-full max-w-sm flex flex-col gap-4">
        <input type="email" className="input-field" placeholder={t('auth.email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" className="input-field" placeholder={t('auth.password')} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? t('common.loading') : t('auth.login')}
        </button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-3 text-sm">
        <Link to="/forgot-password" className="text-amber underline">{t('auth.forgot_password')}</Link>
        <p className="text-gray-500">
          Don't have an account?{' '}
          <Link to="/signup" className="text-amber font-semibold">{t('auth.signup')}</Link>
        </p>
      </div>
    </div>
  );
}
