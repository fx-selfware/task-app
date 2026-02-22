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
      this.taskIds.push(res.json().task.id);
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
