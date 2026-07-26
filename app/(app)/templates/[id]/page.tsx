'use client';

import { useState, useLayoutEffect, useRef } from 'react';
import { createId } from '@paralleldrive/cuid2';
import { useParams } from 'next/navigation';
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
} from '@/hooks/useTemplates';
import { useTemplateEvents } from '@/hooks/useTemplateEvents';
import { useTaskLists } from '@/hooks/useTaskLists';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { NameFormModal, TaskFormModal } from '@/components/TaskFormModal';
import { Spinner } from '@/components/Spinner';
import { TemplateSharesModal } from '@/components/TemplateSharesModal';
import { FloatingAddButton } from '@/components/FloatingAddButton';
import { OverflowMenu } from '@/components/OverflowMenu';
import { SortableParentCard, SortableSubtaskCard, SubtaskDndList } from '@/components/SortableCards';
import { MoveTaskModal } from '@/components/MoveTaskModal';
import { useToggleSet } from '@/hooks/useToggleSet';
import type { TemplateTask } from '@/types';
import type { MenuItem } from '@/components/OverflowMenu';

export default function TemplateDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id as string;
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
  const [showAddTask, setShowAddTask] = useState(false);
  const [addSubtaskParentId, setAddSubtaskParentId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<TemplateTask | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TemplateTask | null>(null);
  const [showApply, setShowApply] = useState(false);
  const [applyListId, setApplyListId] = useState('');
  const [showShares, setShowShares] = useState(false);
  const [collapsedParents, toggleCollapse] = useToggleSet();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const preCollapseTopRef = useRef(0);
  const [dragYOffset, setDragYOffset] = useState(0);
  const [moveTarget, setMoveTarget] = useState<TemplateTask | null>(null);

  useLayoutEffect(() => {
    if (!activeDragId) { setDragYOffset(0); return; }
    const el = document.querySelector(`[data-sortable-id="${activeDragId}"]`);
    if (el) setDragYOffset(preCollapseTopRef.current - el.getBoundingClientRect().top);
  }, [activeDragId]);

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

  const tasks = template.tasks ?? [];

  const totalTaskCount = tasks.reduce(
    (sum, t) => sum + 1 + (t.subtasks?.length ?? 0),
    0,
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);
    const newIds = arrayMove(tasks, oldIndex, newIndex).map((t) => t.id);
    reorderTasks.mutate({ orderedIds: newIds });
  };

  const handleRename = (name: string) => {
    renameTemplate.mutate({ id: id!, name });
    setShowRename(false);
  };

  const openAddTask = () => {
    setAddSubtaskParentId(null);
    setShowAddTask(true);
  };

  const openAddSubtask = (parentId: string) => {
    setAddSubtaskParentId(parentId);
    setShowAddTask(true);
  };

  const closeAddTask = () => {
    setShowAddTask(false);
    setAddSubtaskParentId(null);
  };

  const handleAddTask = ({ title, description }: { title: string; description: string }) => {
    createTask.mutate({
      id: createId(),
      title,
      description,
      ...(addSubtaskParentId && { parentId: addSubtaskParentId }),
    });
    closeAddTask();
  };

  const openEdit = (task: TemplateTask) => setEditingTask(task);

  const handleEditTask = ({ title, description }: { title: string; description: string }) => {
    if (!editingTask) return;
    updateTask.mutate({
      taskId: editingTask.id,
      data: { title, description: description.trim() },
    });
    setEditingTask(null);
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    await applyTemplate.mutateAsync({ templateId: id!, taskListId: applyListId });
    setShowApply(false);
    setApplyListId('');
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
          <OverflowMenu
            aria-label="Template actions"
            items={[
              { label: 'Apply', onClick: () => setShowApply(true) },
              ...(isOwner ? [{ label: 'Share', onClick: () => setShowShares(true) }] : []),
              ...(canWrite ? [
                { label: 'Rename', onClick: () => setShowRename(true) },
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
          onDragStart={(event) => {
            const el = document.querySelector(`[data-sortable-id="${event.active.id}"]`);
            preCollapseTopRef.current = el?.getBoundingClientRect().top ?? 0;
            setActiveDragId(event.active.id as string);
          }}
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
                    {hasSubtasks && !collapsed && !activeDragId && (
                      <div className="ml-8 mt-1 space-y-1">
                        <SubtaskDndList
                          items={subtasks}
                          sensors={sensors}
                          onReorder={(ids) => reorderTasks.mutate({ orderedIds: ids, parentId: task.id })}
                          renderItem={(sub) => (
                            <SortableSubtaskCard
                              key={sub.id}
                              id={sub.id}
                              title={sub.title}
                              description={sub.description}
                              canWrite={canWrite}
                              onEdit={() => openEdit(sub)}
                              menuItems={[
                                { label: 'Move under...', onClick: () => setMoveTarget(sub) },
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
                <div style={dragYOffset ? { transform: `translateY(${dragYOffset}px)` } : undefined} className="flex items-center gap-3 rounded-lg border bg-white p-3 shadow-lg">
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

      <NameFormModal
        open={showRename}
        heading="Rename Template"
        label="Name"
        submitLabel="Rename"
        initialName={template.name}
        loading={renameTemplate.isPending}
        onClose={() => setShowRename(false)}
        onSubmit={handleRename}
      />

      <TaskFormModal
        open={showAddTask}
        heading={addSubtaskParentId ? 'Add Subtask' : 'Add Template Task'}
        submitLabel="Add"
        loading={createTask.isPending}
        onClose={closeAddTask}
        onSubmit={handleAddTask}
      />

      <TaskFormModal
        open={!!editingTask}
        heading="Edit Task"
        submitLabel="Save"
        initialTitle={editingTask?.title}
        initialDescription={editingTask?.description ?? ''}
        loading={updateTask.isPending}
        onClose={() => setEditingTask(null)}
        onSubmit={handleEditTask}
      />

      {/* Delete task */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteTask.mutate(deleteTarget.id);
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
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Target list</label>
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
            <Button variant="secondary" onClick={() => setShowApply(false)} type="button">
              Cancel
            </Button>
            <Button type="submit" loading={applyTemplate.isPending}>
              Apply
            </Button>
          </div>
        </form>
      </Modal>

      {/* Move task modal */}
      <MoveTaskModal
        open={!!moveTarget}
        onClose={() => setMoveTarget(null)}
        eligibleParents={
          moveTarget
            ? tasks.filter((t) => t.id !== moveTarget.id && t.id !== moveTarget.parentId)
            : []
        }
        onSelect={(parentId) => {
          if (moveTarget) {
            moveTemplateTask.mutate({ taskId: moveTarget.id, parentId });
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

      {canWrite && <FloatingAddButton onClick={openAddTask} />}
    </div>
  );
}
