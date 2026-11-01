import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { MapObject, World } from '@alarmap/map-model';
import { Infrastructure } from '../infrastructure.js';
import { WorldsService } from './worlds.service.js';

export interface LinkKeys { ownerKey: string; worldKey: string; objectKey?: string }

@Injectable()
export class LinksService {
  constructor(@Inject(Infrastructure) private readonly infrastructure: Infrastructure, @Inject(WorldsService) private readonly worlds: WorldsService) {}
  private get pool() { return this.infrastructure.pool; }

  async privateKeys(userId: string, worldId: string, objectId?: string): Promise<LinkKeys> {
    const result = await this.pool.query<LinkKeys>(`SELECT u.link_key AS "ownerKey", w.link_key AS "worldKey", k.link_key AS "objectKey"
      FROM worlds w JOIN users u ON u.id=w.owner_id
      LEFT JOIN members m ON m.world_id=w.id AND m.user_id=$2
      LEFT JOIN map_objects o ON o.world_id=w.id AND o.id=$3::uuid
      LEFT JOIN object_link_keys k ON k.world_id=w.id AND k.object_id=o.id
      WHERE w.id=$1 AND (w.owner_id=$2 OR m.user_id=$2) AND ($3::uuid IS NULL OR k.link_key IS NOT NULL)`, [worldId,userId,objectId ?? null]);
    const row = result.rows[0]; if (!row) throw new NotFoundException('Lien introuvable.');
    return { ownerKey: row.ownerKey, worldKey: row.worldKey, ...(row.objectKey ? { objectKey: row.objectKey } : {}) };
  }
  async resolvePrivate(userId: string, ownerKey: string, worldKey: string, objectKey?: string) {
    const result = await this.pool.query<{ worldId: string; objectId: string | null }>(`SELECT w.id AS "worldId", o.id AS "objectId"
      FROM worlds w JOIN users u ON u.id=w.owner_id LEFT JOIN members m ON m.world_id=w.id AND m.user_id=$3
      LEFT JOIN object_link_keys k ON k.world_id=w.id AND k.link_key=$4
      LEFT JOIN map_objects o ON o.world_id=w.id AND o.id=k.object_id
      WHERE u.link_key=$1 AND w.link_key=$2 AND (w.owner_id=$3 OR m.user_id=$3) AND ($4::text IS NULL OR o.id IS NOT NULL)`, [ownerKey,worldKey,userId,objectKey ?? null]);
    const row = result.rows[0]; if (!row) throw new NotFoundException('Lien introuvable.');
    return row.objectId ? this.worlds.getObject(userId,row.worldId,row.objectId) : this.worlds.get(userId,row.worldId,true);
  }
  async publicCatalog(): Promise<{ slug: string; name: string; revision: number; ownerKey: string; worldKey: string }[]> {
    const result = await this.pool.query<{ slug: string; name: string; revision: number; ownerKey: string; worldKey: string }>(`SELECT w.slug,p.public_document->>'name' AS name,p.revision,u.link_key AS "ownerKey",w.link_key AS "worldKey"
      FROM worlds w JOIN users u ON u.id=w.owner_id
      JOIN LATERAL (SELECT public_document,revision,published_at FROM publications WHERE world_id=w.id ORDER BY published_at DESC,id DESC LIMIT 1) p ON true
      WHERE w.status='public' ORDER BY p.published_at DESC,w.id LIMIT 100`);
    return result.rows;
  }
  async publicKeys(slug: string, objectId?: string): Promise<LinkKeys> {
    const world = await this.worlds.publicWorld(slug);
    if (objectId && !world.objects.some(object => object.id === objectId)) throw new NotFoundException('Lien introuvable.');
    const result = await this.pool.query<LinkKeys>(`SELECT u.link_key AS "ownerKey", w.link_key AS "worldKey", k.link_key AS "objectKey"
      FROM worlds w JOIN users u ON u.id=w.owner_id
      LEFT JOIN object_link_keys k ON k.world_id=w.id AND k.object_id=$2::uuid
      WHERE w.id=$1 AND w.status IN ('public','unlisted') AND ($2::uuid IS NULL OR k.link_key IS NOT NULL)`, [world.id,objectId ?? null]);
    const row = result.rows[0]; if (!row) throw new NotFoundException('Lien introuvable.');
    return { ownerKey: row.ownerKey, worldKey: row.worldKey, ...(row.objectKey ? { objectKey: row.objectKey } : {}) };
  }
  async resolvePublic(ownerKey: string, worldKey: string, objectKey?: string): Promise<{ world: World; object?: MapObject }> {
    const result = await this.pool.query<{ slug: string; objectId: string | null }>(`SELECT w.slug, k.object_id AS "objectId"
      FROM worlds w JOIN users u ON u.id=w.owner_id LEFT JOIN object_link_keys k ON k.world_id=w.id AND k.link_key=$3
      WHERE u.link_key=$1 AND w.link_key=$2 AND w.status IN ('public','unlisted') AND ($3::text IS NULL OR k.object_id IS NOT NULL)`, [ownerKey,worldKey,objectKey ?? null]);
    const row = result.rows[0]; if (!row) throw new NotFoundException('Lien introuvable.');
    const world = await this.worlds.publicWorld(row.slug);
    const object = row.objectId ? world.objects.find(item => item.id === row.objectId) : undefined;
    if (row.objectId && !object) throw new NotFoundException('Lien introuvable.');
    return { world, ...(object ? { object } : {}) };
  }
}
