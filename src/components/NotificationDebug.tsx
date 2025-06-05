import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, CheckCircle, X } from 'lucide-react';

export function NotificationDebug() {
  const [showDebug, setShowDebug] = useState(false);
  const [notificationInfo, setNotificationInfo] = useState<{
    permission: string;
    serviceWorkerSupport: boolean;
    serviceWorkerActive: boolean;
    isStandalone: boolean;
    userAgent: string;
  } | null>(null);

  useEffect(() => {
    const checkNotificationStatus = () => {
      const permission = Notification.permission;
      const serviceWorkerSupport = 'serviceWorker' in navigator;
      const serviceWorkerActive = !!navigator.serviceWorker?.controller;
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         (window.navigator as any).standalone ||
                         document.referrer.includes('android-app://');
      const userAgent = navigator.userAgent;

      setNotificationInfo({
        permission,
        serviceWorkerSupport,
        serviceWorkerActive,
        isStandalone,
        userAgent
      });
    };

    checkNotificationStatus();
    
    // Update when service worker changes
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', checkNotificationStatus);
      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', checkNotificationStatus);
      };
    }
  }, []);

  if (!showDebug) {
    return (
      <button
        className="fixed top-4 right-4 btn btn-ghost btn-sm z-40"
        onClick={() => setShowDebug(true)}
        title="Debug Notifications"
      >
        <Bell className="w-4 h-4" />
      </button>
    );
  }

  const testNotification = async () => {
    try {
      if (Notification.permission === 'granted') {
        new Notification('🧪 Test Notification', {
          body: 'This is a test to check if notifications work on your device.',
          icon: '/favicon.ico',
          tag: 'test',
          requireInteraction: false
        });
      } else {
        alert('Notifications not permitted. Please enable them first.');
      }
    } catch (error) {
      console.error('Test notification failed:', error);
      alert('Test notification failed: ' + error);
    }
  };

  return (
    <div className="fixed top-4 right-4 z-40 max-w-sm">
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-sm">Notification Debug</h3>
            <button 
              className="btn btn-ghost btn-xs"
              onClick={() => setShowDebug(false)}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          
          {notificationInfo && (
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                {notificationInfo.permission === 'granted' ? 
                  <CheckCircle className="w-3 h-3 text-success" /> : 
                  <AlertTriangle className="w-3 h-3 text-warning" />
                }
                <span>Permission: {notificationInfo.permission}</span>
              </div>
              
              <div className="flex items-center gap-2">
                {notificationInfo.serviceWorkerSupport ? 
                  <CheckCircle className="w-3 h-3 text-success" /> : 
                  <AlertTriangle className="w-3 h-3 text-error" />
                }
                <span>Service Worker: {notificationInfo.serviceWorkerSupport ? 'Supported' : 'Not Supported'}</span>
              </div>
              
              <div className="flex items-center gap-2">
                {notificationInfo.serviceWorkerActive ? 
                  <CheckCircle className="w-3 h-3 text-success" /> : 
                  <AlertTriangle className="w-3 h-3 text-warning" />
                }
                <span>SW Active: {notificationInfo.serviceWorkerActive ? 'Yes' : 'No'}</span>
              </div>
              
              <div className="flex items-center gap-2">
                {notificationInfo.isStandalone ? 
                  <CheckCircle className="w-3 h-3 text-success" /> : 
                  <AlertTriangle className="w-3 h-3 text-info" />
                }
                <span>Standalone: {notificationInfo.isStandalone ? 'Yes' : 'No'}</span>
              </div>
              
              <div className="text-xs opacity-70 mt-2">
                <strong>Browser:</strong> {notificationInfo.userAgent.includes('Chrome') ? 'Chrome' : 
                                         notificationInfo.userAgent.includes('Firefox') ? 'Firefox' :
                                         notificationInfo.userAgent.includes('Safari') ? 'Safari' : 'Other'}
              </div>
              
              <div className="text-xs opacity-70">
                <strong>Android:</strong> {notificationInfo.userAgent.includes('Android') ? 'Yes' : 'No'}
              </div>
            </div>
          )}
          
          <div className="card-actions justify-end mt-3">
            <button 
              className="btn btn-primary btn-xs"
              onClick={testNotification}
            >
              Test Notification
            </button>
          </div>
          
          <div className="text-xs opacity-70 mt-2">
            <strong>For locked Android phones:</strong> Install the app using "Add to Home Screen" for better background notification support.
          </div>
        </div>
      </div>
    </div>
  );
}