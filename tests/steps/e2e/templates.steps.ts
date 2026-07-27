import { createBdd } from 'playwright-bdd';
const { Given, When, Then } = createBdd();
import { expect, Page } from '@playwright/test';

let tplCollabPage: Page | null = null;

const unique = () => `e2e_${Date.now()}_${Math.random().toString(36).slice(2)}`;

When('I navigate to the templates page', async ({ page }) => {
  await page.getByText('Templates', { exact: true }).click();
  await page.waitForURL(/\/templates/);
});

When('I create a template named {string}', async ({ page }, name: string) => {
  const composer = page.getByLabel('New template');
  await composer.fill(name);
  await composer.press('Enter');
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
});

Then('{string} is visible on the templates page', async ({ page }, name: string) => {
  await expect(page.getByText(name)).toBeVisible({ timeout: 5000 });
});

Given('I have a template named {string}', async ({ page }, name: string) => {
  // Navigate to templates page
  await page.getByText('Templates', { exact: true }).click();
  await page.waitForURL(/\/templates/);
  // Create the template
  const composer = page.getByLabel('New template');
  await composer.fill(name);
  await composer.press('Enter');
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
  await expect(page.getByText(name)).toBeVisible({ timeout: 5000 });
});

When('I open the template {string}', async ({ page }, name: string) => {
  await page.getByText(name, { exact: true }).first().click();
  await page.waitForURL(/\/templates\/[a-z0-9]+/);
});

When('I open the template share modal', async ({ page }) => {
  await page.getByRole('button', { name: 'Template actions' }).click();
  await page.getByRole('menuitem', { name: 'Share' }).click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });
});

When(
  'I invite {string} with {string} permission to the template',
  async ({ page }, email: string, permission: string) => {
    await page.getByPlaceholder('Email address').fill(email);
    await page.getByRole('dialog').locator('form select').selectOption(permission.toUpperCase());
    await page.getByRole('button', { name: 'Invite' }).click();
  },
);

Then(
  '{string} is listed in the template share modal with {string} access',
  async ({ page }, email: string, permission: string) => {
    const shareItem = page.locator('li').filter({ hasText: email });
    await expect(shareItem).toBeVisible({ timeout: 5000 });
    await expect(shareItem.locator('select')).toHaveValue(permission.toUpperCase());
  },
);

When('I add a template task named {string}', async ({ page }, name: string) => {
  const composer = page.getByLabel('Add a task');
  await composer.fill(name);
  await composer.press('Enter');
  await expect(page.getByTestId('task-title').filter({ hasText: name })).toBeVisible({ timeout: 5000 });
});

When(
  'I drag the template task {string} above {string}',
  async ({ page }, source: string, target: string) => {
    // The row is the handle now — there is no grip to grab.
    const sourceHandle = page.getByTestId('task-row').filter({ hasText: source }).first();
    const targetCard = page.getByTestId('task-row').filter({ hasText: target }).first();

    await sourceHandle.dragTo(targetCard);
  },
);

Then(
  '{string} appears before {string} in the template',
  async ({ page }, first: string, second: string) => {
    await page.waitForTimeout(1000);
    const texts = await page.getByTestId('task-row').evaluateAll((rows) =>
      rows.map((r) => r.getAttribute('data-task-title') ?? ''),
    );
    const firstIndex = texts.indexOf(first);
    const secondIndex = texts.indexOf(second);
    expect(firstIndex).toBeGreaterThanOrEqual(0);
    expect(secondIndex).toBeGreaterThanOrEqual(0);
    expect(firstIndex).toBeLessThan(secondIndex);
  },
);

When(
  'the collaborator {string} opens the template {string}',
  async ({ browser, baseURL }, email: string, templateName: string) => {
    const context = await browser.newContext({ baseURL });
    tplCollabPage = await context.newPage();
    await tplCollabPage.goto('/login');
    await tplCollabPage.fill('input[type="email"]', email);
    await tplCollabPage.fill('input[type="password"]', 'password123');
    await tplCollabPage.click('button[type="submit"]');
    await expect(tplCollabPage).toHaveURL(/\/task-lists/, { timeout: 5000 });
    await tplCollabPage.getByText('Templates', { exact: true }).click();
    await tplCollabPage.waitForURL(/\/templates/);
    await tplCollabPage.getByText(templateName, { exact: true }).first().click();
    await tplCollabPage.waitForURL(/\/templates\/[a-z0-9]+/);
    await expect(tplCollabPage.locator('h1')).toContainText(templateName, { timeout: 5000 });
    await tplCollabPage.waitForTimeout(1000);
  },
);

Then(
  'the collaborator sees {string} in the template without refreshing',
  async ({}, name: string) => {
    expect(tplCollabPage).toBeTruthy();
    await expect(tplCollabPage!.getByText(name)).toBeVisible({ timeout: 10_000 });
    await tplCollabPage!.context().close();
    tplCollabPage = null;
  },
);

