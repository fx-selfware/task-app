'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLogin } from '@/hooks/useAuth';
import { Button } from '@/components/Button';

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login.mutateAsync({ email, password });
      router.push('/task-lists');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-white px-6 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-800 text-xl font-extrabold text-white">T</div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Welcome back</h1>
          <p className="mt-1.5 text-[15px] text-gray-500">Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</div>
          )}
          <label className="block">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email" autoFocus
              className="mt-1 w-full border-0 border-b-[1.5px] border-gray-200 bg-transparent px-0 py-2 text-base text-gray-900 outline-none focus:border-teal-800 dark:border-gray-700 dark:text-gray-100"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="mt-1 w-full border-0 border-b-[1.5px] border-gray-200 bg-transparent px-0 py-2 text-base text-gray-900 outline-none focus:border-teal-800 dark:border-gray-700 dark:text-gray-100"
            />
          </label>
          <Button type="submit" className="w-full" loading={login.isPending}>
            Sign in
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-semibold text-teal-800 hover:underline dark:text-teal-400">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
