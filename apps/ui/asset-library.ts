import { Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import type { MemberRole } from '@alarmap/map-model';
import { AccountsClient } from './accounts.client';

interface Asset { id: string; name: string; byteSize: number; width: number; height: number }
interface AssetData extends Asset { data: string }

@Component({
  selector: 'alarmap-asset-library', standalone: true,
  template: `
    <details #panel class="tile-settings" (toggle)="toggle($event)"><summary>Images du monde</summary>
      <p>Bibliothèque privée de ce monde. Les images ne sont pas encore placées sur la carte ni publiées.</p>
      @if (role !== 'viewer') {
        <form #uploadForm class="point-form" (submit)="upload($event)">
          <label>Nom de l’image<input name="name" required maxlength="120"></label>
          <label>Fichier PNG<input name="file" type="file" accept="image/png,.png" required></label>
          <p>PNG uniquement · 4 Mio maximum · 100 images par monde.</p>
          <button class="account-secondary" [disabled]="busy()">Importer l’image</button>
        </form>
      }
      @if (message()) { <p role="status">{{ message() }}</p> }
      @if (loaded() && !assets().length) { <p>Aucune image dans ce monde.</p> }
      <ul class="invitation-list">@for (asset of assets(); track asset.id) {
        <li><strong>{{ asset.name }}</strong> · {{ asset.width }} × {{ asset.height }} px
          <button type="button" class="account-link" [disabled]="busy()" (click)="show(asset)">Afficher</button>
          @if (role !== 'viewer') {
            @if (confirmDelete() === asset.id) {
              <span>Supprimer cette image ?</span><button type="button" class="account-secondary" [disabled]="busy()" (click)="remove(asset)">Confirmer la suppression</button><button type="button" class="account-link" [disabled]="busy()" (click)="confirmDelete.set(null)">Annuler</button>
            } @else { <button type="button" class="account-link" [disabled]="busy()" [attr.aria-label]="'Supprimer l’image ' + asset.name" (click)="confirmDelete.set(asset.id)">Supprimer</button> }
          }
        </li>
      }</ul>
      @if (preview(); as image) {
        <figure><img [src]="'data:image/png;base64,' + image.data" [alt]="image.name" style="max-width:100%;height:auto"><figcaption>{{ image.name }}</figcaption></figure>
        <button type="button" class="account-link" (click)="preview.set(null)">Fermer l’image</button>
      }
    </details>
  `,
})
export class AssetLibrary implements OnChanges, OnDestroy {
  @Input({ required: true }) worldId = '';
  @Input({ required: true }) role: MemberRole = 'viewer';
  @ViewChild('panel') private panel?: ElementRef<HTMLDetailsElement>;
  @ViewChild('uploadForm') private uploadForm?: ElementRef<HTMLFormElement>;
  private readonly accounts = inject(AccountsClient);
  private generation = 0;
  readonly assets = signal<Asset[]>([]);
  readonly preview = signal<AssetData | null>(null);
  readonly confirmDelete = signal<string | null>(null);
  readonly loaded = signal(false);
  readonly busy = signal(false);
  readonly message = signal('');
  ngOnChanges(): void {
    const generation = ++this.generation; this.uploadForm?.nativeElement.reset(); this.assets.set([]); this.preview.set(null); this.confirmDelete.set(null); this.loaded.set(false); this.busy.set(false); this.message.set('');
    queueMicrotask(() => { if (generation === this.generation && this.panel?.nativeElement.open) void this.load(); });
  }
  ngOnDestroy(): void { this.generation++; }
  toggle(event: Event): void {
    if ((event.target as HTMLDetailsElement).open && !this.loaded()) void this.load();
  }
  async load(): Promise<void> {
    if (this.busy() || !this.worldId) return;
    const generation = this.generation; const worldId = this.worldId; this.busy.set(true); this.message.set('');
    try {
      const assets = await this.accounts.request<Asset[]>('/worlds/' + worldId + '/assets');
      if (generation === this.generation) { this.assets.set(assets); this.loaded.set(true); }
    } catch (error) { if (generation === this.generation) this.message.set(error instanceof Error ? error.message : 'Chargement impossible.'); }
    finally { if (generation === this.generation) this.busy.set(false); }
  }
  async upload(event: Event): Promise<void> {
    event.preventDefault(); if (this.busy() || this.role === 'viewer') return;
    const form = event.target as HTMLFormElement; const fields = new FormData(form); const file = fields.get('file');
    if (!(file instanceof File) || !file.size || file.size > 4 * 1024 * 1024) { this.message.set('Choisissez une image PNG de 4 Mio maximum.'); return; }
    const generation = this.generation; const worldId = this.worldId; this.busy.set(true); this.message.set('');
    try {
      const encoded = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result.split(',')[1] ?? '') : reject(new Error('Lecture du fichier impossible.'));
        reader.readAsDataURL(file);
      });
      if (generation !== this.generation) return;
      const asset = await this.accounts.request<Asset>('/worlds/' + worldId + '/assets', { method: 'POST', body: JSON.stringify({ name: String(fields.get('name') ?? '').trim(), data: encoded }) });
      if (generation === this.generation) { this.assets.update(items => [...items, asset]); this.loaded.set(true); form.reset(); this.message.set('Image importée dans ce monde.'); }
    } catch (error) { if (generation === this.generation) this.message.set(error instanceof Error ? error.message : 'Import impossible.'); }
    finally { if (generation === this.generation) this.busy.set(false); }
  }
  async remove(asset: Asset): Promise<void> {
    if (this.busy() || this.role === 'viewer' || this.confirmDelete() !== asset.id) return;
    const generation = this.generation; const worldId = this.worldId; this.busy.set(true); this.message.set('');
    try {
      await this.accounts.request<void>('/worlds/' + worldId + '/assets/' + asset.id, { method: 'DELETE' });
      if (generation === this.generation) {
        this.assets.update(items => items.filter(item => item.id !== asset.id));
        if (this.preview()?.id === asset.id) this.preview.set(null);
        this.confirmDelete.set(null); this.message.set('Image retirée de ce monde.');
      }
    } catch (error) { if (generation === this.generation) this.message.set(error instanceof Error ? error.message : 'Suppression impossible.'); }
    finally { if (generation === this.generation) this.busy.set(false); }
  }
  async show(asset: Asset): Promise<void> {
    if (this.busy()) return;
    const generation = this.generation; const worldId = this.worldId; this.busy.set(true); this.message.set(''); this.preview.set(null);
    try {
      const result = await this.accounts.request<AssetData>('/worlds/' + worldId + '/assets/' + asset.id);
      if (generation === this.generation) this.preview.set(result);
    } catch (error) { if (generation === this.generation) this.message.set(error instanceof Error ? error.message : 'Image indisponible.'); }
    finally { if (generation === this.generation) this.busy.set(false); }
  }
}
