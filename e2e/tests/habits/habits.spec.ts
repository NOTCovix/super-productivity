import { test, expect } from '../../fixtures/test.fixture';
import { Page } from '@playwright/test';
import { ImportPage } from '../../pages/import.page';

const openHabits = async (page: Page): Promise<void> => {
  await page.goto('/#/config');
  const toggle = page.getByRole('switch', { name: /Habits/ });
  await toggle.waitFor();
  if (!(await toggle.isChecked())) await toggle.check();
  await page.goto('/#/habits');
  await expect(page.locator('flux-habit-manager')).toBeVisible();
};

const createHabit = async (page: Page, name: string, type = 'boolean'): Promise<void> => {
  await page.getByRole('button', { name: 'Create habit', exact: true }).click();
  await page.locator('input[name="name"]').fill(name);
  await page.locator('select[name="type"]').selectOption(type);
  if (type !== 'boolean') {
    await page.locator('input[name="target"]').fill('2');
    await page.locator('input[name="unit"]').fill('cups');
  }
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.habit-card').filter({ hasText: name })).toBeVisible();
};

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test.describe(`Flux habits at ${viewport.width}px`, () => {
    test.use({ viewport });
    test('Boolean logging persists after restart; management and Today remain usable', async ({
      page,
      workViewPage,
      taskPage,
    }) => {
      await openHabits(page);
      await createHabit(page, 'Read a book');
      const card = page.locator('.habit-card').filter({ hasText: 'Read a book' });
      await card.getByRole('button', { name: 'Read a book', exact: true }).click();
      await expect(card.locator('.habit-status')).toHaveText('Completed');
      await page.reload();
      await expect(card.locator('.habit-status')).toHaveText('Completed');
      await card.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.locator('input[name="name"]').fill('Read every day');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      const renamed = page.locator('.habit-card').filter({ hasText: 'Read every day' });
      await renamed.getByRole('button', { name: 'Archive', exact: true }).click();
      await expect(
        renamed.getByRole('button', { name: 'Restore', exact: true }),
      ).toBeVisible();
      await renamed.getByRole('button', { name: 'Restore', exact: true }).click();
      await page.goto('/#/tag/TODAY/tasks');
      await page.locator('flux-habit-today summary').click();
      await expect(page.locator('flux-habit-today .habit-status')).toHaveText(
        'Completed',
      );
      if (viewport.width < 600) {
        await page.locator('mobile-bottom-nav .add-task-button').click();
        await page
          .locator('add-task-bar.global .main-input')
          .fill('Task still works alongside habits');
        await page.locator('.e2e-add-task-submit').click();
        await page.keyboard.press('Escape');
        await expect(page.locator('add-task-bar.global')).toBeHidden();
      } else {
        await workViewPage.addTask('Task still works alongside habits');
      }
      await expect(
        taskPage.getTaskByText('Task still works alongside habits'),
      ).toBeVisible();
      await page.goto('/#/habits');
      await page
        .locator('.habit-card')
        .getByRole('button', { name: 'Delete', exact: true })
        .click();
      await page.locator('dialog-confirm button[e2e="confirmBtn"]').click();
      await expect(page.locator('.habit-card')).toHaveCount(0);
      await expect(page.locator('habit-tracker')).toBeVisible();
      const overflow = await page
        .locator('flux-habit-manager')
        .evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(overflow).toBe(false);
    });

    test('limit zero is explicit success; skip and clearing remain distinct', async ({
      page,
    }) => {
      await openHabits(page);
      await createHabit(page, 'Limit caffeine', 'limit');
      const card = page.locator('.habit-card').filter({ hasText: 'Limit caffeine' });
      await expect(card.locator('.habit-status')).toHaveText('Unrecorded');
      await card.locator('input[type="number"]').fill('0');
      await expect(card.locator('.habit-status')).toHaveText('Completed');
      await card.locator('input[type="number"]').fill('3');
      await expect(card.locator('.habit-status')).toHaveText('Incomplete');
      await card.getByRole('button', { name: 'Entry actions' }).click();
      await page.getByRole('menuitem', { name: 'Skipped', exact: true }).click();
      await expect(card.locator('.habit-status')).toHaveText('Skipped');
      await card.getByRole('button', { name: 'Entry actions' }).click();
      await page.getByRole('menuitem', { name: 'Clear record', exact: true }).click();
      await expect(card.locator('.habit-status')).toHaveText('Unrecorded');
      await expect(card.locator('input[type="number"]')).toHaveValue('');
      await card.locator('summary').click();
      await expect(card.getByText(/Current streak: 0/)).toBeVisible();
      await expect(card.locator('.calendar')).toBeVisible();
      const overflow = await card.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(overflow).toBe(false);
    });
  });
}

test('habit data survives the real backup export/import and reload', async ({ page }) => {
  await openHabits(page);
  await createHabit(page, 'Backup habit');
  await page.getByRole('button', { name: 'Backup habit', exact: true }).click();
  const importPage = new ImportPage(page);
  await importPage.navigateToImportPage();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('file-imex button:has(mat-icon:has-text("file_upload"))').click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error('Backup download was not saved');
  await page.goto('/#/habits');
  await page
    .locator('.habit-card')
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await page.locator('dialog-confirm button[e2e="confirmBtn"]').click();
  await expect(page.locator('.habit-card')).toHaveCount(0);
  await importPage.navigateToImportPage();
  await importPage.importBackupFile(path);
  await page.goto('/#/habits');
  await page.reload();
  await expect(page.locator('.habit-card .habit-status')).toHaveText('Completed');
});

test('historical numeric records keep their target after a later definition edit', async ({
  page,
}) => {
  await openHabits(page);
  await page.getByRole('button', { name: 'Create habit', exact: true }).click();
  await page.locator('input[name="name"]').fill('Read pages');
  await page.locator('select[name="type"]').selectOption('increase');
  await page.locator('input[name="target"]').fill('20');
  await page.locator('input[name="unit"]').fill('pages');
  const today = await page.locator('input[name="start"]').inputValue();
  const date = new Date(`${today}T12:00:00`);
  date.setDate(date.getDate() - 1);
  const yesterday = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  await page.locator('input[name="start"]').fill(yesterday);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByLabel('Log date').fill(yesterday);
  const card = page.locator('.habit-card');
  await card.locator('input[type="number"]').fill('19');
  await expect(card.locator('.habit-status')).toHaveText('Incomplete');
  await card.locator('input[type="number"]').fill('20');
  await expect(card.locator('.habit-status')).toHaveText('Completed');
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('input[name="target"]').fill('30');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(card.locator('.habit-status')).toHaveText('Completed');
  await expect(card.locator('.habit-name small')).toContainText('20');
  await page.getByLabel('Log date').fill(today);
  await card.locator('input[type="number"]').fill('20');
  await expect(card.locator('.habit-status')).toHaveText('Incomplete');
  await expect(card.locator('.habit-name small')).toContainText('30');
  await page.reload();
  await page.getByLabel('Log date').fill(yesterday);
  await expect(card.locator('input[type="number"]')).toHaveValue('20');
  await expect(card.locator('.habit-status')).toHaveText('Completed');
});
