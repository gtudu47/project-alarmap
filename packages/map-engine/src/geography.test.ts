import { expect, it } from 'vitest';
import { distanceKm, distanceToSegment, fromSphere, pointInPolygon, splitAntimeridian, supportsPlanarPolygon, toSphere } from './geography.js';

it('traverse l’antiméridien par deux segments courts', () => {
  expect(splitAntimeridian([[170, 20], [-170, 30]])).toEqual([[[170, 20], [180, 25]], [[-180, 25], [-170, 30]]]);
  expect(splitAntimeridian([[-170, 30], [170, 20]])).toEqual([[[-170, 30], [-180, 25]], [[180, 25], [170, 20]]]);
});
it('calcule les distances à partir du rayon de la planète', () => {
  expect(distanceKm([0, 0], [90, 0], 100)).toBeCloseTo(Math.PI * 50);
  expect(distanceKm([170, 0], [-170, 0], 100)).toBeCloseTo(Math.PI * 100 / 9);
  expect(distanceKm([0, 90], [180, 90], 100)).toBeCloseTo(0);
});
it('convertit les coordonnées du globe dans les deux sens', () => {
  for (const coordinate of [[0, 0], [170, 45], [-170, -45], [0, 90], [0, -90]] as [number, number][]) {
    const result = fromSphere(toSphere(coordinate, 23));
    expect(result[0]).toBeCloseTo(coordinate[0]);
    expect(result[1]).toBeCloseTo(coordinate[1]);
  }
});

it('mesure la distance au segment, y compris aux extrémités', () => {
  expect(distanceToSegment([5, 3], [0, 0], [10, 0])).toBe(3);
  expect(distanceToSegment([13, 4], [0, 0], [10, 0])).toBe(5);
  expect(distanceToSegment([3, 4], [0, 0], [0, 0])).toBe(5);
});

it('sélectionne une surface, respecte ses trous et refuse les raccordements non pris en charge', () => {
  const rings: [number, number][][] = [
    [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
    [[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]],
  ];
  expect(pointInPolygon([1, 1], rings)).toBe(true);
  expect(pointInPolygon([0, 5], rings)).toBe(true);
  expect(pointInPolygon([5, 5], rings)).toBe(false);
  expect(pointInPolygon([3, 5], rings)).toBe(false);
  expect(pointInPolygon([11, 5], rings)).toBe(false);
  expect(supportsPlanarPolygon([[[170, 0], [-170, 0], [-170, 10], [170, 0]]])).toBe(false);
  expect(supportsPlanarPolygon([[[0, 90], [1, 80], [0, 80], [0, 90]]])).toBe(false);
});
