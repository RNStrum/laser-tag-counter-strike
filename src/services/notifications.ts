// Notification service for mobile push notifications
export class NotificationService {
  private static instance: NotificationService;
  
  static getInstance(): NotificationService {
    if (!this.instance) {
      this.instance = new NotificationService();
    }
    return this.instance;
  }

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

  async showRoundEndNotification(winner: string, reason: string, teamColors: { bg: string; text: string }) {
    const hasPermission = await this.requestPermission();
    if (!hasPermission) return;

    const winnerText = winner === 'draw' ? 'Draw!' : 
                      winner === 'terrorist' ? '🔥 Terrorists Win!' : 
                      '🛡️ Counter-Terrorists Win!';

    const notification = new Notification(winnerText, {
      body: reason,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [200, 100, 200, 100, 200], // Victory vibration pattern
      tag: 'round-end', // Replace previous notifications
      requireInteraction: true, // Keep notification visible
      actions: [
        {
          action: 'view',
          title: 'View Results'
        }
      ]
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

    const notification = new Notification('🎮 Round Started!', {
      body: 'Good luck! Eliminate the enemy team.',
      icon: '/favicon.ico',
      vibrate: [100, 50, 100], // Start vibration pattern
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