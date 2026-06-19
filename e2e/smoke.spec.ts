import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

interface PoolCard {
  name: string;
  level: number | null;
  summonType: string | null;
}

/** Pick two real Level-4 main-deck monsters from the committed index. */
function twoLevel4Names(): [string, string] {
  const pool: PoolCard[] = JSON.parse(
    readFileSync(resolve(process.cwd(), 'public/data/input-pool.json'), 'utf8'),
  );
  const lvl4 = pool.filter((c) => c.level === 4 && c.summonType === null);
  if (lvl4.length < 2) throw new Error('expected at least two Level-4 monsters in the pool');
  return [lvl4[0].name, lvl4[1].name];
}

test('loads data, adds two Level-4 materials, and shows results', async ({ page }) => {
  const appErrors: string[] = [];
  page.on('console', (msg) => {
    // Ignore image/resource noise (YGOPRODeck images may be unreachable in CI).
    if (
      msg.type() === 'error' &&
      !/ygoprodeck|favicon|Failed to load resource|net::|404/i.test(msg.text())
    ) {
      appErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => appErrors.push(err.message));

  // Use a relative path: baseURL includes the Pages base (/extra-wizard/), and
  // "/" would resolve to the server root (not served under the base).
  await page.goto('./');

  // Card data finished loading (status line reports the target count).
  await expect(page.locator('.status')).toContainText('Extra Deck targets', { timeout: 30_000 });

  const [a, b] = twoLevel4Names();
  const search = page.getByPlaceholder(/search a monster/i);
  for (const name of [a, b]) {
    await search.fill(name);
    await page
      .locator('.search__item')
      .filter({ has: page.getByText(name, { exact: true }) })
      .first()
      .click();
  }

  await expect(page.locator('.chip')).toHaveCount(2);
  await expect(page.locator('.rc').first()).toBeVisible({ timeout: 15_000 });
  expect(await page.locator('.rc').count()).toBeGreaterThan(0);

  // Mode toggle is interactive.
  await page.getByRole('tab', { name: /use all/i }).click();
  await expect(page.getByRole('tab', { name: /use all/i })).toHaveAttribute('aria-selected', 'true');

  await page.screenshot({ path: 'e2e-smoke.png' });
  expect(appErrors, `unexpected console/page errors:\n${appErrors.join('\n')}`).toEqual([]);
});
