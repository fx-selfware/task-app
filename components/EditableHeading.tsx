'use client';

import { useState } from 'react';

/**
 * The list title, renamed in place. Tapping it is the whole interaction — the
 * rename dialog is gone, which is the same trade the task rows make.
 */
export function EditableHeading({
  value,
  canEdit,
  onSave,
}: {
  value: string;
  canEdit: boolean;
  onSave: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== value) onSave(next);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        aria-label="List name"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        className="w-full bg-transparent text-2xl font-bold tracking-tight text-gray-900 outline-none dark:text-gray-100"
      />
    );
  }

  return (
    <h1
      onClick={canEdit ? () => { setDraft(value); setEditing(true); } : undefined}
      className={`truncate text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 ${canEdit ? 'cursor-text' : ''}`}
    >
      {value}
    </h1>
  );
}
