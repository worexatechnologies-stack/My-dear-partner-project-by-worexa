/* Global service worker for opt-in My Dear Partner Web Push. */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const hasVisibleClient = clients.some((client) => client.visibilityState === 'visible');

    // A live page already receives the authenticated WebSocket event. Pass the
    // data to it for reconciliation but avoid a duplicate system notification.
    for (const client of clients) client.postMessage({ type: 'mdp.web-push', payload });
    if (hasVisibleClient) return;

    await self.registration.showNotification(payload.title || 'My Dear Partner', {
      body: payload.body || 'You have a new update.',
      icon: payload.icon || '/images/main-logo.png',
      badge: '/images/main-logo.png',
      tag: payload.tag || 'mdp-notification',
      renotify: false,
      data: { url: payload.url || '/notifications' },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = event.notification.data?.url;
  const destination = typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')
    ? path
    : '/notifications';

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(destination);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(destination);
  })());
});
