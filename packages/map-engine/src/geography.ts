import type { Coordinate } from '@alarmap/map-model';

const radians = Math.PI / 180;
export function normalizeLongitude(longitude: number): number {
  return ((longitude + 180) % 360 + 360) % 360 - 180;
}
export function toSphere([longitude, latitude]: Coordinate, radius = 1): [number, number, number] {
  const phi = latitude * radians;
  const theta = longitude * radians;
  return [radius * Math.cos(phi) * Math.sin(theta), radius * Math.sin(phi), radius * Math.cos(phi) * Math.cos(theta)];
}
export function fromSphere([x, y, z]: [number, number, number]): Coordinate {
  const radius = Math.hypot(x, y, z);
  if (radius === 0) throw new Error('Le centre de la sphère n’a pas de coordonnées géographiques.');
  return [normalizeLongitude(Math.atan2(x, z) / radians), Math.asin(Math.max(-1, Math.min(1, y / radius))) / radians];
}
export function distanceKm(a: Coordinate, b: Coordinate, radiusKm: number): number {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) throw new Error('Rayon invalide.');
  const dLat = (b[1] - a[1]) * radians;
  const dLon = normalizeLongitude(b[0] - a[0]) * radians;
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * radians) * Math.cos(b[1] * radians) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(Math.min(1, Math.max(0, haversine))));
}
/** Coupe à ±180° sans tracer de trait à travers la carte. Interpolation en lon/lat. */
export function splitAntimeridian(points: Coordinate[]): Coordinate[][] {
  const first = points[0];
  if (!first) return [];
  const segments: Coordinate[][] = [[first]];
  let previous = first;
  for (const point of points.slice(1)) {
    const delta = point[0] - previous[0];
    if (Math.abs(delta) > 180) {
      const unwrapped = point[0] + (delta > 0 ? -360 : 360);
      const seam = delta > 0 ? -180 : 180;
      const fraction = (seam - previous[0]) / (unwrapped - previous[0]);
      const latitude = previous[1] + fraction * (point[1] - previous[1]);
      segments.at(-1)?.push([seam, latitude]);
      segments.push([[-seam, latitude], point]);
    } else segments.at(-1)?.push(point);
    previous = point;
  }
  return segments;
}
