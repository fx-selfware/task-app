import { test as base } from '@playwright/test';
import { type ApiTracker, trackApi } from './harness';
import { type SeededList, type SeededTemplate, type SeededUser, registerUser, seedList, seedTemplate } from './seed';

export interface PerfContext {
  user: SeededUser;
  list: SeededList;
  template: SeededTemplate;
  tracker: ApiTracker;
}

/**
 * Every scenario gets its own account and fixtures, so scenarios can't perturb
 * each other's timings through leftover state (a list that grew, a cache that
 * stayed warm).
 */
export const test = base.extend<{ perf: PerfContext }>({
  perf: async ({ page }, use) => {
    const tracker = trackApi(page);
    const user = await registerUser(page);
    const list = await seedList(user, { taskCount: 20, subtaskCount: 5 });
    const template = await seedTemplate(user);
    await use({ user, list, template, tracker });
  },
});

export { expect } from '@playwright/test';
