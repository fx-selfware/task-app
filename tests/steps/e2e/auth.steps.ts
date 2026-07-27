import { createBdd } from 'playwright-bdd';
const { Given, When, Then } = createBdd();
import { expect } from '@playwright/test';
import jwt from 'jsonwebtoken';
import { NEW_USER_NAME } from './common.steps';

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

/**
 * Session-resilience steps. Only /api/auth/me is interfered with: the point is
 * that a failure to *confirm* who you are is not the same as being signed out,
 * so the rest of the app is deliberately left working. Scenarios run serially
 * (workers: 1), so a module-level switch is enough to flip the route mid-test.
 */
const sessionCheck = { failuresLeft: 0, stalled: false };

/**
 * Long enough that the assertions in a scenario all finish while the check is
 * still outstanding — a stalled check is the point, since anything asserted
 * while it hangs was rendered without knowing who the user is.
 */
const STALL_MS = 30_000;

async function interceptSessionCheck(page: import('@playwright/test').Page) {
  sessionCheck.failuresLeft = 0;
  sessionCheck.stalled = false;
  await page.route('**/api/auth/me', async (route) => {
    // Held rather than slept, so a step can end the stall and watch the app
    // recover — a fixed sleep could only ever show the pending half.
    const until = Date.now() + STALL_MS;
    while (sessionCheck.stalled && Date.now() < until) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (sessionCheck.failuresLeft === 0) return route.continue();
    if (sessionCheck.failuresLeft > 0) sessionCheck.failuresLeft -= 1;
    return route.abort('failed');
  });
}

Given('the session check fails once before recovering', async ({ page }) => {
  await interceptSessionCheck(page);
  sessionCheck.failuresLeft = 1;
});

Given('the session check keeps failing', async ({ page }) => {
  await interceptSessionCheck(page);
  sessionCheck.failuresLeft = Infinity;
});

When('the session check recovers', async () => {
  sessionCheck.failuresLeft = 0;
});

Given('the session check is slow to answer', async ({ page }) => {
  await interceptSessionCheck(page);
  sessionCheck.stalled = true;
});

When('the session check answers', async () => {
  sessionCheck.stalled = false;
});

Then('the account area shows a placeholder', async ({ page }) => {
  await expect(page.getByTestId('account-loading')).toBeVisible();
});

Then('the account area no longer shows a placeholder', async ({ page }) => {
  await expect(page.getByTestId('account-loading')).toHaveCount(0);
});

/** A properly signed token the server will reject — the state a week away leaves behind. */
Given('my session token has expired', async ({ page }) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET must be set for this step (see playwright.config.ts)');

  const context = page.context();
  const current = (await context.cookies()).find((c) => c.name === 'token');
  if (!current) throw new Error('expected a session cookie to expire');

  const { userId, email, role } = jwt.decode(current.value) as {
    userId: string;
    email: string;
    role: string;
  };

  await context.clearCookies({ name: 'token' });
  await context.addCookies([
    {
      name: 'token',
      value: jwt.sign({ userId, email, role }, secret, { expiresIn: '-1h' }),
      url: page.url(),
      httpOnly: true,
      sameSite: 'Strict',
      // The cookie itself outlives the token inside it, so the request still
      // carries it and the server is the one that rejects the session.
      expires: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    },
  ]);
});

/** A cold launch, the way the installed app starts: whatever start_url resolves to. */
When('I reopen the app', async ({ page }) => {
  await page.goto('/');
});

/**
 * Returning to an app that never stopped running. The session query holds its
 * answer for five minutes, so going past that and refocusing the tab is what
 * actually provokes a recheck — the same thing a backgrounded phone does, and
 * the only way to reach the recheck path without reloading and losing the
 * cached user this asserts on.
 */
When('I come back to the app after a while', async ({ page }) => {
  let attempts = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/auth/me')) attempts += 1;
  });

  await page.clock.install();
  await page.clock.fastForward('06:00');
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));

  // Wait for the recheck to stop before letting the scenario assert, or the
  // assertion describes the moment before the app reacted and passes for the
  // wrong reason. Two equal readings taken further apart than the retry
  // backoff (1s, then 2s) mean it has run out of attempts; insisting on at
  // least one also catches this step silently failing to provoke a recheck.
  let previous = -1;
  await expect
    .poll(
      () => {
        const settled = attempts > 0 && attempts === previous;
        previous = attempts;
        return settled;
      },
      { intervals: [2500, 2500, 2500, 2500, 2500, 2500], timeout: 25_000 },
    )
    .toBe(true);
});

/**
 * The sidebar's account name comes from /api/auth/me, so it cannot appear
 * before the session was confirmed — and never appears at all if the app
 * redirected to the login screen. Asserting the URL instead would pass on the
 * frame before a client-side redirect fires.
 */
Then('I am still signed in', async ({ page }) => {
  await expect(page.getByText(NEW_USER_NAME)).toBeVisible();
  await expect(page).toHaveURL(/\/task-lists/);
});

Then('I am told the app cannot reach the server', async ({ page }) => {
  await expect(page.getByText("Can't reach the server")).toBeVisible();
});

Then('I am no longer told the app cannot reach the server', async ({ page }) => {
  await expect(page.getByText("Can't reach the server")).not.toBeVisible();
});

When('I retry reaching the server', async ({ page }) => {
  await page.getByRole('button', { name: 'Try again' }).click();
});

