import { worldSchema, type World } from '@alarmap/map-model';
import type { RendererAdapter, ViewMode } from './types.js';
export * from './geography.js';
export type { ViewMode, RendererAdapter } from './types.js';

/** Façade commune aux applications. Les adaptateurs graphiques sont chargés à la demande. */
export class MapEngine {
  private renderer?: RendererAdapter;
  private world?: World;
  private generation = 0;
  private disposed = false;
  constructor(private readonly host: HTMLElement) {}
  loadWorld(world: World): void { this.world = worldSchema.parse(world); this.renderer?.setWorld(this.world); }
  async setView(mode: ViewMode): Promise<void> {
    if (this.disposed) throw new Error('Moteur détruit.');
    const generation = ++this.generation;
    const renderer = mode === 'plane' ? new (await import('./plane.js')).PlaneRenderer() : new (await import('./globe.js')).GlobeRenderer();
    if (generation !== this.generation) return;
    this.renderer?.destroy(); this.renderer = undefined;
    await renderer.init(this.host);
    if (generation !== this.generation || this.disposed) { renderer.destroy(); return; }
    this.renderer = renderer;
    if (this.world) renderer.setWorld(this.world);
  }
  setLayerVisible(id: string, visible: boolean): void {
    if (!this.world) return;
    this.world = { ...this.world, layers: this.world.layers.map((layer) => layer.id === id ? { ...layer, visible } : layer) };
    this.renderer?.setWorld(this.world);
  }
  async exportPng(): Promise<Blob> {
    if (this.disposed || !this.renderer) throw new Error('Aucune vue disponible pour l’export.');
    return this.renderer.exportPng();
  }
  reset(): void { this.renderer?.reset(); }
  destroy(): void { this.disposed = true; ++this.generation; this.renderer?.destroy(); this.renderer = undefined; }
}
