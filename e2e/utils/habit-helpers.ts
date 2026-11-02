import { expect, Page } from '@playwright/test';

/** Open the native history/management disclosure before using its detailed logger. */
export const openHabitDetails = async (page: Page): Promise<void> => {
  await expect(page.locator('flux-habit-manager')).toBeVisible();
  const details = page.locator('flux-habit-manager .habit-details');
  for (const item of await details.all()) {
    if ((await item.getAttribute('open')) === null) {
      await item.locator(':scope > summary').click();
    }
  }
};
