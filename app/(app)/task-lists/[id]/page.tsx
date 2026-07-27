'use client';

import { useState, useMemo, useRef, useLayoutEffect } from 'react';
import { createId } from '@paralleldrive/cuid2';
import { useParams, useRouter } from 'next/navigation';
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
import { useTaskList, useRenameTaskList, useDeleteTaskList } from '@/hooks/useTaskLists';
import {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useMoveTask,
  useReorderTasks,
  useDeleteCompletedTasks,
} from '@/hooks/useTasks';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Spinner } from '@/components/Spinner';
import { SharesModal } from '@/components/SharesModal';
import { OverflowMenu } from '@/components/OverflowMenu';
import { useTaskListEvents } from '@/hooks/useTaskListEvents';
import { MoveTaskModal } from '@/components/MoveTaskModal';
import { useToggleSet } from '@/hooks/useToggleSet';
import { Composer } from '@/components/Composer';
import { TaskRow } from '@/components/TaskRow';
import { SortableTaskRow } from '@/components/SortableTaskRow';
import { EditableHeading } from '@/components/EditableHeading';
import { CompletedGroup } from '@/components/CompletedGroup';
import type { Task } from '@/types';

export default function TaskListDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id as string;
  const router = useRouter();
  const { data, isLoading } = useTaskList(id!);
  const renameList = useRenameTaskList();
  const deleteList = useDeleteTaskList();
  const createTask = useCreateTask(id!);
  const updateTask = useUpdateTask(id!);
  const deleteTask = useDeleteTask(id!);
  const reorderTasks = useReorderTasks(id!);
  const deleteCompletedTasks = useDeleteCompletedTasks(id!);
  const moveTask = useMoveTask(id!);
  useTaskListEvents(id!);

  const [showShares, setShowShares] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [showDeleteList, setShowDeleteList] = useState(false);
  const [collapsedParents, toggleCollapse] = useToggleSet();
  const [moveTarget, setMoveTarget] = useState<Task | null>(null);
  // When set, the composer is aimed at this parent instead of the list root.
  const [subtaskParent, setSubtaskParent] = useState<Task | null>(null);
  // Subtasks are hidden while their parent is in flight, so the row being
  // dragged keeps a stable height and the drop target doesn't jump.
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  // Hiding the subtasks shortens the list above the dragged row, so the row
  // moves out from under the finger. Measure the shift after the DOM commits
  // but before paint, and give it back to the overlay.
  const preCollapseTopRef = useRef(0);
  const [dragYOffset, setDragYOffset] = useState(0);

  useLayoutEffect(() => {
    if (!activeDragId) {
      setDragYOffset(0);
      return;
    }
    const el = document.querySelector(`[data-sortable-id="${activeDragId}"]`);
    if (el) setDragYOffset(preCollapseTopRef.current - el.getBoundingClientRect().top);
  }, [activeDragId]);

  const tasks = useMemo(() => data?.list?.tasks ?? [], [data]);

  const allDoneCount = useMemo(
    () =>
      tasks.reduce((sum, t) => {
        let count = t.status === 'DONE' ? 1 : 0;
        count += t.subtasks?.filter((s) => s.status === 'DONE').length ?? 0;
        return sum + count;
      }, 0),
    [tasks],
  );

  const todoTasks = useMemo(() => tasks.filter((t) => t.status === 'TODO'), [tasks]);

  // A parent whose own subtasks are done stays a plain label rather than a row,
  // purely to say where the completed subtask came from.
  const completedGroups = useMemo(() => {
    const groups: { parent: Task; parentMode: 'completed' | 'readonly-header'; completedSubtasks: Task[] }[] = [];
    for (const task of tasks) {
      if (task.status === 'DONE') {
        groups.push({ parent: task, parentMode: 'completed', completedSubtasks: task.subtasks ?? [] });
      } else {
        const doneSubs = (task.subtasks ?? []).filter((s) => s.status === 'DONE');
        if (doneSubs.length > 0) {
          groups.push({ parent: task, parentMode: 'readonly-header', completedSubtasks: doneSubs });
        }
      }
    }
    return groups;
  }, [tasks]);

  // Subtasks collapse while their parent is in flight — but not while a subtask
  // itself is being dragged, or the row would unmount mid-gesture.
  const draggingParent = activeDragId !== null && todoTasks.some((t) => t.id === activeDragId);

  const sensors = useSensors(
    // A few pixels of travel for a mouse, a held press for a finger: both let an
    // ordinary tap through to the row so it can open for editing.
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (isLoading) return <Spinner className="mt-8" />;
  if (!data) return <p className="text-gray-500">List not found.</p>;

  const { list, isOwner, permission } = data;
  const canWrite = permission === 'WRITE';

  // Vertical position is order; horizontal position is depth. Reading the X
  // axis the drag already produces replaces both "Move under..." and "Move to
  // top level" — a menu is a poor place to express "put this inside that".
  const NEST_PX = 36;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event;
    const id = active.id as string;

    const parentOf = todoTasks.find((t) => (t.subtasks ?? []).some((sub) => sub.id === id));
    const dragged = parentOf
      ? (parentOf.subtasks ?? []).find((sub) => sub.id === id)
      : todoTasks.find((t) => t.id === id);
    if (!dragged) return;

    if (delta.x >= NEST_PX && !parentOf) {
      // One level only: a task that already has subtasks cannot become one.
      if ((dragged.subtasks ?? []).length > 0) return;
      const idx = todoTasks.findIndex((t) => t.id === id);
      const newParent = todoTasks[idx - 1];
      if (newParent) moveTask.mutate({ taskId: id, parentId: newParent.id });
      return;
    }

    if (delta.x <= -NEST_PX && parentOf) {
      moveTask.mutate({ taskId: id, parentId: null });
      return;
    }

    if (parentOf) return; // subtasks are not sortable; they promote by swipe
    if (!over || active.id === over.id) return;
    const oldIndex = todoTasks.findIndex((t) => t.id === active.id);
    const newIndex = todoTasks.findIndex((t) => t.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    reorderTasks.mutate({ orderedIds: arrayMove(todoTasks, oldIndex, newIndex).map((t) => t.id) });
  };

  const addTask = ({ title, description }: { title: string; description: string }, parentId?: string) =>
    createTask.mutate({ id: createId(), title, description, ...(parentId && { parentId }) });

  const rowActions = (task: Task, isSubtask: boolean) => [
    // Labels match the acceptance criteria verbatim — the feature files name
    // these actions, so the wording is spec, not decoration.
    ...(!isSubtask ? [{ label: 'Add subtask', onClick: () => setSubtaskParent(task) }] : []),
    ...(!isSubtask || isSubtask ? [{ label: 'Move under...', onClick: () => setMoveTarget(task) }] : []),
    ...(isSubtask
      ? [{ label: 'Move to top level', onClick: () => moveTask.mutate({ taskId: task.id, parentId: null }) }]
      : []),
    { label: 'Delete', onClick: () => setDeleteTarget(task), danger: true },
  ];

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      <div className="mb-1 flex items-start justify-between gap-3 px-4 pt-1">
        <div className="min-w-0">
          <EditableHeading
            value={list.name}
            canEdit={isOwner}
            onSave={(name) => renameList.mutate({ id: id!, name })}
          />
          <p className="text-sm text-gray-500">{isOwner ? 'Owner' : `Shared · ${permission.toLowerCase()}`}</p>
        </div>
        <OverflowMenu
          aria-label="List actions"
          items={[
            ...(isOwner ? [{ label: 'Share', onClick: () => setShowShares(true) }] : []),
            ...(isOwner
              ? [{ label: 'Delete', onClick: () => setShowDeleteList(true), variant: 'danger' as const }]
              : []),
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <p className="px-4 py-10 text-center text-gray-500">
            {canWrite ? 'Nothing here yet. Add a task below.' : 'No tasks in this list.'}
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(e) => {
              const el = document.querySelector(`[data-sortable-id="${e.active.id}"]`);
              preCollapseTopRef.current = el?.getBoundingClientRect().top ?? 0;
              setActiveDragId(e.active.id as string);
            }}
            onDragCancel={() => setActiveDragId(null)}
            onDragEnd={(e) => { setActiveDragId(null); handleDragEnd(e); }}
          >
            <SortableContext
              items={todoTasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div>
                {todoTasks.map((task) => {
                  const todoSubs = (task.subtasks ?? []).filter((s) => s.status === 'TODO');
                  const collapsed = collapsedParents.has(task.id);
                  return (
                    <div key={task.id}>
                      <SortableTaskRow
                        id={task.id}
                        title={task.title}
                        description={task.description}
                        canWrite={canWrite}
                        subtaskCount={todoSubs.length || undefined}
                        collapsed={collapsed}
                        onToggleCollapse={() => toggleCollapse(task.id)}
                        onToggleDone={() => updateTask.mutate({ taskId: task.id, data: { status: 'DONE' } })}
                        onSave={(v) => updateTask.mutate({ taskId: task.id, data: v })}
                        actions={rowActions(task, false)}
                      />
                      {!collapsed && !draggingParent &&
                        todoSubs.map((sub) => (
                          <TaskRow
                            key={sub.id}
                            id={sub.id}
                            title={sub.title}
                            description={sub.description}
                            isSubtask
                            canWrite={canWrite}
                            onPromote={() => moveTask.mutate({ taskId: sub.id, parentId: null })}
                            onToggleDone={() => updateTask.mutate({ taskId: sub.id, data: { status: 'DONE' } })}
                            onSave={(v) => updateTask.mutate({ taskId: sub.id, data: v })}
                            actions={rowActions(sub, true)}
                          />
                        ))}
                    </div>
                  );
                })}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeDragId
                ? (() => {
                    const t = todoTasks.find((x) => x.id === activeDragId);
                    return t ? (
                      <div
                        data-testid="drag-overlay"
                        style={dragYOffset ? { transform: `translateY(${dragYOffset}px)` } : undefined}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg dark:border-gray-700 dark:bg-gray-900"
                      >
                        <p className="font-medium text-gray-900 dark:text-gray-100">{t.title}</p>
                      </div>
                    ) : null;
                  })()
                : null}
            </DragOverlay>
          </DndContext>
        )}

        <CompletedGroup
          count={allDoneCount}
          groups={completedGroups}
          canWrite={canWrite}
          onUncheck={(taskId) => updateTask.mutate({ taskId, data: { status: 'TODO' } })}
          onClear={() => deleteCompletedTasks.mutate()}
        />
      </div>

      {canWrite && (
        <Composer
          label={subtaskParent ? `Add a subtask to "${subtaskParent.title}"` : 'Add a task'}
          withDescription
          onSubmit={(v) => {
            addTask(v, subtaskParent?.id);
            setSubtaskParent(null);
          }}
        />
      )}

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

      <ConfirmDialog
        open={showDeleteList}
        onClose={() => setShowDeleteList(false)}
        onConfirm={() => {
          deleteList.mutate(id!);
          router.push('/task-lists');
        }}
        title="Delete List"
        message={`Delete "${list.name}" and all its tasks?`}
        loading={deleteList.isPending}
      />

      <MoveTaskModal
        open={!!moveTarget}
        onClose={() => setMoveTarget(null)}
        eligibleParents={
          moveTarget
            ? todoTasks.filter(
                (t) =>
                  t.id !== moveTarget.id &&
                  t.id !== moveTarget.parentId &&
                  // one level only: a task that already has subtasks can't be nested
                  (t.subtasks ?? []).length === 0,
              )
            : []
        }
        onSelect={(parentId) => {
          if (moveTarget) {
            moveTask.mutate({ taskId: moveTarget.id, parentId });
            setMoveTarget(null);
          }
        }}
        loading={moveTask.isPending}
      />

      {isOwner && <SharesModal open={showShares} onClose={() => setShowShares(false)} listId={id!} />}
    </div>
  );
}
