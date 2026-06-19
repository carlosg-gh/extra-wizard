import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const BASE_PATH = '/extra-wizard/';

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
  const logs: string[] = [];
  page.on('console', (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) =>
    logs.push(`[requestfailed] ${r.url()} :: ${r.failure()?.errorText ?? ''}`),
  );

  const resp = await page.goto(BASE_PATH, { waitUntil: 'load' });
  console.log(`navigated to ${page.url()} (HTTP ${resp?.status()})`);

  const status = page.locator('.status');
  try {
    await expect(status).toBeVisible({ timeout: 20_000 });
  } catch (err) {
    // Diagnostics: surface why the app didn't mount (logs aren't a Pages artifact).
    const rootHtml = await page
      .locator('#root')
      .innerHTML()
      .catch(() => '<no #root element>');
    console.log('--- #root innerHTML (first 2000 chars) ---\n' + rootHtml.slice(0, 2000));
    console.log('--- page console / network ---\n' + (logs.join('\n') || '(none captured)'));
    throw err;
  }
  await expect(status).toContainText('Extra Deck targets', { timeout: 20_000 });

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

  await page.getByRole('tab', { name: /use all/i }).click();
  await expect(page.getByRole('tab', { name: /use all/i })).toHaveAttribute('aria-selected', 'true');

  // Clicking a result opens the detail modal; Escape closes it. (The live YGOPRODeck
  // detail fetch may or may not resolve in CI; the modal renders from index data regardless.)
  await page.locator('.rc').first().click();
  await expect(page.locator('.modal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal')).toHaveCount(0);

  // Bridge mode (chained summoning) re-runs the query and still yields results
  // (it's a superset of the direct matches).
  const bridge = page.getByRole('switch', { name: /bridge mode/i });
  await bridge.check();
  await expect(bridge).toBeChecked();
  await expect(page.locator('.rc').first()).toBeVisible({ timeout: 20_000 });
  expect(await page.locator('.rc').count()).toBeGreaterThan(0);

  // Fail only on genuine app errors (ignore unreachable card images in CI).
  const appErrors = logs.filter(
    (l) =>
      l.startsWith('[pageerror]') ||
      (l.startsWith('[console.error]') &&
        !/ygoprodeck|favicon|Failed to load resource|net::|status of 4/i.test(l)),
  );
  expect(appErrors, appErrors.join('\n')).toEqual([]);
});
