import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from '../../fixtures/webdav.fixture';
import { SyncPage } from '../../pages/sync.page';
import { WorkViewPage } from '../../pages/work-view.page';
import {
  closeContextsSafely,
  createSyncFolder,
  generateSyncFolderName,
  setupSyncClient,
  waitForSyncComplete,
  WEBDAV_CONFIG_TEMPLATE,
} from '../../utils/sync-helpers';
import { serveReleasedClientAssets } from '../../utils/released-client-assets';

const oldAssets = process.env.FLUX_COMPAT_OLD_ASSETS;
const newAssets = process.env.FLUX_COMPAT_NEW_ASSETS;

test('@webdav Flux habits survive an unmodified released client and an upgrade', async ({
  browser,
  request,
  webdavServerUp,
}) => {
  void webdavServerUp;
  test.skip(
    !oldAssets || !newAssets,
    'Set FLUX_COMPAT_OLD_ASSETS and FLUX_COMPAT_NEW_ASSETS to the built clients',
  );
  test.setTimeout(240000);
  const assets = await serveReleasedClientAssets({ old: oldAssets!, new: newAssets! });
  const contexts: BrowserContext[] = [];
  const folder = generateSyncFolderName('flux-habits-released');
  await createSyncFolder(request, folder);
  const config = {
    ...WEBDAV_CONFIG_TEMPLATE,
    syncFolderPath: `/${folder}`,
    isUseSplitSyncFiles: false,
  };
  const sync = async (page: Page, syncPage: SyncPage): Promise<void> => {
    await syncPage.triggerSync();
    expect(await waitForSyncComplete(page, syncPage)).toBe('success');
  };
  try {
    const original = await setupSyncClient(browser, assets.url, [], {
      serviceWorkers: 'block',
    });
    contexts.push(original.context);
    const originalSync = new SyncPage(original.page);
    await originalSync.setupWebdavSync(config);
    expect(await waitForSyncComplete(original.page, originalSync)).toBe('success');
    await original.page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__SP_E2E_BLOCK_AUTO_SYNC = true;
    });
    await original.page.evaluate(() => {
      (window as unknown as Record<string, unknown>).__SP_E2E_BLOCK_AUTO_SYNC = true;
    });
    await original.page.goto('/#/habits');
    await original.page
      .getByRole('button', { name: 'Create habit', exact: true })
      .click();
    await original.page.locator('input[name="name"]').fill('Preserved caffeine limit');
    await original.page.locator('select[name="type"]').selectOption('limit');
    await original.page.locator('input[name="target"]').fill('2');
    await original.page.getByRole('button', { name: 'Save', exact: true }).click();
    await original.page.locator('.habit-card input[type="number"]').fill('0');
    await expect(original.page.locator('.habit-card .habit-status')).toHaveText(
      'Completed',
    );
    await sync(original.page, originalSync);

    // Use the unmodified release with the SAME origin and existing IndexedDB.
    await original.context.addCookies([
      { name: 'compat-release', value: 'old', url: assets.url },
    ]);
    await original.page.reload({ waitUntil: 'domcontentloaded' });
    await expect(original.page.locator('habit-tracker')).toBeVisible();
    await expect(original.page.locator('flux-habit-manager')).toHaveCount(0);
    await original.page.goto('/#/tag/TODAY/tasks');
    await new WorkViewPage(original.page).addTask('Task created by the released client');
    await sync(original.page, originalSync);

    // A fresh fork client must receive BOTH the old client's task and opaque habit data.
    const fresh = await setupSyncClient(browser, assets.url, [], {
      serviceWorkers: 'block',
    });
    contexts.push(fresh.context);
    const freshSync = new SyncPage(fresh.page);
    await freshSync.setupWebdavSync(config);
    expect(await waitForSyncComplete(fresh.page, freshSync)).toBe('success');
    await fresh.page.goto('/#/habits');
    await expect(fresh.page.locator('.habit-card input[type="number"]')).toHaveValue('0');
    await expect(fresh.page.locator('.habit-card .habit-status')).toHaveText('Completed');
    await expect(fresh.page.locator('.habit-card .habit-name')).toContainText(
      'Preserved caffeine limit',
    );
    await expect(fresh.page.locator('.habit-card .habit-name small')).toContainText('2');
    await fresh.page.goto('/#/tag/TODAY/tasks');
    await expect(fresh.page.locator('task.ng-animating')).toHaveCount(0);
    await expect(
      fresh.page
        .locator('task')
        .filter({ hasText: 'Task created by the released client' }),
    ).toBeVisible();

    // Upgrade the original client with WebDAV blocked, so remote repair cannot
    // hide loss of opaque records during the released client's local restart/write.
    await original.context.addCookies([
      { name: 'compat-release', value: 'new', url: assets.url },
    ]);
    await original.page.route('http://127.0.0.1:2345/**', (route) => route.abort());
    await original.page.goto('/#/habits');
    await original.page.reload({ waitUntil: 'domcontentloaded' });
    await expect(original.page.locator('.habit-card input[type="number"]')).toHaveValue(
      '0',
    );
    await expect(original.page.locator('.habit-card .habit-status')).toHaveText(
      'Completed',
    );
    await expect(original.page.locator('.habit-card .habit-name')).toContainText(
      'Preserved caffeine limit',
    );
    await expect(original.page.locator('.habit-card .habit-name small')).toContainText(
      '2',
    );
  } finally {
    await closeContextsSafely(...contexts);
    await assets.close();
  }
});
