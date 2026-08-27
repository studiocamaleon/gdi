import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RolSistema, type EstadoIntegracion } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PaddleService } from '../cobro/paddle.service';
import { finDePrueba } from '../suscripciones/trial';

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
  /** Null = tenant legacy sin plan asignado (grandfathered). */
  plan: {
    codigo: string;
    nombre: string;
    precioMensual: number;
    estado: string;
    usuariosMax: number | null;
    ordenesMesMax: number | null;
    storageGb: number | null;
  } | null;
};

export type PlanCatalogo = {
  id: string;
  codigo: string;
  nombre: string;
  /** Bajada comercial que ve el tenant en la tarjeta del plan. */
  descripcion: string | null;
  precioMensual: number;
  moneda: string;
  features: Record<string, unknown>;
  /** Mapeo con el catálogo de Paddle. Null = el plan todavía no se vende por
   *  Paddle. Se carga desde la consola porque sandbox y producción tienen
   *  catálogos distintos: así migrar de uno a otro no requiere deploy. */
  paddlePriceId: string | null;
  paddleProductId: string | null;
  /** Variante anual: otro precio de Paddle para el mismo plan. */
  paddlePriceIdAnual: string | null;
  precioAnual: number | null;
  /** Días de prueba que otorga el plan al asignarse. */
  trialDias: number | null;
  /** False = visible sólo en Plataforma, nunca en la oferta al tenant. */
  publico: boolean;
  /** Cuántos tenants están hoy en este plan (para no cambiar a ciegas). */
  tenants: number;
};

export type EventoPlataforma = {
  id: string;
  tipo: string;
  descripcion: string;
  tenantAfectadoId: string | null;
  staffNombre: string | null;
  staffEmail: string;
  creadoEl: string;
};

export type SemanaActividad = {
  /** Lunes de la semana, ISO (YYYY-MM-DD). El front lo rotula. */
  semana: string;
  ots: number;
  cotizaciones: number;
  cobros: number;
};

export type ConsolaPlataforma = {
  /** Quién está mirando (para el pie del rail). Null en usos internos.
   *  esSesionPlataforma distingue al staff que entró por el backoffice (sin
   *  tenant) del que llegó desde su propio dashboard: define si el rail ofrece
   *  "Volver a la app" o sólo "Cerrar sesión". */
  staff: {
    nombre: string | null;
    email: string;
    rol: string;
    esSesionPlataforma: boolean;
  } | null;
  /** Los últimos movimientos del control plane (PlataformaEvento). */
  auditoria: EventoPlataforma[];
  resumen: {
    tenants: number;
    tenantsActivos: number;
    usuariosActivos: number;
    ots30d: number;
    storageBytes: number;
    sinActividad14d: number;
    /** Σ precio de las suscripciones ACTIVAS. Real desde la etapa B1. */
    mrr: number;
    /** Tenants sin plan asignado (legacy): la consola los muestra aparte. */
    sinPlan: number;
    /** Los 30 días ANTERIORES a los últimos 30: el denominador de los deltas. */
    ots30dPrev: number;
    cotizaciones30d: number;
    cotizaciones30dPrev: number;
    cobros30d: number;
    cobros30dPrev: number;
  };
  /** 12 semanas de actividad agregada — la serie del gráfico grande. */
  actividadSemanal: SemanaActividad[];
  /** Altas de tenants por mes, últimos 6 (de Tenant.createdAt). */
  altasMensuales: Array<{ mes: string; altas: number }>;
  tenants: TenantConsola[];
};

@Injectable()
export class PlataformaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paddle: PaddleService,
  ) {}

  async consola(
    staffUserId?: string,
    esSesionPlataforma = false,
  ): Promise<ConsolaPlataforma> {
    const ahora = Date.now();
    const corte30 = new Date(ahora - 30 * DIA_MS);
    const corte14 = new Date(ahora - 14 * DIA_MS);
    const corte84 = new Date(ahora - 84 * DIA_MS);

    const [
      tenants,
      accesos,
      ots,
      cotizaciones,
      cobros,
      integraciones,
      whatsapp,
      fechasOts,
      fechasCotizaciones,
      fechasCobros,
      eventos,
      staff,
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
          suscripcion: {
            select: {
              estado: true,
              plan: {
                select: {
                  codigo: true,
                  nombre: true,
                  precioMensual: true,
                  featuresJson: true,
                },
              },
            },
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
      this.prisma.ordenTrabajo.findMany({
        where: { fechaEmision: { gte: corte84 } },
        select: { fechaEmision: true },
      }),
      this.prisma.cotizacion.findMany({
        where: { createdAt: { gte: corte84 } },
        select: { createdAt: true },
      }),
      this.prisma.cobro.findMany({
        where: { fecha: { gte: corte84 }, anuladoEl: null },
        select: { fecha: true },
      }),
      this.prisma.plataformaEvento.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          staff: { select: { nombreCompleto: true, email: true } },
        },
      }),
      staffUserId
        ? this.prisma.user.findUnique({
            where: { id: staffUserId },
            select: { nombreCompleto: true, email: true, rolPlataforma: true },
          })
        : Promise.resolve(null),
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
        plan: t.suscripcion
          ? (() => {
              const f = (t.suscripcion.plan.featuresJson ?? {}) as {
                usuariosMax?: number;
                ordenesMesMax?: number;
                storageGb?: number;
              };
              return {
                codigo: t.suscripcion.plan.codigo,
                nombre: t.suscripcion.plan.nombre,
                precioMensual: Number(t.suscripcion.plan.precioMensual),
                estado: t.suscripcion.estado,
                usuariosMax: f.usuariosMax ?? null,
                ordenesMesMax: f.ordenesMesMax ?? null,
                storageGb: f.storageGb ?? null,
              };
            })()
          : null,
      };
    });

    // ── Series reales (12 semanas / deltas 30d vs 30d previos) ─────────
    const dOts = fechasOts.map((f) => f.fechaEmision!).filter(Boolean);
    const dCot = fechasCotizaciones.map((f) => f.createdAt);
    const dCob = fechasCobros.map((f) => f.fecha);
    const enVentana = (fechas: Date[], desde: number, hasta: number) =>
      fechas.filter((f) => f.getTime() >= desde && f.getTime() < hasta).length;
    const corte60 = ahora - 60 * DIA_MS;
    const corte30ms = corte30.getTime();

    // Lunes de la semana actual, y 12 buckets hacia atrás.
    const hoy = new Date(ahora);
    const lunes = new Date(hoy);
    lunes.setHours(0, 0, 0, 0);
    lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
    const semanas: SemanaActividad[] = [];
    for (let i = 11; i >= 0; i--) {
      const ini = new Date(lunes.getTime() - i * 7 * DIA_MS);
      const fin = ini.getTime() + 7 * DIA_MS;
      semanas.push({
        semana: ini.toISOString().slice(0, 10),
        ots: enVentana(dOts, ini.getTime(), fin),
        cotizaciones: enVentana(dCot, ini.getTime(), fin),
        cobros: enVentana(dCob, ini.getTime(), fin),
      });
    }

    // Altas de tenants por mes (6 meses), del createdAt ya traído.
    const altasMensuales: Array<{ mes: string; altas: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const sig = new Date(hoy.getFullYear(), hoy.getMonth() - i + 1, 1);
      altasMensuales.push({
        mes: d.toISOString().slice(0, 7),
        altas: tenants.filter((t) => t.createdAt >= d && t.createdAt < sig)
          .length,
      });
    }

    return {
      actividadSemanal: semanas,
      altasMensuales,
      staff: staff
        ? {
            nombre: staff.nombreCompleto,
            email: staff.email,
            rol: staff.rolPlataforma ?? 'SOPORTE',
            esSesionPlataforma,
          }
        : null,
      auditoria: eventos.map((e) => ({
        id: e.id,
        tipo: e.tipo,
        descripcion: e.descripcion,
        tenantAfectadoId: e.tenantAfectadoId,
        staffNombre: e.staff.nombreCompleto,
        staffEmail: e.staff.email,
        creadoEl: e.createdAt.toISOString(),
      })),
      resumen: {
        tenants: filas.length,
        tenantsActivos: filas.filter((f) => f.activo).length,
        usuariosActivos: filas.reduce((s, f) => s + f.usuariosActivos, 0),
        ots30d: filas.reduce((s, f) => s + f.ots30d, 0),
        storageBytes: filas.reduce((s, f) => s + f.storageBytes, 0),
        sinActividad14d: filas.filter((f) => f.activo && f.sinActividad14d)
          .length,
        ots30dPrev: enVentana(dOts, corte60, corte30ms),
        cotizaciones30d: filas.reduce((s, f) => s + f.cotizaciones30d, 0),
        cotizaciones30dPrev: enVentana(dCot, corte60, corte30ms),
        cobros30d: filas.reduce((s, f) => s + f.cobros30d, 0),
        cobros30dPrev: enVentana(dCob, corte60, corte30ms),
        mrr: filas.reduce(
          (s, f) =>
            s +
            (f.plan && f.plan.estado === 'activa' ? f.plan.precioMensual : 0),
          0,
        ),
        sinPlan: filas.filter((f) => f.plan === null).length,
      },
      tenants: filas,
    };
  }

  // ── Escrituras (ADMIN, auditadas en PlataformaEvento) ────────────────
  // Ver docs/control-plane-diseno.md — etapa B1: ciclo de vida y planes.

  async planes(): Promise<PlanCatalogo[]> {
    const planes = await this.prisma.plan.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
      include: { _count: { select: { suscripciones: true } } },
    });
    return planes.map((p) => ({
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      descripcion: p.descripcion,
      precioMensual: Number(p.precioMensual),
      moneda: p.moneda,
      features: (p.featuresJson ?? {}) as Record<string, unknown>,
      paddlePriceId: p.paddlePriceId,
      paddleProductId: p.paddleProductId,
      paddlePriceIdAnual: p.paddlePriceIdAnual,
      precioAnual: p.precioAnual === null ? null : Number(p.precioAnual),
      trialDias: p.trialDias,
      publico: p.publico,
      tenants: p._count.suscripciones,
    }));
  }

  /** Edita la bajada comercial del plan (copy de producto, sin deploy). */
  async describirPlan(
    staffUserId: string,
    planId: string,
    descripcion: string | null,
  ): Promise<PlanCatalogo[]> {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      select: { nombre: true },
    });
    if (!plan) throw new NotFoundException('El plan no existe.');
    await this.prisma.$transaction([
      this.prisma.plan.update({
        where: { id: planId },
        data: { descripcion: descripcion?.trim() || null },
      }),
      this.prisma.plataformaEvento.create({
        data: {
          staffUserId,
          tipo: 'plan_descripcion',
          descripcion: `Bajada del plan ${plan.nombre} actualizada.`,
          datosJson: { planId },
        },
      }),
    ]);
    return this.planes();
  }

  /**
   * Vincula un plan con su precio en el catálogo de Paddle.
   *
   * Vive en la consola y no en un seed a propósito: los catálogos de sandbox y
   * producción son distintos, así que pasar de uno a otro tiene que ser cargar
   * un campo, no tocar código y deployar.
   *
   * El `paddlePriceId` es UNIQUE: dos planes no pueden apuntar al mismo precio
   * (si no, el webhook no sabría a cuál corresponde una suscripción).
   * Ver docs/suscripciones-cobro-diseno.md
   */
  async vincularPlanPaddle(
    staffUserId: string,
    planId: string,
    priceId: string | null,
    productId: string | null,
    ciclo: 'mensual' | 'anual' = 'mensual',
  ): Promise<PlanCatalogo[]> {
    const esAnual = ciclo === 'anual';
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      select: {
        id: true,
        nombre: true,
        paddlePriceId: true,
        paddlePriceIdAnual: true,
      },
    });
    if (!plan) throw new NotFoundException('El plan no existe.');

    const priceLimpio = priceId?.trim() || null;
    const productLimpio = productId?.trim() || null;

    if (priceLimpio) {
      // Un precio corresponde a UN plan y a UN ciclo: si el mismo id apareciera
      // dos veces, el webhook no sabría a cuál asignar la suscripción.
      const ocupado = await this.prisma.plan.findFirst({
        where: {
          OR: [
            { paddlePriceId: priceLimpio },
            { paddlePriceIdAnual: priceLimpio },
          ],
          id: { not: planId },
        },
        select: { nombre: true },
      });
      if (ocupado) {
        throw new ConflictException(
          `Ese precio de Paddle ya está vinculado al plan "${ocupado.nombre}". Un precio corresponde a un solo plan.`,
        );
      }
    }

    // Se consulta el catálogo de Paddle para VALIDAR que el id exista (un typo
    // se ve acá y no cuando falla un checkout) y para traer el monto real: el
    // precioMensual local es un espejo, y un espejo con un número inventado es
    // peor que no tenerlo. Si Paddle no está configurado, se vincula igual.
    let espejo: Record<string, number | string> | null = null;
    if (priceLimpio && this.paddle.habilitado) {
      const precio = await this.paddle.leerPrecio(priceLimpio);
      if (!precio) {
        throw new BadRequestException(
          `Paddle no reconoce el precio ${priceLimpio}. Revisá el id y que sea del mismo entorno (sandbox/producción) que la API key.`,
        );
      }
      espejo = esAnual
        ? { precioAnual: precio.monto, moneda: precio.moneda }
        : { precioMensual: precio.monto, moneda: precio.moneda };
    }

    await this.prisma.$transaction([
      this.prisma.plan.update({
        where: { id: planId },
        data: {
          ...(esAnual
            ? { paddlePriceIdAnual: priceLimpio }
            : { paddlePriceId: priceLimpio, paddleProductId: productLimpio }),
          ...(espejo ?? {}),
        },
      }),
      this.prisma.plataformaEvento.create({
        data: {
          staffUserId,
          tipo: 'plan_vinculado_paddle',
          descripcion: priceLimpio
            ? `Plan ${plan.nombre} (${ciclo}) vinculado al precio ${priceLimpio} de Paddle.`
            : `Plan ${plan.nombre} (${ciclo}) desvinculado de Paddle.`,
          datosJson: {
            planId,
            ciclo,
            anterior: esAnual ? plan.paddlePriceIdAnual : plan.paddlePriceId,
            nuevo: priceLimpio,
          },
        },
      }),
    ]);
    return this.planes();
  }

  /** Asigna (o cambia) el plan del tenant. Upsert: una suscripción por tenant. */
  async cambiarPlan(staffUserId: string, tenantId: string, planId: string) {
    const [tenant, plan] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          nombre: true,
          suscripcion: { select: { plan: { select: { nombre: true } } } },
        },
      }),
      this.prisma.plan.findUnique({ where: { id: planId } }),
    ]);
    if (!tenant) throw new NotFoundException('El tenant no existe.');
    if (!plan || !plan.activo) {
      throw new BadRequestException('El plan no existe o no está activo.');
    }

    // Si el plan otorga prueba, se le pone fecha de fin al asignarlo. Sólo al
    // dar de ALTA la suscripción: cambiarle el plan a alguien que ya está
    // adentro no le regala una prueba nueva.
    const trialHasta = finDePrueba(plan.trialDias);

    await this.prisma.$transaction([
      this.prisma.suscripcion.upsert({
        where: { tenantId },
        create: { tenantId, planId, estado: 'activa', trialHasta },
        update: { planId, estado: 'activa', hasta: null },
      }),
      this.prisma.plataformaEvento.create({
        data: {
          staffUserId,
          tipo: 'plan_cambiado',
          tenantAfectadoId: tenantId,
          descripcion: `Plan de ${tenant.nombre}: ${tenant.suscripcion?.plan.nombre ?? 'sin plan'} → ${plan.nombre}.`,
          datosJson: { planId, planCodigo: plan.codigo },
        },
      }),
    ]);
  }

  /**
   * Suspende el tenant: el auth guard valida `tenant.activo` en cada request,
   * así que el corte es inmediato (módulo el cache de sesión de 30 s). No
   * borra nada; reactivar lo deja como estaba.
   */
  async suspenderTenant(staffUserId: string, tenantId: string, motivo: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, nombre: true, activo: true },
    });
    if (!tenant) throw new NotFoundException('El tenant no existe.');
    if (!tenant.activo) {
      throw new BadRequestException('El tenant ya está suspendido.');
    }

    await this.prisma.$transaction([
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: { activo: false },
      }),
      this.prisma.suscripcion.updateMany({
        where: { tenantId },
        data: { estado: 'suspendida' },
      }),
      this.prisma.plataformaEvento.create({
        data: {
          staffUserId,
          tipo: 'tenant_suspendido',
          tenantAfectadoId: tenantId,
          descripcion: `Suspendió ${tenant.nombre}: ${motivo}`,
        },
      }),
    ]);
  }

  async reactivarTenant(staffUserId: string, tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, nombre: true, activo: true },
    });
    if (!tenant) throw new NotFoundException('El tenant no existe.');
    if (tenant.activo) {
      throw new BadRequestException('El tenant ya está activo.');
    }

    await this.prisma.$transaction([
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: { activo: true },
      }),
      this.prisma.suscripcion.updateMany({
        where: { tenantId },
        data: { estado: 'activa' },
      }),
      this.prisma.plataformaEvento.create({
        data: {
          staffUserId,
          tipo: 'tenant_reactivado',
          tenantAfectadoId: tenantId,
          descripcion: `Reactivó ${tenant.nombre}.`,
        },
      }),
    ]);
  }

  /**
   * Alta de un tenant: tenant + suscripción + invitación del primer admin,
   * en una transacción. La invitación va SIN sender (el staff no tiene
   * membership; por eso Invitation.invitedByMembershipId es nullable) y el
   * link se devuelve para mandárselo al cliente.
   */
  async crearTenant(
    staffUserId: string,
    dto: { nombre: string; slug: string; planId: string; adminEmail: string },
  ): Promise<{ tenantId: string; invitacionUrl: string }> {
    const slug = dto.slug.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) {
      throw new BadRequestException(
        'El slug: minúsculas, números y guiones (2 a 41 caracteres).',
      );
    }
    const existente = await this.prisma.tenant.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existente) throw new ConflictException('Ese slug ya está en uso.');
    const plan = await this.prisma.plan.findUnique({
      where: { id: dto.planId },
    });
    if (!plan || !plan.activo) {
      throw new BadRequestException('El plan no existe o no está activo.');
    }

    const email = dto.adminEmail.trim().toLowerCase();
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const tenant = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.tenant.create({
        data: { nombre: dto.nombre.trim(), slug },
        select: { id: true, nombre: true },
      });
      await tx.suscripcion.create({
        data: { tenantId: creado.id, planId: plan.id, estado: 'activa' },
      });
      await tx.invitation.create({
        data: {
          tenantId: creado.id,
          email,
          rol: RolSistema.ADMINISTRADOR,
          tokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      await tx.plataformaEvento.create({
        data: {
          staffUserId,
          tipo: 'tenant_creado',
          tenantAfectadoId: creado.id,
          descripcion: `Creó ${creado.nombre} (${slug}) en plan ${plan.nombre}; invitó a ${email}.`,
          datosJson: { planCodigo: plan.codigo, adminEmail: email },
        },
      });
      return creado;
    });

    const base =
      process.env.FRONTEND_URL?.split(',')[0]?.trim() ??
      'http://localhost:3000';
    return {
      tenantId: tenant.id,
      invitacionUrl: `${base}/aceptar-invitacion?token=${rawToken}`,
    };
  }
}
