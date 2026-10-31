import { expect, test } from '@playwright/test';
import { createDemoWorld } from '../../packages/map-model/src/index';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
for (const role of ['owner', 'viewer'] as const) test('bibliothèque privée d’images : ' + role, async ({ page }) => {
  const world = createDemoWorld();
  const other = structuredClone(world); other.id = '10000000-0000-4000-8000-000000000010'; other.name = 'Autre monde'; other.slug = 'autre-monde';
  const user = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
  const image = { id: '10000000-0000-4000-8000-000000000099', name: 'Image témoin', byteSize: Buffer.from(png, 'base64').length, width: 1, height: 1 };
  let images = role === 'viewer' ? [image] : []; let writes = 0;
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()); const path = url.pathname; const method = route.request().method(); let body: unknown = { initialized: true, status: 'ok' }; let status = 200;
    if (path.endsWith('/auth/refresh')) body = { user, accessToken: 'test' };
    else if (path.endsWith('/assets/' + image.id) && method === 'DELETE') { images = []; writes++; status = 204; }
    else if (path.endsWith('/assets/' + image.id)) body = { ...image, data: png };
    else if (path.endsWith('/assets') && method === 'POST') {
      const input = route.request().postDataJSON(); expect(input).toEqual({ name: image.name, data: png }); images = [image]; writes++; body = image; status = 201;
    } else if (path.endsWith('/assets')) body = path.includes(other.id) ? [] : images;
    else if (path.endsWith('/worlds')) body = [{ ...world, role }, { ...other, role }];
    else if (path.endsWith('/tiles')) body = { revision: world.revision, objects: world.objects, total: world.objects.length, reduced: false };
    else if (path.endsWith('/' + world.id) || path.endsWith('/' + other.id)) body = { world: path.endsWith('/' + world.id) ? world : other, role, objectsComplete: true, objectCount: world.objects.length };
    await route.fulfill(status === 204 ? { status } : { status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Monde de démonstration/ }).click();
  await page.getByText('Images du monde', { exact: true }).click();
  const library = page.locator('alarmap-asset-library');
  if (role === 'owner') {
    await expect(library.getByText('Aucune image dans ce monde.')).toBeVisible();
    await library.getByLabel('Nom de l’image').fill(image.name);
    await library.getByLabel('Fichier PNG').setInputFiles({ name: 'temoin.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await library.getByRole('button', { name: 'Importer l’image' }).click();
    await expect(library.getByText('Image importée dans ce monde.')).toBeVisible(); expect(writes).toBe(1);
  } else {
    await expect(library.getByText(image.name)).toBeVisible();
    await expect(library.getByRole('button', { name: 'Importer l’image' })).toHaveCount(0);
    await expect(library.getByRole('button', { name: 'Supprimer l’image ' + image.name })).toHaveCount(0);
  }
  await library.getByRole('button', { name: 'Afficher' }).click();
  await expect(library.getByRole('img', { name: image.name })).toBeVisible();
  await expect(library.getByRole('img', { name: image.name })).toHaveAttribute('src', 'data:image/png;base64,' + png);
  if (role === 'owner') {
    await library.getByLabel('Nom de l’image').fill('Brouillon non envoyé');
    await library.getByLabel('Fichier PNG').setInputFiles({ name: 'brouillon.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  }
  await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Autre monde/ }).click();
  await expect(page.getByRole('heading', { name: other.name, exact: true })).toBeVisible();
  await expect(library.getByRole('img')).toHaveCount(0); await expect(library.getByText(image.name)).toHaveCount(0);
  await expect(library.getByText('Aucune image dans ce monde.')).toBeVisible();
  if (role === 'owner') {
    await expect(library.getByLabel('Nom de l’image')).toHaveValue('');
    await expect(library.getByLabel('Fichier PNG')).toHaveValue('');
  }
  await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Monde de démonstration/ }).click();
  await expect(library.getByText(image.name)).toBeVisible();
  if (role === 'owner') {
    await library.getByRole('button', { name: 'Supprimer l’image ' + image.name }).click();
    await library.getByRole('button', { name: 'Annuler', exact: true }).click(); expect(writes).toBe(1);
    await library.getByRole('button', { name: 'Supprimer l’image ' + image.name }).click();
    await library.getByRole('button', { name: 'Confirmer la suppression' }).click();
    await expect(library.getByText('Image retirée de ce monde.')).toBeVisible();
    await expect(library.getByText('Aucune image dans ce monde.')).toBeVisible(); expect(writes).toBe(2);
  }
});
