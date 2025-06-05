// Service Worker for background notifications
const CACHE_NAME = 'cs-game-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});

// Handle background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-check') {
    event.waitUntil(checkGameStatus());
  }
});

// Handle push messages
self.addEventListener('push', (event) => {
  console.log('Push message received:', event);
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Counter-Strike Game', body: event.data.text() };
    }
  }

  const options = {
    body: data.body || 'Game update available',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: data.vibrate || [200, 100, 200],
    data: data,
    actions: [
      {
        action: 'view',
        title: 'View Game'
      }
    ],
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Counter-Strike Game', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  if (event.action === 'view' || !event.action) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        // Check if there's already a window/tab open with the game
        for (const client of clients) {
          if (client.url.includes('/game') && 'focus' in client) {
            return client.focus();
          }
        }
        
        // If no window/tab is open, open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow('/game');
        }
      })
    );
  }
});

// Background function to check game status
async function checkGameStatus() {
  try {
    // Get the session ID from IndexedDB or localStorage
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      // Send message to active clients to check game status
      clients.forEach(client => {
        client.postMessage({ type: 'CHECK_GAME_STATUS' });
      });
    }
  } catch (error) {
    console.error('Error checking game status:', error);
  }
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, vibrate } = event.data;
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: vibrate || [200, 100, 200],
      requireInteraction: true,
      actions: [
        {
          action: 'view',
          title: 'View Game'
        }
      ]
    });
  }
});