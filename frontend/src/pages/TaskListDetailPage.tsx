import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
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
} from '../hooks/useTasks';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Spinner } from '../components/Spinner';
import { SharesModal } from './SharesModal';
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

  const [showRename, setShowRename] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
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

  const doneCount = (data?.list?.tasks ?? []).filter((t) => t.status === 'DONE').length;
  useEffect(() => {
    if (doneCount === 0) setShowCompleted(false);
  }, [doneCount]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  if (isLoading) return <Spinner className="mt-8" />;
  if (!data) return <p className="text-gray-500">List not found.</p>;

  const { list, isOwner, permission } = data;
  const canWrite = permission === 'WRITE';
  const tasks = list.tasks ?? [];

  const todoTasks = localOrder
    ? localOrder.map((tid) => tasks.find((t) => t.id === tid)!).filter(Boolean)
    : tasks.filter((t) => t.status === 'TODO');

  const doneTasks = tasks
    .filter((t) => t.status === 'DONE')
    .sort((a, b) => a.order - b.order);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = todoTasks.findIndex((t) => t.id === active.id);
    const newIndex = todoTasks.findIndex((t) => t.id === over.id);
    const newOrder = arrayMove(todoTasks, oldIndex, newIndex);
    const newIds = newOrder.map((t) => t.id);
    setLocalOrder(newIds);
    await reorderTasks.mutateAsync(newIds);
    setLocalOrder(null);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTask.mutateAsync({ title: newTaskTitle, description: newTaskDesc });
    setNewTaskTitle('');
    setNewTaskDesc('');
    setShowAddTask(false);
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
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{list.name}</h1>
          <p className="text-sm text-gray-500">
            {isOwner ? 'Owner' : `Shared · ${permission.toLowerCase()}`}
          </p>
        </div>
        <div className="flex gap-2">
          {canWrite && (
            <Button variant="secondary" size="sm" onClick={() => setShowAddTask(true)}>
              + Task
            </Button>
          )}
          {isOwner && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowShares(true)}
              >
                Share
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setRenameName(list.name);
                  setShowRename(true);
                }}
              >
                Rename
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowDeleteList(true)}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
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
                  <SortableTaskCard
                    key={task.id}
                    task={task}
                    canWrite={canWrite}
                    onCheck={() =>
                      updateTask.mutate({ taskId: task.id, data: { status: 'DONE' } })
                    }
                    onDelete={() => setDeleteTarget(task)}
                    onEdit={() => openEdit(task)}
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
                  className="text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Completed ({doneTasks.length}) {showCompleted ? '▲' : '▶'}
                </button>
                {showCompleted && canWrite && (
                  <button
                    onClick={() => deleteCompletedTasks.mutate()}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    Delete completed
                  </button>
                )}
              </div>
              {showCompleted && (
                <div className="mt-2 space-y-2">
                  {doneTasks.map((task) => (
                    <CompletedTaskCard
                      key={task.id}
                      task={task}
                      canWrite={canWrite}
                      onUncheck={() =>
                        updateTask.mutate({ taskId: task.id, data: { status: 'TODO' } })
                      }
                      onDelete={() => setDeleteTarget(task)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Add Task Modal */}
      <Modal open={showAddTask} onClose={() => setShowAddTask(false)} title="Add Task">
        <form onSubmit={handleAddTask} className="space-y-4">
          <Input
            label="Title"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            required
            autoFocus
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Description (optional)
            </label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={newTaskDesc}
              onChange={(e) => setNewTaskDesc(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowAddTask(false)}
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
            required
            autoFocus
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Description (optional)
            </label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

function SortableTaskCard({
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
      className="group flex items-start gap-3 rounded-lg border bg-white p-3 shadow-sm"
    >
      <input
        type="checkbox"
        checked={false}
        onChange={canWrite ? onCheck : undefined}
        disabled={!canWrite}
        className="mt-1 h-4 w-4 cursor-pointer rounded border-gray-300"
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
      {canWrite && (
        <button
          onClick={onDelete}
          className="mt-0.5 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
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
          className="mt-0.5 cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing"
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
        className="mt-1 h-4 w-4 cursor-pointer rounded border-gray-300"
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
          className="mt-0.5 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
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
