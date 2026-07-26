'use client';

import { useCallback, useEffect, useState } from 'react';

type Listener = (message: string) => void;

const listeners = new Set<Listener>();

/**
 * Optimistic writes roll back silently on failure, which reads as the app
 * losing your edit. Every mutation error goes through here instead — wired
 * once in Providers via the query client's MutationCache.
 */
export function showErrorToast(message: string): void {
  for (const listener of listeners) listener(message);
}

const DISMISS_AFTER_MS = 6000;

export function Toaster() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const listener: Listener = (next) => setMessage(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), DISMISS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [message]);

  const dismiss = useCallback(() => setMessage(null), []);

  if (!message) return null;

  return (
    <div
      data-testid="error-toast"
      role="status"
      aria-live="polite"
      // Clears the floating add button on small screens.
      className="fixed inset-x-4 bottom-24 z-50 flex items-start gap-3 rounded-lg bg-red-600 px-4 py-3 text-sm text-white shadow-lg sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm"
    >
      <span className="flex-1">{message}</span>
      <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 text-white/80 hover:text-white">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
