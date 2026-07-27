'use client';

import { useState, useEffect } from 'react';
import { TaskRow } from './TaskRow';
import type { Task } from '@/types';

interface CompletedGroupProps {
  count: number;
  groups: { parent: Task; parentMode: 'completed' | 'readonly-header'; completedSubtasks: Task[] }[];
  canWrite: boolean;
  onUncheck: (taskId: string) => void;
  onClear: () => void;
}

/**
 * Completed work, collapsed to one quiet line.
 *
 * Clear lives on this header rather than in the list's ⋯ menu, so the control
 * sits next to the thing it destroys and comes and goes with the group it acts
 * on. The confirm is inline, in place of the row — the question appears exactly
 * where the answer lands. It is the one bulk, unbounded action in the app, which
 * is why it still asks at all.
 */
export function CompletedGroup({ count, groups, canWrite, onUncheck, onClear }: CompletedGroupProps) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (count === 0) {
      setOpen(false);
      setConfirming(false);
    }
  }, [count]);

  if (count === 0) return null;

  return (
    <div data-testid="completed-group" className="mt-2">
      <div className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-500">
        <span data-testid="completed-count" className="font-semibold text-gray-600 dark:text-gray-300">
          {count} completed
        </span>
        <button
          type="button"
          onClick={() => { setOpen((v) => !v); setConfirming(false); }}
          className="font-semibold text-teal-800 dark:text-teal-400"
        >
          {open ? 'Hide' : 'Show'}
        </button>
        {open && canWrite && (
          <button type="button" onClick={() => setConfirming(true)} className="ml-auto font-semibold text-red-600">
            Clear
          </button>
        )}
      </div>

      {confirming && (
        <div className="mx-3 mb-1 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm font-medium text-red-900 dark:bg-red-950 dark:text-red-200">
          <span>Delete {count} completed?</span>
          <button type="button" onClick={() => setConfirming(false)} className="ml-auto font-bold text-gray-600 dark:text-gray-300">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { setConfirming(false); onClear(); }}
            className="font-bold text-red-600"
          >
            Delete
          </button>
        </div>
      )}

      {open && (
        <div>
          {groups.map((g) => (
            <div key={g.parent.id}>
              {g.parentMode === 'completed' ? (
                <TaskRow
                  id={g.parent.id}
                  title={g.parent.title}
                  description={g.parent.description}
                  done
                  canWrite={canWrite}
                  onToggleDone={() => onUncheck(g.parent.id)}
                />
              ) : (
                <p
                  data-testid="readonly-parent-header"
                  className="border-t border-gray-200 px-4 pb-1 pt-3 text-[13px] text-gray-400 dark:border-gray-800"
                >
                  {g.parent.title}
                </p>
              )}
              {g.completedSubtasks
                .filter((s) => s.status === 'DONE')
                .map((sub) => (
                  <TaskRow
                    key={sub.id}
                    id={sub.id}
                    title={sub.title}
                    description={sub.description}
                    done
                    isSubtask
                    canWrite={canWrite}
                    onToggleDone={() => onUncheck(sub.id)}
                  />
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
