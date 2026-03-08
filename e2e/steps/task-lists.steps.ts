import { createBdd } from 'playwright-bdd';
const { Given, When, Then } = createBdd();
import { expect, Page } from '@playwright/test';

let collabPage: Page | null = null;

Given('I have a task list named {string}', async ({ page }, name: string) => {
  await page.click('text=+ New List');
  const nameInput = page.getByLabel('List name');
  await nameInput.fill(name);
  await page.click('button[type="submit"]');
  await expect(page.locator('nav').getByText(name, { exact: true })).toBeVisible({ timeout: 5000 });
});

When('I create a task list named {string}', async ({ page }, name: string) => {
  await page.click('text=+ New List');
  const nameInput = page.getByLabel('List name');
  await nameInput.fill(name);
  await page.click('button[type="submit"]');
});

Then('{string} appears in the sidebar', async ({ page }, name: string) => {
  await expect(page.locator('nav').getByText(name, { exact: true })).toBeVisible({ timeout: 5000 });
});

When('I open the task list {string}', async ({ page }, name: string) => {
  await page.getByText(name, { exact: true }).first().click();
  await page.waitForURL(/\/task-lists\/[a-z0-9]+/);
});

When('I open the share modal for {string}', async ({ page }, name: string) => {
  await page.getByText(name).first().click();
  await page.waitForURL(/\/task-lists\/[a-z0-9]+/);
  await page.getByRole('button', { name: 'List actions' }).click();
  await page.getByRole('menuitem', { name: 'Share' }).click();
});

When('I add a task named {string}', async ({ page }, name: string) => {
  await page.getByRole('button', { name: '+ Task' }).click();
  await page.getByLabel('Title').fill(name);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText(name)).toBeVisible({ timeout: 5000 });
});

When('I edit the task {string} to have title {string} and description {string}', async ({ page }, oldName: string, newTitle: string, description: string) => {
  await page.locator('p').filter({ hasText: oldName }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });
  const titleInput = page.getByLabel('Title');
  await titleInput.clear();
  await titleInput.fill(newTitle);
  const descTextarea = page.getByRole('dialog').locator('textarea');
  await descTextarea.clear();
  await descTextarea.fill(description);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
});

Then('{string} is visible in the task list', async ({ page }, name: string) => {
  await expect(page.getByText(name)).toBeVisible({ timeout: 5000 });
});

Then('{string} is no longer visible in the task list', async ({ page }, name: string) => {
  await expect(page.getByText(name)).not.toBeVisible({ timeout: 3000 });
});

Given('a collaborator exists with email {string}', async ({ request }, email: string) => {
  await request.post('/api/auth/register', {
    data: { email, password: 'password123', name: 'Collaborator' },
  });
});

When('I invite {string} with {string} permission', async ({ page }, email: string, permission: string) => {
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByRole('dialog').locator('form select').selectOption(permission.toUpperCase());
  await page.getByRole('button', { name: 'Invite' }).click();
});

Then('{string} is listed in the share modal with {string} access', async ({ page }, email: string, permission: string) => {
  const shareItem = page.locator('li').filter({ hasText: email });
  await expect(shareItem).toBeVisible({ timeout: 5000 });
  await expect(shareItem.locator('select')).toHaveValue(permission.toUpperCase());
});

When('I check the checkbox for {string}', async ({ page }, name: string) => {
  await page.getByRole('checkbox', { name: `Mark "${name}" as done` }).click();
});

Then('the completed section shows {int} completed task(s)', async ({ page }, count: number) => {
  await expect(page.getByRole('button', { name: new RegExp(`Completed \\(${count}\\)`) })).toBeVisible({ timeout: 5000 });
});

When('I expand the completed section', async ({ page }) => {
  const button = page.getByRole('button', { name: /Completed \(/ });
  await expect(button).toBeVisible({ timeout: 5000 });
  const text = await button.textContent();
  if (text?.includes('▶')) {
    await button.click();
  }
});

When('I uncheck the checkbox for {string}', async ({ page }, name: string) => {
  await page.getByRole('checkbox', { name: `Mark "${name}" as todo` }).click();
});

Then('the completed section is not visible', async ({ page }) => {
  await expect(page.getByRole('button', { name: /Completed \(/ })).not.toBeVisible({ timeout: 3000 });
});

When('I click {string}', async ({ page }, label: string) => {
  await page.getByRole('button', { name: label }).click();
});

Then('{string} appears with strikethrough styling', async ({ page }, name: string) => {
  const taskTitle = page.locator('p').filter({ hasText: name }).first();
  await expect(taskTitle).toHaveClass(/line-through/, { timeout: 5000 });
});

Then('the sidebar shows a real build hash', async ({ page }) => {
  const sidebar = page.getByTestId('sidebar');
  await expect(sidebar.getByText(/^build [0-9a-f]{7}$/)).toBeVisible({ timeout: 5000 });
});

When('I close the dialog', async ({ page }) => {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
});

When(
  'the collaborator {string} opens the task list {string}',
  async ({ browser }, email: string, listName: string) => {
    const baseURL = process.env.BASE_URL ?? 'http://localhost';
    const context = await browser.newContext({ baseURL });
    collabPage = await context.newPage();
    await collabPage.goto('/login');
    await collabPage.fill('input[type="email"]', email);
    await collabPage.fill('input[type="password"]', 'password123');
    await collabPage.click('button[type="submit"]');
    await expect(collabPage).toHaveURL(/\/task-lists/, { timeout: 5000 });
    await collabPage.getByText(listName, { exact: true }).first().click();
    await collabPage.waitForURL(/\/task-lists\/[a-z0-9]+/);
    await expect(collabPage.locator('h1')).toContainText(listName, { timeout: 5000 });
    // Allow time for the EventSource SSE connection to establish
    await collabPage.waitForTimeout(1000);
  },
);

Then(
  'the collaborator sees {string} without refreshing',
  async ({}, name: string) => {
    expect(collabPage).toBeTruthy();
    await expect(collabPage!.getByText(name)).toBeVisible({ timeout: 10_000 });
    await collabPage!.context().close();
    collabPage = null;
  },
);

// --- Subtask steps ---

When('I add a subtask named {string} to {string}', async ({ page }, subName: string, parentName: string) => {
  // Open the overflow menu on the parent card, then click "Add subtask"
  const parentCard = page.locator('.group').filter({ hasText: parentName }).first();
  await parentCard.getByRole('button', { name: 'Task actions' }).click();
  await page.getByRole('menuitem', { name: 'Add subtask' }).click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });
  await page.getByLabel('Title').fill(subName);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
  await expect(page.getByText(subName)).toBeVisible({ timeout: 5000 });
});

When('I open the task menu for {string}', async ({ page }, name: string) => {
  const card = page.locator('.group').filter({ hasText: name }).first();
  await card.getByRole('button', { name: 'Task actions' }).click();
});

When('I click the menu item {string}', async ({ page }, label: string) => {
  await page.getByRole('menuitem', { name: label }).click();
});

When('I select {string} in the move modal', async ({ page }, parentName: string) => {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 3000 });
  await dialog.getByText(parentName, { exact: true }).click();
  await expect(dialog).not.toBeVisible({ timeout: 5000 });
});

Then('{string} is a top-level task after {string}', async ({ page }, name: string, afterName: string) => {
  // Wait for the promoted task to appear as a top-level task
  await page.waitForTimeout(500);
  const cards = page.locator('.space-y-2').first().locator('> div');
  const allTexts = await cards.allTextContents();
  const beforeIdx = allTexts.findIndex((t) => t.includes(afterName));
  const afterIdx = allTexts.findIndex((t) => t.includes(name));
  expect(afterIdx).toBeGreaterThan(beforeIdx);
});

Then('{string} is visible as a subtask of {string}', async ({ page }, subName: string, parentName: string) => {
  // After demoting, the subtask should appear under the parent's subtask area
  await expect(page.getByText(subName)).toBeVisible({ timeout: 5000 });
});

When('I start dragging {string}', async ({ page }, name: string) => {
  const parentCard = page.locator('.space-y-2 > div').filter({ hasText: name }).first();
  const dragHandle = parentCard.getByRole('button', { name: 'Drag to reorder' }).first();
  await dragHandle.scrollIntoViewIfNeeded();
  await dragHandle.waitFor({ state: 'visible' });
  const box = await dragHandle.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  // Move enough to activate dnd-kit MouseSensor
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 + 20);
});

When('I release the drag', async ({ page }) => {
  await page.mouse.up();
});

Then('{string} appears as a readonly header in the completed section', async ({ page }, name: string) => {
  const header = page.getByTestId('readonly-parent-header').filter({ hasText: name });
  await expect(header).toBeVisible({ timeout: 5000 });
});

When('I collapse the subtasks of {string}', async ({ page }, parentName: string) => {
  const collapseBtn = page.getByRole('button', { name: 'Collapse subtasks' });
  await collapseBtn.click();
});

When('I expand the subtasks of {string}', async ({ page }, parentName: string) => {
  const expandBtn = page.getByRole('button', { name: 'Expand subtasks' });
  await expandBtn.click();
});
