import { createBdd } from 'playwright-bdd';
const { Given, When, Then } = createBdd();
import { expect } from '@playwright/test';

const unique = () => `e2e_${Date.now()}_${Math.random().toString(36).slice(2)}`;

When('I navigate to the templates page', async ({ page }) => {
  await page.getByText('Templates', { exact: true }).click();
  await page.waitForURL(/\/templates/);
});

When('I create a template named {string}', async ({ page }, name: string) => {
  await page.getByRole('button', { name: '+ New Template' }).click();
  await page.getByLabel('Template name').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
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
  await page.getByRole('button', { name: '+ New Template' }).click();
  await page.getByLabel('Template name').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
  await expect(page.getByText(name)).toBeVisible({ timeout: 5000 });
});

When('I open the template {string}', async ({ page }, name: string) => {
  await page.getByText(name, { exact: true }).first().click();
  await page.waitForURL(/\/templates\/[a-z0-9]+/);
});

When('I open the template share modal', async ({ page }) => {
  await page.getByRole('button', { name: 'Share' }).click();
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
