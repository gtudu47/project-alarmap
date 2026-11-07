import { expect, test, type Page } from '@playwright/test';
import { createDemoWorld } from '../../packages/map-model/src/index';

test('ordre des territoires superposés cohérent sur la carte et le globe', async ({ page }) => {
  test.setTimeout(120000);
  const world = createDemoWorld();
  const redLayer = world.layers[0]!;
  redLayer.name = 'Calque rouge'; redLayer.order = 0;
  const blueLayer = { ...redLayer, id: '00000000-0000-4000-8000-000000000096', name: 'Calque bleu', order: 1 };
  world.layers = [redLayer, blueLayer];
  const geometry = { type: 'Polygon' as const, coordinates: [[[-40, -30], [40, -30], [40, 40], [-40, 40], [-40, -30]] as [number, number][]] };
  world.objects = [
    { id: '00000000-0000-4000-8000-000000000098', layerId: blueLayer.id, name: 'Territoire bleu', kind: 'territory', geometry, style: { color: '#283eed', opacity: 1 }, properties: {} },
    { id: '00000000-0000-4000-8000-000000000097', layerId: redLayer.id, name: 'Territoire rouge', kind: 'territory', geometry, style: { color: '#ed2828', opacity: 1 }, properties: {} },
  ];
  const user = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = { initialized: true, status: 'ok' };
    if (path.endsWith('/auth/refresh')) body = { user, accessToken: 'test' };
    else if (path === '/api/v1/worlds') body = [{ ...world, role: 'owner' }];
    else if (path.endsWith('/tiles')) body = { revision: world.revision, objects: world.objects, total: world.objects.length, reduced: false };
    else if (path === '/api/v1/worlds/' + world.id) body = { world, role: 'owner', objectsComplete: true, objectCount: world.objects.length };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  async function centreColor(currentPage: Page): Promise<number[]> {
    const screenshot = await currentPage.getByTestId('map-host').locator('canvas').screenshot();
    return currentPage.evaluate(async data => {
      const image = new Image(); image.src = 'data:image/png;base64,' + data; await image.decode();
      const sample = document.createElement('canvas'); sample.width = image.width; sample.height = image.height;
      const context = sample.getContext('2d')!; context.drawImage(image, 0, 0);
      return Array.from(context.getImageData(Math.floor(image.width / 2), Math.floor(image.height / 2), 1, 1).data);
    }, screenshot.toString('base64'));
  }
  async function openWorld(): Promise<void> {
    await page.goto('/');
    await page.getByRole('button', { name: 'Alice', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^Monde de démonstration/ }).click();
  }
  async function checkView(expected: 'bleu' | 'rouge', blended = false): Promise<void> {
    const canvas = page.getByTestId('map-host').locator('canvas');
    await expect.poll(async () => {
      const color = await centreColor(page);
      return blended ? color[0]! > 60 && color[2]! > 60 : expected === 'bleu' ? color[2]! > color[0]! + 60 : color[0]! > color[2]! + 60;
    }).toBe(true);
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByRole('region', { name: 'Territoire sélectionné' })).toContainText('Territoire ' + expected);
    await page.getByRole('button', { name: 'Fermer la fiche' }).click();
  }
  for (const state of ['blue', 'red', 'transparent'] as const) {
    redLayer.order = state === 'red' ? 1 : 0;
    blueLayer.order = state === 'red' ? 0 : 1;
    blueLayer.opacity = state === 'transparent' ? 0.5 : 1;
    await openWorld();
    const expected = state === 'red' ? 'rouge' : 'bleu';
    await checkView(expected, state === 'transparent');
    await page.getByRole('button', { name: 'Globe 3D', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Globe 3D', exact: true })).toHaveAttribute('aria-pressed', 'true', { timeout: 30000 });
    await checkView(expected, state === 'transparent');
  }
});