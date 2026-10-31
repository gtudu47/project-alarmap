import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { access, mkdir, open, readFile, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Config } from './config.js';

export const MAX_ASSET_BYTES = 4 * 1024 * 1024;

/** Les clés sont générées côté serveur et ne peuvent jamais sortir du dossier racine. */
export interface Storage {
  ready(): Promise<void>;
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  close(): void;
}
function validKey(key: string): string {
  if (!/^assets\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/.test(key)) throw new Error('Clé de stockage invalide.');
  return key;
}
export function createStorage(config: Config): Storage {
  if (config.STORAGE_DRIVER === 'local') {
    const path = (key: string) => join(config.STORAGE_PATH, ...validKey(key).split('/'));
    return {
      async ready() {
        await mkdir(config.STORAGE_PATH, { recursive: true });
        await access(config.STORAGE_PATH, constants.R_OK | constants.W_OK);
      },
      async put(key, data) {
        if (data.length > MAX_ASSET_BYTES) throw new Error('Objet de stockage trop grand.');
        const target = path(key); await mkdir(dirname(target), { recursive: true });
        const file = await open(target, 'wx');
        try { await file.writeFile(data); await file.close(); }
        catch (error) { try { await file.close(); } catch { /* Déjà fermé. */ } try { await unlink(target); } catch { /* Nettoyage au mieux. */ } throw error; }
      },
      async get(key) { return readFile(path(key)); },
      async remove(key) { await unlink(path(key)); },
      close() { /* Pas de connexion persistante. */ },
    };
  }
  const client = new S3Client({
    endpoint: config.S3_ENDPOINT, region: config.S3_REGION, forcePathStyle: true,
    credentials: { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY }, maxAttempts: 3,
  });
  return {
    async ready() { await client.send(new HeadBucketCommand({ Bucket: config.S3_BUCKET }), { abortSignal: AbortSignal.timeout(3000) }); },
    async put(key, data) { if (data.length > MAX_ASSET_BYTES) throw new Error('Objet de stockage trop grand.'); await client.send(new PutObjectCommand({ Bucket: config.S3_BUCKET, Key: validKey(key), Body: data, ContentType: 'application/octet-stream', IfNoneMatch: '*' }), { abortSignal: AbortSignal.timeout(15000) }); },
    async get(key) {
      const result = await client.send(new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: validKey(key) }), { abortSignal: AbortSignal.timeout(15000) });
      if (!result.Body) throw new Error('Objet de stockage invalide.');
      const reader = result.Body.transformToWebStream().getReader();
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        if (result.ContentLength !== undefined && result.ContentLength > MAX_ASSET_BYTES) throw new Error('Objet de stockage trop grand.');
        for (;;) {
          const part = await reader.read(); if (part.done) break;
          size += part.value.byteLength;
          if (size > MAX_ASSET_BYTES) throw new Error('Objet de stockage trop grand.');
          chunks.push(part.value);
        }
        return Buffer.concat(chunks, size);
      } catch (error) { try { await reader.cancel(); } catch { /* La connexion est déjà fermée. */ } throw error; }
      finally { reader.releaseLock(); }
    },
    async remove(key) { await client.send(new DeleteObjectCommand({ Bucket: config.S3_BUCKET, Key: validKey(key) }), { abortSignal: AbortSignal.timeout(15000) }); },
    close() { client.destroy(); },
  };
}
