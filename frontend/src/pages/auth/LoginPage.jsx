import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import OtpInput from 'react-otp-input';
import Logo from '../../components/common/Logo';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(email, password, requires2FA ? twoFaCode : undefined);
      if (result.requires2FA) {
        setRequires2FA(true);
        return;
      }
      if (result.user?.role === 'host') navigate('/host/dashboard');
      else if (result.user?.role === 'superadmin') navigate('/admin');
      else navigate('/browse');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-12">
      <Logo size="lg" />
      <h1 className="text-2xl font-bold mt-6 mb-8">{t('auth.login')}</h1>

      <form onSubmit={handleLogin} className="w-full max-w-sm flex flex-col gap-4">
        {!requires2FA ? (
          <>
            <input type="email" className="input-field" placeholder={t('auth.email')} value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" className="input-field" placeholder={t('auth.password')} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </>
        ) : (
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">{t('auth.enter_code')}</p>
            <OtpInput
              value={twoFaCode} onChange={setTwoFaCode} numInputs={6}
              renderInput={(props) => <input {...props} className="input-field text-center !w-10 mx-1 text-lg" />}
              containerStyle="flex justify-center"
            />
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? t('common.loading') : t('auth.login')}
        </button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-3 text-sm">
        <Link to="/forgot-password" className="text-amber underline">{t('auth.forgot_password')}</Link>
        {requires2FA && (
          <Link to="/login/recovery" className="text-gray-500 underline">{t('auth.recovery_code')}</Link>
        )}
        <p className="text-gray-500">
          Don't have an account?{' '}
          <Link to="/signup" className="text-amber font-semibold">{t('auth.signup')}</Link>
        </p>
      </div>
    </div>
  );
}
