import type { Page } from './test.ts';

/** GitHub's API for the open word reports (SPEC §5.7): answered here, never reached. */
export const REPORTS_API = 'https://api.github.com/repos/Apolejo/tangocho/issues?**';
const CORS = { 'Access-Control-Allow-Origin': '*' };

/** Answers the API with `issues`, counting the requests. */
export async function answerReports(
  page: Page,
  issues: unknown,
  status = 200,
): Promise<{ count: number }> {
  const asked = { count: 0 };
  await page.route(REPORTS_API, (route) => {
    asked.count++;
    return route.fulfill({ status, json: issues, headers: CORS });
  });
  return asked;
}

/** Turns on Settings → About → "Count open word reports", as a player would; it starts off. */
export async function countOpenReports(page: Page): Promise<void> {
  await page.goto('#/settings');
  await page
    .getByRole('group', { name: 'Count open word reports' })
    .getByRole('radio', { name: 'On' })
    .check();
}

/** The notebook with "2 open word reports" on screen. */
export async function showReportsBanner(page: Page): Promise<void> {
  await answerReports(page, [{ number: 1 }, { number: 2 }]);
  await countOpenReports(page);
  await page.goto('#/notebook');
  await page.getByRole('complementary', { name: 'Word reports' }).waitFor();
}
