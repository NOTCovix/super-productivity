import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from '../../fixtures/webdav.fixture';
import { SyncPage } from '../../pages/sync.page';
import {
  closeContextsSafely,
  createSyncFolder,
  generateSyncFolderName,
  setupSyncClient,
  waitForSyncComplete,
  WEBDAV_CONFIG_TEMPLATE,
} from '../../utils/sync-helpers';

interface HabitClient {
  page: Page;
  sync: SyncPage;
}

const sync = async (client: HabitClient): Promise<void> => {
  await client.sync.triggerSync();
  expect(await waitForSyncComplete(client.page, client.sync)).toBe('success');
};

for (const format of ['v2', 'v3'] as const) {
  for (const winner of ['A', 'B'] as const) {
    test(`@webdav Flux habits ${format}: distinct dates survive and ${winner} wins concurrent same-day edits`, async ({
      browser,
      baseURL,
      request,
      webdavServerUp,
    }) => {
      void webdavServerUp;
      test.setTimeout(240000);
      const contexts: BrowserContext[] = [];
      const folder = generateSyncFolderName(`flux-habits-${format}-${winner}`);
      await createSyncFolder(request, folder);
      const config = {
        ...WEBDAV_CONFIG_TEMPLATE,
        syncFolderPath: `/${folder}`,
        isUseSplitSyncFiles: format === 'v3',
      };
      const join = async (): Promise<HabitClient> => {
        const { context, page } = await setupSyncClient(browser, baseURL);
        contexts.push(context);
        const client = { page, sync: new SyncPage(page) };
        await client.sync.setupWebdavSync(config);
        expect(await waitForSyncComplete(page, client.sync)).toBe('success');
        // Explicit clicks control every sync, including after restart.
        await page.addInitScript(() => {
          (window as unknown as Record<string, unknown>).__SP_E2E_BLOCK_AUTO_SYNC = true;
        });
        await page.evaluate(() => {
          (window as unknown as Record<string, unknown>).__SP_E2E_BLOCK_AUTO_SYNC = true;
        });
        return client;
      };
      try {
        const a = await join();
        await a.page.goto('/#/habits');
        await expect(a.page.locator('flux-habit-manager')).toBeVisible();
        await a.page.getByRole('button', { name: 'Create habit', exact: true }).click();
        await a.page.locator('input[name="name"]').fill('WebDAV habit');
        await a.page.locator('select[name="type"]').selectOption('limit');
        await a.page.locator('input[name="target"]').fill('2');
        const today = await a.page.locator('input[name="start"]').inputValue();
        const date = new Date(`${today}T12:00:00`);
        date.setDate(date.getDate() - 1);
        const yesterday = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        await a.page.locator('input[name="start"]').fill(yesterday);
        await a.page.getByRole('button', { name: 'Save', exact: true }).click();
        await sync(a);
        const b = await join();
        await b.page.goto('/#/habits');
        const av = a.page.locator('.habit-card input[type="number"]');
        const bv = b.page.locator('.habit-card input[type="number"]');
        await a.page.getByLabel('Log date').fill(yesterday);
        await av.fill('1');
        await bv.fill('0');
        await sync(a);
        await sync(b);
        await sync(a);
        await a.page.getByLabel('Log date').fill(today);
        await expect(av).toHaveValue('0');
        await expect(a.page.locator('.habit-card .habit-status')).toHaveText('Completed');
        await b.page.getByLabel('Log date').fill(yesterday);
        await expect(bv).toHaveValue('1');
        await b.page.getByLabel('Log date').fill(today);
        const losing = winner === 'A' ? b : a;
        const winning = winner === 'A' ? a : b;
        await losing.page.locator('.habit-card input[type="number"]').fill('3');
        // Separate real timestamps to make the expected LWW winner unambiguous.
        await winning.page.waitForTimeout(1100);
        await winning.page.locator('.habit-card input[type="number"]').fill('2');
        await expect(losing.page.locator('.habit-card input[type="number"]')).toHaveValue(
          '3',
        );
        await expect(
          winning.page.locator('.habit-card input[type="number"]'),
        ).toHaveValue('2');
        await sync(a);
        await sync(b);
        await sync(a);
        await sync(b);
        for (const client of [a, b]) {
          await expect(
            client.page.locator('.habit-card input[type="number"]'),
          ).toHaveValue('2');
          await expect(client.page.locator('.habit-card .habit-status')).toHaveText(
            'Completed',
          );
          await client.page.reload({ waitUntil: 'domcontentloaded' });
          await expect(
            client.page.locator('.habit-card input[type="number"]'),
          ).toHaveValue('2');
          await client.page.getByLabel('Log date').fill(yesterday);
          await expect(
            client.page.locator('.habit-card input[type="number"]'),
          ).toHaveValue('1');
        }
      } finally {
        await closeContextsSafely(...contexts);
      }
    });
  }
}
