'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRegister } from '@/hooks/useAuth';
import { Button } from '@/components/Button';

export default function RegisterPage() {
  const router = useRouter();
  const register = useRegister();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await register.mutateAsync({ name, email, password });
      router.push('/task-lists');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-white px-6 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-800 text-xl font-extrabold text-white">T</div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Create an account</h1>
          <p className="mt-1.5 text-[15px] text-gray-500">It takes a moment.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</div>
          )}
          <label className="block">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name" autoFocus
              className="mt-1 w-full border-0 border-b-[1.5px] border-gray-200 bg-transparent px-0 py-2 text-base text-gray-900 outline-none focus:border-teal-800 dark:border-gray-700 dark:text-gray-100"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
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
              autoComplete="new-password"
              className="mt-1 w-full border-0 border-b-[1.5px] border-gray-200 bg-transparent px-0 py-2 text-base text-gray-900 outline-none focus:border-teal-800 dark:border-gray-700 dark:text-gray-100"
            />
          </label>
          <Button type="submit" className="w-full" loading={register.isPending}>
            Create account
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-teal-800 hover:underline dark:text-teal-400">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
