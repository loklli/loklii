import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import ar from './locales/ar.json';
import es from './locales/es.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, ar: { translation: ar }, es: { translation: es } },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar', 'es'],
    interpolation: { escapeValue: false },
  });

export default i18n;
