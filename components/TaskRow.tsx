'use client';

import { useState, useRef, useEffect } from 'react';

export interface TaskRowProps {
  id: string;
  title: string;
  description?: string | null;
  done?: boolean;
  /** Nested one level. The data model caps nesting here, so this is a boolean. */
  isSubtask?: boolean;
  canWrite: boolean;
  /** Number of subtasks; doubles as the collapse toggle. Undefined = no children. */
  subtaskCount?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onToggleDone?: () => void;
  onSave?: (value: { title: string; description: string | null }) => void;
  /** Rendered inside the row's action bar while editing. */
  actions?: { label: string; onClick: () => void; danger?: boolean }[];
}

/**
 * One task, as a row in a grouped list rather than a card.
 *
 * Three things the old card did with three separate controls, this does with
 * two: the circle completes (44px target, not the old 20px checkbox), and the
 * text opens the row for editing in place — which is also where the action
 * list lives, so the always-visible overflow menu is gone.
 */
export function TaskRow({
  title,
  description,
  done = false,
  isSubtask = false,
  canWrite,
  subtaskCount,
  collapsed,
  onToggleCollapse,
  onToggleDone,
  onSave,
  actions = [],
}: TaskRowProps) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftDesc, setDraftDesc] = useState(description ?? '');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      setDraftTitle(title);
      setDraftDesc(description ?? '');
    }
  }, [title, description, editing]);

  const commit = () => {
    const t = draftTitle.trim();
    if (t && (t !== title || draftDesc.trim() !== (description ?? '').trim())) {
      onSave?.({ title: t, description: draftDesc.trim() || null });
    }
    setEditing(false);
  };

  return (
    <div
      data-testid="task-row"
      data-task-title={title}
      data-subtask={isSubtask ? 'true' : undefined}
      className={`relative border-t border-gray-200 first:border-t-0 dark:border-gray-800 ${
        editing ? 'bg-white dark:bg-gray-900' : ''
      }`}
    >
      <div className={`flex min-h-[48px] items-start gap-2.5 py-3 pr-4 ${isSubtask ? 'pl-12' : 'pl-4'}`}>
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? `Mark "${title}" as todo` : `Mark "${title}" as done`}
          disabled={!canWrite}
          onClick={onToggleDone}
          className="-ml-2.5 -mt-2.5 -mb-2.5 flex h-11 w-11 shrink-0 items-center justify-center disabled:opacity-60"
        >
          <span
            className={`block h-[21px] w-[21px] rounded-full border-[1.6px] transition-colors ${
              done ? 'border-teal-800 bg-teal-800' : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            {done && (
              <svg viewBox="0 0 24 24" className="h-full w-full p-[3px] text-white" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l5 5 9-10" />
              </svg>
            )}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          {editing ? (
            <>
              <input
                ref={titleRef}
                aria-label="Task title"
                value={draftTitle}
                autoFocus
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commit(); }
                  if (e.key === 'Escape') { setEditing(false); }
                }}
                className="w-full bg-transparent text-base sm:text-[15px] font-medium text-gray-900 outline-none dark:text-gray-100"
              />
              <input
                aria-label="Task description"
                placeholder="Add a description"
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commit(); }
                  if (e.key === 'Escape') { setEditing(false); }
                }}
                className="mt-0.5 w-full bg-transparent text-base sm:text-[13px] text-gray-500 outline-none placeholder:text-gray-400 dark:text-gray-400"
              />
            </>
          ) : (
            <div
              data-testid="task-title"
              onClick={canWrite && !done ? () => setEditing(true) : undefined}
              className={`${canWrite && !done ? 'cursor-text' : ''} ${isSubtask ? 'text-[15px]' : 'text-[16px]'} leading-snug ${
                done ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'
              }`}
            >
              {title}
              {description && (
                <span className="mt-0.5 block text-[13px] leading-snug text-gray-500 dark:text-gray-400">
                  {description}
                </span>
              )}
            </div>
          )}
        </div>

        {!editing && subtaskCount !== undefined && subtaskCount > 0 && (
          <button
            type="button"
            aria-label={collapsed ? `Expand subtasks of "${title}"` : `Collapse subtasks of "${title}"`}
            onClick={onToggleCollapse}
            className="mt-0.5 shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            {subtaskCount}
          </button>
        )}
      </div>

      {editing && (
        <div className="flex items-center gap-3 pb-2.5 pl-[74px] pr-4 text-xs font-semibold">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setEditing(false); a.onClick(); }}
              className={a.danger ? 'text-red-600' : 'text-teal-800 dark:text-teal-400'}
            >
              {a.label}
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={commit}
            className="ml-auto text-gray-500 dark:text-gray-400"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
