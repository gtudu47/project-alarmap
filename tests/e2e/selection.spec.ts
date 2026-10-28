import { expect, test } from '@playwright/test';
import { createDemoWorld } from '../../packages/map-model/src/index';

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
  test.setTimeout(60000);
  await page.goto('/?page=atlas');
  await page.getByRole('button', { name: 'Localiser Origine', exact: true }).click();
  await page.getByRole('button', { name: 'Globe 3D', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Globe 3D', exact: true })).toHaveAttribute('aria-pressed', 'true', { timeout: 30000 });
  await page.getByRole('button', { name: 'Fermer la fiche' }).click();
  const bounds = (await page.getByTestId('map-host').locator('canvas').boundingBox())!;
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await expect(page.getByRole('region', { name: 'Lieu sélectionné' })).toContainText('Origine');
});

test('sélectionner un tracé aux deux côtés de l’antiméridien', async ({ page }) => {
  await page.goto('/?page=carte');
  await expect(page.getByRole('button', { name: 'Carte plane', exact: true })).toBeEnabled();
  const canvas = page.getByTestId('map-host').locator('canvas');
  const bounds = (await canvas.boundingBox())!;
  const scale = Math.min(bounds.width / 400, bounds.height / 220);
  const click = async (lon: number, lat: number) => page.mouse.click(bounds.x + bounds.width / 2 + lon * scale, bounds.y + bounds.height / 2 - lat * scale);
  for (const [lon, lat] of [[175, 22.5], [-175, 27.5]]) {
    await click(lon!, lat!);
    await expect(page.getByRole('region', { name: 'Tracé sélectionné' })).toContainText('Passage de l’antiméridien');
    await page.getByRole('button', { name: 'Fermer la fiche' }).click();
  }
  await click(0, 25);
  await expect(page.getByRole('region', { name: 'Tracé sélectionné' })).toHaveCount(0);
  await page.getByRole('checkbox').uncheck();
  await click(175, 22.5);
  await expect(page.getByRole('region', { name: 'Tracé sélectionné' })).toHaveCount(0);
});

test('localiser un tracé depuis l’Atlas', async ({ page }) => {
  await page.goto('/?page=atlas');
  await page.getByRole('button', { name: 'Localiser Passage de l’antiméridien' }).click();
  await expect(page.getByRole('region', { name: 'Tracé sélectionné' })).toContainText('Passage de l’antiméridien');
  await expect(page.getByTestId('map-host').locator('canvas')).toBeVisible();
});

test('sélectionner un tracé visible sur le globe sans sélectionner sa face cachée', async ({ page }) => {
  test.setTimeout(60000);
  const world = createDemoWorld();
  const hiddenLayer = '00000000-0000-4000-8000-000000000099';
  world.layers.push({ id: hiddenLayer, name: 'Face opposée', visible: true, locked: false, opacity: 1, order: 1 });
  world.objects.push({ id: '00000000-0000-4000-8000-000000000098', layerId: hiddenLayer, name: 'Route cachée', kind: 'road', geometry: { type: 'LineString', coordinates: [[-10,-20],[-5,-22]] }, style: { color: '#ff0000', opacity: 1 }, properties: {} });
  const user = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = { initialized: true, status: 'ok' };
    if (path.endsWith('/auth/refresh')) body = { user, accessToken: 'test' };
    else if (path.endsWith('/worlds')) body = [{ ...world, role: 'owner' }];
    else if (path.endsWith('/tiles')) body = { revision: world.revision, objects: world.objects, total: world.objects.length, reduced: false };
    else if (path.endsWith('/' + world.id)) body = { world, role: 'owner', objectsComplete: true };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Monde de démonstration/ }).click();
  await page.getByRole('link', { name: 'Atlas', exact: true }).click();
  await page.getByRole('button', { name: 'Localiser Passage de l’antiméridien' }).click();
  await page.getByRole('button', { name: 'Globe 3D', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Globe 3D', exact: true })).toHaveAttribute('aria-pressed', 'true', { timeout: 30000 });
  await page.getByRole('button', { name: 'Fermer la fiche' }).click();
  const bounds = (await page.getByTestId('map-host').locator('canvas').boundingBox())!;
  const x = bounds.x + bounds.width / 2; const y = bounds.y + bounds.height / 2;
  await page.mouse.click(x + 3, y);
  await expect(page.getByRole('region', { name: 'Tracé sélectionné' })).toContainText('Passage de l’antiméridien');
  await page.getByRole('button', { name: 'Fermer la fiche' }).click();
  const zoom = page.getByRole('slider', { name: 'Niveau de zoom' });
  await zoom.focus();
  for (let i = 0; i < 20; i++) await page.keyboard.press('ArrowUp');
  await page.mouse.click(x + 3, y);
  await expect(page.getByRole('region', { name: 'Tracé sélectionné' })).toContainText('Passage de l’antiméridien');
  await page.getByRole('button', { name: 'Fermer la fiche' }).click();
  await page.getByRole('checkbox', { name: 'Repères géographiques', exact: true }).uncheck();
  await page.mouse.click(x, y);
  await expect(page.getByRole('region', { name: 'Tracé sélectionné' })).toHaveCount(0);
});
