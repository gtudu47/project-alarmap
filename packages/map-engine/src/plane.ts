import { pixelsPerDegreeAtScale } from './scale.js';
import { DEFAULT_GRID, visibleGrid, type GridOptions, type GridStats, type GridView } from './grid.js';
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { Coordinate, World } from '@alarmap/map-model';
import type { RendererAdapter } from './types.js';
import { splitAntimeridian } from './geography.js';

export class PlaneRenderer implements RendererAdapter {
  private readonly app = new Application();
  private readonly scene = new Container();
  private host!: HTMLElement;
  private observer?: ResizeObserver;
  private world?: World;
  private zoom = 1;
  private zoomListener: (level: number) => void = () => {};
  private draft: Coordinate[] = [];
  private draftGraphic?: Graphics;
  private gridOptions = { ...DEFAULT_GRID };
  private gridGraphics?: Graphics;
  private gridListener: (stats: GridStats, view: GridView) => void = () => {};
  private points: Graphics[] = [];
  private offset = { x: 0, y: 0 };
  private drag?: { x: number; y: number; startX: number; startY: number; moved: boolean; id: number };
  private readonly events = new AbortController();

  async init(host: HTMLElement, onSelect: (id: string | null) => void, onCoordinate?: (coordinate: Coordinate) => boolean): Promise<void> {
    this.host = host;
    await this.app.init({ preference: 'webgl', background: '#101f2c', antialias: true, resolution: Math.min(devicePixelRatio, 2), autoDensity: true, resizeTo: host });
    host.append(this.app.canvas);
    this.app.stage.addChild(this.scene);
    const options = { signal: this.events.signal };
    this.app.canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      this.drag = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, id: event.pointerId };
      this.app.canvas.setPointerCapture(event.pointerId);
    }, options);
    this.app.canvas.addEventListener('pointermove', (event) => {
      if (!this.drag || this.drag.id !== event.pointerId) return;
      this.drag.moved ||= Math.hypot(event.clientX - this.drag.startX, event.clientY - this.drag.startY) > 5;
      this.offset.x += event.clientX - this.drag.x;
      this.offset.y += event.clientY - this.drag.y;
      this.drag.x = event.clientX; this.drag.y = event.clientY; this.transform();
    }, options);
    this.app.canvas.addEventListener('pointerup', event => {
      if (!this.drag || this.drag.id !== event.pointerId || this.drag.moved) return;
      const bounds = this.app.canvas.getBoundingClientRect();
      const x = event.clientX - bounds.left; const y = event.clientY - bounds.top;
      const longitude = (x - this.scene.x) / this.scene.scale.x;
      const latitude = (this.scene.y - y) / this.scene.scale.y;
      if (longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90 && onCoordinate?.([longitude, latitude])) return;
      let nearest: string | null = null; let distance = 10;
      for (const layer of [...(this.world?.layers ?? [])].sort((a, b) => a.order - b.order)) {
        if (!layer.visible || layer.opacity === 0) continue;
        for (const object of this.world?.objects ?? []) {
          if (object.layerId !== layer.id || object.geometry.type !== 'Point' || object.style.opacity === 0) continue;
          const [longitude, latitude] = object.geometry.coordinates;
          const delta = Math.hypot(x - (this.scene.x + longitude * this.scene.scale.x), y - (this.scene.y - latitude * this.scene.scale.y));
          if (delta <= distance) { distance = delta; nearest = object.id; }
        }
      }
      onSelect(nearest);
    }, options);
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) this.app.canvas.addEventListener(event, () => { this.drag = undefined; }, options);
    this.app.canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      const bounds = this.app.canvas.getBoundingClientRect();
      const x = event.clientX - bounds.left - host.clientWidth / 2;
      const y = event.clientY - bounds.top - host.clientHeight / 2;
      const next = Math.min(1e7, Math.max(0.5, this.zoom * Math.exp(-event.deltaY * 0.001)));
      const ratio = next / this.zoom;
      this.offset = { x: x - (x - this.offset.x) * ratio, y: y - (y - this.offset.y) * ratio };
      this.zoom = next; this.transform();
    }, { ...options, passive: false });
    this.observer = new ResizeObserver(() => this.transform());
    this.observer.observe(host);
    this.transform();
  }

  onZoom(listener: (level: number) => void): void { this.zoomListener = listener; this.transform(); }
  setZoom(level: number): void {
    const next = 0.5 * (1e7 / 0.5) ** (level / 100);
    const ratio = next / this.zoom;
    this.offset.x *= ratio; this.offset.y *= ratio; this.zoom = next; this.transform();
  }
  setDraftLine(points: Coordinate[]): void { this.draft = points; this.transform(); }
  setWorld(world: World): void { this.world = world; this.draw(); this.transform(); }
  setGrid(options: GridOptions, onChange: (stats: GridStats, view: GridView) => void): void {
    this.gridOptions = options; this.gridListener = onChange; this.transform();
  }
  zoomToGrid(): void {
    if (!this.world) return;
    const base = Math.min(this.host.clientWidth / 400, this.host.clientHeight / 220);
    if (base <= 0) return;
    const next = Math.min(1e7, Math.max(0.5, 80 * this.world.radiusKm * Math.PI / 180 / Math.min(this.gridOptions.widthKm,this.gridOptions.heightKm) / base));
    const ratio = next / this.zoom; this.offset.x *= ratio; this.offset.y *= ratio; this.zoom = next; this.transform();
  }
  setScale(denominator: number): void {
    if (!this.world) return;
    const base = Math.min(this.host.clientWidth / 400, this.host.clientHeight / 220);
    if (base <= 0) return;
    const next = Math.min(1e7, Math.max(0.5, pixelsPerDegreeAtScale(this.world.radiusKm, denominator) / base));
    const ratio = next / this.zoom;
    this.offset.x *= ratio; this.offset.y *= ratio; this.zoom = next; this.transform();
  }
  async exportPng(): Promise<Blob> {
    this.app.renderer.render(this.app.stage);
    return new Promise((resolve, reject) => this.app.canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Export PNG impossible.')), 'image/png'));
  }
  focus([longitude, latitude]: Coordinate): void {
    this.zoom = Math.max(this.zoom, 2);
    const scale = Math.min(this.host.clientWidth / 400, this.host.clientHeight / 220) * this.zoom;
    this.offset = { x: -longitude * scale, y: latitude * scale }; this.transform();
  }
  reset(): void { this.zoom = 1; this.offset = { x: 0, y: 0 }; this.transform(); }
  private transform(): void {
    const scale = Math.min(this.host.clientWidth / 400, this.host.clientHeight / 220) * this.zoom;
    if (scale <= 0) return;
    this.zoomListener(100 * Math.log(this.zoom / 0.5) / Math.log(1e7 / 0.5));
    this.draftGraphic?.clear();
    if (this.draftGraphic) {
      for (const segment of splitAntimeridian(this.draft)) {
        segment.forEach(([x,y],i) => i === 0 ? this.draftGraphic!.moveTo(x,-y) : this.draftGraphic!.lineTo(x,-y));
        this.draftGraphic.stroke({ color: '#f0ca7b', pixelLine: true });
      }
      for (const [x,y] of this.draft) this.draftGraphic.circle(x,-y,4/scale).fill('#f0ca7b');
    }
    this.scene.scale.set(scale);
    this.scene.position.set(this.host.clientWidth / 2 + this.offset.x, this.host.clientHeight / 2 + this.offset.y);
    for (const point of this.points) { point.scale.set(1 / scale); for (const child of point.children) child.visible = scale > 50; }
    if (this.world && this.gridGraphics) {
      const view: GridView = { west: -this.scene.x / scale, east: (this.host.clientWidth - this.scene.x) / scale, north: this.scene.y / scale, south: (this.scene.y - this.host.clientHeight) / scale, pixelsPerDegree: scale };
      const { lines, stats } = visibleGrid(this.gridOptions, this.world.radiusKm, view);
      this.gridGraphics.clear();
      for (const line of lines) this.gridGraphics.moveTo(line.from[0],-line.from[1]).lineTo(line.to[0],-line.to[1]);
      this.gridGraphics.stroke({ color: '#628b8c', width: 1 / scale, alpha: 0.7 });
      this.gridListener(stats, view);
    }
  }
  private draw(): void {
    for (const child of this.scene.removeChildren()) child.destroy({ children: true });
    this.points = [];
    this.draftGraphic = undefined;
    const grid = new Graphics();
    grid.rect(-180, -90, 360, 180).fill('#142b3b');
    for (let longitude = -180; longitude <= 180; longitude += 30) grid.moveTo(longitude, -90).lineTo(longitude, 90);
    for (let latitude = -90; latitude <= 90; latitude += 30) grid.moveTo(-180, latitude).lineTo(180, latitude);
    grid.stroke({ color: '#365261', pixelLine: true });
    grid.moveTo(-180, 0).lineTo(180, 0).moveTo(0, -90).lineTo(0, 90).stroke({ color: '#66818a', pixelLine: true });
    this.scene.addChild(grid);
    this.gridGraphics = new Graphics(); this.scene.addChild(this.gridGraphics);
    this.draftGraphic = new Graphics(); this.scene.addChild(this.draftGraphic);
    if (!this.world) return;
    for (const layer of [...this.world.layers].sort((a, b) => a.order - b.order)) {
      if (!layer.visible) continue;
      for (const object of this.world.objects.filter((object) => object.layerId === layer.id)) {
        const graphics = new Graphics();
        graphics.alpha = layer.opacity * object.style.opacity;
        if (object.geometry.type === 'Point') {
          const [longitude, latitude] = object.geometry.coordinates;
          graphics.position.set(longitude, -latitude); graphics.circle(0, 0, 5).fill(object.style.color); this.points.push(graphics);
          const label = new Text({ text: object.name, style: { fill: '#e9eddf', fontSize: 12, fontFamily: 'sans-serif' } });
          label.position.set(9,-8); graphics.addChild(label);
        } else if (object.geometry.type === 'LineString') {
          for (const segment of splitAntimeridian(object.geometry.coordinates)) {
            segment.forEach(([longitude, latitude], index) => index === 0 ? graphics.moveTo(longitude, -latitude) : graphics.lineTo(longitude, -latitude));
            graphics.stroke({ color: object.style.color, pixelLine: true });
          }
        }
        this.scene.addChild(graphics);
      }
    }
  }
  destroy(): void {
    this.events.abort(); this.observer?.disconnect();
    this.app.destroy(true, { children: true });
  }
}
