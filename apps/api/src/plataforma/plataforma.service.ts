import { Injectable } from '@nestjs/common';
import type { EstadoIntegracion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Lecturas del control plane: la consola de la Plataforma (etapa A).
 *
 * Todo acá corre SIN contexto de tenant — el controller lleva @SinTenant() —
 * y por eso el tenant-guard no filtra: los groupBy por tenantId ven todos los
 * tenants, que es exactamente lo que la consola necesita. Es la misma base
 * que usan los crons.
 *
 * Dos reglas de este módulo:
 *  - SÓLO lectura (la etapa A no escribe nada; las escrituras llegan en B con
 *    su auditoría en PlataformaEvento).
 *  - No se reusan services de negocio: llamados sin contexto leerían todos
 *    los tenants sin que se note. Las queries de acá son propias y explícitas.
 *
 * Detalle del spec de aislamiento: Membership sólo puede consultarse desde
 * auth.service.ts (lo refuerza un escaneo de archivos), así que los usuarios
 * por tenant salen de `Tenant._count.memberships` — la relación no dispara el
 * escaneo y el resultado es el mismo. Ver docs/control-plane-diseno.md
 */

const DIA_MS = 24 * 60 * 60 * 1000;

export type TenantConsola = {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
  creadoEl: string;
  usuariosActivos: number;
  /** Última sesión iniciada apuntando a este tenant. Null = nunca. */
  ultimoAccesoEl: string | null;
  /** Sin logins en 14 días: la señal temprana de churn. */
  sinActividad14d: boolean;
  ots30d: number;
  cotizaciones30d: number;
  cobros30d: number;
  storageBytes: number;
  storageCuotaBytes: number | null;
  integraciones: Array<{
    proveedor: string;
    estado: EstadoIntegracion;
    ultimoErrorTexto: string | null;
  }>;
  whatsappPendientes: number;
  whatsappFallidas: number;
};

export type ConsolaPlataforma = {
  resumen: {
    tenants: number;
    tenantsActivos: number;
    usuariosActivos: number;
    ots30d: number;
    storageBytes: number;
    sinActividad14d: number;
  };
  tenants: TenantConsola[];
};

@Injectable()
export class PlataformaService {
  constructor(private readonly prisma: PrismaService) {}

  async consola(): Promise<ConsolaPlataforma> {
    const ahora = Date.now();
    const corte30 = new Date(ahora - 30 * DIA_MS);
    const corte14 = new Date(ahora - 14 * DIA_MS);

    const [
      tenants,
      accesos,
      ots,
      cotizaciones,
      cobros,
      integraciones,
      whatsapp,
    ] = await Promise.all([
      this.prisma.tenant.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          nombre: true,
          slug: true,
          activo: true,
          createdAt: true,
          bytesArchivos: true,
          cuotaBytesArchivos: true,
          _count: {
            select: { memberships: { where: { activa: true } } },
          },
        },
      }),
      this.prisma.authSession.groupBy({
        by: ['currentTenantId'],
        _max: { createdAt: true },
      }),
      this.prisma.ordenTrabajo.groupBy({
        by: ['tenantId'],
        where: { fechaEmision: { gte: corte30 } },
        _count: { _all: true },
      }),
      this.prisma.cotizacion.groupBy({
        by: ['tenantId'],
        where: { createdAt: { gte: corte30 } },
        _count: { _all: true },
      }),
      this.prisma.cobro.groupBy({
        by: ['tenantId'],
        where: { fecha: { gte: corte30 }, anuladoEl: null },
        _count: { _all: true },
      }),
      this.prisma.integracionTenant.findMany({
        select: {
          tenantId: true,
          proveedor: true,
          estado: true,
          ultimoErrorTexto: true,
        },
      }),
      this.prisma.notificacionWhatsapp.groupBy({
        by: ['tenantId', 'estado'],
        where: { estado: { in: ['pendiente', 'fallida'] } },
        _count: { _all: true },
      }),
    ]);

    const porTenant = <T extends { tenantId: string }>(filas: T[]) =>
      new Map(filas.map((f) => [f.tenantId, f]));

    const accesoDe = new Map(
      accesos.map((a) => [a.currentTenantId, a._max.createdAt]),
    );
    const otsDe = porTenant(ots);
    const cotizacionesDe = porTenant(cotizaciones);
    const cobrosDe = porTenant(cobros);

    const filas: TenantConsola[] = tenants.map((t) => {
      const acceso = accesoDe.get(t.id) ?? null;
      const wa = whatsapp.filter((w) => w.tenantId === t.id);
      return {
        id: t.id,
        nombre: t.nombre,
        slug: t.slug,
        activo: t.activo,
        creadoEl: t.createdAt.toISOString(),
        usuariosActivos: t._count.memberships,
        ultimoAccesoEl: acceso?.toISOString() ?? null,
        sinActividad14d: !acceso || acceso < corte14,
        ots30d: otsDe.get(t.id)?._count._all ?? 0,
        cotizaciones30d: cotizacionesDe.get(t.id)?._count._all ?? 0,
        cobros30d: cobrosDe.get(t.id)?._count._all ?? 0,
        storageBytes: Number(t.bytesArchivos),
        storageCuotaBytes:
          t.cuotaBytesArchivos === null ? null : Number(t.cuotaBytesArchivos),
        integraciones: integraciones
          .filter((i) => i.tenantId === t.id)
          .map((i) => ({
            proveedor: i.proveedor,
            estado: i.estado,
            ultimoErrorTexto: i.ultimoErrorTexto,
          })),
        whatsappPendientes:
          wa.find((w) => w.estado === 'pendiente')?._count._all ?? 0,
        whatsappFallidas:
          wa.find((w) => w.estado === 'fallida')?._count._all ?? 0,
      };
    });

    return {
      resumen: {
        tenants: filas.length,
        tenantsActivos: filas.filter((f) => f.activo).length,
        usuariosActivos: filas.reduce((s, f) => s + f.usuariosActivos, 0),
        ots30d: filas.reduce((s, f) => s + f.ots30d, 0),
        storageBytes: filas.reduce((s, f) => s + f.storageBytes, 0),
        sinActividad14d: filas.filter((f) => f.activo && f.sinActividad14d)
          .length,
      },
      tenants: filas,
    };
  }
}
