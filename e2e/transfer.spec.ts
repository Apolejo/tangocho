import { readFile } from 'node:fs/promises';
import { importProgress, seedFile, seedRound } from './seed.ts';
import { expect, test, type Page } from './test.ts';

/**
 * Moving progress between devices (SPEC §10.1): a round played on the phone is exported, then
 * imported into the computer, which keeps its own progress and gains the phone's; importing the
 * same file again changes nothing. On a phone, export opens the share sheet.
 */

/** The events in the app's IndexedDB log, counted by type (a string, so it runs in the page). */
const COUNT_EVENTS = `new Promise((resolve, reject) => {
  const req = indexedDB.open('tangocho');
  req.onerror = () => reject(req.error);
  req.onsuccess = () => {
    const db = req.result;
    const all = db.transaction('events').objectStore('events').getAll();
    all.onsuccess = () => {
      db.close();
      resolve({
        answers: all.result.filter((e) => e.type === 'answer').length,
        rounds: all.result.filter((e) => e.type === 'round').length,
      });
    };
    all.onerror = () => reject(all.error);
  };
})`;

/** No share sheet: export downloads, as on a computer. */
const NO_SHARE = `delete Navigator.prototype.share; delete Navigator.prototype.canShare;`;

/** A sorter round of 10 on the default setup, answering group 1 every time. */
async function playSorterRound(page: Page, isMobile: boolean): Promise<void> {
  await page.goto('#/play/sorter');
  await page.getByRole('button', { name: 'Start' }).click();
  for (let i = 1; i <= 10; i++) {
    await expect(page.locator('[data-progress]')).toContainText(`${i} / 10`);
    const group = page.getByRole('button', { name: 'Group 1', exact: true });
    if (isMobile) await group.tap();
    else await page.keyboard.press('1');
    const next = page.getByRole('button', { name: 'Continue' });
    if (isMobile) await next.tap();
    else await next.click();
  }
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
}

test('progress exported from the phone merges into the computer', async ({
  page,
  browser,
  isMobile,
}, testInfo) => {
  // the phone plays a round and exports it
  await page.addInitScript(NO_SHARE);
  await playSorterRound(page, isMobile);
  await page.goto('#/settings');
  await expect(page.locator('[data-last-export]')).toHaveText('Never exported from this device.');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export progress' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^tangocho-progress-\d{4}-\d{2}-\d{2}\.json$/);
  const exported = await readFile(await download.path(), 'utf8');
  const file = JSON.parse(exported) as { app: string; version: number; events: unknown[] };
  expect(file.app).toBe('tangocho');
  expect(file.version).toBe(1);
  expect(file.events).toHaveLength(11);
  await expect(page.locator('[data-transfer-status]')).toHaveText('Exported.');
  await expect(page.locator('[data-last-export]')).toContainText('Last export:');

  // the computer has progress of its own
  const computer = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  await computer.route('https://api.github.com/**', (route) =>
    route.fulfill({ json: [], headers: { 'Access-Control-Allow-Origin': '*' } }),
  );
  const desk = await computer.newPage();
  const mine = seedRound({
    game: 'quiz',
    at: new Date(Date.now() - 60_000),
    answers: ['sensei', 'isha', 'gakusei'].map((wordId) => ({ wordId, skill: 'meaning' })),
    device: 'computer',
  });
  expect(await importProgress(desk, seedFile(mine, 'computer'))).toBe(
    'Merged: 4 new · 0 already here · 0 skipped',
  );

  // the phone's file merges in, once
  expect(await importProgress(desk, exported)).toBe('Merged: 11 new · 0 already here · 0 skipped');
  await expect.poll(() => desk.evaluate(COUNT_EVENTS)).toEqual({ answers: 13, rounds: 2 });
  expect(await importProgress(desk, exported)).toBe('Merged: 0 new · 11 already here · 0 skipped');
  await expect.poll(() => desk.evaluate(COUNT_EVENTS)).toEqual({ answers: 13, rounds: 2 });

  // and counts toward the computer's day
  await desk.getByRole('link', { name: 'Today' }).click();
  await expect(desk.locator('[data-answered]')).toContainText('13 of 20 answers');
  await computer.close();
});

test('a file that is not an export is refused', async ({ page }) => {
  expect(await importProgress(page, '{"hello":"world"}')).toBe(
    "That file isn't a Tangochō export.",
  );
  expect(await importProgress(page, '{"app":"tangocho","version":9,"events":[]}')).toBe(
    'That file comes from a newer version of the app. Update this one first.',
  );
});

test('on a phone, export opens the share sheet', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the share sheet is for touch screens');
  // a share sheet that is cancelled first, then used
  await page.addInitScript(`
    let calls = 0;
    Navigator.prototype.canShare = () => true;
    Navigator.prototype.share = async (data) => {
      calls++;
      if (calls === 1) throw new DOMException('cancelled', 'AbortError');
      const file = data.files[0];
      window.__shared = { name: file.name, text: await file.text() };
    };
  `);
  await importProgress(
    page,
    seedFile(
      seedRound({
        game: 'quiz',
        at: new Date(),
        answers: [{ wordId: 'sensei', skill: 'meaning' }],
      }),
    ),
  );
  const exportButton = page.getByRole('button', { name: 'Export progress' });

  await exportButton.tap();
  await expect(page.locator('[data-last-export]')).toHaveText('Never exported from this device.');

  await exportButton.tap();
  await expect(page.locator('[data-transfer-status]')).toHaveText('Exported.');
  const shared = (await page.evaluate('window.__shared')) as { name: string; text: string };
  expect(shared.name).toMatch(/^tangocho-progress-\d{4}-\d{2}-\d{2}\.json$/);
  expect((JSON.parse(shared.text) as { events: unknown[] }).events).toHaveLength(2);
  await expect(page.locator('[data-last-export]')).toContainText('Last export:');
});
