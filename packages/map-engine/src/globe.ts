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
  private fitDistance = Math.hypot(0.6, 3.3);

  async init(host: HTMLElement): Promise<void> {
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
  setWorld(world: World): void {
    for (const child of [...this.objects.children]) { this.disposeObject(child); this.objects.remove(child); }
    for (const object of world.objects) {
      const layer = world.layers.find((layer) => layer.id === object.layerId);
      if (!layer?.visible) continue;
      const opacity = layer.opacity * object.style.opacity;
      if (object.geometry.type === 'Point') {
        const marker = new THREE.Mesh(new THREE.SphereGeometry(0.015, 12, 8), new THREE.MeshBasicMaterial({ color: object.style.color, transparent: opacity < 1, opacity }));
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
    this.camera.position.set(...toSphere(coordinate, this.fitDistance));
    this.controls.target.set(0, 0, 0); this.controls.update(); this.render();
  }
  reset(): void { this.camera.position.set(0, 0.6, 3.3).normalize().multiplyScalar(this.fitDistance); this.controls.target.set(0, 0, 0); this.controls.update(); this.render(); }
  private readonly render = (): void => { this.renderer.render(this.scene, this.camera); };
  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        for (const material of Array.isArray(child.material) ? child.material : [child.material]) material.dispose();
      }
    });
  }
  destroy(): void { this.observer?.disconnect(); this.controls.dispose(); this.disposeObject(this.scene); this.renderer.dispose(); this.renderer.domElement.remove(); }
}
