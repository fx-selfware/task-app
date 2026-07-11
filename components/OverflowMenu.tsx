'use client';

import { useState, useRef, useEffect } from 'react';

export interface MenuItem {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

interface OverflowMenuProps {
  items: MenuItem[];
  variant?: 'bordered' | 'ghost';
  'aria-label'?: string;
}

export function OverflowMenu({ items, variant = 'bordered', 'aria-label': ariaLabel = 'More actions' }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center justify-center rounded-lg px-2 py-1.5 text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${variant === 'bordered' ? 'border border-gray-300 bg-white' : ''}`}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 5v.01M12 12v.01M12 19v.01"
          />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          role="menu"
        >
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`block w-full px-4 py-3 text-left text-sm transition-colors ${
                item.variant === 'danger'
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
