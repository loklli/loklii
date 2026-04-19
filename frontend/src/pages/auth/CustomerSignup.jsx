import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { ChevronLeft } from 'lucide-react';
import LegalDisclaimer from '../../components/common/LegalDisclaimer';
import OtpInput from 'react-otp-input';
import Logo from '../../components/common/Logo';
import api from '../../services/api';
import toast from 'react-hot-toast';

const STEPS = ['Account', 'Location & Prefs', 'Identity', 'Terms & 2FA'];

const DIETARY_OPTIONS = ['Halal', 'Kosher', 'Vegan', 'Vegetarian', 'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Keto'];

export default function CustomerSignup() {
  const { t } = useTranslation();
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [twoFASetup, setTwoFASetup] = useState(null);
  const [otp, setOtp] = useState('');
  const [enable2FA, setEnable2FA] = useState(false);

  const [form, setForm] = useState({
    email: '', phone: '', password: '', confirmPassword: '',
    firstName: '', lastName: '', dateOfBirth: '',
    city: '', state: '', zipCode: '',
    dietaryPreferences: [], allergyNotes: '', language: 'en',
    agreedToTerms: false,
  });

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const toggleDiet = (opt) => {
    set('dietaryPreferences', form.dietaryPreferences.includes(opt)
      ? form.dietaryPreferences.filter((d) => d !== opt)
      : [...form.dietaryPreferences, opt]);
  };

  const nextStep = () => {
    if (step === 0) {
      if (!form.email || !form.password || !form.firstName || !form.lastName || !form.dateOfBirth) return toast.error('Please fill all fields.');
      if (form.password !== form.confirmPassword) return toast.error('Passwords do not match.');
      if (form.password.length < 8) return toast.error('Password must be at least 8 characters.');
    }
    setStep((s) => s + 1);
  };

  const handleSignup = async () => {
    if (!form.agreedToTerms) return toast.error(t('legal.must_agree'));
    setLoading(true);
    try {
      const result = await signup({
        email: form.email, phone: form.phone, password: form.password,
        role: 'customer', firstName: form.firstName, lastName: form.lastName,
        dateOfBirth: form.dateOfBirth, language: form.language,
      });
      setRecoveryCodes(result.recoveryCodes);

      await api.put('/customer/profile', {
        city: form.city, state: form.state, zipCode: form.zipCode,
        dietaryPreferences: form.dietaryPreferences, allergyNotes: form.allergyNotes,
      });

      if (enable2FA) {
        const { data } = await api.post('/auth/2fa/setup');
        setTwoFASetup(data);
      } else {
        toast.success('Welcome to Loklii!');
        navigate('/browse');
      }
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
      navigate('/browse');
    } catch {
      toast.error('Invalid code.');
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">Create your account</h2>
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
            <h2 className="text-xl font-bold">Location & Preferences</h2>
            <input className="input-field" placeholder="City" value={form.city} onChange={(e) => set('city', e.target.value)} />
            <input className="input-field" placeholder="State" value={form.state} onChange={(e) => set('state', e.target.value)} />
            <input className="input-field" placeholder="Zip Code" value={form.zipCode} onChange={(e) => set('zipCode', e.target.value)} />
            <div>
              <p className="text-sm font-medium mb-2">Dietary Preferences</p>
              <div className="flex flex-wrap gap-2">
                {DIETARY_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleDiet(opt)}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${form.dietaryPreferences.includes(opt) ? 'bg-teal text-white border-teal' : 'bg-white text-gray-700 border-gray-300'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              className="input-field h-20"
              placeholder="Allergy notes (e.g. severe nut allergy)..."
              value={form.allergyNotes}
              onChange={(e) => set('allergyNotes', e.target.value)}
            />
          </div>
        );
      case 2:
        return (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold">Identity Verification (Optional)</h2>
            <p className="text-sm text-gray-500">Get verified to unlock trusted status and access verified-only hosts.</p>
            <div className="bg-cream rounded-2xl p-6 text-center">
              <p className="text-4xl mb-3">🪪</p>
              <p className="text-sm text-gray-600">You can verify your identity from your profile settings after signing up.</p>
            </div>
          </div>
        );
      case 3:
        if (twoFASetup) {
          return (
            <div className="flex flex-col gap-4">
              <h2 className="text-xl font-bold">{t('auth.two_fa')}</h2>
              <img src={twoFASetup.qrCode} alt="QR Code" className="mx-auto w-48 h-48" />
              <p className="text-xs text-center text-gray-500">Manual: <strong>{twoFASetup.secret}</strong></p>
              <OtpInput
                value={otp} onChange={setOtp} numInputs={6}
                renderInput={(props) => <input {...props} className="input-field text-center !w-10 mx-1" />}
                containerStyle="flex justify-center"
              />
              <button onClick={handleVerify2FA} className="btn-secondary">Verify & Finish</button>
              {recoveryCodes.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-yellow-800 mb-2">⚠️ Save these recovery codes somewhere safe.</p>
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
            <h2 className="text-xl font-bold">Terms & Security</h2>
            <LegalDisclaimer agreed={form.agreedToTerms} onChange={(e) => set('agreedToTerms', e.target.checked)} />
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={enable2FA} onChange={(e) => setEnable2FA(e.target.checked)} className="h-4 w-4 accent-teal" />
              <span className="text-sm text-gray-700">Enable Two-Factor Authentication (recommended)</span>
            </label>
            <button onClick={handleSignup} disabled={loading || !form.agreedToTerms} className="btn-secondary">
              {loading ? t('common.loading') : 'Create Account'}
            </button>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
        {step > 0 && !twoFASetup ? (
          <button onClick={() => setStep((s) => s - 1)}><ChevronLeft size={24} /></button>
        ) : (
          <button onClick={() => navigate('/')}><ChevronLeft size={24} /></button>
        )}
        <Logo size="sm" />
        <span className="ml-auto text-xs text-gray-500">Step {step + 1} of {STEPS.length}</span>
      </div>

      <div className="px-4 pt-3">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-teal rounded-full transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">{renderStep()}</div>

      {step < 3 && !twoFASetup && (
        <div className="px-4 pb-8 pt-4 border-t border-gray-100">
          <button onClick={nextStep} className="btn-secondary w-full">{t('common.next')}</button>
        </div>
      )}
    </div>
  );
}
