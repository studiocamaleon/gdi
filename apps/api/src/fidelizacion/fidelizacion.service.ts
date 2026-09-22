import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CurrentAuth } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActualizarFidelizacionDto,
  AjustarPuntosDto,
} from './dto/fidelizacion.dto';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function calcularEquivalentePuntos(
  puntos: number,
  montoBase: number,
  puntosBase: number,
) {
  if (puntos <= 0 || montoBase <= 0 || puntosBase <= 0) return 0;
  return r2((puntos * montoBase) / puntosBase);
}

export function calcularPuntosFidelizacion(args: {
  margen: number;
  porcentajeMargen: number;
  montoBase: number;
  puntosBase: number;
  acumulacionActiva: boolean;
  tieneCanje?: boolean;
}) {
  if (
    !args.acumulacionActiva ||
    args.tieneCanje ||
    args.margen <= 0 ||
    args.porcentajeMargen <= 0 ||
    args.montoBase <= 0 ||
    args.puntosBase <= 0
  ) {
    return 0;
  }
  return Math.floor(
    (args.margen * args.porcentajeMargen * args.puntosBase) /
      (100 * args.montoBase),
  );
}

@Injectable()
export class FidelizacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capacidades: CapacidadesEmpresaService = new CapacidadesEmpresaService(
      prisma,
    ),
  ) {}

  async configuracion(tenantId: string) {
    const config = await this.prisma.configuracionFidelizacion.findUnique({
      where: { tenantId },
    });
    return config
      ? this.configResponse(config)
      : {
          acumulacionActiva: false,
          porcentajeMargen: 1,
          montoBase: 1000,
          puntosBase: 100,
          activadaEl: null,
          conversionBloqueada: false,
        };
  }

  async actualizarConfiguracion(
    auth: CurrentAuth,
    dto: ActualizarFidelizacionDto,
  ) {
    await this.capacidades.exigir(auth.tenantId, 'fidelizacion');
    return this.prisma.$transaction(async (tx) => {
      await this.capacidades.exigirOperacionTx(
        tx,
        auth.tenantId,
        ['fidelizacion'],
        ['fidelizacion'],
      );
      const actual = await tx.configuracionFidelizacion.findUnique({
        where: { tenantId: auth.tenantId },
      });
      const cambiaConversion =
        (dto.montoBase !== undefined &&
          dto.montoBase !== Number(actual?.montoBase ?? 1000)) ||
        (dto.puntosBase !== undefined &&
          dto.puntosBase !== (actual?.puntosBase ?? 100));
      if (cambiaConversion) {
        const movimientos = await tx.fidelizacionMovimiento.count({
          where: { tenantId: auth.tenantId },
        });
        if (movimientos > 0)
          throw new ConflictException(
            'La equivalencia está bloqueada porque ya existen movimientos de puntos.',
          );
      }
      const ahora = new Date();
      const config = await tx.configuracionFidelizacion.upsert({
        where: { tenantId: auth.tenantId },
        create: {
          tenantId: auth.tenantId,
          acumulacionActiva: dto.acumulacionActiva ?? false,
          porcentajeMargen: dto.porcentajeMargen ?? 1,
          montoBase: dto.montoBase ?? 1000,
          puntosBase: dto.puntosBase ?? 100,
          activadaEl: dto.acumulacionActiva ? ahora : null,
        },
        update: {
          ...dto,
          ...(dto.acumulacionActiva && !actual?.activadaEl
            ? { activadaEl: ahora }
            : {}),
        },
      });
      return this.configResponse(config);
    });
  }

  /** Validar al guardar, aunque la simulación se haya hecho con otro contrato. */
  async exigirCompromisoTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    puntos: { puntosEstimados?: number | null; canjePuntos?: number | null },
  ) {
    if ((puntos.puntosEstimados ?? 0) > 0 || (puntos.canjePuntos ?? 0) > 0)
      await this.capacidades.exigirOperacionTx(
        tx,
        tenantId,
        ['fidelizacion'],
        ['fidelizacion'],
      );
  }

  async cuenta(auth: CurrentAuth, clienteId: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, tenantId: auth.tenantId },
      select: { id: true, nombre: true },
    });
    if (!cliente) throw new NotFoundException('No se encontró el cliente.');
    const cuenta = await this.prisma.fidelizacionCuenta.findUnique({
      where: { clienteId },
      include: { movimientos: { orderBy: { createdAt: 'desc' }, take: 100 } },
    });
    const config = await this.configuracion(auth.tenantId);
    return {
      cliente,
      saldoPuntos: cuenta?.saldoPuntos ?? 0,
      reservadosPuntos: cuenta?.reservadosPuntos ?? 0,
      disponiblesPuntos: Math.max(
        0,
        (cuenta?.saldoPuntos ?? 0) - (cuenta?.reservadosPuntos ?? 0),
      ),
      equivalenteMonetario: r2(
        ((cuenta?.saldoPuntos ?? 0) * config.montoBase) / config.puntosBase,
      ),
      movimientos: (cuenta?.movimientos ?? []).map((m) => ({
        ...m,
        montoEquivalente: Number(m.montoEquivalente),
        montoBaseSnapshot: Number(m.montoBaseSnapshot),
      })),
    };
  }

  async ajustar(auth: CurrentAuth, clienteId: string, dto: AjustarPuntosDto) {
    await this.capacidades.exigir(auth.tenantId, 'fidelizacion');
    return this.prisma.$transaction(async (tx) => {
      await this.capacidades.exigirOperacionTx(
        tx,
        auth.tenantId,
        ['fidelizacion'],
        ['fidelizacion'],
      );
      const cuenta = await this.bloquearCuenta(tx, auth.tenantId, clienteId);
      const delta = dto.tipo === 'CREDITO' ? dto.puntos : -dto.puntos;
      if (
        delta < 0 &&
        cuenta.saldoPuntos - cuenta.reservadosPuntos < dto.puntos
      ) {
        throw new BadRequestException(
          'El débito supera los puntos disponibles.',
        );
      }
      const config = await this.configTx(tx, auth.tenantId);
      const mov = await tx.fidelizacionMovimiento.create({
        data: {
          tenantId: auth.tenantId,
          cuentaId: cuenta.id,
          clienteId,
          tipo: dto.tipo === 'CREDITO' ? 'AJUSTE_CREDITO' : 'AJUSTE_DEBITO',
          deltaPuntos: delta,
          montoEquivalente: r2(
            (Math.abs(delta) * Number(config.montoBase)) / config.puntosBase,
          ),
          montoBaseSnapshot: config.montoBase,
          puntosBaseSnapshot: config.puntosBase,
          actorId: auth.userId,
          actorNombre: auth.email,
          motivo: dto.motivo.trim(),
        },
      });
      await tx.fidelizacionCuenta.update({
        where: { id: cuenta.id },
        data: { saldoPuntos: { increment: delta } },
      });
      await this.bloquearConversion(tx, config.id);
      return mov;
    });
  }

  async simular(
    tenantId: string,
    clienteId: string | null,
    margen: number,
    total: number,
    canjePuntos = 0,
    puntosReservadosAplicables = 0,
  ) {
    if (!(await this.capacidades.incluida(tenantId, 'fidelizacion'))) {
      if (canjePuntos > 0)
        await this.capacidades.exigir(tenantId, 'fidelizacion');
      return {
        acumulacionActiva: false,
        saldoDisponible: 0,
        saldoDisponibleMonto: 0,
        puntosEstimados: 0,
        puntosEstimadosMonto: 0,
        maximoCanjeable: 0,
        canjePuntos: 0,
        canjeMonto: 0,
        snapshot: { porcentajeMargen: 0, montoBase: 0, puntosBase: 1 },
      };
    }
    if (
      clienteId &&
      !(await this.prisma.cliente.findFirst({
        where: { id: clienteId, tenantId },
        select: { id: true },
      }))
    )
      throw new NotFoundException('No se encontró el cliente.');
    // Simular es sólo lectura: no crea configuración ni cuenta de puntos.
    const config = await this.configuracion(tenantId);
    const cuenta = clienteId
      ? await this.prisma.fidelizacionCuenta.findUnique({
          where: { clienteId },
        })
      : null;
    const disponibles = Math.max(
      0,
      (cuenta?.saldoPuntos ?? 0) -
        (cuenta?.reservadosPuntos ?? 0) +
        puntosReservadosAplicables,
    );
    const valorPunto = Number(config.montoBase) / config.puntosBase;
    const maxPorTotal = Math.floor((Math.max(0, total) + 1e-9) / valorPunto);
    const maxCanje = Math.min(disponibles, maxPorTotal);
    const canje = Math.min(Math.max(0, Math.floor(canjePuntos)), maxCanje);
    const estimados = calcularPuntosFidelizacion({
      margen,
      porcentajeMargen: Number(config.porcentajeMargen),
      montoBase: Number(config.montoBase),
      puntosBase: config.puntosBase,
      acumulacionActiva: config.acumulacionActiva && !!clienteId,
      tieneCanje: canje > 0,
    });
    return {
      acumulacionActiva: config.acumulacionActiva,
      saldoDisponible: disponibles,
      saldoDisponibleMonto: calcularEquivalentePuntos(
        disponibles,
        Number(config.montoBase),
        config.puntosBase,
      ),
      puntosEstimados: estimados,
      puntosEstimadosMonto: calcularEquivalentePuntos(
        estimados,
        Number(config.montoBase),
        config.puntosBase,
      ),
      maximoCanjeable: maxCanje,
      canjePuntos: canje,
      canjeMonto: calcularEquivalentePuntos(
        canje,
        Number(config.montoBase),
        config.puntosBase,
      ),
      snapshot: {
        porcentajeMargen: Number(config.porcentajeMargen),
        montoBase: Number(config.montoBase),
        puntosBase: config.puntosBase,
      },
    };
  }

  async simularCotizacion(
    tenantId: string,
    clienteId: string,
    cotizacionId: string,
    total: number,
    cargosNeto: number,
    canjePuntos = 0,
  ) {
    const items = await this.prisma.cotizacionItem.findMany({
      where: { tenantId, cotizacionId },
      select: {
        precioNetoTotal: true,
        precioTotal: true,
        costoTotal: true,
        impuestosSnapshotJson: true,
        comisionesSnapshotJson: true,
      },
    });
    const margen =
      items.reduce((acc, item) => {
        const neto = Number(item.precioNetoTotal ?? 0);
        const bruto = Number(item.precioTotal ?? neto);
        const internos = Array.isArray(item.impuestosSnapshotJson)
          ? (item.impuestosSnapshotJson as unknown[]).reduce<number>(
              (s, raw) => {
                const i = raw as { traslado?: string; porcentaje?: number };
                return i.traslado === 'POR_FUERA'
                  ? s
                  : s + (neto * Number(i.porcentaje ?? 0)) / 100;
              },
              0 as number,
            )
          : 0;
        const comisiones = Array.isArray(item.comisionesSnapshotJson)
          ? (item.comisionesSnapshotJson as unknown[]).reduce<number>(
              (s, raw) => {
                const c = raw as {
                  base?: string;
                  baseCalculo?: string;
                  porcentaje?: number;
                };
                return (
                  s +
                  (((c.base ?? c.baseCalculo) === 'BRUTO_COBRADO'
                    ? bruto
                    : neto) *
                    Number(c.porcentaje ?? 0)) /
                    100
                );
              },
              0 as number,
            )
          : 0;
        return (
          acc + neto - Number(item.costoTotal ?? 0) - internos - comisiones
        );
      }, 0) - cargosNeto;
    return {
      margen,
      ...(await this.simular(tenantId, clienteId, margen, total, canjePuntos)),
    };
  }

  async resumen(auth: CurrentAuth) {
    const ahora = new Date();
    const inicioPeriodo = new Date(
      Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1),
    );
    const [config, cuentas, emitidos, canjeados, recientes] = await Promise.all(
      [
        this.configuracion(auth.tenantId),
        this.prisma.fidelizacionCuenta.aggregate({
          where: { tenantId: auth.tenantId },
          _sum: { saldoPuntos: true, reservadosPuntos: true },
          _count: true,
        }),
        this.prisma.fidelizacionMovimiento.aggregate({
          where: {
            tenantId: auth.tenantId,
            tipo: 'GANANCIA',
            createdAt: { gte: inicioPeriodo },
          },
          _sum: { deltaPuntos: true },
        }),
        this.prisma.fidelizacionMovimiento.aggregate({
          where: {
            tenantId: auth.tenantId,
            tipo: 'CANJE',
            createdAt: { gte: inicioPeriodo },
          },
          _sum: { deltaPuntos: true },
        }),
        this.prisma.fidelizacionMovimiento.findMany({
          where: { tenantId: auth.tenantId },
          include: { cliente: { select: { nombre: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ],
    );
    const saldo = cuentas._sum.saldoPuntos ?? 0;
    return {
      config,
      metricas: {
        clientes: cuentas._count,
        saldoPuntos: saldo,
        reservadosPuntos: cuentas._sum.reservadosPuntos ?? 0,
        equivalenteMonetario: r2(
          (saldo * config.montoBase) / config.puntosBase,
        ),
        emitidos: emitidos._sum.deltaPuntos ?? 0,
        canjeados: Math.abs(canjeados._sum.deltaPuntos ?? 0),
      },
      recientes,
    };
  }

  async reservar(
    tx: Prisma.TransactionClient,
    args: {
      tenantId: string;
      clienteId: string;
      cotizacionId?: string;
      ordenId?: string;
      puntos: number;
      expiraEl?: Date | null;
    },
  ) {
    if (args.puntos <= 0) return null;
    await this.capacidades.exigirOperacionTx(
      tx,
      args.tenantId,
      ['fidelizacion'],
      ['fidelizacion'],
    );
    const cuenta = await this.bloquearCuenta(tx, args.tenantId, args.clienteId);
    if (cuenta.saldoPuntos - cuenta.reservadosPuntos < args.puntos)
      throw new ConflictException(
        'El cliente ya no tiene suficientes puntos disponibles.',
      );
    const config = await this.configTx(tx, args.tenantId);
    const reserva = await tx.fidelizacionReserva.create({
      data: {
        ...args,
        cuentaId: cuenta.id,
        monto: r2((args.puntos * Number(config.montoBase)) / config.puntosBase),
        expiraEl: args.expiraEl ?? null,
      },
    });
    await tx.fidelizacionCuenta.update({
      where: { id: cuenta.id },
      data: { reservadosPuntos: { increment: args.puntos } },
    });
    return reserva;
  }

  /** Conserva el apartado del presupuesto al convertir sólo parte de sus ítems. */
  async reservarParaOrden(
    tx: Prisma.TransactionClient,
    args: {
      tenantId: string;
      clienteId: string;
      ordenId: string;
      cotizacionId?: string | null;
      puntos: number;
    },
  ) {
    if (args.puntos <= 0) return null;
    await this.exigirCompromisoTx(tx, args.tenantId, {
      canjePuntos: args.puntos,
    });
    await this.bloquearCuenta(tx, args.tenantId, args.clienteId);
    // La cuenta serializa transferencia, consumo y liberación. Releer después
    // del bloqueo evita asignar una reserva que otro operador acaba de liberar.
    const reserva = args.cotizacionId
      ? await tx.fidelizacionReserva.findFirst({
          where: {
            tenantId: args.tenantId,
            clienteId: args.clienteId,
            cotizacionId: args.cotizacionId,
            ordenId: null,
            estado: 'RESERVADA',
          },
        })
      : null;
    if (!reserva)
      return this.reservar(tx, {
        tenantId: args.tenantId,
        clienteId: args.clienteId,
        ordenId: args.ordenId,
        puntos: args.puntos,
      });
    if (reserva.puntos < args.puntos)
      throw new ConflictException(
        'La reserva de puntos cambió. Revisá el canje antes de emitir la orden.',
      );
    if (reserva.puntos === args.puntos)
      return tx.fidelizacionReserva.update({
        where: { id: reserva.id },
        data: { ordenId: args.ordenId },
      });
    const monto = r2((Number(reserva.monto) * args.puntos) / reserva.puntos);
    await tx.fidelizacionReserva.update({
      where: { id: reserva.id },
      data: { puntos: { decrement: args.puntos }, monto: { decrement: monto } },
    });
    return tx.fidelizacionReserva.create({
      data: {
        tenantId: args.tenantId,
        cuentaId: reserva.cuentaId,
        clienteId: args.clienteId,
        cotizacionId: reserva.cotizacionId,
        ordenId: args.ordenId,
        puntos: args.puntos,
        monto,
        expiraEl: reserva.expiraEl,
      },
    });
  }

  async liberarReservas(
    tx: Prisma.TransactionClient,
    tenantId: string,
    where: { cotizacionId?: string; ordenId?: string },
    motivo: string,
  ) {
    const reservas = await tx.fidelizacionReserva.findMany({
      where: {
        tenantId,
        estado: 'RESERVADA',
        ...where,
        ...(where.cotizacionId && !where.ordenId ? { ordenId: null } : {}),
      },
    });
    for (const r of reservas) {
      // Mismo orden de bloqueo que el canje: cuenta y luego reserva.
      await this.bloquearCuenta(tx, tenantId, r.clienteId);
      // Puede haberse dividido o transferido a una OT mientras esperábamos.
      const vigente = await tx.fidelizacionReserva.findFirst({
        where: {
          id: r.id,
          tenantId,
          estado: 'RESERVADA',
          ...where,
          ...(where.cotizacionId && !where.ordenId ? { ordenId: null } : {}),
        },
      });
      if (!vigente) continue;
      const liberada = await tx.fidelizacionReserva.updateMany({
        where: { id: r.id, tenantId, estado: 'RESERVADA' },
        data: {
          estado: 'LIBERADA',
          liberadaEl: new Date(),
          liberadaMotivo: motivo,
        },
      });
      if (liberada.count !== 1) continue;
      await tx.fidelizacionCuenta.update({
        where: { id: r.cuentaId },
        data: { reservadosPuntos: { decrement: vigente.puntos } },
      });
    }
  }

  async consumirReserva(
    tx: Prisma.TransactionClient,
    auth: CurrentAuth,
    ordenId: string,
    reservaId: string,
  ) {
    await this.capacidades.exigirOperacionTx(
      tx,
      auth.tenantId,
      ['fidelizacion'],
      ['fidelizacion'],
    );
    const reserva = await tx.fidelizacionReserva.findFirst({
      where: { id: reservaId, tenantId: auth.tenantId, estado: 'RESERVADA' },
    });
    if (!reserva)
      throw new ConflictException(
        'La reserva de puntos ya no está disponible.',
      );
    const cuenta = await this.bloquearCuenta(
      tx,
      auth.tenantId,
      reserva.clienteId,
    );
    const orden = await tx.ordenTrabajo.findFirst({
      where: {
        id: ordenId,
        tenantId: auth.tenantId,
        clienteId: reserva.clienteId,
      },
      select: { id: true },
    });
    if (!orden || (reserva.ordenId && reserva.ordenId !== ordenId))
      throw new ConflictException(
        'La reserva de puntos no corresponde a esta orden.',
      );
    const consumida = await tx.fidelizacionReserva.updateMany({
      where: { id: reserva.id, tenantId: auth.tenantId, estado: 'RESERVADA' },
      data: { estado: 'CONSUMIDA', consumidaEl: new Date(), ordenId },
    });
    if (consumida.count !== 1)
      throw new ConflictException(
        'La reserva de puntos ya no está disponible.',
      );
    const config = await this.configTx(tx, auth.tenantId);
    const mov = await tx.fidelizacionMovimiento.create({
      data: {
        tenantId: auth.tenantId,
        cuentaId: cuenta.id,
        clienteId: reserva.clienteId,
        tipo: 'CANJE',
        deltaPuntos: -reserva.puntos,
        montoEquivalente: reserva.monto,
        montoBaseSnapshot: config.montoBase,
        puntosBaseSnapshot: config.puntosBase,
        ordenId,
        actorId: auth.userId,
        actorNombre: auth.email,
        idempotencyKey: `canje:${ordenId}`,
      },
    });
    await tx.fidelizacionCuenta.update({
      where: { id: cuenta.id },
      data: {
        saldoPuntos: { decrement: reserva.puntos },
        reservadosPuntos: { decrement: reserva.puntos },
      },
    });
    await this.bloquearConversion(tx, config.id);
    return mov;
  }

  async reconciliarOrden(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ordenId: string,
  ) {
    const incluida = await this.capacidades.incluida(
      tenantId,
      'fidelizacion',
      tx,
    );
    // Sin programa, sólo reconciliar si existe una ganancia anterior que pueda
    // necesitar reversión o restauración. Una OT sin ganancia previa no inicia puntos.
    if (
      !incluida &&
      !(await tx.fidelizacionMovimiento.findFirst({
        where: { tenantId, ordenId, tipo: 'GANANCIA' },
        select: { id: true },
      }))
    )
      return;
    const orden = await tx.ordenTrabajo.findFirst({
      where: { id: ordenId, tenantId },
      select: {
        id: true,
        clienteId: true,
        estado: true,
        total: true,
        fidelizacionPuntosEstimados: true,
        fidelizacionCanjePuntos: true,
        fidelizacionSnapshotJson: true,
        fechaEmision: true,
      },
    });
    if (!orden?.clienteId || !orden.fechaEmision) return;
    const acreditado = await tx.cobroOrden.aggregate({
      where: {
        tenantId,
        ordenId,
        cobro: { anuladoEl: null, estadoAcreditacion: 'acreditado' },
      },
      _sum: { monto: true },
    });
    const elegible =
      orden.estado === 'entregada' &&
      Number(acreditado._sum.monto ?? 0) + 0.01 >= Number(orden.total ?? 0) &&
      orden.fidelizacionCanjePuntos === 0 &&
      (orden.fidelizacionPuntosEstimados ?? 0) > 0;
    let ganancia = await tx.fidelizacionMovimiento.findFirst({
      where: { tenantId, ordenId, tipo: 'GANANCIA' },
      include: { reversiones: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!elegible && !ganancia) return;
    const cuenta = await this.bloquearCuenta(tx, tenantId, orden.clienteId);
    ganancia = await tx.fidelizacionMovimiento.findFirst({
      where: { tenantId, ordenId, tipo: 'GANANCIA' },
      include: { reversiones: true },
      orderBy: { createdAt: 'desc' },
    });
    if (
      (incluida || ganancia) &&
      elegible &&
      (!ganancia || ganancia.reversiones.length > 0)
    ) {
      const config = await this.configTx(tx, tenantId);
      const puntos = orden.fidelizacionPuntosEstimados!;
      const snapshot =
        orden.fidelizacionSnapshotJson &&
        typeof orden.fidelizacionSnapshotJson === 'object' &&
        !Array.isArray(orden.fidelizacionSnapshotJson)
          ? (orden.fidelizacionSnapshotJson as Record<string, unknown>)
          : {};
      const montoBase = Number(snapshot.montoBase ?? config.montoBase);
      const puntosBase = Number(snapshot.puntosBase ?? config.puntosBase);
      await tx.fidelizacionMovimiento.create({
        data: {
          tenantId,
          cuentaId: cuenta.id,
          clienteId: orden.clienteId,
          tipo: 'GANANCIA',
          deltaPuntos: puntos,
          montoEquivalente: r2((puntos * montoBase) / puntosBase),
          montoBaseSnapshot: montoBase,
          puntosBaseSnapshot: puntosBase,
          ordenId,
          actorNombre: 'Sistema',
          idempotencyKey: `ganancia:${ordenId}:${ganancia?.id ?? 'inicial'}`,
        },
      });
      await tx.fidelizacionCuenta.update({
        where: { id: cuenta.id },
        data: { saldoPuntos: { increment: puntos } },
      });
      await this.bloquearConversion(tx, config.id);
    } else if (!elegible && ganancia && ganancia.reversiones.length === 0) {
      await tx.fidelizacionMovimiento.create({
        data: {
          tenantId,
          cuentaId: ganancia.cuentaId,
          clienteId: ganancia.clienteId,
          tipo: 'REVERSO_GANANCIA',
          deltaPuntos: -ganancia.deltaPuntos,
          montoEquivalente: ganancia.montoEquivalente,
          montoBaseSnapshot: ganancia.montoBaseSnapshot,
          puntosBaseSnapshot: ganancia.puntosBaseSnapshot,
          ordenId,
          reversionDeId: ganancia.id,
          actorNombre: 'Sistema',
          motivo: 'La orden dejó de cumplir entrega y pago acreditado.',
        },
      });
      await tx.fidelizacionCuenta.update({
        where: { id: ganancia.cuentaId },
        data: { saldoPuntos: { decrement: ganancia.deltaPuntos } },
      });
    }
  }

  async revertirCanjeOrden(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ordenId: string,
    motivo: string,
  ) {
    let canje = await tx.fidelizacionMovimiento.findFirst({
      where: { tenantId, ordenId, tipo: 'CANJE' },
      include: { reversiones: true },
    });
    if (!canje || canje.reversiones.length > 0) return;
    await this.bloquearCuenta(tx, tenantId, canje.clienteId);
    canje = await tx.fidelizacionMovimiento.findFirst({
      where: { id: canje.id, tenantId },
      include: { reversiones: true },
    });
    if (!canje || canje.reversiones.length > 0) return;
    const puntos = Math.abs(canje.deltaPuntos);
    await tx.fidelizacionMovimiento.create({
      data: {
        tenantId,
        cuentaId: canje.cuentaId,
        clienteId: canje.clienteId,
        tipo: 'REVERSO_CANJE',
        deltaPuntos: puntos,
        montoEquivalente: canje.montoEquivalente,
        montoBaseSnapshot: canje.montoBaseSnapshot,
        puntosBaseSnapshot: canje.puntosBaseSnapshot,
        ordenId,
        reversionDeId: canje.id,
        actorNombre: 'Sistema',
        motivo,
      },
    });
    await tx.fidelizacionCuenta.update({
      where: { id: canje.cuentaId },
      data: { saldoPuntos: { increment: puntos } },
    });
  }

  private async bloquearCuenta(
    tx: Prisma.TransactionClient,
    tenantId: string,
    clienteId: string,
  ) {
    const cliente = await tx.cliente.findFirst({
      where: { id: clienteId, tenantId },
      select: { id: true },
    });
    if (!cliente) throw new NotFoundException('No se encontró el cliente.');
    await tx.fidelizacionCuenta.createMany({
      data: [{ tenantId, clienteId }],
      skipDuplicates: true,
    });
    const rows = await tx.$queryRaw<
      Array<{ id: string; saldoPuntos: number; reservadosPuntos: number }>
    >(
      Prisma.sql`SELECT id, "saldoPuntos", "reservadosPuntos" FROM "FidelizacionCuenta" WHERE "clienteId"=${clienteId}::uuid AND "tenantId"=${tenantId}::uuid FOR UPDATE`,
    );
    if (!rows[0])
      throw new ConflictException('No se pudo bloquear la cuenta de puntos.');
    return rows[0];
  }

  private async configTx(
    db: Prisma.TransactionClient | PrismaService,
    tenantId: string,
  ) {
    const existente = await db.configuracionFidelizacion.findUnique({
      where: { tenantId },
    });
    if (existente) return existente;
    // Dos primeras órdenes pueden pedir la configuración a la vez. El
    // upsert con update vacío hacía SELECT + INSERT y perdía esa carrera.
    await db.configuracionFidelizacion.createMany({
      data: [{ tenantId }],
      skipDuplicates: true,
    });
    return db.configuracionFidelizacion.findUniqueOrThrow({
      where: { tenantId },
    });
  }
  private bloquearConversion(tx: Prisma.TransactionClient, id: string) {
    return tx.configuracionFidelizacion.update({
      where: { id },
      data: { conversionBloqueadaEl: new Date() },
    });
  }
  private configResponse(c: {
    acumulacionActiva: boolean;
    porcentajeMargen: unknown;
    montoBase: unknown;
    puntosBase: number;
    activadaEl: Date | null;
    conversionBloqueadaEl: Date | null;
  }) {
    return {
      acumulacionActiva: c.acumulacionActiva,
      porcentajeMargen: Number(c.porcentajeMargen),
      montoBase: Number(c.montoBase),
      puntosBase: c.puntosBase,
      activadaEl: c.activadaEl,
      conversionBloqueada: !!c.conversionBloqueadaEl,
    };
  }
}
