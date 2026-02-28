import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  useTemplate,
  useRenameTemplate,
  useCreateTemplateTask,
  useUpdateTemplateTask,
  useDeleteTemplateTask,
  useApplyTemplate,
} from '../hooks/useTemplates';
import { useTaskLists } from '../hooks/useTaskLists';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Spinner } from '../components/Spinner';
import { TemplateSharesModal } from './TemplateSharesModal';
import { OverflowMenu } from '../components/OverflowMenu';
import type { TemplateTask } from '../types';

export function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useTemplate(id!);
  const template = data?.template;
  const isOwner = data?.isOwner ?? false;
  const permission = data?.permission;
  const canWrite = permission === 'WRITE';

  const renameTemplate = useRenameTemplate();
  const createTask = useCreateTemplateTask(id!);
  const updateTask = useUpdateTemplateTask(id!);
  const deleteTask = useDeleteTemplateTask(id!);
  const applyTemplate = useApplyTemplate();
  const { data: listsData } = useTaskLists();

  const [showRename, setShowRename] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [editingTask, setEditingTask] = useState<TemplateTask | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<TemplateTask | null>(null);
  const [showApply, setShowApply] = useState(false);
  const [applyListId, setApplyListId] = useState('');
  const [applySuccess, setApplySuccess] = useState(false);
  const [showShares, setShowShares] = useState(false);

  if (isLoading) return <Spinner className="mt-8" />;
  if (!template) return <p className="text-gray-500">Template not found.</p>;

  const allLists = [...(listsData?.owned ?? []), ...(listsData?.shared ?? [])].filter(
    (l) => l.role === 'owner' || l.permission === 'WRITE',
  );

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    await renameTemplate.mutateAsync({ id: id!, name: renameName });
    setShowRename(false);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTask.mutateAsync({ title: newTaskTitle, description: newTaskDesc });
    setNewTaskTitle('');
    setNewTaskDesc('');
    setShowAddTask(false);
  };

  const openEdit = (task: TemplateTask) => {
    setEditTitle(task.title);
    setEditDesc(task.description ?? '');
    setEditingTask(task);
  };

  const handleEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    await updateTask.mutateAsync({
      taskId: editingTask.id,
      data: { title: editTitle, description: editDesc.trim() },
    });
    setEditingTask(null);
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    await applyTemplate.mutateAsync({ templateId: id!, taskListId: applyListId });
    setApplySuccess(true);
    setTimeout(() => {
      setShowApply(false);
      setApplySuccess(false);
      setApplyListId('');
    }, 1500);
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="truncate text-2xl font-bold text-gray-900">{template.name}</h1>
            {!isOwner && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                shared
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {template.tasks?.length ?? 0} task
            {(template.tasks?.length ?? 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canWrite && (
            <Button size="sm" onClick={() => setShowAddTask(true)}>
              + Task
            </Button>
          )}
          <OverflowMenu
            aria-label="Template actions"
            items={[
              { label: 'Apply', onClick: () => setShowApply(true) },
              ...(isOwner ? [{ label: 'Share', onClick: () => setShowShares(true) }] : []),
              ...(canWrite ? [
                { label: 'Rename', onClick: () => { setRenameName(template.name); setShowRename(true); } },
              ] : []),
            ]}
          />
        </div>
      </div>

      {(template.tasks ?? []).length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 sm:p-12 text-center">
          <p className="text-gray-500">No tasks yet. Add some to make this template useful!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(template.tasks ?? []).map((task) => (
            <div
              key={task.id}
              className="group flex items-start gap-3 rounded-lg border bg-white p-3 shadow-sm"
            >
              <div
                className={`flex-1 min-w-0 ${canWrite ? 'cursor-pointer' : ''}`}
                onClick={canWrite ? () => openEdit(task) : undefined}
              >
                <p className="font-medium text-gray-900">{task.title}</p>
                {task.description && (
                  <p className="mt-0.5 text-sm text-gray-500">{task.description}</p>
                )}
              </div>
              {canWrite && (
                <button
                  onClick={() => setDeleteTarget(task)}
                  className="mt-0.5 p-2 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100 hover:text-red-500"
                  aria-label="Delete task"
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
          ))}
        </div>
      )}

      {/* Rename */}
      <Modal open={showRename} onClose={() => setShowRename(false)} title="Rename Template">
        <form onSubmit={handleRename} className="space-y-4">
          <Input
            label="Name"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            required
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowRename(false)} type="button">
              Cancel
            </Button>
            <Button type="submit" loading={renameTemplate.isPending}>
              Rename
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add task */}
      <Modal open={showAddTask} onClose={() => setShowAddTask(false)} title="Add Template Task">
        <form onSubmit={handleAddTask} className="space-y-4">
          <Input
            label="Title"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).form?.requestSubmit();
              }
            }}
            enterKeyHint="done"
            required
            autoFocus
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Description (optional)
            </label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={newTaskDesc}
              onChange={(e) => setNewTaskDesc(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowAddTask(false)} type="button">
              Cancel
            </Button>
            <Button type="submit" loading={createTask.isPending}>
              Add
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit task */}
      <Modal open={!!editingTask} onClose={() => setEditingTask(null)} title="Edit Task">
        <form onSubmit={handleEditTask} className="space-y-4">
          <Input
            label="Title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).form?.requestSubmit();
              }
            }}
            enterKeyHint="done"
            required
            autoFocus
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Description (optional)
            </label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditingTask(null)} type="button">
              Cancel
            </Button>
            <Button type="submit" loading={updateTask.isPending}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete task */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteTask.mutateAsync(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        title="Delete Task"
        message={`Delete "${deleteTarget?.title}"?`}
        loading={deleteTask.isPending}
      />

      {/* Apply to list */}
      <Modal open={showApply} onClose={() => setShowApply(false)} title="Apply Template">
        <form onSubmit={handleApply} className="space-y-4">
          {applySuccess ? (
            <p className="text-sm font-medium text-green-600">Tasks added successfully!</p>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Target list
                </label>
                <select
                  value={applyListId}
                  onChange={(e) => setApplyListId(e.target.value)}
                  required
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a list...</option>
                  {allLists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowApply(false)}
                  type="button"
                >
                  Cancel
                </Button>
                <Button type="submit" loading={applyTemplate.isPending}>
                  Apply
                </Button>
              </div>
            </>
          )}
        </form>
      </Modal>

      {/* Shares modal */}
      <TemplateSharesModal
        open={showShares}
        onClose={() => setShowShares(false)}
        templateId={id!}
      />
    </div>
  );
}
