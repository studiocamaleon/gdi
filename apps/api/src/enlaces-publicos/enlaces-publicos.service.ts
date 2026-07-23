import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Prisma, TipoEnlacePublico } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Cliente Prisma o transacción: un enlace se emite en la MISMA transacción que
 * la entidad que apunta, así no queda una OT emitida sin su link (o al revés).
 */
type PrismaLike = PrismaService | Prisma.TransactionClient;

/**
 * 9 bytes → 12 chars exactos en base64url (sin padding), 72 bits de entropía.
 *
 * Es el punto donde la curva se aplana: con el throttler de 100 req/min por IP
 * que ya está puesto, acertar un token por fuerza bruta durante un año entero
 * es del orden de 1 en mil millones. Bajar a 8 chars ahorraría 4 caracteres y
 * costaría 24 bits — ahí la cuenta pasa a ~2% anual, que para un link que
 * muestra precios y datos del cliente no da.
 *
 * Los tokens históricos de 16 bytes (22 chars) siguen siendo válidos: el
 * lookup es por igualdad exacta. No hay que migrar una sola fila.
 */
const TOKEN_BYTES = 9;

export function generarTokenPublico(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** Lo que resolvió un token válido: a quién apunta y de qué tenant es. */
export type EnlaceResuelto = {
  entidadId: string;
  tenantId: string;
};

/**
 * Emisión y resolución de los links públicos del sistema.
 *
 * Toda ruta pública entra por acá: el token se resuelve contra `EnlacePublico`
 * (que valida tipo, revocación y caducidad) y recién con el `entidadId` que
 * devuelve se va a buscar la entidad. Ver docs/enlaces-publicos-diseno.md
 */
@Injectable()
export class EnlacesPublicosService {
  private readonly logger = new Logger(EnlacesPublicosService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea (o re-emite) el link de una entidad. Idempotente por [tipo, entidad]:
   * llamarlo dos veces no deja dos links vivos, pisa el token anterior.
   */
  async emitir(
    db: PrismaLike,
    params: {
      tenantId: string;
      tipo: TipoEnlacePublico;
      entidadId: string;
      token: string;
      expiraEl?: Date | null;
    },
  ): Promise<string> {
    const { tenantId, tipo, entidadId, token, expiraEl = null } = params;
    await db.enlacePublico.upsert({
      where: { tipo_entidadId: { tipo, entidadId } },
      create: { tenantId, tipo, entidadId, token, expiraEl },
      // Re-emitir revive un link revocado: es el mismo acto de compartirlo.
      update: { token, expiraEl, revocadoEl: null },
    });
    return token;
  }

  /**
   * Traduce el token de la URL a la entidad que abre, o null si no sirve.
   *
   * El `tipo` esperado se compara contra el guardado: un token de presupuesto
   * pegado en /t/ no abre el seguimiento de nadie. Sin sesión no hay contexto
   * de tenant, así que el tenant-guard no filtra — está bien, el token es
   * único global y el tenantId sale de la propia fila.
   */
  async resolver(
    token: string,
    tipo: TipoEnlacePublico,
    opts: { contarVisita?: boolean } = {},
  ): Promise<EnlaceResuelto | null> {
    if (!token) return null;
    const enlace = await this.prisma.enlacePublico.findUnique({
      where: { token },
      select: {
        id: true,
        tipo: true,
        entidadId: true,
        tenantId: true,
        expiraEl: true,
        revocadoEl: true,
        primeraVistaEl: true,
      },
    });
    if (!enlace || enlace.tipo !== tipo) return null;
    if (enlace.revocadoEl) return null;
    if (enlace.expiraEl && enlace.expiraEl.getTime() < Date.now()) return null;

    if (opts.contarVisita) {
      // Métrica, no autorización: si falla, el cliente igual tiene que ver su
      // pedido. Por eso no se espera ni se propaga el error.
      const ahora = new Date();
      void this.prisma.enlacePublico
        .update({
          where: { id: enlace.id },
          data: {
            visitas: { increment: 1 },
            ultimaVistaEl: ahora,
            primeraVistaEl: enlace.primeraVistaEl ?? ahora,
          },
        })
        .catch((error: unknown) => {
          this.logger.warn(
            `No se pudo registrar la visita del enlace ${enlace.id}: ${String(error)}`,
          );
        });
    }

    return { entidadId: enlace.entidadId, tenantId: enlace.tenantId };
  }
}
