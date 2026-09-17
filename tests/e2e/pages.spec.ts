import { expect, test } from '@playwright/test';

test('navigation, recherche atlas et retour à la carte', async ({ page }) => {
  await page.goto('/?page=accueil');
  await expect(page.getByRole('heading', { name: 'Un monde à imaginer. Un atlas à construire.' })).toBeVisible();
  await page.getByRole('link', { name: 'Atlas', exact: true }).click();
  await page.getByRole('searchbox').fill('antimeridien');
  await expect(page.getByRole('heading', { name: 'Passage de l’antiméridien' })).toBeVisible();
  await page.getByRole('combobox').selectOption('Point');
  await expect(page.getByText('Aucun objet ne correspond à votre recherche.')).toBeVisible();
  await page.getByRole('link', { name: 'Guide', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vos premiers pas dans AlarMap' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('link', { name: 'Atlas', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', { name: 'Carte', exact: true }).click();
  await expect(page.getByTestId('map-host').locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Globe 3D', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Globe 3D', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('accueil sur mobile sans débordement', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?page=accueil');
  await expect(page.getByRole('button', { name: 'Accéder à mon espace' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Guide', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vos premiers pas dans AlarMap' })).toBeVisible();
});

test('localiser un lieu depuis l’Atlas ouvre sa fiche et la carte', async ({ page }) => {
  await page.goto('/?page=atlas');
  await page.getByRole('button', { name: 'Localiser Origine', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Lieu sélectionné' })).toContainText('Origine');
  await expect(page.getByTestId('map-host').locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Globe 3D', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Globe 3D', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Fermer la fiche' }).click();
  await expect(page.getByRole('region', { name: 'Lieu sélectionné' })).toHaveCount(0);
});
