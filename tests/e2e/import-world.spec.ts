import { expect, test } from '@playwright/test';
import { createDemoWorld } from '../../packages/map-model/src/index';

test('importer un JSON dans un nouveau monde privé sans remplacer la source', async ({ page }) => {
  const source = createDemoWorld(); source.status = 'public';
  const imported = structuredClone(source); imported.id = '00000000-0000-4000-8000-000000000091'; imported.slug = 'copie-importee'; imported.name = 'Copie importée'; imported.status = 'draft'; imported.revision = 0;
  const user = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
  const document = { format: 'alarmap-world', version: 1, world: source }; let imports = 0;
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()); const path = url.pathname; let body: unknown = { initialized: true, status: 'ok' };
    if (path.endsWith('/auth/refresh')) body = { user, accessToken: 'test' };
    else if (path.endsWith('/worlds/import')) {
      expect(route.request().postDataJSON()).toEqual({ name: imported.name, document }); imports++;
      body = { world: imported, role: 'owner', objectsComplete: true, objectCount: imported.objects.length };
    } else if (path.endsWith('/worlds')) body = [{ ...source, role: 'owner' }, ...(imports ? [{ ...imported, role: 'owner' }] : [])];
    else if (path.endsWith('/tiles')) body = { revision: imported.revision, objects: imported.objects, total: imported.objects.length, reduced: false };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Alice', exact: true }).click();
  const dialog = page.getByRole('dialog'); await dialog.getByText('Importer un monde JSON', { exact: true }).click();
  await dialog.getByLabel('Nom du monde importé').fill(imported.name);
  const file = dialog.getByLabel('Fichier du monde JSON');
  await file.setInputFiles({ name: 'invalide.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await dialog.getByRole('button', { name: 'Importer le monde' }).click();
  await expect(dialog.getByRole('alert')).toContainText('illisible'); expect(imports).toBe(0);
  await file.setInputFiles({ name: 'futur.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...document, version: 2 })) });
  await dialog.getByRole('button', { name: 'Importer le monde' }).click();
  await expect(dialog.getByRole('alert')).toContainText('version'); expect(imports).toBe(0);
  await file.setInputFiles({ name: 'monde.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) });
  await dialog.getByRole('button', { name: 'Importer le monde' }).click();
  await expect(dialog).toHaveCount(0); await expect(page.getByRole('heading', { name: imported.name, exact: true })).toBeVisible();
  expect(imports).toBe(1); expect(source.status).toBe('public');
});
