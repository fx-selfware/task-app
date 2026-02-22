import { test, expect } from '@playwright/test';

const unique = () => `e2e_${Date.now()}_${Math.random().toString(36).slice(2)}`;

test.describe('AC-FA1: Unauthenticated redirect', () => {
  test('visiting / redirects to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('visiting /task-lists redirects to /login', async ({ page }) => {
    await page.goto('/task-lists');
    await expect(page).toHaveURL(/\/login/);
  });

  test('visiting /templates redirects to /login', async ({ page }) => {
    await page.goto('/templates');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('AC-FA2: Register and login flow', () => {
  test('register → redirects to /task-lists', async ({ page }) => {
    const email = `${unique()}@example.com`;
    await page.goto('/register');
    await page.fill('input[type="text"]', 'E2E User');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/task-lists/);
  });

  test('login with valid credentials → redirects to /task-lists', async ({ page }) => {
    // Register first
    const email = `${unique()}@example.com`;
    await page.goto('/register');
    await page.fill('input[type="text"]', 'Login User');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/task-lists/);

    // Logout via API
    await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }));
    await page.goto('/login');

    // Login
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/task-lists/);
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'nobody@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Should remain on login page
    await expect(page).toHaveURL(/\/login/);
    // Error message visible
    await expect(page.locator('text=/invalid|error|credentials/i')).toBeVisible({ timeout: 3000 });
  });
});
