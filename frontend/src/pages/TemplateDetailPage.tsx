import { useState } from 'react';
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
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import {
  useTemplate,
  useRenameTemplate,
  useCreateTemplateTask,
  useUpdateTemplateTask,
  useDeleteTemplateTask,
  useApplyTemplate,
  useMoveTemplateTask,
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
import { SortableParentCard, SortableSubtaskCard, SubtaskDndList } from '../components/SortableCards';
import { MoveTaskModal } from './MoveTaskModal';
import { useToggleSet } from '../hooks/useToggleSet';
import type { TemplateTask } from '../types';
import type { MenuItem } from '../components/OverflowMenu';

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
  const moveTemplateTask = useMoveTemplateTask(id!);
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
  const [collapsedParents, toggleCollapse] = useToggleSet();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<TemplateTask | null>(null);

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
          onDragStart={(event) => setActiveDragId(event.active.id as string)}
          onDragEnd={(event) => { setActiveDragId(null); handleDragEnd(event); }}
          onDragCancel={() => setActiveDragId(null)}
        >
          <SortableContext
            items={tasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {tasks.map((task) => {
                const subtasks = task.subtasks ?? [];
                const hasSubtasks = subtasks.length > 0;
                const collapsed = collapsedParents.has(task.id);

                const parentMenu: MenuItem[] = [
                  { label: 'Add subtask', onClick: () => openAddSubtask(task.id) },
                  ...(!hasSubtasks
                    ? [{ label: 'Move under...', onClick: () => setMoveTarget(task) }]
                    : []),
                  { label: 'Delete', onClick: () => setDeleteTarget(task), variant: 'danger' as const },
                ];

                return (
                  <div key={task.id}>
                    <SortableParentCard
                      id={task.id}
                      title={task.title}
                      description={task.description}
                      canWrite={canWrite}
                      hasSubtasks={hasSubtasks}
                      collapsed={collapsed}
                      onToggleCollapse={() => toggleCollapse(task.id)}
                      onEdit={() => openEdit(task)}
                      menuItems={parentMenu}
                    />
                    {hasSubtasks && !collapsed && (
                      <div
                        className="ml-8 mt-1 space-y-1"
                        style={activeDragId ? { opacity: 0.3, pointerEvents: 'none' } : undefined}
                      >
                        <SubtaskDndList
                          items={subtasks}
                          sensors={sensors}
                          onReorder={async (ids) => {
                            await reorderTasks.mutateAsync({ orderedIds: ids, parentId: task.id });
                          }}
                          renderItem={(sub) => (
                            <SortableSubtaskCard
                              key={sub.id}
                              id={sub.id}
                              title={sub.title}
                              description={sub.description}
                              canWrite={canWrite}
                              onEdit={() => openEdit(sub)}
                              menuItems={[
                                { label: 'Move to top level', onClick: () => moveTemplateTask.mutate({ taskId: sub.id, parentId: null }) },
                                { label: 'Delete', onClick: () => setDeleteTarget(sub), variant: 'danger' as const },
                              ]}
                            />
                          )}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeDragId && (() => {
              const t = tasks.find((x) => x.id === activeDragId);
              if (!t) return null;
              return (
                <div className="flex items-center gap-3 rounded-lg border bg-white p-3 shadow-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{t.title}</p>
                    {t.description && (
                      <p className="mt-0.5 text-sm text-gray-500">{t.description}</p>
                    )}
                  </div>
                </div>
              );
            })()}
          </DragOverlay>
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

      {/* Move task modal */}
      <MoveTaskModal
        open={!!moveTarget}
        onClose={() => setMoveTarget(null)}
        eligibleParents={
          moveTarget
            ? tasks.filter((t) => t.id !== moveTarget.id)
            : []
        }
        onSelect={async (parentId) => {
          if (moveTarget) {
            await moveTemplateTask.mutateAsync({ taskId: moveTarget.id, parentId });
            setMoveTarget(null);
          }
        }}
        loading={moveTemplateTask.isPending}
      />

      {/* Shares modal */}
      <TemplateSharesModal
        open={showShares}
        onClose={() => setShowShares(false)}
        templateId={id!}
      />
    </div>
  );
}
