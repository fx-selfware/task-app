import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

When('I POST a share for {string} with {word} permission', async ({ world }, email: string, permission: string) => {
  const res = await world.request('POST', `/api/task-lists/${world.listId}/shares`, {
    payload: { email, permission },
    cookie: world.myCookie,
  });
  if (res.statusCode === 201) {
    world.shareId = res.body?.share?.id ?? null;
  }
});

Given('I have shared that list with {string} as {word}', async ({ world }, email: string, permission: string) => {
  const res = await world.request('POST', `/api/task-lists/${world.listId}/shares`, {
    payload: { email, permission },
    cookie: world.myCookie,
  });
  world.shareId = res.body.share.id;
});

When('I GET the shares for that list', async ({ world }) => {
  await world.request('GET', `/api/task-lists/${world.listId}/shares`, { cookie: world.myCookie });
});

When('I PATCH that share with permission {string}', async ({ world }, permission: string) => {
  await world.request('PATCH', `/api/task-lists/${world.listId}/shares/${world.shareId}`, {
    payload: { permission },
    cookie: world.myCookie,
  });
});

When('I DELETE that share', async ({ world }) => {
  await world.request('DELETE', `/api/task-lists/${world.listId}/shares/${world.shareId}`, {
    cookie: world.myCookie,
  });
});

Then('the share has permission {string}', async ({ world }, permission: string) => {
  expect(world.response.body?.share?.permission).toBe(permission);
});

Then('the share user email is {string}', async ({ world }, email: string) => {
  expect(world.response.body?.share?.user?.email).toBe(email);
});

Then('there is {int} share for {string}', async ({ world }, count: number, email: string) => {
  const shares = world.response.body?.shares ?? [];
  expect(shares).toHaveLength(count);
  if (count > 0) expect(shares[0].user.email).toBe(email);
});

Then('user {string} cannot access that list', async ({ world }, email: string) => {
  const res = await world.request('GET', `/api/task-lists/${world.listId}`, { cookie: world.cookieFor(email) });
  expect(res.statusCode).toBe(404);
});
