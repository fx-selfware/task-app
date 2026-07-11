'use client';

import { useState } from 'react';
import { useUsers, useResetPassword } from '@/hooks/useAdmin';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Modal } from '@/components/Modal';
import { Spinner } from '@/components/Spinner';

export default function AdminPage() {
  const { data: users = [], isLoading } = useUsers();
  const resetPassword = useResetPassword();

  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    if (newPassword.length < 8) {
      setResetError('Password must be at least 8 characters');
      return;
    }

    try {
      await resetPassword.mutateAsync({ userId: resetTarget!.id, newPassword });
      setResetSuccess(`Password reset for ${resetTarget!.name}`);
      setNewPassword('');
      setTimeout(() => {
        setResetTarget(null);
        setResetSuccess('');
      }, 1500);
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : 'Failed to reset password');
    }
  };

  const closeModal = () => {
    setResetTarget(null);
    setNewPassword('');
    setResetError('');
    setResetSuccess('');
  };

  if (isLoading) return <Spinner className="mt-8" />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="mt-1 text-sm text-gray-500">{users.length} registered user{users.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Created</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{user.name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">{user.email}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.role === 'ADMIN'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setResetTarget({ id: user.id, name: user.name })}
                  >
                    Reset Password
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="space-y-3 sm:hidden">
        {users.map((user) => (
          <div key={user.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">{user.name}</p>
                <p className="mt-0.5 text-sm text-gray-500 truncate">{user.email}</p>
              </div>
              <span
                className={`ml-2 inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  user.role === 'ADMIN'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {user.role}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Joined {new Date(user.createdAt).toLocaleDateString()}
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setResetTarget({ id: user.id, name: user.name })}
              >
                Reset Password
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!resetTarget} onClose={closeModal} title="Reset Password">
        <form onSubmit={handleReset} className="space-y-4">
          <p className="text-sm text-gray-600">
            Set a new password for <span className="font-medium">{resetTarget?.name}</span>.
          </p>
          {resetError && <p className="text-sm text-red-600">{resetError}</p>}
          {resetSuccess && <p className="text-sm text-green-600">{resetSuccess}</p>}
          <Input
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeModal} type="button">
              Cancel
            </Button>
            <Button type="submit" loading={resetPassword.isPending}>
              Reset
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
