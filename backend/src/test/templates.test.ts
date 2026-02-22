import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getApp, closeApp, clearDb, registerAndLogin } from './helpers';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let cookieA: string;
let cookieB: string;

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
});

describe('POST /api/templates', () => {
  it('AC-TP1: creates template', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/templates',
      payload: { name: 'Sprint Template' },
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(201);
    const { template } = res.json();
    expect(template.name).toBe('Sprint Template');
  });
});

describe('GET /api/templates', () => {
  it('AC-TP2: returns only own templates', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/templates',
      payload: { name: 'Alice Template' },
      headers: { cookie: cookieA },
    });
    await app.inject({
      method: 'POST',
      url: '/api/templates',
      payload: { name: 'Bob Template' },
      headers: { cookie: cookieB },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/templates',
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(200);
    const { templates } = res.json();
    expect(templates).toHaveLength(1);
    expect(templates[0].name).toBe('Alice Template');
  });
});

describe('GET /api/templates/:id', () => {
  it('AC-TP3: owner gets template with tasks', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/templates',
      payload: { name: 'My Template' },
      headers: { cookie: cookieA },
    });
    const templateId = createRes.json().template.id;

    await app.inject({
      method: 'POST',
      url: `/api/templates/${templateId}/tasks`,
      payload: { title: 'Task A' },
      headers: { cookie: cookieA },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/templates/${templateId}`,
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(200);
    const { template } = res.json();
    expect(template.tasks).toHaveLength(1);
    expect(template.tasks[0].title).toBe('Task A');
  });

  it('AC-SEC3: non-owner gets 404', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/templates',
      payload: { name: 'Alice Template' },
      headers: { cookie: cookieA },
    });
    const templateId = createRes.json().template.id;

    const res = await app.inject({
      method: 'GET',
      url: `/api/templates/${templateId}`,
      headers: { cookie: cookieB },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('PATCH/DELETE /api/templates/:id', () => {
  it('AC-TP4: owner can rename', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/templates',
      payload: { name: 'Old Name' },
      headers: { cookie: cookieA },
    });
    const templateId = createRes.json().template.id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/templates/${templateId}`,
      payload: { name: 'New Name' },
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().template.name).toBe('New Name');
  });

  it('AC-TP4: owner can delete', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/templates',
      payload: { name: 'To Delete' },
      headers: { cookie: cookieA },
    });
    const templateId = createRes.json().template.id;

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/templates/${templateId}`,
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(204);
  });
});

describe('Template task CRUD', () => {
  let templateId: string;

  beforeEach(async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/templates',
      payload: { name: 'My Template' },
      headers: { cookie: cookieA },
    });
    templateId = res.json().template.id;
  });

  it('AC-TP5: creates, updates, deletes template task', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/templates/${templateId}/tasks`,
      payload: { title: 'Task A', description: 'Do this' },
      headers: { cookie: cookieA },
    });
    expect(createRes.statusCode).toBe(201);
    const taskId = createRes.json().task.id;

    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/templates/${templateId}/tasks/${taskId}`,
      payload: { title: 'Updated Task A' },
      headers: { cookie: cookieA },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().task.title).toBe('Updated Task A');

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/templates/${templateId}/tasks/${taskId}`,
      headers: { cookie: cookieA },
    });
    expect(deleteRes.statusCode).toBe(204);
  });
});

describe('POST /api/templates/:id/apply', () => {
  it('AC-TP6: applies template tasks to list', async () => {
    const templateRes = await app.inject({
      method: 'POST',
      url: '/api/templates',
      payload: { name: 'Sprint' },
      headers: { cookie: cookieA },
    });
    const templateId = templateRes.json().template.id;

    await app.inject({
      method: 'POST',
      url: `/api/templates/${templateId}/tasks`,
      payload: { title: 'Task 1' },
      headers: { cookie: cookieA },
    });
    await app.inject({
      method: 'POST',
      url: `/api/templates/${templateId}/tasks`,
      payload: { title: 'Task 2' },
      headers: { cookie: cookieA },
    });

    const listRes = await app.inject({
      method: 'POST',
      url: '/api/task-lists',
      payload: { name: 'My List' },
      headers: { cookie: cookieA },
    });
    const listId = listRes.json().list.id;

    // Add existing task first
    await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/tasks`,
      payload: { title: 'Pre-existing' },
      headers: { cookie: cookieA },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/templates/${templateId}/apply`,
      payload: { taskListId: listId },
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(201);
    const { tasks } = res.json();
    expect(tasks).toHaveLength(2);
    expect(tasks[0].title).toBe('Task 1');
    expect(tasks[0].status).toBe('TODO');
    expect(tasks[0].order).toBe(1); // appended after pre-existing

    // Verify total tasks on list
    const listDetail = await app.inject({
      method: 'GET',
      url: `/api/task-lists/${listId}`,
      headers: { cookie: cookieA },
    });
    expect(listDetail.json().list.tasks).toHaveLength(3);
  });

  it('AC-TP6: write permission user can apply template', async () => {
    const templateRes = await app.inject({
      method: 'POST',
      url: '/api/templates',
      payload: { name: 'My Template' },
      headers: { cookie: cookieA },
    });
    const templateId = templateRes.json().template.id;

    const listRes = await app.inject({
      method: 'POST',
      url: '/api/task-lists',
      payload: { name: 'Bob List' },
      headers: { cookie: cookieB },
    });
    const listId = listRes.json().list.id;

    // Share Bob's list with Alice (WRITE)
    await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/shares`,
      payload: { email: 'alice@example.com', permission: 'WRITE' },
      headers: { cookie: cookieB },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/templates/${templateId}/apply`,
      payload: { taskListId: listId },
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(201);
  });

  it('READ permission user cannot apply template', async () => {
    const templateRes = await app.inject({
      method: 'POST',
      url: '/api/templates',
      payload: { name: 'My Template' },
      headers: { cookie: cookieA },
    });
    const templateId = templateRes.json().template.id;

    const listRes = await app.inject({
      method: 'POST',
      url: '/api/task-lists',
      payload: { name: 'Bob List' },
      headers: { cookie: cookieB },
    });
    const listId = listRes.json().list.id;

    await app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/shares`,
      payload: { email: 'alice@example.com', permission: 'READ' },
      headers: { cookie: cookieB },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/templates/${templateId}/apply`,
      payload: { taskListId: listId },
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(403);
  });
});
