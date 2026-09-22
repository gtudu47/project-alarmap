import { Injectable, signal } from '@angular/core';
import type { World, MemberRole } from '@alarmap/map-model';

export interface Account { id: string; email: string; displayName: string; isAdmin: boolean }
export interface WorldAccess { world: World; role: MemberRole; objectsComplete?: boolean; objectCount?: number }
export interface WorldSummary { id: string; name: string; radiusKm: number; revision: number; role: MemberRole }
export interface Invitation { id: string; email: string; expiresAt: string; usedAt?: string; revokedAt?: string }
interface AuthResponse { user: Account; accessToken: string }

@Injectable({ providedIn: 'root' })
export class AccountsClient {
  readonly user = signal<Account | null>(null);
  private accessToken?: string;
  private refreshInFlight?: Promise<void>;

  private async decode<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T;
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = typeof value === 'object' && value !== null && 'message' in value && typeof value.message === 'string' ? value.message : 'Service indisponible. Réessayez plus tard.';
      throw new Error(response.status >= 500 ? 'Service indisponible. Réessayez plus tard.' : message);
    }
    return value as T;
  }
  private async refresh(): Promise<void> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = (async () => {
        const response = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' });
        if (!response.ok) { this.accessToken = undefined; this.user.set(null); }
        const result = await this.decode<AuthResponse>(response);
        this.accessToken = result.accessToken; this.user.set(result.user);
      })().finally(() => { this.refreshInFlight = undefined; });
    }
    return this.refreshInFlight;
  }
  async restore(): Promise<void> {
    try { await this.refresh(); } catch { /* L’interface de connexion affiche ensuite l’état du service. */ }
  }
  async authenticate(action: 'login' | 'setup' | 'accept-invitation', data: Record<string, string>): Promise<void> {
    const result = await this.request<AuthResponse>(`/auth/${action}`, { method: 'POST', body: JSON.stringify(data) }, false);
    this.accessToken = result.accessToken; this.user.set(result.user);
  }
  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' });
    this.accessToken = undefined; this.user.set(null);
  }
  async request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
    const send = () => fetch(`/api/v1${path}`, { ...init, credentials: 'same-origin', headers: {
      'Content-Type': 'application/json', ...(authenticated && this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
    } });
    let response = await send();
    if (authenticated && response.status === 401) { await this.refresh(); response = await send(); }
    return this.decode<T>(response);
  }
}
