import { readConfig } from './config.js';
import { createPool } from './database.js';
import { migrate } from './migrations.js';

const pool = createPool(readConfig());
try {
  await migrate(pool);
  console.info('Migrations appliquées.');
} catch {
  console.error('Échec des migrations. Vérifiez la connexion et la compatibilité du schéma.');
  process.exitCode = 1;
} finally { await pool.end(); }
