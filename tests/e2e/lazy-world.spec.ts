import { expect,test } from '@playwright/test';
import { createDemoWorld } from '../../packages/map-model/src/index';
test('ouvrir sans objets puis parcourir l’Atlas par pages sans chargement complet',async({page})=>{
  const world = createDemoWorld(); let fullLoads=0; let summaries=0;
  const user={id:'00000000-0000-4000-8000-000000000050',email:'alice@example.test',displayName:'Alice',isAdmin:false};
  await page.route('**/api/v1/**',async route=>{
    const url=new URL(route.request().url()); let body:unknown={initialized:true,status:'ok'};
    if(url.pathname.endsWith('/auth/refresh')) body={user,accessToken:'test'};
    else if(url.pathname.endsWith('/worlds')) body=[{...world,role:'owner'}];
    else if(url.pathname.endsWith('/atlas')) body={revision:world.revision,objects:url.searchParams.get('cursor')?[]:[world.objects[0]],nextCursor:url.searchParams.get('cursor')?null:world.objects[0]!.id};
    else if(url.pathname.endsWith('/tiles')) body={revision:world.revision,objects:[world.objects[0]],total:1,reduced:false};
    else if(url.pathname.endsWith('/'+world.id)) {
      const summary=url.searchParams.get('summary')==='1'; if(summary) summaries++; else fullLoads++;
      body={world:summary?{...world,objects:[]}:world,role:'owner',objectsComplete:!summary,objectCount:world.objects.length};
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/'); await page.getByRole('button',{name:'Alice',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:/Monde de démonstration/}).click();
  await expect(page.getByText('1 objet(s) chargé(s) dans cette zone',{exact:true})).toBeVisible();
  expect(summaries).toBe(1); expect(fullLoads).toBe(0);
  await page.getByRole('link',{name:'Accueil',exact:true}).click();
  await expect(page.getByTestId('world-object-count')).toHaveText(String(world.objects.length));
  await page.getByRole('link',{name:'Guide',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Vos premiers pas dans AlarMap'})).toBeVisible();
  expect(fullLoads).toBe(0);
  await page.getByRole('link',{name:'Carte',exact:true}).click();
  const box=(await page.getByTestId('map-host').locator('canvas').boundingBox())!;
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  await expect(page.getByRole('region',{name:'Lieu sélectionné'})).toContainText('Origine');
  expect(fullLoads).toBe(0);
  await page.getByRole('link',{name:'Atlas',exact:true}).click();
  await expect(page.getByRole('button',{name:'Localiser Origine',exact:true})).toBeVisible();
  expect(fullLoads).toBe(0);
  await page.getByRole('button',{name:'Page suivante',exact:true}).click();
  await expect(page.getByText('Page 2 · 0 résultat(s)',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Page précédente',exact:true}).click();
  await expect(page.getByRole('button',{name:'Localiser Origine',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Localiser Origine',exact:true}).click();
  await expect(page.getByRole('region',{name:'Lieu sélectionné'})).toContainText('Origine');
  await page.getByRole('link',{name:'Accueil',exact:true}).click();
  await expect(page.getByTestId('world-object-count')).toHaveText(String(world.objects.length));
  expect(fullLoads).toBe(0);
});
