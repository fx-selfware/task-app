import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getApp, closeApp, clearDb, registerAndLogin } from './helpers';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let cookieA: string;
let cookieB: string;
let listId: string;

beforeAll(async () => {
  app = await getApp();
});

afterAll(async () => {
  await clearDb(app.prisma);
  await closeApp();
});

beforeEach(async () => {
  await clearDb(app.prisma);
  cookieA = await registerAndLogin(app, 'alice@example.com');
  cookieB = await registerAndLogin(app, 'bob@example.com');

  const createRes = await app.inject({
    method: 'POST',
    url: '/api/task-lists',
    payload: { name: 'Test List' },
    headers: { cookie: cookieA },
  });
  listId = createRes.json().list.id;
});

describe('POST /api/task-lists/:id/tasks', () => {
  it('AC-T1: creates task with correct order', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/tasks`,
      payload: { title: 'Task 1' },
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(201);
    const { task } = res.json();
    expect(task.title).toBe('Task 1');
    expect(task.order).toBe(0);
    expect(task.status).toBe('TODO');

    const res2 = await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/tasks`,
      payload: { title: 'Task 2' },
      headers: { cookie: cookieA },
    });
    expect(res2.json().task.order).toBe(1);
  });

  it('AC-T5: READ-only user cannot create task', async () => {
    await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/shares`,
      payload: { email: 'bob@example.com', permission: 'READ' },
      headers: { cookie: cookieA },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/tasks`,
      payload: { title: 'Sneaky Task' },
      headers: { cookie: cookieB },
    });
    expect(res.statusCode).toBe(403);
  });

  it('WRITE-permission user can create task', async () => {
    await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/shares`,
      payload: { email: 'bob@example.com', permission: 'WRITE' },
      headers: { cookie: cookieA },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/tasks`,
      payload: { title: 'Bob Task' },
      headers: { cookie: cookieB },
    });
    expect(res.statusCode).toBe(201);
  });
});

describe('PATCH /api/task-lists/:id/tasks/:tid', () => {
  it('AC-T2: owner can update task', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/tasks`,
      payload: { title: 'Task 1' },
      headers: { cookie: cookieA },
    });
    const taskId = createRes.json().task.id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/task-lists/${listId}/tasks/${taskId}`,
      payload: { status: 'IN_PROGRESS', title: 'Updated' },
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(200);
    const { task } = res.json();
    expect(task.status).toBe('IN_PROGRESS');
    expect(task.title).toBe('Updated');
  });

  it('AC-T5: READ user cannot update', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/tasks`,
      payload: { title: 'Task 1' },
      headers: { cookie: cookieA },
    });
    const taskId = createRes.json().task.id;

    await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/shares`,
      payload: { email: 'bob@example.com', permission: 'READ' },
      headers: { cookie: cookieA },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/task-lists/${listId}/tasks/${taskId}`,
      payload: { status: 'DONE' },
      headers: { cookie: cookieB },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('DELETE /api/task-lists/:id/tasks/:tid', () => {
  it('AC-T3: owner can delete task', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/tasks`,
      payload: { title: 'To Delete' },
      headers: { cookie: cookieA },
    });
    const taskId = createRes.json().task.id;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/task-lists/${listId}/tasks/${taskId}`,
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(204);
  });

  it('AC-T5: READ user cannot delete', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/tasks`,
      payload: { title: 'Task' },
      headers: { cookie: cookieA },
    });
    const taskId = createRes.json().task.id;

    await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/shares`,
      payload: { email: 'bob@example.com', permission: 'READ' },
      headers: { cookie: cookieA },
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/task-lists/${listId}/tasks/${taskId}`,
      headers: { cookie: cookieB },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('PUT /api/task-lists/:id/tasks/reorder', () => {
  it('AC-T4: reorders tasks', async () => {
    const t1 = (
      await app.inject({
        method: 'POST',
        url: `/api/task-lists/${listId}/tasks`,
        payload: { title: 'Task 1' },
        headers: { cookie: cookieA },
      })
    ).json().task.id;
    const t2 = (
      await app.inject({
        method: 'POST',
        url: `/api/task-lists/${listId}/tasks`,
        payload: { title: 'Task 2' },
        headers: { cookie: cookieA },
      })
    ).json().task.id;
    const t3 = (
      await app.inject({
        method: 'POST',
        url: `/api/task-lists/${listId}/tasks`,
        payload: { title: 'Task 3' },
        headers: { cookie: cookieA },
      })
    ).json().task.id;

    const res = await app.inject({
      method: 'PUT',
      url: `/api/task-lists/${listId}/tasks/reorder`,
      payload: { orderedIds: [t3, t1, t2] },
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(200);

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/task-lists/${listId}`,
      headers: { cookie: cookieA },
    });
    const tasks = listRes.json().list.tasks;
    expect(tasks[0].id).toBe(t3);
    expect(tasks[1].id).toBe(t1);
    expect(tasks[2].id).toBe(t2);
  });

  it('AC-T5: READ user cannot reorder', async () => {
    await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/shares`,
      payload: { email: 'bob@example.com', permission: 'READ' },
      headers: { cookie: cookieA },
    });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/task-lists/${listId}/tasks/reorder`,
      payload: { orderedIds: [] },
      headers: { cookie: cookieB },
    });
    expect(res.statusCode).toBe(403);
  });
});
