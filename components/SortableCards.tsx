'use client';

import { useId } from 'react';
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
import { OverflowMenu } from '@/components/OverflowMenu';
import type { MenuItem } from '@/components/OverflowMenu';

// --- Shared sortable parent card (tasks + templates) ---

interface SortableParentCardProps {
  id: string;
  title: string;
  description?: string | null;
  canWrite: boolean;
  hasSubtasks: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  menuItems?: MenuItem[];
  onEdit: () => void;
  onCheck?: () => void;
  isCompleting?: boolean;
}

export function SortableParentCard({
  id,
  title,
  description,
  canWrite,
  hasSubtasks,
  collapsed,
  onToggleCollapse,
  menuItems,
  onEdit,
  onCheck,
  isCompleting,
}: SortableParentCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !canWrite });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-sortable-id={id}
      className="group flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm"
    >
      {hasSubtasks && (
        <button
          onClick={onToggleCollapse}
          className="p-0.5 text-gray-400 hover:text-gray-600"
          aria-label={collapsed ? 'Expand subtasks' : 'Collapse subtasks'}
        >
          <span className="text-xs">{collapsed ? '▶' : '▼'}</span>
        </button>
      )}
      {onCheck && (
        <input
          type="checkbox"
          checked={!!isCompleting}
          onChange={canWrite && !isCompleting ? onCheck : undefined}
          disabled={!canWrite || !!isCompleting}
          className="h-5 w-5 cursor-pointer rounded border-gray-300"
          aria-label={`Mark "${title}" as done`}
        />
      )}
      <div
        className={`flex-1 min-w-0 ${canWrite && !isCompleting ? 'cursor-pointer' : ''}`}
        onClick={canWrite && !isCompleting ? onEdit : undefined}
      >
        <p className={`font-medium ${isCompleting ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{title}</p>
        {description && (
          <p className={`mt-0.5 text-sm ${isCompleting ? 'text-gray-400 line-through' : 'text-gray-500'}`}>{description}</p>
        )}
      </div>
      {canWrite && menuItems && menuItems.length > 0 && (
        <div className="opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          <OverflowMenu items={menuItems} variant="ghost" aria-label="Task actions" />
        </div>
      )}
      {canWrite && (
        <button
          {...attributes}
          {...listeners}
          style={{ touchAction: 'none' }}
          className="p-2 cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing"
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
  menuItems?: MenuItem[];
  onEdit: () => void;
  onCheck?: () => void;
  isCompleting?: boolean;
}

export function SortableSubtaskCard({
  id,
  title,
  description,
  canWrite,
  menuItems,
  onEdit,
  onCheck,
  isCompleting,
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
      className="group flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-2.5 shadow-sm"
    >
      {onCheck && (
        <input
          type="checkbox"
          checked={!!isCompleting}
          onChange={canWrite && !isCompleting ? onCheck : undefined}
          disabled={!canWrite || !!isCompleting}
          className="h-4 w-4 cursor-pointer rounded border-gray-300"
          aria-label={`Mark "${title}" as done`}
        />
      )}
      <div
        className={`flex-1 min-w-0 ${canWrite && !isCompleting ? 'cursor-pointer' : ''}`}
        onClick={canWrite && !isCompleting ? onEdit : undefined}
      >
        <p className={`text-sm font-medium ${isCompleting ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{title}</p>
        {description && (
          <p className={`mt-0.5 text-xs ${isCompleting ? 'text-gray-400 line-through' : 'text-gray-500'}`}>{description}</p>
        )}
      </div>
      {canWrite && menuItems && menuItems.length > 0 && (
        <div className="opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          <OverflowMenu items={menuItems} variant="ghost" aria-label="Task actions" />
        </div>
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
  onReorder: (orderedIds: string[]) => void;
  renderItem: (item: T) => React.ReactNode;
}

export function SubtaskDndList<T extends { id: string }>({
  items,
  sensors,
  onReorder,
  renderItem,
}: SubtaskDndListProps<T>) {
  const dndId = useId();

  // No local copy of the order: the reorder mutation patches the cache
  // synchronously, so `items` already arrives in the new order.
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    onReorder(arrayMove(items, oldIndex, newIndex).map((i) => i.id));
  };

  if (items.length === 0) return null;

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {items.map(renderItem)}
      </SortableContext>
    </DndContext>
  );
}
