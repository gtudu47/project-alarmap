import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { AuthService, type AuthResult } from './auth.service.js';
import { digestToken, newToken } from './security.js';
import type { Infrastructure } from '../infrastructure.js';

describe('comptes : SQL PostgreSQL embarqué (sans PostGIS)', () => {
  const database = new PGlite();
  let auth: AuthService;
  let admin: AuthResult;
  const password = 'Un mot de passe de test 2026!';
  beforeAll(async () => {
    await database.exec('CREATE TABLE users(id uuid PRIMARY KEY,email text NOT NULL,password_hash text NOT NULL,is_admin boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now()); CREATE UNIQUE INDEX email_unique ON users(lower(email));');
    await database.exec(await readFile(new URL('../../migrations/002_accounts.sql', import.meta.url), 'utf8'));
    const query = async (sql: string, parameters?: unknown[]) => {
      const result = await database.query(sql, parameters);
      return { rows: result.rows, rowCount: result.rows.length || result.affectedRows || 0 };
    };
    auth = new AuthService({
      config: { JWT_SECRET: newToken(), PUBLIC_APP_URL: 'https://maps.example.test' },
      pool: { query, connect: async () => ({ query, release() { /* Connexion unique de test. */ } }) },
    } as unknown as Infrastructure);
    const setup = newToken();
    await query("INSERT INTO setup_tokens(singleton,token_hash,expires_at) VALUES(true,$1,now()+interval '1 hour')", [digestToken(setup)]);
    await expect(auth.setup({ token: newToken(), email: 'admin@example.test', password, displayName: 'Admin' })).rejects.toThrow('invalide');
    admin = await auth.setup({ token: setup, email: 'admin@example.test', password, displayName: 'Admin' });
  }, 30000);
  afterAll(async () => { await database.close(); });

  it('initialise l’administrateur une seule fois', async () => {
    expect(admin.user.isAdmin).toBe(true);
    expect((await auth.status()).initialized).toBe(true);
    await expect(auth.setup({ token: newToken(), email: 'other@example.test', password, displayName: 'Other' })).rejects.toThrow('déjà initialisée');
  });
  it('crée un compte ordinaire avec un mot de passe Argon2 et consomme son invitation', async () => {
    const invitation = await auth.createInvitation('alice@example.test', admin.user.id);
    const token = new URLSearchParams(new URL(invitation.url).hash.slice(1)).get('invite')!;
    const result = await auth.acceptInvitation({ token, password, displayName: 'Alice' });
    expect(result.user).toMatchObject({ email: 'alice@example.test', isAdmin: false });
    const stored = await database.query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id=$1', [result.user.id]);
    expect(stored.rows[0]?.password_hash).toMatch(/^\$argon2id\$/);
    await expect(auth.acceptInvitation({ token, password, displayName: 'Again' })).rejects.toThrow('invalide');
    expect((await auth.login('ALICE@example.test', password)).user.id).toBe(result.user.id);
    await expect(auth.login('alice@example.test', 'wrong password')).rejects.toThrow('incorrect');
  }, 15000);
  it('refuse les invitations révoquées et expirées', async () => {
    for (const kind of ['revoked', 'expired']) {
      const invitation = await auth.createInvitation(`${kind}@example.test`, admin.user.id);
      const token = new URLSearchParams(new URL(invitation.url).hash.slice(1)).get('invite')!;
      if (kind === 'revoked') await auth.revokeInvitation(invitation.id);
      else await database.query("UPDATE invitations SET expires_at=now()-interval '1 second' WHERE id=$1", [invitation.id]);
      await expect(auth.acceptInvitation({ token, password, displayName: 'User' })).rejects.toThrow('invalide');
    }
  });
  it('renouvelle une seule fois un jeton puis révoque aussi le JWT à la déconnexion', async () => {
    const login = await auth.login('admin@example.test', password);
    const results = await Promise.allSettled([auth.refresh(login.refreshToken), auth.refresh(login.refreshToken)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const renewed = results.find((result) => result.status === 'fulfilled');
    if (renewed?.status !== 'fulfilled') throw new Error('Renouvellement absent.');
    const identity = await auth.authenticate(renewed.value.accessToken);
    await auth.logout(identity.sessionId);
    await expect(auth.authenticate(renewed.value.accessToken)).rejects.toThrow('expirée');
    await expect(auth.refresh(renewed.value.refreshToken)).rejects.toThrow('expirée');
  }, 15000);
});
