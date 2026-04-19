import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { ChevronLeft, CheckCircle } from 'lucide-react';
import LegalDisclaimer from '../../components/common/LegalDisclaimer';
import OtpInput from 'react-otp-input';
import Logo from '../../components/common/Logo';
import api from '../../services/api';
import toast from 'react-hot-toast';

const STEPS = ['Account', 'Location', 'Services', 'Workspace', 'Identity', 'Terms & 2FA'];

export default function HostSignup() {
  const { t } = useTranslation();
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [twoFASetup, setTwoFASetup] = useState(null);
  const [otp, setOtp] = useState('');

  const [form, setForm] = useState({
    email: '', phone: '', password: '', confirmPassword: '',
    firstName: '', lastName: '', dateOfBirth: '',
    city: '', state: '', zipCode: '',
    services: '', language: 'en',
    agreedToTerms: false,
  });

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const nextStep = async () => {
    if (step === 0) {
      if (!form.email || !form.password || !form.firstName || !form.lastName || !form.dateOfBirth) {
        return toast.error('Please fill all fields.');
      }
      if (form.password !== form.confirmPassword) return toast.error('Passwords do not match.');
      if (form.password.length < 8) return toast.error('Password must be at least 8 characters.');
    }
    if (step === 4 && !form.agreedToTerms) return toast.error(t('legal.must_agree'));
    setStep((s) => s + 1);
  };

  const handleSignup = async () => {
    if (!form.agreedToTerms) return toast.error(t('legal.must_agree'));
    setLoading(true);
    try {
      const result = await signup({
        email: form.email, phone: form.phone, password: form.password,
        role: 'host', firstName: form.firstName, lastName: form.lastName,
        dateOfBirth: form.dateOfBirth, language: form.language,
      });
      setRecoveryCodes(result.recoveryCodes);

      // Update location
      await api.put('/host/profile', { city: form.city, state: form.state, zipCode: form.zipCode });

      // Setup 2FA
      const { data } = await api.post('/auth/2fa/setup');
      setTwoFASetup(data);
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    try {
      await api.post('/auth/2fa/verify', { token: otp });
      toast.success('Account created! Welcome to Loklii.');
      navigate('/host/dashboard');
    } catch {
      toast.error('Invalid code. Try again.');
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">Create your host account</h2>
            <div className="flex gap-3">
              <input className="input-field" placeholder={t('auth.first_name')} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
              <input className="input-field" placeholder={t('auth.last_name')} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
            </div>
            <input className="input-field" type="email" placeholder={t('auth.email')} value={form.email} onChange={(e) => set('email', e.target.value)} />
            <input className="input-field" type="tel" placeholder={t('auth.phone')} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            <div>
              <label className="text-sm text-gray-600 mb-1 block">{t('auth.dob')}</label>
              <input className="input-field" type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
              <p className="text-xs text-gray-500 mt-1">{t('auth.age_requirement')}</p>
            </div>
            <input className="input-field" type="password" placeholder={t('auth.password')} value={form.password} onChange={(e) => set('password', e.target.value)} />
            <input className="input-field" type="password" placeholder="Confirm Password" value={form.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} />
            <select className="input-field" value={form.language} onChange={(e) => set('language', e.target.value)}>
              <option value="en">English</option>
              <option value="ar">العربية</option>
              <option value="es">Español</option>
            </select>
          </div>
        );
      case 1:
        return (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">Your location</h2>
            <p className="text-sm text-gray-500">Your city & state will be shown publicly. Your zip code is private.</p>
            <input className="input-field" placeholder="City" value={form.city} onChange={(e) => set('city', e.target.value)} />
            <input className="input-field" placeholder="State (e.g. TX)" value={form.state} onChange={(e) => set('state', e.target.value)} />
            <input className="input-field" placeholder="Zip Code" value={form.zipCode} onChange={(e) => set('zipCode', e.target.value)} />
          </div>
        );
      case 2:
        return (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">What services will you offer?</h2>
            <p className="text-sm text-gray-500">You can add unlimited services after signup. Admin must approve each listing before it goes live.</p>
            <p className="text-xs text-red-600 bg-red-50 p-3 rounded-xl">Not allowed: medical, legal, firearms, drugs, adult content, auto repair.</p>
            <textarea
              className="input-field h-32"
              placeholder="e.g. Homemade tamales, henna art, math tutoring..."
              value={form.services}
              onChange={(e) => set('services', e.target.value)}
            />
          </div>
        );
      case 3:
        return (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">Workspace photos</h2>
            <p className="text-sm text-gray-500">You'll need to upload at least 2 photos of your workspace before going online. You can do this from your dashboard.</p>
            <div className="bg-cream rounded-2xl p-6 text-center">
              <p className="text-4xl mb-3">📸</p>
              <p className="text-sm text-gray-600">Upload workspace photos after signup from your Host Dashboard.</p>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">Identity Verification</h2>
            <p className="text-sm text-gray-500">We use Stripe Identity to verify your ID and selfie. Your data is stored with Stripe only — never on our servers.</p>
            <div className="bg-cream rounded-2xl p-6 text-center">
              <p className="text-4xl mb-3">🪪</p>
              <p className="text-sm text-gray-600">You can complete ID verification from your Host Dashboard after creating your account.</p>
            </div>
            <LegalDisclaimer agreed={form.agreedToTerms} onChange={(e) => set('agreedToTerms', e.target.checked)} />
          </div>
        );
      case 5:
        if (twoFASetup) {
          return (
            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-bold">{t('auth.two_fa')}</h2>
              <p className="text-sm text-gray-600">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
              <img src={twoFASetup.qrCode} alt="QR Code" className="mx-auto w-48 h-48" />
              <p className="text-xs text-center text-gray-500">Or enter secret manually: <strong>{twoFASetup.secret}</strong></p>
              <p className="text-sm font-medium">{t('auth.enter_code')}</p>
              <OtpInput
                value={otp} onChange={setOtp} numInputs={6}
                renderInput={(props) => <input {...props} className="input-field text-center !w-10 mx-1" />}
                containerStyle="flex justify-center"
              />
              <button onClick={handleVerify2FA} className="btn-primary">Verify & Finish</button>
              {recoveryCodes.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-yellow-800 mb-2">⚠️ Save these recovery codes somewhere safe. You will not see them again.</p>
                  <div className="grid grid-cols-2 gap-1">
                    {recoveryCodes.map((code) => (
                      <code key={code} className="text-xs bg-white px-2 py-1 rounded border border-yellow-300 font-mono">{code}</code>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        }
        return (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">Almost done!</h2>
            <LegalDisclaimer agreed={form.agreedToTerms} onChange={(e) => set('agreedToTerms', e.target.checked)} />
            <button onClick={handleSignup} disabled={loading || !form.agreedToTerms} className="btn-primary">
              {loading ? t('common.loading') : 'Create Account & Setup 2FA'}
            </button>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
        {step > 0 && !twoFASetup ? (
          <button onClick={() => setStep((s) => s - 1)}><ChevronLeft size={24} /></button>
        ) : (
          <button onClick={() => navigate('/')}><ChevronLeft size={24} /></button>
        )}
        <Logo size="sm" />
        <span className="ml-auto text-xs text-gray-500">Step {step + 1} of {STEPS.length}</span>
      </div>

      {/* Progress */}
      <div className="px-4 pt-3">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-amber rounded-full transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <div className="flex justify-between mt-1">
          {STEPS.map((s, i) => (
            <span key={s} className={`text-[10px] ${i === step ? 'text-amber font-semibold' : 'text-gray-400'}`}>
              {i < step ? <CheckCircle size={10} className="text-teal inline" /> : ''} {s}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">{renderStep()}</div>

      {/* Nav buttons */}
      {step < 5 && !twoFASetup && (
        <div className="px-4 pb-8 pt-4 border-t border-gray-100">
          <button onClick={nextStep} className="btn-primary w-full">
            {step === STEPS.length - 2 ? 'Create Account' : t('common.next')}
          </button>
        </div>
      )}
    </div>
  );
}
