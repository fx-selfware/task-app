import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { AppWorld } from './world';

When(
  'I POST a task with title {string} to that list',
  async function (this: AppWorld, title: string) {
    await this.request('POST', `/api/task-lists/${this.listId}/tasks`, {
      payload: { title },
      cookie: this.myCookie,
    });
    if (this.response.statusCode === 201) {
      this.taskId = this.response.body?.task?.id ?? null;
    }
  },
);

Then(
  'the task has title {string} and order {int} and status {string}',
  async function (this: AppWorld, title: string, order: number, status: string) {
    const task = this.response.body?.task;
    expect(task?.title).to.equal(title);
    expect(task?.order).to.equal(order);
    expect(task?.status).to.equal(status);
  },
);

Then('the new task has order {int}', async function (this: AppWorld, order: number) {
  expect(this.response.body?.task?.order).to.equal(order);
});

Given('I have a task {string} in that list', async function (this: AppWorld, title: string) {
  const res = await this.app.inject({
    method: 'POST',
    url: `/api/task-lists/${this.listId}/tasks`,
    payload: { title },
    headers: { cookie: this.myCookie },
  });
  this.taskId = res.json().task.id;
  this.tasksByTitle[title] = this.taskId!;
});

Given(
  'I have tasks {string}, {string}, {string} in that list',
  async function (this: AppWorld, t1: string, t2: string, t3: string) {
    this.taskIds = [];
    for (const title of [t1, t2, t3]) {
      const res = await this.app.inject({
        method: 'POST',
        url: `/api/task-lists/${this.listId}/tasks`,
        payload: { title },
        headers: { cookie: this.myCookie },
      });
      const id = res.json().task.id;
      this.taskIds.push(id);
      this.tasksByTitle[title] = id;
    }
  },
);

When(
  'I PATCH that task with body {string}',
  async function (this: AppWorld, bodyJson: string) {
    await this.request('PATCH', `/api/task-lists/${this.listId}/tasks/${this.taskId}`, {
      payload: JSON.parse(bodyJson),
      cookie: this.myCookie,
    });
  },
);

Then(
  'the task has status {string} and title {string}',
  async function (this: AppWorld, status: string, title: string) {
    expect(this.response.body?.task?.status).to.equal(status);
    expect(this.response.body?.task?.title).to.equal(title);
  },
);

When('I DELETE that task with my cookie', async function (this: AppWorld) {
  await this.request('DELETE', `/api/task-lists/${this.listId}/tasks/${this.taskId}`, {
    cookie: this.myCookie,
  });
});

When('I PUT reorder with reverse order', async function (this: AppWorld) {
  const reversed = [...this.taskIds].reverse();
  await this.request('PUT', `/api/task-lists/${this.listId}/tasks/reorder`, {
    payload: { orderedIds: reversed },
    cookie: this.myCookie,
  });
});

Then('the list tasks are in reverse order', async function (this: AppWorld) {
  const listRes = await this.app.inject({
    method: 'GET',
    url: `/api/task-lists/${this.listId}`,
    headers: { cookie: this.myCookie },
  });
  const tasks = listRes.json().list.tasks;
  const reversed = [...this.taskIds].reverse();
  expect(tasks[0].id).to.equal(reversed[0]);
  expect(tasks[1].id).to.equal(reversed[1]);
  expect(tasks[2].id).to.equal(reversed[2]);
});

Given(
  '{string} has READ access to that list',
  async function (this: AppWorld, email: string) {
    await this.app.inject({
      method: 'POST',
      url: `/api/task-lists/${this.listId}/shares`,
      payload: { email, permission: 'READ' },
      headers: { cookie: this.myCookie },
    });
  },
);

When(
  'user {string} POSTs a task {string} to that list',
  async function (this: AppWorld, email: string, title: string) {
    await this.request('POST', `/api/task-lists/${this.listId}/tasks`, {
      payload: { title },
      cookie: this.cookieFor(email),
    });
  },
);

When(
  'user {string} PUTs reorder on that list',
  async function (this: AppWorld, email: string) {
    await this.request('PUT', `/api/task-lists/${this.listId}/tasks/reorder`, {
      payload: { orderedIds: [] },
      cookie: this.cookieFor(email),
    });
  },
);

When(
  'I PATCH that task with body {string} for {string}',
  async function (this: AppWorld, bodyJson: string, title: string) {
    const taskId = this.tasksByTitle[title];
    await this.request('PATCH', `/api/task-lists/${this.listId}/tasks/${taskId}`, {
      payload: JSON.parse(bodyJson),
      cookie: this.myCookie,
    });
  },
);

When('I DELETE completed tasks from that list', async function (this: AppWorld) {
  await this.request('DELETE', `/api/task-lists/${this.listId}/tasks/completed`, {
    cookie: this.myCookie,
  });
});

Then('the list contains only {string}', async function (this: AppWorld, title: string) {
  const listRes = await this.app.inject({
    method: 'GET',
    url: `/api/task-lists/${this.listId}`,
    headers: { cookie: this.myCookie },
  });
  const tasks = listRes.json().list.tasks;
  expect(tasks).to.have.length(1);
  expect(tasks[0].title).to.equal(title);
});

// --- Subtask steps ---

When(
  'I POST a subtask with title {string} under {string}',
  async function (this: AppWorld, title: string, parentTitle: string) {
    const parentId = this.tasksByTitle[parentTitle];
    await this.request('POST', `/api/task-lists/${this.listId}/tasks`, {
      payload: { title, parentId },
      cookie: this.myCookie,
    });
    if (this.response.statusCode === 201) {
      this.taskId = this.response.body?.task?.id ?? null;
      this.tasksByTitle[title] = this.taskId!;
    }
  },
);

Then(
  'the subtask has title {string} and order {int}',
  async function (this: AppWorld, title: string, order: number) {
    const task = this.response.body?.task;
    expect(task?.title).to.equal(title);
    expect(task?.order).to.equal(order);
    expect(task?.parentId).to.be.a('string');
  },
);

Given(
  'I have a subtask {string} under {string} in that list',
  async function (this: AppWorld, subTitle: string, parentTitle: string) {
    const parentId = this.tasksByTitle[parentTitle];
    const res = await this.app.inject({
      method: 'POST',
      url: `/api/task-lists/${this.listId}/tasks`,
      payload: { title: subTitle, parentId },
      headers: { cookie: this.myCookie },
    });
    const task = res.json().task;
    this.tasksByTitle[subTitle] = task.id;
  },
);

Then(
  'all subtasks of {string} have status {string}',
  async function (this: AppWorld, parentTitle: string, status: string) {
    const listRes = await this.app.inject({
      method: 'GET',
      url: `/api/task-lists/${this.listId}`,
      headers: { cookie: this.myCookie },
    });
    const parent = listRes.json().list.tasks.find(
      (t: any) => t.title === parentTitle,
    );
    expect(parent).to.exist;
    for (const sub of parent.subtasks ?? []) {
      expect(sub.status).to.equal(status);
    }
  },
);

Then(
  'task {string} still has status {string}',
  async function (this: AppWorld, title: string, status: string) {
    const listRes = await this.app.inject({
      method: 'GET',
      url: `/api/task-lists/${this.listId}`,
      headers: { cookie: this.myCookie },
    });
    const allTasks = listRes.json().list.tasks;
    // Parent is top-level, subtask could be nested
    let found = allTasks.find((t: any) => t.title === title);
    if (!found) {
      for (const t of allTasks) {
        found = (t.subtasks ?? []).find((s: any) => s.title === title);
        if (found) break;
      }
    }
    expect(found).to.exist;
    expect(found.status).to.equal(status);
  },
);

When(
  'I DELETE task {string} from that list',
  async function (this: AppWorld, title: string) {
    const taskId = this.tasksByTitle[title];
    await this.request('DELETE', `/api/task-lists/${this.listId}/tasks/${taskId}`, {
      cookie: this.myCookie,
    });
  },
);

Then('the list has {int} tasks', async function (this: AppWorld, count: number) {
  const listRes = await this.app.inject({
    method: 'GET',
    url: `/api/task-lists/${this.listId}`,
    headers: { cookie: this.myCookie },
  });
  const tasks = listRes.json().list.tasks;
  // Count top-level + all subtasks
  let total = 0;
  for (const t of tasks) {
    total += 1 + (t.subtasks?.length ?? 0);
  }
  expect(total).to.equal(count);
});

Given(
  'I have subtasks {string}, {string}, {string} under {string} in that list',
  async function (this: AppWorld, s1: string, s2: string, s3: string, parentTitle: string) {
    const parentId = this.tasksByTitle[parentTitle];
    this.taskIds = [];
    for (const title of [s1, s2, s3]) {
      const res = await this.app.inject({
        method: 'POST',
        url: `/api/task-lists/${this.listId}/tasks`,
        payload: { title, parentId },
        headers: { cookie: this.myCookie },
      });
      const id = res.json().task.id;
      this.taskIds.push(id);
      this.tasksByTitle[title] = id;
    }
  },
);

When(
  'I PUT reorder subtasks under {string} with reverse order',
  async function (this: AppWorld, parentTitle: string) {
    const parentId = this.tasksByTitle[parentTitle];
    const reversed = [...this.taskIds].reverse();
    await this.request('PUT', `/api/task-lists/${this.listId}/tasks/reorder`, {
      payload: { orderedIds: reversed, parentId },
      cookie: this.myCookie,
    });
  },
);

Then(
  'the subtasks of {string} are in reverse order',
  async function (this: AppWorld, parentTitle: string) {
    const listRes = await this.app.inject({
      method: 'GET',
      url: `/api/task-lists/${this.listId}`,
      headers: { cookie: this.myCookie },
    });
    const parent = listRes.json().list.tasks.find(
      (t: any) => t.title === parentTitle,
    );
    const reversed = [...this.taskIds].reverse();
    for (let i = 0; i < reversed.length; i++) {
      expect(parent.subtasks[i].id).to.equal(reversed[i]);
    }
  },
);

When(
  'I DELETE completed subtasks of {string} from that list',
  async function (this: AppWorld, parentTitle: string) {
    const parentId = this.tasksByTitle[parentTitle];
    await this.request(
      'DELETE',
      `/api/task-lists/${this.listId}/tasks/${parentId}/subtasks/completed`,
      { cookie: this.myCookie },
    );
  },
);

// --- Move task steps ---

When(
  'I move task {string} to top-level in that list',
  async function (this: AppWorld, title: string) {
    const taskId = this.tasksByTitle[title];
    await this.request('PATCH', `/api/task-lists/${this.listId}/tasks/${taskId}/move`, {
      payload: { parentId: null },
      cookie: this.myCookie,
    });
  },
);

When(
  'I move task {string} under {string} in that list',
  async function (this: AppWorld, title: string, parentTitle: string) {
    const taskId = this.tasksByTitle[title];
    const parentId = this.tasksByTitle[parentTitle];
    await this.request('PATCH', `/api/task-lists/${this.listId}/tasks/${taskId}/move`, {
      payload: { parentId },
      cookie: this.myCookie,
    });
  },
);

Then(
  'the top-level task order is {string}, {string}, {string}, {string}',
  async function (this: AppWorld, t1: string, t2: string, t3: string, t4: string) {
    const listRes = await this.app.inject({
      method: 'GET',
      url: `/api/task-lists/${this.listId}`,
      headers: { cookie: this.myCookie },
    });
    const titles = listRes.json().list.tasks.map((t: any) => t.title);
    expect(titles).to.deep.equal([t1, t2, t3, t4]);
  },
);

Then(
  'task {string} is a subtask of {string}',
  async function (this: AppWorld, childTitle: string, parentTitle: string) {
    const listRes = await this.app.inject({
      method: 'GET',
      url: `/api/task-lists/${this.listId}`,
      headers: { cookie: this.myCookie },
    });
    const parent = listRes.json().list.tasks.find((t: any) => t.title === parentTitle);
    expect(parent).to.exist;
    const child = (parent.subtasks ?? []).find((s: any) => s.title === childTitle);
    expect(child).to.exist;
  },
);

Then(
  'task {string} has {int} subtask(s)',
  async function (this: AppWorld, parentTitle: string, count: number) {
    const listRes = await this.app.inject({
      method: 'GET',
      url: `/api/task-lists/${this.listId}`,
      headers: { cookie: this.myCookie },
    });
    const parent = listRes.json().list.tasks.find(
      (t: any) => t.title === parentTitle,
    );
    expect(parent.subtasks).to.have.length(count);
  },
);
