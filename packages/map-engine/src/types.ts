import type { World } from '@alarmap/map-model';

export type ViewMode = 'plane' | 'globe';
export interface RendererAdapter {
  init(host: HTMLElement): Promise<void>;
  setWorld(world: World): void;
  exportPng(): Promise<Blob>;
  reset(): void;
  destroy(): void;
}
