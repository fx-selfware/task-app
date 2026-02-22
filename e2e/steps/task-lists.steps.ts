import { createBdd } from 'playwright-bdd';
const { Given, When, Then } = createBdd();
import { expect } from '@playwright/test';

Given('I have a task list named {string}', async ({ page }, name: string) => {
  await page.click('text=+ New List');
  const nameInput = page.getByLabel('List name');
  await nameInput.fill(name);
  await page.click('button[type="submit"]');
  await expect(page.locator('nav').getByText(name)).toBeVisible({ timeout: 5000 });
});

When('I create a task list named {string}', async ({ page }, name: string) => {
  await page.click('text=+ New List');
  const nameInput = page.getByLabel('List name');
  await nameInput.fill(name);
  await page.click('button[type="submit"]');
});

Then('{string} appears in the sidebar', async ({ page }, name: string) => {
  await expect(page.locator('nav').getByText(name)).toBeVisible({ timeout: 5000 });
});

When('I open the share modal for {string}', async ({ page }, name: string) => {
  await page.getByText(name).first().click();
  await page.waitForURL(/\/task-lists\/[a-z0-9]+/);
  await page.getByRole('button', { name: 'Share' }).click();
});

Given('a collaborator exists with email {string}', async ({ request }, email: string) => {
  await request.post('/api/auth/register', {
    data: { email, password: 'password123', name: 'Collaborator' },
  });
});

When('I invite {string} with {string} permission', async ({ page }, email: string, permission: string) => {
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByRole('dialog').locator('form select').selectOption(permission.toUpperCase());
  await page.getByRole('button', { name: 'Invite' }).click();
});

Then('{string} is listed in the share modal with {string} access', async ({ page }, email: string, permission: string) => {
  const shareItem = page.locator('li').filter({ hasText: email });
  await expect(shareItem).toBeVisible({ timeout: 5000 });
  await expect(shareItem.locator('select')).toHaveValue(permission.toUpperCase());
});
