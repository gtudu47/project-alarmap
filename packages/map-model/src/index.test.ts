import { describe, expect, it } from 'vitest';
import { createDemoWorld, geometrySchema, isActiveAt, periodSchema, relationSchema, worldSchema } from './index.js';

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
