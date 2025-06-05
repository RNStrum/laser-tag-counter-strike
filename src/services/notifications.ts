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
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  async showRoundEndNotification(winner: string, reason: string, _teamColors: { bg: string; text: string }) {
    const hasPermission = await this.requestPermission();
    if (!hasPermission) return;

    const winnerText = winner === 'draw' ? 'Draw!' : 
                      winner === 'terrorist' ? '🔥 Terrorists Win!' : 
                      '🛡️ Counter-Terrorists Win!';

    const vibrationPattern = winner === 'draw' ? [200, 100, 200] :
                           [200, 100, 200, 100, 200]; // Victory pattern

    // Try to use service worker for background notifications
    if (this.serviceWorkerRegistration) {
      try {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            title: winnerText,
            body: reason,
            vibrate: vibrationPattern
          });
        } else {
          // Fallback to regular notification if service worker not ready
          await this.showRegularNotification(winnerText, reason, vibrationPattern);
        }
      } catch (error) {
        console.error('Service worker notification failed, using fallback:', error);
        await this.showRegularNotification(winnerText, reason, vibrationPattern);
      }
    } else {
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