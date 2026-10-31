import { expect, test } from '@playwright/test';
import { createDemoWorld } from '../../packages/map-model/src/index';

test('découvrir une carte publique puis ouvrir sa copie publiée', async ({ page }) => {
  const world = createDemoWorld(); world.name = 'Atlas public'; world.status = 'public';
  await page.route('**/api/v1/public/worlds', route => {
    expect(route.request().headers()['authorization']).toBeUndefined();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ slug: world.slug, name: world.name, revision: world.revision }]) });
  });
  await page.route('**/api/v1/public/worlds/' + world.slug, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(world) }));
  await page.goto('/?page=accueil');
  await page.getByRole('link', { name: 'Cartes publiques', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cartes publiques', exact: true })).toBeVisible();
  await expect(page.getByText('Révision publiée ' + world.revision)).toBeVisible();
  await expect(page.getByTestId('map-host').locator('canvas')).toHaveCount(0);
  await page.getByRole('link', { name: 'Consulter Atlas public' }).click();
  await expect(page.getByRole('heading', { name: 'Atlas public', exact: true })).toBeVisible();
  await expect(page.getByText('Révision publiée en lecture seule.')).toBeVisible();
});

test('refuser un catalogue invalide puis afficher un catalogue vide après réessai', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/v1/public/worlds', route => {
    attempts++; const body = attempts === 1 ? [{ slug: 'https://example.test', name: 'Invalide', revision: 0 }] : [];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/viewer/?catalogue=1');
  await expect(page.getByRole('alert')).toContainText('Impossible de charger');
  await expect(page.getByRole('link', { name: /Consulter Invalide/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await expect(page.getByText('Aucune carte publique pour le moment.')).toBeVisible();
});

test('le catalogue reste lisible sur mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route('**/api/v1/public/worlds', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ slug: 'atlas-public', name: 'Un atlas public', revision: 1 }]) }));
  await page.goto('/viewer/?catalogue=1');
  await expect(page.getByRole('link', { name: 'Consulter Un atlas public' })).toBeVisible();
  const widths = await page.evaluate(() => ({ viewport: window.innerWidth, content: document.documentElement.scrollWidth }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
});
