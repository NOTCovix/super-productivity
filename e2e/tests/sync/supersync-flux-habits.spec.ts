import { test, expect } from '../../fixtures/supersync.fixture';
import { Page } from '@playwright/test';
import {
  createTestUser,
  getSuperSyncConfig,
  createSimulatedClient,
  closeClient,
  SimulatedE2EClient,
} from '../../utils/supersync-helpers';

const enableHabits = async (page: Page): Promise<void> => {
  await page.goto('/#/config');
  const toggle = page.getByRole('switch', { name: /Habits/ });
  if (!(await toggle.isChecked())) await toggle.check();
  await page.goto('/#/habits');
  await expect(page.locator('flux-habit-manager')).toBeVisible();
};

for (const winner of ['A', 'B'] as const) {
  for (const firstUploader of ['A', 'B'] as const) {
    test(`@supersync Flux habits: independent dates preserved; ${winner} wins same-day edit, ${firstUploader} uploads first`, async ({
      browser,
      baseURL,
      testRunId,
    }) => {
      test.setTimeout(240000);
      const clients: SimulatedE2EClient[] = [];
      try {
        const user = await createTestUser(testRunId);
        const config = getSuperSyncConfig(user);
        for (const name of ['A', 'B']) {
          const client = await createSimulatedClient(
            browser,
            baseURL || 'http://localhost:4242',
            name,
            testRunId,
          );
          clients.push(client);
          await client.sync.setupSuperSync(config);
        }
        const [a, b] = clients;
        await enableHabits(a.page);
        await a.page.getByRole('button', { name: 'Create habit', exact: true }).click();
        await a.page.locator('input[name="name"]').fill('Synced habit');
        await a.page.locator('select[name="type"]').selectOption('increase');
        await a.page.locator('input[name="target"]').fill('10');
        const today = await a.page.locator('input[name="start"]').inputValue();
        const date = new Date(`${today}T12:00:00`);
        date.setDate(date.getDate() - 1);
        const yesterday = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        await a.page.locator('input[name="start"]').fill(yesterday);
        await a.page.getByRole('button', { name: 'Save', exact: true }).click();
        await a.sync.syncAndWait();
        await b.sync.syncAndWait();
        await b.page.goto('/#/habits');
        const av = a.page.locator('.habit-card input[type="number"]');
        const bv = b.page.locator('.habit-card input[type="number"]');
        // Offline edits to separate date keys must both survive the next sync.
        await a.page.getByLabel('Log date').fill(yesterday);
        await av.fill('5');
        await bv.fill('12');
        await a.sync.syncAndWait();
        await b.sync.syncAndWait();
        await a.sync.syncAndWait();
        await a.page.getByLabel('Log date').fill(today);
        await expect(av).toHaveValue('12');
        await b.page.getByLabel('Log date').fill(yesterday);
        await expect(bv).toHaveValue('5');
        await b.page.getByLabel('Log date').fill(today);
        const losing = winner === 'A' ? b : a;
        const winning = winner === 'A' ? a : b;
        await losing.page.locator('.habit-card input[type="number"]').fill('14');
        // Intentional wall-clock separation: the second writer must be the LWW winner.
        await winning.page.waitForTimeout(1100);
        await winning.page.locator('.habit-card input[type="number"]').fill('18');
        const first = firstUploader === 'A' ? a : b;
        const second = firstUploader === 'A' ? b : a;
        await first.sync.syncAndWait();
        await second.sync.syncAndWait();
        await first.sync.syncAndWait();
        await second.sync.syncAndWait();
        await expect(av).toHaveValue('18');
        await expect(bv).toHaveValue('18');
        for (const client of [a, b]) {
          await client.page.addInitScript(() => {
            const state = window as unknown as Record<string, unknown>;
            state.__SP_E2E_BLOCK_AUTO_SYNC = true;
            state.__SP_E2E_BLOCK_IMMEDIATE_UPLOAD = true;
            state.__SP_E2E_BLOCK_WS_DOWNLOAD = true;
          });
          await client.page.reload({ waitUntil: 'domcontentloaded' });
        }
        await expect(av).toHaveValue('18');
        await expect(bv).toHaveValue('18');
        for (const client of [a, b]) {
          await client.page.getByLabel('Log date').fill(yesterday);
          await expect(
            client.page.locator('.habit-card input[type="number"]'),
          ).toHaveValue('5');
        }
      } finally {
        for (const client of clients) await closeClient(client);
      }
    });
  }
}
