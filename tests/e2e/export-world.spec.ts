import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createDemoWorld, worldBackupSchema } from '../../packages/map-model/src/index';

for (const mode of ['complete', 'stale', 'partial']) test('exporter tous les calques d’un monde privé — réponse : ' + mode, async ({ page }) => {
  const world = createDemoWorld();
  world.layers.push({ id: '00000000-0000-4000-8000-000000000070', name: 'Calque masqué', visible: false, locked: false, opacity: 1, order: 1 });
  world.objects.push({ id: '00000000-0000-4000-8000-000000000071', layerId: world.layers[1]!.id, name: 'Objet hors écran', kind: 'city', geometry: { type: 'Point', coordinates: [150, 40] }, style: { color: '#445566', opacity: 1 }, properties: { note: 'Donnée privée de test' } });
  const user = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
  let fullLoads = 0; let downloads = 0; page.on('download', () => downloads++);
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()); const path = url.pathname; let body: unknown = { initialized: true, status: 'ok' };
    if (path.endsWith('/auth/refresh')) body = { user, accessToken: 'test' };
    else if (path.endsWith('/worlds')) body = [{ ...world, role: 'owner' }];
    else if (path.endsWith('/tiles')) body = { revision: world.revision, objects: [world.objects[0]], total: 1, reduced: false };
    else if (path.endsWith('/' + world.id)) {
      const summary = url.searchParams.get('summary') === '1'; if (!summary) fullLoads++;
      body = { world: summary ? { ...world, objects: [] } : { ...world, revision: world.revision + (mode === 'stale' ? 1 : 0) }, role: 'owner', objectsComplete: !summary && mode !== 'partial', objectCount: world.objects.length };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Monde de démonstration/ }).click();
  await page.getByText('Exporter les données', { exact: true }).click();
  await expect(page.getByText(/contient tous les calques/)).toBeVisible();
  if (mode !== 'complete') {
    await page.getByRole('button', { name: 'Télécharger le JSON' }).click();
    await expect(page.getByText(mode === 'stale' ? /Le monde a changé/ : /Le monde complet est indisponible/)).toBeVisible();
    expect(downloads).toBe(0);
  } else {
    const event = page.waitForEvent('download'); await page.getByRole('button', { name: 'Télécharger le JSON' }).click();
    const download = await event; expect(download.suggestedFilename()).toBe(world.slug + '-monde.json');
    const data = worldBackupSchema.parse(JSON.parse(await readFile((await download.path())!, 'utf8')));
    expect(data.world).toEqual(world); expect(data.world.objects.at(-1)!.properties).toEqual({ note: 'Donnée privée de test' });
    await expect(page.getByText('Données JSON prêtes à télécharger.')).toBeVisible();
  }
  expect(fullLoads).toBe(1);
});

test('le Viewer exporte seulement la copie publiée', async ({ page }) => {
  const world = createDemoWorld(); world.name = 'Carte publique'; world.status = 'unlisted';
  world.objects = world.objects.map(object => ({ ...object, properties: {} }));
  await page.route('**/api/v1/public/worlds/' + world.slug, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(world) }));
  await page.goto('/viewer/?world=' + world.slug); await expect(page.getByRole('heading', { name: 'Carte publique' })).toBeVisible();
  await page.getByText('Exporter les données', { exact: true }).click();
  await expect(page.getByText(/copie publiée/)).toBeVisible();
  const event = page.waitForEvent('download'); await page.getByRole('button', { name: 'Télécharger le JSON' }).click();
  const data = worldBackupSchema.parse(JSON.parse(await readFile((await (await event).path())!, 'utf8')));
  expect(data.world).toEqual(world);
});
