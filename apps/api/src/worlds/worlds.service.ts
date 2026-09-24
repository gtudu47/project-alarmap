import type { Pool, PoolClient } from 'pg';
import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { objectSchema, worldSchema, type World, type MapObject, type MemberRole } from '@alarmap/map-model';
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
  async get(userId: string, id: string, summary = false, objectId?: string, connection: Pool | PoolClient = this.pool): Promise<{ world: World; role: MemberRole; objectsComplete: boolean; objectCount: number }> {
    const result = await connection.query<{ document: unknown; role: MemberRole; objectCount: number }>(`SELECT
      CASE WHEN w.owner_id=$2 THEN 'owner' ELSE m.role END AS role,
      (SELECT count(*)::integer FROM map_objects o WHERE o.world_id=w.id) AS "objectCount",
      jsonb_build_object('schemaVersion',w.schema_version,'id',w.id,'name',w.name,'slug',w.slug,
        'radiusKm',w.radius_km,'revision',w.revision,'status',w.status,
        'layers',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'visible',l.visible,
          'locked',l.locked,'opacity',l.opacity,'order',l.sort_order) ORDER BY l.sort_order,l.id) FROM layers l WHERE l.world_id=w.id),'[]'::jsonb),
        'objects',CASE WHEN $3::boolean THEN '[]'::jsonb ELSE COALESCE((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',o.id,'layerId',o.layer_id,
          'name',o.name,'kind',o.kind,'geometry',ST_AsGeoJSON(o.geometry)::jsonb,'style',o.style,
          'properties',o.properties,'startYear',o.start_year,'endYear',o.end_year)) ORDER BY o.id)
          FROM map_objects o WHERE o.world_id=w.id AND ($4::uuid IS NULL OR o.id=$4)),'[]'::jsonb) END) AS document
      FROM worlds w LEFT JOIN members m ON m.world_id=w.id AND m.user_id=$2
      WHERE w.id=$1 AND (w.owner_id=$2 OR m.user_id=$2)`, [id, userId, summary, objectId ?? null]);
    if (!result.rows[0]) throw new NotFoundException('Monde introuvable.');
    return { world: worldSchema.parse(result.rows[0].document), role: result.rows[0].role, objectsComplete: !summary && !objectId, objectCount: result.rows[0].objectCount };
  }
  async addPoint(userId: string, id: string, input: { name: string; longitude: number; latitude: number; revision: number; layerId?: string }): Promise<{ world: World; role: MemberRole }> {
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
      const layer = await client.query<{ id: string }>('SELECT id FROM layers WHERE world_id=$1 AND NOT locked AND ($2::uuid IS NULL OR id=$2) ORDER BY sort_order,id LIMIT 1 FOR UPDATE', [id, input.layerId ?? null]);
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

  async changePoint(userId: string, id: string, pointId: string, revision: number, update?: { name: string; longitude: number; latitude: number }, geometryType = 'ST_Point', compact = false): Promise<{ world: World; role: MemberRole }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const permission = await client.query<{ revision: number; owner_id: string; role: MemberRole | null }>(`SELECT w.revision,w.owner_id,m.role FROM worlds w
        LEFT JOIN members m ON m.world_id=w.id AND m.user_id=$2
        WHERE w.id=$1 AND (w.owner_id=$2 OR m.user_id=$2) FOR UPDATE OF w`, [id, userId]);
      const world = permission.rows[0];
      if (!world) throw new NotFoundException('Monde introuvable.');
      if (world.owner_id !== userId && world.role !== 'editor') throw new ForbiddenException('Ce monde est en lecture seule.');
      if (world.revision !== revision) throw new ConflictException('Le monde a changé. Rechargez-le avant de réessayer.');
      const point = await client.query<{ locked: boolean }>(`SELECT l.locked FROM map_objects o JOIN layers l ON l.id=o.layer_id AND l.world_id=o.world_id
        WHERE o.id=$1 AND o.world_id=$2 AND ST_GeometryType(o.geometry)=$3 FOR UPDATE OF o,l`, [pointId, id, geometryType]);
      if (!point.rows[0]) throw new NotFoundException('Lieu introuvable.');
      if (point.rows[0].locked) throw new ConflictException('Ce calque est verrouillé.');
      if (update) await client.query('UPDATE map_objects SET name=$3,geometry=ST_SetSRID(ST_MakePoint($4,$5),4326) WHERE id=$1 AND world_id=$2', [pointId, id, update.name, update.longitude, update.latitude]);
      else await client.query('DELETE FROM map_objects WHERE id=$1 AND world_id=$2', [pointId, id]);
      await client.query('UPDATE worlds SET revision=revision+1,updated_at=now() WHERE id=$1', [id]);
      const result = compact ? await this.get(userId, id, false, pointId, client) : undefined;
      await client.query('COMMIT');
      if (result) return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
    return this.get(userId, id);
  }

  async restorePoint(userId: string, id: string, revision: number, point: MapObject, geometryType = 'ST_Point', compact = false): Promise<{ world: World; role: MemberRole }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const permission = await client.query<{ revision: number; owner_id: string; role: MemberRole | null }>(`SELECT w.revision,w.owner_id,m.role FROM worlds w
        LEFT JOIN members m ON m.world_id=w.id AND m.user_id=$2 WHERE w.id=$1 AND (w.owner_id=$2 OR m.user_id=$2) FOR UPDATE OF w`, [id, userId]);
      const world = permission.rows[0];
      if (!world) throw new NotFoundException('Monde introuvable.');
      if (world.owner_id !== userId && world.role !== 'editor') throw new ForbiddenException('Ce monde est en lecture seule.');
      if (world.revision !== revision) throw new ConflictException('Le monde a changé. Rechargez-le avant de réessayer.');
      const layer = await client.query<{ locked: boolean }>('SELECT locked FROM layers WHERE id=$1 AND world_id=$2 FOR UPDATE', [point.layerId, id]);
      if (!layer.rows[0]) throw new NotFoundException('Calque introuvable.');
      if (layer.rows[0].locked) throw new ConflictException('Ce calque est verrouillé.');
      const existing = await client.query<{ world_id: string; locked: boolean; geometry_type: string }>(`SELECT o.world_id,l.locked,ST_GeometryType(o.geometry) AS geometry_type
        FROM map_objects o JOIN layers l ON l.id=o.layer_id AND l.world_id=o.world_id WHERE o.id=$1 FOR UPDATE OF o,l`, [point.id]);
      if (existing.rows[0] && (existing.rows[0].world_id !== id || existing.rows[0].locked || existing.rows[0].geometry_type !== geometryType)) throw new ConflictException('Ce lieu ne peut pas être restauré.');
      const saved = await client.query(`INSERT INTO map_objects(id,world_id,layer_id,kind,name,geometry,style,properties,start_year,end_year)
        VALUES($1,$2,$3,$4,$5,ST_SetSRID(ST_GeomFromGeoJSON($6),4326),$7::jsonb,$8::jsonb,$9,$10)
        ON CONFLICT(id) DO UPDATE SET layer_id=EXCLUDED.layer_id,kind=EXCLUDED.kind,name=EXCLUDED.name,geometry=EXCLUDED.geometry,
        style=EXCLUDED.style,properties=EXCLUDED.properties,start_year=EXCLUDED.start_year,end_year=EXCLUDED.end_year
        WHERE map_objects.world_id=EXCLUDED.world_id`, [point.id,id,point.layerId,point.kind,point.name,JSON.stringify(point.geometry),JSON.stringify(point.style),JSON.stringify(point.properties),point.startYear ?? null,point.endYear ?? null]);
      if (saved.rowCount !== 1) throw new ConflictException('Ce lieu ne peut pas être restauré.');
      await client.query('UPDATE worlds SET revision=revision+1,updated_at=now() WHERE id=$1', [id]);
      const result = compact ? await this.get(userId, id, false, point.id, client) : undefined;
      await client.query('COMMIT');
      if (result) return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
    return this.get(userId, id);
  }

  async changeLayer(userId: string, id: string, revision: number, command: { type: 'create'; name: string } | { type: 'update'; layerId: string; name: string; opacity: number; locked: boolean } | { type: 'delete'; layerId: string }): Promise<{ world: World; role: MemberRole }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const permission = await client.query<{ revision: number; owner_id: string; role: MemberRole | null }>(`SELECT w.revision,w.owner_id,m.role FROM worlds w
        LEFT JOIN members m ON m.world_id=w.id AND m.user_id=$2 WHERE w.id=$1 AND (w.owner_id=$2 OR m.user_id=$2) FOR UPDATE OF w`, [id, userId]);
      const world = permission.rows[0];
      if (!world) throw new NotFoundException('Monde introuvable.');
      if (world.owner_id !== userId && world.role !== 'editor') throw new ForbiddenException('Ce monde est en lecture seule.');
      if (world.revision !== revision) throw new ConflictException('Le monde a changé. Rechargez-le avant de réessayer.');
      if (command.type === 'create') {
        await client.query('INSERT INTO layers(id,world_id,name,sort_order) SELECT $1,$2,$3,COALESCE(MAX(sort_order),-1)+1 FROM layers WHERE world_id=$2', [randomUUID(),id,command.name]);
      } else {
        const layer = await client.query<{ locked: boolean }>('SELECT locked FROM layers WHERE id=$1 AND world_id=$2 FOR UPDATE', [command.layerId,id]);
        if (!layer.rows[0]) throw new NotFoundException('Calque introuvable.');
        if (command.type === 'update') await client.query('UPDATE layers SET name=$3,opacity=$4,locked=$5 WHERE id=$1 AND world_id=$2', [command.layerId,id,command.name,command.opacity,command.locked]);
        else {
          if (layer.rows[0].locked) throw new ConflictException('Déverrouillez le calque avant de le supprimer.');
          if ((await client.query('SELECT 1 FROM map_objects WHERE world_id=$1 AND layer_id=$2 LIMIT 1',[id,command.layerId])).rowCount) throw new ConflictException('Ce calque contient encore des objets.');
          const count = await client.query<{ count: string }>('SELECT COUNT(*) FROM layers WHERE world_id=$1',[id]);
          if (Number(count.rows[0]?.count) <= 1) throw new ConflictException('Conservez au moins un calque.');
          await client.query('DELETE FROM layers WHERE id=$1 AND world_id=$2',[command.layerId,id]);
        }
      }
      await client.query('UPDATE worlds SET revision=revision+1,updated_at=now() WHERE id=$1',[id]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
    return this.get(userId,id);
  }

  async atlas(userId: string, id: string, input: { q: string; geometry?: string; cursor?: string; revision?: number; limit: number }): Promise<{ revision: number; objects: MapObject[]; nextCursor: string | null }> {
    const result = await this.pool.query<{ revision: number; documents: unknown[] }>(`WITH allowed AS (
      SELECT w.id,w.revision FROM worlds w LEFT JOIN members m ON m.world_id=w.id AND m.user_id=$2 WHERE w.id=$1 AND (w.owner_id=$2 OR m.user_id=$2)
    ), page AS (
      SELECT o.* FROM map_objects o JOIN allowed a ON a.id=o.world_id
      WHERE ($3::uuid IS NULL OR o.id>$3) AND ($4::text IS NULL OR GeometryType(o.geometry)=upper($4))
      AND strpos(lower(unaccent(o.name)),lower(unaccent($5)))>0 ORDER BY o.id LIMIT $6
    ) SELECT a.revision,COALESCE((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id',p.id,'layerId',p.layer_id,'name',p.name,'kind',p.kind,'geometry',ST_AsGeoJSON(p.geometry)::jsonb,
      'style',p.style,'properties',p.properties,'startYear',p.start_year,'endYear',p.end_year)) ORDER BY p.id) FROM page p),'[]'::jsonb) AS documents FROM allowed a`,[id,userId,input.cursor??null,input.geometry??null,input.q,input.limit+1]);
    const row = result.rows[0]; if (!row) throw new NotFoundException('Monde introuvable.');
    if (input.revision !== undefined && input.revision !== row.revision) throw new ConflictException('Le monde a changé. Recommencez la recherche.');
    const objects = row.documents.slice(0,input.limit).map(object => objectSchema.parse(object));
    return { revision: row.revision, objects, nextCursor: row.documents.length>input.limit ? objects.at(-1)!.id : null };
  }

  async tiles(userId: string, id: string, bounds: { west: number; east: number; south: number; north: number; detailKm: number }): Promise<{ revision: number; objects: MapObject[]; total: number; reduced: boolean }> {
    const result = await this.pool.query<{ revision: number; total: number; documents: unknown[] }>(`WITH allowed AS (
      SELECT w.id,w.revision,w.radius_km FROM worlds w LEFT JOIN members m ON m.world_id=w.id AND m.user_id=$2
      WHERE w.id=$1 AND (w.owner_id=$2 OR m.user_id=$2)
    ), candidates AS (
      SELECT o.*,a.radius_km FROM map_objects o JOIN allowed a ON a.id=o.world_id
      JOIN layers l ON l.id=o.layer_id AND l.world_id=o.world_id
      WHERE o.geometry && ST_MakeEnvelope($3,$4,$5,$6,4326) AND l.opacity>0 AND (o.style->>'opacity')::float>0
    ), ranked AS (
      SELECT c.*,row_number() OVER (PARTITION BY CASE WHEN GeometryType(geometry)='POINT'
        THEN layer_id::text || ':' || floor(ST_X(geometry)/($7/(radius_km*pi()/180)))::text || ':' || floor(ST_Y(geometry)/($7/(radius_km*pi()/180)))::text ELSE id::text END ORDER BY id) AS rank
      FROM candidates c
    ), sampled AS (SELECT * FROM ranked WHERE rank=1 ORDER BY id LIMIT 2000)
    SELECT a.revision,(SELECT count(*)::int FROM candidates) AS total,
      COALESCE((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',s.id,'layerId',s.layer_id,'name',s.name,'kind',s.kind,
        'geometry',ST_AsGeoJSON(ST_SimplifyPreserveTopology(s.geometry,$7/(s.radius_km*pi()/180)/8))::jsonb,
        'style',s.style,'properties',s.properties,'startYear',s.start_year,'endYear',s.end_year))) FROM sampled s),'[]'::jsonb) AS documents
      FROM allowed a`, [id,userId,bounds.west,bounds.south,bounds.east,bounds.north,bounds.detailKm]);
    const row = result.rows[0]; if (!row) throw new NotFoundException('Monde introuvable.');
    const objects = row.documents.map(document => objectSchema.parse(document));
    return { revision: row.revision, objects, total: row.total, reduced: objects.length < row.total };
  }
}
