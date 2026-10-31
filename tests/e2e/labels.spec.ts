import { expect, test, type Page } from '@playwright/test';
import { createDemoWorld, type MapObject } from '../../packages/map-model/src/index';

async function changedPixels(page: Page, first: Buffer, second: Buffer): Promise<number> {
  return page.evaluate(async ({ a, b }) => {
    const image = async (data: string) => { const result = new Image(); result.src = 'data:image/png;base64,' + data; await result.decode(); return result; };
    const [left, right] = await Promise.all([image(a), image(b)]);
    if (left.width !== right.width || left.height !== right.height) return 0;
    const canvas = document.createElement('canvas'); canvas.width = left.width; canvas.height = left.height;
    const context = canvas.getContext('2d')!; context.drawImage(left,0,0); const before = context.getImageData(0,0,left.width,left.height).data;
    context.clearRect(0,0,left.width,left.height); context.drawImage(right,0,0); const after = context.getImageData(0,0,left.width,left.height).data;
    let changed = 0; for (let i=0;i<before.length;i+=4) if (Math.abs(before[i]! - after[i]!) + Math.abs(before[i+1]! - after[i+1]!) + Math.abs(before[i+2]! - after[i+2]!) > 30) changed++;
    return changed;
  }, { a: first.toString('base64'), b: second.toString('base64') });
}

test('ajouter, modifier et retrouver une annotation sur la carte et le globe', async ({ page }) => {
  test.setTimeout(90000);
  const world = createDemoWorld(); world.objects = [];
  const user = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
  const id = '00000000-0000-4000-8000-000000000090';
  const access = (objects: MapObject[]) => ({ world: { ...world, objects }, role: 'owner', objectsComplete: false, objectCount: world.objects.length });
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()); const path = url.pathname; const method = route.request().method();
    let body: unknown = { initialized: true, status: 'ok' };
    if (path.endsWith('/auth/refresh')) body = { user, accessToken: 'test' };
    else if (path.endsWith('/worlds')) body = [{ ...world, role: 'owner' }];
    else if (path.endsWith('/tiles')) body = { revision: world.revision, objects: world.objects, total: world.objects.length, reduced: false };
    else if (path.endsWith('/points') && method === 'POST') {
      const input = route.request().postDataJSON(); expect(input.revision).toBe(world.revision); expect(input.kind).toBe('label'); expect(input.color).toBe('#88ccdd');
      const label: MapObject = { id, layerId: input.layerId, name: input.name, kind: 'label', geometry: { type: 'Point', coordinates: [input.longitude, input.latitude] }, style: { color: input.color, opacity: 1 }, properties: {} };
      world.objects.push(label); world.revision++; body = access([label]);
    } else if (path.endsWith('/points/' + id)) {
      const input = route.request().postDataJSON(); expect(input.revision).toBe(world.revision);
      if (method === 'PATCH') {
        const current = world.objects.find(item => item.id === id)!;
        current.name = input.name; current.geometry = { type: 'Point', coordinates: [input.longitude,input.latitude] }; current.style.color = input.color;
      } else if (method === 'DELETE') world.objects = world.objects.filter(item => item.id !== id);
      else if (method === 'PUT') world.objects = [...world.objects.filter(item => item.id !== id), input.point];
      world.revision++; body = access(world.objects.filter(item => item.id === id));
    } else if (path.endsWith('/' + world.id)) body = access([]);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Monde de démonstration/ }).click();
  const canvas = page.getByTestId('map-host').locator('canvas'); await expect(canvas).toBeVisible();
  const before = await canvas.screenshot();
  await page.getByLabel('Type de repère').selectOption('label');
  await page.getByLabel('Texte à afficher').fill('Mer intérieure'); await page.getByLabel('Couleur du texte', { exact: true }).fill('#88ccdd');
  await page.getByRole('button', { name: 'Placer sur la carte' }).click();
  const box = (await canvas.boundingBox())!; await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByRole('button', { name: 'Enregistrer le texte' }).click();
  await expect(page.getByText('Texte enregistré.', { exact: true })).toBeVisible();
  expect(await changedPixels(page, before, await canvas.screenshot())).toBeGreaterThan(20);
  await page.mouse.click(box.x + box.width / 2 + 25, box.y + box.height / 2);
  const selected = page.getByRole('region', { name: 'Texte sélectionné' });
  await expect(selected.getByRole('heading', { name: 'Mer intérieure' })).toBeVisible();
  await selected.getByLabel('Texte sélectionné', { exact: true }).fill('Océan bleu'); await selected.getByLabel('Couleur du texte sélectionné').fill('#3366aa');
  await selected.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await expect(page.getByText('Texte modifié.', { exact: true })).toBeVisible();
  expect(world.objects[0]!.name).toBe('Océan bleu'); expect(world.objects[0]!.style.color).toBe('#3366aa');
  await page.getByRole('button', { name: 'Globe 3D', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Globe 3D', exact: true })).toHaveAttribute('aria-pressed', 'true', { timeout: 30000 });
  const globeWithText = await canvas.screenshot();
  await page.getByRole('button', { name: 'Annuler l’action', exact: true }).click();
  await expect.poll(() => world.objects[0]?.name).toBe('Mer intérieure');
  await page.getByRole('button', { name: 'Annuler l’action', exact: true }).click();
  await expect.poll(() => world.objects.length).toBe(0);
  await expect(page.getByText('Action annulée.', { exact: true })).toBeVisible();
  expect(await changedPixels(page, globeWithText, await canvas.screenshot())).toBeGreaterThan(20);
  await page.getByRole('button', { name: 'Rétablir l’action', exact: true }).click();
  await expect.poll(() => world.objects[0]?.name).toBe('Mer intérieure');
  await page.getByRole('button', { name: 'Rétablir l’action', exact: true }).click();
  await expect.poll(() => world.objects[0]?.name).toBe('Océan bleu');
  await expect(page.getByText('Action rétablie.', { exact: true })).toBeVisible();
  const globeBox = (await canvas.boundingBox())!; await page.mouse.click(globeBox.x + globeBox.width / 2 + 20, globeBox.y + globeBox.height / 2);
  await expect(selected.getByRole('heading', { name: 'Océan bleu' })).toBeVisible();
  await selected.getByRole('button', { name: 'Supprimer le texte' }).click();
  await selected.getByRole('button', { name: 'Confirmer la suppression' }).click();
  await expect(page.getByText('Texte supprimé.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Annuler l’action', exact: true }).click();
  await expect.poll(() => world.objects[0]?.name).toBe('Océan bleu');
});

test('un texte de la face cachée du globe ne traverse pas la planète', async ({ page }) => {
  test.setTimeout(60000);
  const world = createDemoWorld();
  world.objects = [{ ...world.objects[0]!, name: 'TEXTE SUR LA FACE CACHÉE', kind: 'label', geometry: { type: 'Point', coordinates: [100, 0] }, style: { color: '#ffffff', opacity: 1 } }];
  const user = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname; let body: unknown = { initialized: true, status: 'ok' };
    if (path.endsWith('/auth/refresh')) body = { user, accessToken: 'test' };
    else if (path.endsWith('/worlds')) body = [{ ...world, role: 'owner' }];
    else if (path.endsWith('/tiles')) body = { revision: world.revision, objects: world.objects, total: 1, reduced: false };
    else if (path.endsWith('/' + world.id)) body = { world, role: 'owner', objectsComplete: true, objectCount: 1 };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Monde de démonstration/ }).click();
  await page.getByRole('button', { name: 'Globe 3D', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Globe 3D', exact: true })).toHaveAttribute('aria-pressed', 'true', { timeout: 30000 });
  const canvas = page.getByTestId('map-host').locator('canvas'); const before = await canvas.screenshot();
  await page.getByRole('checkbox', { name: 'Repères géographiques' }).uncheck();
  const after = await canvas.screenshot(); expect(await changedPixels(page, before, after)).toBeLessThan(5);
});
