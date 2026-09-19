import { expect,test } from '@playwright/test';
import { createDemoWorld } from '../../packages/map-model/src/index';
test('ouvrir sans objets puis charger la liste complète uniquement pour l’Atlas',async({page})=>{
  const world = createDemoWorld(); let fullLoads=0; let summaries=0;
  const user={id:'00000000-0000-4000-8000-000000000050',email:'alice@example.test',displayName:'Alice',isAdmin:false};
  await page.route('**/api/v1/**',async route=>{
    const url=new URL(route.request().url()); let body:unknown={initialized:true,status:'ok'};
    if(url.pathname.endsWith('/auth/refresh')) body={user,accessToken:'test'};
    else if(url.pathname.endsWith('/worlds')) body=[{...world,role:'owner'}];
    else if(url.pathname.endsWith('/tiles')) body={revision:world.revision,objects:[world.objects[0]],total:1,reduced:false};
    else if(url.pathname.endsWith('/'+world.id)) {
      const summary=url.searchParams.get('summary')==='1'; if(summary) summaries++; else fullLoads++;
      body={world:summary?{...world,objects:[]}:world,role:'owner',objectsComplete:!summary};
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/'); await page.getByRole('button',{name:'Alice',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:/Monde de démonstration/}).click();
  await expect(page.getByText('1 objet(s) chargé(s) dans cette zone',{exact:true})).toBeVisible();
  expect(summaries).toBe(1); expect(fullLoads).toBe(0);
  const box=(await page.getByTestId('map-host').locator('canvas').boundingBox())!;
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  await expect(page.getByRole('region',{name:'Lieu sélectionné'})).toContainText('Origine');
  expect(fullLoads).toBe(0);
  await page.getByRole('link',{name:'Atlas',exact:true}).click();
  await expect(page.getByRole('button',{name:'Localiser Origine',exact:true})).toBeVisible();
  expect(fullLoads).toBe(1);
});
