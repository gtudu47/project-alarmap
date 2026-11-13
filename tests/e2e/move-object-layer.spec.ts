import { expect, test } from '@playwright/test';
import { createDemoWorld } from '../../packages/map-model/src/index';

test('déplacer un tracé, conserver sa géométrie et annuler après un refus', async ({ page }) => {
  const world = createDemoWorld();
  const line = world.objects[1]!;
  line.geometry = { type: 'LineString', coordinates: [[170, 20], [179, 25], [-170, 30]] };
  line.properties = { note: 'Conservée' };
  const originalGeometry = structuredClone(line.geometry);
  const source = world.layers[0]!.id;
  const destination = '00000000-0000-4000-8000-000000000099';
  world.layers.push({ id: destination, name: 'Relief', visible: true, locked: false, opacity: 1, order: 1 });
  const user = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
  let rejectUndo = true; let moves = 0; let rejected = 0;
  const simplified = () => ({ ...line, geometry: { type: 'LineString', coordinates: [[170, 20], [-170, 30]] } });
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()); const path = url.pathname;
    let body: unknown = { initialized: true, status: 'ok' }; let status = 200;
    if (path === '/api/v1/auth/refresh') body = { user, accessToken: 'test' };
    else if (path === '/api/v1/worlds') body = [{ ...world, role: 'owner' }];
    else if (path === '/api/v1/worlds/' + world.id) body = { world: { ...world, objects: [] }, role: 'owner', objectsComplete: false, objectCount: world.objects.length };
    else if (path === '/api/v1/worlds/' + world.id + '/tiles') body = { revision: world.revision, objects: [simplified()], total: 1, reduced: false };
    else if (path === '/api/v1/worlds/' + world.id + '/atlas') body = { revision: world.revision, objects: [simplified()], nextCursor: null };
    else if (path === '/api/v1/worlds/' + world.id + '/objects/' + line.id + '/layer' && route.request().method() === 'PATCH') {
      const input = route.request().postDataJSON() as { revision: number; layerId: string };
      expect(Object.keys(input).sort()).toEqual(['layerId', 'revision']);
      expect(input.revision).toBe(world.revision);
      if (input.layerId === source && rejectUndo) { rejectUndo = false; rejected++; status = 409; body = { message: 'Calque verrouillé.' }; }
      else {
        line.layerId = input.layerId; world.revision++; moves++;
        body = { world: { ...world, objects: [line] }, role: 'owner', objectsComplete: false, objectCount: world.objects.length };
      }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Monde de démonstration/ }).click();
  await page.getByRole('link', { name: 'Atlas', exact: true }).click();
  await page.getByRole('button', { name: 'Localiser Passage de l’antiméridien' }).click();
  const card = page.getByRole('region', { name: 'Tracé sélectionné' });
  await card.getByLabel('Calque de l’objet').selectOption(destination);
  expect(moves).toBe(0);
  await card.getByRole('button', { name: 'Déplacer vers ce calque' }).click();
  await expect(page.getByText('Objet déplacé vers le calque choisi.', { exact: true })).toBeVisible();
  expect(line.layerId).toBe(destination); expect(line.geometry).toEqual(originalGeometry);
  await page.getByRole('button', { name: 'Annuler l’action', exact: true }).click();
  await expect(page.getByText('Calque verrouillé.', { exact: true })).toBeVisible();
  expect(rejected).toBe(1); expect(line.layerId).toBe(destination);
  await expect(page.getByRole('button', { name: 'Annuler l’action', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Annuler l’action', exact: true }).click();
  await expect(page.getByText('Action annulée.', { exact: true })).toBeVisible();
  expect(line.layerId).toBe(source); expect(line.geometry).toEqual(originalGeometry);
  await page.getByRole('button', { name: 'Rétablir l’action', exact: true }).click();
  await expect(page.getByText('Action rétablie.', { exact: true })).toBeVisible();
  expect(line.layerId).toBe(destination); expect(line.geometry).toEqual(originalGeometry);
});
test('un lecteur ne peut pas déplacer un objet vers un autre calque', async ({ page }) => {
  const world = createDemoWorld();
  world.layers.push({ id: '00000000-0000-4000-8000-000000000099', name: 'Relief', visible: true, locked: false, opacity: 1, order: 1 });
  const user = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = { initialized: true, status: 'ok' };
    if (path === '/api/v1/auth/refresh') body = { user, accessToken: 'test' };
    else if (path === '/api/v1/worlds') body = [{ ...world, role: 'viewer' }];
    else if (path === '/api/v1/worlds/' + world.id) body = { world, role: 'viewer', objectsComplete: true, objectCount: world.objects.length };
    else if (path === '/api/v1/worlds/' + world.id + '/tiles') body = { revision: world.revision, objects: world.objects, total: world.objects.length, reduced: false };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Monde de démonstration/ }).click();
  await page.getByRole('link', { name: 'Atlas', exact: true }).click();
  await page.getByRole('button', { name: 'Localiser Origine', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Lieu sélectionné' })).toContainText('Origine');
  await expect(page.getByRole('button', { name: 'Déplacer vers ce calque' })).toHaveCount(0);
});
