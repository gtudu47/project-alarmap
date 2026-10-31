import { Body, Controller, Delete, Patch, Put, Get, Query, Header, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { objectSchema, lineObjectSchema, areaObjectSchema } from '@alarmap/map-model';
import { AuthGuard, type AuthRequest } from '../auth/auth.guard.js';
import { parseInput } from '../validation.js';
import { WorldsService } from './worlds.service.js';

@ApiTags('worlds')
@ApiBearerAuth()
@Controller('worlds')
@UseGuards(AuthGuard)
export class WorldsController {
  constructor(@Inject(WorldsService) private readonly worlds: WorldsService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Req() request: AuthRequest) { return this.worlds.list(request.account.id); }
  @Post()
  @Header('Cache-Control', 'no-store')
  create(@Body() body: unknown, @Req() request: AuthRequest) {
    const input = parseInput(z.object({ name: z.string().trim().min(1).max(200), radiusKm: z.number().positive().max(1_000_000_000) }).strict(), body);
    return this.worlds.create(request.account.id, input);
  }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  get(@Param('id', ParseUUIDPipe) id: string, @Query() query: unknown, @Req() request: AuthRequest) {
    const input = parseInput(z.object({ summary: z.enum(['1']).optional() }).strict(),query);
    return this.worlds.get(request.account.id, id, input.summary === '1');
  }
  @Post(':id/publication')
  @Header('Cache-Control', 'no-store')
  publish(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const input = parseInput(z.object({ revision: z.number().int().nonnegative(), visibility: z.enum(['public','unlisted']), layerIds: z.array(z.uuid()).min(1).max(100) }).strict(), body);
    return this.worlds.publish(request.account.id, id, input);
  }
  @Delete(':id/publication')
  @Header('Cache-Control', 'no-store')
  unpublish(@Param('id', ParseUUIDPipe) id: string, @Req() request: AuthRequest) {
    return this.worlds.unpublish(request.account.id, id);
  }
  @Get(':id/members')
  @Header('Cache-Control', 'no-store')
  members(@Param('id', ParseUUIDPipe) id: string, @Req() request: AuthRequest) {
    return this.worlds.members(request.account.id, id);
  }
  @Post(':id/members')
  @Header('Cache-Control', 'no-store')
  share(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const input = parseInput(z.object({ email: z.email().max(254).transform(value => value.trim()), role: z.enum(['editor', 'viewer']) }).strict(), body);
    return this.worlds.share(request.account.id, id, input);
  }
  @Delete(':id/members/:memberId')
  @Header('Cache-Control', 'no-store')
  unshare(@Param('id', ParseUUIDPipe) id: string, @Param('memberId', ParseUUIDPipe) memberId: string, @Req() request: AuthRequest) {
    return this.worlds.unshare(request.account.id, id, memberId);
  }
  @Get(':id/objects/:objectId')
  @Header('Cache-Control', 'no-store')
  getObject(@Param('id', ParseUUIDPipe) id: string, @Param('objectId', ParseUUIDPipe) objectId: string, @Req() request: AuthRequest) {
    return this.worlds.getObject(request.account.id, id, objectId);
  }
  @Post(':id/points')
  @Header('Cache-Control', 'no-store')
  addPoint(@Param('id', ParseUUIDPipe) id: string, @Query() query: unknown, @Body() body: unknown, @Req() request: AuthRequest) {
    const compact = parseInput(z.object({ compact: z.literal('1').optional() }).strict(), query).compact === '1';
    const input = parseInput(z.object({ name: z.string().trim().min(1).max(200), longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90), revision: z.number().int().nonnegative(), layerId: z.uuid().optional(), kind: z.enum(['city','label']).optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }).strict().refine(value => value.kind !== 'label' || value.name.length <= 80, 'Le texte ne doit pas dépasser 80 caractères.'), body);
    return this.worlds.addPoint(request.account.id, id, input, compact);
  }

  @Patch(':id/points/:pointId')
  @Header('Cache-Control', 'no-store')
  updatePoint(@Param('id', ParseUUIDPipe) id: string, @Param('pointId', ParseUUIDPipe) pointId: string, @Query() query: unknown, @Body() body: unknown, @Req() request: AuthRequest) {
    const compact = parseInput(z.object({ compact: z.literal('1').optional() }).strict(), query).compact === '1';
    const input = parseInput(z.object({ name: z.string().trim().min(1).max(200), longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90), revision: z.number().int().nonnegative(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }).strict(), body);
    return this.worlds.changePoint(request.account.id, id, pointId, input.revision, input, 'ST_Point', compact);
  }
  @Delete(':id/points/:pointId')
  @Header('Cache-Control', 'no-store')
  deletePoint(@Param('id', ParseUUIDPipe) id: string, @Param('pointId', ParseUUIDPipe) pointId: string, @Query() query: unknown, @Body() body: unknown, @Req() request: AuthRequest) {
    const compact = parseInput(z.object({ compact: z.literal('1').optional() }).strict(), query).compact === '1';
    const input = parseInput(z.object({ revision: z.number().int().nonnegative() }).strict(), body);
    return this.worlds.changePoint(request.account.id, id, pointId, input.revision, undefined, 'ST_Point', compact);
  }

  @Put(':id/points/:pointId')
  @Header('Cache-Control', 'no-store')
  restorePoint(@Param('id', ParseUUIDPipe) id: string, @Param('pointId', ParseUUIDPipe) pointId: string, @Query() query: unknown, @Body() body: unknown, @Req() request: AuthRequest) {
    const compact = parseInput(z.object({ compact: z.literal('1').optional() }).strict(), query).compact === '1';
    const input = parseInput(z.object({ revision: z.number().int().nonnegative(), point: objectSchema.refine(point => point.geometry.type === 'Point' && point.id === pointId, 'Point invalide.') }).strict(), body);
    return this.worlds.restorePoint(request.account.id, id, input.revision, input.point, 'ST_Point', compact);
  }

  @Put(':id/lines/:lineId')
  @Header('Cache-Control', 'no-store')
  saveLine(@Param('id', ParseUUIDPipe) id: string, @Param('lineId', ParseUUIDPipe) lineId: string, @Query() query: unknown, @Body() body: unknown, @Req() request: AuthRequest) {
    const compact = parseInput(z.object({ compact: z.literal('1').optional() }).strict(), query).compact === '1';
    const input = parseInput(z.object({ revision: z.number().int().nonnegative(), point: lineObjectSchema.refine(line => line.id === lineId, 'Identifiant invalide.') }).strict(), body);
    return this.worlds.restorePoint(request.account.id, id, input.revision, input.point, 'ST_LineString', compact);
  }
  @Delete(':id/lines/:lineId')
  @Header('Cache-Control', 'no-store')
  deleteLine(@Param('id', ParseUUIDPipe) id: string, @Param('lineId', ParseUUIDPipe) lineId: string, @Query() query: unknown, @Body() body: unknown, @Req() request: AuthRequest) {
    const compact = parseInput(z.object({ compact: z.literal('1').optional() }).strict(), query).compact === '1';
    const input = parseInput(z.object({ revision: z.number().int().nonnegative() }).strict(), body);
    return this.worlds.changePoint(request.account.id, id, lineId, input.revision, undefined, 'ST_LineString', compact);
  }

  @Put(':id/areas/:areaId')
  @Header('Cache-Control', 'no-store')
  saveArea(@Param('id', ParseUUIDPipe) id: string, @Param('areaId', ParseUUIDPipe) areaId: string, @Query() query: unknown, @Body() body: unknown, @Req() request: AuthRequest) {
    const compact = parseInput(z.object({ compact: z.literal('1').optional() }).strict(), query).compact === '1';
    const input = parseInput(z.object({ revision: z.number().int().nonnegative(), point: areaObjectSchema.refine(area => area.id === areaId, 'Identifiant invalide.') }).strict(), body);
    return this.worlds.restorePoint(request.account.id, id, input.revision, input.point, 'ST_Polygon', compact);
  }
  @Delete(':id/areas/:areaId')
  @Header('Cache-Control', 'no-store')
  deleteArea(@Param('id', ParseUUIDPipe) id: string, @Param('areaId', ParseUUIDPipe) areaId: string, @Query() query: unknown, @Body() body: unknown, @Req() request: AuthRequest) {
    const compact = parseInput(z.object({ compact: z.literal('1').optional() }).strict(), query).compact === '1';
    const input = parseInput(z.object({ revision: z.number().int().nonnegative() }).strict(), body);
    return this.worlds.changePoint(request.account.id, id, areaId, input.revision, undefined, 'ST_Polygon', compact);
  }

  @Post(':id/layers')
  @Header('Cache-Control', 'no-store')
  createLayer(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const input = parseInput(z.object({ revision: z.number().int().nonnegative(), name: z.string().trim().min(1).max(120) }).strict(), body);
    return this.worlds.changeLayer(request.account.id,id,input.revision,{ type: 'create', name: input.name });
  }
  @Patch(':id/layers/:layerId')
  @Header('Cache-Control', 'no-store')
  updateLayer(@Param('id', ParseUUIDPipe) id: string, @Param('layerId', ParseUUIDPipe) layerId: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const input = parseInput(z.object({ revision: z.number().int().nonnegative(), name: z.string().trim().min(1).max(120), opacity: z.number().min(0).max(1), locked: z.boolean() }).strict(), body);
    return this.worlds.changeLayer(request.account.id,id,input.revision,{ type: 'update', layerId, name: input.name, opacity: input.opacity, locked: input.locked });
  }
  @Delete(':id/layers/:layerId')
  @Header('Cache-Control', 'no-store')
  deleteLayer(@Param('id', ParseUUIDPipe) id: string, @Param('layerId', ParseUUIDPipe) layerId: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const input = parseInput(z.object({ revision: z.number().int().nonnegative() }).strict(), body);
    return this.worlds.changeLayer(request.account.id,id,input.revision,{ type: 'delete', layerId });
  }

  @Get(':id/atlas')
  @Header('Cache-Control', 'no-store')
  atlas(@Param('id', ParseUUIDPipe) id: string, @Query() query: unknown, @Req() request: AuthRequest) {
    const input = parseInput(z.object({ q: z.string().max(200).default(''), geometry: z.enum(['Point','LineString','Polygon','MultiPolygon']).optional(), cursor: z.uuid().optional(), revision: z.coerce.number().int().nonnegative().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }).strict(),query);
    return this.worlds.atlas(request.account.id,id,input);
  }

  @Get(':id/tiles')
  @Header('Cache-Control', 'no-store')
  tiles(@Param('id', ParseUUIDPipe) id: string, @Query() query: unknown, @Req() request: AuthRequest) {
    const bounds = parseInput(z.object({ west: z.coerce.number().min(-180).max(180), east: z.coerce.number().min(-180).max(180), south: z.coerce.number().min(-90).max(90), north: z.coerce.number().min(-90).max(90), detailKm: z.coerce.number().positive().max(1e12) }).strict().refine(value => value.west < value.east && value.south < value.north, 'Emprise invalide.'), query);
    return this.worlds.tiles(request.account.id,id,bounds);
  }
}

@ApiTags('public-worlds')
@Controller('public/worlds')
export class PublicWorldsController {
  constructor(@Inject(WorldsService) private readonly worlds: WorldsService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list() { return this.worlds.publicWorlds(); }
  @Get(':slug')
  @Header('Cache-Control', 'no-store')
  get(@Param('slug') slug: string) { return this.worlds.publicWorld(slug); }
}
