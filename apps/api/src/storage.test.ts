import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readConfig } from './config.js';
import { createStorage, MAX_ASSET_BYTES } from './storage.js';

describe('stockage local des images', () => {
  it('isole les clés, refuse les remplacements et relit les mêmes octets', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'alarmap-storage-test-'));
    expect(dirname(resolve(dir))).toBe(resolve(tmpdir()));
    const config = readConfig({ DB_HOST: 'localhost', DB_USER: 'test', DB_PASSWORD: 'test', DB_NAME: 'test', JWT_SECRET: 'test', PUBLIC_APP_URL: 'http://localhost', STORAGE_PATH: dir });
    const storage = createStorage(config); const key = `assets/${randomUUID()}/${randomUUID()}`; const data = Buffer.from('image de test');
    try {
      await storage.ready(); await storage.put(key, data);
      expect(await storage.get(key)).toEqual(data);
      await expect(storage.put(key, Buffer.from('remplacement'))).rejects.toThrow();
      expect(await storage.get(key)).toEqual(data);
      await expect(storage.get('../hors-du-stockage')).rejects.toThrow();
      await expect(storage.put(`assets/${randomUUID()}/${randomUUID()}`, Buffer.alloc(MAX_ASSET_BYTES + 1))).rejects.toThrow(/trop grand/);
      await storage.remove(key); await expect(storage.get(key)).rejects.toThrow();
    } finally { storage.close(); if (dirname(resolve(dir)) === resolve(tmpdir())) await rm(dir, { recursive: true, force: true }); }
  });
});
