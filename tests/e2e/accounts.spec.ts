import { expect, test } from '@playwright/test';

// Ces tests valident l’interface avec des réponses HTTP contrôlées.
// Les règles de sécurité serveur sont couvertes par auth.service.test et accounts.integration.
test('connexion indisponible : pas de succès inventé ni de fuite du mot de passe', async ({ page }) => {
  await page.route('**/api/v1/auth/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Unavailable"}' }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Mon espace' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Adresse email', { exact: true }).fill('alice@example.test');
  await dialog.getByLabel('Mot de passe', { exact: true }).fill('Mon mot de passe de test!');
  await dialog.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('indisponible');
  await expect(page.getByRole('heading', { name: 'Mes mondes', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => Object.keys(localStorage))).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Fermer' }).click();
  await expect(dialog).toHaveCount(0);
});

test('un membre voit son espace et peut créer puis ouvrir son monde', async ({ page }) => {
  const user = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
  const world = { schemaVersion: 1, id: '00000000-0000-4000-8000-000000000060', name: 'Mon univers privé', slug: 'mon-univers', radiusKm: 100, revision: 0, status: 'draft', layers: [{ id: '00000000-0000-4000-8000-000000000061', name: 'Mes lieux', visible: true, locked: false, opacity: 1, order: 0 }], objects: [] };
  let created = false;
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = { status: 'ok' };
    if (path.endsWith('/auth/refresh')) body = { user, accessToken: 'test-ui-token' };
    else if (path.endsWith('/auth/status')) body = { initialized: true };
    else if (path.endsWith('/worlds') && route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ name: world.name, radiusKm: 100 });
      expect(route.request().headers()['authorization']).toBe('Bearer test-ui-token');
      created = true; body = { world, role: 'owner' };
    } else if (path.endsWith('/worlds')) body = created ? [{ ...world, role: 'owner' }] : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Alice', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Inviter une personne')).toHaveCount(0);
  await dialog.getByLabel('Nom du nouveau monde').fill(world.name);
  await dialog.getByLabel('Rayon en km').fill('100');
  await dialog.getByRole('button', { name: 'Créer un monde privé' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: world.name, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enregistrer le lieu' })).toBeVisible();
});

test('l’invitation passe par le fragment et ne laisse pas son secret dans l’URL', async ({ page }) => {
  await page.route('**/api/v1/auth/refresh', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/v1/auth/status', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"initialized":true}' }));
  await page.goto('/#invite=' + 'a'.repeat(64));
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bienvenue sur AlarMap' })).toBeVisible();
  expect(new URL(page.url()).hash).toBe('');
  await expect(page.getByLabel('Confirmer le mot de passe')).toBeVisible();
});

test('les calques restent indépendants entre carte et globe', async ({ page }) => {
  const user = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
  const world = { schemaVersion: 1, id: '00000000-0000-4000-8000-000000000060', name: 'Monde à deux calques', slug: 'deux-calques', radiusKm: 100, revision: 0, status: 'draft', layers: [
    { id: '00000000-0000-4000-8000-000000000061', name: 'Villes', visible: true, locked: false, opacity: 1, order: 0 },
    { id: '00000000-0000-4000-8000-000000000062', name: 'Routes', visible: false, locked: false, opacity: 1, order: 1 },
  ], objects: [] };
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith('/auth/refresh') ? { user, accessToken: 'test-ui-token' } : path.endsWith('/worlds') ? [{ ...world, role: 'owner' }] : path.endsWith('/' + world.id) ? { world, role: 'owner' } : { initialized: true, status: 'ok' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Alice', exact: true }).click();
  await page.getByRole('button', { name: /Monde à deux calques/ }).click();
  await expect(page.getByRole('checkbox', { name: 'Villes' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Routes' })).not.toBeChecked();
  await page.getByRole('checkbox', { name: 'Routes' }).check();
  await page.getByRole('checkbox', { name: 'Villes' }).uncheck();
  await page.getByRole('button', { name: 'Globe 3D', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Routes' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Villes' })).not.toBeChecked();
});
