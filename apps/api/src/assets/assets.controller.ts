import { Body, Controller, Delete, Get, Header, HttpCode, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthGuard, type AuthRequest } from '../auth/auth.guard.js';
import { parseInput } from '../validation.js';
import { AssetsService } from './assets.service.js';

@ApiTags('assets')
@ApiBearerAuth()
@Controller('worlds/:worldId/assets')
@UseGuards(AuthGuard)
export class AssetsController {
  constructor(@Inject(AssetsService) private readonly assets: AssetsService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Param('worldId', ParseUUIDPipe) worldId: string, @Req() request: AuthRequest) { return this.assets.list(request.account.id, worldId); }
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  get(@Param('worldId', ParseUUIDPipe) worldId: string, @Param('id', ParseUUIDPipe) id: string, @Req() request: AuthRequest) { return this.assets.get(request.account.id, worldId, id); }
  @Delete(':id')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  remove(@Param('worldId', ParseUUIDPipe) worldId: string, @Param('id', ParseUUIDPipe) id: string, @Req() request: AuthRequest) { return this.assets.remove(request.account.id, worldId, id); }
  @Post()
  @Header('Cache-Control', 'no-store')
  create(@Param('worldId', ParseUUIDPipe) worldId: string, @Body() body: unknown, @Req() request: AuthRequest) {
    const input = parseInput(z.object({ name: z.string().trim().min(1).max(120).refine(value => [...value].every(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)), data: z.string().max(5592408) }).strict(), body);
    return this.assets.create(request.account.id, worldId, input.name, input.data);
  }
}
