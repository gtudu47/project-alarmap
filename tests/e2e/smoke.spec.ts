import { expect, test } from '@playwright/test';

for (const route of ['/', '/viewer/', '/embed/demonstration']) {
  test(`scène partagée et changement de rendu : ${route}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(route);
    await expect(page.getByRole('heading', { name: 'Monde de démonstration' })).toBeVisible();
    await expect(page.getByTestId('map-host').locator('canvas')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Globe 3D' })).toBeEnabled();
    await page.getByRole('button', { name: 'Globe 3D' }).click();
    await expect(page.getByRole('button', { name: 'Globe 3D' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('map-host').locator('canvas')).toHaveCount(1);
    await page.getByRole('checkbox').uncheck();
    await page.getByRole('button', { name: 'Carte plane' }).click();
    await expect(page.getByRole('button', { name: 'Carte plane' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('checkbox')).not.toBeChecked();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
