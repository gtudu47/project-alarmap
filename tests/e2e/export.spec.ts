import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

for (const view of ['Carte plane', 'Globe 3D']) {
  test(`export PNG de la vue : ${view}`, async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: view, exact: true })).toBeEnabled();
    await page.getByRole('button', { name: view, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Exporter PNG' })).toBeEnabled();
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter PNG' }).click();
    const download = await downloaded;
    const bytes = await readFile((await download.path())!);
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(bytes.readUInt32BE(16)).toBeGreaterThan(100);
    expect(bytes.readUInt32BE(20)).toBeGreaterThan(100);
    expect(bytes.length).toBeGreaterThan(2000);
    await expect(page.getByText('Image PNG prête à télécharger.')).toBeVisible();
  });
}
