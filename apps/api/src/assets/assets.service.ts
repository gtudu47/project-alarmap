import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Infrastructure } from '../infrastructure.js';
import { MAX_ASSET_BYTES } from '../storage.js';
import { WorldsService } from '../worlds/worlds.service.js';

export interface Asset { id: string; name: string; byteSize: number; width: number; height: number }
const MAX_SIZE = MAX_ASSET_BYTES;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let i = 0; i < 8; i++) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
/** Contrôle la structure, les dimensions et les sommes de contrôle des blocs PNG. */
export function validatePng(encoded: string): { data: Buffer; width: number; height: number } {
  if (!encoded || encoded.length > Math.ceil(MAX_SIZE / 3) * 4 || encoded.length % 4 !== 0) throw new BadRequestException('Image limitée à 4 Mio.');
  const data = Buffer.from(encoded, 'base64');
  if (data.length > MAX_SIZE || data.toString('base64') !== encoded || data.length < 57 || !data.subarray(0, 8).equals(pngSignature)) throw new BadRequestException('Fichier PNG invalide.');
  let offset = 8; let width = 0; let height = 0; let imageData = false; let ended = false; let chunks = 0;
  while (offset + 12 <= data.length && chunks++ < 10000) {
    const length = data.readUInt32BE(offset); const end = offset + 12 + length;
    if (end > data.length) break;
    const type = data.toString('ascii', offset + 4, offset + 8);
    if (chunks === 1) {
      if (type !== 'IHDR' || length !== 13) break;
      width = data.readUInt32BE(offset + 8); height = data.readUInt32BE(offset + 12);
      if (!width || !height || width > 8192 || height > 8192 || width * height > 25_000_000) throw new BadRequestException('Dimensions PNG limitées à 8 192 pixels et 25 millions de pixels.');
    } else if (type === 'IHDR') break;
    let crc = 0xffffffff;
    for (let i = offset + 4; i < offset + 8 + length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]!) & 255]!;
    if (((crc ^ 0xffffffff) >>> 0) !== data.readUInt32BE(offset + 8 + length)) break;
    if (type === 'IDAT') imageData = true;
    if (type === 'IEND') { ended = length === 0 && imageData && end === data.length; break; }
    offset = end;
  }
  if (!ended) throw new BadRequestException('Fichier PNG invalide ou incomplet.');
  return { data, width, height };
}

@Injectable()
export class AssetsService {
  constructor(@Inject(Infrastructure) private readonly infrastructure: Infrastructure, @Inject(WorldsService) private readonly worlds: WorldsService) {}
  async list(userId: string, worldId: string): Promise<Asset[]> {
    const result = await this.infrastructure.pool.query<Omit<Asset, 'id'> & { id: string | null }>(`SELECT a.id,a.name,a.byte_size AS "byteSize",a.width,a.height FROM worlds w
      LEFT JOIN LATERAL (SELECT * FROM assets WHERE world_id=w.id ORDER BY created_at,id LIMIT 100) a ON true
      WHERE w.id=$1 AND (w.owner_id=$2 OR EXISTS (SELECT 1 FROM members m WHERE m.world_id=w.id AND m.user_id=$2))
      ORDER BY a.created_at,a.id`, [worldId,userId]);
    if (!result.rowCount) throw new NotFoundException('Monde introuvable.');
    return result.rows.filter((asset): asset is Asset => asset.id !== null);
  }
  async get(userId: string, worldId: string, id: string): Promise<Asset & { data: string }> {
    const result = await this.infrastructure.pool.query<Asset & { storageKey: string }>(`SELECT a.id,a.name,a.byte_size AS "byteSize",a.width,a.height,a.storage_key AS "storageKey" FROM assets a JOIN worlds w ON w.id=a.world_id
      WHERE a.id=$1 AND a.world_id=$2 AND (w.owner_id=$3 OR EXISTS (SELECT 1 FROM members m WHERE m.world_id=w.id AND m.user_id=$3))`, [id,worldId,userId]);
    const asset = result.rows[0]; if (!asset) throw new NotFoundException('Image introuvable.');
    const bytes = await this.infrastructure.storage.get(asset.storageKey);
    if (bytes.length !== asset.byteSize) throw new Error('Image stockée incohérente.');
    return { id: asset.id, name: asset.name, byteSize: asset.byteSize, width: asset.width, height: asset.height, data: bytes.toString('base64') };
  }
  async remove(userId: string, worldId: string, id: string): Promise<void> {
    const client = await this.infrastructure.pool.connect(); let key: string;
    try {
      await client.query('BEGIN');
      await this.worlds.lockEditableWorld(client, worldId, userId);
      const result = await client.query<{ storage_key: string }>('DELETE FROM assets WHERE world_id=$1 AND id=$2 RETURNING storage_key', [worldId,id]);
      if (!result.rows[0]) throw new NotFoundException('Image introuvable.');
      key = result.rows[0].storage_key;
      await client.query('COMMIT');
    } catch (error) { try { await client.query('ROLLBACK'); } catch { /* Connexion interrompue. */ } throw error; }
    finally { client.release(); }
    // Une panne de stockage laisse un objet orphelin, mais jamais une référence cassée.
    try { await this.infrastructure.storage.remove(key); } catch { console.error('Nettoyage du fichier supprimé impossible.'); }
  }
  async create(userId: string, worldId: string, name: string, encoded: string): Promise<Asset> {
    const { data, width, height } = validatePng(encoded);
    const id = randomUUID(); const storageKey = `assets/${worldId.toLowerCase()}/${id}`; const client = await this.infrastructure.pool.connect(); let stored = false; let committing = false;
    try {
      await client.query('BEGIN');
      await this.worlds.lockEditableWorld(client, worldId, userId);
      const count = await client.query<{ count: number }>('SELECT count(*)::integer AS count FROM assets WHERE world_id=$1', [worldId]);
      if ((count.rows[0]?.count ?? 0) >= 100) throw new BadRequestException('Un monde peut contenir au maximum 100 images.');
      await this.infrastructure.storage.put(storageKey, data); stored = true;
      await client.query('INSERT INTO assets(id,world_id,name,storage_key,byte_size,width,height) VALUES($1,$2,$3,$4,$5,$6,$7)', [id,worldId,name,storageKey,data.length,width,height]);
      committing = true; await client.query('COMMIT');
      return { id, name, byteSize: data.length, width, height };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch { /* La connexion peut être interrompue. */ }
      // Un échec pendant COMMIT est ambigu : conserver le fichier évite de supprimer une image validée.
      if (stored && !committing) { try { await this.infrastructure.storage.remove(storageKey); } catch { console.error('Nettoyage de stockage après échec impossible.'); } }
      throw error;
    } finally { client.release(); }
  }
}
