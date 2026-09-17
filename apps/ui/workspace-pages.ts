import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import type { World } from '@alarmap/map-model';

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
        <div class="atlas-filters"><label>{{ text.search }}<input type="search" [value]="query()" (input)="query.set($any($event.target).value)" placeholder="Nom d’un lieu ou d’un tracé"></label><label>Géométrie<select [value]="geometry()" (change)="geometry.set($any($event.target).value)"><option value="">Toutes les géométries</option><option value="Point">Points</option><option value="LineString">Lignes</option><option value="Polygon">Polygones</option><option value="MultiPolygon">Multipolygones</option></select></label></div>
        <p class="result-count" role="status">{{ objects().length }} résultat(s) sur {{ world.objects.length }}</p>
        <ul class="atlas-list">@for (object of objects(); track object.id) { <li><span class="object-symbol" [style.color]="object.style.color" aria-hidden="true">{{ object.geometry.type === 'Point' ? '●' : '⌁' }}</span><div><h2>{{ object.name || text.unnamed }}</h2><p>{{ geometryName(object.geometry.type) }} · {{ layerName(object.layerId) }}</p>@if (object.geometry.type === 'Point') { <p>Longitude {{ object.geometry.coordinates[0] }}° · Latitude {{ object.geometry.coordinates[1] }}°</p><button class="account-secondary" (click)="locate.emit(object.id)" [attr.aria-label]="'Localiser ' + object.name">Localiser sur la carte →</button> }</div></li> } @empty { <li class="empty-atlas">{{ text.empty }}</li> }</ul>
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
export class WorkspacePages {
  @Input({ required: true }) world!: World;
  @Input() personal = false;
  @Input() page: WorkspacePage = 'accueil';
  @Output() readonly navigate = new EventEmitter<WorkspacePage>();
  @Output() readonly locate = new EventEmitter<string>();
  @Output() readonly account = new EventEmitter<void>();
  readonly text = pageText;
  readonly query = signal('');
  readonly geometry = signal('');
  objects() {
    const query = this.query().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
    return this.world.objects.filter(object => (!this.geometry() || object.geometry.type === this.geometry()) && object.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').includes(query));
  }
  layerName(id: string): string { return this.world.layers.find(layer => layer.id === id)?.name ?? ''; }
  geometryName(type: string): string { return ({ Point: 'Point', LineString: 'Ligne', Polygon: 'Polygone', MultiPolygon: 'Multipolygone' } as Record<string, string>)[type] ?? type; }
}
