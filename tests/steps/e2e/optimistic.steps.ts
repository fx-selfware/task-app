import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

/**
 * Long enough that every assertion in a scenario finishes first, bounded so
 * nothing is left hanging at teardown. A stalled request is the point: if a
 * step passes while the API is silent, the UI rendered from the cache.
 */
const STALL_MS = 30_000;

Given('the API stops responding', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, STALL_MS));
    await route.abort();
  });
});

/**
 * Long enough that the next interaction certainly happens before the response.
 * Acting on a row the server has not confirmed used to send a placeholder id
 * and fail with "Invalid parent task"; ids now come from the client.
 */
Given('the API responds slowly', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
});

Given('writes to the API start failing', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    if (route.request().method() === 'GET') return route.continue();
    return route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Internal Server Error' }),
    });
  });
});

Given('I have a task named {string}', async ({ page }, name: string) => {
  const composer = page.getByLabel('Add a task');
  await composer.fill(name);
  await composer.press('Enter');
  await expect(page.getByTestId('task-title').filter({ hasText: name })).toBeVisible({ timeout: 5000 });
});

Given('I am viewing the task lists page', async ({ page }) => {
  await page.getByRole('link', { name: 'All Lists' }).click();
  await expect(page).toHaveURL(/\/task-lists$/);
});

// --- actions that must not wait for a response ---

When('I submit a new task named {string}', async ({ page }, name: string) => {
  const composer = page.getByLabel('Add a task');
  await composer.fill(name);
  await composer.press('Enter');
});

When('I delete the task {string}', async ({ page }, name: string) => {
  await page.getByTestId('task-title').filter({ hasText: name }).first().click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 3000 });
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
});

When('I submit a rename of the list to {string}', async ({ page }, name: string) => {
  // The heading renames in place — tap it, type, Return.
  await page.locator('h1').first().click();
  const field = page.getByLabel('List name');
  await field.fill(name);
  await field.press('Enter');
});

When('I submit an edit of the task {string} titled {string}', async ({ page }, name: string, newName: string) => {
  await page.getByTestId('task-title').filter({ hasText: name }).first().click();
  const field = page.getByLabel('Task title');
  await field.fill(newName);
  await field.press('Enter');
});

When('I move the task {string} under {string}', async ({ page }, name: string, parentName: string) => {
  await page.getByTestId('task-title').filter({ hasText: name }).first().click();
  await page.getByRole('button', { name: 'Move under...', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 3000 });
  await dialog.getByText(parentName, { exact: true }).click();
});

When('I submit a new list named {string}', async ({ page }, name: string) => {
  await page.getByRole('button', { name: '+ New List' }).click();
  await page.getByLabel('List name').fill(name);
  await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
});

When('I submit a new template task named {string}', async ({ page }, name: string) => {
  const composer = page.getByLabel('Add a task');
  await composer.fill(name);
  await composer.press('Enter');
});

// --- assertions ---

Then('the list heading is {string}', async ({ page }, name: string) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name, { timeout: 5000 });
});

Then('no task is being edited', async ({ page }) => {
  await expect(page.getByLabel('Task title')).not.toBeVisible({ timeout: 3000 });
});

Then('an error message is visible', async ({ page }) => {
  await expect(page.getByTestId('error-toast')).toBeVisible({ timeout: 5000 });
});
