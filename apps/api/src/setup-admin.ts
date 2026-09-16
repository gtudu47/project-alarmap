import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { newToken, digestToken } from './auth/security.js';
import { createPool } from './database.js';
import { readConfig } from './config.js';

const config = readConfig();
const pool = createPool(config);
try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(719042)');
    if ((await client.query('SELECT 1 FROM users LIMIT 1')).rowCount) throw new Error('L’instance possède déjà des comptes.');
    const token = newToken();
    await client.query("INSERT INTO setup_tokens(singleton,token_hash,expires_at) VALUES(true,$1,now()+interval '1 hour') ON CONFLICT(singleton) DO UPDATE SET token_hash=EXCLUDED.token_hash,expires_at=EXCLUDED.expires_at,consumed_at=NULL", [digestToken(token)]);
    const url = new URL(config.PUBLIC_APP_URL); url.hash = `setup=${token}`;
    const directory = resolve('secrets'); await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(resolve(directory, 'admin-setup.txt'), `${url.toString()}\n`, { mode: 0o600 });
    await client.query('COMMIT');
    console.info('Lien à usage unique créé dans secrets/admin-setup.txt (valide une heure). Ouvrez ce lien dans votre navigateur.');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
} catch { console.error('Initialisation impossible : vérifiez les migrations, PostgreSQL et l’absence de comptes existants.'); process.exitCode = 1; }
finally { await pool.end(); }
