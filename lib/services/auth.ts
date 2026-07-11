import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { users, type Role } from '@/db/schema';
import type { Db } from '@/lib/db';
import { getAdminEmails } from '@/lib/config';
import { httpError } from '@/lib/httpError';

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: Date;
}

export async function registerUser(db: Db, input: RegisterInput): Promise<PublicUser> {
  const existing = db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).get();
  if (existing) httpError(409, 'Email already in use');

  const passwordHash = await bcrypt.hash(input.password, 12);
  const role: Role = getAdminEmails().has(input.email.toLowerCase()) ? 'ADMIN' : 'USER';
  const user = db
    .insert(users)
    .values({ email: input.email, passwordHash, name: input.name, role })
    .returning({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt })
    .get();

  return user;
}

export async function loginUser(db: Db, input: LoginInput): Promise<PublicUser> {
  const user = db.select().from(users).where(eq(users.email, input.email)).get();
  if (!user) httpError(401, 'Invalid credentials');

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) httpError(401, 'Invalid credentials');

  // Promote or demote role based on current ADMIN_EMAILS config
  const expectedRole: Role = getAdminEmails().has(user.email.toLowerCase()) ? 'ADMIN' : 'USER';
  if (user.role !== expectedRole) {
    db.update(users).set({ role: expectedRole }).where(eq(users.id, user.id)).run();
  }

  return { id: user.id, email: user.email, name: user.name, role: expectedRole, createdAt: user.createdAt };
}

export function getUserById(db: Db, userId: string): PublicUser | undefined {
  return db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .get();
}
