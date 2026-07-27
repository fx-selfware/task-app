import { createBdd } from 'playwright-bdd';
const { Given, When, Then } = createBdd();
import { expect } from '@playwright/test';

Given(
  'I have a task list with tasks {string} and {string} ready to view',
  async ({ page }, task1: string, task2: string) => {
    const listRes = await page.request.post('/api/task-lists', {
      data: { name: 'Drag Test' },
    });
    const { list } = await listRes.json();
    await page.request.post(`/api/task-lists/${list.id}/tasks`, { data: { title: task1 } });
    await page.request.post(`/api/task-lists/${list.id}/tasks`, { data: { title: task2 } });
    await page.goto(`/task-lists/${list.id}`);
    await expect(page.getByText(task1)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(task2)).toBeVisible({ timeout: 5000 });
  },
);

When(
  'I type {string} in the composer then press Enter',
  async ({ page }, title: string) => {
    const composer = page.getByLabel('Add a task');
    await composer.fill(title);
    await composer.press('Enter');
  },
);

When('I open the row {string}', async ({ page }, name: string) => {
  await page.getByTestId('task-title').filter({ hasText: name }).first().click();
});

Then('the row actions are visible without hovering', async ({ page }) => {
  // No hover anywhere in this step: the actions must already be on screen.
  await expect(page.getByRole('button', { name: 'Add subtask' })).toBeVisible({ timeout: 3000 });
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeVisible({ timeout: 3000 });
});

When('I drag {string} above {string}', async ({ page }, item: string, target: string) => {
  const titles = await page.getByTestId('task-title').allTextContents();
  const itemIdx = titles.findIndex((t) => t.trim() === item);
  const targetIdx = titles.findIndex((t) => t.trim() === target);

  // There is no grip any more — the whole row is the handle.
  const sourceHandle = page.getByTestId('task-row').nth(itemIdx);
  const targetCard = page.getByTestId('task-row').nth(targetIdx);

  const sourceBB = await sourceHandle.boundingBox();
  const targetBB = await targetCard.boundingBox();

  const startX = sourceBB!.x + sourceBB!.width / 2;
  const startY = sourceBB!.y + sourceBB!.height / 2;
  const endX = targetBB!.x + targetBB!.width / 2;
  const endY = targetBB!.y + 2;

  // Use CDP to inject real browser-level touch events (same path as a physical finger)
  const client = await page.context().newCDPSession(page);

  // Press and hold on the drag handle — starts TouchSensor's 250ms activation timer
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y: startY, id: 1 }],
  });

  // Hold for longer than the 250ms delay so TouchSensor activates the drag
  await page.waitForTimeout(300);

  // Slide from source to target
  const steps = 15;
  for (let i = 1; i <= steps; i++) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{
        x: startX + (endX - startX) * (i / steps),
        y: startY + (endY - startY) * (i / steps),
        id: 1,
      }],
    });
  }

  // Lift finger to drop
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [{ x: endX, y: endY, id: 1 }],
  });

  await client.detach();
});

Then(
  '{string} appears before {string} in the task list',
  async ({ page }, first: string, second: string) => {
    await expect(async () => {
      const titles = await page.getByTestId('task-title').allTextContents();
      const firstIdx = titles.findIndex((t) => t.trim() === first);
      const secondIdx = titles.findIndex((t) => t.trim() === second);
      expect(firstIdx).toBeGreaterThanOrEqual(0);
      expect(secondIdx).toBeGreaterThanOrEqual(0);
      expect(firstIdx).toBeLessThan(secondIdx);
    }).toPass({ timeout: 5000 });
  },
);

Given('I am using a 375px wide viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
});


// --- gestures -------------------------------------------------------------
// Driven through CDP so the browser's own gesture arbitration runs, the same
// path a physical finger takes. Playwright's touchscreen API cannot drag.
async function swipe(page: import('@playwright/test').Page, name: string, dx: number) {
  const row = page.getByTestId('task-row').filter({ hasText: name }).first();
  const box = await row.boundingBox();
  const x = box!.x + box!.width * 0.5;
  const y = box!.y + box!.height / 2;
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + (dx * i) / steps, y, id: 1 }],
    });
    await page.waitForTimeout(12);
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.detach();
}

When('I swipe {string} right', async ({ page }, name: string) => {
  await swipe(page, name, 140);
});

When('I swipe {string} left', async ({ page }, name: string) => {
  await swipe(page, name, -140);
});

When('I swipe {string} left by {int} pixels', async ({ page }, name: string, px: number) => {
  await swipe(page, name, -px);
});

Then('the row actions for {string} are revealed', async ({ page }, name: string) => {
  const row = page.getByTestId('task-row').filter({ hasText: name }).first();
  await expect(row.getByRole('button', { name: 'Delete', exact: true })).toBeVisible({ timeout: 3000 });
});

Then('the row actions for {string} are not revealed', async ({ page }, name: string) => {
  const row = page.getByTestId('task-row').filter({ hasText: name }).first();
  await expect(row.getByRole('button', { name: 'Delete', exact: true })).not.toBeVisible({ timeout: 2000 });
});
