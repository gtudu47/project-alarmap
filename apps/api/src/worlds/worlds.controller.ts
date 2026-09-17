import { Body, Controller, Delete, Patch, Put, Get, Header, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { objectSchema } from '@alarmap/map-model';
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
    const input = parseInput(z.object({ name: z.string().trim().min(1).max(200), longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90), revision: z.number().int().nonnegative() }).strict(), body);
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
}
