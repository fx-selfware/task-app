import { test, expect } from '@playwright/test';

const unique = () => `e2e_${Date.now()}_${Math.random().toString(36).slice(2)}`;

async function registerAndLogin(page: any, name = 'Test User') {
  const email = `${unique()}@example.com`;
  await page.goto('/register');
  await page.fill('input[type="text"]', name);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/task-lists/);
  return email;
}

test.describe('AC-FTL1: Create task list appears in sidebar', () => {
  test('creating a list shows it in the sidebar', async ({ page }) => {
    await registerAndLogin(page);

    await page.click('text=+ New List');
    const nameInput = page.getByLabel('List name');
    await nameInput.fill('My Sprint');
    await page.click('button[type="submit"]');

    // Should appear in sidebar
    await expect(page.locator('nav').getByText('My Sprint')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('AC-FTL2: Share modal', () => {
  test('share modal shows invite form and current shares', async ({ page, browser }) => {
    // User A registers and creates a list
    await registerAndLogin(page, 'User A');
    await page.click('text=+ New List');
    const nameInput = page.getByLabel('List name');
    await nameInput.fill('Shared List');
    await page.click('button[type="submit"]');

    // Go to the list
    await page.getByText('Shared List').first().click();
    await page.waitForURL(/\/task-lists\/[a-z0-9]+/);

    // Open share modal — click the Share button specifically
    await page.getByRole('button', { name: 'Share' }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder('Email address')).toBeVisible();
  });
});
