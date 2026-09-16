import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import type { Config } from './config.js';

/** Contrat du socle : stockage prêt. Les opérations d’assets seront ajoutées avec leurs permissions. */
export interface Storage { ready(): Promise<void>; close(): void }
export function createStorage(config: Config): Storage {
  if (config.STORAGE_DRIVER === 'local') return {
    async ready() {
      await mkdir(config.STORAGE_PATH, { recursive: true });
      await access(config.STORAGE_PATH, constants.R_OK | constants.W_OK);
    },
    close() { /* Pas de connexion persistante. */ },
  };
  const client = new S3Client({
    endpoint: config.S3_ENDPOINT, region: config.S3_REGION, forcePathStyle: true,
    credentials: { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY }, maxAttempts: 1,
  });
  return {
    async ready() { await client.send(new HeadBucketCommand({ Bucket: config.S3_BUCKET }), { abortSignal: AbortSignal.timeout(3000) }); },
    close() { client.destroy(); },
  };
}
