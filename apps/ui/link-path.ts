import type { MapObject } from '@alarmap/map-model';

export interface LinkKeys { ownerKey: string; worldKey: string; objectKey?: string }
export interface MapLink extends LinkKeys { type?: 'point' | 'trace' | 'territoire' | 'objet' }
const key = '[a-f0-9]{50}';
const pathPattern = new RegExp('^/(?:viewer/|embed/)?(' + key + ')/monde/(' + key + ')(?:/(point|trace|territoire|objet)/(' + key + '))?/?$');
export function parseMapLink(path: string): MapLink | null {
  const match = pathPattern.exec(path); if (!match) return null;
  const result: MapLink = { ownerKey: match[1]!, worldKey: match[2]! };
  if (match[3] && match[4]) { result.type = match[3] as MapLink['type']; result.objectKey = match[4]; }
  return result;
}
export function objectLinkType(object: MapObject): NonNullable<MapLink['type']> {
  if (object.geometry.type === 'Point') return 'point';
  if (object.geometry.type === 'LineString') return 'trace';
  if (object.geometry.type === 'Polygon' || object.geometry.type === 'MultiPolygon') return 'territoire';
  return 'objet';
}
export function formatMapLink(keys: LinkKeys, object: MapObject | undefined, mode: 'editor' | 'viewer'): string {
  if (!new RegExp('^' + key + '$').test(keys.ownerKey) || !new RegExp('^' + key + '$').test(keys.worldKey) ||
      (object && (!keys.objectKey || !new RegExp('^' + key + '$').test(keys.objectKey)))) throw new Error('Identifiant de lien invalide.');
  return (mode === 'viewer' ? '/viewer/' : '/') + keys.ownerKey + '/monde/' + keys.worldKey + (object ? '/' + objectLinkType(object) + '/' + keys.objectKey : '');
}
