const isConfigured = !!(
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID &&
  import.meta.env.VITE_FIREBASE_APP_ID
);

let messaging = null;

if (isConfigured) {
  import('firebase/app').then(({ initializeApp }) => {
    import('firebase/messaging').then(({ getMessaging }) => {
      try {
        const app = initializeApp({
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: import.meta.env.VITE_FIREBASE_APP_ID,
        });
        messaging = getMessaging(app);
      } catch (err) {
        console.warn('[Firebase] Init failed:', err.message);
      }
    });
  });
}

export async function requestPushPermission() {
  if (!isConfigured || !messaging) return;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const { getToken } = await import('firebase/messaging');
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    });

    if (token) {
      const api = (await import('./api')).default;
      await api.post('/auth/push-token', { token, device: navigator.userAgent });
    }
  } catch (err) {
    console.warn('[Firebase] Push permission failed:', err.message);
  }
}

export function onForegroundMessage(callback) {
  if (!isConfigured || !messaging) return () => {};
  import('firebase/messaging').then(({ onMessage }) => {
    onMessage(messaging, callback);
  });
  return () => {};
}
