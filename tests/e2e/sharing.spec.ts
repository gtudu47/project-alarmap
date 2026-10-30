import { expect, test } from '@playwright/test';

test('le propriétaire partage son monde, change un rôle et retire l’accès', async ({ page }) => {
  const owner = { id: '00000000-0000-4000-8000-000000000050', email: 'alice@example.test', displayName: 'Alice', isAdmin: false };
  const member = { id: '00000000-0000-4000-8000-000000000051', email: 'bob@example.test', displayName: 'Bob', role: 'viewer' };
  const own = { id: '00000000-0000-4000-8000-000000000060', name: 'Mon monde', radiusKm: 100, revision: 0, role: 'owner' };
  const shared = { id: '00000000-0000-4000-8000-000000000061', name: 'Monde partagé', radiusKm: 100, revision: 0, role: 'viewer' };
  let current: typeof member[] = []; let writes = 0;
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname; const method = route.request().method();
    let body: unknown = { status: 'ok' }; let status = 200;
    if (path.endsWith('/auth/refresh')) body = { user: owner, accessToken: 'token-test' };
    else if (path.endsWith('/auth/status')) body = { initialized: true };
    else if (path.endsWith('/worlds')) body = [own, shared];
    else if (path.endsWith('/worlds/' + own.id + '/members') && method === 'GET') body = current;
    else if (path.endsWith('/worlds/' + own.id + '/members') && method === 'POST') {
      const input = route.request().postDataJSON();
      if (input.email === 'absent@example.test') { status = 404; body = { message: 'Compte introuvable.' }; }
      else { expect(input.email).toBe(member.email); writes++; current = [{ ...member, role: input.role }]; body = {}; }
    } else if (path.endsWith('/worlds/' + own.id + '/members/' + member.id) && method === 'DELETE') { writes++; current = []; body = {}; }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Alice', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Gérer les accès de Monde partagé' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Gérer les accès de Mon monde' }).click();
  const access = dialog.getByRole('region', { name: 'Accès à Mon monde' });
  await expect(access.getByText('Aucun autre membre pour ce monde.')).toBeVisible();
  await access.getByLabel('Adresse email du membre').fill('absent@example.test');
  await access.getByRole('button', { name: 'Donner accès' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Compte introuvable.'); expect(writes).toBe(0);
  await access.getByLabel('Adresse email du membre').fill(member.email);
  await access.getByLabel('Rôle du membre').selectOption('viewer');
  await access.getByRole('button', { name: 'Donner accès' }).click();
  await expect(access.getByText(member.email)).toBeVisible(); expect(current[0]!.role).toBe('viewer');
  await access.getByLabel('Rôle de Bob').selectOption('editor');
  await access.getByRole('button', { name: 'Modifier le rôle' }).click();
  await expect(dialog.getByText('Rôle mis à jour.')).toBeVisible(); expect(current[0]!.role).toBe('editor');
  await access.getByRole('button', { name: 'Retirer l’accès de Bob' }).click();
  await access.getByRole('button', { name: 'Annuler', exact: true }).click(); expect(writes).toBe(2);
  await access.getByRole('button', { name: 'Retirer l’accès de Bob' }).click();
  await access.getByRole('button', { name: 'Confirmer le retrait' }).click();
  await expect(access.getByText('Aucun autre membre pour ce monde.')).toBeVisible(); expect(writes).toBe(3);
});

test('un lecteur ouvre un monde partagé sans commandes de modification', async ({ page }) => {
  const user = { id: '00000000-0000-4000-8000-000000000051', email: 'bob@example.test', displayName: 'Bob', isAdmin: false };
  const world = { schemaVersion: 1, id: '00000000-0000-4000-8000-000000000070', name: 'Monde partagé', slug: 'monde-partage', radiusKm: 100, revision: 1, status: 'draft', layers: [{ id: '00000000-0000-4000-8000-000000000071', name: 'Carte', visible: true, locked: false, opacity: 1, order: 0 }], objects: [] };
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname; let body: unknown = { status: 'ok', initialized: true };
    if (path.endsWith('/auth/refresh')) body = { user, accessToken: 'token-test' };
    else if (path.endsWith('/worlds')) body = [{ ...world, role: 'viewer' }];
    else if (path.endsWith('/' + world.id)) body = { world, role: 'viewer', objectsComplete: false, objectCount: 0 };
    else if (path.endsWith('/tiles')) body = { revision: 1, objects: [], total: 0, reduced: false };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Bob', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: /Gérer les accès/ })).toHaveCount(0);
  await dialog.getByRole('button', { name: /^Monde partagé/ }).click();
  await expect(page.getByRole('heading', { name: 'Monde partagé', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enregistrer le lieu' })).toHaveCount(0);
  await expect(page.getByText('Territoires', { exact: true })).toHaveCount(0);
});
