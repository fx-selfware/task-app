import { useState, useId } from 'react';
import { useParams } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  useTemplate,
  useRenameTemplate,
  useCreateTemplateTask,
  useUpdateTemplateTask,
  useDeleteTemplateTask,
  useApplyTemplate,
  useReorderTemplateTasks,
} from '../hooks/useTemplates';
import { useTemplateEvents } from '../hooks/useTemplateEvents';
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
  const reorderTasks = useReorderTemplateTasks(id!);
  const { data: listsData } = useTaskLists();

  useTemplateEvents(id!);

  const [showRename, setShowRename] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [addSubtaskParentId, setAddSubtaskParentId] = useState<string | null>(null);
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
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  if (isLoading) return <Spinner className="mt-8" />;
  if (!template) return <p className="text-gray-500">Template not found.</p>;

  const allLists = [...(listsData?.owned ?? []), ...(listsData?.shared ?? [])].filter(
    (l) => l.role === 'owner' || l.permission === 'WRITE',
  );

  const rawTasks = template.tasks ?? [];
  const tasks = localOrder
    ? localOrder.map((tid) => rawTasks.find((t) => t.id === tid)!).filter(Boolean)
    : rawTasks;

  // Count all tasks including subtasks
  const totalTaskCount = tasks.reduce(
    (sum, t) => sum + 1 + (t.subtasks?.length ?? 0),
    0,
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);
    const newOrder = arrayMove(tasks, oldIndex, newIndex);
    const newIds = newOrder.map((t) => t.id);
    setLocalOrder(newIds);
    await reorderTasks.mutateAsync({ orderedIds: newIds });
    setLocalOrder(null);
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    await renameTemplate.mutateAsync({ id: id!, name: renameName });
    setShowRename(false);
  };

  const openAddTask = () => {
    setAddSubtaskParentId(null);
    setNewTaskTitle('');
    setNewTaskDesc('');
    setShowAddTask(true);
  };

  const openAddSubtask = (parentId: string) => {
    setAddSubtaskParentId(parentId);
    setNewTaskTitle('');
    setNewTaskDesc('');
    setShowAddTask(true);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTask.mutateAsync({
      title: newTaskTitle,
      description: newTaskDesc,
      ...(addSubtaskParentId && { parentId: addSubtaskParentId }),
    });
    setNewTaskTitle('');
    setNewTaskDesc('');
    setShowAddTask(false);
    setAddSubtaskParentId(null);
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

  const toggleCollapse = (taskId: string) => {
    setCollapsedParents((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
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
            {totalTaskCount} task
            {totalTaskCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canWrite && (
            <Button size="sm" onClick={openAddTask}>
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

      {tasks.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 sm:p-12 text-center">
          <p className="text-gray-500">No tasks yet. Add some to make this template useful!</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={tasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {tasks.map((task) => (
                <TemplateTaskWithSubtasks
                  key={task.id}
                  task={task}
                  canWrite={canWrite}
                  sensors={sensors}
                  collapsed={collapsedParents.has(task.id)}
                  onToggleCollapse={() => toggleCollapse(task.id)}
                  onEdit={() => openEdit(task)}
                  onDelete={() => setDeleteTarget(task)}
                  onAddSubtask={() => openAddSubtask(task.id)}
                  onEditSubtask={(sub) => openEdit(sub)}
                  onDeleteSubtask={(sub) => setDeleteTarget(sub)}
                  onReorderSubtasks={async (orderedIds) => {
                    await reorderTasks.mutateAsync({ orderedIds, parentId: task.id });
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
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

      {/* Add task / subtask */}
      <Modal
        open={showAddTask}
        onClose={() => { setShowAddTask(false); setAddSubtaskParentId(null); }}
        title={addSubtaskParentId ? 'Add Subtask' : 'Add Template Task'}
      >
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
            <Button
              variant="secondary"
              onClick={() => { setShowAddTask(false); setAddSubtaskParentId(null); }}
              type="button"
            >
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

function TemplateTaskWithSubtasks({
  task,
  canWrite,
  sensors,
  collapsed,
  onToggleCollapse,
  onEdit,
  onDelete,
  onAddSubtask,
  onEditSubtask,
  onDeleteSubtask,
  onReorderSubtasks,
}: {
  task: TemplateTask;
  canWrite: boolean;
  sensors: ReturnType<typeof useSensors>;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddSubtask: () => void;
  onEditSubtask: (sub: TemplateTask) => void;
  onDeleteSubtask: (sub: TemplateTask) => void;
  onReorderSubtasks: (orderedIds: string[]) => Promise<void>;
}) {
  const subtasks = task.subtasks ?? [];
  const hasSubtasks = subtasks.length > 0;
  const dndId = useId();
  const [localSubOrder, setLocalSubOrder] = useState<string[] | null>(null);

  const orderedSubs = localSubOrder
    ? localSubOrder.map((sid) => subtasks.find((s) => s.id === sid)!).filter(Boolean)
    : subtasks;

  const handleSubDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedSubs.findIndex((s) => s.id === active.id);
    const newIndex = orderedSubs.findIndex((s) => s.id === over.id);
    const newOrder = arrayMove(orderedSubs, oldIndex, newIndex);
    const newIds = newOrder.map((s) => s.id);
    setLocalSubOrder(newIds);
    await onReorderSubtasks(newIds);
    setLocalSubOrder(null);
  };

  return (
    <div>
      <SortableTemplateTaskCard
        task={task}
        canWrite={canWrite}
        hasSubtasks={hasSubtasks}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onEdit={onEdit}
        onDelete={onDelete}
        onAddSubtask={onAddSubtask}
      />
      {hasSubtasks && !collapsed && (
        <div className="ml-8 mt-1 space-y-1">
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleSubDragEnd}
          >
            <SortableContext
              items={orderedSubs.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {orderedSubs.map((sub) => (
                <SortableTemplateSubtaskCard
                  key={sub.id}
                  task={sub}
                  canWrite={canWrite}
                  onEdit={() => onEditSubtask(sub)}
                  onDelete={() => onDeleteSubtask(sub)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
      {!hasSubtasks && canWrite && !collapsed && (
        <div className="ml-8 mt-1">
          <button
            onClick={onAddSubtask}
            className="py-1 text-xs text-gray-400 hover:text-gray-600"
          >
            + Subtask
          </button>
        </div>
      )}
    </div>
  );
}

function SortableTemplateTaskCard({
  task,
  canWrite,
  hasSubtasks,
  collapsed,
  onToggleCollapse,
  onEdit,
  onDelete,
  onAddSubtask,
}: {
  task: TemplateTask;
  canWrite: boolean;
  hasSubtasks: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddSubtask: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled: !canWrite });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-start gap-3 rounded-lg border bg-white p-3 shadow-sm"
    >
      {hasSubtasks && (
        <button
          onClick={onToggleCollapse}
          className="mt-1 p-0.5 text-gray-400 hover:text-gray-600"
          aria-label={collapsed ? 'Expand subtasks' : 'Collapse subtasks'}
        >
          <span className="text-xs">{collapsed ? '▶' : '▼'}</span>
        </button>
      )}
      <div
        className={`flex-1 min-w-0 ${canWrite ? 'cursor-pointer' : ''}`}
        onClick={canWrite ? onEdit : undefined}
      >
        <p className="font-medium text-gray-900">{task.title}</p>
        {task.description && (
          <p className="mt-0.5 text-sm text-gray-500">{task.description}</p>
        )}
      </div>
      {canWrite && hasSubtasks && (
        <button
          onClick={onAddSubtask}
          className="mt-0.5 p-2 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100 hover:text-blue-500"
          aria-label="Add subtask"
          title="Add subtask"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
      {canWrite && (
        <button
          onClick={onDelete}
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
      {canWrite && (
        <button
          {...attributes}
          {...listeners}
          style={{ touchAction: 'none' }}
          className="mt-0.5 p-2 cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8h16M4 16h16"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

function SortableTemplateSubtaskCard({
  task,
  canWrite,
  onEdit,
  onDelete,
}: {
  task: TemplateTask;
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, disabled: !canWrite });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-2.5 shadow-sm"
    >
      <div
        className={`flex-1 min-w-0 ${canWrite ? 'cursor-pointer' : ''}`}
        onClick={canWrite ? onEdit : undefined}
      >
        <p className="text-sm font-medium text-gray-800">{task.title}</p>
        {task.description && (
          <p className="mt-0.5 text-xs text-gray-500">{task.description}</p>
        )}
      </div>
      {canWrite && (
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100 hover:text-red-500"
          aria-label="Delete task"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      )}
      {canWrite && (
        <button
          {...attributes}
          {...listeners}
          style={{ touchAction: 'none' }}
          className="p-1.5 cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8h16M4 16h16"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
