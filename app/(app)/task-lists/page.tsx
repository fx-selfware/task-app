'use client';

import { useState } from 'react';
import { createId } from '@paralleldrive/cuid2';
import Link from 'next/link';
import { useTaskLists, useCreateTaskList, useDeleteTaskList } from '@/hooks/useTaskLists';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Spinner } from '@/components/Spinner';
import { Composer } from '@/components/Composer';
import type { TaskListSummary } from '@/types';

/**
 * Rows, not a card grid.
 *
 * The grid was a desktop layout shown one column wide on a phone — a border and
 * a shadow around each name, three lists to a screen. Rows roughly double what
 * fits and match the screen you land on when you tap one.
 */
export default function TaskListsPage() {
  const { data, isLoading } = useTaskLists();
  const createList = useCreateTaskList();
  const deleteList = useDeleteTaskList();
  const [deleteTarget, setDeleteTarget] = useState<TaskListSummary | null>(null);

  const owned = data?.owned ?? [];
  const shared = data?.shared ?? [];

  if (isLoading) return <Spinner className="mt-8" />;

  const row = (list: TaskListSummary, canDelete: boolean) => {
    const count = list._count?.tasks ?? 0;
    return (
      <div key={list.id} className="relative border-t border-gray-200 dark:border-gray-800">
        <Link
          href={`/task-lists/${list.id}`}
          data-testid="list-link"
          data-list-name={list.name}
          className="flex min-h-[56px] items-center gap-3 py-3 pl-4 pr-3"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] leading-snug text-gray-900 dark:text-gray-100">
              {list.name}
            </span>
            <span className="mt-0.5 block truncate text-[13px] text-gray-500">
              {count === 0 ? 'Empty' : `${count} task${count === 1 ? '' : 's'}`}
              {list.role === 'shared' && ` · ${list.permission === 'WRITE' ? 'can edit' : 'can view'}`}
            </span>
          </span>
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 5.5l6.5 6.5L10 18.5" />
          </svg>
        </Link>
        {canDelete && (
          <button
            onClick={() => setDeleteTarget(list)}
            aria-label={`Delete ${list.name}`}
            className="absolute right-8 top-1/2 -translate-y-1/2 p-2 text-gray-300 opacity-0 transition-opacity hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      <h1 className="px-4 pb-2 pt-3 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Lists</h1>

      <div className="flex-1 overflow-y-auto">
        {owned.length === 0 && shared.length === 0 && (
          <p className="px-4 py-10 text-center text-gray-500">No lists yet. Add one below.</p>
        )}
        <div className="group">{owned.map((l) => row(l, true))}</div>
        {shared.length > 0 && (
          <>
            <p className="px-4 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Shared with me
            </p>
            <div className="group">{shared.map((l) => row(l, false))}</div>
          </>
        )}

        <Composer
          label="New list"
          onSubmit={({ title }) => createList.mutate({ name: title, id: createId() })}
        />
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteList.mutateAsync(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        title="Delete List"
        message={`Delete "${deleteTarget?.name}"? This deletes its tasks too.`}
        loading={deleteList.isPending}
      />
    </div>
  );
}
