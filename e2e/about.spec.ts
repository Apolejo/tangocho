import { readFileSync } from 'node:fs';
import { expect, test } from './test.ts';

/**
 * Settings → About (SPEC §7.7): the version, the privacy note, and plain links out in new tabs:
 * the thanks links (the same as Today's Thanks).
 */

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

const LINKS = {
  'My sensei': 'https://www.instagram.com/heros.to.nihongo/',
  'Made by @apolejoo': 'https://www.instagram.com/apolejoo/',
  'Buy me a coffee': 'https://paypal.me/apolejo',
};

test('About shows the version, the privacy note and the links, in both languages', async ({
  page,
}) => {
  await page.goto('#/settings');
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
  await expect(page.locator('[data-version]')).toHaveText(
    new RegExp(`^Version ${version} · \\S+$`),
  );
  await expect(page.getByText('Your progress stays on this device')).toBeVisible();

  for (const [name, href] of Object.entries(LINKS)) {
    const link = page.getByRole('link', { name });
    await expect(link).toHaveAttribute('href', href);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }

  await page.getByRole('button', { name: 'Español' }).click();
  await expect(page.getByRole('heading', { name: 'Acerca de' })).toBeVisible();
  await expect(page.locator('[data-version]')).toHaveText(new RegExp(`^Versión ${version} · `));
  await expect(page.getByText('Tu progreso se queda en este dispositivo')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mi sensei' })).toHaveAttribute(
    'href',
    LINKS['My sensei'],
  );
  await expect(page.getByRole('link', { name: 'Hecho por @apolejoo' })).toHaveAttribute(
    'href',
    LINKS['Made by @apolejoo'],
  );
  await expect(page.getByRole('link', { name: 'Invítame a un café' })).toHaveAttribute(
    'href',
    LINKS['Buy me a coffee'],
  );
});
