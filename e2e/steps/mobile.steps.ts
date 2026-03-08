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
  'I press "+ Task" and type {string} then press Enter',
  async ({ page }, title: string) => {
    await page.getByRole('button', { name: '+ Task' }).click();
    const titleInput = page.getByLabel('Title');
    await titleInput.fill(title);
    await titleInput.press('Enter');
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
  },
);

Then('the task actions button is visible without hovering', async ({ page }) => {
  const actionsButton = page.getByRole('button', { name: 'Task actions' }).first();
  await expect(actionsButton).toBeVisible({ timeout: 3000 });
});

When('I drag {string} above {string}', async ({ page }, item: string, target: string) => {
  const titles = await page.locator('.group p.font-medium').allTextContents();
  const itemIdx = titles.findIndex((t) => t.trim() === item);
  const targetIdx = titles.findIndex((t) => t.trim() === target);

  const sourceHandle = page.getByRole('button', { name: 'Drag to reorder' }).nth(itemIdx);
  const targetCard = page.locator('.group').nth(targetIdx);

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
      const titles = await page.locator('.group p.font-medium').allTextContents();
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
