import { expect } from '@playwright/test';
import { Given, When, Then } from './fixtures';

const HEADER = 'x-db-round-trips';

Given('I own {int} task lists each with {int} tasks', async ({ world }, listCount: number, taskCount: number) => {
  for (let i = 0; i < listCount; i++) {
    const res = await world.request('POST', '/api/task-lists', {
      payload: { name: `List ${i + 1}` },
      cookie: world.myCookie,
    });
    const listId = res.body.list.id;
    world.listId = listId;
    for (let t = 0; t < taskCount; t++) {
      await world.request('POST', `/api/task-lists/${listId}/tasks`, {
        payload: { title: `Task ${t + 1}` },
        cookie: world.myCookie,
      });
    }
  }
});

Given('I own {int} templates each with {int} tasks', async ({ world }, templateCount: number, taskCount: number) => {
  for (let i = 0; i < templateCount; i++) {
    const res = await world.request('POST', '/api/templates', {
      payload: { name: `Template ${i + 1}` },
      cookie: world.myCookie,
    });
    const templateId = res.body.template.id;
    world.templateId = templateId;
    for (let t = 0; t < taskCount; t++) {
      await world.request('POST', `/api/templates/${templateId}/tasks`, {
        payload: { title: `Step ${t + 1}` },
        cookie: world.myCookie,
      });
    }
  }
});

When('I POST a task titled {string} to that list', async ({ world }, title: string) => {
  await world.request('POST', `/api/task-lists/${world.listId}/tasks`, {
    payload: { title },
    cookie: world.myCookie,
  });
});

Then('the request used at most {int} database round trip(s)', async ({ world }, budget: number) => {
  const header = world.response.headers.get(HEADER);
  if (header === null) {
    throw new Error(
      `no ${HEADER} header — the server under test was started without EXPOSE_DB_METRICS=1. ` +
        'Stop any server on the test port and let Playwright boot its own.',
    );
  }
  const used = Number(header);
  console.log(`    round trips: ${used} (budget ${budget})`);
  expect(used, 'database round trips for the last request').toBeLessThanOrEqual(budget);
});
