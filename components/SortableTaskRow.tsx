'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskRow, type TaskRowProps } from './TaskRow';

/**
 * A task row that can be lifted and reordered.
 *
 * There is no grip. The whole row is the handle, which is what lets the visible
 * chrome drop to zero — the sensors do the disambiguating: a touch has to be
 * held past the activation delay before it becomes a drag, and a mouse has to
 * travel a few pixels, so an ordinary tap still reaches the row underneath and
 * opens it for editing.
 */
export function SortableTaskRow({ id, ...props }: TaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !props.canWrite,
  });

  return (
    <div
      ref={setNodeRef}
      data-sortable-id={id}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
        touchAction: 'pan-y',
      }}
      {...attributes}
      {...listeners}
    >
      <TaskRow id={id} {...props} />
    </div>
  );
}
