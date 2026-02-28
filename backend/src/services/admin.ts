import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { httpError } from '../utils/httpError';

export async function listUsers(prisma: PrismaClient) {
  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function resetUserPassword(prisma: PrismaClient, userId: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) httpError(404, 'User not found');

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}
