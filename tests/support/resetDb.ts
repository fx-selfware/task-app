import { getDb } from '@/lib/db';
import { taskListShares, taskLists, taskTemplates, tasks, templateShares, templateTasks, users } from '@/db/schema';

/**
 * Port of clearDb in the old backend test world. Runs in the Playwright
 * worker process against the same SQLite file the web server uses (WAL mode
 * makes cross-process writes safe). Children first to satisfy FKs.
 */
export async function resetDb(): Promise<void> {
  const db = await getDb();
  await db.delete(templateShares);
  await db.delete(templateTasks);
  await db.delete(taskTemplates);
  await db.delete(taskListShares);
  await db.delete(tasks);
  await db.delete(taskLists);
  await db.delete(users);
}
