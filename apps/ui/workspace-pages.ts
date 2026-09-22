import { Component, EventEmitter, Input, Output, signal, inject, OnChanges, OnDestroy } from '@angular/core';
import { objectSchema, type MapObject, type World } from '@alarmap/map-model';

import { AccountsClient } from './accounts.client';

export type WorkspacePage = 'carte' | 'accueil' | 'atlas' | 'guide';
export const pageText = {
  accueil: 'Accueil', carte: 'Carte', atlas: 'Atlas', guide: 'Guide',
  welcome: 'Un monde à imaginer. Un atlas à construire.',
  introduction: 'Explorez une même planète sur une carte plane et un globe, puis créez votre propre univers dans votre espace personnel.',
  open: 'Explorer la carte', account: 'Accéder à mon espace',
  catalog: 'Les repères de votre monde', search: 'Rechercher un objet',
  empty: 'Aucun objet ne correspond à votre recherche.', unnamed: 'Sans nom',
  guideTitle: 'Vos premiers pas dans AlarMap',
  steps: [
    { title: 'Explorer la planète', body: 'Dans Carte, glissez pour déplacer la vue et utilisez la molette pour zoomer. Passez au globe 3D pour observer la même scène sur une sphère. Recentrer rétablit la vue initiale.' },
    { title: 'Créer votre espace', body: 'Demandez une invitation à l’administrateur. Ouvrez le lien reçu et choisissez votre nom et votre mot de passe. Vous pourrez ensuite vous connecter depuis Mon espace.' },
    { title: 'Commencer un monde', body: 'Dans Mon espace, donnez un nom et un rayon à votre planète. Ouvrez votre monde, puis ajoutez un lieu en indiquant son nom, sa longitude et sa latitude. Les lieux enregistrés apparaissent dans les deux vues.' },
    { title: 'Retrouver vos repères', body: 'L’Atlas répertorie les objets du monde actuellement ouvert. Recherchez un nom et filtrez par géométrie. Les calques de la carte permettent de masquer temporairement leurs objets.' },
  ],
} as const;

@Component({
  selector: 'alarmap-workspace-page', standalone: true,
  template: `
    <section class="workspace-page" aria-labelledby="page-title">
      @if (page === 'accueil') {
        <div class="page-eyebrow">ALARMAP · ATELIER DES MONDES</div>
        <h1 id="page-title" tabindex="-1">{{ text.welcome }}</h1>
        <p class="page-lead">{{ text.introduction }}</p>
        <div class="page-actions"><button class="account-primary" (click)="navigate.emit('carte')">{{ text.open }} →</button><button class="account-secondary" (click)="account.emit()">{{ text.account }}</button></div>
        <div class="world-overview"><div><span class="page-eyebrow">MONDE OUVERT</span><h2>{{ world.name }}</h2><p>{{ personal ? 'Votre espace personnel' : 'Une scène de démonstration pour découvrir les outils' }}</p></div><div class="planet-illustration" aria-hidden="true">◎</div></div>
        <dl class="world-metrics"><div><dt>Rayon planétaire</dt><dd>{{ world.radiusKm }} <small>km</small></dd></div><div><dt>Objets</dt><dd>{{ world.objects.length }}</dd></div><div><dt>Calques</dt><dd>{{ world.layers.length }}</dd></div></dl>
        <div class="page-cards"><button class="page-card" (click)="navigate.emit('atlas')"><span>01 · CONSULTER</span><h2>Parcourir l’Atlas</h2><p>Retrouvez les lieux et les tracés de votre monde.</p><b aria-hidden="true">→</b></button><button class="page-card" (click)="navigate.emit('guide')"><span>02 · APPRENDRE</span><h2>Prendre ses repères</h2><p>Découvrez la carte, les comptes et la création de lieux.</p><b aria-hidden="true">→</b></button></div>
      } @else if (page === 'atlas') {
        <div class="page-eyebrow">{{ world.name }}</div><h1 id="page-title" tabindex="-1">{{ text.catalog }}</h1><p class="page-lead">Le catalogue des objets du monde actuellement ouvert.</p>
        <div class="atlas-filters"><label>{{ text.search }}<input type="search" [value]="query()" (input)="query.set($any($event.target).value); filterChanged()" placeholder="Nom d’un lieu ou d’un tracé"></label><label>Géométrie<select [value]="geometry()" (change)="geometry.set($any($event.target).value); filterChanged()"><option value="">Toutes les géométries</option><option value="Point">Points</option><option value="LineString">Lignes</option><option value="Polygon">Polygones</option><option value="MultiPolygon">Multipolygones</option></select></label></div>
        <p class="result-count" role="status">{{ remote ? atlasMessage() : objects().length + ' résultat(s) sur ' + world.objects.length }}</p>
        @if (remote) { <div class="page-actions"><button class="account-secondary" [disabled]="atlasBusy() || cursors.length < 2" (click)="previousPage()">Page précédente</button><button class="account-secondary" [disabled]="atlasBusy() || !nextCursor()" (click)="nextPage()">Page suivante</button><button class="account-link" [disabled]="atlasBusy()" (click)="restartAtlas()">Actualiser la recherche</button></div> }
        <ul class="atlas-list">@for (object of objects(); track object.id) { <li><span class="object-symbol" [style.color]="object.style.color" aria-hidden="true">{{ object.geometry.type === 'Point' ? '●' : '⌁' }}</span><div><h2>{{ object.name || text.unnamed }}</h2><p>{{ geometryName(object.geometry.type) }} · {{ layerName(object.layerId) }}</p>@if (object.geometry.type === 'Point') { <p>Longitude {{ object.geometry.coordinates[0] }}° · Latitude {{ object.geometry.coordinates[1] }}°</p><button class="account-secondary" (click)="locate.emit(object)" [attr.aria-label]="'Localiser ' + object.name">Localiser sur la carte →</button> }</div></li> } @empty { <li class="empty-atlas">{{ text.empty }}</li> }</ul>
        <button class="account-secondary" (click)="navigate.emit('carte')">Retour à la carte</button>
      } @else {
        <div class="page-eyebrow">GUIDE DE PRISE EN MAIN</div><h1 id="page-title" tabindex="-1">{{ text.guideTitle }}</h1>
        <div class="guide-steps">@for (step of text.steps; track step.title; let index = $index) { <article><span class="step-number">0{{ index + 1 }}</span><div><h2>{{ step.title }}</h2><p>{{ step.body }}</p></div></article> }</div>
        <aside class="page-note"><h2>Ce qui est disponible aujourd’hui</h2><p>Carte plane, globe, comptes sur invitation, création de mondes privés et ajout de lieux. Les comptes et la sauvegarde nécessitent un serveur disponible. La publication, le dessin de territoires et la chronologie sont encore en développement.</p></aside>
        <button class="account-primary" (click)="navigate.emit('carte')">Ouvrir la carte →</button>
      }
    </section>
  `,
})
export class WorkspacePages implements OnChanges, OnDestroy {
  @Input({ required: true }) world!: World;
  @Input() personal = false;
  @Input() remote = false;
  @Input() page: WorkspacePage = 'accueil';
  @Output() readonly navigate = new EventEmitter<WorkspacePage>();
  @Output() readonly locate = new EventEmitter<MapObject>();
  @Output() readonly account = new EventEmitter<void>();
  readonly text = pageText;
  readonly query = signal('');
  readonly geometry = signal('');
  private readonly accounts = inject(AccountsClient);
  readonly atlasObjects = signal<MapObject[]>([]);
  readonly atlasMessage = signal('Chargement…');
  readonly atlasBusy = signal(false);
  readonly nextCursor = signal<string | null>(null);
  cursors: (string | null)[] = [null];
  private atlasRevision?: number;
  private atlasKey = '';
  private timer?: ReturnType<typeof setTimeout>;
  private abort?: AbortController;
  private requestId = 0;
  ngOnChanges(): void {
    const key = this.world.id + ':' + this.world.revision + ':' + this.page + ':' + this.remote;
    if (key !== this.atlasKey) { this.atlasKey = key; this.restartAtlas(); }
  }
  ngOnDestroy(): void { clearTimeout(this.timer); this.abort?.abort(); ++this.requestId; }
  filterChanged(): void {
    if (!this.remote) return;
    clearTimeout(this.timer); this.abort?.abort(); ++this.requestId;
    this.atlasObjects.set([]); this.nextCursor.set(null); this.atlasBusy.set(true); this.atlasMessage.set('Recherche…');
    this.timer = setTimeout(()=>this.restartAtlas(),250);
  }
  restartAtlas(): void { this.cursors=[null]; this.atlasRevision=undefined; void this.loadAtlas(); }
  nextPage(): void { if (this.nextCursor()) { this.cursors.push(this.nextCursor()); void this.loadAtlas(); } }
  previousPage(): void { if(this.cursors.length>1) { this.cursors.pop(); void this.loadAtlas(); } }
  private async loadAtlas(): Promise<void> {
    if (!this.remote || this.page !== 'atlas') return;
    this.abort?.abort(); const abort = new AbortController(); this.abort=abort; const request=++this.requestId;
    this.atlasBusy.set(true); this.atlasObjects.set([]); this.nextCursor.set(null); this.atlasMessage.set('Chargement…');
    try {
      const query = new URLSearchParams({q:this.query(),limit:'50'});
      if(this.geometry()) query.set('geometry',this.geometry());
      const cursor=this.cursors.at(-1); if(cursor) query.set('cursor',cursor);
      if(this.atlasRevision!==undefined) query.set('revision',String(this.atlasRevision));
      const result=await this.accounts.request<{revision:number;objects:MapObject[];nextCursor:string|null}>('/worlds/'+this.world.id+'/atlas?'+query,{signal:abort.signal});
      if(request!==this.requestId) return;
      const objects=result.objects.map(object=>objectSchema.parse(object));
      this.atlasRevision=result.revision; this.atlasObjects.set(objects); this.nextCursor.set(result.nextCursor);
      this.atlasMessage.set('Page '+this.cursors.length+' · '+objects.length+' résultat(s)');
    } catch(error) { if(request===this.requestId && !abort.signal.aborted) this.atlasMessage.set(error instanceof Error ? error.message : 'Recherche indisponible.'); }
    finally { if(request===this.requestId) this.atlasBusy.set(false); }
  }
  objects() {
    if(this.remote) return this.atlasObjects();
    const query = this.query().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
    return this.world.objects.filter(object => (!this.geometry() || object.geometry.type === this.geometry()) && object.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').includes(query));
  }
  layerName(id: string): string { return this.world.layers.find(layer => layer.id === id)?.name ?? ''; }
  geometryName(type: string): string { return ({ Point: 'Point', LineString: 'Ligne', Polygon: 'Polygone', MultiPolygon: 'Multipolygone' } as Record<string, string>)[type] ?? type; }
}
