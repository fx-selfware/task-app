import { useState, useId } from 'react';
import {
  DndContext,
  closestCenter,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Shared sortable parent card (tasks + templates) ---

interface SortableParentCardProps {
  id: string;
  title: string;
  description?: string | null;
  canWrite: boolean;
  hasSubtasks: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onAddSubtask: () => void;
  onCheck?: () => void;
}

export function SortableParentCard({
  id,
  title,
  description,
  canWrite,
  hasSubtasks,
  collapsed,
  onToggleCollapse,
  onDelete,
  onEdit,
  onAddSubtask,
  onCheck,
}: SortableParentCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !canWrite });

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
      {onCheck && (
        <input
          type="checkbox"
          checked={false}
          onChange={canWrite ? onCheck : undefined}
          disabled={!canWrite}
          className="mt-1 h-5 w-5 cursor-pointer rounded border-gray-300"
          aria-label={`Mark "${title}" as done`}
        />
      )}
      <div
        className={`flex-1 min-w-0 ${canWrite ? 'cursor-pointer' : ''}`}
        onClick={canWrite ? onEdit : undefined}
      >
        <p className="font-medium text-gray-900">{title}</p>
        {description && (
          <p className="mt-0.5 text-sm text-gray-500">{description}</p>
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

// --- Shared sortable subtask card (tasks + templates) ---

interface SortableSubtaskCardProps {
  id: string;
  title: string;
  description?: string | null;
  canWrite: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onCheck?: () => void;
}

export function SortableSubtaskCard({
  id,
  title,
  description,
  canWrite,
  onDelete,
  onEdit,
  onCheck,
}: SortableSubtaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !canWrite });

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
      {onCheck && (
        <input
          type="checkbox"
          checked={false}
          onChange={canWrite ? onCheck : undefined}
          disabled={!canWrite}
          className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-300"
          aria-label={`Mark "${title}" as done`}
        />
      )}
      <div
        className={`flex-1 min-w-0 ${canWrite ? 'cursor-pointer' : ''}`}
        onClick={canWrite ? onEdit : undefined}
      >
        <p className="text-sm font-medium text-gray-800">{title}</p>
        {description && (
          <p className="mt-0.5 text-xs text-gray-500">{description}</p>
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

// --- Shared subtask DnD list ---

interface SubtaskDndListProps<T extends { id: string }> {
  items: T[];
  sensors: any;
  onReorder: (orderedIds: string[]) => Promise<void>;
  renderItem: (item: T) => React.ReactNode;
}

export function SubtaskDndList<T extends { id: string }>({
  items,
  sensors,
  onReorder,
  renderItem,
}: SubtaskDndListProps<T>) {
  const dndId = useId();
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);

  const ordered = localOrder
    ? localOrder.map((id) => items.find((i) => i.id === id)!).filter(Boolean)
    : items;

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ordered.findIndex((i) => i.id === active.id);
    const newIndex = ordered.findIndex((i) => i.id === over.id);
    const newOrder = arrayMove(ordered, oldIndex, newIndex);
    const newIds = newOrder.map((i) => i.id);
    setLocalOrder(newIds);
    await onReorder(newIds);
    setLocalOrder(null);
  };

  if (items.length === 0) return null;

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={ordered.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        {ordered.map(renderItem)}
      </SortableContext>
    </DndContext>
  );
}
