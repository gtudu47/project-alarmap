// À exécuter dans le conteneur API : paramètres S3 déjà présents dans son environnement.
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { strict as assert } from 'node:assert';

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
