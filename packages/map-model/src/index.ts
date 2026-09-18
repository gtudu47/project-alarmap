import { z } from 'zod';

export const SCHEMA_VERSION = 1;
export const coordinateSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
export type Coordinate = z.infer<typeof coordinateSchema>;
const ringSchema = z.array(coordinateSchema).min(4).refine((ring) => {
  const first = ring[0];
  const last = ring.at(-1);
  return first?.[0] === last?.[0] && first?.[1] === last?.[1];
}, 'Un anneau doit être fermé.');
export const geometrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Point'), coordinates: coordinateSchema }),
  z.object({ type: z.literal('LineString'), coordinates: z.array(coordinateSchema).min(2) }),
  z.object({ type: z.literal('Polygon'), coordinates: z.array(ringSchema).min(1) }),
  z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(z.array(ringSchema).min(1)).min(1) }),
]);
export type Geometry = z.infer<typeof geometrySchema>;

const periodFields = { startYear: z.number().int().optional(), endYear: z.number().int().optional() };
export interface Period { startYear?: number; endYear?: number }
const validPeriod = (period: Period): boolean => period.startYear === undefined || period.endYear === undefined || period.startYear < period.endYear;
export const periodSchema = z.object(periodFields).refine(validPeriod, 'La fin doit suivre le début.');
export function isActiveAt(period: Period, year: number): boolean {
  return (period.startYear === undefined || year >= period.startYear) && (period.endYear === undefined || year < period.endYear);
}

export const publicationStatusSchema = z.enum(['draft', 'private', 'unlisted', 'public']);
export const roleSchema = z.enum(['owner', 'editor', 'viewer']);
export type MemberRole = z.infer<typeof roleSchema>;
export const layerSchema = z.object({
  id: z.uuid(), name: z.string().trim().min(1).max(120), visible: z.boolean(), locked: z.boolean(),
  opacity: z.number().min(0).max(1), order: z.number().int(),
});
export type MapLayer = z.infer<typeof layerSchema>;
export const objectSchema = z.object({
  id: z.uuid(), layerId: z.uuid(), name: z.string().max(200),
  kind: z.string().min(1).max(80), geometry: geometrySchema,
  style: z.object({ color: z.string().regex(/^#[0-9a-fA-F]{6}$/), opacity: z.number().min(0).max(1) }),
  properties: z.record(z.string(), z.unknown()), ...periodFields,
}).refine(validPeriod, 'Période invalide.');
export const lineObjectSchema = objectSchema.refine(object => {
  if (object.geometry.type !== 'LineString' || !['road','river'].includes(object.kind) || !object.name.trim()) return false;
  const points = object.geometry.coordinates;
  return points.length <= 2000 && points.some(p => p[0] !== points[0]![0] || p[1] !== points[0]![1]);
}, 'Une route ou rivière exige 2 à 2 000 sommets, dont deux distincts, et un nom.');
export type MapObject = z.infer<typeof objectSchema>;
export const worldSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION), id: z.uuid(), name: z.string().trim().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  radiusKm: z.number().positive().max(1_000_000_000), revision: z.number().int().nonnegative(),
  status: publicationStatusSchema, layers: z.array(layerSchema), objects: z.array(objectSchema),
}).superRefine((world, ctx) => {
  const layerIds = new Set(world.layers.map((layer) => layer.id));
  if (layerIds.size !== world.layers.length) ctx.addIssue({ code: 'custom', message: 'Identifiant de calque dupliqué.' });
  if (new Set(world.objects.map((object) => object.id)).size !== world.objects.length) ctx.addIssue({ code: 'custom', message: 'Identifiant d’objet dupliqué.' });
  world.objects.forEach((object, index) => {
    if (!layerIds.has(object.layerId)) ctx.addIssue({ code: 'custom', path: ['objects', index, 'layerId'], message: 'Calque inexistant.' });
  });
});
export type World = z.infer<typeof worldSchema>;

export const religionSchema = z.object({
  id: z.uuid(), worldId: z.uuid(), name: z.string().min(1), slug: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/), description: z.string().optional(),
  parentReligionId: z.uuid().optional(), religionType: z.string().optional(),
  foundedYear: z.number().int().optional(), extinctYear: z.number().int().optional(),
  headquartersSiteId: z.uuid().optional(), metadata: z.record(z.string(), z.unknown()).optional(),
}).refine((religion) => religion.parentReligionId !== religion.id, 'Une religion ne peut être sa propre parente.')
  .refine((religion) => validPeriod({ startYear: religion.foundedYear, endYear: religion.extinctYear }), 'Période invalide.');
export type Religion = z.infer<typeof religionSchema>;
export const relationSchema = z.object({
  id: z.uuid(), worldId: z.uuid(), religionAId: z.uuid(), religionBId: z.uuid(),
  relationType: z.enum(['allied', 'friendly', 'tolerant', 'neutral', 'rival', 'hostile', 'persecuted', 'religious_war', 'syncretic']),
  relationScore: z.number().min(-100).max(100).optional(), description: z.string().optional(), ...periodFields,
}).refine(validPeriod, 'Période invalide.')
  .refine((relation) => relation.religionAId !== relation.religionBId, 'Deux religions distinctes sont nécessaires.');
/** Pour persecuted : A est l’auteur, B la cible. Absence de relation != neutral. */
export type InterreligiousRelation = z.infer<typeof relationSchema>;

export function createDemoWorld(): World {
  return worldSchema.parse({
    schemaVersion: 1, id: '00000000-0000-4000-8000-000000000001', name: 'Monde de démonstration',
    slug: 'demonstration', radiusKm: 6371, revision: 0, status: 'draft',
    layers: [{ id: '00000000-0000-4000-8000-000000000002', name: 'Repères géographiques', visible: true, locked: false, opacity: 1, order: 0 }],
    objects: [
      { id: '00000000-0000-4000-8000-000000000003', layerId: '00000000-0000-4000-8000-000000000002', name: 'Origine', kind: 'city', geometry: { type: 'Point', coordinates: [0, 0] }, style: { color: '#e6b96c', opacity: 1 }, properties: {} },
      { id: '00000000-0000-4000-8000-000000000004', layerId: '00000000-0000-4000-8000-000000000002', name: 'Passage de l’antiméridien', kind: 'road', geometry: { type: 'LineString', coordinates: [[170, 20], [-170, 30]] }, style: { color: '#6ccbbd', opacity: 1 }, properties: {} },
    ],
  });
}
