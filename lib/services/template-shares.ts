import { and, eq } from 'drizzle-orm';
import { taskTemplates, templateShares, users, type Permission } from '@/db/schema';
import type { Db } from '@/lib/db';
import { httpError } from '@/lib/httpError';

function requireOwner(db: Db, templateId: string, ownerId: string) {
  const template = db.select().from(taskTemplates).where(eq(taskTemplates.id, templateId)).get();
  if (!template || template.ownerId !== ownerId) httpError(404, 'Not found');
  return template;
}

export function getTemplateShares(db: Db, templateId: string, userId: string) {
  requireOwner(db, templateId, userId);

  const shareRows = db.select().from(templateShares).where(eq(templateShares.templateId, templateId)).all();
  return shareRows.map((s) => {
    const user = db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, s.userId))
      .get();
    return { ...s, user };
  });
}

export function createTemplateShare(
  db: Db,
  templateId: string,
  ownerId: string,
  email: string,
  permission: Permission,
) {
  requireOwner(db, templateId, ownerId);

  const invitee = db.select().from(users).where(eq(users.email, email)).get();
  if (!invitee) httpError(404, 'User not found');

  if (invitee.id === ownerId) httpError(400, 'Cannot share with yourself');

  const existing = db
    .select()
    .from(templateShares)
    .where(and(eq(templateShares.templateId, templateId), eq(templateShares.userId, invitee.id)))
    .get();
  if (existing) httpError(409, 'Already shared');

  const share = db
    .insert(templateShares)
    .values({ templateId, userId: invitee.id, permission })
    .returning()
    .get();

  return { ...share, user: { id: invitee.id, email: invitee.email, name: invitee.name } };
}

export function updateTemplateShare(
  db: Db,
  templateId: string,
  shareId: string,
  ownerId: string,
  permission: Permission,
) {
  requireOwner(db, templateId, ownerId);

  const share = db
    .select()
    .from(templateShares)
    .where(and(eq(templateShares.id, shareId), eq(templateShares.templateId, templateId)))
    .get();
  if (!share) httpError(404, 'Not found');

  return db.update(templateShares).set({ permission }).where(eq(templateShares.id, shareId)).returning().get();
}

export function deleteTemplateShare(db: Db, templateId: string, shareId: string, ownerId: string): void {
  requireOwner(db, templateId, ownerId);

  const share = db
    .select()
    .from(templateShares)
    .where(and(eq(templateShares.id, shareId), eq(templateShares.templateId, templateId)))
    .get();
  if (!share) httpError(404, 'Not found');

  db.delete(templateShares).where(eq(templateShares.id, shareId)).run();
}
