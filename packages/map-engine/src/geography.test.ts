import { expect, it } from 'vitest';
import { distanceKm, fromSphere, splitAntimeridian, toSphere } from './geography.js';

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
