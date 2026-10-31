import { ShapeUtils, Vector2 } from 'three';
import type { Coordinate } from '@alarmap/map-model';
import { supportsPlanarPolygon, toSphere } from './geography.js';

type Triangle = [Coordinate, Coordinate, Coordinate];
const MAX_TRIANGLES = 200_000;
const MAX_STEP_DEGREES = 2;
const SURFACE_RADIUS = 1.001;

/** Triangulation en longitude/latitude puis subdivision pour suivre la sphère.
 * Les triangles restent au-dessus du globe tout en préservant les trous. */
export function sphericalPolygonVertices(rings: Coordinate[][]): number[] {
  if (!supportsPlanarPolygon(rings)) return [];
  const vertices = rings.map(ring => ring.slice(0, -1).map(point => new Vector2(...point)));
  const outer = vertices[0];
  if (!outer || outer.length < 3 || vertices.some(ring => ring.length < 3)) return [];
  const indices = ShapeUtils.triangulateShape(outer, vertices.slice(1));
  const points = vertices.flat().map(point => [point.x, point.y] as Coordinate);
  const pending: Triangle[] = indices.map(([a, b, c]) => [points[a!]!, points[b!]!, points[c!]!]);
  const output: number[] = [];
  const midpoint = (a: Coordinate, b: Coordinate): Coordinate => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  while (pending.length) {
    const [a, b, c] = pending.pop()!;
    const span = Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]),Math.abs(b[0]-c[0]),Math.abs(b[1]-c[1]),Math.abs(c[0]-a[0]),Math.abs(c[1]-a[1]));
    if (span > MAX_STEP_DEGREES) {
      if (pending.length + output.length / 9 + 4 > MAX_TRIANGLES) return [];
      const ab = midpoint(a,b); const bc = midpoint(b,c); const ca = midpoint(c,a);
      pending.push([a,ab,ca], [ab,b,bc], [ca,bc,c], [ab,bc,ca]);
    } else {
      for (const point of [a,b,c]) output.push(...toSphere(point,SURFACE_RADIUS));
    }
  }
  return output;
}
