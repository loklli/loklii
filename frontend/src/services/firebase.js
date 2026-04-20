export async function requestPushPermission() {
  try {
    if (
      !import.meta.env.VITE_FIREBASE_API_KEY ||
      !import.meta.env.VITE_FIREBASE_PROJECT_ID ||
      !import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
      !import.meta.env.VITE_FIREBASE_APP_ID
    ) return;

    const { initializeApp } = await import('firebase/app');
    const { getMessaging, getToken } = await import('firebase/messaging');

    const app = initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    });

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    });

    if (token) {
      const api = (await import('./api')).default;
      await api.post('/auth/push-token', { token, device: navigator.userAgent });
    }
  } catch (err) {
    console.warn('[Firebase] Push setup failed:', err.message);
  }
}

export function onForegroundMessage(callback) {
  if (
    !import.meta.env.VITE_FIREBASE_API_KEY ||
    !import.meta.env.VITE_FIREBASE_PROJECT_ID ||
    !import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    !import.meta.env.VITE_FIREBASE_APP_ID
  ) return () => {};

  Promise.all([
    import('firebase/app'),
    import('firebase/messaging'),
  ]).then(([{ initializeApp }, { getMessaging, onMessage }]) => {
    try {
      const app = initializeApp({
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      });
      onMessage(getMessaging(app), callback);
    } catch (err) {
      console.warn('[Firebase] Foreground message setup failed:', err.message);
    }
  }).catch((err) => {
    console.warn('[Firebase] Import failed:', err.message);
  });

  return () => {};
}
