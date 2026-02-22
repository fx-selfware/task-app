import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { AppWorld, registerUser } from './world';

Given(
  'a user exists with email {string} and password {string} and name {string}',
  async function (this: AppWorld, email: string, password: string, name: string) {
    await registerUser(this.app, email, password, name);
  },
);

Given(
  'I am logged in as {string} with password {string}',
  async function (this: AppWorld, email: string, password: string) {
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

Given(
  'user {string} with password {string} exists',
  async function (this: AppWorld, email: string, password: string) {
    const cookie = await registerUser(this.app, email, password);
    this.cookies[email] = cookie;
  },
);

When(
  'I POST {string} with body {string}',
  async function (this: AppWorld, url: string, bodyJson: string) {
    await this.request('POST', url, { payload: JSON.parse(bodyJson) });
  },
);

When(
  'I POST {string} with body {string} with my cookie',
  async function (this: AppWorld, url: string, bodyJson: string) {
    await this.request('POST', url, { payload: JSON.parse(bodyJson), cookie: this.myCookie });
  },
);

When(
  'I GET {string} with my cookie',
  async function (this: AppWorld, url: string) {
    await this.request('GET', url, { cookie: this.myCookie });
  },
);

When('I GET {string}', async function (this: AppWorld, url: string) {
  await this.request('GET', url);
});

When(
  'I POST {string} with my cookie',
  async function (this: AppWorld, url: string) {
    await this.request('POST', url, { cookie: this.myCookie });
  },
);

When(
  'I POST "/api/auth/logout" with my cookie',
  async function (this: AppWorld) {
    await this.request('POST', '/api/auth/logout', { cookie: this.myCookie });
  },
);

Then('the status is {int}', async function (this: AppWorld, status: number) {
  expect(this.response.statusCode).to.equal(status);
});

Then(
  'the response body has user.email {string}',
  async function (this: AppWorld, email: string) {
    expect(this.response.body?.user?.email).to.equal(email);
  },
);

Then(
  'the response body has user.name {string}',
  async function (this: AppWorld, name: string) {
    expect(this.response.body?.user?.name).to.equal(name);
  },
);

Then('the response body has no user.passwordHash', async function (this: AppWorld) {
  expect(this.response.body?.user?.passwordHash).to.be.undefined;
});

Then(
  'the response sets an HttpOnly SameSite=Strict cookie named {string}',
  async function (this: AppWorld, cookieName: string) {
    const setCookie = this.response.headers['set-cookie'] as string | string[];
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
    expect(cookieStr).to.include(`${cookieName}=`);
    expect(cookieStr).to.include('HttpOnly');
    expect(cookieStr).to.include('SameSite=Strict');
  },
);

Then(
  'the response sets a cookie named {string}',
  async function (this: AppWorld, cookieName: string) {
    const setCookie = this.response.headers['set-cookie'] as string | string[];
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie;
    expect(cookieStr).to.include(`${cookieName}=`);
  },
);
