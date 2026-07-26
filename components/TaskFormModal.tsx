'use client';

import { useState } from 'react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';

interface TaskFormValues {
  title: string;
  description: string;
}

interface TaskFormModalProps {
  open: boolean;
  heading: string;
  submitLabel: string;
  initialTitle?: string;
  initialDescription?: string;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => void;
}

/**
 * Owns the draft title and description itself. Kept in the page, every
 * keystroke re-rendered the whole task list — DndContext, every sortable card
 * and its useSortable subscription — which is what made typing feel heavy on
 * a phone. Modal renders nothing while closed, so the form remounts on each
 * open and picks up fresh initial values without an effect.
 */
export function TaskFormModal({
  open,
  heading,
  submitLabel,
  initialTitle = '',
  initialDescription = '',
  loading,
  onClose,
  onSubmit,
}: TaskFormModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={heading}>
      <TaskForm
        submitLabel={submitLabel}
        initialTitle={initialTitle}
        initialDescription={initialDescription}
        loading={loading}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </Modal>
  );
}

function TaskForm({
  submitLabel,
  initialTitle,
  initialDescription,
  loading,
  onClose,
  onSubmit,
}: Omit<TaskFormModalProps, 'open' | 'heading'>) {
  const [title, setTitle] = useState(initialTitle ?? '');
  const [description, setDescription] = useState(initialDescription ?? '');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ title, description });
      }}
      className="space-y-4"
    >
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
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
        <label className="mb-1 block text-sm font-medium text-gray-700">Description (optional)</label>
        <textarea
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} type="button">
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

interface NameFormModalProps {
  open: boolean;
  heading: string;
  label: string;
  submitLabel: string;
  initialName?: string;
  loading?: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

/** Same idea for the single-field rename and create dialogs. */
export function NameFormModal({
  open,
  heading,
  label,
  submitLabel,
  initialName = '',
  loading,
  error,
  onClose,
  onSubmit,
}: NameFormModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={heading}>
      <NameForm
        label={label}
        submitLabel={submitLabel}
        initialName={initialName}
        loading={loading}
        error={error}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </Modal>
  );
}

function NameForm({
  label,
  submitLabel,
  initialName,
  loading,
  error,
  onClose,
  onSubmit,
}: Omit<NameFormModalProps, 'open' | 'heading'>) {
  const [name, setName] = useState(initialName ?? '');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(name);
      }}
      className="space-y-4"
    >
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Input label={label} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} type="button">
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
