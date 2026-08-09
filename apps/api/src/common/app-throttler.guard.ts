import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  PREFIJO_TOKEN_MCP,
  hashTokenMcp,
} from '../auth/credencial-mcp.util';

/**
 * ThrottlerGuard con tracker consciente de credenciales MCP.
 *
 * El guard corre ANTES que el AuthGuard (es el primer APP_GUARD), así que acá
 * no existe `req.auth`: el tracker sale del header crudo. Con el default (IP),
 * todo el tráfico MCP que llega desde el egress de un mismo proveedor de IA
 * (Anthropic, OpenAI) COMPARTIRÍA la cubeta de 100/min entre todos los
 * tenants: la credencial del tenant A agotaría el límite del tenant B.
 *
 * Con token `grafo_mcp_...` el tracker es el hash del token (una cubeta por
 * credencial, sin tocar la base). Todo lo demás sigue por IP, igual que hoy.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = (req.headers ?? {}) as Record<string, string | undefined>;
    const [tipo, token] = (headers.authorization ?? '').split(' ');
    if (tipo === 'Bearer' && token?.startsWith(PREFIJO_TOKEN_MCP)) {
      return `mcp:${hashTokenMcp(token)}`;
    }
    return super.getTracker(req);
  }
}
