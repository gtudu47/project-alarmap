import { describe, expect, it } from 'vitest';
import { DEFAULT_GRID, visibleGrid, validateGrid } from './grid';
const radius = 180 / Math.PI;
describe('grille progressive en kilomètres', () => {
  it('subdivise au zoom jusqu’à la résolution demandée', () => {
    const coarse = visibleGrid(DEFAULT_GRID, radius, { west: -10, east: 10, south: -10, north: 10, pixelsPerDegree: 1 });
    const fine = visibleGrid(DEFAULT_GRID, radius, { west: -10, east: 10, south: -10, north: 10, pixelsPerDegree: 60 });
    expect(coarse.stats.multiplier).toBe(64); expect(fine.stats.multiplier).toBe(1);
    expect(fine.stats.visibleTiles).toBeGreaterThan(coarse.stats.visibleTiles);
  });
  it('respecte une maille 10 × 12 et le rayon de la planète', () => {
    const result = visibleGrid({ enabled: true, widthKm: 10, heightKm: 12 }, radius, { west: -20, east: 20, south: -20, north: 20, pixelsPerDegree: 60 });
    expect(result.stats.widthKm).toBe(10); expect(result.stats.heightKm).toBe(12);
    const horizontal = result.lines.filter(line => line.from[1] === line.to[1]);
    expect(horizontal[1]!.from[1] - horizontal[0]!.from[1]).toBeCloseTo(12);
    const larger = visibleGrid(DEFAULT_GRID, radius * 2, { west: -10, east: 10, south: -10, north: 10, pixelsPerDegree: 60 });
    expect(larger.stats.multiplier).toBe(2);
  });
  it('reste bornée près des pôles et ne dessine pas hors du monde', () => {
    const result = visibleGrid(DEFAULT_GRID, 6371, { west: -200, east: 200, south: 88, north: 100, pixelsPerDegree: 100 });
    expect(result.lines.length).toBeLessThanOrEqual(4096);
    for (const line of result.lines) for (const [lon,lat] of [line.from,line.to]) { expect(Number.isFinite(lon)).toBe(true); expect(Math.abs(lon)).toBeLessThanOrEqual(180); expect(Math.abs(lat)).toBeLessThanOrEqual(90); }
    expect(visibleGrid(DEFAULT_GRID, radius, { west: 200, east: 300, south: 0, north: 5, pixelsPerDegree: 100 }).lines).toEqual([]);
    expect(() => validateGrid({ enabled: true, widthKm: 0, heightKm: 1 })).toThrow();
  });
});
