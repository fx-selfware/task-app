'use client';

import { useState } from 'react';
import { useShares, useCreateShare, useUpdateShare, useDeleteShare } from '@/hooks/useShares';
import { useMe } from '@/hooks/useAuth';
import { Modal } from './Modal';
import type { Permission } from '@/types';

interface SharesModalProps {
  open: boolean;
  onClose: () => void;
  listId: string;
}

const LABEL: Record<Permission, string> = { READ: 'Can view', WRITE: 'Can edit' };

/**
 * A two-way choice does not deserve a picker.
 *
 * The old dialog used a native `<select>` for permission — on iOS that is a
 * full-screen wheel, a modal takeover to choose between two options, and there
 * were two of them. A segmented control shows both states at once and changes
 * in one tap. The people are the list and the field to add one sits at the foot
 * of it, the same grammar as every other screen. The owner is listed too, so it
 * answers "who can see this?" rather than just "who did I invite?".
 */
export function SharesModal({ open, onClose, listId }: SharesModalProps) {
  // Gated on `open`: this is always mounted, and the query would otherwise
  // fire on every list page load whether or not it is shown.
  const { data: shares = [], isLoading } = useShares(listId, open);
  const { data: me } = useMe();
  const createShare = useCreateShare(listId);
  const updateShare = useUpdateShare(listId);
  const deleteShare = useDeleteShare(listId);

  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<Permission>('READ');
  const [error, setError] = useState('');

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await createShare.mutateAsync({ email, permission });
      setEmail('');
      setPermission('READ');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to share');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Who has access">
      <div className="space-y-1">
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {me && (
            <li className="flex items-center gap-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-800 text-[13px] font-bold text-white">
                {me.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">{me.name}</span>
                <span className="block truncate text-xs text-gray-500">{me.email}</span>
              </span>
              <span className="text-xs font-semibold text-gray-500">Owner</span>
            </li>
          )}
          {isLoading && <li className="py-2 text-sm text-gray-400">Loading…</li>}
          {shares.map((share) => (
            <li key={share.id} className="flex items-center gap-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[13px] font-bold text-teal-800 dark:bg-teal-950">
                {share.user.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">{share.user.name}</span>
                <span className="block truncate text-xs text-gray-500">{share.user.email}</span>
              </span>
              <button
                type="button"
                aria-label={`Access for ${share.user.email}`}
                onClick={() =>
                  updateShare.mutate({
                    shareId: share.id,
                    permission: share.permission === 'WRITE' ? 'READ' : 'WRITE',
                  })
                }
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  share.permission === 'WRITE'
                    ? 'border-teal-800 bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-400'
                    : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                {LABEL[share.permission]}
              </button>
              <button
                type="button"
                onClick={() => deleteShare.mutate(share.id)}
                aria-label={`Remove ${share.user.email}`}
                className="shrink-0 p-1.5 text-gray-400 hover:text-red-600"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={invite} className="border-t border-gray-200 pt-3 dark:border-gray-800">
          <input
            type="email"
            placeholder="Email address"
            aria-label="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border-0 border-b-[1.5px] border-gray-200 bg-transparent px-0 py-2 text-base sm:text-sm text-gray-900 outline-none focus:border-teal-800 dark:border-gray-700 dark:text-gray-100"
          />
          {/* The permission control only appears once there is an address to
              attach it to — the same progressive disclosure as the composer. */}
          {email.trim() && (
            <div className="mt-3 flex items-center gap-2">
              <span
                className="flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
                role="radiogroup"
                aria-label="Permission"
              >
                {(['READ', 'WRITE'] as Permission[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={permission === p}
                    onClick={() => setPermission(p)}
                    className={`px-3 py-1.5 text-xs font-semibold ${
                      permission === p
                        ? 'bg-teal-800 text-white'
                        : 'bg-white text-gray-600 dark:bg-gray-900 dark:text-gray-300'
                    }`}
                  >
                    {LABEL[p]}
                  </button>
                ))}
              </span>
              <button
                type="submit"
                disabled={createShare.isPending}
                className="ml-auto rounded-lg bg-teal-800 px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                Invite
              </button>
            </div>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </form>
      </div>
    </Modal>
  );
}
