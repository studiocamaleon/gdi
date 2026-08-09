import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CredencialesMcpService } from './credenciales-mcp.service';
import { CredencialesMcpController } from './credenciales-mcp.controller';
import { McpController } from './mcp.controller';
import { McpServerFactory } from './mcp-server.factory';
import { LoopbackService } from './loopback.service';

/**
 * MCP: la superficie que expone Grafo a la IA del tenant.
 * Ver docs/mcp-cotizador-diseno.md
 *
 * - CredencialesMcpController: gestión de credenciales (humanos, UI).
 * - McpController: transporte Streamable HTTP (la IA), stateless.
 * - Tools → LoopbackService → el propio API por HTTP: pipeline completo,
 *   nunca services directos.
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CredencialesMcpController, McpController],
  providers: [CredencialesMcpService, McpServerFactory, LoopbackService],
})
export class McpModule {}
