import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('migrations portables', () => {
  it('conserve des fins de ligne LF identiques sur Windows et Linux', async () => {
    const directory = fileURLToPath(new URL('../migrations/', import.meta.url));
    const files = (await readdir(directory)).filter(file => /^\d+_[\w-]+\.sql$/.test(file));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = await readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8');
      expect(content.includes('\r'), `${file} doit utiliser des fins de ligne LF.`).toBe(false);
    }
  });
});
