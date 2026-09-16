import { Pool } from 'pg';
import type { Config } from './config.js';

export function createPool(config: Config): Pool {
  return new Pool({
    host: config.DB_HOST, port: config.DB_PORT, user: config.DB_USER,
    password: config.DB_PASSWORD, database: config.DB_NAME, max: 10,
    connectionTimeoutMillis: 3000, statement_timeout: 5000,
  });
}
