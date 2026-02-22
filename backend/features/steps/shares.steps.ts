import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { AppWorld } from './world';

When(
  'I POST a share for {string} with {word} permission',
  async function (this: AppWorld, email: string, permission: string) {
    await this.request('POST', `/api/task-lists/${this.listId}/shares`, {
      payload: { email, permission },
      cookie: this.myCookie,
    });
    if (this.response.statusCode === 201) {
      this.shareId = this.response.body?.share?.id ?? null;
    }
  },
);

Given(
  'I have shared that list with {string} as {word}',
  async function (this: AppWorld, email: string, permission: string) {
    const res = await this.app.inject({
      method: 'POST',
      url: `/api/task-lists/${this.listId}/shares`,
      payload: { email, permission },
      headers: { cookie: this.myCookie },
    });
    this.shareId = res.json().share.id;
  },
);

When('I GET the shares for that list', async function (this: AppWorld) {
  await this.request('GET', `/api/task-lists/${this.listId}/shares`, {
    cookie: this.myCookie,
  });
});

When(
  'I PATCH that share with permission {string}',
  async function (this: AppWorld, permission: string) {
    await this.request('PATCH', `/api/task-lists/${this.listId}/shares/${this.shareId}`, {
      payload: { permission },
      cookie: this.myCookie,
    });
  },
);

When('I DELETE that share', async function (this: AppWorld) {
  await this.request('DELETE', `/api/task-lists/${this.listId}/shares/${this.shareId}`, {
    cookie: this.myCookie,
  });
});

Then(
  'the share has permission {string}',
  async function (this: AppWorld, permission: string) {
    const share = this.response.body?.share;
    expect(share?.permission).to.equal(permission);
  },
);

Then(
  'the share user email is {string}',
  async function (this: AppWorld, email: string) {
    expect(this.response.body?.share?.user?.email).to.equal(email);
  },
);

Then(
  'there is {int} share for {string}',
  async function (this: AppWorld, count: number, email: string) {
    const shares = this.response.body?.shares ?? [];
    expect(shares).to.have.length(count);
    if (count > 0) expect(shares[0].user.email).to.equal(email);
  },
);

Then(
  'user {string} cannot access that list',
  async function (this: AppWorld, email: string) {
    const res = await this.app.inject({
      method: 'GET',
      url: `/api/task-lists/${this.listId}`,
      headers: { cookie: this.cookieFor(email) },
    });
    expect(res.statusCode).to.equal(404);
  },
);
