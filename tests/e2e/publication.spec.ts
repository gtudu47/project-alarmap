import { expect, test } from '@playwright/test';
import { createDemoWorld } from '../../packages/map-model/src/index';

test('publier les calques choisis puis retirer la publication', async ({ page }) => {
  const world = createDemoWorld();
  world.layers.push({ id: '00000000-0000-4000-8000-000000000070', name: 'Secrets', visible: false, locked: false, opacity: 1, order: 1 });
  const user = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
  let published = false;
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()); const path = url.pathname; const method = route.request().method();
    let body: unknown = { initialized: true, status: 'ok' };
    if (path.endsWith('/auth/refresh')) body = { user, accessToken: 'token-test' };
    else if (path.endsWith('/worlds')) body = [{ ...world, role: 'owner' }];
    else if (path.endsWith('/publication') && method === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ revision: world.revision, visibility: 'unlisted', layerIds: [world.layers[0]!.id] });
      published = true; body = { slug: world.slug, revision: world.revision, visibility: 'unlisted' };
    } else if (path.endsWith('/publication') && method === 'DELETE') { published = false; body = {}; }
    else if (path.endsWith('/tiles')) body = { revision: world.revision, objects: world.objects, total: world.objects.length, reduced: false };
    else if (path.endsWith('/' + world.id)) body = { world, role: 'owner', objectsComplete: true, objectCount: world.objects.length };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Monde de démonstration/ }).click();
  await page.getByText('Publier cette carte', { exact: true }).click();
  const layers = page.getByRole('group', { name: 'Calques à publier' });
  await expect(layers.getByLabel('Secrets', { exact: true })).not.toBeChecked();
  await expect(layers.getByLabel(world.layers[0]!.name, { exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: 'Publier la révision actuelle' }).click();
  await expect(page.getByText('Choisissez de 1 à 100 calques à publier.')).toBeVisible(); expect(published).toBe(false);
  await layers.getByLabel(world.layers[0]!.name, { exact: true }).check();
  await page.getByRole('button', { name: 'Publier la révision actuelle' }).click();
  await expect(page.getByText('Révision ' + world.revision + ' publiée.')).toBeVisible(); expect(published).toBe(true);
  await expect(page.getByLabel('Lien de consultation')).toHaveValue(new URL('/viewer/?world=' + world.slug, page.url()).toString());
  await page.getByRole('button', { name: 'Retirer la publication', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmer le retrait de la publication' }).click();
  await expect(page.getByText('Publication retirée.')).toBeVisible(); expect(published).toBe(false);
  await expect(page.getByLabel('Lien de consultation')).toHaveCount(0);
});

for (const route of ['/viewer/', '/embed/monde']) test('le Viewer charge uniquement la copie publiée : ' + route, async ({ page }) => {
  const world = createDemoWorld(); world.name = 'Atlas publié'; world.status = 'unlisted';
  await page.route('**/api/v1/public/worlds/' + world.slug, async route => {
    expect(route.request().headers()['authorization']).toBeUndefined();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(world) });
  });
  await page.goto(route + '?world=' + world.slug);
  await expect(page.getByRole('heading', { name: 'Atlas publié', exact: true })).toBeVisible();
  await expect(page.getByText('Révision publiée en lecture seule.')).toBeVisible();
  await expect(page.getByTestId('map-host').locator('canvas')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Enregistrer le lieu' })).toHaveCount(0);
});

test('une publication absente affiche une erreur sans fausse carte de démonstration', async ({ page }) => {
  await page.route('**/api/v1/public/worlds/absente', route => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.goto('/viewer/?world=absente');
  await expect(page.getByRole('alert')).toContainText('introuvable');
  await expect(page.getByRole('heading', { name: 'Monde de démonstration' })).not.toBeVisible();
});

test('une page externe peut intégrer une carte publiée dans une iframe', async ({ page }) => {
  const world = createDemoWorld(); world.name = 'Carte intégrée'; world.status = 'unlisted';
  const appUrl = process.env['E2E_BASE_URL'] ?? 'http://127.0.0.1:8080';
  test.skip(!['localhost', '127.0.0.1'].includes(new URL(appUrl).hostname), 'Test croisé réservé aux deux adresses locales.');
  const embed = new URL('/viewer/?world=' + world.slug, appUrl).toString();
  const parent = new URL('/', appUrl); parent.hostname = parent.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
  expect(parent.origin).not.toBe(new URL(appUrl).origin);
  await page.route('**/api/v1/public/worlds/' + world.slug, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(world) }));
  await page.goto(parent.toString());
  await page.evaluate(src => {
    const iframe = document.createElement('iframe'); iframe.title = 'Carte intégrée'; iframe.src = src;
    iframe.style.cssText = 'position:fixed;inset:0;width:800px;height:600px;z-index:9999'; document.body.append(iframe);
  }, embed);
  const frame = page.frameLocator('iframe[title="Carte intégrée"]');
  await expect(frame.getByRole('heading', { name: 'Carte intégrée', exact: true })).toBeVisible();
  await expect(frame.getByTestId('map-host').locator('canvas')).toHaveCount(1);
});
