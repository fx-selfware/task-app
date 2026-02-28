import { createBdd } from 'playwright-bdd';
const { Given, When, Then } = createBdd();
import { expect } from '@playwright/test';

const unique = () => `e2e_${Date.now()}_${Math.random().toString(36).slice(2)}`;

Given('I am logged in as an admin user', async ({ page }) => {
  await page.context().clearCookies();
  // This email matches ADMIN_EMAILS in docker-compose.test.yml
  await page.goto('/register');
  await page.fill('input[type="text"]', 'Admin User');
  await page.fill('input[type="email"]', 'admin@test.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/task-lists/);
});

Then('the sidebar does not have an {string} link', async ({ page }, linkText: string) => {
  await expect(page.locator('nav').getByText(linkText, { exact: true })).not.toBeVisible({ timeout: 3000 });
});

Then('the sidebar has an {string} link', async ({ page }, linkText: string) => {
  await expect(page.locator('nav').getByText(linkText, { exact: true })).toBeVisible({ timeout: 5000 });
});

When('I click the {string} link in the sidebar', async ({ page }, linkText: string) => {
  await page.locator('nav').getByText(linkText, { exact: true }).click();
  await page.waitForURL(/\/admin/);
});

Then('I see the admin users table', async ({ page }) => {
  await expect(page.locator('table')).toBeVisible({ timeout: 5000 });
  // Verify at least the header row exists
  await expect(page.locator('th').filter({ hasText: 'Name' })).toBeVisible();
  await expect(page.locator('th').filter({ hasText: 'Email' })).toBeVisible();
});
