import { createBdd } from 'playwright-bdd';
const { Given, When, Then } = createBdd();
import { expect } from '@playwright/test';

Given('I am using a 375px wide viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
});

Then('the sidebar is not visible', async ({ page }) => {
  const sidebar = page.getByTestId('sidebar');
  await expect(sidebar).not.toBeInViewport();
});

When('I click the hamburger button', async ({ page }) => {
  const hamburger = page.getByTestId('hamburger');
  await expect(hamburger).toBeVisible();
  await hamburger.click();
});

Then('the sidebar is visible', async ({ page }) => {
  const sidebar = page.getByTestId('sidebar');
  await expect(sidebar).toBeInViewport();
});

When('I click the backdrop', async ({ page }) => {
  await page.click('.bg-black\\/50', { force: true });
});
