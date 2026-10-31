import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { z } from 'zod';

const catalogSchema = z.array(z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  name: z.string().min(1).max(200),
  revision: z.number().int().nonnegative(),
}).strict()).max(100);
type PublicWorld = z.infer<typeof catalogSchema>[number];

@Component({
  selector: 'alarmap-public-catalog', standalone: true,
  template: `
    <section class="workspace-page" aria-labelledby="public-catalog-title">
      <div class="page-eyebrow">ALARMAP · CARTES PARTAGÉES</div>
      <h1 id="public-catalog-title">Cartes publiques</h1>
      <p class="page-lead">Découvrez les mondes que leurs auteurs ont choisi de rendre publics. Les cartes accessibles uniquement par lien ne figurent pas ici.</p>
      @if (loading()) { <p role="status">Chargement des cartes publiques…</p> }
      @else if (error()) { <p role="alert">Impossible de charger les cartes publiques.</p><button class="account-secondary" (click)="load()">Réessayer</button> }
      @else {
        <ul class="atlas-list">
          @for (world of worlds(); track world.slug) {
            <li><span class="object-symbol" aria-hidden="true">◎</span><div><h2>{{ world.name }}</h2><p>Révision publiée {{ world.revision }}</p><a class="catalog-open" [href]="'/viewer/?world=' + world.slug" [attr.aria-label]="'Consulter ' + world.name">Consulter la carte →</a></div></li>
          } @empty { <li class="empty-atlas">Aucune carte publique pour le moment.</li> }
        </ul>
      }
      <a class="account-link" href="/viewer/">Découvrir la carte de démonstration</a>
    </section>
  `,
})
export class PublicCatalog implements OnInit, OnDestroy {
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly worlds = signal<PublicWorld[]>([]);
  private abort?: AbortController;
  ngOnInit(): void { void this.load(); }
  ngOnDestroy(): void { this.abort?.abort(); }
  async load(): Promise<void> {
    this.abort?.abort(); const abort = new AbortController(); this.abort = abort;
    this.loading.set(true); this.error.set(false);
    try {
      const response = await fetch('/api/v1/public/worlds', { credentials: 'omit', signal: abort.signal });
      if (!response.ok) throw new Error('Catalogue indisponible.');
      const worlds = catalogSchema.parse(await response.json());
      if (!abort.signal.aborted) this.worlds.set(worlds);
    } catch { if (!abort.signal.aborted) this.error.set(true); }
    finally { if (!abort.signal.aborted) this.loading.set(false); }
  }
}
