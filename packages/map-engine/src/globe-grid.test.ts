import { expect,it } from 'vitest';
import { capViews, gridLineVertices } from './globe-grid.js';
it('divise une emprise autour de l’antiméridien sans englober le monde',()=>{
  const views = capViews([179,0],3,100);
  expect(views).toHaveLength(2); expect(views[0]!.east).toBe(180); expect(views[1]!.west).toBe(-180);
  expect(views.reduce((sum,v)=>sum+v.east-v.west,0)).toBeCloseTo(6);
});
it('couvre les pôles et les très petites emprises',()=>{
  expect(capViews([30,89],2,100)[0]).toMatchObject({west:-180,east:180,north:90});
  const view = capViews([0,0],0.00001,100)[0]!; expect(view.east-view.west).toBeCloseTo(0.00002,8);
});

it('garde chaque segment de quadrillage au-dessus de la surface du globe',()=>{
  for (const line of [
    {from: [-20,0] as [number,number], to: [20,0] as [number,number]},
    {from: [15,-90] as [number,number], to: [15,90] as [number,number]}
  ]) {
    const vertices = gridLineVertices(line);
    expect(vertices.length).toBeGreaterThan(6);
    for (let i=0;i<vertices.length;i+=6) {
      const midpoint = [0,1,2].map(offset => (vertices[i+offset]! + vertices[i+offset+3]!) / 2);
      expect(Math.hypot(...midpoint)).toBeGreaterThan(1);
    }
  }
});
