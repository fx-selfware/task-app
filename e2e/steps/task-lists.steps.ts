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

Then('the share modal is visible with an email input', async ({ page }) => {
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  await expect(page.getByPlaceholder('Email address')).toBeVisible();
});
