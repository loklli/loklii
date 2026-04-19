import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function LegalPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white pb-8">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
        <button onClick={() => navigate(-1)}><ChevronLeft size={24} /></button>
        <h1 className="font-bold text-lg">Terms & Legal</h1>
      </div>
      <div className="px-4 py-6 space-y-6">
        <section>
          <h2 className="font-bold text-base mb-2">{t('legal.disclaimer_title')}</h2>
          <p className="text-xs text-gray-600 leading-relaxed">{t('legal.disclaimer_body')}</p>
        </section>
        <section>
          <h2 className="font-bold text-base mb-2">Cancellation Policy</h2>
          <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
            <li>Customer cancels within 15 min → full refund</li>
            <li>Customer cancels after 15 min, before host starts → 50% refund</li>
            <li>Customer cancels after host starts → no refund</li>
            <li>Host cancels within 15 min → no penalty, full refund to customer</li>
            <li>Host cancels after 15 min → -0.25 star rating deduction</li>
          </ul>
        </section>
        <section>
          <h2 className="font-bold text-base mb-2">Dispute Policy</h2>
          <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
            <li>Disputes must be filed within 72 hours with photo evidence</li>
            <li>Admin resolves within 48 hours</li>
            <li>Auto-refund if not resolved within 48 hours</li>
            <li>3 false disputes → account suspension</li>
            <li>Chargebacks without going through Loklii → permanent ban</li>
          </ul>
        </section>
        <section>
          <h2 className="font-bold text-base mb-2">Privacy & Security</h2>
          <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
            <li>Host location: city & state shown publicly, zip code private</li>
            <li>Phone numbers masked via Twilio</li>
            <li>Payment data stored with Stripe only</li>
            <li>ID verification data stored with Stripe Identity only</li>
            <li>All messages stay within the app</li>
          </ul>
        </section>
        <section>
          <h2 className="font-bold text-base mb-2">Prohibited Services</h2>
          <p className="text-xs text-gray-600">The following are not allowed on Loklii: medical services, legal services, firearms, drugs or controlled substances, adult content, auto repair.</p>
        </section>
      </div>
    </div>
  );
}
