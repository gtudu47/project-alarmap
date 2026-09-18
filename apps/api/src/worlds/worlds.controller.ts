import { Body, Controller, Delete, Patch, Put, Get, Query, Header, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { objectSchema, lineObjectSchema } from '@alarmap/map-model';
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
  get(@Param('id', ParseUUIDPipe) id: string, @Req() request: AuthRequest) { return this.worlds.get(request.account.id, id); }
  @Post(':id/points')
  @Header('Cache-Control', 'no-store')
  addPoint(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const input = parseInput(z.object({ name: z.string().trim().min(1).max(200), longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90), revision: z.number().int().nonnegative(), layerId: z.uuid().optional() }).strict(), body);
    return this.worlds.addPoint(request.account.id, id, input);
  }

  @Patch(':id/points/:pointId')
  @Header('Cache-Control', 'no-store')
  updatePoint(@Param('id', ParseUUIDPipe) id: string, @Param('pointId', ParseUUIDPipe) pointId: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const input = parseInput(z.object({ name: z.string().trim().min(1).max(200), longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90), revision: z.number().int().nonnegative() }).strict(), body);
    return this.worlds.changePoint(request.account.id, id, pointId, input.revision, input);
  }
  @Delete(':id/points/:pointId')
  @Header('Cache-Control', 'no-store')
  deletePoint(@Param('id', ParseUUIDPipe) id: string, @Param('pointId', ParseUUIDPipe) pointId: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const input = parseInput(z.object({ revision: z.number().int().nonnegative() }).strict(), body);
    return this.worlds.changePoint(request.account.id, id, pointId, input.revision);
  }

  @Put(':id/points/:pointId')
  @Header('Cache-Control', 'no-store')
  restorePoint(@Param('id', ParseUUIDPipe) id: string, @Param('pointId', ParseUUIDPipe) pointId: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const input = parseInput(z.object({ revision: z.number().int().nonnegative(), point: objectSchema.refine(point => point.geometry.type === 'Point' && point.id === pointId, 'Point invalide.') }).strict(), body);
    return this.worlds.restorePoint(request.account.id, id, input.revision, input.point);
  }

  @Put(':id/lines/:lineId')
  @Header('Cache-Control', 'no-store')
  saveLine(@Param('id', ParseUUIDPipe) id: string, @Param('lineId', ParseUUIDPipe) lineId: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const input = parseInput(z.object({ revision: z.number().int().nonnegative(), point: lineObjectSchema.refine(line => line.id === lineId, 'Identifiant invalide.') }).strict(), body);
    return this.worlds.restorePoint(request.account.id, id, input.revision, input.point, 'ST_LineString');
  }
  @Delete(':id/lines/:lineId')
  @Header('Cache-Control', 'no-store')
  deleteLine(@Param('id', ParseUUIDPipe) id: string, @Param('lineId', ParseUUIDPipe) lineId: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const input = parseInput(z.object({ revision: z.number().int().nonnegative() }).strict(), body);
    return this.worlds.changePoint(request.account.id, id, lineId, input.revision, undefined, 'ST_LineString');
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

  @Get(':id/tiles')
  @Header('Cache-Control', 'no-store')
  tiles(@Param('id', ParseUUIDPipe) id: string, @Query() query: unknown, @Req() request: AuthRequest) {
    const bounds = parseInput(z.object({ west: z.coerce.number().min(-180).max(180), east: z.coerce.number().min(-180).max(180), south: z.coerce.number().min(-90).max(90), north: z.coerce.number().min(-90).max(90), detailKm: z.coerce.number().positive().max(1e12) }).strict().refine(value => value.west < value.east && value.south < value.north, 'Emprise invalide.'), query);
    return this.worlds.tiles(request.account.id,id,bounds);
  }
}
