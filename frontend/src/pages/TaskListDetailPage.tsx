import { useState, useEffect, useId } from 'react';
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
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTaskList, useRenameTaskList, useDeleteTaskList } from '../hooks/useTaskLists';
import {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useReorderTasks,
  useDeleteCompletedTasks,
  useDeleteCompletedSubtasks,
} from '../hooks/useTasks';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Spinner } from '../components/Spinner';
import { SharesModal } from './SharesModal';
import { OverflowMenu } from '../components/OverflowMenu';
import { useTaskListEvents } from '../hooks/useTaskListEvents';
import type { Task } from '../types';

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
  const deleteCompletedSubtasks = useDeleteCompletedSubtasks(id!);
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
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());
  const [showCompletedSubs, setShowCompletedSubs] = useState<Set<string>>(new Set());
  const [deleteCompletedSubsTarget, setDeleteCompletedSubsTarget] = useState<string | null>(null);

  const tasks = data?.list?.tasks ?? [];

  // Count all done tasks (top-level + their subtasks)
  const doneTopLevel = tasks.filter((t) => t.status === 'DONE');
  const allDoneCount =
    doneTopLevel.length +
    doneTopLevel.reduce((sum, t) => sum + (t.subtasks?.length ?? 0), 0);

  useEffect(() => {
    if (doneTopLevel.length === 0) setShowCompleted(false);
  }, [doneTopLevel.length]);

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

  const todoTasks = localOrder
    ? localOrder.map((tid) => tasks.find((t) => t.id === tid)!).filter(Boolean)
    : tasks.filter((t) => t.status === 'TODO');

  const doneTasks = tasks.filter((t) => t.status === 'DONE');

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

  const toggleCollapse = (taskId: string) => {
    setCollapsedParents((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleCompletedSubs = (taskId: string) => {
    setShowCompletedSubs((prev) => {
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
          <h1 className="truncate text-2xl font-bold text-gray-900">{list.name}</h1>
          <p className="text-sm text-gray-500">
            {isOwner ? 'Owner' : `Shared · ${permission.toLowerCase()}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canWrite && (
            <Button variant="secondary" size="sm" onClick={openAddTask}>
              + Task
            </Button>
          )}
          {isOwner && (
            <OverflowMenu
              aria-label="List actions"
              items={[
                { label: 'Share', onClick: () => setShowShares(true) },
                { label: 'Rename', onClick: () => { setRenameName(list.name); setShowRename(true); } },
                { label: 'Delete', onClick: () => setShowDeleteList(true), variant: 'danger' },
              ]}
            />
          )}
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
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={todoTasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {todoTasks.map((task) => (
                  <TaskWithSubtasks
                    key={task.id}
                    task={task}
                    canWrite={canWrite}
                    sensors={sensors}
                    collapsed={collapsedParents.has(task.id)}
                    showCompletedSubs={showCompletedSubs.has(task.id)}
                    onToggleCollapse={() => toggleCollapse(task.id)}
                    onToggleCompletedSubs={() => toggleCompletedSubs(task.id)}
                    onCheck={() =>
                      updateTask.mutate({ taskId: task.id, data: { status: 'DONE' } })
                    }
                    onDelete={() => setDeleteTarget(task)}
                    onEdit={() => openEdit(task)}
                    onAddSubtask={() => openAddSubtask(task.id)}
                    onCheckSubtask={(subId, status) =>
                      updateTask.mutate({ taskId: subId, data: { status } })
                    }
                    onDeleteSubtask={(sub) => setDeleteTarget(sub)}
                    onEditSubtask={(sub) => openEdit(sub)}
                    onReorderSubtasks={async (orderedIds) => {
                      await reorderTasks.mutateAsync({ orderedIds, parentId: task.id });
                    }}
                    onDeleteCompletedSubs={() => setDeleteCompletedSubsTarget(task.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {doneTasks.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowCompleted((v) => !v)}
                  className="py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Completed ({allDoneCount}) {showCompleted ? '▲' : '▶'}
                </button>
                {showCompleted && canWrite && (
                  <button
                    onClick={() => setShowDeleteCompleted(true)}
                    className="py-2 text-sm text-red-500 hover:text-red-700"
                  >
                    Delete completed
                  </button>
                )}
              </div>
              {showCompleted && (
                <div className="mt-2 space-y-2">
                  {doneTasks.map((task) => (
                    <div key={task.id}>
                      <CompletedTaskCard
                        task={task}
                        canWrite={canWrite}
                        onUncheck={() =>
                          updateTask.mutate({ taskId: task.id, data: { status: 'TODO' } })
                        }
                        onDelete={() => setDeleteTarget(task)}
                      />
                      {task.subtasks && task.subtasks.length > 0 && (
                        <div className="ml-8 mt-1 space-y-1">
                          {task.subtasks.map((sub) => (
                            <CompletedTaskCard
                              key={sub.id}
                              task={sub}
                              canWrite={canWrite}
                              onUncheck={() =>
                                updateTask.mutate({ taskId: sub.id, data: { status: 'TODO' } })
                              }
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
            <Button
              variant="secondary"
              onClick={() => setShowRename(false)}
              type="button"
            >
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

      {/* Delete completed subtasks confirm */}
      <ConfirmDialog
        open={!!deleteCompletedSubsTarget}
        onClose={() => setDeleteCompletedSubsTarget(null)}
        onConfirm={async () => {
          if (deleteCompletedSubsTarget) {
            await deleteCompletedSubtasks.mutateAsync(deleteCompletedSubsTarget);
            setDeleteCompletedSubsTarget(null);
          }
        }}
        title="Delete Completed Subtasks"
        message="Delete all completed subtasks?"
        loading={deleteCompletedSubtasks.isPending}
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

function TaskWithSubtasks({
  task,
  canWrite,
  sensors,
  collapsed,
  showCompletedSubs,
  onToggleCollapse,
  onToggleCompletedSubs,
  onCheck,
  onDelete,
  onEdit,
  onAddSubtask,
  onCheckSubtask,
  onDeleteSubtask,
  onEditSubtask,
  onReorderSubtasks,
  onDeleteCompletedSubs,
}: {
  task: Task;
  canWrite: boolean;
  sensors: ReturnType<typeof useSensors>;
  collapsed: boolean;
  showCompletedSubs: boolean;
  onToggleCollapse: () => void;
  onToggleCompletedSubs: () => void;
  onCheck: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onAddSubtask: () => void;
  onCheckSubtask: (subId: string, status: 'TODO' | 'DONE') => void;
  onDeleteSubtask: (sub: Task) => void;
  onEditSubtask: (sub: Task) => void;
  onReorderSubtasks: (orderedIds: string[]) => Promise<void>;
  onDeleteCompletedSubs: () => void;
}) {
  const subtasks = task.subtasks ?? [];
  const todoSubs = subtasks.filter((s) => s.status === 'TODO');
  const doneSubs = subtasks.filter((s) => s.status === 'DONE');
  const hasSubtasks = subtasks.length > 0;
  const dndId = useId();
  const [localSubOrder, setLocalSubOrder] = useState<string[] | null>(null);

  const orderedTodoSubs = localSubOrder
    ? localSubOrder.map((sid) => todoSubs.find((s) => s.id === sid)!).filter(Boolean)
    : todoSubs;

  const handleSubDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedTodoSubs.findIndex((s) => s.id === active.id);
    const newIndex = orderedTodoSubs.findIndex((s) => s.id === over.id);
    const newOrder = arrayMove(orderedTodoSubs, oldIndex, newIndex);
    const newIds = newOrder.map((s) => s.id);
    setLocalSubOrder(newIds);
    await onReorderSubtasks(newIds);
    setLocalSubOrder(null);
  };

  return (
    <div>
      <SortableTaskCard
        task={task}
        canWrite={canWrite}
        hasSubtasks={hasSubtasks}
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onCheck={onCheck}
        onDelete={onDelete}
        onEdit={onEdit}
        onAddSubtask={onAddSubtask}
      />
      {hasSubtasks && !collapsed && (
        <div className="ml-8 mt-1 space-y-1">
          {todoSubs.length > 0 && (
            <DndContext
              id={dndId}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleSubDragEnd}
            >
              <SortableContext
                items={orderedTodoSubs.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {orderedTodoSubs.map((sub) => (
                  <SortableSubtaskCard
                    key={sub.id}
                    task={sub}
                    canWrite={canWrite}
                    onCheck={() => onCheckSubtask(sub.id, 'DONE')}
                    onDelete={() => onDeleteSubtask(sub)}
                    onEdit={() => onEditSubtask(sub)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
          {doneSubs.length > 0 && (
            <div className="mt-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={onToggleCompletedSubs}
                  className="py-1 text-xs font-medium text-gray-500 hover:text-gray-700"
                >
                  Completed ({doneSubs.length}) {showCompletedSubs ? '▲' : '▶'}
                </button>
                {showCompletedSubs && canWrite && (
                  <button
                    onClick={onDeleteCompletedSubs}
                    className="py-1 text-xs text-red-500 hover:text-red-700"
                  >
                    Delete completed
                  </button>
                )}
              </div>
              {showCompletedSubs && (
                <div className="mt-1 space-y-1">
                  {doneSubs.map((sub) => (
                    <CompletedTaskCard
                      key={sub.id}
                      task={sub}
                      canWrite={canWrite}
                      onUncheck={() => onCheckSubtask(sub.id, 'TODO')}
                      onDelete={() => onDeleteSubtask(sub)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
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

function SortableTaskCard({
  task,
  canWrite,
  hasSubtasks,
  collapsed,
  onToggleCollapse,
  onCheck,
  onDelete,
  onEdit,
  onAddSubtask,
}: {
  task: Task;
  canWrite: boolean;
  hasSubtasks: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCheck: () => void;
  onDelete: () => void;
  onEdit: () => void;
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
      <input
        type="checkbox"
        checked={false}
        onChange={canWrite ? onCheck : undefined}
        disabled={!canWrite}
        className="mt-1 h-5 w-5 cursor-pointer rounded border-gray-300"
        aria-label={`Mark "${task.title}" as done`}
      />
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

function SortableSubtaskCard({
  task,
  canWrite,
  onCheck,
  onDelete,
  onEdit,
}: {
  task: Task;
  canWrite: boolean;
  onCheck: () => void;
  onDelete: () => void;
  onEdit: () => void;
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
      <input
        type="checkbox"
        checked={false}
        onChange={canWrite ? onCheck : undefined}
        disabled={!canWrite}
        className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-300"
        aria-label={`Mark "${task.title}" as done`}
      />
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
    <div className="group flex items-start gap-3 rounded-lg border bg-white p-3 shadow-sm">
      <input
        type="checkbox"
        checked={true}
        onChange={canWrite ? onUncheck : undefined}
        disabled={!canWrite}
        className="mt-1 h-5 w-5 cursor-pointer rounded border-gray-300"
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
  );
}
