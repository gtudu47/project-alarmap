import { expect, test, type Page } from '@playwright/test';
import { createDemoWorld } from '../../packages/map-model/src/index';
const owner = 'a'.repeat(50); const worldKey = 'b'.repeat(50); const objectKey = 'c'.repeat(50);
const worldPath = '/' + owner + '/monde/' + worldKey;
const objectPath = worldPath + '/territoire/' + objectKey;
const user = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
const scene = () => {
  const world = createDemoWorld(); world.objects = [{ id: '00000000-0000-4000-8000-000000000098', layerId: world.layers[0]!.id, name: 'Territoire secret', kind: 'territory',
    geometry: { type: 'Polygon', coordinates: [[[-30,-30],[30,-30],[30,35],[-30,35],[-30,-30]]] }, style: { color: '#b14b31', opacity: 1 }, properties: {} }]; return world;
};
async function mockApi(page: Page, loggedIn = true) {
  const world = scene(); let authenticated = loggedIn;
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()); const path = url.pathname; let body: unknown = { initialized: true, status: 'ok' }; let status = 200;
    if (path.endsWith('/auth/refresh')) { if (authenticated) body = { user, accessToken: 'test' }; else { status=401; body={message:'Connexion requise.'}; } }
    else if (path.endsWith('/auth/login')) { authenticated = true; body = { user, accessToken: 'test' }; }
    else if (path.endsWith('/worlds')) body = [{ ...world, role: 'owner' }];
    else if (path.endsWith('/tiles')) body = { revision: world.revision, objects: world.objects, total: 1, reduced: false };
    else if (path === '/api/v1/worlds/' + world.id + '/objects/' + world.objects[0]!.id) body = { world, role: 'owner', objectsComplete: false, objectCount: 1 };
    else if (path.endsWith('/links/private/worlds/' + world.id)) body = { ownerKey: owner, worldKey };
    else if (path.endsWith('/links/private/worlds/' + world.id + '/objects/' + world.objects[0]!.id)) body = { ownerKey: owner, worldKey, objectKey };
    else if (path.includes('/links/private/resolve/')) {
      if (!authenticated) { status=401; body={message:'Connexion requise.'}; }
      else body = { world: { ...world, objects: path.endsWith('/' + objectKey) ? world.objects : [] }, role: 'owner', objectsComplete: false, objectCount: 1 };
    } else if (path.endsWith('/' + world.id)) body = { world: { ...world, objects: [] }, role: 'owner', objectsComplete: false, objectCount: 1 };
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return world;
}

test('adresse privée stable pour le monde et le territoire, rechargement et historique', async ({ page }) => {
  test.setTimeout(90000); await mockApi(page);
  await page.goto('/'); await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Monde de démonstration/ }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(worldPath);
  await expect(page.getByText('1 objet(s) chargé(s) dans cette zone', { exact: true })).toBeVisible();
  const box = (await page.getByTestId('map-host').locator('canvas').boundingBox())!; await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  await expect(page.getByRole('region', { name: 'Territoire sélectionné' })).toContainText('Territoire secret');
  await expect.poll(() => new URL(page.url()).pathname).toBe(objectPath);
  expect(page.url()).not.toContain('secret'); expect(page.url()).not.toContain('Alice');
  const card = page.getByRole('region', { name: 'Territoire sélectionné' });
  await card.getByRole('button', { name: 'Modifier le territoire' }).click();
  await card.getByLabel('Nom du territoire sélectionné').fill('Modification en cours');
  await page.goBack();
  await expect(card.getByLabel('Nom du territoire sélectionné')).toHaveValue('Modification en cours');
  await expect(card.getByText('Enregistrez ou annulez la modification avant de changer de page.')).toBeVisible();
  await expect.poll(() => new URL(page.url()).pathname).toBe(objectPath);
  await card.getByRole('button', { name: 'Annuler la modification' }).click();
  await page.reload(); await expect(page.getByRole('region', { name: 'Territoire sélectionné' })).toContainText('Territoire secret');
  await page.goBack(); await expect.poll(() => new URL(page.url()).pathname).toBe(worldPath);
  await expect(page.getByRole('region', { name: 'Territoire sélectionné' })).toHaveCount(0);
  await page.goForward(); await expect(page.getByRole('region', { name: 'Territoire sélectionné' })).toContainText('Territoire secret');
});

test('un lien privé demande la connexion avant d’afficher le territoire', async ({ page }) => {
  test.setTimeout(90000); await mockApi(page,false); await page.goto(objectPath);
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  await expect(page.getByRole('region', { name: 'Territoire sélectionné' })).toHaveCount(0);
  await dialog.getByLabel('Adresse email').fill('alice@example.test'); await dialog.getByLabel('Mot de passe', { exact: true }).fill('motdepasse');
  await dialog.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Territoire sélectionné' })).toContainText('Territoire secret');
  expect(new URL(page.url()).pathname).toBe(objectPath);
});

test('une fiche publiée s’ouvre directement avec son adresse opaque', async ({ page }) => {
  test.setTimeout(90000); const world=scene(); world.status='unlisted';
  await page.route('**/api/v1/links/public/resolve/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ world, object: world.objects[0] }) }));
  await page.goto('/viewer' + objectPath);
  await expect(page.getByRole('region', { name: 'Territoire sélectionné' })).toContainText('Territoire secret');
});


test('cliquer sur une fiche publique crée une adresse partageable', async ({ page }) => {
  test.setTimeout(90000); const world=scene(); world.status='unlisted';
  await page.route('**/api/v1/public/worlds/' + world.slug, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(world) }));
  await page.route('**/api/v1/links/public/worlds/' + world.slug + '/objects/' + world.objects[0]!.id, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ownerKey: owner, worldKey, objectKey }) }));
  await page.route('**/api/v1/links/public/resolve/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ world, object: world.objects[0] }) }));
  await page.goto('/viewer/?world=' + world.slug); await expect(page.getByRole('heading', { name: world.name, exact: true })).toBeVisible();
  const box = (await page.getByTestId('map-host').locator('canvas').boundingBox())!; await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  await expect(page.getByRole('region', { name: 'Territoire sélectionné' })).toContainText('Territoire secret');
  await expect.poll(() => new URL(page.url()).pathname).toBe('/viewer' + objectPath);
  await page.goBack(); await expect(page.getByRole('region', { name: 'Territoire sélectionné' })).toHaveCount(0);
  await page.goForward(); await expect(page.getByRole('region', { name: 'Territoire sélectionné' })).toContainText('Territoire secret');
  await page.reload(); await expect(page.getByRole('region', { name: 'Territoire sélectionné' })).toContainText('Territoire secret');
});
