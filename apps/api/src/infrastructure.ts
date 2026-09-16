import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { readConfig } from './config.js';
import { createPool } from './database.js';
import { createStorage } from './storage.js';

@Injectable()
export class Infrastructure implements OnApplicationShutdown {
  readonly config = readConfig();
  readonly pool = createPool(this.config);
  readonly storage = createStorage(this.config);
  constructor() { this.pool.on('error', () => console.error('Connexion PostgreSQL interrompue.')); }
  async onApplicationShutdown(): Promise<void> { this.storage.close(); await this.pool.end(); }
}
