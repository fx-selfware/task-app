import { createBdd } from 'playwright-bdd';
const { Given, When, Then } = createBdd();
import { expect, Page } from '@playwright/test';

let collabPage: Page | null = null;
let lastDragMouseY = 0;

Given('I have a task list named {string}', async ({ page }, name: string) => {
  const composer = page.getByLabel('New list');
  await composer.fill(name);
  await composer.press('Enter');
  await expect(page.locator(`[data-testid="list-link"][data-list-name="${name}"]`))
    .toBeVisible({ timeout: 5000 });
});

When('I create a task list named {string}', async ({ page }, name: string) => {
  const composer = page.getByLabel('New list');
  await composer.fill(name);
  await composer.press('Enter');
});

Then('{string} appears in the list of lists', async ({ page }, name: string) => {
  // The link's accessible name includes its task count, so match the name itself.
  await expect(page.locator(`[data-testid="list-link"][data-list-name="${name}"]`))
    .toBeVisible({ timeout: 5000 });
});

When('I open the You tab', async ({ page }) => {
  await page.getByTestId('you-tab').click();
  await expect(page).toHaveURL(/\/you$/, { timeout: 5000 });
});

Then('a real build hash is shown', async ({ page }) => {
  await expect(page.getByTestId('build-hash')).toHaveText(/^([0-9a-f]{7}|dev)$/, { timeout: 5000 });
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
  // Direction A: the composer is always live at the foot of the list. No FAB,
  // no modal — type and press Return, and the field keeps focus for the next.
  const composer = page.getByLabel('Add a task');
  await composer.fill(name);
  await composer.press('Enter');
  await expect(page.getByTestId('task-title').filter({ hasText: name })).toBeVisible({ timeout: 5000 });
});

When('I edit the task {string} to have title {string} and description {string}', async ({ page }, oldName: string, newTitle: string, description: string) => {
  // Tap the text and the row edits in place — there is no dialog.
  await page.getByTestId('task-title').filter({ hasText: oldName }).first().click();
  const titleInput = page.getByLabel('Task title');
  await titleInput.fill(newTitle);
  const desc = page.getByLabel('Task description');
  await desc.fill(description);
  await desc.press('Enter');
  await expect(titleInput).not.toBeVisible({ timeout: 3000 });
});

Then('{string} is visible in the task list', async ({ page }, name: string) => {
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 5000 });
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
  // A two-way choice is a segmented control now, not a native picker.
  await page.getByRole('radio', { name: permission === 'Write' ? 'Can edit' : 'Can view' }).click();
  await page.getByRole('button', { name: 'Invite' }).click();
});

Then('{string} is listed in the share modal with {string} access', async ({ page }, email: string, permission: string) => {
  const shareItem = page.locator('li').filter({ hasText: email });
  await expect(shareItem).toBeVisible({ timeout: 5000 });
  await expect(shareItem.getByRole('button', { name: `Access for ${email}` }))
    .toHaveText(permission === 'Write' ? 'Can edit' : 'Can view', { timeout: 5000 });
});

When('I check the checkbox for {string}', async ({ page }, name: string) => {
  await page.getByRole('checkbox', { name: `Mark "${name}" as done` }).click();
});

Then('the completed section shows {int} completed task(s)', async ({ page }, count: number) => {
  await expect(page.getByTestId('completed-count')).toHaveText(`${count} completed`, { timeout: 5000 });
});

When('I expand the completed section', async ({ page }) => {
  const show = page.getByTestId('completed-group').getByRole('button', { name: 'Show' });
  if (await show.isVisible()) await show.click();
  await expect(page.getByTestId('completed-group').getByRole('button', { name: 'Hide' })).toBeVisible({ timeout: 5000 });
});

When('I uncheck the checkbox for {string}', async ({ page }, name: string) => {
  await page.getByRole('checkbox', { name: `Mark "${name}" as todo` }).click();
});

Then('the completed section is not visible', async ({ page }) => {
  await expect(page.getByTestId('completed-group')).not.toBeVisible({ timeout: 5000 });
});

When('I click {string}', async ({ page }, label: string) => {
  await page.getByRole('button', { name: label }).click();
});

When('I clear the completed tasks', async ({ page }) => {
  // Clear lives on the completed group's own header, and confirms in place.
  const group = page.getByTestId('completed-group');
  const show = group.getByRole('button', { name: 'Show' });
  if (await show.isVisible()) await show.click();
  await group.getByRole('button', { name: 'Clear' }).click();
  await group.getByRole('button', { name: 'Delete', exact: true }).click();
});

Then('{string} appears with strikethrough styling', async ({ page }, name: string) => {
  const taskTitle = page.getByTestId('task-title').filter({ hasText: name }).first();
  await expect(taskTitle).toHaveClass(/line-through/, { timeout: 5000 });
});

When('I close the dialog', async ({ page }) => {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
});

When(
  'the collaborator {string} opens the task list {string}',
  async ({ browser, baseURL }, email: string, listName: string) => {
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
    // Allow the collaborator page's initial load/hydration to settle before
    // the poll-based live-update assertions that follow
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
  // Open the parent row, choose Add subtask, then the composer is aimed at it.
  await page.getByTestId('task-title').filter({ hasText: parentName }).first().click();
  await page.getByRole('button', { name: 'Add subtask' }).click();
  const composer = page.getByLabel(`Add a subtask to "${parentName}"`);
  await composer.fill(subName);
  await composer.press('Enter');
  await expect(page.getByTestId('task-title').filter({ hasText: subName })).toBeVisible({ timeout: 5000 });
});

When('I open the task menu for {string}', async ({ page }, name: string) => {
  await page.getByTestId('task-title').filter({ hasText: name }).first().click();
});

When('I click the menu item {string}', async ({ page }, label: string) => {
  await page.getByRole('button', { name: label, exact: true }).click();
});

When('I select {string} in the move modal', async ({ page }, parentName: string) => {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 3000 });
  await dialog.getByText(parentName, { exact: true }).click();
  await expect(dialog).not.toBeVisible({ timeout: 5000 });
});

Then('{string} is a top-level task after {string}', async ({ page }, name: string, afterName: string) => {
  await expect(async () => {
    const rows = await page.getByTestId('task-row').all();
    const titles = await Promise.all(rows.map((r) => r.getAttribute('data-task-title')));
    const subs = await Promise.all(rows.map((r) => r.getAttribute('data-subtask')));
    const beforeIdx = titles.findIndex((t) => t === afterName);
    const afterIdx = titles.findIndex((t) => t === name);
    expect(beforeIdx).toBeGreaterThanOrEqual(0);
    expect(afterIdx).toBeGreaterThan(beforeIdx);
    expect(subs[afterIdx]).toBeNull();   // top-level, not nested
  }).toPass({ timeout: 10_000 });
});

Then('{string} is visible as a subtask of {string}', async ({ page }, name: string, parentName: string) => {
  await expect(async () => {
    const rows = await page.getByTestId('task-row').all();
    const titles = await Promise.all(rows.map((r) => r.getAttribute('data-task-title')));
    const subs = await Promise.all(rows.map((r) => r.getAttribute('data-subtask')));
    const parentIdx = titles.findIndex((t) => t === parentName);
    const childIdx = titles.findIndex((t) => t === name);
    expect(parentIdx).toBeGreaterThanOrEqual(0);
    expect(childIdx).toBeGreaterThan(parentIdx);
    expect(subs[childIdx]).toBe('true');
  }).toPass({ timeout: 10_000 });
});

When('I start dragging {string}', async ({ page }, name: string) => {
  const dragHandle = page.getByTestId('task-row').filter({ hasText: name }).first();
  await dragHandle.scrollIntoViewIfNeeded();
  await dragHandle.waitFor({ state: 'visible' });
  const box = await dragHandle.boundingBox();
  const mouseY = box!.y + box!.height / 2;
  await page.mouse.move(box!.x + box!.width / 2, mouseY);
  await page.mouse.down();
  // Move enough to activate dnd-kit MouseSensor
  lastDragMouseY = mouseY + 20;
  await page.mouse.move(box!.x + box!.width / 2, lastDragMouseY);
});

Then('the drag overlay is within {int}px of the mouse vertically', async ({ page }, threshold: number) => {
  const overlay = page.getByTestId('drag-overlay');
  await expect(overlay).toBeVisible({ timeout: 3000 });
  const box = await overlay.boundingBox();
  expect(box).toBeTruthy();
  const overlayCenterY = box!.y + box!.height / 2;
  const distance = Math.abs(overlayCenterY - lastDragMouseY);
  expect(distance).toBeLessThanOrEqual(threshold);
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

// --- depth by horizontal drag ---------------------------------------------
async function dragSideways(page: import('@playwright/test').Page, name: string, dx: number) {
  const row = page.getByTestId('task-row').filter({ hasText: name }).first();
  const box = await row.boundingBox();
  const x = box!.x + box!.width * 0.45;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  // Past the MouseSensor's activation distance first, then sideways.
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(x + (dx * i) / 10, y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

When('I drag {string} to the right', async ({ page }, name: string) => {
  await dragSideways(page, name, 70);
});

When('I drag {string} to the left', async ({ page }, name: string) => {
  await dragSideways(page, name, -70);
});
