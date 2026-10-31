import { expect, test } from '@playwright/test';
import { createDemoWorld } from '../../packages/map-model/src/index';

test('surface, trou, sélection et visibilité d’un territoire sur le globe', async ({ page }) => {
  test.setTimeout(90000);
  const world = createDemoWorld();
  world.objects = [{ id: '00000000-0000-4000-8000-000000000098', layerId: world.layers[0]!.id, name: 'Territoire rouge', kind: 'territory',
    geometry: { type: 'Polygon', coordinates: [
      [[-30,-20],[30,-20],[30,40],[-30,40],[-30,-20]],
      [[-6,4],[-6,16],[6,16],[6,4],[-6,4]],
    ] }, style: { color: '#dd4422', opacity: 1 }, properties: {} }];
  const backLayer = '00000000-0000-4000-8000-000000000096';
  world.layers.push({ id: backLayer, name: 'Face cachée', visible: true, locked: false, opacity: 1, order: 1 });
  world.objects.push({ id: '00000000-0000-4000-8000-000000000097', layerId: backLayer, name: 'Territoire caché', kind: 'territory',
    geometry: { type: 'Polygon', coordinates: [[[150,-20],[179,-20],[179,40],[150,40],[150,-20]]] },
    style: { color: '#00ff00', opacity: 1 }, properties: {} });
  const user = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname; let body: unknown = { initialized: true, status: 'ok' };
    if (path.endsWith('/auth/refresh')) body = { user, accessToken: 'test' };
    else if (path.endsWith('/worlds')) body = [{ ...world, role: 'owner' }];
    else if (path.endsWith('/tiles')) body = { revision: world.revision, objects: world.objects, total: world.objects.length, reduced: false };
    else if (path.endsWith('/' + world.id)) body = { world, role: 'owner', objectsComplete: true };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Monde de démonstration/ }).click();
  await page.getByRole('button', { name: 'Globe 3D', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Globe 3D', exact: true })).toHaveAttribute('aria-pressed','true',{ timeout: 30000 });
  await page.getByText('Détail et tuiles', { exact: true }).click();
  await page.getByLabel('Afficher la grille', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Appliquer les dimensions' }).click();
  const canvas = page.getByTestId('map-host').locator('canvas');
  const box = (await canvas.boundingBox())!; const x = box.x + box.width / 2; const y = box.y + box.height / 2;
  await page.mouse.click(x,y);
  await expect(page.getByRole('region', { name: 'Territoire sélectionné' })).toHaveCount(0);
  await page.mouse.click(x+70,y);
  await expect(page.getByRole('region', { name: 'Territoire sélectionné' })).toContainText('Territoire rouge');
  await page.getByRole('button', { name: 'Fermer la fiche' }).click();
  const visible = await canvas.screenshot();
  await page.getByRole('checkbox', { name: 'Repères géographiques', exact: true }).uncheck();
  const hidden = await canvas.screenshot();
  const differences = await page.evaluate(async ({ before, after }) => {
    const load = async (data: string) => { const img = new Image(); img.src = 'data:image/png;base64,' + data; await img.decode(); return img; };
    const [a,b] = await Promise.all([load(before),load(after)]); const image = document.createElement('canvas'); image.width=a.width; image.height=a.height;
    const context = image.getContext('2d')!; const sample = (img: HTMLImageElement, dx: number) => { context.drawImage(img,0,0); return context.getImageData(Math.round(a.width / 2 + dx),Math.round(a.height / 2),1,1).data; };
    const difference = (dx: number) => { const left = sample(a,dx); const right = sample(b,dx); return [0,1,2].reduce((sum,i) => sum + Math.abs(left[i]! - right[i]!),0); };
    return { hole: difference(0), fill: difference(70) };
  }, { before: visible.toString('base64'), after: hidden.toString('base64') });
  expect(differences.hole).toBeLessThan(15);
  expect(differences.fill).toBeGreaterThan(50);
  await page.getByRole('checkbox', { name: 'Face cachée', exact: true }).uncheck();
  const withoutBack = await canvas.screenshot();
  expect(hidden.equals(withoutBack)).toBe(true);
  await page.mouse.click(x+70,y);
  await expect(page.getByRole('region', { name: 'Territoire sélectionné' })).toHaveCount(0);
});


test('une carte publiée montre aussi les territoires remplis sur le globe', async ({ page }) => {
  test.setTimeout(90000);
  const world = createDemoWorld(); world.name = 'Monde publié'; world.status = 'unlisted';
  world.objects = [{ id: '00000000-0000-4000-8000-000000000098', layerId: world.layers[0]!.id, name: 'Territoire publié', kind: 'territory',
    geometry: { type: 'Polygon', coordinates: [[[-30,-20],[30,-20],[30,40],[-30,40],[-30,-20]]] },
    style: { color: '#dd4422', opacity: 1 }, properties: {} }];
  await page.route('**/api/v1/public/worlds/' + world.slug, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(world) }));
  await page.goto('/viewer/?world=' + world.slug);
  await expect(page.getByRole('heading', { name: 'Monde publié' })).toBeVisible();
  await page.getByRole('button', { name: 'Globe 3D', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Globe 3D', exact: true })).toHaveAttribute('aria-pressed','true',{ timeout: 30000 });
  const canvas = page.getByTestId('map-host').locator('canvas'); const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByRole('region', { name: 'Territoire sélectionné' })).toContainText('Territoire publié');
  await page.getByRole('button', { name: 'Fermer la fiche' }).click();
  const visible = await canvas.screenshot();
  await page.getByRole('checkbox', { name: 'Repères géographiques', exact: true }).uncheck();
  expect(visible.equals(await canvas.screenshot())).toBe(false);
});
