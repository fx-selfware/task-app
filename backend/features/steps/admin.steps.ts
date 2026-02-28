import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { AppWorld, registerUser } from './world';

Given(
  'I am logged in as admin {string} with password {string}',
  async function (this: AppWorld, email: string, password: string) {
    // Set ADMIN_EMAILS to include this email for the test
    process.env.ADMIN_EMAILS = email;
    const cookie = await registerUser(this.app, email, password);
    this.cookies['me'] = cookie;
    const me = await this.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie },
    });
    this.myUserId = me.json().user?.id ?? null;
  },
);

When(
  'I reset password for {string} to {string}',
  async function (this: AppWorld, email: string, newPassword: string) {
    // Find the user ID for the given email
    const usersRes = await this.app.inject({
      method: 'GET',
      url: '/api/admin/users',
      headers: { cookie: this.myCookie },
    });
    const users = usersRes.json().users ?? [];
    const targetUser = users.find((u: { email: string }) => u.email === email);
    expect(targetUser).to.exist;

    await this.request('POST', `/api/admin/users/${targetUser.id}/reset-password`, {
      payload: { newPassword },
      cookie: this.myCookie,
    });
  },
);

Then(
  'the users list contains {string}',
  async function (this: AppWorld, email: string) {
    const users = this.response.body?.users ?? [];
    const found = users.some((u: { email: string }) => u.email === email);
    expect(found).to.be.true;
  },
);

Then(
  'user {string} can log in with password {string}',
  async function (this: AppWorld, email: string, password: string) {
    const res = await this.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });
    expect(res.statusCode).to.equal(200);
  },
);
