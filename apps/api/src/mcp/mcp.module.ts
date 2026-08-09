import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CredencialesMcpService } from './credenciales-mcp.service';
import { CredencialesMcpController } from './credenciales-mcp.controller';

/**
 * MCP: la superficie que expone Grafo a la IA del tenant.
 * Ver docs/mcp-cotizador-diseno.md
 *
 * Por ahora: gestión de credenciales. El transporte Streamable HTTP y las
 * tools de cotización se suman en este mismo módulo (F1.3).
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CredencialesMcpController],
  providers: [CredencialesMcpService],
})
export class McpModule {}
