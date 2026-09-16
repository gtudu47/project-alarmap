import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readConfig } from '../src/config.js';
import { createPool } from '../src/database.js';
import { migrate } from '../src/migrations.js';

test('migrations idempotentes et isolement des références entre mondes', async () => {
  const pool = createPool(readConfig());
  try {
    await migrate(pool); await migrate(pool);
    const extension = await pool.query('SELECT PostGIS_Version() AS version');
    assert.ok(extension.rows[0].version);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const user = randomUUID(); const worldA = randomUUID(); const worldB = randomUUID(); const layer = randomUUID();
      await client.query('INSERT INTO users(id,email,password_hash) VALUES ($1,$2,$3)', [user, `${user}@example.test`, 'not-a-real-password']);
      for (const world of [worldA, worldB]) await client.query('INSERT INTO worlds(id,owner_id,name,slug,radius_km) VALUES($1,$2,$3,$4,$5)', [world, user, 'Test', `test-${world}`, 100]);
      await client.query('INSERT INTO layers(id,world_id,name) VALUES($1,$2,$3)', [layer, worldA, 'Test']);
      await assert.rejects(client.query("INSERT INTO map_objects(id,world_id,layer_id,kind,name,geometry) VALUES($1,$2,$3,'city','Test',ST_SetSRID(ST_MakePoint(0,0),4326))", [randomUUID(), worldB, layer]), (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === '23503');
    } finally { await client.query('ROLLBACK'); client.release(); }
  } finally { await pool.end(); }
});
