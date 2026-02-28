import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTemplates, useCreateTemplate, useDeleteTemplate } from '../hooks/useTemplates';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Spinner } from '../components/Spinner';
import type { TemplateSummary } from '../types';

export function TemplatesPage() {
  const { data, isLoading } = useTemplates();
  const createTemplate = useCreateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const owned = data?.owned ?? [];
  const shared = data?.shared ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<TemplateSummary | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    try {
      await createTemplate.mutateAsync(newName);
      setNewName('');
      setShowCreate(false);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create');
    }
  };

  if (isLoading) return <Spinner className="mt-8" />;

  const allTemplates = [...owned, ...shared];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
        <Button onClick={() => setShowCreate(true)}>+ New Template</Button>
      </div>

      {allTemplates.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-500">
            No templates yet. Create one to quickly populate task lists!
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {allTemplates.map((t) => (
            <div
              key={t.id}
              className="group relative rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <Link to={`/templates/${t.id}`} className="block">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{t.name}</h3>
                  {t.role === 'shared' && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      shared
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {t._count?.tasks ?? 0} task
                  {(t._count?.tasks ?? 0) !== 1 ? 's' : ''}
                </p>
              </Link>
              {t.role === 'owner' && (
                <button
                  onClick={() => setDeleteTarget(t)}
                  className="absolute right-2 top-2 rounded p-1 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                  aria-label="Delete template"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
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
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Template">
        <form onSubmit={handleCreate} className="space-y-4">
          {createError && <p className="text-sm text-red-600">{createError}</p>}
          <Input
            label="Template name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowCreate(false)}
              type="button"
            >
              Cancel
            </Button>
            <Button type="submit" loading={createTemplate.isPending}>
              Create
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteTemplate.mutateAsync(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        title="Delete Template"
        message={`Delete "${deleteTarget?.name}"?`}
        loading={deleteTemplate.isPending}
      />
    </div>
  );
}
