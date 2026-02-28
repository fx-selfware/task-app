import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config, getAdminEmails } from '../config';
import { httpError } from '../utils/httpError';

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function registerUser(prisma: PrismaClient, input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) httpError(409, 'Email already in use');

  const passwordHash = await bcrypt.hash(input.password, 12);
  const role = getAdminEmails().has(input.email.toLowerCase()) ? 'ADMIN' : 'USER';
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      role,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  return user;
}

export async function loginUser(prisma: PrismaClient, input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) httpError(401, 'Invalid credentials');

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) httpError(401, 'Invalid credentials');

  // Promote or demote role based on current ADMIN_EMAILS config
  const expectedRole = getAdminEmails().has(user.email.toLowerCase()) ? 'ADMIN' : 'USER';
  if (user.role !== expectedRole) {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: expectedRole },
    });
  }

  return { id: user.id, email: user.email, name: user.name, role: expectedRole, createdAt: user.createdAt };
}

export function signToken(userId: string, email: string, role: string): string {
  return jwt.sign({ userId, email, role }, config.JWT_SECRET, { expiresIn: '7d' });
}
