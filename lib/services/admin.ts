import bcrypt from 'bcryptjs';
import { desc, eq } from 'drizzle-orm';
import { users } from '@/db/schema';
import type { Db } from '@/lib/db';
import { httpError } from '@/lib/httpError';

export async function listUsers(db: Db) {
  return await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt })
    .from(users)
    .orderBy(desc(users.createdAt))
    .all();
}

export async function resetUserPassword(db: Db, userId: string, newPassword: string): Promise<void> {
  const user = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).get();
  if (!user) httpError(404, 'User not found');

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId)).run();
}
