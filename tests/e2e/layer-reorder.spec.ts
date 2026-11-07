import { expect, test } from '@playwright/test';
import { createDemoWorld } from '../../packages/map-model/src/index';

for (const role of ['owner', 'viewer'] as const) test('ordre des calques et permissions : ' + role, async ({ page }) => {
  const world = createDemoWorld();
  world.layers.push({ id: '00000000-0000-4000-8000-000000000099', name: 'Relief', visible: true, locked: false, opacity: 1, order: 1 });
  const user = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
  let writes = 0;
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()); const path = url.pathname;
    let body: unknown = { initialized: true, status: 'ok' };
    if (path.endsWith('/auth/refresh')) body = { user, accessToken: 'test' };
    else if (path === '/api/v1/worlds') body = [{ ...world, role }];
    else if (path === '/api/v1/worlds/' + world.id + '/layers/order' && route.request().method() === 'PUT') {
      const input = route.request().postDataJSON() as { revision: number; layerIds: string[] };
      expect(input.revision).toBe(world.revision);
      expect(input.layerIds).toEqual([...world.layers.map(layer => layer.id)].reverse());
      world.layers = input.layerIds.map((id, order) => ({ ...world.layers.find(layer => layer.id === id)!, order }));
      world.revision++; writes++; body = { world, role, objectsComplete: true, objectCount: world.objects.length };
    } else if (path === '/api/v1/worlds/' + world.id + '/tiles') {
      body = { revision: world.revision, objects: world.objects, total: world.objects.length, reduced: false };
    } else if (path === '/api/v1/worlds/' + world.id) body = { world, role, objectsComplete: true, objectCount: world.objects.length };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Monde de démonstration/ }).click();
  const names = page.locator('.layer-row');
  await expect(names).toHaveCount(2);
  if (role === 'viewer') {
    await expect(page.getByRole('button', { name: 'Monter Relief' })).toHaveCount(0);
    expect(writes).toBe(0); return;
  }
  await expect(page.getByRole('button', { name: 'Monter Relief' })).toBeEnabled();
  await page.getByRole('button', { name: 'Monter Relief' }).click();
  await expect(names.first()).toContainText('Relief');
  await expect(page.getByRole('button', { name: 'Monter Relief' })).toBeDisabled();
  expect(writes).toBe(1);
  await page.getByRole('button', { name: 'Descendre Relief' }).click();
  await expect(names.last()).toContainText('Relief');
  expect(writes).toBe(2);
});