import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { hash } from 'argon2';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import { Infrastructure } from '../src/infrastructure.js';
import { migrate } from '../src/migrations.js';

test('HTTP : comptes, isolation des mondes, lecture seule, révisions et révocation', async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  const infra = app.get(Infrastructure);
  const users = [randomUUID(), randomUUID()];
  const password = 'Mot de passe integration 2026!';
  try {
    await migrate(infra.pool);
    const passwordHash = await hash(password);
    for (const [index, id] of users.entries()) await infra.pool.query('INSERT INTO users(id,email,password_hash,display_name,is_admin) VALUES($1,$2,$3,$4,$5)', [id, `${id}@example.test`, passwordHash, `Test ${index}`, index === 0]);
    await app.listen(0, '127.0.0.1');
    const origin = new URL(infra.config.PUBLIC_APP_URL).origin;
    const base = `${await app.getUrl()}/api/v1`;
    const request = (path: string, token?: string, body?: unknown, method?: string) => fetch(base + path, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers: { 'Content-Type': 'application/json', Origin: origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const tokens: string[] = [];
    for (const id of users) {
      const response = await request('/auth/login', undefined, { email: `${id}@example.test`, password });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('set-cookie') ?? '', /HttpOnly/);
      tokens.push((await response.json() as { accessToken: string }).accessToken);
    }
    assert.equal((await request('/worlds')).status, 401);
    assert.equal((await request('/invitations', tokens[1], { email: 'cannot-invite@example.test' })).status, 403);
    const created = await request('/worlds', tokens[0], { name: 'Monde de test privé', radiusKm: 100 });
    assert.equal(created.status, 201);
    const { world } = await created.json() as { world: { id: string; revision: number } };
    assert.deepEqual(await (await request('/worlds', tokens[1])).json(), []);
    assert.equal((await request(`/worlds/${world.id}`, tokens[1])).status, 404);
    const point = { name: 'Lieu de test', longitude: 175, latitude: -20, revision: 0 };
    assert.equal((await request(`/worlds/${world.id}/points`, tokens[1], point)).status, 404);
    await infra.pool.query("INSERT INTO members(world_id,user_id,role) VALUES($1,$2,'viewer')", [world.id, users[1]]);
    assert.equal((await request(`/worlds/${world.id}`, tokens[1])).status, 200);
    assert.equal((await request(`/worlds/${world.id}/points`, tokens[1], point)).status, 403);
    assert.equal((await request(`/worlds/${world.id}/points`, tokens[0], { ...point, latitude: 91 })).status, 400);
    const concurrent = await Promise.all([request(`/worlds/${world.id}/points`, tokens[0], point), request(`/worlds/${world.id}/points`, tokens[0], point)]);
    assert.deepEqual(concurrent.map((response) => response.status).sort(), [201, 409]);
    const reopened = await (await request(`/worlds/${world.id}`, tokens[0])).json() as { world: { revision: number; objects: { geometry: { coordinates: number[] } }[] } };
    assert.equal(reopened.world.revision, 1);
    assert.equal(reopened.world.objects.length, 1);
    assert.deepEqual(reopened.world.objects[0]?.geometry.coordinates, [175, -20]);
    assert.equal((await request('/auth/logout', tokens[0], {}, 'POST')).status, 204);
    assert.equal((await request('/worlds', tokens[0])).status, 401);
  } finally {
    await infra.pool.query('DELETE FROM worlds WHERE owner_id=ANY($1::uuid[])', [users]);
    await infra.pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users]);
    await app.close();
  }
});
