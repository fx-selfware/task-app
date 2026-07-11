import { getDb } from '@/lib/db';
import { taskListShares, taskLists, taskTemplates, tasks, templateShares, templateTasks, users } from '@/db/schema';

/**
 * Port of clearDb in backend/features/steps/world.ts. Runs in the Playwright
 * worker process against the same SQLite file the web server uses (WAL mode
 * makes cross-process writes safe). Children first to satisfy FKs.
 */
export function resetDb(): void {
  const db = getDb();
  db.delete(templateShares).run();
  db.delete(templateTasks).run();
  db.delete(taskTemplates).run();
  db.delete(taskListShares).run();
  db.delete(tasks).run();
  db.delete(taskLists).run();
  db.delete(users).run();
}
