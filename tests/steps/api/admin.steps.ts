import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

Given(
  'I am logged in as admin {string} with password {string}',
  async ({ world }, email: string, password: string) => {
    await world.loginAs(email, password);
  },
);

When('I reset password for {string} to {string}', async ({ world }, email: string, newPassword: string) => {
  const usersRes = await world.request('GET', '/api/admin/users', { cookie: world.myCookie });
  const users = usersRes.body?.users ?? [];
  const targetUser = users.find((u: { email: string }) => u.email === email);
  expect(targetUser).toBeTruthy();

  await world.request('POST', `/api/admin/users/${targetUser.id}/reset-password`, {
    payload: { newPassword },
    cookie: world.myCookie,
  });
});

Then('the users list contains {string}', async ({ world }, email: string) => {
  const users = world.response.body?.users ?? [];
  const found = users.some((u: { email: string }) => u.email === email);
  expect(found).toBe(true);
});

Then('user {string} can log in with password {string}', async ({ world }, email: string, password: string) => {
  const res = await world.request('POST', '/api/auth/login', { payload: { email, password } });
  expect(res.statusCode).toBe(200);
});
