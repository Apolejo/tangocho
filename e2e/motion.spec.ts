import { daysAgo, importProgress, seedFile, seedRound } from './seed.ts';
import { expect, test, type Locator, type Page } from './test.ts';

/**
 * Motion (SPEC §13): ◯/✕ and the seals press onto the paper, the 花丸 draws itself, and today's
 * hanko presses onto the stamp card once. All of it is off under prefers-reduced-motion, where
 * the finished marks simply appear.
 */

/** Wednesday 14 October 2026, noon (local time). */
const NOW = new Date(2026, 9, 14, 12, 0);

/** A computed style of the element (e2e has no DOM types, hence the cast). */
const computed = (locator: Locator, property: string) =>
  locator.evaluate(
    (el, name) =>
      (
        globalThis as unknown as { getComputedStyle(el: unknown): Record<string, string> }
      ).getComputedStyle(el)[name],
    property,
  );
const animationName = (locator: Locator) => computed(locator, 'animationName');
const dashOffset = (locator: Locator) => computed(locator, 'strokeDashoffset');

/** Plays a whole quiz round of 10 with every answer right, by tap or by key. */
async function perfectRound(page: Page, isMobile: boolean, onFirst?: () => Promise<void>) {
  await page.goto('#/play/quiz');
  await page.getByRole('radio', { name: '10 questions' }).check();
  await page.getByRole('button', { name: 'Start' }).click();
  for (let i = 0; i < 10; i++) {
    await expect(page.locator('[data-progress]')).toContainText(`${i + 1} / 10`);
    const target = await page.locator('[data-quiz-prompt]').getAttribute('data-word-id');
    const choice = page.locator(`[data-choice][data-word-id="${target}"]`);
    if (isMobile) await choice.tap();
    else await choice.click();
    if (i === 0 && onFirst !== undefined) await onFirst();
  }
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible();
}

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('◯ presses, then 新記録 presses and the 花丸 draws itself', async ({ page, isMobile }) => {
    await perfectRound(page, isMobile, async () => {
      const maru = page.locator('svg[data-animate]');
      await expect(maru).toHaveCount(1);
      expect(await animationName(maru)).toMatch(/press/);
    });

    const record = page.getByRole('img', { name: 'New record' });
    const hanamaru = page.getByRole('img', { name: 'Perfect round' });
    expect(await animationName(record)).toMatch(/press/);
    for (const path of await hanamaru.locator('path').all()) {
      expect(await animationName(path)).toMatch(/draw/);
    }
    // it ends drawn
    await expect.poll(() => dashOffset(hanamaru.locator('path').last())).toMatch(/^0(px)?$/);
  });

  test("today's hanko presses onto the stamp card once", async ({ page }) => {
    await page.clock.setFixedTime(NOW);
    const words = ['sensei', 'isha', 'kaishain', 'gakusei', 'kangoshi', 'keisatsukan', 'enjinia'];
    const answers = Array.from({ length: 20 }, (_, i) => ({
      wordId: words[i % words.length] ?? 'sensei',
      skill: 'meaning' as const,
      correct: i !== 0,
    }));
    await importProgress(
      page,
      seedFile(seedRound({ game: 'quiz', at: daysAgo(NOW, 0, 9), answers })),
    );

    await page.goto('#/');
    const today = page.locator('td[data-today]');
    await expect(today).toHaveAttribute('data-goal', 'true');
    const hanko = today.locator('svg');
    await expect(hanko).toHaveAttribute('data-animate', 'true');
    expect(await animationName(hanko)).toMatch(/press/);

    await page.reload();
    await expect(today.locator('svg')).toBeVisible();
    await expect(today.locator('[data-animate]')).toHaveCount(0);
  });
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the marks appear finished, without animation', async ({ page, isMobile }) => {
    await perfectRound(page, isMobile, async () => {
      expect(await animationName(page.locator('svg[data-animate]'))).toBe('none');
    });
    const hanamaru = page.getByRole('img', { name: 'Perfect round' });
    expect(await animationName(page.getByRole('img', { name: 'New record' }))).toBe('none');
    for (const path of await hanamaru.locator('path').all()) {
      expect(await animationName(path)).toBe('none');
      expect(await dashOffset(path)).toMatch(/^0(px)?$/);
    }
  });
});
