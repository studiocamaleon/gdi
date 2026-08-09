import {
  Controller,
  Delete,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SoloAutenticado } from '../auth/permiso.decorator';
import { CurrentAuth } from '../auth/auth.types';
import { PREFIJO_TOKEN_MCP } from '../auth/credencial-mcp.util';
import { McpServerFactory } from './mcp-server.factory';

/**
 * Transporte MCP: POST /api/mcp (Streamable HTTP, modo STATELESS).
 *
 * Cada request arma servidor+transport frescos y los descarta al cerrar: sin
 * sesiones MCP que sobrevivan al request no hay estado que se desincronice
 * entre réplicas, y la revocación de la credencial corta al request siguiente.
 * El costo (rearmar 4 tools por request) es despreciable al lado de una
 * cotización del motor.
 *
 * La autenticación la hizo el AuthGuard (rama grafo_mcp_) antes de llegar acá;
 * el token se re-extrae del header sólo para que las tools lo reusen en el
 * loopback. GET/DELETE devuelven 405: en modo stateless no hay stream SSE que
 * retomar ni sesión que borrar.
 */
@Controller('mcp')
export class McpController {
  constructor(private readonly factory: McpServerFactory) {}

  @SoloAutenticado()
  @Post()
  async handle(
    @Req() req: Request & { auth?: CurrentAuth },
    @Res() res: Response,
  ) {
    // El transporte es para credenciales MCP: una sesión humana (JWT) tiene
    // la app entera y no necesita este camino; rechazarla mantiene un solo
    // tipo de actor por superficie.
    if (!req.auth?.mcp) {
      throw new UnauthorizedException(
        'Este endpoint requiere una credencial MCP (token grafo_mcp_...).',
      );
    }
    const token = this.extraerToken(req);

    const server = this.factory.crear(token);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
      enableJsonResponse: true,
    });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    // El SDK tipa `req.auth` con SU AuthInfo (OAuth propio); nuestro auth es
    // el CurrentAuth del guard y las tools no consumen el authInfo del SDK,
    // así que el cast es sólo de tipos, no de comportamiento.
    await transport.handleRequest(
      req as unknown as Parameters<typeof transport.handleRequest>[0],
      res,
      req.body,
    );
  }

  @SoloAutenticado()
  @Get()
  metodoNoPermitido(@Res() res: Response) {
    this.responder405(res);
  }

  @SoloAutenticado()
  @Delete()
  metodoNoPermitidoDelete(@Res() res: Response) {
    this.responder405(res);
  }

  private responder405(res: Response) {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed (stateless MCP).' },
      id: null,
    });
  }

  private extraerToken(req: Request): string {
    const authorization = req.headers.authorization ?? '';
    const [tipo, token] = authorization.split(' ');
    if (tipo !== 'Bearer' || !token?.startsWith(PREFIJO_TOKEN_MCP)) {
      throw new UnauthorizedException('Falta el token de credencial MCP.');
    }
    return token;
  }
}
