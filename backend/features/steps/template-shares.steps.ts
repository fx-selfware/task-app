import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { AppWorld } from './world';

When(
  'I POST a template share for {string} with {word} permission',
  async function (this: AppWorld, email: string, permission: string) {
    await this.request('POST', `/api/templates/${this.templateId}/shares`, {
      payload: { email, permission },
      cookie: this.myCookie,
    });
    if (this.response.statusCode === 201) {
      this.shareId = this.response.body?.share?.id ?? null;
    }
  },
);

Given(
  'I have shared that template with {string} as {word}',
  async function (this: AppWorld, email: string, permission: string) {
    const res = await this.app.inject({
      method: 'POST',
      url: `/api/templates/${this.templateId}/shares`,
      payload: { email, permission },
      headers: { cookie: this.myCookie },
    });
    this.shareId = res.json().share.id;
  },
);

When('I GET the shares for that template', async function (this: AppWorld) {
  await this.request('GET', `/api/templates/${this.templateId}/shares`, {
    cookie: this.myCookie,
  });
});

When(
  'I PATCH that template share with permission {string}',
  async function (this: AppWorld, permission: string) {
    await this.request('PATCH', `/api/templates/${this.templateId}/shares/${this.shareId}`, {
      payload: { permission },
      cookie: this.myCookie,
    });
  },
);

When('I DELETE that template share', async function (this: AppWorld) {
  await this.request('DELETE', `/api/templates/${this.templateId}/shares/${this.shareId}`, {
    cookie: this.myCookie,
  });
});

Then(
  'the template share has permission {string}',
  async function (this: AppWorld, permission: string) {
    const share = this.response.body?.share;
    expect(share?.permission).to.equal(permission);
  },
);

Then(
  'the template share user email is {string}',
  async function (this: AppWorld, email: string) {
    expect(this.response.body?.share?.user?.email).to.equal(email);
  },
);

Then(
  'there is {int} template share for {string}',
  async function (this: AppWorld, count: number, email: string) {
    const shares = this.response.body?.shares ?? [];
    expect(shares).to.have.length(count);
    if (count > 0) expect(shares[0].user.email).to.equal(email);
  },
);

When(
  'user {string} PATCHes that template with name {string}',
  async function (this: AppWorld, email: string, name: string) {
    await this.request('PATCH', `/api/templates/${this.templateId}`, {
      payload: { name },
      cookie: this.cookieFor(email),
    });
  },
);

When(
  'user {string} GETs {string}',
  async function (this: AppWorld, email: string, url: string) {
    await this.request('GET', url, {
      cookie: this.cookieFor(email),
    });
  },
);

Then(
  'the shared templates contain {string}',
  async function (this: AppWorld, name: string) {
    const shared = this.response.body?.shared ?? [];
    const found = shared.some((t: { name: string }) => t.name === name);
    expect(found).to.be.true;
  },
);
