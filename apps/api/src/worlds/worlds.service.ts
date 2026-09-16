import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { worldSchema, type World, type MemberRole } from '@alarmap/map-model';
import { Infrastructure } from '../infrastructure.js';

export interface WorldSummary { id: string; name: string; slug: string; radiusKm: number; revision: number; role: MemberRole }

@Injectable()
export class WorldsService {
  constructor(@Inject(Infrastructure) private readonly infrastructure: Infrastructure) {}
  private get pool() { return this.infrastructure.pool; }
  async list(userId: string): Promise<WorldSummary[]> {
    const result = await this.pool.query<WorldSummary>(`SELECT w.id,w.name,w.slug,w.radius_km AS "radiusKm",w.revision,
      CASE WHEN w.owner_id=$1 THEN 'owner' ELSE m.role END AS role
      FROM worlds w LEFT JOIN members m ON m.world_id=w.id AND m.user_id=$1
      WHERE w.owner_id=$1 OR m.user_id=$1 ORDER BY w.updated_at DESC LIMIT 100`, [userId]);
    return result.rows;
  }
  async create(userId: string, input: { name: string; radiusKm: number }): Promise<{ world: World; role: MemberRole }> {
    const id = randomUUID(); const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO worlds(id,owner_id,name,slug,radius_km) VALUES($1,$2,$3,$4,$5)', [id, userId, input.name, `monde-${id}`, input.radiusKm]);
      await client.query("INSERT INTO members(world_id,user_id,role) VALUES($1,$2,'owner')", [id, userId]);
      await client.query("INSERT INTO layers(id,world_id,name) VALUES($1,$2,'Mes lieux')", [randomUUID(), id]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
    return this.get(userId, id);
  }
  async get(userId: string, id: string): Promise<{ world: World; role: MemberRole }> {
    const result = await this.pool.query<{ document: unknown; role: MemberRole }>(`SELECT
      CASE WHEN w.owner_id=$2 THEN 'owner' ELSE m.role END AS role,
      jsonb_build_object('schemaVersion',w.schema_version,'id',w.id,'name',w.name,'slug',w.slug,
        'radiusKm',w.radius_km,'revision',w.revision,'status',w.status,
        'layers',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'visible',l.visible,
          'locked',l.locked,'opacity',l.opacity,'order',l.sort_order) ORDER BY l.sort_order,l.id) FROM layers l WHERE l.world_id=w.id),'[]'::jsonb),
        'objects',COALESCE((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',o.id,'layerId',o.layer_id,
          'name',o.name,'kind',o.kind,'geometry',ST_AsGeoJSON(o.geometry)::jsonb,'style',o.style,
          'properties',o.properties,'startYear',o.start_year,'endYear',o.end_year)) ORDER BY o.id)
          FROM map_objects o WHERE o.world_id=w.id),'[]'::jsonb)) AS document
      FROM worlds w LEFT JOIN members m ON m.world_id=w.id AND m.user_id=$2
      WHERE w.id=$1 AND (w.owner_id=$2 OR m.user_id=$2)`, [id, userId]);
    if (!result.rows[0]) throw new NotFoundException('Monde introuvable.');
    return { world: worldSchema.parse(result.rows[0].document), role: result.rows[0].role };
  }
  async addPoint(userId: string, id: string, input: { name: string; longitude: number; latitude: number; revision: number }): Promise<{ world: World; role: MemberRole }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const permission = await client.query<{ revision: number; owner_id: string; role: MemberRole | null }>(`SELECT w.revision,w.owner_id,m.role FROM worlds w
        LEFT JOIN members m ON m.world_id=w.id AND m.user_id=$2
        WHERE w.id=$1 AND (w.owner_id=$2 OR m.user_id=$2) FOR UPDATE OF w`, [id, userId]);
      const world = permission.rows[0];
      if (!world) throw new NotFoundException('Monde introuvable.');
      if (world.owner_id !== userId && world.role !== 'editor') throw new ForbiddenException('Ce monde est en lecture seule.');
      if (world.revision !== input.revision) throw new ConflictException('Le monde a changé. Rechargez-le avant de réessayer.');
      const layer = await client.query<{ id: string }>('SELECT id FROM layers WHERE world_id=$1 AND NOT locked ORDER BY sort_order,id LIMIT 1', [id]);
      if (!layer.rows[0]) throw new ConflictException('Aucun calque modifiable.');
      await client.query(`INSERT INTO map_objects(id,world_id,layer_id,kind,name,geometry,style)
        VALUES($1,$2,$3,'city',$4,ST_SetSRID(ST_MakePoint($5,$6),4326),$7::jsonb)`,
      [randomUUID(), id, layer.rows[0].id, input.name, input.longitude, input.latitude, JSON.stringify({ color: '#e6b96c', opacity: 1 })]);
      await client.query('UPDATE worlds SET revision=revision+1,updated_at=now() WHERE id=$1', [id]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
    return this.get(userId, id);
  }
}
