import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { allowedOrigin, digestToken, newToken, readRefreshCookie, signAccessToken, verifyAccessToken } from './security.js';

it('vérifie la signature, l’audience, les identifiants et l’expiration du JWT', async () => {
  const secret = newToken(); const userId = randomUUID(); const sessionId = randomUUID();
  const jwt = await signAccessToken(userId, sessionId, secret);
  expect(await verifyAccessToken(jwt, secret)).toEqual({ userId, sessionId });
  await expect(verifyAccessToken(jwt, newToken())).rejects.toThrow();
  const expired = await new SignJWT({ sid: sessionId }).setProtectedHeader({ alg: 'HS256' }).setIssuer('alarmap').setAudience('alarmap-api').setSubject(userId).setExpirationTime(1).sign(new TextEncoder().encode(secret));
  await expect(verifyAccessToken(expired, secret)).rejects.toThrow();
});
it('refuse les requêtes de renouvellement provenant d’un autre site', () => {
  const config = { PUBLIC_APP_URL: 'https://maps.example.test', NODE_ENV: 'production' as const };
  expect(allowedOrigin('https://maps.example.test', config)).toBe(true);
  expect(allowedOrigin('https://maps.example.test.evil.test', config)).toBe(false);
  expect(allowedOrigin('http://localhost:4200', config)).toBe(false);
  expect(allowedOrigin(undefined, config)).toBe(false);
});
it('ne stocke qu’une empreinte des secrets à usage unique', () => {
  const token = newToken();
  expect(digestToken(token)).not.toBe(token);
  expect(readRefreshCookie(`other=x; alarmap_refresh=${token}`)).toBe(token);
  expect(readRefreshCookie('alarmap_refresh=malformed')).toBeUndefined();
});

it('accepte les deux adresses de boucle locale sur le protocole et le port configurés', () => {
  const config = { PUBLIC_APP_URL: 'http://localhost:8080', NODE_ENV: 'production' as const };
  expect(allowedOrigin('http://localhost:8080', config)).toBe(true);
  expect(allowedOrigin('http://127.0.0.1:8080', config)).toBe(true);
  expect(allowedOrigin('http://127.0.0.1:8081', config)).toBe(false);
  expect(allowedOrigin('https://127.0.0.1:8080', config)).toBe(false);
  expect(allowedOrigin('http://localhost.attacker.test:8080', config)).toBe(false);
  expect(allowedOrigin('http://localhost:8080', { ...config, PUBLIC_APP_URL: 'https://maps.example.test' })).toBe(false);
});
