'use client';

import { useState, useRef } from 'react';

interface ComposerProps {
  /** Placeholder and accessible name — they are the same string by design. */
  label: string;
  onSubmit: (value: { title: string; description: string }) => void;
  /** Offer the progressive description line. Lists and templates don't need it. */
  withDescription?: boolean;
  disabled?: boolean;
}

/**
 * The always-live capture field, docked at the foot of a list.
 *
 * It replaces the FAB + modal: type, press Return, and the row is already in
 * the list with the field still focused for the next one. The description
 * input only exists once there is a title to attach it to, so the fast path
 * (title, Return) never grows a step — and it collapses again on every commit
 * so the next capture starts just as fast.
 */
export function Composer({ label, onSubmit, withDescription = false, disabled = false }: ComposerProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [open, setOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const t = title.trim();
    if (!t) return;
    onSubmit({ title: t, description: description.trim() });
    setTitle('');
    setDescription('');
    setOpen(false);
    // Keep the field focused: rapid-fire capture is the whole point.
    titleRef.current?.focus();
  };

  const onTitleChange = (v: string) => {
    setTitle(v);
    if (!v.trim()) {
      setOpen(false);
      setDescription('');
    }
  };

  return (
    <div className="border-t border-gray-200 bg-gray-50 px-4 pb-3 pt-2.5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-teal-800 text-white"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <input
          ref={titleRef}
          aria-label={label}
          placeholder={label}
          value={title}
          disabled={disabled}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Tab' && !e.shiftKey && withDescription && title.trim()) {
              e.preventDefault();
              setOpen(true);
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-base sm:text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
        />
        {withDescription && title.trim() && !open && (
          <button
            type="button"
            // Keep the caret in the title field when this is pressed.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpen(true)}
            className="shrink-0 whitespace-nowrap rounded px-1 py-1 text-xs font-semibold text-teal-800 dark:text-teal-400"
          >
            + Description
          </button>
        )}
      </div>
      {withDescription && open && (
        <input
          aria-label="Description"
          placeholder="Description (optional)"
          value={description}
          autoFocus
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Tab' && e.shiftKey) {
              e.preventDefault();
              titleRef.current?.focus();
            }
          }}
          className="mt-1 w-full bg-transparent pl-[33px] text-base sm:text-sm text-gray-600 outline-none placeholder:text-gray-400 dark:text-gray-300"
        />
      )}
    </div>
  );
}
