import { Body, Controller, Get, Post, Delete, Param, ParseUUIDPipe, Req, Res, UseGuards, Inject, ForbiddenException, UnauthorizedException, Header, HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { Infrastructure } from '../infrastructure.js';
import { parseInput } from '../validation.js';
import { AuthService, type AuthResult } from './auth.service.js';
import { AuthGuard, AdminGuard, type AuthRequest } from './auth.guard.js';
import { allowedOrigin, displayNameSchema, emailSchema, passwordSchema, readRefreshCookie, REFRESH_COOKIE, tokenSchema } from './security.js';

@ApiTags('accounts')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService, @Inject(Infrastructure) private readonly infrastructure: Infrastructure) {}
  private checkOrigin(request: Request): void {
    if (!allowedOrigin(request.headers.origin, this.infrastructure.config)) throw new ForbiddenException('Origine non autorisée.');
  }
  private respond(result: AuthResult, response: Response) {
    response.cookie(REFRESH_COOKIE, result.refreshToken, {
      httpOnly: true, sameSite: 'strict', secure: new URL(this.infrastructure.config.PUBLIC_APP_URL).protocol === 'https:',
      path: '/api/v1/auth', maxAge: this.auth.sessionMaxAge,
    });
    response.setHeader('Cache-Control', 'no-store');
    return { user: result.user, accessToken: result.accessToken };
  }
  @Get('status')
  @Header('Cache-Control', 'no-store')
  status() { return this.auth.status(); }

  @Post('setup')
  async setup(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.checkOrigin(request);
    const input = parseInput(z.object({ token: tokenSchema, email: emailSchema, password: passwordSchema, displayName: displayNameSchema }).strict(), body);
    return this.respond(await this.auth.setup(input), response);
  }
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.checkOrigin(request);
    const input = parseInput(z.object({ email: emailSchema, password: z.string().min(1).max(128) }).strict(), body);
    return this.respond(await this.auth.login(input.email, input.password), response);
  }
  @Post('accept-invitation')
  async accept(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.checkOrigin(request);
    const input = parseInput(z.object({ token: tokenSchema, password: passwordSchema, displayName: displayNameSchema }).strict(), body);
    return this.respond(await this.auth.acceptInvitation(input), response);
  }
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.checkOrigin(request);
    const token = readRefreshCookie(request.headers.cookie);
    if (!token) throw new UnauthorizedException('Connexion requise.');
    return this.respond(await this.auth.refresh(token), response);
  }
  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  async logout(@Req() request: AuthRequest, @Res({ passthrough: true }) response: Response) {
    this.checkOrigin(request);
    await this.auth.logout(request.account.sessionId);
    response.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth', httpOnly: true, sameSite: 'strict', secure: new URL(this.infrastructure.config.PUBLIC_APP_URL).protocol === 'https:' });
    response.setHeader('Cache-Control', 'no-store');
  }
  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Header('Cache-Control', 'no-store')
  me(@Req() request: AuthRequest) {
    const { id, email, displayName, isAdmin } = request.account;
    return { id, email, displayName, isAdmin };
  }
}

@ApiTags('invitations')
@ApiBearerAuth()
@Controller('invitations')
@UseGuards(AuthGuard, AdminGuard)
export class InvitationsController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  list() { return this.auth.listInvitations(); }
  @Post()
  @Header('Cache-Control', 'no-store')
  create(@Body() body: unknown, @Req() request: AuthRequest) {
    const { email } = parseInput(z.object({ email: emailSchema }).strict(), body);
    return this.auth.createInvitation(email, request.account.id);
  }
  @Delete(':id')
  @HttpCode(204)
  revoke(@Param('id', ParseUUIDPipe) id: string) { return this.auth.revokeInvitation(id); }
}
