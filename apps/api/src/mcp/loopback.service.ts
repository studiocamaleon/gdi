import { Injectable } from '@nestjs/common';

/**
 * Cliente HTTP loopback: las tools MCP le pegan al PROPIO API con el mismo
 * Bearer que trajo el cliente MCP (el token `grafo_mcp_...`).
 *
 * Es LA decisión de seguridad del módulo (docs/mcp-cotizador-diseno.md §3.1):
 * al entrar por HTTP se hereda el pipeline completo — Throttler → AuthGuard →
 * PermisosGuard → contexto de tenant (ALS) → tenant-guard de Prisma →
 * MargenesInterceptor. Llamar services directo saltearía TODO eso: sin ALS el
 * tenant-guard no filtra nada, y sin el interceptor los costos viajarían.
 * Prohibido "optimizar" esto a llamadas in-process.
 */
@Injectable()
export class LoopbackService {
  private readonly baseUrl =
    process.env.MCP_LOOPBACK_URL ??
    `http://127.0.0.1:${process.env.PORT ?? 3001}/api`;

  async llamar<T = unknown>(
    token: string,
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const texto = await res.text();
    let data: unknown = null;
    try {
      data = texto ? JSON.parse(texto) : null;
    } catch {
      data = { raw: texto };
    }

    if (!res.ok) {
      const mensaje =
        (data as { message?: string | string[] } | null)?.message ?? res.statusText;
      throw new LoopbackError(
        res.status,
        Array.isArray(mensaje) ? mensaje.join('; ') : String(mensaje),
      );
    }
    return data as T;
  }
}

export class LoopbackError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
