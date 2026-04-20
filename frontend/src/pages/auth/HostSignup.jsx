import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { ChevronLeft, CheckCircle } from 'lucide-react';
import LegalDisclaimer from '../../components/common/LegalDisclaimer';
import OtpInput from 'react-otp-input';
import Logo from '../../components/common/Logo';
import api from '../../services/api';
import toast from 'react-hot-toast';

const STEPS = ['Account', 'Location', 'Services', 'Workspace', 'Identity & Terms', 'Verify Email'];

export default function HostSignup() {
  const { t } = useTranslation();
  const { setProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [signupEmail, setSignupEmail] = useState('');

  const [form, setForm] = useState({
    email: '', phone: '', password: '', confirmPassword: '',
    firstName: '', lastName: '', dateOfBirth: '',
    city: '', state: '', zipCode: '',
    services: '', language: 'en',
    agreedToTerms: false,
  });

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  // Listen for email confirmation link click
  useEffect(() => {
    if (step !== 5) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session) {
        await createProfile(session.access_token);
      }
    });
    return () => subscription.unsubscribe();
  }, [step]);

  const nextStep = () => {
    if (step === 0) {
      if (!form.email || !form.password || !form.firstName || !form.lastName || !form.dateOfBirth)
        return toast.error('Please fill all fields.');
      if (form.password !== form.confirmPassword) return toast.error('Passwords do not match.');
      if (form.password.length < 8) return toast.error('Password must be at least 8 characters.');
    }
    setStep((s) => s + 1);
  };

  const handleSignup = async () => {
    if (!form.agreedToTerms) return toast.error(t('legal.must_agree'));
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { role: 'host' } },
      });
      if (error) throw error;
      setSignupEmail(form.email);
      setStep(5);
    } catch (err) {
      toast.error(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 6) return toast.error('Enter the 6-digit code.');
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: signupEmail,
        token: otp,
        type: 'signup',
      });
      if (error) throw error;
      await createProfile(data.session.access_token);
    } catch (err) {
      toast.error(err.message?.includes('expired') ? 'Code expired. Request a new one.' : 'Invalid code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async (accessToken) => {
    try {
      const { data } = await api.post('/auth/profile',
        {
          phone: form.phone,
          role: 'host',
          firstName: form.firstName,
          lastName: form.lastName,
          dateOfBirth: form.dateOfBirth,
          language: form.language,
          city: form.city,
          state: form.state,
          zipCode: form.zipCode,
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setProfile(data.user);
      toast.success('Welcome to Loklii! Complete your profile to go live.');
      navigate('/host/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create profile. Please contact support.');
    }
  };

  const resendOtp = async () => {
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: signupEmail });
      if (error) throw error;
      toast.success('Verification email resent!');
    } catch {
      toast.error('Could not resend. Please try again.');
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
            <textarea className="input-field h-32"
              placeholder="e.g. Homemade tamales, henna art, math tutoring..."
              value={form.services} onChange={(e) => set('services', e.target.value)} />
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
            <h2 className="text-xl font-bold">Identity Verification & Terms</h2>
            <p className="text-sm text-gray-500">We use Stripe Identity to verify your ID and selfie. You can complete this from your Host Dashboard.</p>
            <div className="bg-cream rounded-2xl p-4 text-center">
              <p className="text-3xl mb-2">🪪</p>
              <p className="text-sm text-gray-600">ID verification available in Host Dashboard after signup.</p>
            </div>
            <LegalDisclaimer agreed={form.agreedToTerms} onChange={(e) => set('agreedToTerms', e.target.checked)} />
            <button onClick={handleSignup} disabled={loading || !form.agreedToTerms} className="btn-primary">
              {loading ? t('common.loading') : 'Create Account'}
            </button>
          </div>
        );
      case 5:
        return (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-5xl">📧</p>
            <h2 className="text-xl font-bold">Verify your email</h2>
            <p className="text-sm text-gray-500">
              We sent a 6-digit code to <strong>{signupEmail}</strong>. Enter it below or click the link in the email.
            </p>
            <OtpInput
              value={otp} onChange={setOtp} numInputs={6}
              renderInput={(props) => <input {...props} className="input-field text-center !w-10 mx-1 text-lg" />}
              containerStyle="flex justify-center"
            />
            <button onClick={handleVerifyOtp} disabled={loading || otp.length < 6} className="btn-primary">
              {loading ? 'Verifying...' : 'Verify & Finish'}
            </button>
            <button type="button" onClick={resendOtp} className="text-sm text-amber underline">
              Resend code
            </button>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
        {step > 0 && step < 5 ? (
          <button onClick={() => setStep((s) => s - 1)}><ChevronLeft size={24} /></button>
        ) : (
          <button onClick={() => navigate('/')}><ChevronLeft size={24} /></button>
        )}
        <Logo size="sm" />
        <span className="ml-auto text-xs text-gray-500">Step {step + 1} of {STEPS.length}</span>
      </div>

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

      {step < 4 && (
        <div className="px-4 pb-8 pt-4 border-t border-gray-100">
          <button onClick={nextStep} className="btn-primary w-full">{t('common.next')}</button>
        </div>
      )}
    </div>
  );
}
