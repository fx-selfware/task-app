import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

Given('I have a template named {string}', async ({ world }, name: string) => {
  const res = await world.request('POST', '/api/templates', { payload: { name }, cookie: world.myCookie });
  world.templateId = res.body.template.id;
});

Given('user {string} has a template named {string}', async ({ world }, email: string, name: string) => {
  await world.request('POST', '/api/templates', { payload: { name }, cookie: world.cookieFor(email) });
});

Given('I add a template task {string} to that template', async ({ world }, title: string) => {
  const res = await world.request('POST', `/api/templates/${world.templateId}/tasks`, {
    payload: { title },
    cookie: world.myCookie,
  });
  world.templateTaskId = res.body.task.id;
  world.tasksByTitle[title] = world.templateTaskId!;
});

Given(
  'I have a template named {string} with tasks {string} and {string}',
  async ({ world }, name: string, task1: string, task2: string) => {
    const res = await world.request('POST', '/api/templates', { payload: { name }, cookie: world.myCookie });
    world.templateId = res.body.template.id;
    for (const title of [task1, task2]) {
      await world.request('POST', `/api/templates/${world.templateId}/tasks`, {
        payload: { title },
        cookie: world.myCookie,
      });
    }
  },
);

Given(
  'I have a template named {string} with tasks {string}, {string} and {string}',
  async ({ world }, name: string, t1: string, t2: string, t3: string) => {
    const res = await world.request('POST', '/api/templates', { payload: { name }, cookie: world.myCookie });
    world.templateId = res.body.template.id;
    world.taskIds = [];
    for (const title of [t1, t2, t3]) {
      const taskRes = await world.request('POST', `/api/templates/${world.templateId}/tasks`, {
        payload: { title },
        cookie: world.myCookie,
      });
      world.taskIds.push(taskRes.body.task.id);
    }
  },
);

Given('that list has a task {string}', async ({ world }, title: string) => {
  await world.request('POST', `/api/task-lists/${world.listId}/tasks`, { payload: { title }, cookie: world.myCookie });
});

When('I GET that template', async ({ world }) => {
  await world.request('GET', `/api/templates/${world.templateId}`, { cookie: world.myCookie });
});

When('user {string} GETs that template', async ({ world }, email: string) => {
  await world.request('GET', `/api/templates/${world.templateId}`, { cookie: world.cookieFor(email) });
});

When('I PATCH that template with body {string}', async ({ world }, bodyJson: string) => {
  await world.request('PATCH', `/api/templates/${world.templateId}`, {
    payload: JSON.parse(bodyJson),
    cookie: world.myCookie,
  });
});

When('I DELETE that template', async ({ world }) => {
  await world.request('DELETE', `/api/templates/${world.templateId}`, { cookie: world.myCookie });
});

When('I POST a template task {string} with description {string}', async ({ world }, title: string, description: string) => {
  await world.request('POST', `/api/templates/${world.templateId}/tasks`, {
    payload: { title, description },
    cookie: world.myCookie,
  });
  if (world.response.statusCode === 201) {
    world.templateTaskId = world.response.body?.task?.id ?? null;
  }
});

When('I PATCH that template task with body {string}', async ({ world }, bodyJson: string) => {
  await world.request('PATCH', `/api/templates/${world.templateId}/tasks/${world.templateTaskId}`, {
    payload: JSON.parse(bodyJson),
    cookie: world.myCookie,
  });
});

When('I DELETE that template task', async ({ world }) => {
  await world.request('DELETE', `/api/templates/${world.templateId}/tasks/${world.templateTaskId}`, {
    cookie: world.myCookie,
  });
});

When('I apply that template to that list', async ({ world }) => {
  await world.request('POST', `/api/templates/${world.templateId}/apply`, {
    payload: { taskListId: world.listId },
    cookie: world.myCookie,
  });
});

Then('the response body has template.name {string}', async ({ world }, name: string) => {
  expect(world.response.body?.template?.name).toBe(name);
});

Then('there is {int} template named {string}', async ({ world }, count: number, name: string) => {
  const owned = world.response.body?.owned ?? [];
  expect(owned).toHaveLength(count);
  if (count > 0) expect(owned[0].name).toBe(name);
});

Then('the template has {int} task named {string}', async ({ world }, count: number, name: string) => {
  const tasks = world.response.body?.template?.tasks ?? [];
  expect(tasks).toHaveLength(count);
  if (count > 0) expect(tasks[0].title).toBe(name);
});

Then('the template task has title {string}', async ({ world }, title: string) => {
  expect(world.response.body?.task?.title).toBe(title);
});

Then('{int} tasks are returned', async ({ world }, count: number) => {
  expect(world.response.body?.tasks).toHaveLength(count);
});

Then('the first applied task has order {int}', async ({ world }, order: number) => {
  expect(world.response.body?.tasks?.[0]?.order).toBe(order);
});

Then('the list has {int} total tasks', async ({ world }, count: number) => {
  const listRes = await world.request('GET', `/api/task-lists/${world.listId}`, { cookie: world.myCookie });
  expect(listRes.body.list.tasks).toHaveLength(count);
});

When('I PUT reorder template tasks with reverse order', async ({ world }) => {
  const reversed = [...world.taskIds].reverse();
  await world.request('PUT', `/api/templates/${world.templateId}/tasks/reorder`, {
    payload: { orderedIds: reversed },
    cookie: world.myCookie,
  });
});

Then('the template tasks are in reverse order', async ({ world }) => {
  const res = await world.request('GET', `/api/templates/${world.templateId}`, { cookie: world.myCookie });
  const tasks = res.body.template.tasks;
  const reversed = [...world.taskIds].reverse();
  expect(tasks[0].id).toBe(reversed[0]);
  expect(tasks[1].id).toBe(reversed[1]);
  expect(tasks[2].id).toBe(reversed[2]);
});

When('user {string} PUTs reorder on that template', async ({ world }, email: string) => {
  await world.request('PUT', `/api/templates/${world.templateId}/tasks/reorder`, {
    payload: { orderedIds: [] },
    cookie: world.cookieFor(email),
  });
});

// --- Move template task steps ---

When('I move template task {string} to top-level', async ({ world }, title: string) => {
  const taskId = world.tasksByTitle[title];
  await world.request('PATCH', `/api/templates/${world.templateId}/tasks/${taskId}/move`, {
    payload: { parentId: null },
    cookie: world.myCookie,
  });
});

When('I move template task {string} under {string}', async ({ world }, title: string, parentTitle: string) => {
  const taskId = world.tasksByTitle[title];
  const parentId = world.tasksByTitle[parentTitle];
  await world.request('PATCH', `/api/templates/${world.templateId}/tasks/${taskId}/move`, {
    payload: { parentId },
    cookie: world.myCookie,
  });
});

Then(
  'the template top-level order is {string}, {string}, {string}, {string}',
  async ({ world }, t1: string, t2: string, t3: string, t4: string) => {
    const res = await world.request('GET', `/api/templates/${world.templateId}`, { cookie: world.myCookie });
    const titles = res.body.template.tasks.map((t: any) => t.title);
    expect(titles).toEqual([t1, t2, t3, t4]);
  },
);

Then('template task {string} is a subtask of {string}', async ({ world }, childTitle: string, parentTitle: string) => {
  const res = await world.request('GET', `/api/templates/${world.templateId}`, { cookie: world.myCookie });
  const parent = res.body.template.tasks.find((t: any) => t.title === parentTitle);
  expect(parent).toBeTruthy();
  const child = (parent.subtasks ?? []).find((s: any) => s.title === childTitle);
  expect(child).toBeTruthy();
});

// --- Template subtask steps ---

When('I POST a template subtask {string} under {string}', async ({ world }, title: string, parentTitle: string) => {
  const parentId = world.tasksByTitle[parentTitle];
  await world.request('POST', `/api/templates/${world.templateId}/tasks`, {
    payload: { title, parentId },
    cookie: world.myCookie,
  });
  if (world.response.statusCode === 201) {
    world.tasksByTitle[title] = world.response.body?.task?.id;
  }
});

Given('I add a template subtask {string} under {string}', async ({ world }, subTitle: string, parentTitle: string) => {
  const parentId = world.tasksByTitle[parentTitle];
  const res = await world.request('POST', `/api/templates/${world.templateId}/tasks`, {
    payload: { title: subTitle, parentId },
    cookie: world.myCookie,
  });
  world.tasksByTitle[subTitle] = res.body.task.id;
});

Then('the template subtask has title {string}', async ({ world }, title: string) => {
  expect(world.response.body?.task?.title).toBe(title);
  expect(typeof world.response.body?.task?.parentId).toBe('string');
});

Then('the list task {string} has {int} subtasks', async ({ world }, title: string, count: number) => {
  const listRes = await world.request('GET', `/api/task-lists/${world.listId}`, { cookie: world.myCookie });
  const parent = listRes.body.list.tasks.find((t: any) => t.title === title);
  expect(parent).toBeTruthy();
  expect(parent.subtasks).toHaveLength(count);
});
