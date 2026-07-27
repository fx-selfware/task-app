import { createBdd } from 'playwright-bdd';
const { Given, When, Then } = createBdd();
import { expect } from '@playwright/test';

const unique = () => `e2e_${Date.now()}_${Math.random().toString(36).slice(2)}`;

Given('I am logged in as an admin user', async ({ page }) => {
  await page.context().clearCookies();
  // This email matches ADMIN_EMAILS in playwright.config.ts webServer env.
  // Register on first run; fall back to login when the account already exists
  // (the test DB persists across in-run retries).
  await page.goto('/register');
  await page.fill('input[type="text"]', 'Admin User');
  await page.fill('input[type="email"]', 'admin@test.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  const registered = await page
    .waitForURL(/\/task-lists/, { timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  if (!registered) {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/task-lists/);
  }
});

Then('the You tab does not offer {string}', async ({ page }, linkText: string) => {
  await expect(page.getByRole('link', { name: linkText, exact: true })).not.toBeVisible({ timeout: 3000 });
});

Then('the You tab offers {string}', async ({ page }, linkText: string) => {
  await expect(page.getByRole('link', { name: linkText, exact: true })).toBeVisible({ timeout: 5000 });
});

When('I open {string} from the You tab', async ({ page }, linkText: string) => {
  await page.getByRole('link', { name: linkText, exact: true }).click();
  await page.waitForURL(/\/admin/);
});

Then('I see the admin users table', async ({ page }) => {
  await expect(page.locator('table')).toBeVisible({ timeout: 5000 });
  // Verify at least the header row exists
  await expect(page.locator('th').filter({ hasText: 'Name' })).toBeVisible();
  await expect(page.locator('th').filter({ hasText: 'Email' })).toBeVisible();
});
