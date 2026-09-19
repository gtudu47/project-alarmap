import { expect, test } from '@playwright/test';
import { createDemoWorld } from '../../packages/map-model/src/index';
test('détails 3D des deux côtés de l’antiméridien, dédoublonnage et révision', async ({ page }) => {
  const world = createDemoWorld(); world.objects[0]!.geometry = { type: 'Point', coordinates: [179.999,0] };
  const user = { id: '00000000-0000-4000-8000-000000000050', email:'alice@example.test', displayName:'Alice', isAdmin:false };
  const requests: URL[] = []; let stale = false;
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()); let body: unknown = { initialized:true,status:'ok' };
    if (url.pathname.endsWith('/auth/refresh')) body = { user,accessToken:'stream-test' };
    else if (url.pathname.endsWith('/worlds')) body = [{...world,role:'owner'}];
    else if (url.pathname.endsWith('/tiles')) {
      expect(route.request().headers()['authorization']).toBe('Bearer stream-test'); requests.push(url);
      body = {revision:world.revision + (stale ? 1 : 0),objects:[world.objects[0]],total:1,reduced:false};
    } else if (url.pathname.endsWith('/'+world.id)) body = {world,role:'owner'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/'); await page.getByRole('button',{name:'Alice',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:/Monde de démonstration/}).click();
  await page.getByRole('link',{name:'Atlas',exact:true}).click();
  await page.getByRole('button',{name:'Localiser Origine',exact:true}).click();
  await page.getByRole('button',{name:'Globe 3D',exact:true}).click();
  await expect(page.getByRole('button',{name:'Globe 3D',exact:true})).toHaveAttribute('aria-pressed','true',{timeout:15000});
  await page.getByText('Détail et tuiles',{exact:true}).click();
  await page.getByRole('button',{name:'Voir ce niveau de détail'}).click();
  await expect.poll(()=>requests.filter(u=>u.searchParams.get('detailKm')==='1').length).toBeGreaterThanOrEqual(2);
  const fine = requests.filter(u=>u.searchParams.get('detailKm')==='1');
  expect(fine.some(u=>u.searchParams.get('east')==='180')).toBe(true);
  expect(fine.some(u=>u.searchParams.get('west')==='-180')).toBe(true);
  await expect(page.getByText('1 objet(s) chargé(s) dans cette zone',{exact:true})).toBeVisible();
  stale = true;
  const slider = page.getByRole('slider',{name:'Niveau de zoom'}); await slider.focus(); await slider.press('ArrowUp');
  await expect(page.getByText('Le monde a changé : rechargez-le pour consulter les détails.',{exact:true})).toBeVisible();
});
