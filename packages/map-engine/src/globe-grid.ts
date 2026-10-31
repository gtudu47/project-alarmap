import type { Coordinate } from '@alarmap/map-model';
import type { GridLine, GridView } from './grid.js';
import { toSphere } from './geography.js';
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

/** Segments courts : leur corde reste au-dessus de la surface de la sphère. */
export function gridLineVertices(line: GridLine): number[] {
  const span = Math.max(Math.abs(line.to[0] - line.from[0]), Math.abs(line.to[1] - line.from[1]));
  const steps = Math.max(1, Math.ceil(span / 0.25)); const vertices: number[] = [];
  for (let index = 0; index < steps; index++) for (const t of [index / steps, (index + 1) / steps]) {
    vertices.push(...toSphere([line.from[0] + (line.to[0] - line.from[0]) * t, line.from[1] + (line.to[1] - line.from[1]) * t], 1.002));
  }
  return vertices;
}
