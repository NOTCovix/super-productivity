import { expect, test } from '../../fixtures/webdav.fixture';
import type { BrowserContext, Page } from '@playwright/test';
import { SyncPage } from '../../pages/sync.page';
import {
  closeContextsSafely,
  createSyncFolder,
  generateSyncFolderName,
  setupSyncClient,
  waitForSyncComplete,
  WEBDAV_CONFIG_TEMPLATE,
} from '../../utils/sync-helpers';

test('@webdav Journal preserves independently edited dates and survives restart', async ({
  browser,
  baseURL,
  request,
  webdavServerUp,
}) => {
  void webdavServerUp;
  test.setTimeout(180000);
  const contexts: BrowserContext[] = [];
  const folder = generateSyncFolderName('flux-journal');
  await createSyncFolder(request, folder);
  const config = {
    ...WEBDAV_CONFIG_TEMPLATE,
    syncFolderPath: `/${folder}`,
    isUseSplitSyncFiles: true,
  };
  const sync = async (page: Page): Promise<void> => {
    const panel = new SyncPage(page);
    await panel.triggerSync();
    expect(await waitForSyncComplete(page, panel)).toBe('success');
  };
  const join = async (): Promise<Page> => {
    const { context, page } = await setupSyncClient(browser, baseURL);
    contexts.push(context);
    const panel = new SyncPage(page);
    await panel.setupWebdavSync(config);
    expect(await waitForSyncComplete(page, panel)).toBe('success');
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__SP_E2E_BLOCK_AUTO_SYNC = true;
    });
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__SP_E2E_BLOCK_AUTO_SYNC = true;
    });
    await page.goto('/#/journal');
    return page;
  };
  try {
    const a = await join();
    const av = a.locator('flux-journal-page textarea');
    const today = await a.getByLabel('Entry date', { exact: true }).inputValue();
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() - 1);
    const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await av.fill('Shared baseline');
    await av.blur();
    await sync(a);
    const b = await join();
    const bv = b.locator('flux-journal-page textarea');
    await expect(bv).toHaveValue('Shared baseline');
    await b.getByLabel('Entry date', { exact: true }).fill(yesterday);
    await bv.fill('Independent historical entry');
    await bv.blur();
    await av.fill('Independent current entry');
    await av.blur();
    await sync(a);
    await sync(b);
    await sync(a);
    for (const page of [a, b]) {
      const value = page.locator('flux-journal-page textarea');
      await page.getByLabel('Entry date', { exact: true }).fill(today);
      await expect(value).toHaveValue('Independent current entry');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(value).toHaveValue('Independent current entry');
      await page.getByLabel('Entry date', { exact: true }).fill(yesterday);
      await expect(value).toHaveValue('Independent historical entry');
    }
  } finally {
    await closeContextsSafely(...contexts);
  }
});
