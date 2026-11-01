import { describe, expect, it } from 'vitest';
import { createDemoWorld } from '@alarmap/map-model';
import { formatMapLink, parseMapLink } from './link-path';
const keys = { ownerKey: 'a'.repeat(50), worldKey: 'b'.repeat(50), objectKey: 'c'.repeat(50) };
describe('adresses des mondes', () => {
  it('reconnaît les liens privés, publiés et de fiches', () => {
    const object = createDemoWorld().objects[0]!;
    const privatePath = formatMapLink(keys,object,'editor');
    expect(parseMapLink(privatePath)).toMatchObject({ ...keys, type: 'point' });
    expect(parseMapLink(formatMapLink(keys,object,'viewer'))).toMatchObject({ ...keys, type: 'point' });
    expect(parseMapLink(formatMapLink(keys,undefined,'editor'))).toEqual({ ownerKey: keys.ownerKey, worldKey: keys.worldKey });
  });
  it('rejette les segments manquants ou non conformes', () => {
    expect(parseMapLink('/viewer/?world=ancien')).toBeNull();
    expect(parseMapLink('/a/monde/b')).toBeNull();
    expect(() => formatMapLink({ ...keys, worldKey: 'abc' },undefined,'editor')).toThrow();
  });
});
