import apiClient from './apiClient';
import { WEB_PUSH_VAPID_PUBLIC_KEY } from '../config/constants';

const BROWSER_PUSH_PLATFORM = 'web';
const BROWSER_PUSH_PROVIDER = 'webpush';
const BROWSER_PUSH_ENDPOINT_KEY = 'zerohook.browserPush.endpoint';

const getLocalStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch (_) {
    return null;
  }
};

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
};

const isBrowserPushSupported = () => {
  if (typeof window === 'undefined') return false;
  if (!window.isSecureContext) return false;

  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
};

const getServiceWorkerRegistration = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const currentRegistration = await navigator.serviceWorker.getRegistration();
    if (currentRegistration) {
      return currentRegistration;
    }
  } catch (_) {
    // Ignore and fall through to the production wait path.
  }

  if (process.env.NODE_ENV === 'production') {
    try {
      const readyPromise = navigator.serviceWorker.ready;
      const timeoutPromise = new Promise((resolve) => {
        window.setTimeout(() => resolve(null), 5000);
      });

      return await Promise.race([readyPromise, timeoutPromise]);
    } catch (_) {
      return null;
    }
  }

  return null;
};

const serializeSubscription = (subscription) => {
  if (!subscription) return null;

  if (typeof subscription.toJSON === 'function') {
    return subscription.toJSON();
  }

  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: subscription.keys || null
  };
};

const requestNotificationPermission = async (shouldRequest) => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }

  if (!shouldRequest) {
    return Notification.permission;
  }

  return Notification.requestPermission();
};

export const enableBrowserPushSubscription = async ({ requestPermission = false } = {}) => {
  if (typeof window === 'undefined') {
    return { success: false, supported: false, message: 'Browser push is only available in the browser.' };
  }

  if (!isBrowserPushSupported()) {
    return { success: false, supported: false, message: 'This browser does not support background notifications.' };
  }

  if (!WEB_PUSH_VAPID_PUBLIC_KEY) {
    return { success: false, supported: true, configured: false, message: 'Browser push is not configured for this environment.' };
  }

  const permission = await requestNotificationPermission(requestPermission);
  if (permission !== 'granted') {
    return {
      success: false,
      supported: true,
      permission,
      message: permission === 'denied'
        ? 'Notification permission is denied.'
        : 'Notification permission is required for browser push.'
    };
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    return { success: false, supported: true, message: 'Service worker is not ready yet.' };
  }

  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription = existingSubscription || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(WEB_PUSH_VAPID_PUBLIC_KEY)
  });

  const serializedSubscription = serializeSubscription(subscription);
  if (!serializedSubscription?.endpoint) {
    return { success: false, supported: true, message: 'Browser push subscription could not be created.' };
  }

  try {
    await apiClient.post('/notifications/register-device', {
      token: serializedSubscription.endpoint,
      platform: BROWSER_PUSH_PLATFORM,
      provider: BROWSER_PUSH_PROVIDER,
      subscription: serializedSubscription
    });
  } catch (error) {
    if (!existingSubscription) {
      try {
        await subscription.unsubscribe();
      } catch (_) {
        // Best-effort cleanup only.
      }
    }

    return {
      success: false,
      supported: true,
      message: error?.response?.data?.message || error?.response?.data?.error || error.message || 'Failed to register browser push subscription.'
    };
  }

  const storage = getLocalStorage();
  if (storage) {
    storage.setItem(BROWSER_PUSH_ENDPOINT_KEY, serializedSubscription.endpoint);
  }

  return {
    success: true,
    subscription: serializedSubscription,
    message: 'Browser push subscription registered.'
  };
};

export const disableBrowserPushSubscription = async () => {
  if (typeof window === 'undefined') {
    return { success: false, supported: false, message: 'Browser push is only available in the browser.' };
  }

  const storage = getLocalStorage();
  const registration = await getServiceWorkerRegistration();
  const currentSubscription = registration ? await registration.pushManager.getSubscription() : null;
  const endpoint = currentSubscription?.endpoint || storage?.getItem(BROWSER_PUSH_ENDPOINT_KEY) || null;

  if (endpoint) {
    try {
      await apiClient.post('/notifications/unregister-device', {
        token: endpoint,
        platform: BROWSER_PUSH_PLATFORM,
        provider: BROWSER_PUSH_PROVIDER
      });
    } catch (_) {
      // The browser-level unsubscribe is the primary concern here.
    }
  }

  if (currentSubscription) {
    try {
      await currentSubscription.unsubscribe();
    } catch (_) {
      // Ignore unsubscribe failures; the endpoint has already been deactivated server-side when possible.
    }
  }

  if (storage) {
    storage.removeItem(BROWSER_PUSH_ENDPOINT_KEY);
  }

  return {
    success: true,
    message: 'Browser push subscription disabled.'
  };
};

export { isBrowserPushSupported };
