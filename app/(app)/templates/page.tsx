'use client';

import { useState } from 'react';
import { createId } from '@paralleldrive/cuid2';
import Link from 'next/link';
import { useTemplates, useCreateTemplate, useDeleteTemplate } from '@/hooks/useTemplates';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Spinner } from '@/components/Spinner';
import { Composer } from '@/components/Composer';
import type { TemplateSummary } from '@/types';

/**
 * The Lists screen with different nouns.
 *
 * Both indexes and both detail screens end up sharing one row shape and one
 * composer, which is most of why this redesign is a small diff.
 */
export default function TemplatesPage() {
  const { data, isLoading } = useTemplates();
  const createTemplate = useCreateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const [deleteTarget, setDeleteTarget] = useState<TemplateSummary | null>(null);

  const owned = data?.owned ?? [];
  const shared = data?.shared ?? [];

  if (isLoading) return <Spinner className="mt-8" />;

  const row = (t: TemplateSummary, canDelete: boolean) => {
    const count = t._count?.tasks ?? 0;
    return (
      <div key={t.id} className="relative border-t border-gray-200 dark:border-gray-800">
        <Link
          href={`/templates/${t.id}`}
          data-testid="template-link"
          data-template-name={t.name}
          className="flex min-h-[56px] items-center gap-3 py-3 pl-4 pr-3"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] leading-snug text-gray-900 dark:text-gray-100">
              {t.name}
            </span>
            <span className="mt-0.5 block truncate text-[13px] text-gray-500">
              {count === 0 ? 'Empty' : `${count} task${count === 1 ? '' : 's'}`}
              {t.role === 'shared' && ' · shared with you'}
            </span>
          </span>
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 5.5l6.5 6.5L10 18.5" />
          </svg>
        </Link>
        {canDelete && (
          <button
            onClick={() => setDeleteTarget(t)}
            aria-label={`Delete template ${t.name}`}
            className="absolute right-8 top-1/2 -translate-y-1/2 p-2 text-gray-300 opacity-0 transition-opacity hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      <h1 className="px-4 pb-2 pt-3 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
        Templates
      </h1>

      <div className="flex-1 overflow-y-auto">
        {owned.length === 0 && shared.length === 0 && (
          <p className="px-4 py-10 text-center text-gray-500">
            No templates yet. A template is a list you can pour into any other list.
          </p>
        )}
        <div className="group">{owned.map((t) => row(t, true))}</div>
        {shared.length > 0 && (
          <>
            <p className="px-4 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Shared with me
            </p>
            <div className="group">{shared.map((t) => row(t, false))}</div>
          </>
        )}

        <Composer
          label="New template"
          onSubmit={({ title }) => createTemplate.mutate({ name: title, id: createId() })}
        />
      </div>

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
