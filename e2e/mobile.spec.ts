import { test, expect, devices } from '@playwright/test';

const unique = () => `e2e_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// Use mobile viewport for these tests
test.use({ viewport: { width: 375, height: 812 } });

async function registerAndLogin(page: any) {
  const email = `${unique()}@example.com`;
  await page.goto('/register');
  await page.fill('input[type="text"]', 'Mobile User');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/task-lists/);
}

test.describe('AC-FM1: Sidebar hidden at 375px', () => {
  test('sidebar is not visible by default on mobile', async ({ page }) => {
    await registerAndLogin(page);
    const sidebar = page.getByTestId('sidebar');
    await expect(sidebar).not.toBeInViewport();
  });
});

test.describe('AC-FM2: Hamburger opens/closes sidebar', () => {
  test('hamburger button shows and hides sidebar', async ({ page }) => {
    await registerAndLogin(page);

    // Hamburger should be visible
    const hamburger = page.getByTestId('hamburger');
    await expect(hamburger).toBeVisible();

    // Click hamburger → sidebar opens
    await hamburger.click();
    const sidebar = page.getByTestId('sidebar');
    await expect(sidebar).toBeInViewport();

    // Click backdrop → sidebar closes
    await page.click('.bg-black\\/50', { force: true });
    await expect(sidebar).not.toBeInViewport();
  });
});
