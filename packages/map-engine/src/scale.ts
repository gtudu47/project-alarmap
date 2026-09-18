/** Échelle nominale nord-sud, avec 96 pixels CSS par pouce. */
export const CSS_PIXELS_PER_METRE = 96 / 0.0254;
export function pixelsPerDegreeAtScale(radiusKm: number, denominator: number): number {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || !Number.isFinite(denominator) || denominator < 100 || denominator > 1e9) throw new Error('Échelle : dénominateur de 100 à 1 000 000 000.');
  return radiusKm * 1000 * Math.PI / 180 * CSS_PIXELS_PER_METRE / denominator;
}
export function scaleDenominator(radiusKm: number, pixelsPerDegree: number): number {
  return radiusKm * 1000 * Math.PI / 180 * CSS_PIXELS_PER_METRE / pixelsPerDegree;
}
