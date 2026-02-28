import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { AppWorld } from './world';

Given('I have a template named {string}', async function (this: AppWorld, name: string) {
  const res = await this.app.inject({
    method: 'POST',
    url: '/api/templates',
    payload: { name },
    headers: { cookie: this.myCookie },
  });
  this.templateId = res.json().template.id;
});

Given(
  'user {string} has a template named {string}',
  async function (this: AppWorld, email: string, name: string) {
    await this.app.inject({
      method: 'POST',
      url: '/api/templates',
      payload: { name },
      headers: { cookie: this.cookieFor(email) },
    });
  },
);

Given(
  'I add a template task {string} to that template',
  async function (this: AppWorld, title: string) {
    const res = await this.app.inject({
      method: 'POST',
      url: `/api/templates/${this.templateId}/tasks`,
      payload: { title },
      headers: { cookie: this.myCookie },
    });
    this.templateTaskId = res.json().task.id;
  },
);

Given(
  'I have a template named {string} with tasks {string} and {string}',
  async function (this: AppWorld, name: string, task1: string, task2: string) {
    const res = await this.app.inject({
      method: 'POST',
      url: '/api/templates',
      payload: { name },
      headers: { cookie: this.myCookie },
    });
    this.templateId = res.json().template.id;
    for (const title of [task1, task2]) {
      await this.app.inject({
        method: 'POST',
        url: `/api/templates/${this.templateId}/tasks`,
        payload: { title },
        headers: { cookie: this.myCookie },
      });
    }
  },
);

Given(
  'I have a template named {string} with tasks {string}, {string} and {string}',
  async function (this: AppWorld, name: string, t1: string, t2: string, t3: string) {
    const res = await this.app.inject({
      method: 'POST',
      url: '/api/templates',
      payload: { name },
      headers: { cookie: this.myCookie },
    });
    this.templateId = res.json().template.id;
    this.taskIds = [];
    for (const title of [t1, t2, t3]) {
      const taskRes = await this.app.inject({
        method: 'POST',
        url: `/api/templates/${this.templateId}/tasks`,
        payload: { title },
        headers: { cookie: this.myCookie },
      });
      this.taskIds.push(taskRes.json().task.id);
    }
  },
);

Given(
  'that list has a task {string}',
  async function (this: AppWorld, title: string) {
    await this.app.inject({
      method: 'POST',
      url: `/api/task-lists/${this.listId}/tasks`,
      payload: { title },
      headers: { cookie: this.myCookie },
    });
  },
);

When('I GET that template', async function (this: AppWorld) {
  await this.request('GET', `/api/templates/${this.templateId}`, {
    cookie: this.myCookie,
  });
});

When(
  'user {string} GETs that template',
  async function (this: AppWorld, email: string) {
    await this.request('GET', `/api/templates/${this.templateId}`, {
      cookie: this.cookieFor(email),
    });
  },
);

When(
  'I PATCH that template with body {string}',
  async function (this: AppWorld, bodyJson: string) {
    await this.request('PATCH', `/api/templates/${this.templateId}`, {
      payload: JSON.parse(bodyJson),
      cookie: this.myCookie,
    });
  },
);

When('I DELETE that template', async function (this: AppWorld) {
  await this.request('DELETE', `/api/templates/${this.templateId}`, {
    cookie: this.myCookie,
  });
});

When(
  'I POST a template task {string} with description {string}',
  async function (this: AppWorld, title: string, description: string) {
    await this.request('POST', `/api/templates/${this.templateId}/tasks`, {
      payload: { title, description },
      cookie: this.myCookie,
    });
    if (this.response.statusCode === 201) {
      this.templateTaskId = this.response.body?.task?.id ?? null;
    }
  },
);

When(
  'I PATCH that template task with body {string}',
  async function (this: AppWorld, bodyJson: string) {
    await this.request(
      'PATCH',
      `/api/templates/${this.templateId}/tasks/${this.templateTaskId}`,
      {
        payload: JSON.parse(bodyJson),
        cookie: this.myCookie,
      },
    );
  },
);

When('I DELETE that template task', async function (this: AppWorld) {
  await this.request(
    'DELETE',
    `/api/templates/${this.templateId}/tasks/${this.templateTaskId}`,
    { cookie: this.myCookie },
  );
});

When('I apply that template to that list', async function (this: AppWorld) {
  await this.request('POST', `/api/templates/${this.templateId}/apply`, {
    payload: { taskListId: this.listId },
    cookie: this.myCookie,
  });
});

Then(
  'the response body has template.name {string}',
  async function (this: AppWorld, name: string) {
    expect(this.response.body?.template?.name).to.equal(name);
  },
);

Then(
  'there is {int} template named {string}',
  async function (this: AppWorld, count: number, name: string) {
    const owned = this.response.body?.owned ?? [];
    expect(owned).to.have.length(count);
    if (count > 0) expect(owned[0].name).to.equal(name);
  },
);

Then(
  'the template has {int} task named {string}',
  async function (this: AppWorld, count: number, name: string) {
    const tasks = this.response.body?.template?.tasks ?? [];
    expect(tasks).to.have.length(count);
    if (count > 0) expect(tasks[0].title).to.equal(name);
  },
);

Then(
  'the template task has title {string}',
  async function (this: AppWorld, title: string) {
    expect(this.response.body?.task?.title).to.equal(title);
  },
);

Then('{int} tasks are returned', async function (this: AppWorld, count: number) {
  expect(this.response.body?.tasks).to.have.length(count);
});

Then(
  'the first applied task has order {int}',
  async function (this: AppWorld, order: number) {
    expect(this.response.body?.tasks?.[0]?.order).to.equal(order);
  },
);

Then('the list has {int} total tasks', async function (this: AppWorld, count: number) {
  const listRes = await this.app.inject({
    method: 'GET',
    url: `/api/task-lists/${this.listId}`,
    headers: { cookie: this.myCookie },
  });
  expect(listRes.json().list.tasks).to.have.length(count);
});

When('I PUT reorder template tasks with reverse order', async function (this: AppWorld) {
  const reversed = [...this.taskIds].reverse();
  await this.request('PUT', `/api/templates/${this.templateId}/tasks/reorder`, {
    payload: { orderedIds: reversed },
    cookie: this.myCookie,
  });
});

Then('the template tasks are in reverse order', async function (this: AppWorld) {
  const res = await this.app.inject({
    method: 'GET',
    url: `/api/templates/${this.templateId}`,
    headers: { cookie: this.myCookie },
  });
  const tasks = res.json().template.tasks;
  const reversed = [...this.taskIds].reverse();
  expect(tasks[0].id).to.equal(reversed[0]);
  expect(tasks[1].id).to.equal(reversed[1]);
  expect(tasks[2].id).to.equal(reversed[2]);
});

When(
  'user {string} PUTs reorder on that template',
  async function (this: AppWorld, email: string) {
    await this.request('PUT', `/api/templates/${this.templateId}/tasks/reorder`, {
      payload: { orderedIds: [] },
      cookie: this.cookieFor(email),
    });
  },
);
