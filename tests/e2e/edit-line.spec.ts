import { expect, test } from '@playwright/test';
import { createDemoWorld } from '../../packages/map-model/src/index';

test('modifier les sommets complets d’un tracé puis annuler et rétablir', async ({ page }) => {
  const world = createDemoWorld(); const line = world.objects[1]!;
  line.geometry = { type: 'LineString', coordinates: [[170,20],[179,25],[-170,30]] };
  line.properties = { note: 'Conservée' }; line.startYear = -20;
  const simplified = () => ({ ...world.objects.find(o => o.id === line.id)!, geometry: { type: 'LineString', coordinates: [[170,20],[-170,30]] } });
  const user = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
  let fullLoads = 0; let objectLoads = 0; let writes = 0;
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()); const path = url.pathname; const method = route.request().method();
    let body: unknown = { initialized: true, status: 'ok' };
    if (path.endsWith('/auth/refresh')) body = { user, accessToken: 'test' };
    else if (path.endsWith('/worlds')) body = [{ ...world, role: 'owner' }];
    else if (path.endsWith('/atlas')) body = { revision: world.revision, objects: [simplified()], nextCursor: null };
    else if (path.endsWith('/tiles')) body = { revision: world.revision, objects: [simplified()], total: 1, reduced: false };
    else if (path.endsWith('/objects/' + line.id)) { objectLoads++; body = { world: { ...world, objects: [world.objects.find(o => o.id === line.id)] }, role: 'owner', objectsComplete: false, objectCount: world.objects.length }; }
    else if (path.endsWith('/lines/' + line.id) && method === 'PUT') {
      const input = route.request().postDataJSON(); expect(input.revision).toBe(world.revision); expect(url.searchParams.get('compact')).toBe('1');
      writes++; world.objects = world.objects.map(o => o.id === line.id ? input.point : o); world.revision++;
      body = { world: { ...world, objects: [input.point] }, role: 'owner', objectsComplete: false, objectCount: world.objects.length };
    } else if (path.endsWith('/' + world.id)) {
      if (!url.searchParams.has('summary')) fullLoads++;
      body = { world: { ...world, objects: [] }, role: 'owner', objectsComplete: false, objectCount: world.objects.length };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Monde de démonstration/ }).click();
  await page.getByRole('link', { name: 'Atlas', exact: true }).click();
  await page.getByRole('button', { name: 'Localiser Passage de l’antiméridien' }).click();
  const selected = page.getByRole('region', { name: 'Tracé sélectionné' });
  await selected.getByRole('button', { name: 'Modifier le tracé', exact: true }).click();
  const coordinates = selected.getByLabel('Sommets du tracé');
  await expect(coordinates).toHaveValue('170, 20\n179, 25\n-170, 30'); expect(objectLoads).toBe(1);
  await coordinates.fill('170, 20\ninvalid');
  await selected.getByRole('button', { name: 'Enregistrer le tracé modifié' }).click();
  await expect(selected.getByText(/Indiquez 2 à 2 000 sommets/)).toBeVisible(); expect(writes).toBe(0);
  await selected.getByLabel('Nom du tracé sélectionné').fill('Nouvelle route');
  await coordinates.fill('170, 20\n178, 24\n-170, 30');
  await selected.getByRole('button', { name: 'Enregistrer le tracé modifié' }).click();
  await expect(page.getByText('Tracé modifié.', { exact: true })).toBeVisible();
  expect(world.objects[1]!.name).toBe('Nouvelle route'); expect(world.objects[1]!.properties).toEqual({ note: 'Conservée' }); expect(world.objects[1]!.startYear).toBe(-20);
  expect(world.objects[1]!.geometry).toEqual({ type: 'LineString', coordinates: [[170,20],[178,24],[-170,30]] });
  await page.getByRole('button', { name: 'Annuler l’action', exact: true }).click();
  await expect.poll(() => world.objects[1]!.name).toBe('Passage de l’antiméridien');
  expect(world.objects[1]!.geometry).toEqual({ type: 'LineString', coordinates: [[170,20],[179,25],[-170,30]] });
  await page.getByRole('button', { name: 'Rétablir l’action', exact: true }).click();
  await expect.poll(() => world.objects[1]!.name).toBe('Nouvelle route'); expect(fullLoads).toBe(0);
});
