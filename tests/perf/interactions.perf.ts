import { IDLE_MS, benchmark, enableNetworkLatency, disableNetworkLatency, record, writeReport } from './harness';
import { expect, test } from './fixtures';

/**
 * Latency benchmark. Each scenario is timed twice:
 *
 *   perceived — the click until the UI shows the result. Optimistic UI drives
 *               this toward zero without the server getting any faster.
 *   settled   — the click until the last request finishes. Batching database
 *               round trips and dropping redundant refetches drive this down.
 *
 * Run it before and after a change and diff the two reports:
 *   PERF_LABEL=before npm run test:perf
 *   PERF_LABEL=after  npm run test:perf
 *   npm run perf:compare before after
 */

test.describe.configure({ timeout: 240_000 });

test.afterAll(() => {
  writeReport();
});

test('cold load of a task list', async ({ page, perf }) => {
  await benchmark(page, perf.tracker, {
    name: 'load:list-detail',
    description: 'Open /task-lists/:id from a cold document load',
    arrange: async () => {
      await page.goto('/task-lists');
      await expect(page.getByRole('heading', { name: perf.list.name })).toBeVisible();
    },
    act: async () => {
      await page.goto(`/task-lists/${perf.list.id}`);
      await expect(page.getByText(perf.list.taskTitle(0), { exact: true })).toBeVisible();
    },
  });
});

test('navigate from the index to a list', async ({ page, perf }) => {
  await benchmark(page, perf.tracker, {
    name: 'nav:index-to-detail',
    description: 'Tap a list card on /task-lists and wait for its tasks',
    arrange: async () => {
      await page.goto('/task-lists');
      await expect(page.getByRole('heading', { name: perf.list.name })).toBeVisible();
    },
    act: async () => {
      await page.getByRole('heading', { name: perf.list.name }).click();
      await expect(page.getByText(perf.list.taskTitle(0), { exact: true })).toBeVisible();
    },
  });
});

test('add a task', async ({ page, perf }) => {
  const title = (run: number) => `Added task ${run}`;

  await page.goto(`/task-lists/${perf.list.id}`);
  await expect(page.getByText(perf.list.taskTitle(0), { exact: true })).toBeVisible();

  await benchmark(page, perf.tracker, {
    name: 'task:add',
    description: 'Submit the add-task modal and wait for the row to appear',
    arrange: async (run) => {
      await page.getByRole('button', { name: 'Add task' }).click();
      await page.getByLabel('Title').fill(title(run));
    },
    act: async (run) => {
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(page.getByText(title(run), { exact: true })).toBeVisible();
    },
  });
});

test('complete a task', async ({ page, perf }) => {
  await page.goto(`/task-lists/${perf.list.id}`);
  await expect(page.getByText(perf.list.taskTitle(0), { exact: true })).toBeVisible();

  await benchmark(page, perf.tracker, {
    name: 'task:complete',
    description: 'Check a task off and wait for the completed count to update',
    act: async (run) => {
      // Task 01 owns the subtasks; start at Task 02 so nothing cascades.
      await page.getByRole('checkbox', { name: `Mark "${perf.list.taskTitle(run + 1)}" as done` }).click();
      await expect(page.getByRole('button', { name: new RegExp(`Completed \\(${run + 1}\\)`) })).toBeVisible();
    },
  });
});

test('complete five tasks in a row', async ({ page, perf }) => {
  await page.goto(`/task-lists/${perf.list.id}`);
  await expect(page.getByText(perf.list.taskTitle(0), { exact: true })).toBeVisible();

  await benchmark(page, perf.tracker, {
    name: 'task:complete-x5',
    description: 'Five checkboxes back to back — exposes per-mutation refetches',
    act: async (run) => {
      const first = 1 + run * 5;
      for (let i = first; i < first + 5; i++) {
        await page.getByRole('checkbox', { name: `Mark "${perf.list.taskTitle(i)}" as done` }).click();
      }
      await expect(page.getByRole('button', { name: new RegExp(`Completed \\(${first + 4}\\)`) })).toBeVisible();
    },
  });
});

test('edit a task title', async ({ page, perf }) => {
  const newTitle = (run: number) => `Edited task ${run}`;

  await page.goto(`/task-lists/${perf.list.id}`);
  await expect(page.getByText(perf.list.taskTitle(0), { exact: true })).toBeVisible();

  await benchmark(page, perf.tracker, {
    name: 'task:edit',
    description: 'Save the edit modal and wait for it to close with the new title shown',
    arrange: async (run) => {
      await page.getByText(perf.list.taskTitle(16 + run), { exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByLabel('Title').fill(newTitle(run));
    },
    act: async (run) => {
      await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
      await expect(page.getByRole('dialog')).toBeHidden();
      await expect(page.getByText(newTitle(run), { exact: true })).toBeVisible();
    },
  });
});

test('delete a task', async ({ page, perf }) => {
  await page.goto(`/task-lists/${perf.list.id}`);
  await expect(page.getByText(perf.list.taskTitle(0), { exact: true })).toBeVisible();

  await benchmark(page, perf.tracker, {
    name: 'task:delete',
    description: 'Confirm the delete dialog and wait for the row to disappear',
    arrange: async (run) => {
      const card = page.locator(`[data-sortable-id="${perf.list.taskIds[19 - run]}"]`);
      await card.getByRole('button', { name: 'Task actions' }).click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    },
    act: async (run) => {
      await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(page.locator(`[data-sortable-id="${perf.list.taskIds[19 - run]}"]`)).toHaveCount(0);
    },
  });
});

test('rename a list', async ({ page, perf }) => {
  const newName = (run: number) => `Renamed list ${run}`;

  await page.goto(`/task-lists/${perf.list.id}`);
  await expect(page.getByText(perf.list.taskTitle(0), { exact: true })).toBeVisible();

  await benchmark(page, perf.tracker, {
    name: 'list:rename',
    description: 'Save the rename modal and wait for the heading to update',
    arrange: async (run) => {
      await page.getByRole('button', { name: 'List actions' }).click();
      await page.getByRole('menuitem', { name: 'Rename' }).click();
      // getByLabel('Name') would also match the "Rename List" dialog itself.
      await page.getByRole('textbox', { name: 'Name', exact: true }).fill(newName(run));
    },
    act: async (run) => {
      await page.getByRole('dialog').getByRole('button', { name: 'Rename' }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(newName(run));
    },
  });
});

test('create a list', async ({ page, perf }) => {
  const name = (run: number) => `Created list ${run}`;
  await page.goto('/task-lists');
  await expect(page.getByRole('heading', { name: perf.list.name })).toBeVisible();

  await benchmark(page, perf.tracker, {
    name: 'list:create',
    description: 'Submit the new-list modal and wait for the card to appear',
    arrange: async (run) => {
      await page.getByRole('button', { name: '+ New List' }).click();
      await page.getByLabel('List name').fill(name(run));
    },
    act: async (run) => {
      await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
      await expect(page.getByRole('heading', { name: name(run) })).toBeVisible();
    },
  });
});

test('add a template task', async ({ page, perf }) => {
  const title = (run: number) => `Added template task ${run}`;

  await page.goto(`/templates/${perf.template.id}`);
  await expect(page.getByText('Template task 1', { exact: true })).toBeVisible();

  await benchmark(page, perf.tracker, {
    name: 'template:add-task',
    description: 'Submit the add-task modal on a template',
    arrange: async (run) => {
      await page.getByRole('button', { name: 'Add task' }).click();
      await page.getByLabel('Title').fill(title(run));
    },
    act: async (run) => {
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(page.getByText(title(run), { exact: true })).toBeVisible();
    },
  });
});

test('apply a template to a list', async ({ page, perf }) => {
  await page.goto(`/templates/${perf.template.id}`);
  await expect(page.getByText('Template task 1', { exact: true })).toBeVisible();

  await benchmark(page, perf.tracker, {
    name: 'template:apply',
    description: 'Apply a template and wait until the modal releases the user',
    arrange: async () => {
      await page.getByRole('button', { name: 'Template actions' }).click();
      await page.getByRole('menuitem', { name: 'Apply' }).click();
      await page.getByRole('dialog').locator('select').selectOption(perf.list.id);
    },
    act: async () => {
      await page.getByRole('dialog').getByRole('button', { name: 'Apply' }).click();
      await expect(page.getByRole('dialog')).toBeHidden();
    },
  });
});

test('background polling cost while idle', async ({ page, perf }) => {
  await page.goto(`/task-lists/${perf.list.id}`);
  await expect(page.getByText(perf.list.taskTitle(0), { exact: true })).toBeVisible();

  await enableNetworkLatency(page);
  const before = perf.tracker.total;
  await page.waitForTimeout(IDLE_MS);
  const apiCalls = perf.tracker.total - before;
  await disableNetworkLatency(page);

  // Only the api column means anything here; the ms columns are the window.
  record({
    name: 'idle:polling',
    description: `API requests issued while sitting idle on a list for ${IDLE_MS / 1000}s`,
    samples: [{ perceivedMs: IDLE_MS, settledMs: IDLE_MS, apiCalls }],
  });
});
