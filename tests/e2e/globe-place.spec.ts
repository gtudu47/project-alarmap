import { expect, test, type Page } from '@playwright/test';
import { createDemoWorld } from '../../packages/map-model/src/index';

type Role = 'owner' | 'editor' | 'viewer';

async function openPrivateWorld(page: Page, role: Role) {
  const world = createDemoWorld();
  const centreLatitude = Math.atan2(0.6, 3.3) * 180 / Math.PI;
  world.objects = [{ ...world.objects[0]!, name: 'Repère central', geometry: { type: 'Point', coordinates: [0, centreLatitude] } }];
  const user = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
  let writes = 0;
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let body: unknown = { initialized: true, status: 'ok' };
    if (path === '/api/v1/auth/refresh') body = { user, accessToken: 'test' };
    else if (path === '/api/v1/worlds') body = [{ ...world, role }];
    else if (path === '/api/v1/worlds/' + world.id) body = { world, role, objectsComplete: true, objectCount: world.objects.length };
    else if (path === '/api/v1/worlds/' + world.id + '/tiles') body = { revision: world.revision, objects: world.objects, total: world.objects.length, reduced: false };
    else if (path === '/api/v1/links/private/worlds/' + world.id) body = { ownerKey: 'a'.repeat(50), worldKey: 'b'.repeat(50) };
    else if (path.startsWith('/api/v1/links/private/worlds/' + world.id + '/objects/')) body = { ownerKey: 'a'.repeat(50), worldKey: 'b'.repeat(50), objectKey: 'c'.repeat(50) };
    else if (path === '/api/v1/worlds/' + world.id + '/points' && route.request().method() === 'POST') {
      expect(role).not.toBe('viewer');
      expect(url.searchParams.get('compact')).toBe('1');
      const input = route.request().postDataJSON();
      expect(input.revision).toBe(world.revision);
      expect(input.name).toBe('Ville du globe');
      expect(input.longitude).toBeCloseTo(0, 4);
      expect(input.latitude).toBeCloseTo(centreLatitude, 4);
      const created = { ...world.objects[0]!, id: '00000000-0000-4000-8000-000000000099', name: input.name, geometry: { type: 'Point' as const, coordinates: [input.longitude, input.latitude] as [number, number] } };
      world.objects.push(created);
      world.revision++;
      writes++;
      body = { world: { ...world, objects: [created] }, role, objectsComplete: false, objectCount: world.objects.length };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Monde de démonstration/ }).click();
  await page.getByRole('button', { name: 'Globe 3D', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Globe 3D', exact: true })).toHaveAttribute('aria-pressed', 'true', { timeout: 30000 });
  return { centreLatitude, writes: () => writes };
}

for (const role of ['owner', 'editor'] as const) {
  test('placer un lieu sur le globe par clic — ' + role, async ({ page }) => {
    test.setTimeout(90000);
    const { centreLatitude, writes } = await openPrivateWorld(page, role);
    const canvas = page.getByTestId('map-host').locator('canvas');
    const bounds = (await canvas.boundingBox())!;
    const centre = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    const placement = page.getByRole('button', { name: 'Placer sur la carte', exact: true });
    await placement.click();
    await page.keyboard.press('Escape');
    await expect(placement).toBeVisible();

    // Après annulation, un clic continue à sélectionner le repère visible.
    await page.mouse.click(centre.x, centre.y);
    await expect(page.getByRole('region', { name: 'Lieu sélectionné' })).toContainText('Repère central');
    await page.getByRole('button', { name: 'Fermer la fiche' }).click();

    await placement.click();
    await page.mouse.click(bounds.x + 2, bounds.y + 2);
    await expect(page.getByRole('button', { name: 'Annuler le placement', exact: true })).toBeVisible();
    expect(writes()).toBe(0);

    // Tourner le globe ne doit pas choisir une position.
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.mouse.move(centre.x + 40, centre.y, { steps: 4 });
    await page.mouse.up();
    await expect(page.getByRole('button', { name: 'Annuler le placement', exact: true })).toBeVisible();
    expect(writes()).toBe(0);
    await page.getByRole('button', { name: 'Recentrer', exact: true }).click();
    await page.mouse.click(centre.x, centre.y);
    await expect(page.getByText('Position choisie. Renseignez le nom et enregistrez le lieu.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Lieu sélectionné' })).toHaveCount(0);
    expect(Number(await page.getByLabel('Longitude', { exact: true }).inputValue())).toBeCloseTo(0, 4);
    expect(Number(await page.getByLabel('Latitude', { exact: true }).inputValue())).toBeCloseTo(centreLatitude, 4);
    expect(writes()).toBe(0);
    await page.getByLabel('Nom du lieu', { exact: true }).fill('Ville du globe');
    await page.getByRole('button', { name: 'Enregistrer le lieu', exact: true }).click();
    await expect(page.getByText('Lieu enregistré.', { exact: true })).toBeVisible();
    expect(writes()).toBe(1);
  });
}

test('un lecteur ne peut pas placer un lieu sur le globe', async ({ page }) => {
  test.setTimeout(90000);
  const { writes } = await openPrivateWorld(page, 'viewer');
  await expect(page.getByRole('button', { name: 'Placer sur la carte', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enregistrer le lieu', exact: true })).toHaveCount(0);
  expect(writes()).toBe(0);
});
