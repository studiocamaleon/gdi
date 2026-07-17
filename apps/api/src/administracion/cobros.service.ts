import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentAuth } from '../auth/auth.types';
import type { CrearCobroDto } from './dto/cobro.dto';

/**
 * Cobros — el registro de cómo entra la plata, con las tres cifras:
 * bruto (facturado/cobrado) → neto acreditado (menos comisión + IVA
 * s/comisión) → disponible real (menos retenciones).
 * Ver docs/modulo-administracion-diseno.md §6.
 */
@Injectable()
export class CobrosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cálculo canónico de las tres cifras. */
  calcularCifras(input: {
    montoBruto: number;
    comisionPctAplicada: number;
    ivaComisionPct: number;
    retencionesTotal: number;
  }) {
    const comisionMonto = (input.montoBruto * input.comisionPctAplicada) / 100;
    const comisionIvaMonto = (comisionMonto * input.ivaComisionPct) / 100;
    const netoAcreditado = input.montoBruto - comisionMonto - comisionIvaMonto;
    const disponibleReal = netoAcreditado - input.retencionesTotal;
    const r = (n: number) => Math.round(n * 100) / 100;
    return {
      comisionMonto: r(comisionMonto),
      comisionIvaMonto: r(comisionIvaMonto),
      netoAcreditado: r(netoAcreditado),
      disponibleReal: r(disponibleReal),
    };
  }

  async findAll(auth: CurrentAuth, filtros?: { ordenId?: string }) {
    const cobros = await this.prisma.cobro.findMany({
      where: {
        tenantId: auth.tenantId,
        anuladoEl: null,
        ...(filtros?.ordenId ? { ordenId: filtros.ordenId } : {}),
      },
      include: {
        metodoPago: { select: { nombre: true, tipo: true } },
        cuentaDestino: { select: { nombre: true } },
        cliente: { select: { nombre: true } },
        retenciones: true,
        valores: { select: { id: true, estado: true, numero: true } },
      },
      orderBy: { fecha: 'desc' },
      take: 200,
    });
    return cobros.map((cobro) => this.toResponse(cobro));
  }

  async create(auth: CurrentAuth, payload: CrearCobroDto) {
    const [metodo, cuenta, orden] = await Promise.all([
      this.prisma.metodoPago.findFirst({
        where: { id: payload.metodoPagoId, tenantId: auth.tenantId },
      }),
      this.prisma.cuentaFondos.findFirst({
        where: { id: payload.cuentaDestinoId, tenantId: auth.tenantId },
      }),
      payload.ordenId
        ? this.prisma.ordenTrabajo.findFirst({
            where: { id: payload.ordenId, tenantId: auth.tenantId },
            select: {
              id: true,
              numero: true,
              clienteId: true,
              estado: true,
            },
          })
        : null,
    ]);
    if (!metodo)
      throw new NotFoundException('No se encontró el método de pago.');
    if (!cuenta)
      throw new NotFoundException('No se encontró la cuenta destino.');
    if (payload.ordenId && !orden) {
      throw new NotFoundException('No se encontró la orden.');
    }
    if (orden && orden.estado === 'borrador') {
      throw new BadRequestException(
        'No se pueden registrar cobros sobre un borrador: emití la orden primero.',
      );
    }

    const esCheque = metodo.tipo === 'cheque_echeq';
    if (esCheque && !payload.valor) {
      throw new BadRequestException(
        'Los cobros con cheque/echeq requieren los datos del valor.',
      );
    }
    if (!esCheque && payload.valor) {
      throw new BadRequestException(
        'Sólo los métodos de tipo cheque/echeq llevan datos de valor.',
      );
    }

    const retenciones = payload.retenciones ?? [];
    const retencionesTotal = retenciones.reduce((s, r) => s + r.monto, 0);
    const cifras = this.calcularCifras({
      montoBruto: payload.montoBruto,
      comisionPctAplicada: payload.comisionPctAplicada,
      ivaComisionPct: Number(metodo.ivaComisionPct),
      retencionesTotal,
    });

    const fecha = new Date(payload.fecha);
    const acreditaInmediato = !esCheque && metodo.plazoAcreditacionDias === 0;
    const fechaAcreditacionEstimada = esCheque
      ? payload.valor?.fechaPago
        ? new Date(payload.valor.fechaPago)
        : null
      : new Date(
          fecha.getTime() + metodo.plazoAcreditacionDias * 24 * 60 * 60 * 1000,
        );
    const periodoFiscal = payload.fecha.slice(0, 7);
    const clienteId = payload.clienteId ?? orden?.clienteId ?? null;

    const [actor, emisorEmpleado] = await Promise.all([
      this.prisma.empleado.findFirst({
        where: { tenantId: auth.tenantId, userId: auth.userId },
        select: { nombreCompleto: true },
      }),
      Promise.resolve(null),
    ]);
    void emisorEmpleado;
    const usuarioNombre = actor?.nombreCompleto ?? auth.email;

    const cobroId = await this.prisma.$transaction(async (tx) => {
      const cobro = await tx.cobro.create({
        data: {
          tenantId: auth.tenantId,
          clienteId,
          ordenId: orden?.id ?? null,
          fecha,
          metodoPagoId: metodo.id,
          cuentaDestinoId: cuenta.id,
          montoBruto: payload.montoBruto,
          comisionPctAplicada: payload.comisionPctAplicada,
          comisionMonto: cifras.comisionMonto,
          comisionIvaMonto: cifras.comisionIvaMonto,
          netoAcreditado: cifras.netoAcreditado,
          retencionesTotal,
          disponibleReal: cifras.disponibleReal,
          fechaAcreditacionEstimada,
          estadoAcreditacion: acreditaInmediato ? 'acreditado' : 'pendiente',
          notas: payload.notas ?? null,
          retenciones: {
            create: retenciones.map((r) => ({
              tenantId: auth.tenantId,
              direccion: 'sufrida',
              regimen: r.regimen,
              jurisdiccion: r.jurisdiccion ?? null,
              base: r.base,
              alicuota: r.alicuota,
              monto: r.monto,
              nroComprobante: r.nroComprobante ?? null,
              periodoFiscal,
            })),
          },
        },
      });

      if (esCheque && payload.valor) {
        await tx.valor.create({
          data: {
            tenantId: auth.tenantId,
            origen: payload.valor.origen,
            formato: payload.valor.formato,
            modalidad: payload.valor.fechaPago ? 'diferido' : 'comun',
            numero: payload.valor.numero,
            banco: payload.valor.banco,
            importe: payload.montoBruto,
            fechaEmision: payload.valor.fechaEmision
              ? new Date(payload.valor.fechaEmision)
              : null,
            fechaPago: payload.valor.fechaPago
              ? new Date(payload.valor.fechaPago)
              : null,
            estado: 'cartera',
            clienteId,
            cobroId: cobro.id,
          },
        });
      }

      // El movimiento de fondos (y el saldo) sólo cuando la plata ENTRA:
      // medios inmediatos ya; con plazo o cheque, al acreditar.
      if (acreditaInmediato) {
        await this.registrarMovimientoEntrada(tx, {
          tenantId: auth.tenantId,
          cuentaId: cuenta.id,
          fecha,
          monto: cifras.netoAcreditado,
          concepto: orden ? `Cobro ${orden.numero}` : 'Cobro registrado',
          cobroId: cobro.id,
          ordenId: orden?.id ?? null,
        });
      }

      if (orden) {
        await tx.ordenTrabajoEvento.create({
          data: {
            tenantId: auth.tenantId,
            ordenId: orden.id,
            tipo: 'nota',
            descripcion: `Cobro registrado: $${Math.round(payload.montoBruto).toLocaleString('es-AR')} · ${metodo.nombre}${esCheque ? ' (valor en cartera)' : ''}`,
            usuarioNombre,
            usuarioId: auth.userId,
            origen: 'usuario',
            datosJson: {
              cobroId: cobro.id,
              montoBruto: payload.montoBruto,
              netoAcreditado: cifras.netoAcreditado,
              disponibleReal: cifras.disponibleReal,
              metodo: metodo.nombre,
            },
          },
        });
      }

      return cobro.id;
    });

    return this.findOne(auth, cobroId);
  }

  /** Acreditación manual de un cobro electrónico pendiente. */
  async acreditar(auth: CurrentAuth, id: string) {
    const cobro = await this.prisma.cobro.findFirst({
      where: { id, tenantId: auth.tenantId, anuladoEl: null },
      include: {
        metodoPago: { select: { tipo: true, nombre: true } },
        orden: { select: { id: true, numero: true } },
      },
    });
    if (!cobro) throw new NotFoundException('No se encontró el cobro.');
    if (cobro.estadoAcreditacion === 'acreditado') {
      throw new BadRequestException('El cobro ya está acreditado.');
    }
    if (cobro.metodoPago.tipo === 'cheque_echeq') {
      throw new BadRequestException(
        'Los cheques se acreditan desde la cartera de valores.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.cobro.update({
        where: { id: cobro.id },
        data: { estadoAcreditacion: 'acreditado' },
      });
      await this.registrarMovimientoEntrada(tx, {
        tenantId: auth.tenantId,
        cuentaId: cobro.cuentaDestinoId,
        fecha: new Date(),
        monto: Number(cobro.netoAcreditado),
        concepto: cobro.orden
          ? `Acreditación cobro ${cobro.orden.numero}`
          : 'Acreditación de cobro',
        cobroId: cobro.id,
        ordenId: cobro.orden?.id ?? null,
      });
    });
    return this.findOne(auth, cobro.id);
  }

  async findOne(auth: CurrentAuth, id: string) {
    const cobro = await this.prisma.cobro.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: {
        metodoPago: { select: { nombre: true, tipo: true } },
        cuentaDestino: { select: { nombre: true } },
        cliente: { select: { nombre: true } },
        retenciones: true,
        valores: { select: { id: true, estado: true, numero: true } },
      },
    });
    if (!cobro) throw new NotFoundException('No se encontró el cobro.');
    return this.toResponse(cobro);
  }

  /**
   * Movimiento de entrada + saldo denormalizado + saldo corrido, en la
   * transacción del caller.
   */
  private async registrarMovimientoEntrada(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      cuentaId: string;
      fecha: Date;
      monto: number;
      concepto: string;
      cobroId: string;
      ordenId: string | null;
    },
  ) {
    const cuenta = await tx.cuentaFondos.update({
      where: { id: input.cuentaId },
      data: { saldo: { increment: input.monto } },
    });
    await tx.movimientoFondos.create({
      data: {
        tenantId: input.tenantId,
        cuentaId: input.cuentaId,
        fecha: input.fecha,
        tipo: 'entrada',
        monto: input.monto,
        concepto: input.concepto,
        origenTipo: 'cobro',
        cobroId: input.cobroId,
        ordenId: input.ordenId,
        saldoPosterior: Number(cuenta.saldo),
      },
    });
  }

  private toResponse(cobro: {
    id: string;
    fecha: Date;
    ordenId: string | null;
    clienteId: string | null;
    montoBruto: unknown;
    comisionPctAplicada: unknown;
    comisionMonto: unknown;
    comisionIvaMonto: unknown;
    netoAcreditado: unknown;
    retencionesTotal: unknown;
    disponibleReal: unknown;
    fechaAcreditacionEstimada: Date | null;
    estadoAcreditacion: string;
    notas: string | null;
    metodoPago: { nombre: string; tipo: string };
    cuentaDestino: { nombre: string };
    cliente: { nombre: string } | null;
    retenciones: Array<{
      regimen: string;
      jurisdiccion: string | null;
      base: unknown;
      alicuota: unknown;
      monto: unknown;
      nroComprobante: string | null;
    }>;
    valores: Array<{ id: string; estado: string; numero: string }>;
  }) {
    return {
      id: cobro.id,
      fecha: cobro.fecha.toISOString(),
      ordenId: cobro.ordenId,
      clienteId: cobro.clienteId,
      clienteNombre: cobro.cliente?.nombre ?? null,
      metodoNombre: cobro.metodoPago.nombre,
      metodoTipo: cobro.metodoPago.tipo,
      cuentaDestinoNombre: cobro.cuentaDestino.nombre,
      montoBruto: Number(cobro.montoBruto),
      comisionPctAplicada: Number(cobro.comisionPctAplicada),
      comisionMonto: Number(cobro.comisionMonto),
      comisionIvaMonto: Number(cobro.comisionIvaMonto),
      netoAcreditado: Number(cobro.netoAcreditado),
      retencionesTotal: Number(cobro.retencionesTotal),
      disponibleReal: Number(cobro.disponibleReal),
      fechaAcreditacionEstimada:
        cobro.fechaAcreditacionEstimada?.toISOString() ?? null,
      estadoAcreditacion: cobro.estadoAcreditacion,
      notas: cobro.notas,
      retenciones: cobro.retenciones.map((r) => ({
        regimen: r.regimen,
        jurisdiccion: r.jurisdiccion,
        base: Number(r.base),
        alicuota: Number(r.alicuota),
        monto: Number(r.monto),
        nroComprobante: r.nroComprobante,
      })),
      valor: cobro.valores[0]
        ? {
            id: cobro.valores[0].id,
            estado: cobro.valores[0].estado,
            numero: cobro.valores[0].numero,
          }
        : null,
    };
  }
}
