import { describe, expect, it } from 'vitest';
import { CSS_PIXELS_PER_METRE, pixelsPerDegreeAtScale, scaleDenominator } from './scale.js';
describe('échelle nominale', () => {
  it('1:25 000 représente 250 m par cm et tient compte du rayon', () => {
    const pixels = pixelsPerDegreeAtScale(6371, 25000);
    const pixelsFor250m = pixels * (0.25 / (6371 * Math.PI / 180));
    expect(pixelsFor250m).toBeCloseTo(CSS_PIXELS_PER_METRE / 100);
    expect(scaleDenominator(6371, pixels)).toBeCloseTo(25000);
    expect(pixelsPerDegreeAtScale(12742, 25000)).toBeCloseTo(2 * pixels);
  });
  it('refuse les échelles invalides', () => {
    for (const value of [0, -1, NaN, Infinity, 1e10]) expect(() => pixelsPerDegreeAtScale(6371, value)).toThrow();
  });
});
