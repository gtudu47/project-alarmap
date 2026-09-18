import { expect, test } from '@playwright/test';
import { createDemoWorld } from '../../packages/map-model/src/index';

test('grille 1 × 1 puis 10 × 12 km et subdivision au zoom', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Carte plane', exact: true })).toBeEnabled();
  await page.getByText('Détail et tuiles', { exact: true }).click();
  await page.getByRole('button', { name: 'Voir ce niveau de détail' }).click();
  await expect(page.getByTestId('tile-readout')).toContainText('1 × 1 km');
  await expect(page.getByTestId('tile-readout')).toContainText('détail choisi atteint');
  await page.getByLabel('Largeur de tuile (km)').fill('10');
  await page.getByLabel('Hauteur de tuile (km)').fill('12');
  await page.getByRole('button', { name: 'Appliquer les dimensions' }).click();
  await page.getByRole('button', { name: 'Voir ce niveau de détail' }).click();
  await expect(page.getByTestId('tile-readout')).toContainText('10 × 12 km');
  await page.getByRole('button', { name: 'Recentrer', exact: true }).click();
  await expect(page.getByTestId('tile-readout')).toContainText('zoomez pour subdiviser');
});

test('les détails sont demandés selon le zoom du monde privé', async ({ page }) => {
  const world = createDemoWorld(); const requests: number[] = [];
  const user = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()); let body: unknown = { initialized: true, status: 'ok' };
    if (url.pathname.endsWith('/auth/refresh')) body = { user, accessToken: 'tile-test' };
    else if (url.pathname.endsWith('/worlds')) body = [{ ...world, role: 'owner' }];
    else if (url.pathname.endsWith('/tiles')) {
      expect(route.request().headers()['authorization']).toBe('Bearer tile-test');
      requests.push(Number(url.searchParams.get('detailKm')));
      body = { revision: world.revision, objects: world.objects, total: 2, reduced: false };
    } else if (url.pathname.endsWith('/' + world.id)) body = { world, role: 'owner' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Monde de démonstration/ }).click();
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  const coarse = requests[0]!;
  await page.getByText('Détail et tuiles', { exact: true }).click();
  await page.getByRole('button', { name: 'Voir ce niveau de détail' }).click();
  await expect.poll(() => requests.at(-1)).toBe(1);
  expect(coarse).toBeGreaterThan(1);
  await expect(page.getByText('2 objet(s) chargé(s) dans cette zone', { exact: true })).toBeVisible();
});

test('choisir une échelle et actualiser sa valeur au zoom', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Échelle cartographique', { exact: true }).click();
  await page.getByLabel('Échelle 1:', { exact: true }).fill('25000');
  await page.getByRole('button', { name: 'Appliquer l’échelle' }).click();
  await expect(page.getByTestId('scale-readout')).toContainText(/1:25\s000/);
  await expect(page.getByTestId('scale-readout')).toContainText('0,25 km');
  await page.getByRole('button', { name: 'Recentrer', exact: true }).click();
  await expect(page.getByTestId('scale-readout')).not.toContainText(/1:25\s000/);
});
