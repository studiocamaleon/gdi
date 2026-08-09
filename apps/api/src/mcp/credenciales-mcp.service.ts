import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SessionCacheService } from '../auth/session-cache.service';
import { CurrentAuth } from '../auth/auth.types';
import {
  generarTokenMcp,
  hashTokenMcp,
  pistaDeToken,
} from '../auth/credencial-mcp.util';
import { esPermisoValido } from '../auth/permisos';

/**
 * Scopes por defecto de una credencial nueva: el mínimo para cotizar
 * conversando (catálogo + motor + clientes, todo lectura). El que quiera más
 * lo pide explícito desde la UI — y aún pidiendo todo, finanzas.ver_margenes
 * jamás entra (se rechaza acá y se filtra de nuevo en el guard).
 */
const SCOPES_DEFAULT = ['comercial.ver', 'costos.ver', 'registros.ver'];

@Injectable()
export class CredencialesMcpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionCache: SessionCacheService,
  ) {}

  /**
   * CredencialMcp está EXENTA del tenant-guard (se resuelve por tokenHash sin
   * contexto), así que acá el filtro por tenant es manual y obligatorio en
   * cada query. No sacar el `tenantId` de ningún where.
   */
  async listar(auth: CurrentAuth) {
    const credenciales = await this.prisma.credencialMcp.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nombre: true,
        pista: true,
        scopes: true,
        expiraEl: true,
        revocadoEl: true,
        ultimoUsoEl: true,
        createdAt: true,
        membership: {
          select: { user: { select: { nombreCompleto: true, email: true } } },
        },
      },
    });
    return credenciales.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      pista: c.pista,
      scopes: c.scopes,
      expiraEl: c.expiraEl,
      revocadoEl: c.revocadoEl,
      ultimoUsoEl: c.ultimoUsoEl,
      createdAt: c.createdAt,
      usuario: c.membership.user.nombreCompleto || c.membership.user.email,
    }));
  }

  /**
   * Crea una credencial ligada a la membership DEL CREADOR: hereda su rol y
   * sus ipsPermitidas. El token se devuelve UNA sola vez; en la base queda el
   * hash. Auditoría en EventoAcceso.
   */
  async crear(
    auth: CurrentAuth,
    dto: { nombre: string; scopes?: string[]; expiraEl?: string | null },
  ) {
    this.soloHumanos(auth);

    const scopes = dto.scopes?.length ? dto.scopes : SCOPES_DEFAULT;
    if (scopes.includes('finanzas.ver_margenes')) {
      throw new BadRequestException(
        'Una credencial MCP no puede ver márgenes ni costos: ese permiso no se puede otorgar.',
      );
    }
    const invalidos = scopes.filter((s) => !esPermisoValido(s));
    if (invalidos.length) {
      throw new BadRequestException(
        `Scopes desconocidos: ${invalidos.join(', ')}`,
      );
    }

    const expiraEl = dto.expiraEl ? new Date(dto.expiraEl) : null;
    if (expiraEl && (isNaN(expiraEl.getTime()) || expiraEl <= new Date())) {
      throw new BadRequestException('La expiración debe ser una fecha futura.');
    }

    const token = generarTokenMcp();
    const credencial = await this.prisma.credencialMcp.create({
      data: {
        tenantId: auth.tenantId,
        membershipId: auth.membershipId,
        nombre: dto.nombre.trim(),
        tokenHash: hashTokenMcp(token),
        pista: pistaDeToken(token),
        scopes,
        expiraEl,
        creadaPorId: auth.userId,
      },
    });

    await this.auditar(auth, 'credencial_mcp_creada', credencial.nombre, {
      credencialId: credencial.id,
      scopes,
      expiraEl,
    });

    // Única vez que el token viaja en claro. No se loguea, no se re-muestra.
    return { id: credencial.id, nombre: credencial.nombre, token };
  }

  async revocar(auth: CurrentAuth, id: string) {
    this.soloHumanos(auth);

    const credencial = await this.prisma.credencialMcp.findFirst({
      where: { id, tenantId: auth.tenantId, revocadoEl: null },
    });
    if (!credencial) {
      throw new NotFoundException('Credencial no encontrada o ya revocada.');
    }

    await this.prisma.credencialMcp.update({
      where: { id: credencial.id },
      data: { revocadoEl: new Date() },
    });
    // Corte inmediato en esta réplica; en otras, a lo sumo el TTL de 30 s.
    this.sessionCache.invalidate(`mcp:${credencial.tokenHash}`);

    await this.auditar(auth, 'credencial_mcp_revocada', credencial.nombre, {
      credencialId: credencial.id,
    });

    return { ok: true };
  }

  /**
   * Una credencial MCP no gestiona credenciales: si la IA pudiera crear o
   * revocar tokens, un prompt injection escala a persistencia. Sólo humanos.
   */
  private soloHumanos(auth: CurrentAuth) {
    if (auth.mcp) {
      throw new ForbiddenException(
        'Las credenciales MCP no pueden gestionar credenciales.',
      );
    }
  }

  private async auditar(
    auth: CurrentAuth,
    tipo: 'credencial_mcp_creada' | 'credencial_mcp_revocada',
    nombreCredencial: string,
    datosJson: Record<string, unknown>,
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: auth.userId },
        select: { nombreCompleto: true, email: true },
      });
      const actor = user?.nombreCompleto || user?.email || auth.email;
      const verbo = tipo === 'credencial_mcp_creada' ? 'creó' : 'revocó';
      await this.prisma.eventoAcceso.create({
        data: {
          tenantId: auth.tenantId,
          actorUserId: auth.userId,
          actorNombre: actor,
          tipo,
          descripcion: `${actor} ${verbo} la credencial MCP "${nombreCredencial}"`,
          datosJson: datosJson as object,
        },
      });
    } catch {
      // La auditoría no tumba la operación; el evento perdido se nota en el
      // listado de credenciales igual.
    }
  }
}
