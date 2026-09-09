/**
 * MyDearPartner Push Notification Service
 *
 * Supports both React Native Firebase (@react-native-firebase/messaging)
 * and Expo Notifications (expo-notifications).
 *
 * Requirements:
 * 1. Requests Android POST_NOTIFICATIONS permission & iOS APNs.
 * 2. Creates Android channels:
 *    - mdp_messages_v2 (Chat Messages)
 *    - mdp_interests_v2 (Interests)
 * 3. Registers device FCM token via POST /api/v1/devices/
 * 4. Handles foreground/background/closed-tray display.
 */

import { Platform, PermissionsAndroid } from 'react-native';

export const CHANNELS = {
  MESSAGES: 'mdp_messages_v2',
  INTERESTS: 'mdp_interests_v2',
} as const;

export interface DeviceRegistrationResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    platform: string;
    active: boolean;
    user_id?: string | number;
  };
}

let _registeredToken: string | null = null;
let _tokenRefreshUnsubscribe: (() => void) | null = null;

/**
 * 1. Request notification permissions on Android (API 33+) and iOS.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          'android.permission.POST_NOTIFICATIONS' as any,
          {
            title: 'MyDearPartner Notifications',
            message: 'Enable notifications to receive instant updates on new messages and interests.',
            buttonPositive: 'Allow',
            buttonNegative: 'Not Now',
          }
        );
        const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
        console.log('[PushNotifications] Android POST_NOTIFICATIONS granted:', isGranted);
        return isGranted;
      }
      return true; // Android < 33 has permission granted at install time
    }

    if (Platform.OS === 'ios') {
      try {
        const messaging = require('@react-native-firebase/messaging').default;
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        console.log('[PushNotifications] iOS AuthorizationStatus:', authStatus, 'enabled:', enabled);
        return enabled;
      } catch {
        // Fallback if expo-notifications is used
        try {
          const Notifications = require('expo-notifications');
          const { status } = await Notifications.requestPermissionsAsync();
          return status === 'granted';
        } catch (e) {
          console.warn('[PushNotifications] Could not request iOS permissions:', e);
          return false;
        }
      }
    }
    return false;
  } catch (error) {
    console.error('[PushNotifications] Permission request error:', error);
    return false;
  }
}

/**
 * 2. Create required Android notification channels:
 *    - mdp_messages_v2 (Chat messages, high priority, default sound)
 *    - mdp_interests_v2 (Interests, high priority, default sound)
 */
export async function createNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    // Check if expo-notifications is available
    const Notifications = require('expo-notifications');
    await Notifications.setNotificationChannelAsync(CHANNELS.MESSAGES, {
      name: 'Chat Messages',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      lightColor: '#E63946',
      enableVibrate: true,
      showBadge: true,
    });

    await Notifications.setNotificationChannelAsync(CHANNELS.INTERESTS, {
      name: 'Interests',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      lightColor: '#208AEF',
      enableVibrate: true,
      showBadge: true,
    });
    console.log('[PushNotifications] Android channels created via expo-notifications:', CHANNELS);
  } catch {
    // If using @notifee/react-native or native React Native Firebase
    try {
      const notifee = require('@notifee/react-native').default;
      await notifee.createChannel({
        id: CHANNELS.MESSAGES,
        name: 'Chat Messages',
        importance: 4, // AndroidImportance.HIGH
        sound: 'default',
        vibration: true,
        badge: true,
      });
      await notifee.createChannel({
        id: CHANNELS.INTERESTS,
        name: 'Interests',
        importance: 4,
        sound: 'default',
        vibration: true,
        badge: true,
      });
      console.log('[PushNotifications] Android channels created via Notifee:', CHANNELS);
    } catch {
      console.log(
        '[PushNotifications] Android notification channels mdp_messages_v2 and mdp_interests_v2 will be handled by FCM native receiver.'
      );
    }
  }
}

/**
 * 3. Retrieve current device FCM token.
 */
export async function getDeviceFcmToken(): Promise<string | null> {
  try {
    // Try React Native Firebase Messaging first
    try {
      const messaging = require('@react-native-firebase/messaging').default;
      if (Platform.OS === 'ios') {
        await messaging().registerDeviceForRemoteMessages();
      }
      const token = await messaging().getToken();
      if (token) {
        console.log('[PushNotifications] Obtained FCM token from @react-native-firebase:', token.substring(0, 15) + '...');
        return token;
      }
    } catch (e) {
      // Ignore and try expo-notifications
    }

    // Try expo-notifications device push token
    try {
      const Notifications = require('expo-notifications');
      const tokenData = await Notifications.getDevicePushTokenAsync();
      if (tokenData?.data) {
        console.log('[PushNotifications] Obtained Device token from expo-notifications:', String(tokenData.data).substring(0, 15) + '...');
        return String(tokenData.data);
      }
    } catch (e) {
      // Ignore
    }
  } catch (error) {
    console.error('[PushNotifications] Failed to retrieve device push token:', error);
  }
  return null;
}

/**
 * 4. Register FCM device token with the backend.
 *    Endpoint: POST /api/v1/devices/
 */
export async function registerDeviceToken(
  apiBaseUrl: string,
  authToken: string,
  explicitToken?: string
): Promise<DeviceRegistrationResponse | null> {
  try {
    const token = explicitToken || (await getDeviceFcmToken());
    if (!token) {
      console.warn('[PushNotifications] No FCM token available to register.');
      return null;
    }

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const cleanUrl = apiBaseUrl.replace(/\/+$/, '');
    const endpoint = `${cleanUrl}/devices/`;

    console.log(`[PushNotifications] Registering token at ${endpoint}...`);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        token,
        platform,
      }),
    });

    const data: DeviceRegistrationResponse = await res.json();
    console.log('[PushNotifications] POST /api/v1/devices/ response status:', res.status, 'body:', data);

    if (res.ok && data.success) {
      _registeredToken = token;
      return data;
    } else {
      console.error('[PushNotifications] Device registration rejected:', data);
      return null;
    }
  } catch (error) {
    console.error('[PushNotifications] Failed to register device token with backend:', error);
    return null;
  }
}

/**
 * 5. Unregister FCM device token on user logout.
 *    Endpoint: DELETE /api/v1/devices/{token}/
 */
export async function unregisterDeviceToken(
  apiBaseUrl: string,
  authToken: string,
  explicitToken?: string
): Promise<boolean> {
  try {
    const token = explicitToken || _registeredToken || (await getDeviceFcmToken());
    if (!token) return true;

    const cleanUrl = apiBaseUrl.replace(/\/+$/, '');
    const endpoint = `${cleanUrl}/devices/${encodeURIComponent(token)}/`;

    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();
    console.log('[PushNotifications] DELETE /api/v1/devices/ response:', data);

    if (_registeredToken === token) {
      _registeredToken = null;
    }
    return res.ok;
  } catch (error) {
    console.error('[PushNotifications] Error unregistering token:', error);
    return false;
  }
}

/**
 * 6. Initialize complete Push Notification Lifecycle:
 *    - Request permissions
 *    - Create channels
 *    - Register token with backend
 *    - Listen for token refresh & re-register
 *    - Handle foreground notifications
 */
export async function initializePushNotifications(options: {
  apiBaseUrl: string;
  getAuthToken: () => Promise<string | null>;
  onNotificationTapped?: (data: any) => void;
}): Promise<string | null> {
  const { apiBaseUrl, getAuthToken, onNotificationTapped } = options;

  // 1. Request permission
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    console.warn('[PushNotifications] Push notifications permission denied by user.');
    return null;
  }

  // 2. Setup channels
  await createNotificationChannels();

  // 3. Register token
  const token = await getDeviceFcmToken();
  if (token) {
    const authToken = await getAuthToken();
    if (authToken) {
      await registerDeviceToken(apiBaseUrl, authToken, token);
    }
  }

  // 4. Setup token refresh listener
  try {
    const messaging = require('@react-native-firebase/messaging').default;
    if (_tokenRefreshUnsubscribe) {
      _tokenRefreshUnsubscribe();
    }
    _tokenRefreshUnsubscribe = messaging().onTokenRefresh(async (newToken: string) => {
      console.log('[PushNotifications] FCM token refreshed:', newToken.substring(0, 15) + '...');
      const authToken = await getAuthToken();
      if (authToken) {
        await registerDeviceToken(apiBaseUrl, authToken, newToken);
      }
    });

    // Handle foreground notifications
    messaging().onMessage(async (remoteMessage: any) => {
      console.log('[PushNotifications] Foreground FCM message received:', remoteMessage);
      // Native system does not automatically show alert banner while app is foregrounded.
      // We trigger a local notification to appear in tray if desired:
      try {
        const Notifications = require('expo-notifications');
        const channelId =
          remoteMessage.data?.kind === 'message' ? CHANNELS.MESSAGES : CHANNELS.INTERESTS;

        await Notifications.scheduleNotificationAsync({
          content: {
            title: remoteMessage.notification?.title || 'My Dear Partner',
            body: remoteMessage.notification?.body || 'You have a new notification',
            data: remoteMessage.data,
            sound: 'default',
          },
          trigger: { channelId } as any,
        });
      } catch (e) {
        console.log('[PushNotifications] Foreground display fallback:', e);
      }
    });

    // Handle notification tap when app opened from background/quit
    messaging().onNotificationOpenedApp((remoteMessage: any) => {
      console.log('[PushNotifications] Notification opened from background:', remoteMessage);
      if (onNotificationTapped && remoteMessage.data) {
        onNotificationTapped(remoteMessage.data);
      }
    });

    messaging()
      .getInitialNotification()
      .then((remoteMessage: any) => {
        if (remoteMessage) {
          console.log('[PushNotifications] Notification opened from killed state:', remoteMessage);
          if (onNotificationTapped && remoteMessage.data) {
            onNotificationTapped(remoteMessage.data);
          }
        }
      });
  } catch {
    // If using Expo Notifications
    try {
      const Notifications = require('expo-notifications');
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      if (onNotificationTapped) {
        Notifications.addNotificationResponseReceivedListener((response: any) => {
          const data = response.notification.request.content.data;
          onNotificationTapped(data);
        });
      }
    } catch {
      // Ignored
    }
  }

  return token;
}
