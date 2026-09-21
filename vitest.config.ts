import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Les tests s’exécutent avant le build, y compris sur un checkout neuf en CI.
  resolve: {
    alias: Object.fromEntries(['map-model', 'map-engine', 'map-sdk', 'shared'].map(name => [
      '@alarmap/' + name, fileURLToPath(new URL('./packages/' + name + '/src/index.ts', import.meta.url)),
    ])),
  },
  test: { include: ['packages/**/*.test.ts', 'apps/api/**/*.test.ts', 'scripts/**/*.test.ts'] },
});
