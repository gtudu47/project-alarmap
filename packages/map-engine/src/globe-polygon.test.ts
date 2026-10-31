import { describe, expect, it } from 'vitest';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import type { Coordinate } from '@alarmap/map-model';
import { toSphere } from './geography.js';
import { sphericalPolygonVertices } from './globe-polygon.js';

const outer: Coordinate[] = [[-10,-10],[10,-10],[10,10],[-10,10],[-10,-10]];
const hole: Coordinate[] = [[-3,-3],[-3,3],[3,3],[3,-3],[-3,-3]];

describe('surface des territoires sur le globe', () => {
  it('recouvre la sphère tout en conservant les trous', () => {
    const positions = sphericalPolygonVertices([outer,hole]);
    expect(positions.length).toBeGreaterThan(0);
    const geometry = new BufferGeometry(); geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
    const mesh = new Mesh(geometry,new MeshBasicMaterial({ side: DoubleSide })); mesh.updateMatrixWorld();
    const hit = (coordinate: Coordinate) => {
      const origin = new Vector3(...toSphere(coordinate,3));
      return new Raycaster(origin,origin.clone().normalize().negate()).intersectObject(mesh).length;
    };
    expect(hit([7,0])).toBeGreaterThan(0);
    expect(hit([0,0])).toBe(0);
    expect(hit([25,0])).toBe(0);
    for (let i=0;i<positions.length;i+=9) {
      const centre = [0,1,2].map(axis => (positions[i+axis]! + positions[i+axis+3]! + positions[i+axis+6]!) / 3);
      expect(Math.hypot(...centre)).toBeGreaterThan(1);
    }
    geometry.dispose(); mesh.material.dispose();
  });
  it('accepte les contours inversés et refuse les polygones non pris en charge', () => {
    expect(sphericalPolygonVertices([[...outer].reverse(),[...hole].reverse()]).length).toBeGreaterThan(0);
    expect(sphericalPolygonVertices([[[170,0],[-170,0],[-170,10],[170,0]]])).toEqual([]);
    expect(sphericalPolygonVertices([[[0,90],[10,80],[0,80],[0,90]]])).toEqual([]);
  });
});
