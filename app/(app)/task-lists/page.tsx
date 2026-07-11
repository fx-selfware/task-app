'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTaskLists, useCreateTaskList, useDeleteTaskList } from '@/hooks/useTaskLists';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Spinner } from '@/components/Spinner';
import type { TaskListSummary } from '@/types';

export default function TaskListsPage() {
  const { data, isLoading } = useTaskLists();
  const createList = useCreateTaskList();
  const deleteList = useDeleteTaskList();

  const [showCreate, setShowCreate] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [createError, setCreateError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<TaskListSummary | null>(null);

  const owned = data?.owned ?? [];
  const shared = data?.shared ?? [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    try {
      await createList.mutateAsync(newListName);
      setNewListName('');
      setShowCreate(false);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create list');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteList.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  if (isLoading) return <Spinner className="mt-8" />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Task Lists</h1>
        <Button onClick={() => setShowCreate(true)}>+ New List</Button>
      </div>

      {owned.length === 0 && shared.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 sm:p-12 text-center">
          <p className="text-gray-500">No task lists yet. Create one to get started!</p>
        </div>
      )}

      {owned.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
            My Lists
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {owned.map((list) => (
              <ListCard
                key={list.id}
                list={list}
                onDelete={() => setDeleteTarget(list)}
              />
            ))}
          </div>
        </section>
      )}

      {shared.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
            Shared with Me
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shared.map((list) => (
              <ListCard key={list.id} list={list} />
            ))}
          </div>
        </section>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Task List">
        <form onSubmit={handleCreate} className="space-y-4">
          {createError && (
            <p className="text-sm text-red-600">{createError}</p>
          )}
          <Input
            label="List name"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            required
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)} type="button">
              Cancel
            </Button>
            <Button type="submit" loading={createList.isPending}>
              Create
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete List"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This will also delete all tasks.`}
        loading={deleteList.isPending}
      />
    </div>
  );
}

function ListCard({
  list,
  onDelete,
}: {
  list: TaskListSummary;
  onDelete?: () => void;
}) {
  return (
    <div className="group relative rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <Link href={`/task-lists/${list.id}`} className="block">
        <h3 className="font-semibold text-gray-900">{list.name}</h3>
        <p className="mt-1 text-sm text-gray-500">
          {list._count?.tasks ?? 0} task{(list._count?.tasks ?? 0) !== 1 ? 's' : ''}
        </p>
        {list.role === 'shared' && (
          <span className="mt-2 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            {list.permission?.toLowerCase()}
          </span>
        )}
      </Link>
      {onDelete && (
        <button
          onClick={onDelete}
          className="absolute right-2 top-2 rounded p-2 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100 hover:text-red-500"
          aria-label="Delete list"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
