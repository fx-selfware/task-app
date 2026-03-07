import { createBdd } from 'playwright-bdd';
const { Given, When, Then } = createBdd();
import { expect } from '@playwright/test';

const unique = () => `e2e_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// Store generated unique emails across steps within a scenario
const emailStore: Record<string, string> = {};

Given('I am not logged in', async ({ page }) => {
  // Clear cookies to ensure unauthenticated state
  await page.context().clearCookies();
});

When('I visit {string}', async ({ page }, path: string) => {
  await page.goto(path);
});

Then('I am redirected to {string}', async ({ page }, path: string) => {
  await expect(page).toHaveURL(new RegExp(path.replace('/', '\\/')));
});

Given('I am on the register page', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/register');
});

When(
  'I fill in name {string}, email {string}, password {string}',
  async ({ page }, name: string, email: string, password: string) => {
    // Replace placeholder tokens with unique values
    const resolvedEmail = email.includes('<unique>')
      ? (() => {
          if (!emailStore['unique']) emailStore['unique'] = `${unique()}@example.com`;
          return email.replace('<unique>', emailStore['unique'].split('@')[0]);
        })()
      : email.includes('<unique2>')
        ? (() => {
            if (!emailStore['unique2']) emailStore['unique2'] = `${unique()}@example.com`;
            return email.replace('<unique2>', emailStore['unique2'].split('@')[0]);
          })()
        : email;

    await page.fill('input[type="text"]', name);
    await page.fill('input[type="email"]', resolvedEmail);
    await page.fill('input[type="password"]', password);
  },
);

When('I submit the form', async ({ page }) => {
  await page.click('button[type="submit"]');
});

Then('I am on the task lists page', async ({ page }) => {
  await expect(page).toHaveURL(/\/task-lists/);
});

When('I click the logout button', async ({ page }) => {
  await page.click('button[title="Log out"]');
});

When(
  'I fill in email {string} and password {string}',
  async ({ page }, email: string, password: string) => {
    let resolvedEmail = email;
    if (email.includes('<unique>') && emailStore['unique']) {
      resolvedEmail = email.replace('<unique>', emailStore['unique'].split('@')[0]);
    } else if (email.includes('<unique2>') && emailStore['unique2']) {
      resolvedEmail = email.replace('<unique2>', emailStore['unique2'].split('@')[0]);
    }
    await page.fill('input[type="email"]', resolvedEmail);
    await page.fill('input[type="password"]', password);
  },
);

