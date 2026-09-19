import type { Coordinate } from '@alarmap/map-model';
import type { GridView } from './grid.js';
/** Emprises d’une calotte, divisées à l’antiméridien. */
export function capViews([longitude, latitude]: Coordinate, angle: number, pixelsPerDegree: number): GridView[] {
  const radius = Math.max(1e-9, Math.min(180, angle));
  const south = Math.max(-90, latitude-radius); const north = Math.min(90, latitude+radius);
  if (south === -90 || north === 90) return [{ west:-180, east:180, south, north, pixelsPerDegree }];
  const delta = Math.asin(Math.min(1,Math.sin(radius*Math.PI/180)/Math.cos(latitude*Math.PI/180)))*180/Math.PI;
  const west = longitude-delta; const east = longitude+delta;
  if (west < -180) return [{west:west+360,east:180,south,north,pixelsPerDegree},{west:-180,east,south,north,pixelsPerDegree}];
  if (east > 180) return [{west,east:180,south,north,pixelsPerDegree},{west:-180,east:east-360,south,north,pixelsPerDegree}];
  return [{west,east,south,north,pixelsPerDegree}];
}
