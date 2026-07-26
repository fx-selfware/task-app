'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
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
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Spinner } from '@/components/Spinner';
import { SharesModal } from '@/components/SharesModal';
import { FloatingAddButton } from '@/components/FloatingAddButton';
import { OverflowMenu } from '@/components/OverflowMenu';
import { useTaskListEvents } from '@/hooks/useTaskListEvents';
import { SortableParentCard, SortableSubtaskCard, SubtaskDndList } from '@/components/SortableCards';
import { MoveTaskModal } from '@/components/MoveTaskModal';
import { useToggleSet } from '@/hooks/useToggleSet';
import type { Task } from '@/types';
import type { MenuItem } from '@/components/OverflowMenu';

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

  const [showRename, setShowRename] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [addSubtaskParentId, setAddSubtaskParentId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [showShares, setShowShares] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [showDeleteList, setShowDeleteList] = useState(false);
  const [editTarget, setEditTarget] = useState<Task | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskDesc, setEditTaskDesc] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showDeleteCompleted, setShowDeleteCompleted] = useState(false);
  const [collapsedParents, toggleCollapse] = useToggleSet();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const preCollapseTopRef = useRef(0);
  const [dragYOffset, setDragYOffset] = useState(0);
  const [moveTarget, setMoveTarget] = useState<Task | null>(null);

  // Animation tracking
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [uncompletingIds, setUncompletingIds] = useState<Set<string>>(new Set());
  const [enteringIds, setEnteringIds] = useState<Set<string>>(new Set());
  const prevTodoIdsRef = useRef<Set<string>>(new Set());

  const tasks = data?.list?.tasks ?? [];

  // Count all done tasks (top-level + all done subtasks)
  const allDoneCount = tasks.reduce((sum, t) => {
    let count = t.status === 'DONE' ? 1 : 0;
    count += t.subtasks?.filter((s) => s.status === 'DONE').length ?? 0;
    return sum + count;
  }, 0);

  useEffect(() => {
    if (allDoneCount === 0 && uncompletingIds.size === 0) setShowCompleted(false);
  }, [allDoneCount, uncompletingIds]);

  // Compensate DragOverlay position for the layout shift when subtasks collapse.
  // Runs after DOM commit but before paint, so the user never sees the wrong position.
  useLayoutEffect(() => {
    if (!activeDragId) { setDragYOffset(0); return; }
    const el = document.querySelector(`[data-sortable-id="${activeDragId}"]`);
    if (el) setDragYOffset(preCollapseTopRef.current - el.getBoundingClientRect().top);
  }, [activeDragId]);

  const todoTasks = tasks.filter(
    (t) => (t.status === 'TODO' && !uncompletingIds.has(t.id)) || completingIds.has(t.id),
  );

  // Build groups for the completed section
  const completedGroups: { parent: Task; parentMode: 'completed' | 'readonly-header'; completedSubtasks: Task[] }[] = [];
  for (const task of tasks) {
    if ((task.status === 'DONE' || uncompletingIds.has(task.id)) && !completingIds.has(task.id)) {
      completedGroups.push({
        parent: task,
        parentMode: 'completed',
        completedSubtasks: task.subtasks ?? [],
      });
    } else if (task.status === 'TODO') {
      const doneSubs = (task.subtasks ?? []).filter(
        (s) => (s.status === 'DONE' || uncompletingIds.has(s.id)) && !completingIds.has(s.id)
      );
      if (doneSubs.length > 0) {
        completedGroups.push({
          parent: task,
          parentMode: 'readonly-header',
          completedSubtasks: doneSubs,
        });
      }
    }
  }

  // Detect newly appearing tasks for enter animation
  const todoIdKey = todoTasks.map((t) => t.id).join(',');
  useEffect(() => {
    const prev = prevTodoIdsRef.current;
    const currentIds = new Set(todoTasks.map((t) => t.id));
    if (prev.size > 0) {
      const newlyAppeared = new Set<string>();
      for (const tid of currentIds) {
        if (!prev.has(tid) && !completingIds.has(tid)) {
          newlyAppeared.add(tid);
        }
      }
      if (newlyAppeared.size > 0) {
        setEnteringIds((s) => {
          const next = new Set(s);
          for (const tid of newlyAppeared) next.add(tid);
          return next;
        });
      }
    }
    prevTodoIdsRef.current = currentIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todoIdKey]);

  const handleComplete = useCallback((taskId: string) => {
    setCompletingIds((s) => {
      const next = new Set(s);
      next.add(taskId);
      // If parent, also mark TODO subtasks as completing
      const task = tasks.find((t) => t.id === taskId);
      if (task?.subtasks) {
        for (const sub of task.subtasks) {
          if (sub.status === 'TODO') next.add(sub.id);
        }
      }
      return next;
    });
    updateTask.mutate({ taskId, data: { status: 'DONE' } });
  }, [updateTask, tasks]);

  const handleUncomplete = useCallback((taskId: string) => {
    setUncompletingIds((s) => {
      const next = new Set(s);
      next.add(taskId);
      return next;
    });
    updateTask.mutate({ taskId, data: { status: 'TODO' } });
    // Fallback: clear animation state after duration in case onAnimationEnd doesn't fire
    // (e.g. if the element is removed from the DOM mid-animation)
    setTimeout(() => {
      setUncompletingIds((s) => {
        const next = new Set(s);
        next.delete(taskId);
        return next;
      });
    }, 350);
  }, [updateTask]);

  const handleExitAnimationEnd = useCallback((taskId: string) => {
    setCompletingIds((s) => {
      const next = new Set(s);
      next.delete(taskId);
      return next;
    });
  }, []);

  const handleUncompleteAnimationEnd = useCallback((taskId: string) => {
    setUncompletingIds((s) => {
      const next = new Set(s);
      next.delete(taskId);
      return next;
    });
  }, []);

  const handleEnterAnimationEnd = useCallback((taskId: string) => {
    setEnteringIds((s) => {
      const next = new Set(s);
      next.delete(taskId);
      return next;
    });
  }, []);

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
  if (!data) return <p className="text-gray-500">List not found.</p>;

  const { list, isOwner, permission } = data;
  const canWrite = permission === 'WRITE';

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = todoTasks.findIndex((t) => t.id === active.id);
    const newIndex = todoTasks.findIndex((t) => t.id === over.id);
    const newIds = arrayMove(todoTasks, oldIndex, newIndex).map((t) => t.id);
    reorderTasks.mutate({ orderedIds: newIds });
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

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    createTask.mutate({
      id: createId(),
      title: newTaskTitle,
      description: newTaskDesc,
      ...(addSubtaskParentId && { parentId: addSubtaskParentId }),
    });
    setNewTaskTitle('');
    setNewTaskDesc('');
    setShowAddTask(false);
    setAddSubtaskParentId(null);
  };

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    renameList.mutate({ id: id!, name: renameName });
    setShowRename(false);
  };

  const handleDeleteList = () => {
    deleteList.mutate(id!);
    router.push('/task-lists');
  };

  const openEdit = (task: Task) => {
    setEditTaskTitle(task.title);
    setEditTaskDesc(task.description ?? '');
    setEditTarget(task);
  };

  const handleEditTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    updateTask.mutate({
      taskId: editTarget.id,
      data: {
        title: editTaskTitle,
        description: editTaskDesc.trim() || null,
      },
    });
    setEditTarget(null);
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-gray-900">{list.name}</h1>
          <p className="text-sm text-gray-500">
            {isOwner ? 'Owner' : `Shared · ${permission.toLowerCase()}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <OverflowMenu
            aria-label="List actions"
            items={[
              ...(isOwner ? [
                { label: 'Share', onClick: () => setShowShares(true) },
                { label: 'Rename', onClick: () => { setRenameName(list.name); setShowRename(true); } },
              ] : []),
              ...(canWrite && allDoneCount > 0 ? [
                { label: 'Delete completed', onClick: () => setShowDeleteCompleted(true), variant: 'danger' as const },
              ] : []),
              ...(isOwner ? [
                { label: 'Delete', onClick: () => setShowDeleteList(true), variant: 'danger' as const },
              ] : []),
            ]}
          />
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 sm:p-12 text-center">
          <p className="text-gray-500">
            {canWrite ? 'No tasks yet. Tap + to add one!' : 'No tasks in this list.'}
          </p>
        </div>
      ) : (
        <>
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
              items={todoTasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {todoTasks.map((task) => {
                  const subtasks = task.subtasks ?? [];
                  const todoSubs = subtasks.filter((s) => s.status === 'TODO' || completingIds.has(s.id));
                  const hasSubtasks = subtasks.length > 0;
                  const hasVisibleSubs = todoSubs.length > 0;
                  const collapsed = collapsedParents.has(task.id);

                  const parentMenu: MenuItem[] = [
                    { label: 'Add subtask', onClick: () => openAddSubtask(task.id) },
                    ...(!hasSubtasks
                      ? [{ label: 'Move under...', onClick: () => setMoveTarget(task) }]
                      : []),
                    { label: 'Delete', onClick: () => setDeleteTarget(task), variant: 'danger' as const },
                  ];

                  return (
                    <div
                      key={task.id}
                      className={
                        completingIds.has(task.id) ? 'task-completing' :
                        enteringIds.has(task.id) ? 'task-entering' : ''
                      }
                      onAnimationEnd={() => {
                        if (completingIds.has(task.id)) handleExitAnimationEnd(task.id);
                        if (enteringIds.has(task.id)) handleEnterAnimationEnd(task.id);
                      }}
                    >
                      <SortableParentCard
                        id={task.id}
                        title={task.title}
                        description={task.description}
                        canWrite={canWrite}
                        hasSubtasks={hasVisibleSubs}
                        collapsed={collapsed}
                        onToggleCollapse={() => toggleCollapse(task.id)}
                        isCompleting={completingIds.has(task.id)}
                        onCheck={() => handleComplete(task.id)}
                        menuItems={parentMenu}
                        onEdit={() => openEdit(task)}
                      />
                      {hasVisibleSubs && !collapsed && !activeDragId && (
                        <div className="ml-8 mt-1 space-y-1">
                          <SubtaskDndList
                            items={todoSubs}
                            sensors={sensors}
                            onReorder={(ids) => reorderTasks.mutate({ orderedIds: ids, parentId: task.id })}
                            renderItem={(sub) => (
                              <div
                                key={sub.id}
                                className={
                                  completingIds.has(sub.id) ? 'task-completing' :
                                  enteringIds.has(sub.id) ? 'task-entering' : ''
                                }
                                onAnimationEnd={() => {
                                  if (completingIds.has(sub.id)) handleExitAnimationEnd(sub.id);
                                  if (enteringIds.has(sub.id)) handleEnterAnimationEnd(sub.id);
                                }}
                              >
                                <SortableSubtaskCard
                                  id={sub.id}
                                  title={sub.title}
                                  description={sub.description}
                                  canWrite={canWrite}
                                  isCompleting={completingIds.has(sub.id)}
                                  onCheck={() => handleComplete(sub.id)}
                                  menuItems={[
                                    { label: 'Move under...', onClick: () => setMoveTarget(sub) },
                                    { label: 'Move to top level', onClick: () => moveTask.mutate({ taskId: sub.id, parentId: null }) },
                                    { label: 'Delete', onClick: () => setDeleteTarget(sub), variant: 'danger' as const },
                                  ]}
                                  onEdit={() => openEdit(sub)}
                                />
                              </div>
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
                const t = todoTasks.find((x) => x.id === activeDragId);
                if (!t) return null;
                return (
                  <div data-testid="drag-overlay" style={dragYOffset ? { transform: `translateY(${dragYOffset}px)` } : undefined} className="flex items-center gap-3 rounded-lg border bg-white p-3 shadow-lg">
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

          {completedGroups.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowCompleted((v) => !v)}
                className="py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Completed ({allDoneCount}) {showCompleted ? '▲' : '▶'}
              </button>
              {showCompleted && (
                <div className="mt-2 space-y-2">
                  {completedGroups.map((group) => (
                    <div key={group.parent.id}>
                      {group.parentMode === 'completed' ? (
                        <div
                          className={uncompletingIds.has(group.parent.id) ? 'task-uncompleting' : ''}
                          onAnimationEnd={() => {
                            if (uncompletingIds.has(group.parent.id)) handleUncompleteAnimationEnd(group.parent.id);
                          }}
                        >
                          <CompletedTaskCard
                            task={group.parent}
                            canWrite={canWrite}
                            isUncompleting={uncompletingIds.has(group.parent.id)}
                            onUncheck={() => handleUncomplete(group.parent.id)}
                            onDelete={() => setDeleteTarget(group.parent)}
                          />
                        </div>
                      ) : (
                        <ReadonlyParentHeader task={group.parent} />
                      )}
                      {group.completedSubtasks.length > 0 && (
                        <div className="ml-8 mt-1 space-y-1">
                          {group.completedSubtasks.map((sub) => (
                            <div
                              key={sub.id}
                              className={uncompletingIds.has(sub.id) ? 'task-uncompleting' : ''}
                              onAnimationEnd={() => {
                                if (uncompletingIds.has(sub.id)) handleUncompleteAnimationEnd(sub.id);
                              }}
                            >
                              <CompletedTaskCard
                                task={sub}
                                canWrite={canWrite}
                                isUncompleting={uncompletingIds.has(sub.id)}
                                onUncheck={() => handleUncomplete(sub.id)}
                                onDelete={() => setDeleteTarget(sub)}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Add Task / Add Subtask Modal */}
      <Modal
        open={showAddTask}
        onClose={() => { setShowAddTask(false); setAddSubtaskParentId(null); }}
        title={addSubtaskParentId ? 'Add Subtask' : 'Add Task'}
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

      {/* Edit Task Modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Task">
        <form onSubmit={handleEditTask} className="space-y-4">
          <Input
            label="Title"
            value={editTaskTitle}
            onChange={(e) => setEditTaskTitle(e.target.value)}
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
              value={editTaskDesc}
              onChange={(e) => setEditTaskDesc(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditTarget(null)} type="button">
              Cancel
            </Button>
            <Button type="submit" loading={updateTask.isPending}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rename Modal */}
      <Modal open={showRename} onClose={() => setShowRename(false)} title="Rename List">
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
            <Button type="submit" loading={renameList.isPending}>
              Rename
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete task confirm */}
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

      {/* Delete completed tasks confirm */}
      <ConfirmDialog
        open={showDeleteCompleted}
        onClose={() => setShowDeleteCompleted(false)}
        onConfirm={() => {
          deleteCompletedTasks.mutate();
          setShowDeleteCompleted(false);
        }}
        title="Delete Completed Tasks"
        message={`Delete ${allDoneCount} completed task(s)?`}
        loading={deleteCompletedTasks.isPending}
      />

      {/* Delete list confirm */}
      <ConfirmDialog
        open={showDeleteList}
        onClose={() => setShowDeleteList(false)}
        onConfirm={handleDeleteList}
        title="Delete List"
        message={`Delete "${list.name}" and all its tasks?`}
        loading={deleteList.isPending}
      />

      {/* Move task modal */}
      <MoveTaskModal
        open={!!moveTarget}
        onClose={() => setMoveTarget(null)}
        eligibleParents={
          moveTarget
            ? todoTasks.filter((t) => t.id !== moveTarget.id && t.id !== moveTarget.parentId)
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

      {/* Shares modal */}
      {isOwner && (
        <SharesModal
          open={showShares}
          onClose={() => setShowShares(false)}
          listId={id!}
        />
      )}

      {canWrite && <FloatingAddButton onClick={openAddTask} />}
    </div>
  );
}

function CompletedTaskCard({
  task,
  canWrite,
  isUncompleting,
  onUncheck,
  onDelete,
}: {
  task: Task;
  canWrite: boolean;
  isUncompleting?: boolean;
  onUncheck: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm">
      <input
        type="checkbox"
        checked={!isUncompleting}
        onChange={canWrite && !isUncompleting ? onUncheck : undefined}
        disabled={!canWrite || !!isUncompleting}
        className="h-5 w-5 cursor-pointer rounded border-gray-300"
        aria-label={`Mark "${task.title}" as todo`}
      />
      <div className="flex-1 min-w-0">
        <p className={`font-medium ${isUncompleting ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{task.title}</p>
        {task.description && (
          <p className={`mt-0.5 text-sm ${isUncompleting ? 'text-gray-500' : 'text-gray-400 line-through'}`}>{task.description}</p>
        )}
      </div>
      {canWrite && (
        <button
          onClick={onDelete}
          className="p-2 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100 hover:text-red-500"
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
  );
}

function ReadonlyParentHeader({ task }: { task: Task }) {
  return (
    <div data-testid="readonly-parent-header" className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-400">{task.title}</p>
        {task.description && (
          <p className="mt-0.5 text-sm text-gray-400">{task.description}</p>
        )}
      </div>
    </div>
  );
}
