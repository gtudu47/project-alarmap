import type { Coordinate, World } from '@alarmap/map-model';

export type ViewMode = 'plane' | 'globe';
export interface RendererAdapter {
  init(host: HTMLElement, onSelect: (id: string | null) => void): Promise<void>;
  setWorld(world: World): void;
  exportPng(): Promise<Blob>;
  focus(coordinate: Coordinate): void;
  reset(): void;
  destroy(): void;
}
