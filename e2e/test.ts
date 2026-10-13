import { test as base } from '@playwright/test';

export { expect, type Page } from '@playwright/test';

/**
 * Every e2e test imports `test` from here: GitHub's API answers "no open word reports", so no
 * test ever reaches GitHub (SPEC §5.7). A test that needs another answer routes it on the page,
 * which takes precedence.
 */
export const test = base.extend<{ noGitHub: void }>({
  noGitHub: [
    async ({ context }, use) => {
      await context.route('https://api.github.com/**', (route) =>
        route.fulfill({ json: [], headers: { 'Access-Control-Allow-Origin': '*' } }),
      );
      await use();
    },
    { auto: true },
  ],
});
