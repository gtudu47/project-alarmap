import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';

export async function migrate(pool: Pool): Promise<void> {
  const directory = fileURLToPath(new URL('../migrations/', import.meta.url));
  const files = (await readdir(directory)).filter((file) => /^\d+_[\w-]+\.sql$/.test(file)).sort();
  const client = await pool.connect();
  try {
    await client.query('SET statement_timeout = 120000');
    await client.query('SELECT pg_advisory_lock(719041)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    for (const file of files) {
      const sql = await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const existing = await client.query<{ checksum: string }>('SELECT checksum FROM schema_migrations WHERE name = $1', [file]);
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`Migration modifiée après application : ${file}`);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(name, checksum) VALUES ($1, $2)', [file, checksum]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    try { await client.query('SELECT pg_advisory_unlock(719041)'); }
    finally { try { await client.query('RESET statement_timeout'); } finally { client.release(); } }
  }
}
