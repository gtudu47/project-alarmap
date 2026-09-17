import { expect, test } from '@playwright/test';
import { createDemoWorld } from '../../packages/map-model/src/index';

test('créer, renommer et verrouiller un calque', async ({ page }) => {
  const world = createDemoWorld();
  const user = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
  const layerId = '00000000-0000-4000-8000-000000000099';
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname; const method = route.request().method();
    let body: unknown = { initialized: true, status: 'ok' };
    if (path.endsWith('/auth/refresh')) body = { user, accessToken: 'ui-test' };
    else if (path.endsWith('/worlds')) body = [{ ...world, role: 'owner' }];
    else if (path.endsWith('/layers') && method === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ name: 'Relief', revision: 0 });
      world.layers.push({ id: layerId, name: 'Relief', visible: true, locked: false, opacity: 1, order: 1 }); world.revision++;
      body = { world, role: 'owner' };
    } else if (path.endsWith('/layers/' + layerId) && method === 'PATCH') {
      const input = route.request().postDataJSON();
      expect(input).toEqual({ name: 'Montagnes', opacity: 0.4, locked: true, revision: 1 });
      Object.assign(world.layers[1]!, { name: input.name, opacity: input.opacity, locked: input.locked }); world.revision++;
      body = { world, role: 'owner' };
    } else if (path.endsWith('/' + world.id)) body = { world, role: 'owner' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Monde de démonstration/ }).click();
  await page.getByLabel('Nouveau calque').fill('Relief');
  await page.getByRole('button', { name: 'Créer le calque' }).click();
  await expect(page.getByRole('checkbox', { name: 'Relief', exact: true })).toBeVisible();
  await page.getByText('Réglages de Relief', { exact: true }).click();
  const settings = page.locator('details').filter({ hasText: 'Réglages de Relief' });
  await settings.getByLabel('Nom du calque').fill('Montagnes');
  await settings.getByLabel('Opacité (%)').fill('40');
  await settings.getByLabel('Verrouiller les objets').check();
  await settings.getByRole('button', { name: 'Enregistrer le calque' }).click();
  await expect(page.getByText('Réglages de Montagnes', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Calque du lieu').locator('option')).toHaveCount(1);
  expect(world.layers[1]?.locked).toBe(true);
});
