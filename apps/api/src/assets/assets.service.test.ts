import { describe, expect, it } from 'vitest';
import { validatePng } from './assets.service.js';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
describe('validation des images PNG', () => {
  it('accepte un PNG complet et mesure ses dimensions', () => {
    const result = validatePng(png);
    expect(result.width).toBe(1); expect(result.height).toBe(1);
    expect(result.data).toEqual(Buffer.from(png, 'base64'));
  });
  it('refuse les données non canoniques, incomplètes ou corrompues', () => {
    expect(() => validatePng('hello')).toThrow();
    expect(() => validatePng(png.slice(0, -4))).toThrow();
    const corrupt = Buffer.from(png, 'base64'); corrupt[42] = corrupt[42]! ^ 1;
    expect(() => validatePng(corrupt.toString('base64'))).toThrow();
    expect(() => validatePng(png + 'AAAA')).toThrow();
  });
  it('refuse les dimensions démesurées et les fichiers trop gros', () => {
    const huge = Buffer.from(png, 'base64'); huge.writeUInt32BE(8193, 16);
    expect(() => validatePng(huge.toString('base64'))).toThrow(/Dimensions/);
    expect(() => validatePng('A'.repeat(5592412))).toThrow(/4 Mio/);
  });
});
