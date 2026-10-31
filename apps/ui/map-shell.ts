import { AfterViewInit, Component, ElementRef, InjectionToken, OnDestroy, ViewChild, effect, inject, signal } from '@angular/core';
import { MapEngine, scaleDenominator, PointHistory, type PointChange, DEFAULT_GRID, type GridOptions, type GridStats, type GridView, type ViewMode } from '@alarmap/map-engine';
import { createDemoWorld, worldSchema, worldBackupSchema, lineObjectSchema, areaObjectSchema, type Coordinate, type MapObject } from '@alarmap/map-model';
import { WorkspacePages, pageText, type WorkspacePage } from './workspace-pages';
import { AccountPanel } from './account-panel';
import { PublicCatalog } from './public-catalog';
import { AccountsClient, type WorldAccess } from './accounts.client';
import { fr } from '@alarmap/shared';

export const APP_MODE = new InjectionToken<'editor' | 'viewer'>('APP_MODE');

@Component({
  selector: 'alarmap-root',
  standalone: true,
  imports: [AccountPanel, WorkspacePages, PublicCatalog],
  template: `
    <header class="topbar">
      <a class="brand" href="/" aria-label="AlarMap accueil"><span class="brand-mark" aria-hidden="true">A</span>{{ text.brand }}</a>
      <span class="divider"></span><span class="workspace-title">{{ mode === 'editor' ? text.editor : text.viewer }}</span>
      @if (mode === 'editor') { <button type="button" class="account-secondary top-account" (click)="accountOpen.set(true)">{{ accounts.user()?.displayName ?? 'Mon espace' }}</button> }
      <span class="version">v0.1 · {{ publicStatus() === 'ready' ? 'Publication' : text.demo }}</span>
    </header>
    @if (mode === 'editor') { <nav class="workspace-nav" aria-label="Navigation principale">@for (item of pages; track item) { <a [href]="'?page=' + item" [attr.aria-current]="page() === item ? 'page' : null" (click)="navigate(item, $event)">{{ labels[item] }}</a> } <a href="/viewer/?catalogue=1">Cartes publiques</a></nav> }
    @if (mode === 'editor' && page() !== 'carte') { <alarmap-workspace-page [world]="world" [objectCount]="objectCount()" [personal]="personal()" [remote]="personal() && objectsPartial()" [page]="page()" (navigate)="navigate($event)" (account)="accountOpen.set(true)" (locate)="locateObject($event)" /> }
    @if (publicCatalog) { <alarmap-public-catalog /> }
    @if (publicStatus() === 'loading') { <p role="status">Chargement de la carte publiée…</p> }
    @if (publicStatus() === 'error') { <p role="alert">Cette carte publiée est introuvable ou indisponible.</p> }
    <main [hidden]="page() !== 'carte' || publicCatalog || publicStatus() === 'loading' || publicStatus() === 'error'">
      <aside class="sidebar">
        <div class="eyebrow">{{ personal() ? 'Mon monde privé' : publicStatus() === 'ready' ? 'Carte publiée' : text.demo }}</div>
        <h1>{{ world.name }}</h1>
        <p class="intro">{{ text.tagline }}</p>
        @if (mode === 'viewer') { <a class="catalog-link" href="/viewer/?catalogue=1">Cartes publiques</a> }
        <div class="world-card"><span class="mini-globe" aria-hidden="true">◎</span><div><strong>{{ text.radius }}</strong><span>{{ world.radiusKm }} km</span></div></div>
        @if (personal() && role === 'owner') {
          <details class="tile-settings"><summary>Publier cette carte</summary>
            <p>La publication rend accessibles le nom, la géométrie, les styles et les dates des objets des calques choisis. Les propriétés internes ne sont pas publiées. Les modifications ultérieures restent en brouillon jusqu’à une nouvelle publication.</p>
            <form class="point-form" (submit)="publishWorld($event)">
              <label>Visibilité<select name="visibility" [value]="world.status === 'public' ? 'public' : 'unlisted'"><option value="unlisted">Lien non répertorié</option><option value="public">Public et répertorié</option></select></label>
              <fieldset><legend>Calques à publier</legend>@for (layer of world.layers; track layer.id) { <label class="layer-lock"><input type="checkbox" name="layerId" [value]="layer.id">{{ layer.name }}</label> }</fieldset>
              <button class="account-primary" [disabled]="pointBusy()">Publier la révision actuelle</button>
            </form>
            @if (publicationUrl()) { <label>Lien de consultation<input readonly [value]="publicationUrl()" aria-label="Lien de consultation"></label><p>Ce lien peut aussi être utilisé dans une iframe. Toute personne qui le possède peut consulter la carte.</p> }
            @if (world.status === 'public' || world.status === 'unlisted') {
              @if (unpublishConfirm()) { <p>Retirer l’accès à cette carte publiée ?</p><button type="button" class="account-secondary" [disabled]="pointBusy()" (click)="unpublishWorld()">Confirmer le retrait de la publication</button><button type="button" class="account-link" (click)="unpublishConfirm.set(false)">Annuler</button> }
              @else { <button type="button" class="account-link" [disabled]="pointBusy()" (click)="unpublishConfirm.set(true)">Retirer la publication</button> }
            }
            @if (publicationMessage()) { <p role="status">{{ publicationMessage() }}</p> }
          </details>
        }
          <details class="tile-settings"><summary>Exporter les données</summary>
            @if (personal()) { <p>Le fichier contient tous les calques et leurs propriétés, y compris les données privées et masquées. Ne le transmettez qu’aux personnes autorisées.</p> }
            @else if (publicStatus() === 'ready') { <p>Le fichier contient uniquement la copie publiée de cette carte.</p> }
            @else { <p>Le fichier contient les données de la scène de démonstration.</p> }
            <p>Les fichiers d’assets ne sont pas inclus. La restauration depuis ce format reste à développer.</p>
            <button class="account-secondary" type="button" [disabled]="loading() || exportingJson()" (click)="exportWorldJson()">{{ exportingJson() ? 'Préparation…' : 'Télécharger le JSON' }}</button>
            @if (exportJsonMessage()) { <p role="status">{{ exportJsonMessage() }}</p> }
          </details>
          <details class="tile-settings"><summary>Échelle cartographique</summary>
            <form class="point-form" (submit)="applyScale($event)">
              <label>Échelle 1:<input name="denominator" type="number" min="100" max="1000000000" step="1" value="25000" list="scale-presets" required></label>
              <datalist id="scale-presets"><option value="10000"></option><option value="25000"></option><option value="50000"></option><option value="100000"></option><option value="1000000"></option></datalist>
              <button class="account-primary" [disabled]="loading()">Appliquer l’échelle</button>
            </form>
            <p>{{ view() === 'plane' ? 'Échelle nominale nord-sud. La projection déforme les distances est-ouest hors de l’équateur.' : 'Échelle locale au centre du globe. Elle varie vers les bords et ne vaut pas pour toute la sphère.' }} Calcul à 96 pixels CSS par pouce ; la taille physique à l’écran dépend de votre affichage.</p>
            <p>Pour le PNG, imprimer à la largeur indiquée ci-dessous, sans ajustement à la page.</p>
          </details>
          @if (currentScale(); as scale) { <p class="tile-readout" data-testid="scale-readout">Échelle actuelle ≈ 1:{{ formatScale(scale) }} · 1 cm représente {{ formatKm(scale / 100000) }} km ({{ view() === 'plane' ? 'nord-sud' : 'au centre du globe' }}). Largeur d’impression du PNG : {{ formatKm(printWidthCm()) }} cm.</p> }
          <details class="tile-settings"><summary>Détail et tuiles</summary>
            <form class="point-form" (submit)="applyGrid($event)">
              <label>Largeur de tuile (km)<input name="widthKm" type="number" min="0.1" max="10000" step="any" [value]="gridOptions.widthKm" required></label>
              <label>Hauteur de tuile (km)<input name="heightKm" type="number" min="0.1" max="10000" step="any" [value]="gridOptions.heightKm" required></label>
              <label class="layer-lock"><input name="enabled" type="checkbox" [checked]="gridOptions.enabled">Afficher la grille</label>
              <button class="account-secondary">Appliquer les dimensions</button>
              <button class="account-primary" type="button" [disabled]="loading()" (click)="zoomToGrid()">Voir ce niveau de détail</button>
            </form>
            <p>Largeur mesurée au milieu de chaque bande de latitude. Les cases aux limites du monde sont partielles.</p>
          </details>
          @if (gridInfo(); as grid) { <p class="tile-readout" data-testid="tile-readout">Mailles affichées : {{ formatKm(grid.widthKm) }} × {{ formatKm(grid.heightKm) }} km · {{ grid.multiplier === 1 ? 'détail choisi atteint' : 'zoomez pour subdiviser' }}</p> }
          <p class="tile-readout" role="status">{{ tileMessage() }}</p>
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
          @if (view() === 'plane') {
            <details class="tile-settings"><summary>Territoires</summary>
              <form class="point-form" (submit)="saveArea($event)">
                <label>Nom du territoire<input name="name" required maxlength="200"></label>
                <label>Couleur du territoire<input name="color" type="color" value="#9fc78e"></label>
                <label>Calque du territoire<select name="layerId" required>@for (layer of world.layers; track layer.id) { @if (!layer.locked) { <option [value]="layer.id">{{ layer.name }}</option> } }</select></label>
                <button type="button" class="account-secondary" [disabled]="pointBusy() || !!lineEdit() || drawingArea()" (click)="startArea()">Dessiner un territoire</button>
                @if (drawingArea()) {
                  <p role="status">{{ areaPoints().length }} sommet(s). Cliquez sur la carte ; Échap abandonne.</p>
                  <button type="button" class="account-secondary" [disabled]="pointBusy() || !areaPoints().length" (click)="removeAreaVertex()">Retirer le dernier sommet du territoire</button>
                  <button type="button" class="account-link" [disabled]="pointBusy()" (click)="cancelArea()">Abandonner le territoire</button>
                  <button class="account-primary" [disabled]="pointBusy() || areaPoints().length < 3">Enregistrer le territoire</button>@if (areaError()) { <p role="alert">{{ areaError() }}</p> }
                }
              </form>
              <p>Contour simple sans traversée de l’antiméridien ni pôle. Sur le globe, seul le contour est affiché pour le moment.</p>
            </details>
            <details class="tile-settings"><summary>Routes et rivières</summary>
              <form class="point-form" (submit)="saveLine($event)">
                <label>Nom du tracé<input name="name" required maxlength="200"></label>
                <label>Type de tracé<select name="kind"><option value="road">Route</option><option value="river">Rivière</option></select></label>
                <label>Calque du tracé<select name="layerId" required>@for (layer of world.layers; track layer.id) { @if (!layer.locked) { <option [value]="layer.id">{{ layer.name }}</option> } }</select></label>
                <button type="button" class="account-secondary" [disabled]="pointBusy() || !!lineEdit()" (click)="startLine()">Commencer le tracé</button>
                @if (drawingLine()) {
                  <p role="status">{{ linePoints().length }} sommet(s). Cliquez sur la carte ; Échap abandonne.</p>
                  <button type="button" class="account-secondary" [disabled]="pointBusy() || !linePoints().length" (click)="removeLineVertex()">Retirer le dernier sommet</button>
                  <button type="button" class="account-link" [disabled]="pointBusy()" (click)="cancelLine()">Abandonner le tracé</button>
                  <button class="account-primary" [disabled]="pointBusy() || linePoints().length < 2">Enregistrer le tracé</button>
                }
              </form>
            </details>
          }
          <div class="history-actions" aria-label="Historique des lieux">
            <button class="account-secondary" [disabled]="pointBusy() || !historyState().undo" (click)="applyHistory('undo')">Annuler l’action</button>
            <button class="account-secondary" [disabled]="pointBusy() || !historyState().redo" (click)="applyHistory('redo')">Rétablir l’action</button>
          </div>
          <form #pointForm class="point-form" (submit)="addPoint($event)">
            <h2>{{ pointKind() === 'label' ? 'Ajouter un texte' : 'Ajouter un lieu' }}</h2>
            @if (view() === 'plane') {
              <button class="account-secondary" type="button" [attr.aria-pressed]="placingPoint()" [disabled]="pointBusy() || loading() || !!lineEdit()" (click)="cancelLine(); cancelArea(); placingPoint.set(!placingPoint())">{{ placingPoint() ? 'Annuler le placement' : 'Placer sur la carte' }}</button>
              @if (placingPoint()) { <p role="status">Cliquez sur la carte pour choisir les coordonnées, puis enregistrez le lieu. Échap annule.</p> }
            }
            <label>Type de repère<select name="kind" [value]="pointKind()" (change)="pointKind.set($any($event.target).value)"><option value="city">Lieu</option><option value="label">Texte</option></select></label>
            @if (pointKind() === 'label') { <label>Couleur du texte<input name="color" type="color" value="#e6b96c"></label> }
            <label>{{ pointKind() === 'label' ? 'Calque du texte' : 'Calque du lieu' }}<select name="layerId" required>@for (layer of world.layers; track layer.id) { @if (!layer.locked) { <option [value]="layer.id">{{ layer.name }}</option> } }</select></label>
            <label>{{ pointKind() === 'label' ? 'Texte à afficher' : 'Nom du lieu' }}<input name="name" required [attr.maxlength]="pointKind() === 'label' ? 80 : 200"></label>
            <label>Longitude<input name="longitude" type="number" required min="-180" max="180" step="any" value="0"></label>
            <label>Latitude<input name="latitude" type="number" required min="-90" max="90" step="any" value="0"></label>
            <button class="account-primary" [disabled]="pointBusy()" type="submit">{{ pointKind() === 'label' ? 'Enregistrer le texte' : 'Enregistrer le lieu' }}</button>
            <button class="account-link" [disabled]="pointBusy()" type="button" (click)="reloadWorld()">Recharger le monde</button>
            @if (pointMessage()) { <p role="status">{{ pointMessage() }}</p> }
          </form>
        }
        @if (selectedObject(); as object) { <section class="selected-place" [attr.aria-label]="object.geometry.type === 'Point' ? (object.kind === 'label' ? 'Texte sélectionné' : 'Lieu sélectionné') : object.geometry.type === 'Polygon' ? 'Territoire sélectionné' : 'Tracé sélectionné'"><h2>{{ object.name }}</h2><p>{{ object.geometry.type === 'Point' ? (object.kind === 'label' ? 'Texte sélectionné.' : 'Lieu sélectionné.') : object.geometry.type === 'Polygon' ? 'Territoire sélectionné.' : 'Tracé sélectionné.' }}</p>
          @if (personal() && role !== 'viewer' && object.geometry.type === 'Point') {
            <form class="point-form" (submit)="updatePoint($event)">
              <label>{{ object.kind === 'label' ? 'Texte sélectionné' : 'Nom du lieu sélectionné' }}<input name="name" [value]="object.name" required [attr.maxlength]="object.kind === 'label' ? 80 : 200"></label>
              @if (object.kind === 'label') { <label>Couleur du texte sélectionné<input name="color" type="color" [value]="object.style.color"></label> }
              <label>Longitude du lieu<input name="longitude" type="number" [value]="object.geometry.coordinates[0]" required min="-180" max="180" step="any"></label>
              <label>Latitude du lieu<input name="latitude" type="number" [value]="object.geometry.coordinates[1]" required min="-90" max="90" step="any"></label>
              <button class="account-primary" [disabled]="pointBusy()">Enregistrer les modifications</button>
            </form>
            @if (deleteConfirm() === object.id) {
              <p>Supprimer définitivement {{ object.kind === 'label' ? 'ce texte' : 'ce lieu' }} ?</p>
              <button class="account-secondary" [disabled]="pointBusy()" (click)="deletePoint()">Confirmer la suppression</button>
              <button class="account-link" [disabled]="pointBusy()" (click)="deleteConfirm.set(null)">Annuler</button>
            } @else { <button class="account-link" [disabled]="pointBusy()" (click)="deleteConfirm.set(object.id)">{{ object.kind === 'label' ? 'Supprimer le texte' : 'Supprimer le lieu' }}</button> }
          }
          @if (personal() && role !== 'viewer' && object.geometry.type === 'LineString') {
            @if (lineEdit(); as edit) { @if (edit.object.id === object.id) {
              <form class="point-form" (submit)="updateLine($event)">
                <label>Nom du tracé sélectionné<input name="name" [value]="edit.object.name" required maxlength="200"></label>
                <label>Sommets du tracé<textarea #lineCoordinates name="coordinates" rows="6" required [value]="formatLineCoordinates(edit.object)" (input)="syncLineVertices($any($event.target).value)"></textarea></label>
                <p>Un sommet par ligne : longitude, latitude. En vue plane, déplacez les points dorés à la souris. Enregistrez pour appliquer.</p>
                <button class="account-primary" [disabled]="pointBusy()">Enregistrer le tracé modifié</button>
                <button class="account-link" type="button" [disabled]="pointBusy()" (click)="cancelLineEdit()">Annuler la modification</button>
              </form>
            } } @else { <button class="account-secondary" [disabled]="pointBusy()" (click)="beginLineEdit(object)">Modifier le tracé</button> }
            @if (!lineEdit()) {
              @if (deleteConfirm() === object.id) {
                <p>Supprimer ce tracé ? Vous pourrez annuler pendant cette session.</p>
                <button class="account-secondary" [disabled]="pointBusy()" (click)="deleteLine()">Confirmer la suppression du tracé</button>
                <button class="account-link" [disabled]="pointBusy()" (click)="deleteConfirm.set(null)">Annuler la suppression</button>
              } @else { <button class="account-link" [disabled]="pointBusy()" (click)="deleteConfirm.set(object.id)">Supprimer le tracé</button> }
            }
            @if (lineEditError()) { <p role="status">{{ lineEditError() }}</p> }
          }
          @if (personal() && role !== 'viewer' && object.geometry.type === 'Polygon' && object.kind === 'territory') {
            @if (lineEdit(); as edit) { @if (edit.object.id === object.id) {
              <form class="point-form" (submit)="updateArea($event)">
                <label>Nom du territoire sélectionné<input name="name" [value]="edit.object.name" required maxlength="200"></label>
                <label>Couleur du territoire sélectionné<input name="color" type="color" [value]="edit.object.style.color"></label>
                <label>Sommets du territoire<textarea #lineCoordinates name="coordinates" rows="6" required [value]="formatAreaCoordinates(edit.object)" (input)="syncAreaVertices($any($event.target).value)"></textarea></label>
                <label>Trous du territoire<textarea #areaHoles name="holes" rows="5" [value]="formatAreaHoles(edit.object)"></textarea></label>
                @if (view() === 'plane') {
                  @if (drawingHole()) {
                    <p role="status">{{ holePoints().length }} sommet(s) du trou. Cliquez sur la carte ; Échap abandonne le trou.</p>
                    <button class="account-secondary" type="button" [disabled]="!holePoints().length" (click)="removeHoleVertex()">Retirer le dernier sommet du trou</button>
                    <button class="account-link" type="button" (click)="cancelHole()">Abandonner le trou</button>
                    <button class="account-secondary" type="button" [disabled]="holePoints().length < 3" (click)="finishHole()">Terminer le trou</button>
                  } @else { <button class="account-secondary" type="button" [disabled]="pointBusy()" (click)="startHole()">Dessiner un trou</button> }
                }
                <p>Un sommet par ligne : longitude, latitude. Séparez les trous par une ligne vide. Chaque contour se ferme automatiquement. En vue plane, déplacez les points dorés du contour extérieur à la souris.</p>
                <button class="account-primary" [disabled]="pointBusy() || drawingHole()">Enregistrer le territoire modifié</button>
                <button class="account-link" type="button" [disabled]="pointBusy()" (click)="cancelLineEdit()">Annuler la modification</button>
              </form>
            } } @else { <button class="account-secondary" [disabled]="pointBusy()" (click)="beginAreaEdit(object)">Modifier le territoire</button> }
            @if (!lineEdit()) {
              @if (deleteConfirm() === object.id) {
                <p>Supprimer ce territoire ? Vous pourrez annuler pendant cette session.</p>
                <button class="account-secondary" [disabled]="pointBusy()" (click)="deleteArea()">Confirmer la suppression du territoire</button>
                <button class="account-link" [disabled]="pointBusy()" (click)="deleteConfirm.set(null)">Annuler la suppression</button>
              } @else { <button class="account-link" [disabled]="pointBusy()" (click)="deleteConfirm.set(object.id)">Supprimer le territoire</button> }
            }
            @if (lineEditError()) { <p role="status">{{ lineEditError() }}</p> }
          }

<button class="account-link" (click)="cancelLineEdit(); selectedId.set(null)">Fermer la fiche</button></section> }
        <div class="status" [class.ready]="apiStatus() === 'ready'" role="status"><span class="status-dot"></span>{{ apiLabel() }}</div>
        <p class="scope-note">{{ personal() ? 'Monde enregistré dans votre espace personnel.' : publicStatus() === 'ready' ? 'Révision publiée en lecture seule.' : text.sample }}</p>
      </aside>
      <section class="map-panel" aria-label="Carte interactive">
        <div class="map-toolbar">
          <div class="segmented" aria-label="Représentation">
            <button type="button" [class.active]="view() === 'plane'" [attr.aria-pressed]="view() === 'plane'" [disabled]="loading() || drawingHole()" (click)="setView('plane')">{{ text.plane }}</button>
            <button type="button" [class.active]="view() === 'globe'" [attr.aria-pressed]="view() === 'globe'" [disabled]="loading() || drawingHole()" (click)="setView('globe')">{{ text.globe }}</button>
          </div>
          <button class="reset" type="button" (click)="exportPng()" [disabled]="loading() || exporting()">{{ exporting() ? 'Export…' : 'Exporter PNG' }}</button>
          <button class="reset" type="button" (click)="reset()" [disabled]="loading()">{{ text.reset }}</button>
        </div>
        @if (exportMessage()) { <p class="export-message" role="status">{{ exportMessage() }}</p> }
        <div #mapHost [class.placing-point]="placingPoint() || drawingLine() || drawingArea() || drawingHole()" class="map-host" data-testid="map-host"></div>
        @if (loading()) { <div class="map-message" role="status">{{ text.loading }}</div> }
        @if (error()) { <div class="map-message error" role="alert">{{ text.unavailable }}</div> }
        <div class="zoom-control" aria-label="Commande de zoom">
          <span aria-hidden="true">+</span>
          <input class="zoom-slider" type="range" min="0" max="100" step="0.1" aria-label="Niveau de zoom" aria-orientation="vertical" [value]="zoomLevel()" [disabled]="loading() || !!error()" (input)="changeZoom($event)">
          <span aria-hidden="true">−</span>
        </div>
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
  readonly publicCatalog = this.mode === 'viewer' && new URLSearchParams(location.search).get('catalogue') === '1';
  private readonly publicSlug = this.mode === 'viewer' && !this.publicCatalog && new URLSearchParams(location.search).has('world') ? new URLSearchParams(location.search).get('world') ?? '' : null;
  readonly publicStatus = signal<'sample' | 'loading' | 'ready' | 'error'>(this.publicSlug === null ? 'sample' : 'loading');
  readonly publicationUrl = signal('');
  readonly publicationMessage = signal('');
  readonly unpublishConfirm = signal(false);
  private viewerUrl(slug: string): string { const url = new URL('/viewer/', location.origin); url.searchParams.set('world', slug); return url.toString(); }
  async publishWorld(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.personal() || this.role !== 'owner' || this.pointBusy()) return;
    const fields = new FormData(event.target as HTMLFormElement); const worldId = this.world.id; const revision = this.world.revision;
    const layerIds = fields.getAll('layerId').map(value => String(value));
    if (!layerIds.length || layerIds.length > 100) { this.publicationMessage.set('Choisissez de 1 à 100 calques à publier.'); return; }
    this.pointBusy.set(true); this.publicationMessage.set('');
    try {
      const result = await this.accounts.request<{ slug: string; revision: number; visibility: 'public' | 'unlisted' }>('/worlds/' + worldId + '/publication', { method: 'POST', body: JSON.stringify({ revision, visibility: fields.get('visibility'), layerIds }) });
      if (!this.personal() || this.world.id !== worldId || !this.accounts.user()) return;
      this.world = { ...this.world, status: result.visibility }; this.publicationUrl.set(this.viewerUrl(result.slug));
      this.unpublishConfirm.set(false); this.publicationMessage.set('Révision ' + result.revision + ' publiée.');
    } catch (error) { this.publicationMessage.set(error instanceof Error ? error.message : 'Publication impossible.'); }
    finally { this.pointBusy.set(false); }
  }
  async unpublishWorld(): Promise<void> {
    if (!this.unpublishConfirm() || !this.personal() || this.role !== 'owner' || this.pointBusy()) return;
    const worldId = this.world.id; this.pointBusy.set(true); this.publicationMessage.set('');
    try {
      await this.accounts.request<void>('/worlds/' + worldId + '/publication', { method: 'DELETE' });
      if (!this.personal() || this.world.id !== worldId || !this.accounts.user()) return;
      this.world = { ...this.world, status: 'draft' }; this.publicationUrl.set(''); this.unpublishConfirm.set(false); this.publicationMessage.set('Publication retirée.');
    } catch (error) { this.publicationMessage.set(error instanceof Error ? error.message : 'Retrait impossible.'); }
    finally { this.pointBusy.set(false); }
  }
  gridOptions: GridOptions = { ...DEFAULT_GRID };
  readonly gridInfo = signal<GridStats | null>(null);
  readonly tileMessage = signal('');
  private tileTimer?: ReturnType<typeof setTimeout>;
  private tileAbort?: AbortController;
  private tileKey = '';
  private tileRequest = 0;
  readonly currentScale = signal(0);
  readonly printWidthCm = signal(0);
  formatScale(value: number): string { return Math.round(value).toLocaleString('fr-FR'); }
  applyScale(event: Event): void {
    event.preventDefault();
    this.engine?.setScale(Number(new FormData(event.target as HTMLFormElement).get('denominator')));
  }
  formatKm(value: number): string { return value.toLocaleString('fr-FR', { maximumFractionDigits: 2 }); }
  applyGrid(event: Event): void {
    event.preventDefault(); const fields = new FormData(event.target as HTMLFormElement);
    this.gridOptions = { enabled: fields.has('enabled'), widthKm: Number(fields.get('widthKm')), heightKm: Number(fields.get('heightKm')) };
    this.engine?.setGrid(this.gridOptions, this.gridChanged);
  }
  zoomToGrid(): void { this.engine?.zoomToGrid(); }
  private readonly gridChanged = (stats: GridStats, view: GridView, regions: GridView[] = [view]): void => {
    this.gridInfo.set(stats);
    this.currentScale.set(scaleDenominator(this.world.radiusKm, view.pixelsPerDegree));
    this.printWidthCm.set(this.host.nativeElement.clientWidth * 2.54 / 96);
    const bounds = regions.map(region => ({ west: Math.max(-180,region.west), east: Math.min(180,region.east), south: Math.max(-90,region.south), north: Math.min(90,region.north), detailKm: Math.max(stats.widthKm,stats.heightKm) })).filter(region => region.west < region.east && region.south < region.north);
    if (!bounds.length) return;
    const key = this.view() + ':' + this.world.id + ':' + this.world.revision + ':' + JSON.stringify(this.layerVisibility()) + ':' + JSON.stringify(bounds);
    if (key === this.tileKey) return;
    this.tileKey = key; const request = ++this.tileRequest;
    clearTimeout(this.tileTimer); this.tileAbort?.abort();
    this.tileTimer = setTimeout(() => { void this.loadTiles(bounds,request); }, 180);
  };
  private async loadTiles(bounds: { west: number; east: number; south: number; north: number; detailKm: number }[], request: number): Promise<void> {
    if (!this.personal()) { this.tileMessage.set(this.publicStatus() === 'ready' ? 'Carte publiée · révision ' + this.world.revision : 'Démonstration locale · objets intégrés.'); return; }
    const worldId = this.world.id; const revision = this.world.revision; const mode = this.view();
    const abort = new AbortController(); this.tileAbort = abort; this.tileMessage.set('Chargement des détails…');
    try {
      const results = await Promise.all(bounds.map(region => {
        const query = new URLSearchParams(Object.entries(region).map(([key,value]) => [key,String(value)]));
        return this.accounts.request<{ revision: number; objects: MapObject[]; total: number; reduced: boolean }>('/worlds/' + worldId + '/tiles?' + query, { signal: abort.signal });
      }));
      if (request !== this.tileRequest || this.world.id !== worldId || !this.personal() || !this.accounts.user() || this.view() !== mode) return;
      if (results.some(result => result.revision !== revision) || this.world.revision !== revision) { this.tileMessage.set('Le monde a changé : rechargez-le pour consulter les détails.'); return; }
      if (results.some(result => !Array.isArray(result.objects))) throw new Error('Réponse de détail invalide.');
      const objects = [...new Map(results.flatMap(result => result.objects).map(object => [object.id,object])).values()];
      if (this.objectsPartial()) { this.world = { ...this.world, objects }; this.syncScene(); }
      this.engine?.setVisibleObjects(objects);
      this.tileMessage.set(objects.length + ' objet(s) chargé(s)' + (results.some(result => result.reduced) ? ' · zoomez pour davantage de détails' : ' dans cette zone'));
    } catch { if (!abort.signal.aborted && request === this.tileRequest) this.tileMessage.set('Détails indisponibles. La scène déjà chargée reste visible.'); }
  }
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
    if (this.pointBusy() || !this.personal() || this.role === 'viewer' || !await this.ensureComplete() || this.pointBusy()) return false;
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
      const result = await this.accounts.request<WorldAccess>('/worlds/' + worldId + ((change.before ?? change.after)!.geometry.type === 'LineString' ? '/lines/' : (change.before ?? change.after)!.geometry.type === 'Polygon' ? '/areas/' : '/points/') + pointId + '?compact=1', { method: target ? 'PUT' : 'DELETE', body: JSON.stringify({ revision: this.world.revision, ...(target ? { point: target } : {}) }) });
      if (this.personal() && this.world.id === worldId && this.accounts.user()) {
        this.applyObjectResult(result, pointId, previousRevision); this.deleteConfirm.set(null);
        if (this.world.revision === previousRevision + 1) { this.history.accept(direction); this.refreshHistory(); } else this.clearHistory();
        if (!target && this.selectedId() === pointId) this.selectedId.set(null);
        this.pointMessage.set(direction === 'undo' ? 'Action annulée.' : 'Action rétablie.');
      }
    } catch (error) { this.pointMessage.set(error instanceof Error ? error.message : 'Action impossible.'); }
    finally { this.pointBusy.set(false); }
  }
  readonly selectedId = signal<string | null>(null);
  readonly deleteConfirm = signal<string | null>(null);
  selectedObject(): MapObject | undefined {
    const id = this.selectedId(); const edit = this.lineEdit();
    return this.world.objects.find(object => object.id === id) ?? (edit?.object.id === id ? edit.object : undefined);
  }
  locateObject(object: MapObject): void {
    const id = object.id;
    if (!this.world.objects.some(item => item.id === id)) { this.world = { ...this.world, objects: [...this.world.objects,object] }; this.syncScene(); }
    if (object.geometry.type !== 'Point' && object.geometry.type !== 'LineString' && object.geometry.type !== 'Polygon') return;
    if (this.selectedId() !== id) { this.cancelLineEdit(); }
    this.deleteConfirm.set(null); this.selectedId.set(id);
    this.layerVisibility.update(values => ({ ...values, [object.layerId]: true }));
    this.engine?.setLayerVisible(object.layerId, true);
    this.navigate('carte');
    const coordinate = object.geometry.type === 'Point' ? object.geometry.coordinates : object.geometry.type === 'LineString' ? object.geometry.coordinates[0]! : object.geometry.coordinates[0]![0]!;
    requestAnimationFrame(() => { if (this.selectedId() === id) this.engine?.focus(coordinate); });
  }
  readonly pointBusy = signal(false);
  readonly pointMessage = signal('');
  role: WorldAccess['role'] = 'viewer';
  constructor() {
    window.addEventListener('popstate', this.onPopState);
    effect(() => {
      if (this.personal() && !this.accounts.user()) {
        this.cancelLine(); this.cancelArea(); this.placingPoint.set(false); this.cancelLineEdit(); this.clearHistory(); this.selectedId.set(null); this.personal.set(false); this.objectsPartial.set(false); this.world = createDemoWorld(); this.layerVisibility.set({});
        this.syncScene(); this.pointMessage.set('');
      }
    });
  }
  openWorld(access: WorldAccess): void {
    this.placingPoint.set(false); this.cancelLine(); this.cancelArea(); this.cancelLineEdit();
    if (!this.accounts.user()) return;
    clearTimeout(this.tileTimer); this.tileAbort?.abort(); ++this.tileRequest; this.tileKey = '';
    this.objectsPartial.set(access.objectsComplete === false);
    this.objectCount.set(access.objectCount ?? null);
    this.clearHistory(); this.selectedId.set(null); this.world = worldSchema.parse(access.world); this.role = access.role;
    this.publicationUrl.set(this.world.status === 'public' || this.world.status === 'unlisted' ? this.viewerUrl(this.world.slug) : ''); this.publicationMessage.set(''); this.unpublishConfirm.set(false); this.exportJsonMessage.set('');
    this.navigate('carte'); this.personal.set(true); this.layerVisibility.set({});
    this.syncScene(); this.engine?.reset(); this.accountOpen.set(false); this.pointMessage.set('');
  }
  async reloadWorld(): Promise<void> {
    this.pointBusy.set(true);
    try { this.openWorld(await this.accounts.request<WorldAccess>('/worlds/' + this.world.id + '?summary=1')); }
    catch (error) { this.pointMessage.set(error instanceof Error ? error.message : 'Rechargement impossible.'); }
    finally { this.pointBusy.set(false); }
  }
  async addPoint(event: Event): Promise<void> {
    event.preventDefault(); if (this.pointBusy() || !this.personal() || this.role === 'viewer') return;
    const form = event.target as HTMLFormElement; const fields = new FormData(form); const worldId = this.world.id; const previousRevision = this.world.revision;
    const existingIds = new Set(this.world.objects.map(object => object.id));
    this.pointBusy.set(true); this.pointMessage.set('');
    try {
      const result = await this.accounts.request<WorldAccess>('/worlds/' + worldId + '/points?compact=1', { method: 'POST', body: JSON.stringify({ name: fields.get('name'), longitude: Number(fields.get('longitude')), latitude: Number(fields.get('latitude')), revision: this.world.revision, layerId: fields.get('layerId'), ...(this.pointKind() === 'label' ? { kind: 'label', color: fields.get('color') } : {}) }) });
      if (this.personal() && this.world.id === worldId && this.accounts.user()) { const saved = worldSchema.parse(result.world); const added = saved.objects.filter(object => !existingIds.has(object.id)); if (added.length !== 1) throw new Error('Réponse de création invalide. Rechargez le monde.'); this.applyObjectResult(result, added[0]!.id, previousRevision); if (added.length === 1 && this.world.revision === previousRevision + 1) this.recordHistory({ before: null, after: added[0]! }); else this.clearHistory(); const isLabel = added[0]!.kind === 'label'; form.reset(); this.pointKind.set('city'); this.placingPoint.set(false); this.pointMessage.set(isLabel ? 'Texte enregistré.' : 'Lieu enregistré.'); }
    } catch (error) { this.pointMessage.set(error instanceof Error ? error.message : 'Enregistrement impossible.'); }
    finally { this.pointBusy.set(false); }
  }
  async updatePoint(event: Event): Promise<void> {
    event.preventDefault(); const fields = new FormData(event.target as HTMLFormElement);
    await this.changePoint({ name: fields.get('name'), longitude: Number(fields.get('longitude')), latitude: Number(fields.get('latitude')), ...(this.selectedObject()?.kind === 'label' ? { color: fields.get('color') } : {}) });
  }
  async deletePoint(): Promise<void> {
    if (this.deleteConfirm() !== this.selectedId()) return;
    await this.changePoint();
  }
  private async changePoint(update?: { name: FormDataEntryValue | null; longitude: number; latitude: number; color?: FormDataEntryValue | null }): Promise<void> {
    const id = this.selectedId(); const worldId = this.world.id; const previousRevision = this.world.revision;
    const before = this.world.objects.find(object => object.id === id);
    if (!id || !this.personal() || this.role === 'viewer' || this.pointBusy()) return;
    this.pointBusy.set(true); this.pointMessage.set('');
    try {
      const result = await this.accounts.request<WorldAccess>('/worlds/' + worldId + '/points/' + id + '?compact=1', { method: update ? 'PATCH' : 'DELETE', body: JSON.stringify({ ...update, revision: this.world.revision }) });
      if (this.personal() && this.world.id === worldId && this.accounts.user()) {
        this.applyObjectResult(result, id, previousRevision); this.deleteConfirm.set(null);
        if (before && this.world.revision === previousRevision + 1) this.recordHistory({ before, after: this.world.objects.find(object => object.id === id) ?? null }); else this.clearHistory();
        if (!update) { if (this.selectedId() === id) this.selectedId.set(null); this.pointMessage.set(before?.kind === 'label' ? 'Texte supprimé.' : 'Lieu supprimé.'); }
        else { this.pointMessage.set(before?.kind === 'label' ? 'Texte modifié.' : 'Lieu modifié.'); if (this.selectedId() === id) this.engine?.focus([update.longitude, update.latitude]); }
      }
    } catch (error) { this.pointMessage.set(error instanceof Error ? error.message : 'Modification impossible.'); }
    finally { this.pointBusy.set(false); }
  }
  private applyObjectResult(access: WorldAccess, id: string, revision: number): void {
    const world = worldSchema.parse(access.world);
    if (world.id !== this.world.id || world.revision !== revision + 1) {
      this.clearHistory(); throw new Error('Le monde a changé. Rechargez-le avant de continuer.');
    }
    if (access.objectsComplete === false) {
      this.world = { ...world, objects: [...this.world.objects.filter(object => object.id !== id), ...world.objects] };
    } else { this.world = world; this.objectsPartial.set(false); }
    this.objectCount.set(access.objectCount ?? null);
    this.syncScene();
  }
  @ViewChild('lineCoordinates') private lineCoordinates?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('areaHoles') private areaHoles?: ElementRef<HTMLTextAreaElement>;
  readonly lineEdit = signal<{ object: MapObject; revision: number } | null>(null);
  readonly lineEditError = signal('');
  formatLineCoordinates(object: MapObject): string {
    return object.geometry.type === 'LineString' ? object.geometry.coordinates.map(([lon, lat]) => lon + ', ' + lat).join('\n') : '';
  }
  cancelLineEdit(): void {
    if (this.drawingHole()) this.cancelHole();
    this.engine?.setEditableVertices(null); this.lineEdit.set(null); this.lineEditError.set('');
  }
  private showEditableVertices(points: Coordinate[] | null): void {
    this.engine?.setEditableVertices(points, vertices => {
      const area = this.lineCoordinates?.nativeElement;
      if (area && this.lineEdit()?.object.id === this.selectedId()) area.value = vertices.map(([lon, lat]) => lon + ', ' + lat).join('\n');
    });
  }
  syncLineVertices(text: string): void {
    const edit = this.lineEdit(); if (!edit) return;
    const rows = text.trim().split(/\r?\n/);
    const number = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
    const coordinates = rows.map(row => row.split(',').map(part => part.trim()));
    if (coordinates.length > 2000 || coordinates.some(pair => pair.length !== 2 || pair.some(part => !number.test(part)))) { this.showEditableVertices(null); return; }
    const parsed = lineObjectSchema.safeParse({ ...edit.object, geometry: { type: 'LineString', coordinates: coordinates.map(pair => pair.map(Number)) } });
    this.showEditableVertices(parsed.success && parsed.data.geometry.type === 'LineString' ? parsed.data.geometry.coordinates : null);
  }
  async beginLineEdit(object: MapObject): Promise<void> {
    if (!this.personal() || this.role === 'viewer' || this.pointBusy() || object.geometry.type !== 'LineString') return;
    const worldId = this.world.id; const revision = this.world.revision; this.pointBusy.set(true); this.lineEditError.set(''); this.deleteConfirm.set(null);
    try {
      const access = await this.accounts.request<WorldAccess>('/worlds/' + worldId + '/objects/' + object.id);
      if (!this.personal() || !this.accounts.user() || this.world.id !== worldId || this.selectedId() !== object.id) return;
      const world = worldSchema.parse(access.world);
      if (world.revision !== revision || this.world.revision !== revision) throw new Error('Le monde a changé. Rechargez-le avant de modifier le tracé.');
      const full = world.objects.find(item => item.id === object.id && item.geometry.type === 'LineString');
      if (!full) throw new Error('Tracé introuvable.');
      if (full.geometry.type !== 'LineString') throw new Error('Tracé introuvable.');
      this.cancelLine(); this.cancelArea(); this.placingPoint.set(false); this.lineEdit.set({ object: full, revision });
      this.showEditableVertices(full.geometry.coordinates);
    } catch (error) { this.lineEditError.set(error instanceof Error ? error.message : 'Chargement du tracé impossible.'); }
    finally { this.pointBusy.set(false); }
  }
  async updateLine(event: Event): Promise<void> {
    event.preventDefault();
    const edit = this.lineEdit();
    if (!edit || this.pointBusy() || !this.personal() || this.role === 'viewer' || this.selectedId() !== edit.object.id) return;
    if (edit.revision !== this.world.revision) { this.lineEditError.set('Le monde a changé. Rechargez-le avant de modifier le tracé.'); return; }
    const fields = new FormData(event.target as HTMLFormElement);
    const rows = String(fields.get('coordinates') ?? '').trim().split(/\r?\n/);
    const number = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
    const coordinates = rows.map(row => row.split(',').map(part => part.trim()));
    if (coordinates.length > 2000 || coordinates.some(pair => pair.length !== 2 || pair.some(part => !number.test(part)))) {
      this.lineEditError.set('Indiquez 2 à 2 000 sommets, chacun sous la forme longitude, latitude.'); return;
    }
    const parsed = lineObjectSchema.safeParse({ ...edit.object, name: String(fields.get('name') ?? '').trim(), geometry: { type: 'LineString', coordinates: coordinates.map(pair => pair.map(Number)) } });
    if (!parsed.success) { this.lineEditError.set('Vérifiez le nom, les coordonnées et au moins deux sommets distincts.'); return; }
    const worldId = this.world.id; const revision = edit.revision; this.pointBusy.set(true); this.lineEditError.set('');
    this.engine?.setEditableVertices(null);
    try {
      const result = await this.accounts.request<WorldAccess>('/worlds/' + worldId + '/lines/' + edit.object.id + '?compact=1', { method: 'PUT', body: JSON.stringify({ revision, point: parsed.data }) });
      if (!this.personal() || !this.accounts.user() || this.world.id !== worldId) return;
      if (this.world.revision !== revision) { this.clearHistory(); throw new Error('Le monde a changé. Rechargez-le avant de continuer.'); }
      this.applyObjectResult(result, edit.object.id, revision); this.recordHistory({ before: edit.object, after: parsed.data });
      this.cancelLineEdit(); this.pointMessage.set('Tracé modifié.');
    } catch (error) { this.lineEditError.set(error instanceof Error ? error.message : 'Modification du tracé impossible.'); }
    finally { this.pointBusy.set(false); if (this.lineEdit() && this.lineCoordinates) this.syncLineVertices(this.lineCoordinates.nativeElement.value); }
  }
  readonly drawingHole = signal(false);
  readonly holePoints = signal<Coordinate[]>([]);
  startHole(): void {
    if (!this.lineEdit() || this.view() !== 'plane' || this.pointBusy()) return;
    this.holePoints.set([]); this.drawingHole.set(true); this.engine?.setEditableVertices(null);
  }
  private showHoleDraft(): void {
    const points = this.holePoints(); this.engine?.setDraftLine(points.length >= 3 ? [...points, points[0]!] : points);
  }
  removeHoleVertex(): void { this.holePoints.update(points => points.slice(0, -1)); this.showHoleDraft(); }
  cancelHole(): void {
    if (!this.drawingHole()) return;
    this.drawingHole.set(false); this.holePoints.set([]); this.engine?.setDraftLine([]);
    if (this.lineCoordinates && this.lineEdit()?.object.geometry.type === 'Polygon') this.syncAreaVertices(this.lineCoordinates.nativeElement.value);
  }
  finishHole(): void {
    const points = this.holePoints(); const field = this.areaHoles?.nativeElement;
    if (!this.drawingHole() || points.length < 3 || !field) return;
    const previous = field.value.trim(); const hole = points.map(([lon, lat]) => lon + ', ' + lat).join('\n');
    field.value = previous ? previous + '\n\n' + hole : hole;
    this.cancelHole();
  }
  formatAreaCoordinates(object: MapObject): string {
    return object.geometry.type === 'Polygon' ? object.geometry.coordinates[0]!.slice(0, -1).map(([lon, lat]) => lon + ', ' + lat).join('\n') : '';
  }
  formatAreaHoles(object: MapObject): string {
    return object.geometry.type === 'Polygon' ? object.geometry.coordinates.slice(1).map(ring => ring.slice(0, -1).map(([lon, lat]) => lon + ', ' + lat).join('\n')).join('\n\n') : '';
  }
  private parseAreaVertices(text: string): Coordinate[] | null {
    const rows = text.trim().split(/\r?\n/); const number = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
    const pairs = rows.map(row => row.split(',').map(part => part.trim()));
    if (pairs.some(pair => pair.length !== 2 || pair.some(part => !number.test(part)))) return null;
    const points = pairs.map(pair => [Number(pair[0]), Number(pair[1])] as Coordinate);
    if (points.length > 3 && points[0]![0] === points.at(-1)![0] && points[0]![1] === points.at(-1)![1]) points.pop();
    return points.length <= 2000 ? points : null;
  }
  syncAreaVertices(text: string): void {
    const edit = this.lineEdit(); const points = this.parseAreaVertices(text);
    if (!edit || edit.object.geometry.type !== 'Polygon' || !points || points.length < 3) { this.showEditableVertices(null); return; }
    const parsed = areaObjectSchema.safeParse({ ...edit.object, geometry: { type: 'Polygon', coordinates: [[...points, points[0]]] } });
    this.showEditableVertices(parsed.success ? points : null);
  }
  async beginAreaEdit(object: MapObject): Promise<void> {
    if (!this.personal() || this.role === 'viewer' || this.pointBusy() || object.geometry.type !== 'Polygon') return;
    const worldId = this.world.id; const revision = this.world.revision; this.pointBusy.set(true); this.lineEditError.set(''); this.deleteConfirm.set(null);
    try {
      const access = await this.accounts.request<WorldAccess>('/worlds/' + worldId + '/objects/' + object.id);
      if (!this.personal() || !this.accounts.user() || this.world.id !== worldId || this.selectedId() !== object.id) return;
      const world = worldSchema.parse(access.world);
      if (world.revision !== revision || this.world.revision !== revision) throw new Error('Le monde a changé. Rechargez-le avant de modifier le territoire.');
      const full = world.objects.find(item => item.id === object.id && item.geometry.type === 'Polygon' && item.kind === 'territory');
      if (!full || full.geometry.type !== 'Polygon') throw new Error('Territoire introuvable.');
      if (!areaObjectSchema.safeParse(full).success) throw new Error('Ce contour ne peut pas encore être modifié.');
      this.cancelLine(); this.cancelArea(); this.placingPoint.set(false); this.lineEdit.set({ object: full, revision });
      this.showEditableVertices(full.geometry.coordinates[0]!.slice(0, -1));
    } catch (error) { this.lineEditError.set(error instanceof Error ? error.message : 'Chargement du territoire impossible.'); }
    finally { this.pointBusy.set(false); }
  }
  async updateArea(event: Event): Promise<void> {
    event.preventDefault(); const edit = this.lineEdit();
    if (!edit || edit.object.geometry.type !== 'Polygon' || this.pointBusy() || !this.personal() || this.role === 'viewer' || this.selectedId() !== edit.object.id) return;
    if (edit.revision !== this.world.revision) { this.lineEditError.set('Le monde a changé. Rechargez-le avant de modifier le territoire.'); return; }
    const fields = new FormData(event.target as HTMLFormElement); const points = this.parseAreaVertices(String(fields.get('coordinates') ?? ''));
    if (!points || points.length < 3) { this.lineEditError.set('Indiquez 3 à 2 000 sommets, chacun sous la forme longitude, latitude.'); return; }
    const holesText = String(fields.get('holes') ?? '').trim(); const holes: Coordinate[][] = [];
    for (const block of holesText ? holesText.split(/\r?\n\s*\r?\n/) : []) {
      const hole = this.parseAreaVertices(block);
      if (!hole || hole.length < 3) { this.lineEditError.set('Chaque trou doit contenir au moins trois sommets, un par ligne.'); return; }
      holes.push(hole);
    }
    const rings = [points, ...holes].map(ring => [...ring, ring[0]!]);
    const parsed = areaObjectSchema.safeParse({ ...edit.object, name: String(fields.get('name') ?? '').trim(), style: { ...edit.object.style, color: fields.get('color') }, geometry: { type: 'Polygon', coordinates: rings } });
    if (!parsed.success) { this.lineEditError.set('Vérifiez le nom et les sommets : ni pôle, ni traversée de l’antiméridien.'); return; }
    const worldId = this.world.id; const revision = edit.revision; this.pointBusy.set(true); this.lineEditError.set(''); this.engine?.setEditableVertices(null);
    try {
      const result = await this.accounts.request<WorldAccess>('/worlds/' + worldId + '/areas/' + edit.object.id + '?compact=1', { method: 'PUT', body: JSON.stringify({ revision, point: parsed.data }) });
      if (!this.personal() || !this.accounts.user() || this.world.id !== worldId) return;
      if (this.world.revision !== revision) { this.clearHistory(); throw new Error('Le monde a changé. Rechargez-le avant de continuer.'); }
      this.applyObjectResult(result, edit.object.id, revision); this.recordHistory({ before: edit.object, after: parsed.data });
      this.cancelLineEdit(); this.pointMessage.set('Territoire modifié.');
    } catch (error) { this.lineEditError.set(error instanceof Error ? error.message : 'Modification du territoire impossible.'); }
    finally { this.pointBusy.set(false); if (this.lineEdit() && this.lineCoordinates) this.syncAreaVertices(this.lineCoordinates.nativeElement.value); }
  }
  async deleteLine(): Promise<void> {
    const id = this.selectedId();
    if (!id || this.deleteConfirm() !== id || this.lineEdit() || this.pointBusy() || !this.personal() || this.role === 'viewer') return;
    const worldId = this.world.id; const revision = this.world.revision;
    this.pointBusy.set(true); this.lineEditError.set(''); this.pointMessage.set('');
    try {
      const access = await this.accounts.request<WorldAccess>('/worlds/' + worldId + '/objects/' + id);
      if (!this.personal() || !this.accounts.user() || this.world.id !== worldId || this.selectedId() !== id) return;
      const world = worldSchema.parse(access.world);
      if (world.id !== worldId || world.revision !== revision || this.world.revision !== revision) throw new Error('Le monde a changé. Rechargez-le avant de supprimer le tracé.');
      const before = world.objects.find(item => item.id === id && item.geometry.type === 'LineString');
      if (!before) throw new Error('Tracé introuvable.');
      const result = await this.accounts.request<WorldAccess>('/worlds/' + worldId + '/lines/' + id + '?compact=1', { method: 'DELETE', body: JSON.stringify({ revision }) });
      if (!this.personal() || !this.accounts.user() || this.world.id !== worldId) return;
      if (this.world.revision !== revision) { this.clearHistory(); throw new Error('Le monde a changé. Rechargez-le avant de continuer.'); }
      this.applyObjectResult(result, id, revision); this.recordHistory({ before, after: null });
      this.deleteConfirm.set(null); if (this.selectedId() === id) this.selectedId.set(null);
      this.pointMessage.set('Tracé supprimé.');
    } catch (error) { this.lineEditError.set(error instanceof Error ? error.message : 'Suppression du tracé impossible.'); }
    finally { this.pointBusy.set(false); }
  }
  async deleteArea(): Promise<void> {
    const id = this.selectedId();
    if (!id || this.deleteConfirm() !== id || this.lineEdit() || this.pointBusy() || !this.personal() || this.role === 'viewer') return;
    const worldId = this.world.id; const revision = this.world.revision;
    this.pointBusy.set(true); this.lineEditError.set(''); this.pointMessage.set('');
    try {
      const access = await this.accounts.request<WorldAccess>('/worlds/' + worldId + '/objects/' + id);
      if (!this.personal() || !this.accounts.user() || this.world.id !== worldId || this.selectedId() !== id) return;
      const world = worldSchema.parse(access.world);
      if (world.id !== worldId || world.revision !== revision || this.world.revision !== revision) throw new Error('Le monde a changé. Rechargez-le avant de supprimer le territoire.');
      const before = world.objects.find(item => item.id === id && item.geometry.type === 'Polygon' && item.kind === 'territory');
      if (!before) throw new Error('Territoire introuvable.');
      if (!areaObjectSchema.safeParse(before).success) throw new Error('Ce territoire ne peut pas encore être supprimé avec annulation.');
      const result = await this.accounts.request<WorldAccess>('/worlds/' + worldId + '/areas/' + id + '?compact=1', { method: 'DELETE', body: JSON.stringify({ revision }) });
      if (!this.personal() || !this.accounts.user() || this.world.id !== worldId) return;
      if (this.world.revision !== revision) { this.clearHistory(); throw new Error('Le monde a changé. Rechargez-le avant de continuer.'); }
      this.applyObjectResult(result, id, revision); this.recordHistory({ before, after: null });
      this.deleteConfirm.set(null); if (this.selectedId() === id) this.selectedId.set(null);
      this.pointMessage.set('Territoire supprimé.');
    } catch (error) { this.lineEditError.set(error instanceof Error ? error.message : 'Suppression du territoire impossible.'); }
    finally { this.pointBusy.set(false); }
  }
  readonly view = signal<ViewMode>('plane');
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly layerVisibility = signal<Record<string, boolean>>({});
  readonly exporting = signal(false);
  readonly exportMessage = signal('');
  readonly exportingJson = signal(false);
  readonly exportJsonMessage = signal('');
  readonly apiStatus = signal<'checking' | 'ready' | 'unavailable'>('checking');
  @ViewChild('pointForm') private pointForm?: ElementRef<HTMLFormElement>;
  readonly placingPoint = signal(false);
  readonly pointKind = signal<'city' | 'label'>('city');
  private readonly cancelPlacement = (event: KeyboardEvent): void => { if (event.key === 'Escape' && !this.pointBusy()) { this.placingPoint.set(false); this.cancelLine(); this.cancelArea(); this.cancelHole(); } };
  readonly drawingArea = signal(false);
  readonly areaPoints = signal<Coordinate[]>([]);
  readonly areaError = signal('');
  startArea(): void { if (this.lineEdit()) return; this.cancelLine(); this.placingPoint.set(false); this.areaError.set(''); this.drawingArea.set(true); }
  cancelArea(): void { this.drawingArea.set(false); this.areaError.set(''); this.areaPoints.set([]); this.engine?.setDraftLine([]); }
  private showAreaDraft(): void {
    const points = this.areaPoints(); this.engine?.setDraftLine(points.length >= 3 ? [...points, points[0]!] : points);
  }
  removeAreaVertex(): void { this.areaPoints.update(points => points.slice(0, -1)); this.showAreaDraft(); }
  async saveArea(event: Event): Promise<void> {
    event.preventDefault();
    if (this.pointBusy() || !this.personal() || this.role === 'viewer' || !this.drawingArea()) return;
    const form = event.target as HTMLFormElement; const fields = new FormData(form); const points = this.areaPoints();
    if (points.length < 3) return;
    const area = areaObjectSchema.safeParse({ id: crypto.randomUUID(), layerId: fields.get('layerId'), name: String(fields.get('name') ?? '').trim(), kind: 'territory', geometry: { type: 'Polygon', coordinates: [[...points, points[0]]] }, style: { color: fields.get('color'), opacity: 0.55 }, properties: {} });
    if (!area.success) { this.areaError.set('Territoire invalide : utilisez 3 sommets distincts, sans pôle ni traversée de l’antiméridien.'); return; }
    const worldId = this.world.id; const revision = this.world.revision; this.pointBusy.set(true); this.pointMessage.set('');
    try {
      const access = await this.accounts.request<WorldAccess>('/worlds/' + worldId + '/areas/' + area.data.id + '?compact=1', { method: 'PUT', body: JSON.stringify({ revision, point: area.data }) });
      if (!this.personal() || this.world.id !== worldId || !this.accounts.user()) return;
      if (this.world.revision !== revision) { this.clearHistory(); throw new Error('Le monde a changé. Rechargez-le avant de continuer.'); }
      this.applyObjectResult(access, area.data.id, revision); this.cancelArea(); this.recordHistory({ before: null, after: area.data });
      form.reset(); this.pointMessage.set('Territoire enregistré.');
    } catch (error) { this.areaError.set(error instanceof Error ? error.message : 'Territoire non enregistré.'); }
    finally { this.pointBusy.set(false); }
  }
  readonly drawingLine = signal(false);
  readonly linePoints = signal<Coordinate[]>([]);
  startLine(): void { if (this.lineEdit()) return; this.cancelArea(); this.placingPoint.set(false); this.drawingLine.set(true); }
  cancelLine(): void { this.drawingLine.set(false); this.linePoints.set([]); this.engine?.setDraftLine([]); }
  removeLineVertex(): void { this.linePoints.update(points => points.slice(0,-1)); this.engine?.setDraftLine(this.linePoints()); }
  async saveLine(event: Event): Promise<void> {
    event.preventDefault();
    if (this.pointBusy() || !this.personal() || this.role === 'viewer' || !this.drawingLine()) return;
    const form = event.target as HTMLFormElement; const fields = new FormData(form);
    const worldId = this.world.id; const revision = this.world.revision;
    this.pointBusy.set(true);
    try {
      const line = lineObjectSchema.parse({ id: crypto.randomUUID(), layerId: fields.get('layerId'), name: String(fields.get('name')).trim(), kind: fields.get('kind'), geometry: { type: 'LineString', coordinates: this.linePoints() }, style: { color: fields.get('kind') === 'river' ? '#69bdd5' : '#e6b96c', opacity: 1 }, properties: {} });
      const access = await this.accounts.request<WorldAccess>('/worlds/' + worldId + '/lines/' + line.id + '?compact=1', { method: 'PUT', body: JSON.stringify({ revision, point: line }) });
      if (!this.personal() || this.world.id !== worldId || !this.accounts.user()) return;
      this.applyObjectResult(access, line.id, revision); this.cancelLine();
      if (this.world.revision === revision + 1) this.recordHistory({ before: null, after: line }); else this.clearHistory();
      form.reset(); this.pointMessage.set('Tracé enregistré.');
    } catch { this.pointMessage.set('Tracé non enregistré : vérifiez les sommets, les droits, le calque et la révision. Le dessin est conservé.'); }
    finally { this.pointBusy.set(false); }
  }
  readonly objectsPartial = signal(false);
  readonly objectCount = signal<number | null>(null);
  readonly fullLoadMessage = signal('Chargement des objets du monde…');
  private fullLoad?: Promise<boolean>;
  async ensureComplete(): Promise<boolean> {
    if (!this.objectsPartial()) return true;
    if (this.fullLoad) return this.fullLoad;
    const id = this.world.id; const revision = this.world.revision;
    this.fullLoadMessage.set('Chargement des objets du monde…');
    this.fullLoad = (async () => {
      try {
        const access = await this.accounts.request<WorldAccess>('/worlds/' + id);
        if (!this.personal() || this.world.id !== id || !this.accounts.user()) return false;
        if (access.world.revision !== revision || this.world.revision !== revision) {
          this.fullLoadMessage.set('Le monde a changé. Rechargez-le depuis la carte.');
          this.pointMessage.set('Le monde a changé. Rechargez-le avant de modifier.'); return false;
        }
        this.world = worldSchema.parse(access.world); this.objectsPartial.set(false); this.syncScene(); return true;
      } catch { this.fullLoadMessage.set('Chargement impossible. Réessayez.'); this.pointMessage.set('Chargement des objets impossible. Réessayez.'); return false; }
      finally { this.fullLoad = undefined; }
    })();
    return this.fullLoad;
  }
  readonly zoomLevel = signal(0);
  changeZoom(event: Event): void { this.engine?.setZoom(Number((event.target as HTMLInputElement).value)); }
  private engine?: MapEngine;
  private readonly abort = new AbortController();
  async ngAfterViewInit(): Promise<void> {
    if (this.publicCatalog) return;
    this.engine = new MapEngine(this.host.nativeElement, id => { if (this.lineEdit() && this.selectedId() !== id) return; this.selectedId.set(id); this.deleteConfirm.set(null); });
    window.addEventListener('keydown', this.cancelPlacement);
    this.engine.onCoordinate(([longitude, latitude]) => {
      if (this.drawingHole() && this.personal() && this.role !== 'viewer' && !this.pointBusy() && this.view() === 'plane') {
        if (this.holePoints().length < 2000) { this.holePoints.update(points => [...points, [longitude, latitude] as Coordinate]); this.showHoleDraft(); }
        return true;
      }
      if (this.drawingArea() && this.personal() && this.role !== 'viewer' && !this.pointBusy() && this.view() === 'plane') {
        if (this.areaPoints().length < 2000) { this.areaPoints.update(points => [...points, [longitude, latitude] as Coordinate]); this.showAreaDraft(); }
        return true;
      }
      if (this.drawingLine() && this.personal() && this.role !== 'viewer' && !this.pointBusy() && this.view() === 'plane') {
        if (this.linePoints().length < 2000) { this.linePoints.update(points => [...points, [longitude, latitude] as Coordinate]); this.engine?.setDraftLine(this.linePoints()); }
        return true;
      }
      if (!this.placingPoint() || !this.personal() || this.role === 'viewer' || this.pointBusy() || this.view() !== 'plane') return false;
      const form = this.pointForm?.nativeElement;
      if (!form) return false;
      (form.elements.namedItem('longitude') as HTMLInputElement).value = longitude.toFixed(6);
      (form.elements.namedItem('latitude') as HTMLInputElement).value = latitude.toFixed(6);
      this.placingPoint.set(false);
      this.pointMessage.set('Position choisie. Renseignez le nom et enregistrez le lieu.');
      (form.elements.namedItem('name') as HTMLInputElement).focus();
      return true;
    });
    this.engine.onScale(scale => { this.currentScale.set(scale); this.printWidthCm.set(this.host.nativeElement.clientWidth * 2.54 / 96); });
    this.engine.onZoom(level => this.zoomLevel.set(level));
    if (this.publicSlug !== null) {
      try {
        const response = await fetch('/api/v1/public/worlds/' + encodeURIComponent(this.publicSlug), { credentials: 'omit', signal: this.abort.signal });
        if (!response.ok) throw new Error('Carte indisponible.');
        this.world = worldSchema.parse(await response.json()); this.publicStatus.set('ready');
      } catch { if (!this.abort.signal.aborted) this.publicStatus.set('error'); return; }
    }
    this.engine.loadWorld(this.world);
    this.engine.setGrid(this.gridOptions, this.gridChanged);
    void this.checkApi();
    await this.setView('plane');
  }
  async setView(mode: ViewMode): Promise<void> {
    if (this.drawingHole()) return;
    clearTimeout(this.tileTimer); this.tileAbort?.abort(); ++this.tileRequest;
    this.placingPoint.set(false); this.cancelLine(); this.cancelArea();
    this.loading.set(true); this.error.set(false);
    try { await this.engine?.setView(mode); this.view.set(mode); this.tileKey = ''; this.engine?.setGrid(this.gridOptions, this.gridChanged); }
    catch { this.error.set(true); }
    finally { this.loading.set(false); }
  }
  private syncScene(): void {
    if (!this.objectsPartial()) this.objectCount.set(this.world.objects.length);
    this.engine?.loadWorld({ ...this.world, layers: this.world.layers.map(layer => ({ ...layer, visible: this.layerIsVisible(layer.id) })) });
  }
  reset(): void { this.engine?.reset(); }
  layerIsVisible(id: string): boolean { return this.layerVisibility()[id] ?? this.world.layers.find(layer => layer.id === id)?.visible ?? false; }
  toggleLayer(id: string): void {
    const visible = !this.layerIsVisible(id);
    this.layerVisibility.update(values => ({ ...values, [id]: visible }));
    this.engine?.setLayerVisible(id, visible);
  }
  async exportWorldJson(): Promise<void> {
    if (this.exportingJson()) return;
    const id = this.world.id; const revision = this.world.revision; const personal = this.personal();
    this.exportingJson.set(true); this.exportJsonMessage.set('');
    try {
      let world = this.world;
      if (personal) {
        const access = await this.accounts.request<WorldAccess>('/worlds/' + id);
        if (!this.personal() || !this.accounts.user() || this.world.id !== id) return;
        if (access.objectsComplete !== true) throw new Error('Le monde complet est indisponible. Réessayez.');
        world = worldSchema.parse(access.world);
        if (world.id !== id || world.revision !== revision || this.world.revision !== revision) throw new Error('Le monde a changé. Rechargez-le avant de l’exporter.');
      }
      const document = worldBackupSchema.parse({ format: 'alarmap-world', version: 1, world });
      const blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob); const link = window.document.createElement('a');
      link.href = url; link.download = world.slug + '-monde.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.exportJsonMessage.set('Données JSON prêtes à télécharger.');
    } catch (error) { this.exportJsonMessage.set(error instanceof Error ? error.message : 'Export JSON impossible.'); }
    finally { this.exportingJson.set(false); }
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
  ngOnDestroy(): void { window.removeEventListener('keydown', this.cancelPlacement); clearTimeout(this.tileTimer); this.tileAbort?.abort(); ++this.tileRequest; window.removeEventListener('popstate', this.onPopState); this.abort.abort(); this.engine?.destroy(); }
}
