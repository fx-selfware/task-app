'use client';

import { useState } from 'react';
import { useShares, useCreateShare, useUpdateShare, useDeleteShare } from '@/hooks/useShares';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import type { Permission } from '@/types';

interface SharesModalProps {
  open: boolean;
  onClose: () => void;
  listId: string;
}

export function SharesModal({ open, onClose, listId }: SharesModalProps) {
  // Gated on `open`: this modal is always mounted, and the query would
  // otherwise fire on every list page load whether or not it is shown.
  const { data: shares = [], isLoading } = useShares(listId, open);
  const createShare = useCreateShare(listId);
  const updateShare = useUpdateShare(listId);
  const deleteShare = useDeleteShare(listId);

  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<Permission>('READ');
  const [error, setError] = useState('');

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await createShare.mutateAsync({ email, permission });
      setEmail('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to share');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Share List">
      <div className="space-y-4">
        {/* Invite form */}
        <form onSubmit={handleInvite} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1"
            />
            <select
              value={permission}
              onChange={(e) => setPermission(e.target.value as Permission)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-base sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="READ">Read</option>
              <option value="WRITE">Write</option>
            </select>
            <Button type="submit" loading={createShare.isPending}>
              Invite
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        {/* Current shares */}
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-700">Current shares</h3>
          {isLoading ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : shares.length === 0 ? (
            <p className="text-sm text-gray-400">Not shared with anyone yet.</p>
          ) : (
            <ul className="space-y-2">
              {shares.map((share) => (
                <li
                  key={share.id}
                  className="flex items-center gap-2 rounded-lg border p-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {share.user.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{share.user.email}</p>
                  </div>
                  <select
                    value={share.permission}
                    onChange={(e) =>
                      updateShare.mutate({
                        shareId: share.id,
                        permission: e.target.value as Permission,
                      })
                    }
                    className="rounded border border-gray-300 px-2 py-1 text-base sm:text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="READ">Read</option>
                    <option value="WRITE">Write</option>
                  </select>
                  <button
                    onClick={() => deleteShare.mutate(share.id)}
                    className="p-2 text-gray-400 hover:text-red-500"
                    aria-label="Revoke access"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
