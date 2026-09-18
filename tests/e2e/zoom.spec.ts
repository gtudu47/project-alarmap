import { expect, test } from '@playwright/test';
for (const view of ['Carte plane', 'Globe 3D']) {
  test('curseur vertical synchronisé : ' + view, async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: view, exact: true })).toBeEnabled();
    await page.getByRole('button', { name: view, exact: true }).click();
    await expect(page.getByRole('button', { name: view, exact: true })).toHaveAttribute('aria-pressed', 'true', { timeout: 15000 });
    await page.getByRole('button', { name: 'Recentrer', exact: true }).click();
    const slider = page.getByRole('slider', { name: 'Niveau de zoom' });
    await expect(slider).toBeEnabled();
    await expect(slider).toHaveAttribute('aria-orientation', 'vertical');
    const before = Number(await slider.inputValue());
    await slider.focus(); await slider.press('ArrowUp');
    await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(before);
    const after = Number(await slider.inputValue());
    await page.getByTestId('map-host').hover(); await page.mouse.wheel(0, -200);
    await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(after);
    const bounds = await slider.boundingBox(); expect(bounds!.height).toBeGreaterThan(bounds!.width);
    await page.getByRole('button', { name: 'Recentrer', exact: true }).click();
    await expect.poll(async () => Number(await slider.inputValue())).toBeCloseTo(before, 0);
  });
}
