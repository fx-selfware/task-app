import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

When('I POST a task with title {string} to that list', async ({ world }, title: string) => {
  await world.request('POST', `/api/task-lists/${world.listId}/tasks`, { payload: { title }, cookie: world.myCookie });
  if (world.response.statusCode === 201) {
    world.taskId = world.response.body?.task?.id ?? null;
  }
});

Then(
  'the task has title {string} and order {int} and status {string}',
  async ({ world }, title: string, order: number, status: string) => {
    const task = world.response.body?.task;
    expect(task?.title).toBe(title);
    expect(task?.order).toBe(order);
    expect(task?.status).toBe(status);
  },
);

Then('the new task has order {int}', async ({ world }, order: number) => {
  expect(world.response.body?.task?.order).toBe(order);
});

Given('I have a task {string} in that list', async ({ world }, title: string) => {
  const res = await world.request('POST', `/api/task-lists/${world.listId}/tasks`, { payload: { title }, cookie: world.myCookie });
  world.taskId = res.body.task.id;
  world.tasksByTitle[title] = world.taskId!;
});

Given(
  'I have tasks {string}, {string}, {string} in that list',
  async ({ world }, t1: string, t2: string, t3: string) => {
    world.taskIds = [];
    for (const title of [t1, t2, t3]) {
      const res = await world.request('POST', `/api/task-lists/${world.listId}/tasks`, {
        payload: { title },
        cookie: world.myCookie,
      });
      const id = res.body.task.id;
      world.taskIds.push(id);
      world.tasksByTitle[title] = id;
    }
  },
);

When('I PATCH that task with body {string}', async ({ world }, bodyJson: string) => {
  await world.request('PATCH', `/api/task-lists/${world.listId}/tasks/${world.taskId}`, {
    payload: JSON.parse(bodyJson),
    cookie: world.myCookie,
  });
});

/** What the server sees when a write is interrupted: a body that stops mid-JSON. */
When('I PATCH that task with a body that was cut off in transit', async ({ world }) => {
  await world.request('PATCH', `/api/task-lists/${world.listId}/tasks/${world.taskId}`, {
    rawBody: '{"title":"half',
    cookie: world.myCookie,
  });
});

Then('the task has status {string} and title {string}', async ({ world }, status: string, title: string) => {
  expect(world.response.body?.task?.status).toBe(status);
  expect(world.response.body?.task?.title).toBe(title);
});

When('I DELETE that task with my cookie', async ({ world }) => {
  await world.request('DELETE', `/api/task-lists/${world.listId}/tasks/${world.taskId}`, { cookie: world.myCookie });
});

When('I PUT reorder with reverse order', async ({ world }) => {
  const reversed = [...world.taskIds].reverse();
  await world.request('PUT', `/api/task-lists/${world.listId}/tasks/reorder`, {
    payload: { orderedIds: reversed },
    cookie: world.myCookie,
  });
});

Then('the list tasks are in reverse order', async ({ world }) => {
  const listRes = await world.request('GET', `/api/task-lists/${world.listId}`, { cookie: world.myCookie });
  const tasks = listRes.body.list.tasks;
  const reversed = [...world.taskIds].reverse();
  expect(tasks[0].id).toBe(reversed[0]);
  expect(tasks[1].id).toBe(reversed[1]);
  expect(tasks[2].id).toBe(reversed[2]);
});

Given('{string} has READ access to that list', async ({ world }, email: string) => {
  await world.request('POST', `/api/task-lists/${world.listId}/shares`, {
    payload: { email, permission: 'READ' },
    cookie: world.myCookie,
  });
});

When('user {string} POSTs a task {string} to that list', async ({ world }, email: string, title: string) => {
  await world.request('POST', `/api/task-lists/${world.listId}/tasks`, {
    payload: { title },
    cookie: world.cookieFor(email),
  });
});

When('user {string} PUTs reorder on that list', async ({ world }, email: string) => {
  await world.request('PUT', `/api/task-lists/${world.listId}/tasks/reorder`, {
    payload: { orderedIds: [] },
    cookie: world.cookieFor(email),
  });
});

When('I PATCH that task with body {string} for {string}', async ({ world }, bodyJson: string, title: string) => {
  const taskId = world.tasksByTitle[title];
  await world.request('PATCH', `/api/task-lists/${world.listId}/tasks/${taskId}`, {
    payload: JSON.parse(bodyJson),
    cookie: world.myCookie,
  });
});

When('I DELETE completed tasks from that list', async ({ world }) => {
  await world.request('DELETE', `/api/task-lists/${world.listId}/tasks/completed`, { cookie: world.myCookie });
});

Then('the list contains only {string}', async ({ world }, title: string) => {
  const listRes = await world.request('GET', `/api/task-lists/${world.listId}`, { cookie: world.myCookie });
  const tasks = listRes.body.list.tasks;
  expect(tasks).toHaveLength(1);
  expect(tasks[0].title).toBe(title);
});

// --- Subtask steps ---

When('I POST a subtask with title {string} under {string}', async ({ world }, title: string, parentTitle: string) => {
  const parentId = world.tasksByTitle[parentTitle];
  await world.request('POST', `/api/task-lists/${world.listId}/tasks`, {
    payload: { title, parentId },
    cookie: world.myCookie,
  });
  if (world.response.statusCode === 201) {
    world.taskId = world.response.body?.task?.id ?? null;
    world.tasksByTitle[title] = world.taskId!;
  }
});

Then('the subtask has title {string} and order {int}', async ({ world }, title: string, order: number) => {
  const task = world.response.body?.task;
  expect(task?.title).toBe(title);
  expect(task?.order).toBe(order);
  expect(typeof task?.parentId).toBe('string');
});

Given('I have a subtask {string} under {string} in that list', async ({ world }, subTitle: string, parentTitle: string) => {
  const parentId = world.tasksByTitle[parentTitle];
  const res = await world.request('POST', `/api/task-lists/${world.listId}/tasks`, {
    payload: { title: subTitle, parentId },
    cookie: world.myCookie,
  });
  const task = res.body.task;
  world.tasksByTitle[subTitle] = task.id;
});

Then('all subtasks of {string} have status {string}', async ({ world }, parentTitle: string, status: string) => {
  const listRes = await world.request('GET', `/api/task-lists/${world.listId}`, { cookie: world.myCookie });
  const parent = listRes.body.list.tasks.find((t: any) => t.title === parentTitle);
  expect(parent).toBeTruthy();
  for (const sub of parent.subtasks ?? []) {
    expect(sub.status).toBe(status);
  }
});

Then('task {string} still has status {string}', async ({ world }, title: string, status: string) => {
  const listRes = await world.request('GET', `/api/task-lists/${world.listId}`, { cookie: world.myCookie });
  const allTasks = listRes.body.list.tasks;
  let found = allTasks.find((t: any) => t.title === title);
  if (!found) {
    for (const t of allTasks) {
      found = (t.subtasks ?? []).find((s: any) => s.title === title);
      if (found) break;
    }
  }
  expect(found).toBeTruthy();
  expect(found.status).toBe(status);
});

When('I DELETE task {string} from that list', async ({ world }, title: string) => {
  const taskId = world.tasksByTitle[title];
  await world.request('DELETE', `/api/task-lists/${world.listId}/tasks/${taskId}`, { cookie: world.myCookie });
});

Then('the list has {int} tasks', async ({ world }, count: number) => {
  const listRes = await world.request('GET', `/api/task-lists/${world.listId}`, { cookie: world.myCookie });
  const tasks = listRes.body.list.tasks;
  let total = 0;
  for (const t of tasks) {
    total += 1 + (t.subtasks?.length ?? 0);
  }
  expect(total).toBe(count);
});

Given(
  'I have subtasks {string}, {string}, {string} under {string} in that list',
  async ({ world }, s1: string, s2: string, s3: string, parentTitle: string) => {
    const parentId = world.tasksByTitle[parentTitle];
    world.taskIds = [];
    for (const title of [s1, s2, s3]) {
      const res = await world.request('POST', `/api/task-lists/${world.listId}/tasks`, {
        payload: { title, parentId },
        cookie: world.myCookie,
      });
      const id = res.body.task.id;
      world.taskIds.push(id);
      world.tasksByTitle[title] = id;
    }
  },
);

When('I PUT reorder subtasks under {string} with reverse order', async ({ world }, parentTitle: string) => {
  const parentId = world.tasksByTitle[parentTitle];
  const reversed = [...world.taskIds].reverse();
  await world.request('PUT', `/api/task-lists/${world.listId}/tasks/reorder`, {
    payload: { orderedIds: reversed, parentId },
    cookie: world.myCookie,
  });
});

Then('the subtasks of {string} are in reverse order', async ({ world }, parentTitle: string) => {
  const listRes = await world.request('GET', `/api/task-lists/${world.listId}`, { cookie: world.myCookie });
  const parent = listRes.body.list.tasks.find((t: any) => t.title === parentTitle);
  const reversed = [...world.taskIds].reverse();
  for (let i = 0; i < reversed.length; i++) {
    expect(parent.subtasks[i].id).toBe(reversed[i]);
  }
});

When('I DELETE completed subtasks of {string} from that list', async ({ world }, parentTitle: string) => {
  const parentId = world.tasksByTitle[parentTitle];
  await world.request('DELETE', `/api/task-lists/${world.listId}/tasks/${parentId}/subtasks/completed`, {
    cookie: world.myCookie,
  });
});

// --- Move task steps ---

When('I move task {string} to top-level in that list', async ({ world }, title: string) => {
  const taskId = world.tasksByTitle[title];
  await world.request('PATCH', `/api/task-lists/${world.listId}/tasks/${taskId}/move`, {
    payload: { parentId: null },
    cookie: world.myCookie,
  });
});

When('I move task {string} under {string} in that list', async ({ world }, title: string, parentTitle: string) => {
  const taskId = world.tasksByTitle[title];
  const parentId = world.tasksByTitle[parentTitle];
  await world.request('PATCH', `/api/task-lists/${world.listId}/tasks/${taskId}/move`, {
    payload: { parentId },
    cookie: world.myCookie,
  });
});

Then(
  'the top-level task order is {string}, {string}, {string}, {string}',
  async ({ world }, t1: string, t2: string, t3: string, t4: string) => {
    const listRes = await world.request('GET', `/api/task-lists/${world.listId}`, { cookie: world.myCookie });
    const titles = listRes.body.list.tasks.map((t: any) => t.title);
    expect(titles).toEqual([t1, t2, t3, t4]);
  },
);

Then('task {string} is a subtask of {string}', async ({ world }, childTitle: string, parentTitle: string) => {
  const listRes = await world.request('GET', `/api/task-lists/${world.listId}`, { cookie: world.myCookie });
  const parent = listRes.body.list.tasks.find((t: any) => t.title === parentTitle);
  expect(parent).toBeTruthy();
  const child = (parent.subtasks ?? []).find((s: any) => s.title === childTitle);
  expect(child).toBeTruthy();
});

Then('task {string} has {int} subtask(s)', async ({ world }, parentTitle: string, count: number) => {
  const listRes = await world.request('GET', `/api/task-lists/${world.listId}`, { cookie: world.myCookie });
  const parent = listRes.body.list.tasks.find((t: any) => t.title === parentTitle);
  expect(parent.subtasks).toHaveLength(count);
});
