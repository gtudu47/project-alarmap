import { expect, test } from '@playwright/test';
import { createDemoWorld } from '../../packages/map-model/src/index';
test('placer un lieu par clic, enregistrer puis annuler', async ({ page }) => {
  const world = createDemoWorld(); let created = false;
  const user = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname; const method = route.request().method();
    let body: unknown = { initialized: true, status: 'ok' };
    if (path.endsWith('/auth/refresh')) body = { user, accessToken: 'test' };
    else if (path.endsWith('/worlds')) body = [{ ...world, role: 'owner' }];
    else if (path.endsWith('/tiles')) body = { revision: world.revision, objects: world.objects, total: world.objects.length, reduced: false };
    else if (path.endsWith('/points') && method === 'POST') {
      const input = route.request().postDataJSON();
      expect(input.longitude).toBeCloseTo(0); expect(input.latitude).toBeCloseTo(0); expect(input.name).toBe('Ville nouvelle');
      world.objects.push({ ...world.objects[0]!, id: '00000000-0000-4000-8000-000000000099', name: input.name, geometry: { type: 'Point', coordinates: [input.longitude,input.latitude] } });
      world.revision++; created = true; body = { world, role: 'owner' };
    } else if (path.includes('/points/') && method === 'DELETE') {
      world.objects = world.objects.filter(o => o.id !== '00000000-0000-4000-8000-000000000099'); world.revision++; body = { world, role: 'owner' };
    } else if (path.endsWith('/' + world.id)) body = { world, role: 'owner' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Monde de démonstration/ }).click();
  await page.getByRole('button', { name: 'Placer sur la carte', exact: true }).click();
  await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Placer sur la carte', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Placer sur la carte', exact: true }).click();
  const canvas = page.getByTestId('map-host').locator('canvas'); const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width/2, box.y + box.height/2); await page.mouse.down(); await page.mouse.move(box.x + box.width/2 + 30, box.y + box.height/2, { steps: 4 }); await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Annuler le placement' })).toBeVisible();
  await page.getByRole('button', { name: 'Recentrer', exact: true }).click();
  await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
  await expect(page.getByLabel('Longitude', { exact: true })).toHaveValue('0.000000');
  expect(created).toBe(false);
  await page.getByLabel('Nom du lieu', { exact: true }).fill('Ville nouvelle');
  await page.getByRole('button', { name: 'Enregistrer le lieu', exact: true }).click();
  await expect(page.getByText('Lieu enregistré.', { exact: true })).toBeVisible(); expect(created).toBe(true);
  await page.getByRole('button', { name: 'Annuler l’action', exact: true }).click();
  await expect(page.getByText('Action annulée.', { exact: true })).toBeVisible();
  expect(world.objects.some(o => o.name === 'Ville nouvelle')).toBe(false);
});
