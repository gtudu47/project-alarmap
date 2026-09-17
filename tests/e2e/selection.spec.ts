import { expect, test } from '@playwright/test';

test('sélection par clic, déplacement et calque masqué', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByTestId('map-host').locator('canvas');
  await expect(canvas).toBeVisible();
  await expect(page.getByRole('button', { name: 'Carte plane', exact: true })).toBeEnabled();
  const bounds = (await canvas.boundingBox())!;
  const x = bounds.x + bounds.width / 2; const y = bounds.y + bounds.height / 2;
  await page.mouse.click(x, y);
  const selected = page.getByRole('region', { name: 'Lieu sélectionné' });
  await expect(selected).toContainText('Origine');
  await page.getByRole('button', { name: 'Fermer la fiche' }).click();
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 50, y + 20, { steps: 5 }); await page.mouse.up();
  await expect(selected).toHaveCount(0);
  await page.getByRole('button', { name: 'Recentrer' }).click();
  await page.getByRole('checkbox').uncheck();
  await page.mouse.click(x, y);
  await expect(selected).toHaveCount(0);
});

test('sélection directe sur le globe', async ({ page }) => {
  await page.goto('/?page=atlas');
  await page.getByRole('button', { name: 'Localiser Origine', exact: true }).click();
  await page.getByRole('button', { name: 'Globe 3D', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Globe 3D', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Fermer la fiche' }).click();
  const bounds = (await page.getByTestId('map-host').locator('canvas').boundingBox())!;
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await expect(page.getByRole('region', { name: 'Lieu sélectionné' })).toContainText('Origine');
});
