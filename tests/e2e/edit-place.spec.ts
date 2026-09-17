import { expect, test } from '@playwright/test';
import { createDemoWorld } from '../../packages/map-model/src/index';

test('modifier puis supprimer un lieu avec confirmation', async ({ page }) => {
  const world = createDemoWorld();
  const user = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
  let deletions = 0;
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    let body: unknown = { initialized: true, status: 'ok' };
    if (path.endsWith('/auth/refresh')) body = { user, accessToken: 'ui-test' };
    else if (path.endsWith('/worlds')) body = [{ ...world, role: 'owner' }];
    else if (path.includes('/points/') && method === 'PATCH') {
      const input = route.request().postDataJSON();
      expect(input).toEqual({ name: 'Nouvelle capitale', longitude: 30, latitude: -15, revision: 0 });
      world.objects[0]!.name = input.name;
      world.objects[0]!.geometry = { type: 'Point', coordinates: [input.longitude, input.latitude] };
      world.revision++;
      body = { world, role: 'owner' };
    } else if (path.includes('/points/') && method === 'DELETE') {
      expect(route.request().postDataJSON()).toEqual({ revision: 1 });
      deletions++; world.objects = world.objects.filter(object => object.geometry.type !== 'Point'); world.revision++;
      body = { world, role: 'owner' };
    } else if (path.endsWith('/' + world.id)) body = { world, role: 'owner' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Monde de démonstration/ }).click();
  await page.getByRole('link', { name: 'Atlas', exact: true }).click();
  await page.getByRole('button', { name: 'Localiser Origine', exact: true }).click();
  const selected = page.getByRole('region', { name: 'Lieu sélectionné' });
  await selected.getByLabel('Nom du lieu sélectionné').fill('Nouvelle capitale');
  await selected.getByLabel('Longitude du lieu').fill('30');
  await selected.getByLabel('Latitude du lieu').fill('-15');
  await selected.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await expect(selected.getByRole('heading', { name: 'Nouvelle capitale' })).toBeVisible();
  await selected.getByRole('button', { name: 'Supprimer le lieu', exact: true }).click();
  await selected.getByRole('button', { name: 'Annuler', exact: true }).click();
  expect(deletions).toBe(0);
  await selected.getByRole('button', { name: 'Supprimer le lieu', exact: true }).click();
  await selected.getByRole('button', { name: 'Confirmer la suppression' }).click();
  await expect(selected).toHaveCount(0);
  await expect(page.getByText('Lieu supprimé.', { exact: true })).toBeVisible();
  expect(deletions).toBe(1);
});
