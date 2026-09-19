import { DEFAULT_GRID, validateGrid, type GridOptions, type GridStats, type GridView } from './grid.js';
import { coordinateSchema, objectSchema, worldSchema, type MapObject, type Coordinate, type World } from '@alarmap/map-model';
import type { RendererAdapter, ViewMode } from './types.js';
export * from './geography.js';
export type { ViewMode, RendererAdapter } from './types.js';

/** Façade commune aux applications. Les adaptateurs graphiques sont chargés à la demande. */
export class MapEngine {
  private renderer?: RendererAdapter;
  private world?: World;
  private focusCoordinate?: Coordinate;
  private grid = { ...DEFAULT_GRID };
  private gridListener: (stats: GridStats, view: GridView, regions?: GridView[]) => void = () => {};
  private zoomListener: (level: number) => void = () => {};
  private coordinateListener: (coordinate: Coordinate) => boolean = () => false;
  onCoordinate(listener: (coordinate: Coordinate) => boolean): void { this.coordinateListener = listener; }
  private scaleListener: (denominator: number) => void = () => {};
  onScale(listener: (denominator: number) => void): void { this.scaleListener = listener; this.renderer?.onScale?.(listener); }
  private generation = 0;
  private disposed = false;
  constructor(private readonly host: HTMLElement, private readonly onSelect: (id: string | null) => void = () => {}) {}
  loadWorld(world: World): void { if (this.world?.id !== world.id) this.focusCoordinate = undefined; this.world = worldSchema.parse(world); this.renderer?.setWorld(this.world); }
  async setView(mode: ViewMode): Promise<void> {
    if (this.disposed) throw new Error('Moteur détruit.');
    const generation = ++this.generation;
    const renderer: RendererAdapter = mode === 'plane' ? new (await import('./plane.js')).PlaneRenderer() : new (await import('./globe.js')).GlobeRenderer();
    if (generation !== this.generation) return;
    this.renderer?.destroy(); this.renderer = undefined;
    await renderer.init(this.host, id => {
      if (generation !== this.generation || this.disposed) return;
      const object = this.world?.objects.find(object => object.id === id);
      this.onSelect(object && this.world?.layers.some(layer => layer.id === object.layerId && layer.visible) ? object.id : null);
    }, coordinate => generation === this.generation && !this.disposed ? this.coordinateListener(coordinate) : false);
    if (generation !== this.generation || this.disposed) { renderer.destroy(); return; }
    this.renderer = renderer;
    renderer.onZoom(this.zoomListener);
    renderer.onScale?.(this.scaleListener);
    if (this.world) renderer.setWorld(this.world);
    if (this.focusCoordinate) renderer.focus(this.focusCoordinate);
    renderer.setGrid?.(this.grid, this.gridListener);
  }
  setVisibleObjects(objects: MapObject[]): void {
    if (this.world) this.renderer?.setWorld({ ...this.world, objects: objects.map(object => objectSchema.parse(object)) });
  }
  setLayerVisible(id: string, visible: boolean): void {
    if (!this.world) return;
    this.world = { ...this.world, layers: this.world.layers.map((layer) => layer.id === id ? { ...layer, visible } : layer) };
    this.renderer?.setWorld(this.world);
  }
  setGrid(options: GridOptions, onChange: (stats: GridStats, view: GridView, regions?: GridView[]) => void): void {
    this.grid = validateGrid(options); this.gridListener = onChange;
    this.renderer?.setGrid?.(this.grid, this.gridListener);
  }
  onZoom(listener: (level: number) => void): void { this.zoomListener = listener; this.renderer?.onZoom(listener); }
  setZoom(level: number): void {
    if (!Number.isFinite(level)) return;
    this.renderer?.setZoom(Math.max(0, Math.min(100, level)));
  }
  setDraftLine(points: Coordinate[]): void { this.renderer?.setDraftLine?.(points); }
  setScale(denominator: number): void { this.renderer?.setScale?.(denominator); }
  zoomToGrid(): void { this.renderer?.zoomToGrid?.(); }
  async exportPng(): Promise<Blob> {
    if (this.disposed || !this.renderer) throw new Error('Aucune vue disponible pour l’export.');
    return this.renderer.exportPng();
  }
  focus(coordinate: Coordinate): void { this.focusCoordinate = coordinateSchema.parse(coordinate); this.renderer?.focus(this.focusCoordinate); }
  reset(): void { this.focusCoordinate = undefined; this.renderer?.reset(); }
  destroy(): void { this.disposed = true; ++this.generation; this.renderer?.destroy(); this.renderer = undefined; }
}

export { PointHistory, type PointChange } from './history.js';

export * from './grid.js';

export * from './scale.js';
