import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { AppWorld } from './world';

Given('I own a task list named {string}', async function (this: AppWorld, name: string) {
  const res = await this.app.inject({
    method: 'POST',
    url: '/api/task-lists',
    payload: { name },
    headers: { cookie: this.myCookie },
  });
  this.listId = res.json().list.id;
});

Given(
  'user {string} owns a task list named {string} shared with me as READ',
  async function (this: AppWorld, email: string, name: string) {
    const bobCookie = this.cookieFor(email);
    const listRes = await this.app.inject({
      method: 'POST',
      url: '/api/task-lists',
      payload: { name },
      headers: { cookie: bobCookie },
    });
    const listId = listRes.json().list.id;

    const meRes = await this.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: this.myCookie },
    });
    const myEmail = meRes.json().user.email;

    await this.app.inject({
      method: 'POST',
      url: `/api/task-lists/${listId}/shares`,
      payload: { email: myEmail, permission: 'READ' },
      headers: { cookie: bobCookie },
    });
  },
);

Given(
  'I share that task list with {string} as {word}',
  async function (this: AppWorld, email: string, permission: string) {
    const res = await this.app.inject({
      method: 'POST',
      url: `/api/task-lists/${this.listId}/shares`,
      payload: { email, permission },
      headers: { cookie: this.myCookie },
    });
    this.shareId = res.json().share?.id ?? null;
  },
);

When('I GET that task list with my cookie', async function (this: AppWorld) {
  await this.request('GET', `/api/task-lists/${this.listId}`, { cookie: this.myCookie });
});

When(
  'I PATCH that task list with body {string} with my cookie',
  async function (this: AppWorld, bodyJson: string) {
    await this.request('PATCH', `/api/task-lists/${this.listId}`, {
      payload: JSON.parse(bodyJson),
      cookie: this.myCookie,
    });
  },
);

When('I DELETE that task list with my cookie', async function (this: AppWorld) {
  await this.request('DELETE', `/api/task-lists/${this.listId}`, { cookie: this.myCookie });
});

When(
  'user {string} GETs that task list',
  async function (this: AppWorld, email: string) {
    await this.request('GET', `/api/task-lists/${this.listId}`, {
      cookie: this.cookieFor(email),
    });
  },
);

When(
  'user {string} PATCHes that task list with body {string}',
  async function (this: AppWorld, email: string, bodyJson: string) {
    await this.request('PATCH', `/api/task-lists/${this.listId}`, {
      payload: JSON.parse(bodyJson),
      cookie: this.cookieFor(email),
    });
  },
);

When(
  'user {string} DELETEs that task list',
  async function (this: AppWorld, email: string) {
    await this.request('DELETE', `/api/task-lists/${this.listId}`, {
      cookie: this.cookieFor(email),
    });
  },
);

Then('the response body has list.name {string}', async function (this: AppWorld, name: string) {
  expect(this.response.body?.list?.name).to.equal(name);
});

Then('the list is owned by me', async function (this: AppWorld) {
  expect(this.response.body?.list?.ownerId).to.equal(this.myUserId);
});

Then(
  'the response has {int} owned list named {string}',
  async function (this: AppWorld, count: number, name: string) {
    const owned = this.response.body?.owned ?? [];
    expect(owned).to.have.length(count);
    if (count > 0) expect(owned[0].name).to.equal(name);
  },
);

Then(
  'the response has {int} shared list named {string}',
  async function (this: AppWorld, count: number, name: string) {
    const shared = this.response.body?.shared ?? [];
    expect(shared).to.have.length(count);
    if (count > 0) expect(shared[0].name).to.equal(name);
  },
);

Then('the response includes tasks and shares', async function (this: AppWorld) {
  expect(this.response.body?.list?.tasks).to.not.be.undefined;
  expect(this.response.body?.list?.shares).to.not.be.undefined;
});

Then('the response has isOwner true', async function (this: AppWorld) {
  expect(this.response.body?.isOwner).to.equal(true);
});

Then('GET that task list returns 404', async function (this: AppWorld) {
  const res = await this.app.inject({
    method: 'GET',
    url: `/api/task-lists/${this.listId}`,
    headers: { cookie: this.myCookie },
  });
  expect(res.statusCode).to.equal(404);
});
