import type { GridOptions, GridStats, GridView } from './grid.js';
import type { Coordinate, World } from '@alarmap/map-model';

export type ViewMode = 'plane' | 'globe';
export interface RendererAdapter {
  init(host: HTMLElement, onSelect: (id: string | null) => void, onCoordinate?: (coordinate: Coordinate) => boolean): Promise<void>;
  setWorld(world: World): void;
  setZoom(level: number): void;
  onZoom(listener: (level: number) => void): void;
  setGrid?(options: GridOptions, onChange: (stats: GridStats, view: GridView) => void): void;
  zoomToGrid?(): void;
  setScale?(denominator: number): void;
  exportPng(): Promise<Blob>;
  focus(coordinate: Coordinate): void;
  reset(): void;
  destroy(): void;
}
