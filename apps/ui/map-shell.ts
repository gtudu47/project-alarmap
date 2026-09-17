import { AfterViewInit, Component, ElementRef, InjectionToken, OnDestroy, ViewChild, effect, inject, signal } from '@angular/core';
import { MapEngine, PointHistory, type PointChange, type ViewMode } from '@alarmap/map-engine';
import { createDemoWorld, worldSchema, type MapObject } from '@alarmap/map-model';
import { WorkspacePages, pageText, type WorkspacePage } from './workspace-pages';
import { AccountPanel } from './account-panel';
import { AccountsClient, type WorldAccess } from './accounts.client';
import { fr } from '@alarmap/shared';

export const APP_MODE = new InjectionToken<'editor' | 'viewer'>('APP_MODE');

@Component({
  selector: 'alarmap-root',
  standalone: true,
  imports: [AccountPanel, WorkspacePages],
  template: `
    <header class="topbar">
      <a class="brand" href="/" aria-label="AlarMap accueil"><span class="brand-mark" aria-hidden="true">A</span>{{ text.brand }}</a>
      <span class="divider"></span><span class="workspace-title">{{ mode === 'editor' ? text.editor : text.viewer }}</span>
      @if (mode === 'editor') { <button type="button" class="account-secondary top-account" (click)="accountOpen.set(true)">{{ accounts.user()?.displayName ?? 'Mon espace' }}</button> }
      <span class="version">v0.1 · {{ text.demo }}</span>
    </header>
    @if (mode === 'editor') { <nav class="workspace-nav" aria-label="Navigation principale">@for (item of pages; track item) { <a [href]="'?page=' + item" [attr.aria-current]="page() === item ? 'page' : null" (click)="navigate(item, $event)">{{ labels[item] }}</a> }</nav> }
    @if (mode === 'editor' && page() !== 'carte') { <alarmap-workspace-page [world]="world" [personal]="personal()" [page]="page()" (navigate)="navigate($event)" (account)="accountOpen.set(true)" (locate)="locateObject($event)" /> }
    <main [hidden]="page() !== 'carte'">
      <aside class="sidebar">
        <div class="eyebrow">{{ personal() ? 'Mon monde privé' : text.demo }}</div>
        <h1>{{ world.name }}</h1>
        <p class="intro">{{ text.tagline }}</p>
        <div class="world-card"><span class="mini-globe" aria-hidden="true">◎</span><div><strong>{{ text.radius }}</strong><span>{{ world.radiusKm }} km</span></div></div>
        <section class="layer-section" aria-labelledby="layers-heading">
          <h2 id="layers-heading">{{ text.layers }} <span>{{ world.layers.length }}</span></h2>
          @for (layer of world.layers; track layer.id) {
            <label class="layer-row"><input type="checkbox" [checked]="layerIsVisible(layer.id)" (change)="toggleLayer(layer.id)"><span class="layer-dot"></span>{{ layer.name }} {{ layer.locked ? '🔒' : '' }}</label>
            @if (personal() && role !== 'viewer') {
              <details class="layer-settings"><summary>Réglages de {{ layer.name }}</summary>
                <form class="point-form" (submit)="saveLayer($event, layer.id)">
                  <label>Nom du calque<input name="name" [value]="layer.name" required maxlength="120"></label>
                  <label>Opacité (%)<input name="opacity" type="number" min="0" max="100" step="1" [value]="layer.opacity * 100" required></label>
                  <label class="layer-lock"><input name="locked" type="checkbox" [checked]="layer.locked">Verrouiller les objets</label>
                  <button class="account-primary" [disabled]="pointBusy()">Enregistrer le calque</button>
                </form>
                @if (layerDeleteConfirm() === layer.id) {
                  <p>Supprimer ce calque vide ?</p><button class="account-secondary" [disabled]="pointBusy()" (click)="deleteLayer(layer.id)">Confirmer</button><button class="account-link" (click)="layerDeleteConfirm.set(null)">Annuler</button>
                } @else { <button class="account-link" [disabled]="pointBusy() || layer.locked || world.layers.length < 2 || layerHasObjects(layer.id)" (click)="layerDeleteConfirm.set(layer.id)">Supprimer ce calque vide</button> }
              </details>
            }
          }
          @if (personal() && role !== 'viewer') { <form class="point-form" (submit)="createLayer($event)"><label>Nouveau calque<input name="name" required maxlength="120"></label><button class="account-secondary" [disabled]="pointBusy()">Créer le calque</button></form> }
        </section>
        @if (personal() && role !== 'viewer') {
          <div class="history-actions" aria-label="Historique des lieux">
            <button class="account-secondary" [disabled]="pointBusy() || !historyState().undo" (click)="applyHistory('undo')">Annuler l’action</button>
            <button class="account-secondary" [disabled]="pointBusy() || !historyState().redo" (click)="applyHistory('redo')">Rétablir l’action</button>
          </div>
          <form class="point-form" (submit)="addPoint($event)">
            <h2>Ajouter un lieu</h2>
            <label>Calque du lieu<select name="layerId" required>@for (layer of world.layers; track layer.id) { @if (!layer.locked) { <option [value]="layer.id">{{ layer.name }}</option> } }</select></label>
            <label>Nom du lieu<input name="name" required maxlength="200"></label>
            <label>Longitude<input name="longitude" type="number" required min="-180" max="180" step="any" value="0"></label>
            <label>Latitude<input name="latitude" type="number" required min="-90" max="90" step="any" value="0"></label>
            <button class="account-primary" [disabled]="pointBusy()" type="submit">Enregistrer le lieu</button>
            <button class="account-link" [disabled]="pointBusy()" type="button" (click)="reloadWorld()">Recharger le monde</button>
            @if (pointMessage()) { <p role="status">{{ pointMessage() }}</p> }
          </form>
        }
        @if (selectedObject(); as object) { <section class="selected-place" aria-label="Lieu sélectionné"><h2>{{ object.name }}</h2><p>Lieu sélectionné.</p>
          @if (personal() && role !== 'viewer' && object.geometry.type === 'Point') {
            <form class="point-form" (submit)="updatePoint($event)">
              <label>Nom du lieu sélectionné<input name="name" [value]="object.name" required maxlength="200"></label>
              <label>Longitude du lieu<input name="longitude" type="number" [value]="object.geometry.coordinates[0]" required min="-180" max="180" step="any"></label>
              <label>Latitude du lieu<input name="latitude" type="number" [value]="object.geometry.coordinates[1]" required min="-90" max="90" step="any"></label>
              <button class="account-primary" [disabled]="pointBusy()">Enregistrer les modifications</button>
            </form>
            @if (deleteConfirm() === object.id) {
              <p>Supprimer définitivement ce lieu ?</p>
              <button class="account-secondary" [disabled]="pointBusy()" (click)="deletePoint()">Confirmer la suppression</button>
              <button class="account-link" [disabled]="pointBusy()" (click)="deleteConfirm.set(null)">Annuler</button>
            } @else { <button class="account-link" [disabled]="pointBusy()" (click)="deleteConfirm.set(object.id)">Supprimer le lieu</button> }
          }
<button class="account-link" (click)="selectedId.set(null)">Fermer la fiche</button></section> }
        <div class="status" [class.ready]="apiStatus() === 'ready'" role="status"><span class="status-dot"></span>{{ apiLabel() }}</div>
        <p class="scope-note">{{ personal() ? 'Monde enregistré dans votre espace personnel.' : text.sample }}</p>
      </aside>
      <section class="map-panel" aria-label="Carte interactive">
        <div class="map-toolbar">
          <div class="segmented" aria-label="Représentation">
            <button type="button" [class.active]="view() === 'plane'" [attr.aria-pressed]="view() === 'plane'" [disabled]="loading()" (click)="setView('plane')">{{ text.plane }}</button>
            <button type="button" [class.active]="view() === 'globe'" [attr.aria-pressed]="view() === 'globe'" [disabled]="loading()" (click)="setView('globe')">{{ text.globe }}</button>
          </div>
          <button class="reset" type="button" (click)="exportPng()" [disabled]="loading() || exporting()">{{ exporting() ? 'Export…' : 'Exporter PNG' }}</button>
          <button class="reset" type="button" (click)="reset()" [disabled]="loading()">{{ text.reset }}</button>
        </div>
        @if (exportMessage()) { <p class="export-message" role="status">{{ exportMessage() }}</p> }
        <div #mapHost class="map-host" data-testid="map-host"></div>
        @if (loading()) { <div class="map-message" role="status">{{ text.loading }}</div> }
        @if (error()) { <div class="map-message error" role="alert">{{ text.unavailable }}</div> }
        <div class="map-footer"><span>{{ text.help }}</span><span>{{ view() === 'plane' ? 'Équirectangulaire · longitude / latitude' : 'Sphère · rayon personnalisé' }}</span></div>
      </section>
    </main>
    @if (mode === 'editor') { <alarmap-account-panel [visible]="accountOpen()" (closed)="accountOpen.set(false)" (worldOpened)="openWorld($event)"></alarmap-account-panel> }
  `,
})
export class MapShell implements AfterViewInit, OnDestroy {
  @ViewChild('mapHost', { static: true }) private host!: ElementRef<HTMLElement>;
  readonly mode = inject(APP_MODE);
  readonly pages = ['accueil', 'carte', 'atlas', 'guide'] as const;
  readonly labels = pageText;
  readonly page = signal<WorkspacePage>(this.readPage());
  private readPage(): WorkspacePage {
    const value = new URLSearchParams(location.search).get('page');
    return this.mode === 'editor' && (value === 'accueil' || value === 'atlas' || value === 'guide') ? value : 'carte';
  }
  private readonly onPopState = () => { this.page.set(this.readPage()); };
  navigate(page: WorkspacePage, event?: Event): void {
    if (event instanceof MouseEvent && (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) return;
    event?.preventDefault();
    this.page.set(page);
    const url = new URL(location.href); url.searchParams.set('page', page);
    history.pushState(null, '', url);
    requestAnimationFrame(() => { document.querySelector<HTMLElement>('#page-title')?.focus(); window.dispatchEvent(new Event('resize')); });
  }
  readonly text = fr;
  world = createDemoWorld();
  readonly accounts = inject(AccountsClient);
  readonly accountOpen = signal(location.hash.startsWith('#invite=') || location.hash.startsWith('#setup='));
  readonly personal = signal(false);
  readonly layerDeleteConfirm = signal<string | null>(null);
  layerHasObjects(id: string): boolean { return this.world.objects.some(object => object.layerId === id); }
  async createLayer(event: Event): Promise<void> {
    event.preventDefault(); const form = event.target as HTMLFormElement;
    if (await this.changeLayer('POST', '', { name: new FormData(form).get('name') })) form.reset();
  }
  async saveLayer(event: Event, id: string): Promise<void> {
    event.preventDefault(); const fields = new FormData(event.target as HTMLFormElement);
    await this.changeLayer('PATCH', id, { name: fields.get('name'), opacity: Number(fields.get('opacity')) / 100, locked: fields.has('locked') });
  }
  async deleteLayer(id: string): Promise<void> { if (this.layerDeleteConfirm() === id) await this.changeLayer('DELETE', id, {}); }
  private async changeLayer(method: string, id: string, data: Record<string, unknown>): Promise<boolean> {
    if (this.pointBusy() || !this.personal() || this.role === 'viewer') return false;
    const worldId = this.world.id; this.pointBusy.set(true); this.pointMessage.set('');
    try {
      const access = await this.accounts.request<WorldAccess>('/worlds/' + worldId + '/layers' + (id ? '/' + id : ''), { method, body: JSON.stringify({ ...data, revision: this.world.revision }) });
      if (!this.personal() || this.world.id !== worldId || !this.accounts.user()) return false;
      this.world = worldSchema.parse(access.world); this.syncScene(); this.clearHistory(); this.layerDeleteConfirm.set(null);
      this.pointMessage.set('Calques enregistrés. Historique des lieux réinitialisé.'); return true;
    } catch (error) { this.pointMessage.set(error instanceof Error ? error.message : 'Modification du calque impossible.'); return false; }
    finally { this.pointBusy.set(false); }
  }
  private readonly history = new PointHistory();
  readonly historyState = signal({ undo: false, redo: false });
  private refreshHistory(): void { this.historyState.set({ undo: this.history.canUndo, redo: this.history.canRedo }); }
  private clearHistory(): void { this.history.clear(); this.refreshHistory(); }
  private recordHistory(change: PointChange): void { this.history.record(change); this.refreshHistory(); }
  async applyHistory(direction: 'undo' | 'redo'): Promise<void> {
    if (this.pointBusy() || !this.personal() || this.role === 'viewer') return;
    const change = this.history.peek(direction); if (!change) return;
    const target = direction === 'undo' ? change.before : change.after;
    const pointId = (change.before ?? change.after)!.id; const worldId = this.world.id; const previousRevision = this.world.revision;
    this.pointBusy.set(true); this.pointMessage.set('');
    try {
      const result = await this.accounts.request<WorldAccess>('/worlds/' + worldId + '/points/' + pointId, { method: target ? 'PUT' : 'DELETE', body: JSON.stringify({ revision: this.world.revision, ...(target ? { point: target } : {}) }) });
      if (this.personal() && this.world.id === worldId && this.accounts.user()) {
        this.world = worldSchema.parse(result.world); this.syncScene(); this.deleteConfirm.set(null);
        if (this.world.revision === previousRevision + 1) { this.history.accept(direction); this.refreshHistory(); } else this.clearHistory();
        if (!target && this.selectedId() === pointId) this.selectedId.set(null);
        this.pointMessage.set(direction === 'undo' ? 'Action annulée.' : 'Action rétablie.');
      }
    } catch (error) { this.pointMessage.set(error instanceof Error ? error.message : 'Action impossible.'); }
    finally { this.pointBusy.set(false); }
  }
  readonly selectedId = signal<string | null>(null);
  readonly deleteConfirm = signal<string | null>(null);
  selectedObject(): MapObject | undefined { return this.world.objects.find(object => object.id === this.selectedId()); }
  locateObject(id: string): void {
    const object = this.world.objects.find(item => item.id === id);
    if (!object || object.geometry.type !== 'Point') return;
    this.deleteConfirm.set(null); this.selectedId.set(id);
    this.layerVisibility.update(values => ({ ...values, [object.layerId]: true }));
    this.engine?.setLayerVisible(object.layerId, true);
    this.navigate('carte');
    const coordinate = object.geometry.coordinates;
    requestAnimationFrame(() => { if (this.selectedId() === id) this.engine?.focus(coordinate); });
  }
  readonly pointBusy = signal(false);
  readonly pointMessage = signal('');
  role: WorldAccess['role'] = 'viewer';
  constructor() {
    window.addEventListener('popstate', this.onPopState);
    effect(() => {
      if (this.personal() && !this.accounts.user()) {
        this.clearHistory(); this.selectedId.set(null); this.personal.set(false); this.world = createDemoWorld(); this.layerVisibility.set({});
        this.syncScene(); this.pointMessage.set('');
      }
    });
  }
  openWorld(access: WorldAccess): void {
    if (!this.accounts.user()) return;
    this.clearHistory(); this.selectedId.set(null); this.world = worldSchema.parse(access.world); this.role = access.role;
    this.navigate('carte'); this.personal.set(true); this.layerVisibility.set({});
    this.syncScene(); this.engine?.reset(); this.accountOpen.set(false); this.pointMessage.set('');
  }
  async reloadWorld(): Promise<void> {
    this.pointBusy.set(true);
    try { this.openWorld(await this.accounts.request<WorldAccess>('/worlds/' + this.world.id)); }
    catch (error) { this.pointMessage.set(error instanceof Error ? error.message : 'Rechargement impossible.'); }
    finally { this.pointBusy.set(false); }
  }
  async addPoint(event: Event): Promise<void> {
    event.preventDefault(); if (this.pointBusy()) return;
    const form = event.target as HTMLFormElement; const fields = new FormData(form); const worldId = this.world.id; const previousRevision = this.world.revision;
    const existingIds = new Set(this.world.objects.map(object => object.id));
    this.pointBusy.set(true); this.pointMessage.set('');
    try {
      const result = await this.accounts.request<WorldAccess>('/worlds/' + worldId + '/points', { method: 'POST', body: JSON.stringify({ name: fields.get('name'), longitude: Number(fields.get('longitude')), latitude: Number(fields.get('latitude')), revision: this.world.revision, layerId: fields.get('layerId') }) });
      if (this.personal() && this.world.id === worldId && this.accounts.user()) { this.world = worldSchema.parse(result.world); this.syncScene(); const added = this.world.objects.filter(object => !existingIds.has(object.id)); if (added.length === 1 && this.world.revision === previousRevision + 1) this.recordHistory({ before: null, after: added[0]! }); else this.clearHistory(); form.reset(); this.pointMessage.set('Lieu enregistré.'); }
    } catch (error) { this.pointMessage.set(error instanceof Error ? error.message : 'Enregistrement impossible.'); }
    finally { this.pointBusy.set(false); }
  }
  async updatePoint(event: Event): Promise<void> {
    event.preventDefault(); const fields = new FormData(event.target as HTMLFormElement);
    await this.changePoint({ name: fields.get('name'), longitude: Number(fields.get('longitude')), latitude: Number(fields.get('latitude')) });
  }
  async deletePoint(): Promise<void> {
    if (this.deleteConfirm() !== this.selectedId()) return;
    await this.changePoint();
  }
  private async changePoint(update?: { name: FormDataEntryValue | null; longitude: number; latitude: number }): Promise<void> {
    const id = this.selectedId(); const worldId = this.world.id; const previousRevision = this.world.revision;
    const before = this.world.objects.find(object => object.id === id);
    if (!id || !this.personal() || this.role === 'viewer' || this.pointBusy()) return;
    this.pointBusy.set(true); this.pointMessage.set('');
    try {
      const result = await this.accounts.request<WorldAccess>('/worlds/' + worldId + '/points/' + id, { method: update ? 'PATCH' : 'DELETE', body: JSON.stringify({ ...update, revision: this.world.revision }) });
      if (this.personal() && this.world.id === worldId && this.accounts.user()) {
        this.world = worldSchema.parse(result.world); this.syncScene(); this.deleteConfirm.set(null);
        if (before && this.world.revision === previousRevision + 1) this.recordHistory({ before, after: this.world.objects.find(object => object.id === id) ?? null }); else this.clearHistory();
        if (!update) { if (this.selectedId() === id) this.selectedId.set(null); this.pointMessage.set('Lieu supprimé.'); }
        else { this.pointMessage.set('Lieu modifié.'); if (this.selectedId() === id) this.engine?.focus([update.longitude, update.latitude]); }
      }
    } catch (error) { this.pointMessage.set(error instanceof Error ? error.message : 'Modification impossible.'); }
    finally { this.pointBusy.set(false); }
  }
  readonly view = signal<ViewMode>('plane');
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly layerVisibility = signal<Record<string, boolean>>({});
  readonly exporting = signal(false);
  readonly exportMessage = signal('');
  readonly apiStatus = signal<'checking' | 'ready' | 'unavailable'>('checking');
  private engine?: MapEngine;
  private readonly abort = new AbortController();
  async ngAfterViewInit(): Promise<void> {
    this.engine = new MapEngine(this.host.nativeElement, id => { this.selectedId.set(id); this.deleteConfirm.set(null); });
    this.engine.loadWorld(this.world);
    void this.checkApi();
    await this.setView('plane');
  }
  async setView(mode: ViewMode): Promise<void> {
    this.loading.set(true); this.error.set(false);
    try { await this.engine?.setView(mode); this.view.set(mode); }
    catch { this.error.set(true); }
    finally { this.loading.set(false); }
  }
  private syncScene(): void {
    this.engine?.loadWorld({ ...this.world, layers: this.world.layers.map(layer => ({ ...layer, visible: this.layerIsVisible(layer.id) })) });
  }
  reset(): void { this.engine?.reset(); }
  layerIsVisible(id: string): boolean { return this.layerVisibility()[id] ?? this.world.layers.find(layer => layer.id === id)?.visible ?? false; }
  toggleLayer(id: string): void {
    const visible = !this.layerIsVisible(id);
    this.layerVisibility.update(values => ({ ...values, [id]: visible }));
    this.engine?.setLayerVisible(id, visible);
  }
  async exportPng(): Promise<void> {
    if (!this.engine || this.exporting()) return;
    this.exporting.set(true); this.exportMessage.set('');
    try {
      const blob = await this.engine.exportPng();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url;
      link.download = this.world.slug + '-' + this.view() + '.png';
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.exportMessage.set('Image PNG prête à télécharger.');
    } catch { this.exportMessage.set('L’export a échoué. Réessayez après le chargement de la carte.'); }
    finally { this.exporting.set(false); }
  }
  apiLabel(): string { return this.apiStatus() === 'ready' ? fr.apiReady : this.apiStatus() === 'checking' ? fr.apiChecking : fr.apiUnavailable; }
  private async checkApi(): Promise<void> {
    try {
      const response = await fetch('/api/v1/health/ready', { signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(5000)]) });
      const result: unknown = await response.json();
      this.apiStatus.set(response.ok && typeof result === 'object' && result !== null && 'status' in result && result.status === 'ok' ? 'ready' : 'unavailable');
    } catch { if (!this.abort.signal.aborted) this.apiStatus.set('unavailable'); }
  }
  ngOnDestroy(): void { window.removeEventListener('popstate', this.onPopState); this.abort.abort(); this.engine?.destroy(); }
}
