import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ComprobantesService } from '../administracion/comprobantes.service';
import { runWithTenant } from '../common/tenant-context';
import type { CurrentAuth } from '../auth/auth.types';

/**
 * Billing de suscripciones (etapa B2): las facturas que Grupo Idea le emite a
 * cada tenant, generadas desde el control plane pero emitidas EN el tenant
 * plataforma (`Tenant.esPlataforma`) — reusando entero el módulo fiscal
 * (letra, totales, CAE, PDF) en vez de duplicarlo.
 *
 * El generador crea BORRADORES: la emisión con CAE sigue el flujo normal de
 * Administración → Comprobantes del tenant plataforma, donde ya están las
 * validaciones y el reintento. Idempotente por (suscripción, período): la
 * tabla FacturaSuscripcion es la memoria de qué período ya se facturó.
 *
 * Se factura a los tenants con suscripción ACTIVA y precio > 0 (trial no
 * factura), y nunca al propio tenant plataforma: Grupo Idea no se cobra a sí
 * mismo. Ver docs/control-plane-diseno.md
 */

export type FacturaSuscripcionDto = {
  id: string;
  periodo: string;
  tenantClienteId: string;
  tenantClienteNombre: string;
  monto: number;
  comprobante: {
    id: string;
    estado: string;
    letra: string;
    numeroCompleto: string | null;
  };
  creadaEl: string;
};

export type BillingPlataforma = {
  /** Null = nadie marcado como tenant plataforma: el billing no puede correr. */
  tenantPlataforma: { id: string; nombre: string; slug: string } | null;
  puntosVenta: Array<{ id: string; numero: number; nombre: string | null }>;
  periodoActual: string;
  /** Suscripciones activas con precio que AÚN no tienen factura del período. */
  pendientes: Array<{
    tenantId: string;
    tenantNombre: string;
    planNombre: string;
    monto: number;
  }>;
  facturas: FacturaSuscripcionDto[];
};

export type ResultadoGeneracion = {
  periodo: string;
  generadas: number;
  yaExistian: number;
  salteadas: Array<{ tenantNombre: string; motivo: string }>;
};

@Injectable()
export class PlataformaBillingService {
  private readonly logger = new Logger(PlataformaBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly comprobantes: ComprobantesService,
  ) {}

  private periodoActual(): string {
    return new Date().toISOString().slice(0, 7);
  }

  private async tenantPlataforma() {
    return this.prisma.tenant.findFirst({
      where: { esPlataforma: true },
      select: { id: true, nombre: true, slug: true },
    });
  }

  /** Las suscripciones facturables: activas, con precio, y no la plataforma. */
  private async facturables(plataformaId: string) {
    const suscripciones = await this.prisma.suscripcion.findMany({
      where: {
        estado: 'activa',
        tenantId: { not: plataformaId },
        tenant: { activo: true },
      },
      include: {
        plan: { select: { nombre: true, precioMensual: true } },
        tenant: { select: { id: true, nombre: true } },
      },
    });
    return suscripciones.filter((s) => Number(s.plan.precioMensual) > 0);
  }

  async estado(): Promise<BillingPlataforma> {
    const plataforma = await this.tenantPlataforma();
    const periodo = this.periodoActual();
    if (!plataforma) {
      return {
        tenantPlataforma: null,
        puntosVenta: [],
        periodoActual: periodo,
        pendientes: [],
        facturas: [],
      };
    }

    const [pvs, facturas, facturables, tenants] = await Promise.all([
      this.prisma.puntoVenta.findMany({
        where: { tenantId: plataforma.id, activo: true },
        orderBy: { numero: 'asc' },
        select: { id: true, numero: true, nombre: true },
      }),
      this.prisma.facturaSuscripcion.findMany({
        orderBy: { createdAt: 'desc' },
        take: 60,
        include: {
          comprobante: {
            select: {
              id: true,
              estado: true,
              letra: true,
              numero: true,
              puntoVenta: { select: { numero: true } },
            },
          },
        },
      }),
      this.facturables(plataforma.id),
      this.prisma.tenant.findMany({ select: { id: true, nombre: true } }),
    ]);

    const nombreDe = new Map(tenants.map((t) => [t.id, t.nombre]));
    const facturadasDelPeriodo = new Set(
      facturas.filter((f) => f.periodo === periodo).map((f) => f.suscripcionId),
    );

    return {
      tenantPlataforma: plataforma,
      puntosVenta: pvs,
      periodoActual: periodo,
      pendientes: facturables
        .filter((s) => !facturadasDelPeriodo.has(s.id))
        .map((s) => ({
          tenantId: s.tenant.id,
          tenantNombre: s.tenant.nombre,
          planNombre: s.plan.nombre,
          monto: Number(s.plan.precioMensual),
        })),
      facturas: facturas.map((f) => ({
        id: f.id,
        periodo: f.periodo,
        tenantClienteId: f.tenantClienteId,
        tenantClienteNombre:
          nombreDe.get(f.tenantClienteId) ?? 'tenant dado de baja',
        monto: Number(f.monto),
        comprobante: {
          id: f.comprobante.id,
          estado: f.comprobante.estado,
          letra: f.comprobante.letra,
          numeroCompleto:
            f.comprobante.numero !== null
              ? `${String(f.comprobante.puntoVenta.numero).padStart(4, '0')}-${String(f.comprobante.numero).padStart(8, '0')}`
              : null,
        },
        creadaEl: f.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Genera los borradores del período para todo lo facturable que falte.
   * Reentrante: el unique (suscripción, período) hace que correrlo dos veces
   * no duplique, y una corrida que se corta a mitad retoma donde quedó.
   */
  async generarPeriodo(
    staffUserId: string,
    puntoVentaId: string,
    periodo?: string,
  ): Promise<ResultadoGeneracion> {
    const plataforma = await this.tenantPlataforma();
    if (!plataforma) {
      throw new BadRequestException(
        'No hay un tenant marcado como plataforma (Tenant.esPlataforma).',
      );
    }
    const pv = await this.prisma.puntoVenta.findFirst({
      where: { id: puntoVentaId, tenantId: plataforma.id, activo: true },
      select: { id: true },
    });
    if (!pv) {
      throw new BadRequestException(
        'El punto de venta no es del tenant plataforma o está inactivo.',
      );
    }
    const per = periodo ?? this.periodoActual();
    if (!/^\d{4}-\d{2}$/.test(per)) {
      throw new BadRequestException('El período es YYYY-MM.');
    }

    // Auth sintético del tenant plataforma: ComprobantesService sólo usa
    // auth.tenantId (verificado) — el staff no tiene membership ahí y no
    // hace falta: emitir con CAE sigue siendo del flujo normal del tenant.
    const authPlataforma = {
      tenantId: plataforma.id,
      userId: staffUserId,
      sessionId: 'plataforma-billing',
      membershipId: '',
      role: 'ADMINISTRADOR',
      email: 'plataforma@grafo',
    } as CurrentAuth;

    const facturables = await this.facturables(plataforma.id);
    const existentes = new Set(
      (
        await this.prisma.facturaSuscripcion.findMany({
          where: { periodo: per },
          select: { suscripcionId: true },
        })
      ).map((f) => f.suscripcionId),
    );

    let generadas = 0;
    let yaExistian = 0;
    const salteadas: ResultadoGeneracion['salteadas'] = [];

    for (const s of facturables) {
      if (existentes.has(s.id)) {
        yaExistian += 1;
        continue;
      }
      try {
        const clienteId = await this.clienteDelTenant(
          plataforma.id,
          s.tenant.id,
          s.tenant.nombre,
        );
        const monto = Number(s.plan.precioMensual);
        const borrador = await runWithTenant(plataforma.id, () =>
          this.comprobantes.crearBorradorPorMonto(authPlataforma, {
            clienteId,
            puntoVentaId: pv.id,
            monto,
            concepto: `Suscripción Grafo — plan ${s.plan.nombre} — período ${per}`,
          }),
        );
        await this.prisma.facturaSuscripcion.create({
          data: {
            suscripcionId: s.id,
            tenantClienteId: s.tenant.id,
            periodo: per,
            comprobanteId: borrador.id,
            monto,
          },
        });
        generadas += 1;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          // Carrera con otra corrida: el período ya quedó facturado.
          yaExistian += 1;
          continue;
        }
        const motivo =
          error instanceof Error ? error.message : 'Error desconocido.';
        this.logger.warn(
          `No pude facturar la suscripción de ${s.tenant.nombre} (${per}): ${motivo}`,
        );
        salteadas.push({ tenantNombre: s.tenant.nombre, motivo });
      }
    }

    await this.prisma.plataformaEvento.create({
      data: {
        staffUserId,
        tipo: 'billing_generado',
        descripcion: `Generó el billing de ${per}: ${generadas} borrador(es), ${yaExistian} ya existían, ${salteadas.length} salteada(s).`,
        datosJson: { periodo: per, generadas, yaExistian, salteadas },
      },
    });

    return { periodo: per, generadas, yaExistian, salteadas };
  }

  /**
   * El tenant cliente como Cliente del tenant plataforma — los tenants SON
   * los clientes de Grupo Idea, y así aparecen en su cuenta corriente y
   * deudores como cualquier otro. Se matchea por CUIT (misma persona
   * jurídica) o por nombre; si no está, se crea con los datos fiscales del
   * tenant cliente (o consumidor final si no cargó los suyos).
   */
  private async clienteDelTenant(
    plataformaId: string,
    tenantClienteId: string,
    tenantNombre: string,
  ): Promise<string> {
    const configCliente = await this.prisma.configuracionFiscal.findUnique({
      where: { tenantId: tenantClienteId },
      select: { razonSocial: true, cuit: true, condicionFiscal: true },
    });

    if (configCliente?.cuit) {
      const porCuit = await this.prisma.cliente.findFirst({
        where: { tenantId: plataformaId, cuit: configCliente.cuit },
        select: { id: true },
      });
      if (porCuit) return porCuit.id;
    }
    const porNombre = await this.prisma.cliente.findFirst({
      where: { tenantId: plataformaId, nombre: tenantNombre },
      select: { id: true },
    });
    if (porNombre) return porNombre.id;

    const creado = await this.prisma.cliente.create({
      data: {
        tenantId: plataformaId,
        nombre: tenantNombre,
        razonSocial: configCliente?.razonSocial ?? null,
        cuit: configCliente?.cuit ?? null,
        condicionFiscal: configCliente?.condicionFiscal ?? 'consumidor_final',
        emailPrincipal: '',
        telefonoCodigo: '',
        telefonoNumero: '',
        paisCodigo: 'AR',
      },
      select: { id: true },
    });
    return creado.id;
  }
}
