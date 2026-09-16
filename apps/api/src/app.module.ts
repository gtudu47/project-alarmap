import { Controller, Get, Inject, Module, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Infrastructure } from './infrastructure.js';
import { AuthService } from './auth/auth.service.js';
import { AuthController, InvitationsController } from './auth/auth.controller.js';
import { AdminGuard, AuthGuard } from './auth/auth.guard.js';
import { WorldsService } from './worlds/worlds.service.js';
import { WorldsController } from './worlds/worlds.controller.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(Infrastructure) private readonly infrastructure: Infrastructure) {}
  @Get('live')
  @ApiOperation({ summary: 'Vérifie que le processus répond.' })
  live(): { status: string } { return { status: 'ok' }; }
  @Get('ready')
  @ApiOperation({ summary: 'Vérifie PostgreSQL, PostGIS, les migrations et le stockage.' })
  async ready(): Promise<{ status: string }> {
    try {
      const result = await this.infrastructure.pool.query<{ count: string }>("SELECT count(*) FROM schema_migrations WHERE name IN ('001_foundations.sql','002_accounts.sql')");
      if (result.rows[0]?.count !== '2') throw new Error('Migration absente.');
      await this.infrastructure.pool.query('SELECT PostGIS_Version()');
      await this.infrastructure.storage.ready();
      return { status: 'ok' };
    } catch { throw new ServiceUnavailableException('Services indisponibles.'); }
  }
}
@Module({
  controllers: [HealthController, AuthController, InvitationsController, WorldsController],
  providers: [Infrastructure, AuthService, AuthGuard, AdminGuard, WorldsService],
})
export class AppModule {}
