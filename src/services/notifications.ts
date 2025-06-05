// Notification service for mobile push notifications
export class NotificationService {
  private static instance: NotificationService;
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  
  static getInstance(): NotificationService {
    if (!this.instance) {
      this.instance = new NotificationService();
    }
    return this.instance;
  }

  async initializeServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        this.serviceWorkerRegistration = registration;
        console.log('Service Worker registered successfully:', registration);

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage);

        // Update service worker if needed
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker is available
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });

      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  private handleServiceWorkerMessage = (event: MessageEvent) => {
    if (event.data && event.data.type === 'CHECK_GAME_STATUS') {
      // Service worker is asking us to check game status
      // This can be used for background sync
      console.log('Service worker requesting game status check');
    }
  };

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      console.warn('Notifications are blocked. Please enable them in browser settings.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        console.log('Notification permission granted');
        
        // Test notification to ensure it works
        await this.showTestNotification();
        
        return true;
      } else {
        console.warn('Notification permission denied');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  private async showTestNotification() {
    try {
      if (this.serviceWorkerRegistration && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title: '🎮 Notifications Enabled!',
          body: 'You\'ll receive game updates even when your phone is locked.',
          tag: 'test-notification'
        });
      } else {
        const notification = new Notification('🎮 Notifications Enabled!', {
          body: 'You\'ll receive game updates even when your phone is locked.',
          icon: '/favicon.ico',
          tag: 'test-notification',
          requireInteraction: false,
        });

        setTimeout(() => notification.close(), 3000);
      }
    } catch (error) {
      console.error('Test notification failed:', error);
    }
  }

  async showRoundEndNotification(winner: string, reason: string, _teamColors: { bg: string; text: string }) {
    const hasPermission = await this.requestPermission();
    if (!hasPermission) return;

    const winnerText = winner === 'draw' ? 'Draw!' : 
                      winner === 'terrorist' ? '🔥 Terrorists Win!' : 
                      '🛡️ Counter-Terrorists Win!';

    const vibrationPattern = winner === 'draw' ? [200, 100, 200] :
                           [200, 100, 200, 100, 200]; // Victory pattern

    // Always try service worker first for better background support
    let notificationShown = false;
    
    if (this.serviceWorkerRegistration) {
      try {
        // Use registration.showNotification for better background support
        await this.serviceWorkerRegistration.showNotification(winnerText, {
          body: reason,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'round-end',
          requireInteraction: true,
          silent: false,
          actions: [
            {
              action: 'view',
              title: 'View Game'
            }
          ]
        } as NotificationOptions);
        notificationShown = true;
        console.log('Service worker notification sent:', winnerText);
      } catch (error) {
        console.error('Service worker registration notification failed:', error);
      }
    }

    // Fallback to regular notification if service worker failed
    if (!notificationShown) {
      await this.showRegularNotification(winnerText, reason, vibrationPattern);
    }

    // Always vibrate the device
    this.vibrate(vibrationPattern);
  }

  private async showRegularNotification(title: string, body: string, _vibrationPattern: number[]) {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'round-end',
      requireInteraction: true,
    });

    // Handle notification click
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close after 10 seconds
    setTimeout(() => {
      notification.close();
    }, 10000);

    return notification;
  }

  async showRoundStartNotification() {
    const hasPermission = await this.requestPermission();
    if (!hasPermission) return;

    const vibrationPattern = [100, 50, 100];

    // Try to use service worker for background notifications
    if (this.serviceWorkerRegistration && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title: '🎮 Round Started!',
          body: 'Good luck! Eliminate the enemy team.',
          vibrate: vibrationPattern
        });
      } catch (error) {
        console.error('Service worker notification failed, using fallback:', error);
        await this.showRegularStartNotification();
      }
    } else {
      await this.showRegularStartNotification();
    }

    // Always vibrate the device
    this.vibrate(vibrationPattern);
  }

  async showBombPlantedNotification() {
    const hasPermission = await this.requestPermission();
    if (!hasPermission) return;

    const vibrationPattern = [200, 100, 200, 100, 200];

    // Try to use service worker for background notifications
    if (this.serviceWorkerRegistration && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title: '💣 Bomb Planted!',
          body: 'Counter-terrorists must defuse the bomb!',
          vibrate: vibrationPattern
        });
      } catch (error) {
        console.error('Service worker notification failed, using fallback:', error);
        await this.showRegularBombNotification('💣 Bomb Planted!', 'Counter-terrorists must defuse the bomb!');
      }
    } else {
      await this.showRegularBombNotification('💣 Bomb Planted!', 'Counter-terrorists must defuse the bomb!');
    }

    // Always vibrate the device
    this.vibrate(vibrationPattern);
  }

  async showBombDefusedNotification() {
    const hasPermission = await this.requestPermission();
    if (!hasPermission) return;

    const vibrationPattern = [100, 50, 100, 50, 100];

    // Try to use service worker for background notifications
    if (this.serviceWorkerRegistration && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title: '🛡️ Bomb Defused!',
          body: 'Counter-terrorists win the round!',
          vibrate: vibrationPattern
        });
      } catch (error) {
        console.error('Service worker notification failed, using fallback:', error);
        await this.showRegularBombNotification('🛡️ Bomb Defused!', 'Counter-terrorists win the round!');
      }
    } else {
      await this.showRegularBombNotification('🛡️ Bomb Defused!', 'Counter-terrorists win the round!');
    }

    // Always vibrate the device
    this.vibrate(vibrationPattern);
  }

  private async showRegularStartNotification() {
    const notification = new Notification('🎮 Round Started!', {
      body: 'Good luck! Eliminate the enemy team.',
      icon: '/favicon.ico',
      tag: 'round-start',
      requireInteraction: false,
    });

    // Auto-close after 3 seconds
    setTimeout(() => {
      notification.close();
    }, 3000);

    return notification;
  }

  private async showRegularBombNotification(title: string, body: string) {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'bomb-event',
      requireInteraction: true,
    });

    // Handle notification click
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close after 8 seconds
    setTimeout(() => {
      notification.close();
    }, 8000);

    return notification;
  }

  // Vibrate device for important events
  vibrate(pattern: number[]) {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }

  // Play audio notification
  playSound(type: 'win' | 'lose' | 'start') {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const frequencies = {
      win: [523, 659, 784, 1047], // C, E, G, C (victory chord)
      lose: [392, 330, 262], // G, E, C (descending)
      start: [440, 554] // A, C# (alert)
    };

    const freq = frequencies[type];
    
    freq.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'square';
      
      const startTime = audioContext.currentTime + (index * 0.2);
      const endTime = startTime + 0.15;
      
      gainNode.gain.setValueAtTime(0.1, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);
      
      oscillator.start(startTime);
      oscillator.stop(endTime);
    });
  }
}

export const notifications = NotificationService.getInstance();