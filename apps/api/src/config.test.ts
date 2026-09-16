import { expect, it } from 'vitest';
import { readConfig } from './config.js';

const development = { DB_HOST: 'localhost', DB_USER: 'alarmap', DB_PASSWORD: 'local', DB_NAME: 'alarmap', JWT_SECRET: 'local', PUBLIC_APP_URL: 'http://localhost:8080' };
it('rejette les secrets d’exemple en production sans les révéler', () => {
  expect(() => readConfig({ ...development, NODE_ENV: 'production' })).toThrow('DB_PASSWORD');
  expect(() => readConfig({ ...development, NODE_ENV: 'production' })).not.toThrow('Configuration invalide : local');
});
it('refuse les canaux de développement pour les installations', () => {
  expect(() => readConfig({ ...development, INSTALL_CHANNEL: 'dev' })).toThrow('INSTALL_CHANNEL');
});
it('valide les identifiants S3 et les ports', () => {
  expect(() => readConfig({ ...development, STORAGE_DRIVER: 's3' })).toThrow('S3_ACCESS_KEY');
  expect(() => readConfig({ ...development, API_PORT: '70000' })).toThrow('API_PORT');
  expect(readConfig(development).API_PORT).toBe(3000);
});
