/**
 * Capacitor Push Notifications Client for MyDearPartner
 *
 * When running inside a native mobile shell (iOS / Android Capacitor),
 * this handles:
 * 1. Requesting notification permissions
 * 2. Creating Android channels (mdp_messages_v2 & mdp_interests_v2)
 * 3. Registering device FCM token via POST /api/v1/devices/
 * 4. Listening for incoming notifications
 */

export const CHANNELS = {
  MESSAGES: 'mdp_messages_v2',
  INTERESTS: 'mdp_interests_v2',
} as const;

export async function isCapacitorNative(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const cap = (window as any).Capacitor;
  return Boolean(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
}

export async function initCapacitorPush(apiBaseUrl: string = '/api/v1') {
  if (!(await isCapacitorNative())) {
    return null;
  }

  try {
    // Dynamic import to avoid SSR errors in Next.js
    const { PushNotifications } = await import('@capacitor/push-notifications').catch(() => ({ PushNotifications: null }));
    if (!PushNotifications) {
      console.log('[CapacitorPush] @capacitor/push-notifications not loaded');
      return null;
    }

    // 1. Request permission
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('[CapacitorPush] Push notification permission not granted');
      return null;
    }

    // 2. Create Android notification channels
    const cap = (window as any).Capacitor;
    if (cap?.getPlatform?.() === 'android') {
      await PushNotifications.createChannel({
        id: CHANNELS.MESSAGES,
        name: 'Chat Messages',
        description: 'Instant notifications for incoming chat messages',
        importance: 5, // Importance.HIGH
        visibility: 1, // NotificationVisibility.PUBLIC
        sound: 'default',
        vibration: true,
      });

      await PushNotifications.createChannel({
        id: CHANNELS.INTERESTS,
        name: 'Interests',
        description: 'Instant notifications when someone sends an interest',
        importance: 5,
        visibility: 1,
        sound: 'default',
        vibration: true,
      });
      console.log('[CapacitorPush] Android channels created:', CHANNELS);
    }

    // 3. Register for push notifications
    await PushNotifications.register();

    // 4. Listen for registration success
    PushNotifications.addListener('registration', async (token) => {
      console.log('[CapacitorPush] Device registration token:', token.value?.substring(0, 15) + '...');
      const platform = cap?.getPlatform?.() === 'ios' ? 'ios' : 'android';
      try {
        const res = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/devices/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            token: token.value,
            platform,
          }),
        });
        const data = await res.json();
        console.log('[CapacitorPush] Backend registration response:', data);
      } catch (err) {
        console.error('[CapacitorPush] Failed to register token with backend:', err);
      }
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[CapacitorPush] Registration error:', err);
    });

    // 5. Handle foreground notifications
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[CapacitorPush] Notification received in foreground:', notification);
    });

    // 6. Handle action / tap on notification
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[CapacitorPush] Notification action performed:', action);
      const data = action.notification.data;
      if (data?.conversation_id) {
        window.location.href = `/messages/${encodeURIComponent(data.conversation_id)}`;
      } else if (data?.kind === 'interest') {
        window.location.href = '/interests/received';
      }
    });

  } catch (error) {
    console.error('[CapacitorPush] Error initializing Capacitor push:', error);
  }
}
