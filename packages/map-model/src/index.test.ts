import { describe, expect, it } from 'vitest';
import { areaObjectSchema, createDemoWorld, geometrySchema, isActiveAt, periodSchema, relationSchema, worldBackupSchema, worldSchema } from './index.js';

describe('modèle géographique et temporel', () => {
  it('conserve une scène via JSON', () => {
    const world = createDemoWorld();
    expect(worldSchema.parse(JSON.parse(JSON.stringify(world)))).toEqual(world);
  });
  it('accepte les pôles mais rejette une latitude impossible', () => {
    expect(geometrySchema.safeParse({ type: 'Point', coordinates: [180, 90] }).success).toBe(true);
    expect(geometrySchema.safeParse({ type: 'Point', coordinates: [0, 91] }).success).toBe(false);
  });
  it('rejette les anneaux ouverts et accepte les trous', () => {
    expect(geometrySchema.safeParse({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] }).success).toBe(false);
    expect(geometrySchema.safeParse({ type: 'Polygon', coordinates: [
      [[0, 0], [10, 0], [10, 10], [0, 0]], [[2, 2], [3, 2], [3, 3], [2, 2]],
    ] }).success).toBe(true);
  });
  it('interprète la borne finale comme exclusive, y compris avant l’année zéro', () => {
    expect(isActiveAt({ startYear: -20, endYear: 0 }, -20)).toBe(true);
    expect(isActiveAt({ startYear: -20, endYear: 0 }, 0)).toBe(false);
    expect(periodSchema.safeParse({ startYear: 1, endYear: 1 }).success).toBe(false);
  });
  it('rejette les références de calques absentes et les identifiants dupliqués', () => {
    const world = createDemoWorld();
    expect(worldSchema.safeParse({ ...world, layers: [] }).success).toBe(false);
    expect(worldSchema.safeParse({ ...world, objects: [...world.objects, ...world.objects] }).success).toBe(false);
  });
  it('ne confond pas direction de persécution et score', () => {
    const relation = { id: '00000000-0000-4000-8000-000000000010', worldId: '00000000-0000-4000-8000-000000000001', religionAId: '00000000-0000-4000-8000-000000000011', religionBId: '00000000-0000-4000-8000-000000000012', relationType: 'persecuted', relationScore: -80 };
    expect(relationSchema.parse(relation).religionAId).toBe(relation.religionAId);
    expect(relationSchema.safeParse({ ...relation, relationScore: 101 }).success).toBe(false);
  });
});

it('valide les territoires avec trous et rejette les géométries non prises en charge', () => {
  const world = createDemoWorld();
  const area = { ...world.objects[0]!, kind: 'territory', name: 'Vallée', geometry: { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 0]]] } };
  expect(areaObjectSchema.safeParse(area).success).toBe(true);
  expect(areaObjectSchema.safeParse({ ...area, kind: 'city' }).success).toBe(false);
  expect(areaObjectSchema.safeParse({ ...area, geometry: { type: 'Polygon', coordinates: [[[170, 0], [-170, 0], [-170, 10], [170, 0]]] } }).success).toBe(false);
  expect(areaObjectSchema.safeParse({ ...area, geometry: { type: 'Polygon', coordinates: [[[0, 90], [1, 80], [0, 80], [0, 90]]] } }).success).toBe(false);
  expect(areaObjectSchema.safeParse({ ...area, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 0], [0, 0]]] } }).success).toBe(false);
  expect(areaObjectSchema.safeParse({ ...area, geometry: { type: 'Polygon', coordinates: [...area.geometry.coordinates, [[5, 1], [7, 1], [6, 2], [5, 1]]] } }).success).toBe(true);
  expect(areaObjectSchema.safeParse({ ...area, geometry: { type: 'Polygon', coordinates: [...area.geometry.coordinates, [[170, 0], [-170, 0], [-170, 1], [170, 0]]] } }).success).toBe(false);
  const tooMany = Array.from({ length: 2001 }, (_, i) => [i % 10, Math.floor(i / 10) % 10]);
  tooMany.push(tooMany[0]!);
  expect(areaObjectSchema.safeParse({ ...area, geometry: { type: 'Polygon', coordinates: [tooMany] } }).success).toBe(false);
});

it('valide un export de monde versionné et refuse les formats inconnus', () => {
  const document = { format: 'alarmap-world', version: 1, world: createDemoWorld() };
  expect(worldBackupSchema.parse(JSON.parse(JSON.stringify(document)))).toEqual(document);
  expect(worldBackupSchema.safeParse({ ...document, version: 2 }).success).toBe(false);
  expect(worldBackupSchema.safeParse({ ...document, format: 'autre-format' }).success).toBe(false);
  expect(worldBackupSchema.safeParse({ ...document, unexpected: true }).success).toBe(false);
});
