import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

When('I POST a template share for {string} with {word} permission', async ({ world }, email: string, permission: string) => {
  await world.request('POST', `/api/templates/${world.templateId}/shares`, {
    payload: { email, permission },
    cookie: world.myCookie,
  });
  if (world.response.statusCode === 201) {
    world.shareId = world.response.body?.share?.id ?? null;
  }
});

Given('I have shared that template with {string} as {word}', async ({ world }, email: string, permission: string) => {
  const res = await world.request('POST', `/api/templates/${world.templateId}/shares`, {
    payload: { email, permission },
    cookie: world.myCookie,
  });
  world.shareId = res.body.share.id;
});

When('I GET the shares for that template', async ({ world }) => {
  await world.request('GET', `/api/templates/${world.templateId}/shares`, { cookie: world.myCookie });
});

When('I PATCH that template share with permission {string}', async ({ world }, permission: string) => {
  await world.request('PATCH', `/api/templates/${world.templateId}/shares/${world.shareId}`, {
    payload: { permission },
    cookie: world.myCookie,
  });
});

When('I DELETE that template share', async ({ world }) => {
  await world.request('DELETE', `/api/templates/${world.templateId}/shares/${world.shareId}`, { cookie: world.myCookie });
});

Then('the template share has permission {string}', async ({ world }, permission: string) => {
  const share = world.response.body?.share;
  expect(share?.permission).toBe(permission);
});

Then('the template share user email is {string}', async ({ world }, email: string) => {
  expect(world.response.body?.share?.user?.email).toBe(email);
});

Then('there is {int} template share for {string}', async ({ world }, count: number, email: string) => {
  const shares = world.response.body?.shares ?? [];
  expect(shares).toHaveLength(count);
  if (count > 0) expect(shares[0].user.email).toBe(email);
});

When('user {string} PATCHes that template with name {string}', async ({ world }, email: string, name: string) => {
  await world.request('PATCH', `/api/templates/${world.templateId}`, {
    payload: { name },
    cookie: world.cookieFor(email),
  });
});

When('user {string} GETs {string}', async ({ world }, email: string, url: string) => {
  await world.request('GET', url, { cookie: world.cookieFor(email) });
});

Then('the shared templates contain {string}', async ({ world }, name: string) => {
  const shared = world.response.body?.shared ?? [];
  const found = shared.some((t: { name: string }) => t.name === name);
  expect(found).toBe(true);
});
