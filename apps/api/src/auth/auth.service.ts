import { ConflictException, Inject, Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { hash, verify, argon2id } from 'argon2';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { Infrastructure } from '../infrastructure.js';
import { digestToken, newToken, SESSION_DAYS, signAccessToken, verifyAccessToken } from './security.js';

export interface Account { id: string; email: string; displayName: string; isAdmin: boolean }
export interface Principal extends Account { sessionId: string }
interface UserRow { id: string; email: string; display_name: string; is_admin: boolean; password_hash: string }
export interface AuthResult { user: Account; accessToken: string; refreshToken: string }
const account = (user: UserRow): Account => ({ id: user.id, email: user.email, displayName: user.display_name, isAdmin: user.is_admin });
const passwordOptions = { type: argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 } as const;

@Injectable()
export class AuthService {
  constructor(@Inject(Infrastructure) private readonly infrastructure: Infrastructure) {}
  private get pool() { return this.infrastructure.pool; }

  async status(): Promise<{ initialized: boolean; registration: string }> {
    const result = await this.pool.query('SELECT 1 FROM users LIMIT 1');
    return { initialized: result.rowCount !== 0, registration: 'invite_only' };
  }
  private async issueSession(user: UserRow, client: PoolClient): Promise<AuthResult> {
    const sessionId = randomUUID(); const refreshToken = newToken();
    await client.query("INSERT INTO sessions(id,user_id,refresh_hash,expires_at) VALUES($1,$2,$3,now() + interval '7 days')", [sessionId, user.id, digestToken(refreshToken)]);
    return { user: account(user), refreshToken, accessToken: await signAccessToken(user.id, sessionId, this.infrastructure.config.JWT_SECRET) };
  }
  async setup(input: { token: string; email: string; password: string; displayName: string }): Promise<AuthResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(719042)');
      if ((await client.query('SELECT 1 FROM users LIMIT 1')).rowCount) throw new ConflictException('L’instance est déjà initialisée.');
      const token = await client.query('UPDATE setup_tokens SET consumed_at=now() WHERE singleton=true AND token_hash=$1 AND consumed_at IS NULL AND expires_at>now() RETURNING singleton', [digestToken(input.token)]);
      if (!token.rowCount) throw new BadRequestException('Lien d’initialisation invalide ou expiré.');
      const user = await this.insertUser(client, input.email, input.password, input.displayName, true);
      const result = await this.issueSession(user, client);
      await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  private async insertUser(client: PoolClient, email: string, password: string, displayName: string, isAdmin: boolean): Promise<UserRow> {
    const existing = await client.query('SELECT 1 FROM users WHERE lower(email)=lower($1)', [email]);
    if (existing.rowCount) throw new ConflictException('Ce compte existe déjà. Connectez-vous.');
    const passwordHash = await hash(password, passwordOptions);
    const result = await client.query<UserRow>('INSERT INTO users(id,email,password_hash,display_name,is_admin) VALUES($1,$2,$3,$4,$5) RETURNING *', [randomUUID(), email, passwordHash, displayName, isAdmin]);
    return result.rows[0]!;
  }
  async login(email: string, password: string): Promise<AuthResult> {
    const result = await this.pool.query<UserRow>('SELECT * FROM users WHERE lower(email)=lower($1)', [email]);
    const user = result.rows[0];
    if (!user) { await hash(password, passwordOptions); throw new UnauthorizedException('Email ou mot de passe incorrect.'); }
    if (!await verify(user.password_hash, password)) throw new UnauthorizedException('Email ou mot de passe incorrect.');
    const client = await this.pool.connect();
    try { return await this.issueSession(user, client); } finally { client.release(); }
  }
  async authenticate(token: string): Promise<Principal> {
    let identity;
    try { identity = await verifyAccessToken(token, this.infrastructure.config.JWT_SECRET); }
    catch { throw new UnauthorizedException('Session invalide.'); }
    const result = await this.pool.query<UserRow>('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.id=$1 AND u.id=$2 AND s.revoked_at IS NULL AND s.expires_at>now()', [identity.sessionId, identity.userId]);
    if (!result.rows[0]) throw new UnauthorizedException('Session expirée.');
    return { ...account(result.rows[0]), sessionId: identity.sessionId };
  }
  async refresh(token: string): Promise<AuthResult> {
    const refreshToken = newToken();
    const result = await this.pool.query<UserRow & { session_id: string }>(`WITH renewed AS (
      UPDATE sessions SET refresh_hash=$2 WHERE refresh_hash=$1 AND revoked_at IS NULL AND expires_at>now() RETURNING id,user_id
    ) SELECT u.*, renewed.id AS session_id FROM renewed JOIN users u ON u.id=renewed.user_id`, [digestToken(token), digestToken(refreshToken)]);
    const user = result.rows[0];
    if (!user) throw new UnauthorizedException('Session expirée.');
    return { user: account(user), refreshToken, accessToken: await signAccessToken(user.id, user.session_id, this.infrastructure.config.JWT_SECRET) };
  }
  async logout(sessionId: string): Promise<void> {
    await this.pool.query('UPDATE sessions SET revoked_at=now() WHERE id=$1 AND revoked_at IS NULL', [sessionId]);
  }
  async createInvitation(email: string, createdBy: string): Promise<{ id: string; email: string; url: string; expiresAt: Date }> {
    if ((await this.pool.query('SELECT 1 FROM users WHERE lower(email)=lower($1)', [email])).rowCount) throw new ConflictException('Ce compte existe déjà.');
    const token = newToken(); const id = randomUUID();
    const result = await this.pool.query<{ expires_at: Date }>("INSERT INTO invitations(id,email,token_hash,created_by,expires_at) VALUES($1,$2,$3,$4,now() + interval '7 days') RETURNING expires_at", [id, email, digestToken(token), createdBy]);
    const url = new URL(this.infrastructure.config.PUBLIC_APP_URL); url.hash = `invite=${token}`;
    return { id, email, url: url.toString(), expiresAt: result.rows[0]!.expires_at };
  }
  async listInvitations(): Promise<unknown[]> {
    const result = await this.pool.query('SELECT id,email,created_at AS "createdAt",expires_at AS "expiresAt",used_at AS "usedAt",revoked_at AS "revokedAt" FROM invitations ORDER BY created_at DESC LIMIT 100');
    return result.rows;
  }
  async revokeInvitation(id: string): Promise<void> {
    const result = await this.pool.query('UPDATE invitations SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1 RETURNING id', [id]);
    if (!result.rowCount) throw new NotFoundException();
  }
  async acceptInvitation(input: { token: string; password: string; displayName: string }): Promise<AuthResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const invitation = await client.query<{ email: string }>('UPDATE invitations SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at>now() RETURNING email', [digestToken(input.token)]);
      if (!invitation.rows[0]) throw new BadRequestException('Invitation invalide ou expirée.');
      const user = await this.insertUser(client, invitation.rows[0].email, input.password, input.displayName, false);
      const result = await this.issueSession(user, client);
      await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  readonly sessionMaxAge = SESSION_DAYS * 86400 * 1000;
}
