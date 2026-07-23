import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

/**
 * Impersonación auditada (etapa C): el staff del control plane entra a un
 * tenant para asistirlo, con motivo obligatorio, vencimiento y rastro visible.
 * Nunca god-mode: cada sesión es un registro, expira sola, y el token muere
 * con ella. Ver docs/control-plane-diseno.md
 */

const DURACION_MIN = 60;

export type SesionActiva = {
  id: string;
  tenantId: string;
  tenantNombre: string;
  staffUserId: string;
  staffNombre: string | null;
  motivo: string;
  creadaEl: string;
  expiraEl: string;
  /** Segundos que faltan para que expire (para el countdown de la UI). */
  expiraEnSeg: number;
};

@Injectable()
export class ImpersonacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  /**
   * Inicia una sesión y devuelve el token con el que el front "entra" al
   * tenant (mismo mecanismo que switch-tenant). No se puede entrar a un tenant
   * suspendido ni al propio tenant plataforma.
   */
  async iniciar(
    staffUserId: string,
    tenantId: string,
    motivo: string,
  ): Promise<{ token: string; tenantNombre: string; expiraEl: string }> {
    const limpio = motivo.trim();
    if (limpio.length < 5) {
      throw new BadRequestException(
        'El motivo es obligatorio (mínimo 5 caracteres): queda en la auditoría y el cliente puede verlo.',
      );
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, nombre: true, activo: true, esPlataforma: true },
    });
    if (!tenant) throw new NotFoundException('El tenant no existe.');
    if (!tenant.activo) {
      throw new BadRequestException(
        'No se puede entrar a un tenant suspendido: reactivalo primero.',
      );
    }
    if (tenant.esPlataforma) {
      throw new BadRequestException(
        'El tenant plataforma no se impersona: entrá con tu propia cuenta.',
      );
    }

    // Una sesión activa por (staff, tenant): re-entrar cierra la anterior en
    // vez de acumular. Barre también las vencidas del staff, de paso.
    await this.cerrarVencidas();
    await this.prisma.sesionImpersonacion.updateMany({
      where: { staffUserId, tenantId, cerradaEl: null },
      data: { cerradaEl: new Date(), motivoCierre: 'reemplazada' },
    });

    const staff = await this.prisma.user.findUnique({
      where: { id: staffUserId },
      select: { nombreCompleto: true, email: true },
    });
    const actorNombre = `Soporte Grafo (${staff?.nombreCompleto ?? staff?.email ?? 'staff'})`;
    const expiraEl = new Date(Date.now() + DURACION_MIN * 60 * 1000);

    const sesion = await this.prisma.sesionImpersonacion.create({
      data: { staffUserId, tenantId, motivo: limpio, expiraEl },
      select: { id: true },
    });
    await this.prisma.plataformaEvento.create({
      data: {
        staffUserId,
        tipo: 'impersonacion_iniciada',
        tenantAfectadoId: tenantId,
        descripcion: `Entró a ${tenant.nombre} como soporte: ${limpio}`,
        datosJson: { sesionId: sesion.id, expiraEl: expiraEl.toISOString() },
      },
    });

    const token = await this.auth.emitirTokenImpersonacion({
      tenantId,
      sesionImpersonacionId: sesion.id,
      expiraEl,
      actorUserId: staffUserId,
      actorNombre,
    });
    return {
      token,
      tenantNombre: tenant.nombre,
      expiraEl: expiraEl.toISOString(),
    };
  }

  /** Cierra una sesión (el staff sale). Idempotente. */
  async cerrar(
    staffUserId: string,
    sesionId: string,
    motivoCierre = 'salida',
  ): Promise<void> {
    const sesion = await this.prisma.sesionImpersonacion.findUnique({
      where: { id: sesionId },
      select: { id: true, staffUserId: true, cerradaEl: true, tenantId: true },
    });
    if (!sesion || sesion.staffUserId !== staffUserId) {
      // No filtramos si existe: sólo el dueño la cierra.
      throw new NotFoundException('La sesión no existe.');
    }
    if (sesion.cerradaEl) return;

    await this.prisma.$transaction([
      this.prisma.sesionImpersonacion.update({
        where: { id: sesionId },
        data: { cerradaEl: new Date(), motivoCierre },
      }),
      // Revoca la AuthSession del token: el corte es inmediato (el guard no
      // cachea impersonaciones).
      this.prisma.authSession.updateMany({
        where: { impersonacionId: sesionId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.plataformaEvento.create({
        data: {
          staffUserId,
          tipo: 'impersonacion_cerrada',
          tenantAfectadoId: sesion.tenantId,
          descripcion:
            motivoCierre === 'salida'
              ? 'Salió del tenant.'
              : `Sesión de impersonación cerrada (${motivoCierre}).`,
          datosJson: { sesionId },
        },
      }),
    ]);
  }

  /** Las sesiones vivas — para la consola y el banner. */
  async activas(): Promise<SesionActiva[]> {
    await this.cerrarVencidas();
    const filas = await this.prisma.sesionImpersonacion.findMany({
      where: { cerradaEl: null },
      orderBy: { creadaEl: 'desc' },
    });
    const tenantIds = [...new Set(filas.map((f) => f.tenantId))];
    const staffIds = [...new Set(filas.map((f) => f.staffUserId))];
    const [tenants, staff] = await Promise.all([
      this.prisma.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, nombre: true },
      }),
      this.prisma.user.findMany({
        where: { id: { in: staffIds } },
        select: { id: true, nombreCompleto: true, email: true },
      }),
    ]);
    const tNombre = new Map(tenants.map((t) => [t.id, t.nombre]));
    const sNombre = new Map(
      staff.map((s) => [s.id, s.nombreCompleto ?? s.email]),
    );
    const ahora = Date.now();
    return filas.map((f) => ({
      id: f.id,
      tenantId: f.tenantId,
      tenantNombre: tNombre.get(f.tenantId) ?? 'tenant dado de baja',
      staffUserId: f.staffUserId,
      staffNombre: sNombre.get(f.staffUserId) ?? null,
      motivo: f.motivo,
      creadaEl: f.creadaEl.toISOString(),
      expiraEl: f.expiraEl.toISOString(),
      expiraEnSeg: Math.max(
        0,
        Math.round((f.expiraEl.getTime() - ahora) / 1000),
      ),
    }));
  }

  /**
   * Cierra las que ya vencieron. Es la contracara del vencimiento: sin esto
   * una sesión expirada figuraría "activa" en la consola aunque su token ya
   * no sirva. Se llama al iniciar y al listar (barato), no necesita cron.
   */
  private async cerrarVencidas(): Promise<void> {
    const vencidas = await this.prisma.sesionImpersonacion.findMany({
      where: { cerradaEl: null, expiraEl: { lte: new Date() } },
      select: { id: true },
    });
    if (vencidas.length === 0) return;
    const ids = vencidas.map((v) => v.id);
    await this.prisma.$transaction([
      this.prisma.sesionImpersonacion.updateMany({
        where: { id: { in: ids } },
        data: { cerradaEl: new Date(), motivoCierre: 'expirada' },
      }),
      this.prisma.authSession.updateMany({
        where: { impersonacionId: { in: ids }, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }
}
