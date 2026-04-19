import { useTranslation } from 'react-i18next';
import { useState } from 'react';

export default function LegalDisclaimer({ onAgree, agreed, onChange }) {
  const { t } = useTranslation();
  return (
    <div>
      <p className="text-sm font-semibold text-gray-800 mb-2">{t('legal.disclaimer_title')}</p>
      <div className="border border-gray-300 rounded-xl p-3 h-40 overflow-y-scroll mb-3 bg-gray-50">
        <p className="text-[11px] text-gray-600 leading-relaxed">{t('legal.disclaimer_body')}</p>
      </div>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={onChange}
          className="mt-1 h-4 w-4 accent-amber"
        />
        <span className="text-xs text-gray-700">{t('legal.agree')}</span>
      </label>
    </div>
  );
}
