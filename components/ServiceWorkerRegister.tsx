'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Installability/offline support is a progressive enhancement — a
      // failed registration shouldn't block the app from working.
    });
  }, []);

  return null;
}
