import { createId } from '@paralleldrive/cuid2';
import type { Page } from '@playwright/test';
import { taskLists, taskTemplates, tasks, templateTasks } from '@/db/schema';
import { getDb } from '@/lib/db';

/**
 * Fixtures are written straight to SQLite rather than through the API: the
 * benchmark's own server runs with PERF_DB_LATENCY_MS, so seeding over HTTP
 * would cost minutes and add nothing to what is being measured. The runner
 * process has no latency wrapper (the env var is set only on the web server),
 * and WAL makes the cross-process writes safe — same trick as tests/support.
 */

export interface SeededUser {
  id: string;
  email: string;
}

/** Registers through the API so the browser context ends up holding the cookie. */
export async function registerUser(page: Page): Promise<SeededUser> {
  const email = `perf_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
  const response = await page.request.post('/api/auth/register', {
    data: { email, password: 'password123', name: 'Perf User' },
  });
  if (!response.ok()) throw new Error(`register failed: ${response.status()} ${await response.text()}`);
  const { user } = (await response.json()) as { user: { id: string } };
  return { id: user.id, email };
}

export interface SeededList {
  id: string;
  name: string;
  /** Top-level task ids, in display order. */
  taskIds: string[];
  taskTitle: (index: number) => string;
}

/**
 * A list big enough for render cost to show up, with one nested group so the
 * subtask paths are exercised too. Defaults roughly match a real weekly list.
 */
export async function seedList(
  owner: SeededUser,
  { name = 'Perf List', taskCount = 15, subtaskCount = 5 } = {},
): Promise<SeededList> {
  const db = await getDb();
  const listId = createId();

  await db.insert(taskLists).values({ id: listId, name, ownerId: owner.id });

  const taskTitle = (index: number) => `Task ${String(index + 1).padStart(2, '0')}`;
  const taskIds = Array.from({ length: taskCount }, () => createId());

  await db.insert(tasks).values(
    taskIds.map((id, index) => ({
      id,
      title: taskTitle(index),
      description: index % 3 === 0 ? `Description for ${taskTitle(index)}` : null,
      order: index,
      taskListId: listId,
      parentId: null,
    })),
  );

  if (subtaskCount > 0) {
    await db.insert(tasks).values(
      Array.from({ length: subtaskCount }, (_, index) => ({
        id: createId(),
        title: `Subtask ${index + 1}`,
        order: index,
        taskListId: listId,
        parentId: taskIds[0],
      })),
    );
  }

  return { id: listId, name, taskIds, taskTitle };
}

export interface SeededTemplate {
  id: string;
  name: string;
}

export async function seedTemplate(
  owner: SeededUser,
  { name = 'Perf Template', taskCount = 8 } = {},
): Promise<SeededTemplate> {
  const db = await getDb();
  const templateId = createId();

  await db.insert(taskTemplates).values({ id: templateId, name, ownerId: owner.id });
  await db.insert(templateTasks).values(
    Array.from({ length: taskCount }, (_, index) => ({
      id: createId(),
      title: `Template task ${index + 1}`,
      order: index,
      templateId,
      parentId: null,
    })),
  );

  return { id: templateId, name };
}
