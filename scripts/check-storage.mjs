// À exécuter dans le conteneur API : paramètres S3 déjà présents dans son environnement.
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { strict as assert } from 'node:assert';
import { readConfig } from './apps/api/dist/config.js';
import { createStorage } from './apps/api/dist/storage.js';

const { S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET } = process.env;
assert.ok(S3_ENDPOINT && S3_ACCESS_KEY && S3_SECRET_KEY && S3_BUCKET, 'Configuration S3 requise.');
const client = new S3Client({ endpoint: S3_ENDPOINT, region: S3_REGION || 'us-east-1', forcePathStyle: true,
  credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY }, maxAttempts: 2 });
const object = { Bucket: S3_BUCKET, Key: 'installation-tests/' + randomUUID() };
const content = 'AlarMap : contrôle écriture et lecture S3';
let created = false;
try {
  await client.send(new PutObjectCommand({ ...object, Body: content, IfNoneMatch: '*' }), { abortSignal: AbortSignal.timeout(15000) });
  created = true;
  const result = await client.send(new GetObjectCommand(object), { abortSignal: AbortSignal.timeout(15000) });
  assert.equal(await result.Body.transformToString(), content);
} finally {
  try { if (created) await client.send(new DeleteObjectCommand(object), { abortSignal: AbortSignal.timeout(15000) }); }
  finally { client.destroy(); }
}
console.log('Stockage S3 : écriture, lecture et nettoyage réussis.');

// Tester aussi l’adaptateur utilisé par l’API, et pas seulement le SDK S3.
const storage = createStorage(readConfig());
const assetKey = `assets/${randomUUID()}/${randomUUID()}`;
const bytes = Buffer.from('AlarMap : image temporaire');
let stored = false;
try {
  await storage.ready(); await storage.put(assetKey, bytes); stored = true;
  assert.deepEqual(await storage.get(assetKey), bytes);
  await assert.rejects(storage.put(assetKey, Buffer.from('autre')), error => error?.name === 'PreconditionFailed' || error?.$metadata?.httpStatusCode === 412);
  assert.deepEqual(await storage.get(assetKey), bytes);
} finally {
  try {
    if (stored) {
      try { await storage.remove(assetKey); }
      catch {
        // Une connexion rompue ne doit pas laisser le fichier temporaire derrière elle.
        const cleanup = createStorage(readConfig());
        try { await cleanup.remove(assetKey); } finally { cleanup.close(); }
      }
    }
  } finally { storage.close(); }
}
console.log('Adaptateur S3 : écriture, lecture, immutabilité et nettoyage réussis.');
