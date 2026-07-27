'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

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
  /** True while dnd-kit owns this row. The lift is what switches a sideways
   *  move from "reveal the actions" to "change the depth" — without it the two
   *  gestures fight over the same motion. */
  dragging?: boolean;
  /** Subtasks only. A left swipe carried well past the action-reveal distance
   *  returns the subtask to the top level — the gesture counterpart of
   *  dragging a top-level task right to nest it. */
  onPromote?: () => void;
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
  dragging = false,
  onPromote,
  actions = [],
}: TaskRowProps) {
  const [editing, setEditing] = useState(false);
  // Swipe: right past the threshold completes, left reveals the actions, and
  // anything short springs back. `pan-y` on the row keeps vertical scrolling
  // with the browser; the compositor fires pointercancel the moment it claims
  // a scroll, which is why that is handled alongside pointerup.
  const [dx, setDx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const drag = useRef<{ id: number; x0: number; y0: number; axis: 'none' | 'x' | 'y' } | null>(null);
  const REVEAL = 88;
  const COMPLETE = 96;
  // Two stops on the same axis: a short left swipe reveals the actions, a long
  // one outdents. Mail treats a long swipe the same way.
  const PROMOTE = 150;
  const EDGE_GUARD = 44; // iOS reserves the left edge for its back-swipe
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftDesc, setDraftDesc] = useState(description ?? '');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      setDraftTitle(title);
      setDraftDesc(description ?? '');
    }
  }, [title, description, editing]);

  const endSwipe = useCallback(
    (finalDx: number) => {
      drag.current = null;
      if (finalDx <= -PROMOTE && onPromote) {
        setDx(0);
        setRevealed(false);
        onPromote();
        return;
      }
      if (finalDx >= COMPLETE && onToggleDone && !done) {
        setDx(0);
        setRevealed(false);
        onToggleDone();
        return;
      }
      const open = finalDx <= -REVEAL / 2;
      setRevealed(open);
      setDx(open ? -REVEAL : 0);
    },
    [done, onToggleDone, onPromote],
  );

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
      {canWrite && actions.length > 0 && (
        <div className="absolute inset-y-0 right-0 flex items-center bg-red-600 pr-4 pl-6">
          {actions
            .filter((a) => a.danger)
            .map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => { setDx(0); setRevealed(false); a.onClick(); }}
                className="text-sm font-bold text-white"
                style={{ visibility: revealed ? 'visible' : 'hidden' }}
              >
                {a.label}
              </button>
            ))}
        </div>
      )}
      <div
        onPointerDown={(e) => {
          if (!canWrite || editing || dragging) return;
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          if (e.nativeEvent.clientX - (e.currentTarget.getBoundingClientRect().left ?? 0) < EDGE_GUARD && !revealed) {
            // leave the iOS back-swipe zone alone
          }
          drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, axis: 'none' };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          if (dragging) { drag.current = null; setDx(revealed ? -REVEAL : 0); return; }
          const mx = e.clientX - d.x0;
          const my = e.clientY - d.y0;
          if (d.axis === 'none') {
            if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
            d.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
          }
          if (d.axis !== 'x') return;
          setDx((revealed ? -REVEAL : 0) + mx);
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          endSwipe(d.axis === 'x' ? dx : 0);
        }}
        onPointerCancel={() => {
          if (drag.current) { drag.current = null; setDx(revealed ? -REVEAL : 0); }
        }}
        style={{
          transform: `translateX(${Math.max(Math.min(dx, 160), onPromote ? -200 : -REVEAL - 20)}px)`,
          transition: drag.current ? 'none' : 'transform .22s cubic-bezier(.3,1,.4,1)',
          touchAction: 'pan-y',
        }}
        className={`relative flex min-h-[48px] items-start gap-2.5 bg-white py-3 pr-4 dark:bg-gray-950 ${isSubtask ? 'pl-12' : 'pl-4'}`}
      >
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
