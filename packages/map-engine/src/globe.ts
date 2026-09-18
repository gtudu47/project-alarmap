import { globeScaleDenominator, pixelsPerDegreeAtScale } from './scale.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Coordinate, World } from '@alarmap/map-model';
import type { RendererAdapter } from './types.js';
import { normalizeLongitude, toSphere } from './geography.js';

export class GlobeRenderer implements RendererAdapter {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private readonly objects = new THREE.Group();
  private observer?: ResizeObserver;
  private readonly events = new AbortController();
  private zoomListener: (level: number) => void = () => {};
  private radiusKm = 6371;
  private host!: HTMLElement;
  private scaleListener: (denominator: number) => void = () => {};
  private fitDistance = Math.hypot(0.6, 3.3);

  async init(host: HTMLElement, onSelect: (id: string | null) => void): Promise<void> {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor('#101f2c');
    host.append(this.renderer.domElement);
    this.camera.position.set(0, 0.6, 3.3);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false; this.controls.minDistance = 1.2; this.controls.maxDistance = 8;
    this.controls.addEventListener('change', this.render);
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.MeshBasicMaterial({ color: '#142b3b' }));
    this.scene.add(sphere, this.objects);
    let press: { x: number; y: number; id: number; moved: boolean } | undefined;
    const options = { signal: this.events.signal };
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', event => {
      if (event.button === 0) press = { x: event.clientX, y: event.clientY, id: event.pointerId, moved: false };
    }, options);
    canvas.addEventListener('pointermove', event => {
      if (press?.id === event.pointerId) press.moved ||= Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5;
    }, options);
    canvas.addEventListener('pointerup', event => {
      const click = press; press = undefined;
      if (!click || click.id !== event.pointerId || click.moved) return;
      const rect = canvas.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), this.camera);
      const candidates = [sphere, ...this.objects.children.filter(child => child instanceof THREE.Mesh && child.userData['id'])];
      const hit = ray.intersectObjects(candidates, false)[0];
      onSelect(typeof hit?.object.userData['id'] === 'string' ? hit.object.userData['id'] : null);
    }, options);
    canvas.addEventListener('pointercancel', () => { press = undefined; }, options);
    for (let longitude = -180; longitude < 180; longitude += 30) {
      this.scene.add(this.line(Array.from({ length: 181 }, (_, index) => [longitude, index - 90] as Coordinate), '#365261', 1));
    }
    for (let latitude = -60; latitude <= 60; latitude += 30) {
      this.scene.add(this.line(Array.from({ length: 361 }, (_, index) => [index - 180, latitude] as Coordinate), latitude === 0 ? '#66818a' : '#365261', 1));
    }
    this.observer = new ResizeObserver(() => {
      if (!host.clientWidth || !host.clientHeight) return;
      const width = host.clientWidth; const height = host.clientHeight;
      this.renderer.setSize(width, height); this.camera.aspect = width / height;
      const halfVertical = this.camera.fov * Math.PI / 360;
      const halfHorizontal = Math.atan(Math.tan(halfVertical) * this.camera.aspect);
      const nextFit = 1.12 / Math.sin(Math.min(halfVertical, halfHorizontal));
      this.camera.position.multiplyScalar(nextFit / this.fitDistance);
      this.fitDistance = nextFit;
      this.controls.maxDistance = Math.max(8, nextFit * 2);
      this.camera.updateProjectionMatrix(); this.controls.update(); this.render();
    });
    this.observer.observe(host);
    this.render();
  }
  private line(coordinates: Coordinate[], color: string, opacity: number): THREE.Line {
    return new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(coordinates.map((point) => new THREE.Vector3(...toSphere(point, 1.003)))),
      new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }),
    );
  }
  onZoom(listener: (level: number) => void): void { this.zoomListener = listener; this.render(); }
  setZoom(level: number): void {
    const magnification = 10 ** (-6 + 14 * level / 100);
    const distance = this.camera.position.distanceTo(this.controls.target);
    this.camera.zoom = magnification * (distance - 1) / (this.controls.maxDistance - 1);
    this.camera.updateProjectionMatrix();
    this.controls.update(); this.render();
  }
  onScale(listener: (denominator: number) => void): void { this.scaleListener = listener; this.render(); }
  setScale(denominator: number): void {
    pixelsPerDegreeAtScale(this.radiusKm, denominator);
    if (!this.host.clientHeight) return;
    const distance = this.camera.position.distanceTo(this.controls.target);
    const base = globeScaleDenominator(this.radiusKm, distance, this.camera.fov, this.host.clientHeight, 1);
    this.camera.zoom = Math.max(1e-6, Math.min(1e12, base / denominator));
    this.camera.updateProjectionMatrix(); this.render();
  }
  setWorld(world: World): void {
    this.radiusKm = world.radiusKm;
    for (const child of [...this.objects.children]) { this.disposeObject(child); this.objects.remove(child); }
    for (const object of world.objects) {
      const layer = world.layers.find((layer) => layer.id === object.layerId);
      if (!layer?.visible) continue;
      const opacity = layer.opacity * object.style.opacity;
      if (opacity === 0) continue;
      if (object.geometry.type === 'Point') {
        const marker = new THREE.Mesh(new THREE.SphereGeometry(0.015, 12, 8), new THREE.MeshBasicMaterial({ color: object.style.color, transparent: opacity < 1, opacity }));
        marker.userData['id'] = object.id;
        marker.position.set(...toSphere(object.geometry.coordinates, 1.008)); this.objects.add(marker);
      } else if (object.geometry.type === 'LineString') {
        const dense: Coordinate[] = [];
        for (let index = 1; index < object.geometry.coordinates.length; index++) {
          const a = object.geometry.coordinates[index - 1]!; const b = object.geometry.coordinates[index]!;
          const delta = normalizeLongitude(b[0] - a[0]);
          const steps = Math.max(1, Math.ceil(Math.max(Math.abs(delta), Math.abs(b[1] - a[1]))));
          for (let step = 0; step <= steps; step++) dense.push([normalizeLongitude(a[0] + delta * step / steps), a[1] + (b[1] - a[1]) * step / steps]);
        }
        this.objects.add(this.line(dense, object.style.color, opacity));
      }
    }
    this.render();
  }
  async exportPng(): Promise<Blob> {
    this.render();
    return new Promise((resolve, reject) => this.renderer.domElement.toBlob(blob => blob ? resolve(blob) : reject(new Error('Export PNG impossible.')), 'image/png'));
  }
  focus(coordinate: Coordinate): void {
    this.camera.zoom = 1; this.camera.updateProjectionMatrix();
    this.camera.position.set(...toSphere(coordinate, this.fitDistance));
    this.controls.target.set(0, 0, 0); this.controls.update(); this.render();
  }
  reset(): void { this.camera.zoom = 1; this.camera.updateProjectionMatrix(); this.camera.position.set(0, 0.6, 3.3).normalize().multiplyScalar(this.fitDistance); this.controls.target.set(0, 0, 0); this.controls.update(); this.render(); }
  private readonly render = (): void => {
    const distance = this.camera.position.distanceTo(this.controls.target);
    const magnification = this.camera.zoom * (this.controls.maxDistance - 1) / (distance - 1);
    this.zoomListener(Math.max(0, Math.min(100, 100 * (Math.log10(magnification) + 6) / 14)));
    if (this.host.clientHeight) this.scaleListener(globeScaleDenominator(this.radiusKm, distance, this.camera.fov, this.host.clientHeight, this.camera.zoom));
    for (const object of this.objects.children) {
      if (object instanceof THREE.Mesh) {
        const depth = object.position.clone().applyMatrix4(this.camera.matrixWorldInverse).z;
        const size = Math.max(1e-12, -depth * 2 * Math.tan(this.camera.fov * Math.PI / 360) / (Math.max(1,this.host.clientHeight) * this.camera.zoom) * 5);
        object.scale.setScalar(size / 0.015);
      }
    }
    this.renderer.render(this.scene, this.camera);
  };
  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) material.dispose();
      }
    });
  }
  destroy(): void { this.events.abort(); this.observer?.disconnect(); this.controls.dispose(); this.disposeObject(this.scene); this.renderer.dispose(); this.renderer.domElement.remove(); }
}
