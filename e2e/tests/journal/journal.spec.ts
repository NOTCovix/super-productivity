import { expect, test } from '../../fixtures/test.fixture';
import { ImportPage } from '../../pages/import.page';

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test.describe(`Journal at ${viewport.width}px`, () => {
    test.use({ viewport });
    test('has a separate page and shares an entry with the bottom of Today', async ({
      page,
      workViewPage,
    }) => {
      if (viewport.width === 390) {
        await page.goto('/#/config');
        await page
          .locator('theme-selector mat-button-toggle[value="dark"] button')
          .click();
      }
      await page.goto('/#/journal');
      await expect(page.locator('work-view')).toHaveCount(0);
      await expect(page.locator('page-title')).toContainText('Journal');
      const editor = page.locator('flux-journal-page textarea');
      await editor.fill('A quiet moment with friends.\nGrateful today. 🌤');
      // Route destruction happens before the debounce and must flush the old editor.
      await page.goto('/#/tag/TODAY/tasks');
      await expect(page.locator('flux-journal-page')).toHaveCount(0);
      const today = page.locator('flux-journal-today textarea');
      await expect(today).toHaveValue('A quiet moment with friends.\nGrateful today. 🌤');
      if (viewport.width < 600) {
        await page.locator('mobile-bottom-nav .add-task-button').click();
        await page
          .locator('add-task-bar.global .main-input')
          .fill('A task before the journal');
        await page.locator('.e2e-add-task-submit').click();
        await page.keyboard.press('Escape');
        await expect(page.locator('add-task-bar.global')).toBeHidden();
      } else {
        await workViewPage.addTask('A task before the journal');
      }
      const afterTasks = await page.locator('work-view').evaluate((view) => {
        const task = view.querySelector('task');
        const journal = view.querySelector('flux-journal-today');
        return (
          !!task &&
          !!journal &&
          !!(task.compareDocumentPosition(journal) & Node.DOCUMENT_POSITION_FOLLOWING)
        );
      });
      expect(afterTasks).toBe(true);
      await today.fill('An evening reflection.');
      await page
        .getByRole('link', { name: 'Open journal and history', exact: true })
        .click();
      await expect(editor).toHaveValue('An evening reflection.');
      await editor.blur();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(editor).toHaveValue('An evening reflection.');
      const overflow = await page
        .locator('flux-journal-page')
        .evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(overflow).toBe(false);
      await page.screenshot({
        path: `.tmp/flux-validation/journal-${viewport.width}.png`,
        fullPage: true,
      });
    });

    test('backfills a previous date and clears only the selected entry', async ({
      page,
    }) => {
      await page.goto('/#/journal');
      const date = page.getByLabel('Entry date', { exact: true });
      const editor = page.locator('flux-journal-page textarea');
      const today = await date.inputValue();
      const d = new Date(`${today}T12:00:00`);
      d.setDate(d.getDate() - 1);
      const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      await editor.fill('Today stays here');
      await date.fill(yesterday);
      await editor.fill('Yesterday was meaningful');
      await date.fill(today);
      await expect(editor).toHaveValue('Today stays here');
      await date.fill(yesterday);
      await expect(editor).toHaveValue('Yesterday was meaningful');
      await page.getByRole('button', { name: 'Clear entry', exact: true }).click();
      await page.locator('dialog-confirm button[e2e="confirmBtn"]').click();
      await expect(editor).toHaveValue('');
      await expect(page.locator('.entry-history button')).toHaveCount(1);
      await date.fill(today);
      await expect(editor).toHaveValue('Today stays here');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await date.fill(yesterday);
      await expect(editor).toHaveValue('');
    });
  });
}

test('journal entries survive real backup export/import and remain shared with daily review', async ({
  page,
}) => {
  await page.goto('/#/journal');
  const editor = page.locator('flux-journal-page textarea');
  await editor.fill('A reflection worth keeping');
  await editor.blur();
  const imex = new ImportPage(page);
  await imex.navigateToImportPage();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('file-imex button:has(mat-icon:has-text("file_upload"))').click();
  const path = await (await downloadPromise).path();
  if (!path) throw new Error('Backup was not downloaded');
  await page.goto('/#/journal');
  await editor.fill('');
  await editor.blur();
  await expect(page.locator('.entry-history button')).toHaveCount(0);
  await imex.navigateToImportPage();
  await imex.importBackupFile(path);
  await page.goto('/#/journal');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(editor).toHaveValue('A reflection worth keeping');
  await page.goto('/#/tag/TODAY/daily-summary');
  await page.getByRole('tab', { name: /2\./ }).click();
  await expect(page.locator('reflection-note textarea')).toHaveValue(
    'A reflection worth keeping',
  );
});
