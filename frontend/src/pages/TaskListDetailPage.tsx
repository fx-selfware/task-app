import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { useTaskList, useRenameTaskList, useDeleteTaskList } from '../hooks/useTaskLists';
import {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useMoveTask,
  useReorderTasks,
  useDeleteCompletedTasks,
} from '../hooks/useTasks';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Spinner } from '../components/Spinner';
import { SharesModal } from './SharesModal';
import { OverflowMenu } from '../components/OverflowMenu';
import { useTaskListEvents } from '../hooks/useTaskListEvents';
import { SortableParentCard, SortableSubtaskCard, SubtaskDndList } from '../components/SortableCards';
import { MoveTaskModal } from './MoveTaskModal';
import { useToggleSet } from '../hooks/useToggleSet';
import type { Task } from '../types';
import type { MenuItem } from '../components/OverflowMenu';

export function TaskListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showDeleteCompleted, setShowDeleteCompleted] = useState(false);
  const [collapsedParents, toggleCollapse] = useToggleSet();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<Task | null>(null);

  // Animation tracking
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
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
    if (allDoneCount === 0) setShowCompleted(false);
  }, [allDoneCount]);

  const todoTasks = localOrder
    ? localOrder.map((tid) => tasks.find((t) => t.id === tid)!).filter(Boolean)
    : tasks.filter((t) => t.status === 'TODO' || completingIds.has(t.id));

  // Build groups for the completed section
  const completedGroups: { parent: Task; parentMode: 'completed' | 'readonly-header'; completedSubtasks: Task[] }[] = [];
  for (const task of tasks) {
    if (task.status === 'DONE' && !completingIds.has(task.id)) {
      completedGroups.push({
        parent: task,
        parentMode: 'completed',
        completedSubtasks: task.subtasks ?? [],
      });
    } else if (task.status === 'TODO') {
      const doneSubs = (task.subtasks ?? []).filter(
        (s) => s.status === 'DONE' && !completingIds.has(s.id)
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
    updateTask.mutate({ taskId, data: { status: 'TODO' } });
  }, [updateTask]);

  const handleExitAnimationEnd = useCallback((taskId: string) => {
    setCompletingIds((s) => {
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = todoTasks.findIndex((t) => t.id === active.id);
    const newIndex = todoTasks.findIndex((t) => t.id === over.id);
    const newOrder = arrayMove(todoTasks, oldIndex, newIndex);
    const newIds = newOrder.map((t) => t.id);
    setLocalOrder(newIds);
    await reorderTasks.mutateAsync({ orderedIds: newIds });
    setLocalOrder(null);
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

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    await renameList.mutateAsync({ id: id!, name: renameName });
    setShowRename(false);
  };

  const handleDeleteList = async () => {
    await deleteList.mutateAsync(id!);
    navigate('/task-lists');
  };

  const openEdit = (task: Task) => {
    setEditTaskTitle(task.title);
    setEditTaskDesc(task.description ?? '');
    setEditTarget(task);
  };

  const handleEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    await updateTask.mutateAsync({
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
          {canWrite && (
            <Button size="sm" onClick={openAddTask}>
              + Task
            </Button>
          )}
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
            {canWrite ? 'No tasks yet. Add one above!' : 'No tasks in this list.'}
          </p>
        </div>
      ) : (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(event) => setActiveDragId(event.active.id as string)}
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
                      {hasVisibleSubs && !collapsed && (
                        <div
                          className="ml-8 mt-1 space-y-1"
                          style={activeDragId ? { opacity: 0.3, pointerEvents: 'none' } : undefined}
                        >
                          <SubtaskDndList
                            items={todoSubs}
                            sensors={sensors}
                            onReorder={async (ids) => {
                              await reorderTasks.mutateAsync({ orderedIds: ids, parentId: task.id });
                            }}
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
                  <div data-testid="drag-overlay" className="flex items-center gap-3 rounded-lg border bg-white p-3 shadow-lg">
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
                        <CompletedTaskCard
                          task={group.parent}
                          canWrite={canWrite}
                          onUncheck={() => handleUncomplete(group.parent.id)}
                          onDelete={() => setDeleteTarget(group.parent)}
                        />
                      ) : (
                        <ReadonlyParentHeader task={group.parent} />
                      )}
                      {group.completedSubtasks.length > 0 && (
                        <div className="ml-8 mt-1 space-y-1">
                          {group.completedSubtasks.map((sub) => (
                            <CompletedTaskCard
                              key={sub.id}
                              task={sub}
                              canWrite={canWrite}
                              onUncheck={() => handleUncomplete(sub.id)}
                              onDelete={() => setDeleteTarget(sub)}
                            />
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

      {/* Delete completed tasks confirm */}
      <ConfirmDialog
        open={showDeleteCompleted}
        onClose={() => setShowDeleteCompleted(false)}
        onConfirm={async () => {
          await deleteCompletedTasks.mutateAsync();
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
            ? todoTasks.filter((t) => t.id !== moveTarget.id)
            : []
        }
        onSelect={async (parentId) => {
          if (moveTarget) {
            await moveTask.mutateAsync({ taskId: moveTarget.id, parentId });
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
    </div>
  );
}

function CompletedTaskCard({
  task,
  canWrite,
  onUncheck,
  onDelete,
}: {
  task: Task;
  canWrite: boolean;
  onUncheck: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm">
      <input
        type="checkbox"
        checked={true}
        onChange={canWrite ? onUncheck : undefined}
        disabled={!canWrite}
        className="h-5 w-5 cursor-pointer rounded border-gray-300"
        aria-label={`Mark "${task.title}" as todo`}
      />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-400 line-through">{task.title}</p>
        {task.description && (
          <p className="mt-0.5 text-sm text-gray-400 line-through">{task.description}</p>
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
