import { expect, test } from '@playwright/test';
import { createDemoWorld } from '../../packages/map-model/src/index';

test('la fiche d’un territoire chargé progressivement apparaît après un clic en 2D et en 3D', async ({ page }) => {
  test.setTimeout(90000);
  const world = createDemoWorld();
  world.objects = [{ id: '00000000-0000-4000-8000-000000000098', layerId: world.layers[0]!.id, name: 'Territoire choisi', kind: 'territory',
    geometry: { type: 'Polygon', coordinates: [[[-30,-30],[30,-30],[30,35],[-30,35],[-30,-30]]] },
    style: { color: '#b14b31', opacity: 1 }, properties: {} }];
  const user = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()); const path = url.pathname; let body: unknown = { initialized: true, status: 'ok' };
    if (path.endsWith('/auth/refresh')) body = { user, accessToken: 'test' };
    else if (path.endsWith('/worlds')) body = [{ ...world, role: 'owner' }];
    else if (path.endsWith('/tiles')) body = { revision: world.revision, objects: world.objects, total: 1, reduced: false };
    else if (path.endsWith('/' + world.id)) body = { world: { ...world, objects: [] }, role: 'owner', objectsComplete: false, objectCount: 1 };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Monde de démonstration/ }).click();
  await expect(page.getByText('1 objet(s) chargé(s) dans cette zone', { exact: true })).toBeVisible();
  const canvas = page.getByTestId('map-host').locator('canvas');
  const clickCentre = async () => { const box = (await canvas.boundingBox())!; await page.mouse.click(box.x + box.width / 2,box.y + box.height / 2); };
  const card = page.getByRole('region', { name: 'Territoire sélectionné' });
  await clickCentre(); await expect(card).toContainText('Territoire choisi');
  await expect(card).toBeInViewport({ ratio: 0.1 });
  await expect(card.getByRole('button', { name: 'Modifier le territoire' })).toBeVisible();
  await card.getByRole('button', { name: 'Fermer la fiche' }).click();
  await page.getByRole('button', { name: 'Globe 3D', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Globe 3D', exact: true })).toHaveAttribute('aria-pressed', 'true', { timeout: 30000 });
  await expect(page.getByText('1 objet(s) chargé(s) dans cette zone', { exact: true })).toBeVisible();
  await page.locator('.sidebar').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await clickCentre(); await expect(card).toContainText('Territoire choisi');
  await expect(card).toBeInViewport({ ratio: 0.1 });
});
