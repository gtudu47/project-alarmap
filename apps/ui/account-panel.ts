import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild, inject, signal } from '@angular/core';
import { AccountsClient, type Invitation, type WorldAccess, type WorldSummary } from './accounts.client';

@Component({
  selector: 'alarmap-account-panel', standalone: true,
  template: `
    @if (visible) {
      <dialog #modal class="account-overlay" aria-labelledby="account-title" (cancel)="closeDialog($event)">
        <div class="account-dialog">
          <header class="account-heading"><div><div class="eyebrow">ALARMAP · ESPACE PERSONNEL</div><h2 id="account-title">{{ client.user() ? 'Mes mondes' : action === 'setup' ? 'Créer le compte administrateur' : action === 'accept-invitation' ? 'Bienvenue sur AlarMap' : 'Se connecter' }}</h2></div><button type="button" class="account-secondary" (click)="closed.emit()">Fermer</button></header>
          @if (error()) { <p class="account-error" role="alert">{{ error() }}</p> }
          @if (notice()) { <p class="account-notice" role="status">{{ notice() }}</p> }
          @if (!client.user()) {
            <p>Un compte personnel pour créer vos mondes. L’inscription se fait sur invitation.</p>
            @if (unavailable()) { <p class="account-notice">Le serveur de comptes n’est pas disponible actuellement.</p> }
            @if (needsSetup() && action === 'login') { <p class="account-notice">Cette instance attend son activation par l’administrateur.</p> }
            <form class="account-form" (submit)="authenticate($event)">
              @if (action !== 'accept-invitation') { <label>Adresse email<input name="email" type="email" autocomplete="email" required maxlength="254"></label> }
              @if (action !== 'login') { <label>Votre nom<input name="displayName" autocomplete="nickname" required maxlength="80"></label> }
              <label>Mot de passe<input name="password" type="password" [attr.autocomplete]="action === 'login' ? 'current-password' : 'new-password'" required [attr.minlength]="action === 'login' ? 1 : 12" maxlength="128"></label>
              @if (action !== 'login') { <label>Confirmer le mot de passe<input name="confirmation" type="password" autocomplete="new-password" required minlength="12" maxlength="128"></label><small>Utilisez au moins 12 caractères.</small> }
              <button class="account-primary" [disabled]="busy()" type="submit">{{ busy() ? 'Veuillez patienter…' : action === 'login' ? 'Se connecter' : 'Créer mon compte' }}</button>
            </form>
            @if (action !== 'login') { <button class="account-link" type="button" (click)="action = 'login'; error.set('')">J’ai déjà un compte</button> }
          } @else {
            <div class="account-profile"><span>{{ client.user()!.displayName }} · {{ client.user()!.email }}</span><button type="button" class="account-secondary" [disabled]="busy()" (click)="logout()">Se déconnecter</button></div>
            <form class="account-form create-world" (submit)="createWorld($event)">
              <label>Nom du nouveau monde<input name="name" required maxlength="200" placeholder="Mon univers"></label>
              <label>Rayon en km<input name="radiusKm" type="number" required min="1" max="1000000000" value="6371"></label>
              <button class="account-primary" type="submit" [disabled]="busy()">Créer un monde privé</button>
            </form>
            <div class="account-worlds">
              @for (world of worlds(); track world.id) {
                <button type="button" class="world-entry" [disabled]="busy()" (click)="openWorld(world.id)"><strong>{{ world.name }}</strong><span>{{ world.radiusKm }} km · {{ world.role === 'owner' ? 'Propriétaire' : world.role === 'editor' ? 'Éditeur' : 'Lecture seule' }}</span><span>Ouvrir →</span></button>
              } @empty { <p>Vous n’avez pas encore de monde. Créez le premier ci-dessus.</p> }
            </div>
            @if (client.user()!.isAdmin) {
              <section class="invite-section"><h3>Inviter une personne</h3><p>Chaque personne invitée dispose de son propre espace. Ce lien ne partage pas vos mondes.</p>
                <form class="account-form" (submit)="invite($event)"><label>Adresse email<input name="email" type="email" required maxlength="254"></label><button class="account-primary" [disabled]="busy()" type="submit">Créer un lien d’invitation</button></form>
                @if (invitationUrl()) { <label class="invite-link">Lien valable 7 jours · à transmettre à la personne invitée<input readonly [value]="invitationUrl()" aria-label="Lien d’invitation"><button class="account-secondary" type="button" (click)="copyInvitation()">Copier le lien</button></label> }
                <ul class="invitation-list">@for (invitation of invitations(); track invitation.id) { <li><span>{{ invitation.email }} — {{ invitation.usedAt ? 'Acceptée' : invitation.revokedAt ? 'Révoquée' : expired(invitation) ? 'Expirée' : 'En attente' }}</span>@if (!invitation.usedAt && !invitation.revokedAt && !expired(invitation)) { <button type="button" class="account-link" [disabled]="busy()" (click)="revoke(invitation.id)">Révoquer</button> }</li> }</ul>
              </section>
            }
          }
        </div>
      </dialog>
    }
  `,
})
export class AccountPanel implements OnInit {
  @Input() visible = false;
  @ViewChild('modal') set modal(element: ElementRef<HTMLDialogElement> | undefined) {
    if (element && !element.nativeElement.open) element.nativeElement.showModal();
  }
  closeDialog(event: Event): void { event.preventDefault(); this.closed.emit(); }
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly worldOpened = new EventEmitter<WorldAccess>();
  readonly client = inject(AccountsClient);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly unavailable = signal(false);
  readonly needsSetup = signal(false);
  readonly worlds = signal<WorldSummary[]>([]);
  readonly invitations = signal<Invitation[]>([]);
  readonly invitationUrl = signal('');
  action: 'login' | 'setup' | 'accept-invitation' = 'login';
  private token = '';
  constructor() {
    const params = new URLSearchParams(location.hash.slice(1));
    const token = params.get('invite') ?? params.get('setup');
    if (token) {
      this.token = token;
      this.action = params.has('invite') ? 'accept-invitation' : 'setup';
      history.replaceState(null, '', location.pathname + location.search);
    }
  }
  async ngOnInit(): Promise<void> {
    await this.client.restore();
    try {
      const status = await this.client.request<{ initialized: boolean }>('/auth/status', {}, false);
      this.needsSetup.set(!status.initialized);
      if (this.client.user()) await this.reload();
    } catch { this.unavailable.set(true); }
  }
  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    try { await action(); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'La demande a échoué.'); }
    finally { this.busy.set(false); }
  }
  private async reload(): Promise<void> {
    this.worlds.set(await this.client.request<WorldSummary[]>('/worlds'));
    if (this.client.user()?.isAdmin) this.invitations.set(await this.client.request<Invitation[]>('/invitations'));
  }
  async authenticate(event: Event): Promise<void> {
    event.preventDefault(); const form = event.target as HTMLFormElement; const fields = new FormData(form);
    await this.run(async () => {
      const password = String(fields.get('password') ?? '');
      if (this.action !== 'login' && password !== fields.get('confirmation')) throw new Error('Les mots de passe ne correspondent pas.');
      const input: Record<string, string> = { password };
      if (this.action !== 'accept-invitation') input['email'] = String(fields.get('email') ?? '').trim();
      if (this.action !== 'login') { input['displayName'] = String(fields.get('displayName') ?? ''); input['token'] = this.token; }
      await this.client.authenticate(this.action, input);
      this.token = ''; this.action = 'login'; this.unavailable.set(false); form.reset();
      await this.reload();
    });
  }
  async logout(): Promise<void> {
    await this.run(async () => { await this.client.logout(); this.worlds.set([]); this.invitations.set([]); this.invitationUrl.set(''); });
  }
  async createWorld(event: Event): Promise<void> {
    event.preventDefault(); const form = event.target as HTMLFormElement; const data = new FormData(form);
    await this.run(async () => {
      const result = await this.client.request<WorldAccess>('/worlds', { method: 'POST', body: JSON.stringify({ name: data.get('name'), radiusKm: Number(data.get('radiusKm')) }) });
      form.reset(); await this.reload(); this.worldOpened.emit(result);
    });
  }
  async openWorld(id: string): Promise<void> {
    await this.run(async () => this.worldOpened.emit(await this.client.request<WorldAccess>(`/worlds/${id}?summary=1`)));
  }
  async invite(event: Event): Promise<void> {
    event.preventDefault(); const form = event.target as HTMLFormElement; const data = new FormData(form);
    await this.run(async () => {
      const invitation = await this.client.request<{ url: string }>('/invitations', { method: 'POST', body: JSON.stringify({ email: String(data.get('email')).trim() }) });
      this.invitationUrl.set(invitation.url); form.reset(); await this.reload();
    });
  }
  async revoke(id: string): Promise<void> {
    await this.run(async () => { await this.client.request(`/invitations/${id}`, { method: 'DELETE' }); this.invitationUrl.set(''); await this.reload(); });
  }
  expired(invitation: Invitation): boolean { return new Date(invitation.expiresAt).getTime() <= Date.now(); }
  async copyInvitation(): Promise<void> {
    try { await navigator.clipboard.writeText(this.invitationUrl()); this.notice.set('Lien copié.'); }
    catch { this.notice.set('Sélectionnez le lien pour le copier manuellement.'); }
  }
}
