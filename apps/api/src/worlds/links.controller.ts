import { Controller, Get, Header, Inject, Param, ParseUUIDPipe, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard, type AuthRequest } from '../auth/auth.guard.js';
import { parseInput } from '../validation.js';
import { LinksService } from './links.service.js';

const key = z.string().regex(/^[a-f0-9]{50}$/);
@Controller('links')
export class LinksController {
  constructor(@Inject(LinksService) private readonly links: LinksService) {}
  @Get('private/worlds/:worldId') @UseGuards(AuthGuard) @Header('Cache-Control','no-store')
  privateWorld(@Param('worldId',ParseUUIDPipe) worldId: string, @Req() request: AuthRequest) { return this.links.privateKeys(request.account.id,worldId); }
  @Get('private/worlds/:worldId/objects/:objectId') @UseGuards(AuthGuard) @Header('Cache-Control','no-store')
  privateObject(@Param('worldId',ParseUUIDPipe) worldId: string, @Param('objectId',ParseUUIDPipe) objectId: string, @Req() request: AuthRequest) { return this.links.privateKeys(request.account.id,worldId,objectId); }
  @Get('private/resolve/:owner/:world') @UseGuards(AuthGuard) @Header('Cache-Control','no-store')
  resolvePrivateWorld(@Param('owner') owner: string, @Param('world') world: string, @Req() request: AuthRequest) { return this.links.resolvePrivate(request.account.id,parseInput(key,owner),parseInput(key,world)); }
  @Get('private/resolve/:owner/:world/:object') @UseGuards(AuthGuard) @Header('Cache-Control','no-store')
  resolvePrivateObject(@Param('owner') owner: string, @Param('world') world: string, @Param('object') object: string, @Req() request: AuthRequest) { return this.links.resolvePrivate(request.account.id,parseInput(key,owner),parseInput(key,world),parseInput(key,object)); }
  @Get('public/catalog') @Header('Cache-Control','no-store')
  publicCatalog() { return this.links.publicCatalog(); }
  @Get('public/worlds/:slug') @Header('Cache-Control','no-store')
  publicWorld(@Param('slug') slug: string) { return this.links.publicKeys(slug); }
  @Get('public/worlds/:slug/objects/:objectId') @Header('Cache-Control','no-store')
  publicObject(@Param('slug') slug: string, @Param('objectId',ParseUUIDPipe) objectId: string) { return this.links.publicKeys(slug,objectId); }
  @Get('public/resolve/:owner/:world') @Header('Cache-Control','no-store')
  resolvePublicWorld(@Param('owner') owner: string, @Param('world') world: string) { return this.links.resolvePublic(parseInput(key,owner),parseInput(key,world)); }
  @Get('public/resolve/:owner/:world/:object') @Header('Cache-Control','no-store')
  resolvePublicObject(@Param('owner') owner: string, @Param('world') world: string, @Param('object') object: string) { return this.links.resolvePublic(parseInput(key,owner),parseInput(key,world),parseInput(key,object)); }
}
