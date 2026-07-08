/* global firebase */
// Web FCM service worker. Native Capacitor push uses APNs/FCM via @capacitor/push-notifications instead.
// TODO(push): keep this Firebase config in sync with src/firebase/client.js when Firebase apps change.
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAjjR2yJwmwGeOMjxr_jGumpkchXpFzmcQ',
  authDomain: 'my-mathplanner-project.firebaseapp.com',
  projectId: 'my-mathplanner-project',
  storageBucket: 'my-mathplanner-project.firebasestorage.app',
  messagingSenderId: '197602408828',
  appId: '1:197602408828:web:c0eae7df35a06fbe070cf9',
  measurementId: 'G-ZH2BMBYE86',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(() => {
  self.registration.showNotification('채수용 수학', {
    body: '새 알림이 있습니다.',
    data: { url: '/home?tab=notifications' },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/home?tab=notifications'));
});
