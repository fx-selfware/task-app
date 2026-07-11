import { sqliteTable, text, integer, index, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => createId());

const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date());

const updatedAt = () =>
  integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());

export type Role = 'USER' | 'ADMIN';
export type TaskStatus = 'TODO' | 'DONE';
export type Permission = 'READ' | 'WRITE';

export const users = sqliteTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role').$type<Role>().notNull().default('USER'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const taskLists = sqliteTable('task_lists', {
  id: id(),
  name: text('name').notNull(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const tasks = sqliteTable(
  'tasks',
  {
    id: id(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').$type<TaskStatus>().notNull().default('TODO'),
    order: integer('order').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    taskListId: text('task_list_id')
      .notNull()
      .references(() => taskLists.id, { onDelete: 'cascade' }),
    parentId: text('parent_id').references((): AnySQLiteColumn => tasks.id, { onDelete: 'cascade' }),
  },
  (t) => [index('tasks_list_order_idx').on(t.taskListId, t.order), index('tasks_parent_order_idx').on(t.parentId, t.order)],
);

export const taskListShares = sqliteTable(
  'task_list_shares',
  {
    id: id(),
    permission: text('permission').$type<Permission>().notNull().default('READ'),
    createdAt: createdAt(),
    taskListId: text('task_list_id')
      .notNull()
      .references(() => taskLists.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('task_list_shares_list_user_uq').on(t.taskListId, t.userId)],
);

export const taskTemplates = sqliteTable('task_templates', {
  id: id(),
  name: text('name').notNull(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const templateTasks = sqliteTable(
  'template_tasks',
  {
    id: id(),
    title: text('title').notNull(),
    description: text('description'),
    order: integer('order').notNull(),
    templateId: text('template_id')
      .notNull()
      .references(() => taskTemplates.id, { onDelete: 'cascade' }),
    parentId: text('parent_id').references((): AnySQLiteColumn => templateTasks.id, { onDelete: 'cascade' }),
  },
  (t) => [
    index('template_tasks_template_order_idx').on(t.templateId, t.order),
    index('template_tasks_parent_order_idx').on(t.parentId, t.order),
  ],
);

export const templateShares = sqliteTable(
  'template_shares',
  {
    id: id(),
    permission: text('permission').$type<Permission>().notNull().default('READ'),
    createdAt: createdAt(),
    templateId: text('template_id')
      .notNull()
      .references(() => taskTemplates.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('template_shares_template_user_uq').on(t.templateId, t.userId)],
);
