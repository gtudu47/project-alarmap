import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import type { Config } from '../config.js';

export const emailSchema = z.email().max(254).transform((email) => email.trim().toLowerCase());
export const passwordSchema = z.string().min(12, '12 caractères minimum.').max(128);
export const displayNameSchema = z.string().trim().min(1).max(80);
export const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const newToken = (): string => randomBytes(32).toString('hex');
export const digestToken = (token: string): string => createHash('sha256').update(token).digest('hex');
export const REFRESH_COOKIE = 'alarmap_refresh';
export const SESSION_DAYS = 7;

export async function signAccessToken(userId: string, sessionId: string, secret: string): Promise<string> {
  return new SignJWT({ sid: sessionId }).setProtectedHeader({ alg: 'HS256' })
    .setIssuer('alarmap').setAudience('alarmap-api').setSubject(userId)
    .setIssuedAt().setExpirationTime('15m').sign(new TextEncoder().encode(secret));
}
export async function verifyAccessToken(token: string, secret: string): Promise<{ userId: string; sessionId: string }> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'], issuer: 'alarmap', audience: 'alarmap-api' });
  return { userId: z.uuid().parse(payload.sub), sessionId: z.uuid().parse(payload['sid']) };
}
export function readRefreshCookie(header?: string): string | undefined {
  const value = header?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${REFRESH_COOKIE}=`))?.slice(REFRESH_COOKIE.length + 1);
  return tokenSchema.safeParse(value).success ? value : undefined;
}
export function allowedOrigin(origin: string | undefined, config: Pick<Config, 'PUBLIC_APP_URL' | 'NODE_ENV'>): boolean {
  if (!origin) return false;
  const allowed = new Set([new URL(config.PUBLIC_APP_URL).origin]);
  if (config.NODE_ENV !== 'production') for (const host of ['localhost', '127.0.0.1']) for (const port of [4200, 4201, 8080]) allowed.add(`http://${host}:${port}`);
  return allowed.has(origin);
}
