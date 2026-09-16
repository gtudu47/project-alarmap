import { randomBytes } from 'node:crypto';
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
let template = await readFile(new URL('.env.example', root), 'utf8');
for (const variable of ['DB_PASSWORD', 'JWT_SECRET', 'S3_SECRET_KEY']) {
  template = template.replace(new RegExp(`^${variable}=.*$`, 'm'), `${variable}=${randomBytes(32).toString('hex')}`);
}
try {
  await writeFile(new URL('.env', root), template, { flag: 'wx', mode: 0o600 });
  console.info(`Configuration locale créée : ${fileURLToPath(new URL('.env', root))}. Aucun secret affiché.`);
} catch (error) {
  if (error.code === 'EEXIST') console.info('.env existe déjà ; aucune modification.');
  else throw error;
}
