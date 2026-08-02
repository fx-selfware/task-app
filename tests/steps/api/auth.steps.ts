import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

Given(
  'a user exists with email {string} and password {string} and name {string}',
  async ({ world }, email: string, password: string, name: string) => {
    await world.registerUser(email, password, name);
  },
);

Given('I am logged in as {string} with password {string}', async ({ world }, email: string, password: string) => {
  await world.loginAs(email, password);
});

Given('user {string} with password {string} exists', async ({ world }, email: string, password: string) => {
  const cookie = await world.registerUser(email, password);
  world.cookies[email] = cookie;
});

When('I POST {string} with body {string}', async ({ world }, url: string, bodyJson: string) => {
  await world.request('POST', url, { payload: JSON.parse(bodyJson) });
});

When('I POST {string} with body {string} with my cookie', async ({ world }, url: string, bodyJson: string) => {
  await world.request('POST', url, { payload: JSON.parse(bodyJson), cookie: world.myCookie });
});

When('I GET {string} with my cookie', async ({ world }, url: string) => {
  await world.request('GET', url, { cookie: world.myCookie });
});

When('I GET {string}', async ({ world }, url: string) => {
  await world.request('GET', url);
});

When('I POST {string} with my cookie', async ({ world }, url: string) => {
  await world.request('POST', url, { cookie: world.myCookie });
});

Then('the status is {int}', async ({ world }, status: number) => {
  expect(world.response.statusCode).toBe(status);
});

Then('the response body has user.email {string}', async ({ world }, email: string) => {
  expect(world.response.body?.user?.email).toBe(email);
});

Then('the response body has user.name {string}', async ({ world }, name: string) => {
  expect(world.response.body?.user?.name).toBe(name);
});

Then('the response body has no user.passwordHash', async ({ world }) => {
  expect(world.response.body?.user?.passwordHash).toBeUndefined();
});

Then('the response body has error {string}', async ({ world }, message: string) => {
  expect(world.response.body?.error).toBe(message);
});

Then('the response sets an HttpOnly SameSite=Lax cookie named {string}', async ({ world }, cookieName: string) => {
  const cookieStr = world.response.setCookies.join('; ');
  expect(cookieStr).toContain(`${cookieName}=`);
  // Cookie attributes are case-insensitive (RFC 6265); Next serializes
  // "SameSite=lax", so match case-insensitively.
  expect(cookieStr.toLowerCase()).toContain('httponly');
  expect(cookieStr.toLowerCase()).toContain('samesite=lax');
});

Then('the response sets a cookie named {string}', async ({ world }, cookieName: string) => {
  const cookieStr = world.response.setCookies.join('; ');
  expect(cookieStr).toContain(`${cookieName}=`);
});
