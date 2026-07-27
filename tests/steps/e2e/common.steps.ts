import { createBdd } from 'playwright-bdd';
const { Given, When } = createBdd();
import { expect } from '@playwright/test';

const unique = () => `e2e_${Date.now()}_${Math.random().toString(36).slice(2)}`;

/**
 * The name every "logged in as a new user" scenario registers under. Exported
 * because the You tab's avatar is labelled from /api/auth/me, which makes it
 * the one thing on screen that proves the session was actually confirmed.
 */
export const NEW_USER_NAME = 'Test User';

Given('I am logged in as a new user', async ({ page }) => {
  await page.context().clearCookies();
  const email = `${unique()}@example.com`;
  await page.goto('/register');
  await page.fill('input[type="text"]', NEW_USER_NAME);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/task-lists/);
});

When('I confirm the deletion', async ({ page }) => {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 3000 });
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect(dialog).not.toBeVisible({ timeout: 3000 });
});
