import { expect, test } from '@playwright/test';
import { createDemoWorld } from '../../packages/map-model/src/index';
test('dessiner une rivière, retirer un sommet, sauvegarder et annuler/rétablir', async ({ page }) => {
  const world = createDemoWorld();
  const user = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname; const method = route.request().method();
    let body: unknown = { initialized: true, status: 'ok' };
    if (path.endsWith('/auth/refresh')) body = { user, accessToken: 'test' };
    else if (path.endsWith('/worlds')) body = [{ ...world, role: 'owner' }];
    else if (path.endsWith('/tiles')) body = { revision: world.revision, objects: world.objects, total: world.objects.length, reduced: false };
    else if (path.includes('/lines/')) {
      const input = route.request().postDataJSON(); expect(input.revision).toBe(world.revision);
      if (method === 'PUT') { expect(input.point.geometry.type).toBe('LineString'); expect(input.point.geometry.coordinates).toHaveLength(2); world.objects.push(input.point); }
      else world.objects = world.objects.filter(o => o.id !== path.split('/').at(-1));
      world.revision++; body = { world, role: 'owner' };
    } else if (path.endsWith('/' + world.id)) body = { world, role: 'owner' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Monde de démonstration/ }).click();
  await page.getByText('Routes et rivières', { exact: true }).click();
  await page.getByLabel('Nom du tracé').fill('Rivière claire'); await page.getByLabel('Type de tracé').selectOption('river');
  await page.getByRole('button', { name: 'Commencer le tracé' }).click();
  const box = (await page.getByTestId('map-host').locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
  await expect(page.getByRole('button', { name: 'Enregistrer le tracé' })).toBeDisabled();
  await page.mouse.click(box.x + box.width/2 + 40, box.y + box.height/2 + 20);
  await page.mouse.click(box.x + box.width/2 + 80, box.y + box.height/2 + 10);
  await page.getByRole('button', { name: 'Retirer le dernier sommet' }).click();
  await page.getByRole('button', { name: 'Enregistrer le tracé' }).click();
  await expect(page.getByText('Tracé enregistré.', { exact: true })).toBeVisible();
  expect(world.objects.some(o => o.kind === 'river')).toBe(true);
  await page.getByRole('button', { name: 'Annuler l’action', exact: true }).click();
  await expect(page.getByText('Action annulée.', { exact: true })).toBeVisible();
  expect(world.objects.some(o => o.kind === 'river')).toBe(false);
  await page.getByRole('button', { name: 'Rétablir l’action', exact: true }).click();
  await expect(page.getByText('Action rétablie.', { exact: true })).toBeVisible();
  expect(world.objects.some(o => o.kind === 'river')).toBe(true);
  await page.getByRole('button', { name: 'Recharger le monde', exact: true }).click();
  await page.getByRole('link', { name: 'Atlas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Rivière claire', exact: true })).toBeVisible();
});
