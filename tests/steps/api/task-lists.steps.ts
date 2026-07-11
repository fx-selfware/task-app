import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

Given('I own a task list named {string}', async ({ world }, name: string) => {
  const res = await world.request('POST', '/api/task-lists', { payload: { name }, cookie: world.myCookie });
  world.listId = res.body.list.id;
});

Given(
  'user {string} owns a task list named {string} shared with me as READ',
  async ({ world }, email: string, name: string) => {
    const bobCookie = world.cookieFor(email);
    const listRes = await world.request('POST', '/api/task-lists', { payload: { name }, cookie: bobCookie });
    const listId = listRes.body.list.id;

    const meRes = await world.request('GET', '/api/auth/me', { cookie: world.myCookie });
    const myEmail = meRes.body.user.email;

    await world.request('POST', `/api/task-lists/${listId}/shares`, {
      payload: { email: myEmail, permission: 'READ' },
      cookie: bobCookie,
    });
  },
);

Given('I share that task list with {string} as {word}', async ({ world }, email: string, permission: string) => {
  const res = await world.request('POST', `/api/task-lists/${world.listId}/shares`, {
    payload: { email, permission },
    cookie: world.myCookie,
  });
  world.shareId = res.body?.share?.id ?? null;
});

When('I GET that task list with my cookie', async ({ world }) => {
  await world.request('GET', `/api/task-lists/${world.listId}`, { cookie: world.myCookie });
});

When('I PATCH that task list with body {string} with my cookie', async ({ world }, bodyJson: string) => {
  await world.request('PATCH', `/api/task-lists/${world.listId}`, {
    payload: JSON.parse(bodyJson),
    cookie: world.myCookie,
  });
});

When('I DELETE that task list with my cookie', async ({ world }) => {
  await world.request('DELETE', `/api/task-lists/${world.listId}`, { cookie: world.myCookie });
});

When('user {string} GETs that task list', async ({ world }, email: string) => {
  await world.request('GET', `/api/task-lists/${world.listId}`, { cookie: world.cookieFor(email) });
});

When('user {string} PATCHes that task list with body {string}', async ({ world }, email: string, bodyJson: string) => {
  await world.request('PATCH', `/api/task-lists/${world.listId}`, {
    payload: JSON.parse(bodyJson),
    cookie: world.cookieFor(email),
  });
});

When('user {string} DELETEs that task list', async ({ world }, email: string) => {
  await world.request('DELETE', `/api/task-lists/${world.listId}`, { cookie: world.cookieFor(email) });
});

Then('the response body has list.name {string}', async ({ world }, name: string) => {
  expect(world.response.body?.list?.name).toBe(name);
});

Then('the list is owned by me', async ({ world }) => {
  expect(world.response.body?.list?.ownerId).toBe(world.myUserId);
});

Then('the response has {int} owned list named {string}', async ({ world }, count: number, name: string) => {
  const owned = world.response.body?.owned ?? [];
  expect(owned).toHaveLength(count);
  if (count > 0) expect(owned[0].name).toBe(name);
});

Then('the response has {int} shared list named {string}', async ({ world }, count: number, name: string) => {
  const shared = world.response.body?.shared ?? [];
  expect(shared).toHaveLength(count);
  if (count > 0) expect(shared[0].name).toBe(name);
});

Then('the response includes tasks and shares', async ({ world }) => {
  expect(world.response.body?.list?.tasks).not.toBeUndefined();
  expect(world.response.body?.list?.shares).not.toBeUndefined();
});

Then('the response has isOwner true', async ({ world }) => {
  expect(world.response.body?.isOwner).toBe(true);
});

Then('GET that task list returns 404', async ({ world }) => {
  const res = await world.request('GET', `/api/task-lists/${world.listId}`, { cookie: world.myCookie });
  expect(res.statusCode).toBe(404);
});
